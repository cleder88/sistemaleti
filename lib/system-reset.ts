import { createHash, randomInt, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const RESET_CONFIRMATION_PHRASE = "FORMATAR";
export const RESET_CODE_TTL_MS = 10 * 60 * 1000;
export const RESET_CODE_MAX_ATTEMPTS = 5;
export const RESET_CODE_LENGTH = 6;
export const RESET_STORAGE_BUCKET = "order-files";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface AdminSession {
  admin: AdminClient;
  user: { id: string; email?: string | null };
}

/**
 * Garante que a requisição parte de um utilizador autenticado com papel admin.
 */
export async function requireAdminSession(): Promise<
  { error: NextResponse } | AdminSession
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      ),
    };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Apenas administradores podem formatar o sistema." },
        { status: 403 }
      ),
    };
  }

  return { admin, user };
}

function resetCodeSecret(): string {
  return (
    process.env.SYSTEM_RESET_CODE_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "sistema-leti-reset"
  );
}

export function hashResetCode(code: string): string {
  return createHash("sha256")
    .update(`${code}:${resetCodeSecret()}`)
    .digest("hex");
}

export function resetCodeMatches(code: string, expectedHash: string): boolean {
  try {
    const actual = Buffer.from(hashResetCode(code), "hex");
    const expected = Buffer.from(expectedHash, "hex");

    if (actual.length === 0 || actual.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function generateResetCode(): string {
  const value = randomInt(0, 1_000_000);
  return String(value).padStart(RESET_CODE_LENGTH, "0");
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;

  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

export const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export async function countRows(
  admin: AdminClient,
  table: string
): Promise<number> {
  const { count } = await admin
    .from(table)
    .select("*", { count: "exact", head: true });

  return count ?? 0;
}

export async function deleteAllRows(
  admin: AdminClient,
  table: string
): Promise<void> {
  const { error } = await admin.from(table).delete().neq("id", NIL_UUID);

  if (error) {
    throw new Error(`Falha ao limpar '${table}': ${error.message}`);
  }
}

export async function deleteAllStorageFiles(
  admin: AdminClient
): Promise<number> {
  const names: string[] = [];
  const pageSize = 100;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.storage
      .from(RESET_STORAGE_BUCKET)
      .list("", {
        limit: pageSize,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) break;

    for (const item of data ?? []) {
      if (item.id === null) continue;
      names.push(item.name);
    }

    if (!data || data.length < pageSize) break;
  }

  for (let index = 0; index < names.length; index += pageSize) {
    const batch = names.slice(index, index + pageSize);
    const { error } = await admin.storage
      .from(RESET_STORAGE_BUCKET)
      .remove(batch);

    if (error) {
      throw new Error(`Falha ao remover ficheiros: ${error.message}`);
    }
  }

  return names.length;
}
