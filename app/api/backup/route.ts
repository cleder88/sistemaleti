import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/security/origin";
import { recordAuditLog } from "@/lib/audit";

const BACKUP_TABLES = [
  "stores",
  "orders",
  "order_items",
  "audit_logs",
  "user_profiles",
] as const;

const STORAGE_BUCKET = "order-files";
const PAGE_SIZE = 1000;

type AdminClient = ReturnType<typeof createAdminClient>;

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
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
        { error: "Apenas administradores podem gerir backups." },
        { status: 403 }
      ),
    };
  }

  return { admin, user };
}

async function fetchAllRows(admin: AdminClient, table: string) {
  const rows: Record<string, unknown>[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Falha ao ler '${table}': ${error.message}`);
    }

    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return rows;
}

async function listStorageFiles(admin: AdminClient) {
  const files: { name: string; size: number; updated_at: string | null }[] = [];
  const limit = 100;

  for (let offset = 0; ; offset += limit) {
    const { data, error } = await admin.storage
      .from(STORAGE_BUCKET)
      .list("", { limit, offset, sortBy: { column: "name", order: "asc" } });

    if (error) break;

    for (const item of data ?? []) {
      if (item.id === null) continue;
      files.push({
        name: item.name,
        size: Number(item.metadata?.size ?? 0),
        updated_at: item.updated_at ?? null,
      });
    }

    if (!data || data.length < limit) break;
  }

  return files;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Origem da requisição não permitida." },
      { status: 403 }
    );
  }

  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { admin, user } = auth;

  try {
    let label = "";
    try {
      const body = await request.json();
      label = String(body?.label ?? "").trim().slice(0, 120);
    } catch {
      label = "";
    }

    const generatedAt = new Date().toISOString();
    const tableData: Record<string, Record<string, unknown>[]> = {};
    const tableCounts: Record<string, number> = {};

    for (const table of BACKUP_TABLES) {
      const rows = await fetchAllRows(admin, table);
      tableData[table] = rows;
      tableCounts[table] = rows.length;
    }

    const storageFiles = await listStorageFiles(admin);

    const payload = {
      metadata: {
        generated_at: generatedAt,
        generated_by: user.email ?? user.id,
        label: label || null,
        app: "Sistema LETI",
        storage_bucket: STORAGE_BUCKET,
      },
      tables: tableData,
      storage_files: storageFiles,
    };

    const sizeBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");

    const { data, error } = await admin
      .from("system_backups")
      .insert([
        {
          label: label || `Backup ${new Date(generatedAt).toLocaleString("pt-BR")}`,
          created_by: user.id,
          created_by_email: user.email ?? null,
          payload,
          table_counts: tableCounts,
          size_bytes: sizeBytes,
        },
      ])
      .select("id, label, created_by_email, table_counts, size_bytes, created_at")
      .single();

    if (error) {
      const hint = /system_backups|relation .* does not exist/i.test(error.message)
        ? " Execute a migration 009_system_backups.sql no Supabase."
        : "";
      return NextResponse.json(
        { error: `Não foi possível guardar o backup: ${error.message}.${hint}` },
        { status: 500 }
      );
    }

    await recordAuditLog({
      action: "backup.create",
      entity: "system_backups",
      entityId: String(data?.id ?? ""),
      metadata: { label: data?.label ?? label, table_counts: tableCounts, size_bytes: sizeBytes },
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro inesperado ao gerar backup.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { admin } = auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (id) {
    const { data, error } = await admin
      .from("system_backups")
      .select("id, label, payload, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Backup não encontrado." },
        { status: 404 }
      );
    }

    const stamp = String(data.created_at ?? new Date().toISOString())
      .replace(/[:.]/g, "-")
      .slice(0, 19);

    return new NextResponse(JSON.stringify(data.payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="backup-leti-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const { data, error } = await admin
    .from("system_backups")
    .select("id, label, created_by_email, table_counts, size_bytes, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    const hint = /system_backups|relation .* does not exist/i.test(error.message)
      ? " Execute a migration 009_system_backups.sql no Supabase."
      : "";
    return NextResponse.json(
      { error: `${error.message}.${hint}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Origem da requisição não permitida." },
      { status: 403 }
    );
  }

  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { admin } = auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "ID do backup é obrigatório." },
      { status: 400 }
    );
  }

  const { error } = await admin.from("system_backups").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await recordAuditLog({
    action: "backup.delete",
    entity: "system_backups",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
