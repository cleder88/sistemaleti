import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/security/origin";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  getClientIp,
} from "@/lib/rate-limit";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import {
  RESET_CODE_TTL_MS,
  generateResetCode,
  hashResetCode,
  maskEmail,
  requireAdminSession,
} from "@/lib/system-reset";

export const runtime = "nodejs";

const MAX_REQUESTS = 3;
const REQUEST_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Origem da requisição não permitida." },
      { status: 403 }
    );
  }

  const auth = await requireAdminSession();
  if ("error" in auth) return auth.error;
  const { admin, user } = auth;

  if (!user.email) {
    return NextResponse.json(
      { error: "A conta não possui e-mail associado." },
      { status: 400 }
    );
  }

  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit({
    key: `system-reset-code:${user.id}:${ip}`,
    limit: MAX_REQUESTS,
    windowMs: REQUEST_WINDOW_MS,
  });

  const headers = buildRateLimitHeaders(rateLimit);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error:
          "Demasiados pedidos de código. Aguarde alguns minutos e tente novamente.",
      },
      { status: 429, headers }
    );
  }

  const code = generateResetCode();
  const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS).toISOString();

  await admin
    .from("system_reset_codes")
    .update({ used: true })
    .eq("user_id", user.id)
    .eq("used", false);

  const { data: inserted, error: insertError } = await admin
    .from("system_reset_codes")
    .insert([
      {
        user_id: user.id,
        email: user.email,
        code_hash: hashResetCode(code),
        expires_at: expiresAt,
      },
    ])
    .select("id")
    .single();

  if (insertError) {
    const hint = /system_reset_codes|relation .* does not exist/i.test(
      insertError.message
    )
      ? " Execute a migration 010_system_reset_codes.sql no Supabase."
      : "";

    return NextResponse.json(
      { error: `Não foi possível gerar o código de segurança: ${insertError.message}.${hint}` },
      { status: 500 }
    );
  }

  const minutes = Math.round(RESET_CODE_TTL_MS / 60000);
  const mail = await sendEmail({
    to: user.email,
    subject: "Código de segurança para formatar o Sistema LETI",
    text: [
      "Recebemos um pedido para FORMATAR TODOS OS DADOS do Sistema LETI.",
      "",
      `Código de segurança: ${code}`,
      `Validade: ${minutes} minutos.`,
      "",
      "Se você não solicitou esta ação, ignore este e-mail e altere a sua palavra-passe.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin: 0 0 12px; color: #b91c1c;">Pedido para formatar o Sistema LETI</h2>
        <p>Recebemos um pedido para <strong>formatar todos os dados do sistema</strong>.</p>
        <p>Utilize o código abaixo para confirmar a operação:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 24px 0; color: #111827;">
          ${code}
        </p>
        <p>Este código é válido por <strong>${minutes} minutos</strong>.</p>
        <p style="color: #6b7280; font-size: 13px;">
          Se você não solicitou esta ação, ignore este e-mail e altere a sua palavra-passe imediatamente.
        </p>
      </div>
    `,
  });

  if (!mail.ok) {
    await admin.from("system_reset_codes").delete().eq("id", inserted?.id);

    if (process.env.NODE_ENV === "production" || isEmailConfigured()) {
      return NextResponse.json(
        { error: mail.error },
        { status: 503, headers }
      );
    }

    // Ambiente local sem provedor de e-mail: mostra o código no console do servidor.
    console.warn(
      `[system-reset] Provedor de e-mail não configurado. Código para ${user.email}: ${code}`
    );

    return NextResponse.json(
      {
        ok: true,
        delivery: "console",
        email: maskEmail(user.email),
        message:
          "Provedor de e-mail não configurado. O código foi impresso no console do servidor.",
      },
      { headers }
    );
  }

  return NextResponse.json(
    { ok: true, delivery: "email", email: maskEmail(user.email) },
    { headers }
  );
}
