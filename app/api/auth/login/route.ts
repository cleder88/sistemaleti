import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  getClientIp,
  resetRateLimit,
} from "@/lib/rate-limit";
import { isSameOriginRequest } from "@/lib/security/origin";

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_EMAIL_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Origem da requisição não permitida." },
      { status: 403 }
    );
  }

  const clientIp = getClientIp(request);
  const rateLimitKey = `auth-login:${clientIp}`;

  const rateLimit = await checkRateLimit({
    key: rateLimitKey,
    limit: LOGIN_MAX_ATTEMPTS,
    windowMs: LOGIN_WINDOW_MS,
  });

  const headers = buildRateLimitHeaders(rateLimit);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error:
          "Demasiadas tentativas de acesso. Por favor, tente novamente após 15 minutos.",
      },
      {
        status: 429,
        headers,
      }
    );
  }

  try {
    const body = await request.json();
    const email = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");

    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        { error: "E-mail ou palavra-passe incorretos." },
        { status: 401, headers }
      );
    }

    // Limite adicional por e-mail: protege contra ataques distribuídos
    // (vários IPs) direcionados a uma única conta.
    const emailRateLimitKey = `auth-login-email:${email.toLowerCase()}`;
    const emailRateLimit = await checkRateLimit({
      key: emailRateLimitKey,
      limit: LOGIN_EMAIL_MAX_ATTEMPTS,
      windowMs: LOGIN_WINDOW_MS,
    });

    if (!emailRateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Demasiadas tentativas de acesso. Por favor, tente novamente após 15 minutos.",
        },
        {
          status: 429,
          headers: buildRateLimitHeaders(emailRateLimit),
        }
      );
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: "E-mail ou palavra-passe incorretos." },
        { status: 401, headers }
      );
    }

    // Limpa os contadores de falhas (IP e e-mail) após autenticação válida
    await Promise.all([
      resetRateLimit(rateLimitKey),
      resetRateLimit(emailRateLimitKey),
    ]);

    return NextResponse.json(
      { success: true },
      { status: 200, headers }
    );
  } catch {
    return NextResponse.json(
      { error: "E-mail ou palavra-passe incorretos." },
      { status: 401, headers }
    );
  }
}
