import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/security/origin";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  getClientIp,
} from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/audit";
import {
  RESET_CONFIRMATION_PHRASE,
  countRows,
  deleteAllRows,
  deleteAllStorageFiles,
  requireAdminSession,
} from "@/lib/system-reset";

export const runtime = "nodejs";

const MAX_ATTEMPTS_PER_WINDOW = 8;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

// A trilha de auditoria e os backups são preservados de propósito: apagá-los
// destruiria evidências e a última cópia de segurança disponível. O reset
// remove apenas os dados operacionais.
const RESET_TABLES_IN_ORDER = [
  "order_items",
  "orders",
  "stores",
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

  let confirmation = "";

  try {
    const body = await request.json();
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
        error: `Palavra-chave incorreta. Escreva '${RESET_CONFIRMATION_PHRASE}' para confirmar a formatação.`,
      },
      { status: 400, headers }
    );
  }

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
          "Todos os dados operacionais foram formatados. As contas de utilizador, a trilha de auditoria e os backups foram preservados.",
      },
      { headers }
    );
  } catch (error) {
    console.error("Erro inesperado ao formatar o sistema:", error);
    return NextResponse.json(
      { error: "Erro inesperado ao formatar o sistema." },
      { status: 500, headers }
    );
  }
}
