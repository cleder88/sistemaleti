import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/security/origin";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  getClientIp,
} from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/audit";
import {
  RESET_CODE_LENGTH,
  RESET_CODE_MAX_ATTEMPTS,
  RESET_CONFIRMATION_PHRASE,
  countRows,
  deleteAllRows,
  deleteAllStorageFiles,
  requireAdminSession,
  resetCodeMatches,
} from "@/lib/system-reset";

export const runtime = "nodejs";

const MAX_ATTEMPTS_PER_WINDOW = 8;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

const RESET_TABLES_IN_ORDER = [
  "order_items",
  "orders",
  "stores",
  "audit_logs",
  "system_backups",
] as const;

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

  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit({
    key: `system-reset-execute:${user.id}:${ip}`,
    limit: MAX_ATTEMPTS_PER_WINDOW,
    windowMs: ATTEMPT_WINDOW_MS,
  });

  const headers = buildRateLimitHeaders(rateLimit);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiadas tentativas. Aguarde alguns minutos e tente novamente." },
      { status: 429, headers }
    );
  }

  let code = "";
  let confirmation = "";

  try {
    const body = await request.json();
    code = String(body?.code ?? "")
      .replace(/\D/g, "")
      .slice(0, RESET_CODE_LENGTH);
    confirmation = String(body?.confirmation ?? "")
      .trim()
      .toUpperCase();
  } catch {
    return NextResponse.json(
      { error: "Requisição inválida." },
      { status: 400, headers }
    );
  }

  if (confirmation !== RESET_CONFIRMATION_PHRASE) {
    return NextResponse.json(
      {
        error: `Escreva '${RESET_CONFIRMATION_PHRASE}' para confirmar a formatação.`,
      },
      { status: 400, headers }
    );
  }

  if (code.length !== RESET_CODE_LENGTH) {
    return NextResponse.json(
      { error: "Informe o código de 6 dígitos enviado por e-mail." },
      { status: 400, headers }
    );
  }

  const { data: resetCode, error: codeError } = await admin
    .from("system_reset_codes")
    .select("id, code_hash, expires_at, attempts, used")
    .eq("user_id", user.id)
    .eq("used", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (codeError) {
    const hint = /system_reset_codes|relation .* does not exist/i.test(
      codeError.message
    )
      ? " Execute a migration 010_system_reset_codes.sql no Supabase."
      : "";

    return NextResponse.json(
      { error: `${codeError.message}.${hint}` },
      { status: 500, headers }
    );
  }

  if (!resetCode) {
    return NextResponse.json(
      { error: "Nenhum código válido encontrado. Solicite um novo código." },
      { status: 400, headers }
    );
  }

  if (new Date(resetCode.expires_at).getTime() < Date.now()) {
    await admin
      .from("system_reset_codes")
      .update({ used: true })
      .eq("id", resetCode.id);

    return NextResponse.json(
      { error: "Código expirado. Solicite um novo código." },
      { status: 400, headers }
    );
  }

  const attempts = Number(resetCode.attempts ?? 0);

  if (attempts >= RESET_CODE_MAX_ATTEMPTS) {
    await admin
      .from("system_reset_codes")
      .update({ used: true })
      .eq("id", resetCode.id);

    return NextResponse.json(
      { error: "Limite de tentativas excedido. Solicite um novo código." },
      { status: 429, headers }
    );
  }

  if (!resetCodeMatches(code, String(resetCode.code_hash))) {
    await admin
      .from("system_reset_codes")
      .update({ attempts: attempts + 1 })
      .eq("id", resetCode.id);

    return NextResponse.json(
      {
        error: `Código inválido. Restam ${
          RESET_CODE_MAX_ATTEMPTS - attempts - 1
        } tentativa(s).`,
      },
      { status: 400, headers }
    );
  }

  await admin
    .from("system_reset_codes")
    .update({ used: true })
    .eq("id", resetCode.id);

  try {
    const deleted: Record<string, number> = {};

    for (const table of RESET_TABLES_IN_ORDER) {
      deleted[table] = await countRows(admin, table);
    }

    const storageFiles = await deleteAllStorageFiles(admin);

    for (const table of RESET_TABLES_IN_ORDER) {
      await deleteAllRows(admin, table);
    }

    await recordAuditLog({
      action: "system.format",
      entity: "system",
      metadata: {
        deleted_tables: deleted,
        storage_files_removed: storageFiles,
        performed_by: user.email ?? user.id,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        deleted,
        storage_files_removed: storageFiles,
        message:
          "Todos os dados operacionais foram formatados. As contas de utilizador foram preservadas.",
      },
      { headers }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado ao formatar o sistema.";

    return NextResponse.json({ error: message }, { status: 500, headers });
  }
}
