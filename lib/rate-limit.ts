interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

const UPSTASH_TIMEOUT_MS = 2000;
const UPSTASH_KEY_PREFIX = "sistema:ratelimit";

function getUpstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

/**
 * Extrai o endereço de IP do cliente a partir dos cabeçalhos da requisição.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const cfConnectingIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfConnectingIp) return cfConnectingIp;

  return "127.0.0.1";
}

async function checkUpstashRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult | null> {
  const config = getUpstashConfig();
  if (!config) return null;

  const redisKey = `${UPSTASH_KEY_PREFIX}:${key}`;

  try {
    const response = await fetch(`${config.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["PEXPIRE", redisKey, String(windowMs), "NX"],
        ["PTTL", redisKey],
      ]),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as Array<{
      result?: number | string;
    }>;

    const count = Number(payload?.[0]?.result ?? 0);
    if (!Number.isFinite(count) || count <= 0) return null;

    const ttlResult = Number(payload?.[2]?.result ?? -1);
    const ttlMs = ttlResult > 0 ? ttlResult : windowMs;
    const resetAt = Date.now() + ttlMs;

    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
    };
  } catch {
    // Falha no Redis não deve bloquear o usuário: cai no fallback em memória
    return null;
  }
}

function checkMemoryRateLimit({
  key,
  limit,
  windowMs,
}: RateLimitOptions): RateLimitResult {
  const now = Date.now();

  if (rateLimitStore.size > 2000) {
    rateLimitStore.forEach((value, mapKey) => {
      if (now >= value.resetAt) {
        rateLimitStore.delete(mapKey);
      }
    });
  }

  const existing = rateLimitStore.get(key);

  if (!existing || now >= existing.resetAt) {
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000)
    );
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSeconds,
    };
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/**
 * Verifica e incrementa o contador de requisições.
 * Usa Upstash Redis (distribuído) quando configurado; caso contrário,
 * recorre ao armazenamento em memória (adequado apenas a uma instância).
 */
export async function checkRateLimit(
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const distributed = await checkUpstashRateLimit(
    options.key,
    options.limit,
    options.windowMs
  );

  if (distributed) return distributed;

  return checkMemoryRateLimit(options);
}

/**
 * Reinicia o contador de tentativas para uma chave específica.
 */
export async function resetRateLimit(key: string): Promise<void> {
  const config = getUpstashConfig();

  if (config) {
    try {
      await fetch(`${config.url}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([["DEL", `${UPSTASH_KEY_PREFIX}:${key}`]]),
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
      });
    } catch {
      // Ignora falha de rede: a limpeza local abaixo continua válida
    }
  }

  rateLimitStore.delete(key);
}

/**
 * Gera os cabeçalhos HTTP padrão de Rate Limiting.
 */
export function buildRateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    "Retry-After": String(result.retryAfterSeconds),
  };
}
