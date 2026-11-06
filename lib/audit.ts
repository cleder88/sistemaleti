import { createClient } from "@/lib/supabase/server";

export interface AuditLogInput {
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Registra uma ação de escrita na trilha de auditoria.
 * Falhas são silenciosas para não interromper o fluxo principal.
 */
export async function recordAuditLog(input: AuditLogInput): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("audit_logs").insert([
      {
        actor_id: user?.id ?? null,
        actor_email: user?.email ?? null,
        action: input.action,
        entity: input.entity,
        entity_id: input.entityId ?? null,
        metadata: input.metadata ?? {},
      },
    ]);
  } catch {
    // Auditoria nunca deve bloquear a operação principal
  }
}
