import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  getClientIp,
  resetRateLimit,
} from "@/lib/rate-limit";

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rateLimitKey = `auth-login:${clientIp}`;

  const rateLimit = checkRateLimit({
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

    // Limpa o contador de falhas do IP após autenticação válida
    resetRateLimit(rateLimitKey);

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
