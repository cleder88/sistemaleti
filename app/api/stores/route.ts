import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatZodErrors, storeSchema } from "@/lib/validations";
import { isSameOriginRequest } from "@/lib/security/origin";
import { recordAuditLog } from "@/lib/audit";

/**
 * POST /api/stores
 * Cria uma nova loja validando o payload com Zod e utilizando o cliente
 * com contexto da sessão do utilizador (respeitando RLS).
 * Inclui fallback automático caso as colunas opcionais de meta/orçamento
 * (monthly_budget / monthly_items_limit) ainda não existam na tabela 'stores'.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Origem da requisição não permitida." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const parsed = storeSchema.safeParse(body);

    if (!parsed.success) {
      const details = formatZodErrors(parsed.error);
      return NextResponse.json(
        {
          error: details[0]?.message || "Dados inválidos para cadastro de loja.",
          details,
        },
        { status: 400 }
      );
    }

    const supabase = createClient();
    const { monthly_budget, monthly_items_limit, ...corePayload } = parsed.data;

    const { data, error } = await supabase
      .from("stores")
      .insert([parsed.data])
      .select("*")
      .single();

    if (error) {
      // Fallback caso as colunas de meta ainda não tenham sido criadas no banco
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("stores")
        .insert([corePayload])
        .select("*")
        .single();

      if (fallbackError) {
        return NextResponse.json(
          { error: fallbackError.message },
          { status: 400 }
        );
      }

      await recordAuditLog({
        action: "store.create",
        entity: "stores",
        entityId: String(fallbackData?.id ?? ""),
        metadata: { name: parsed.data.name, code: parsed.data.code },
      });

      return NextResponse.json(
        {
          data: {
            ...fallbackData,
            monthly_budget,
            monthly_items_limit,
          },
        },
        { status: 201 }
      );
    }

    await recordAuditLog({
      action: "store.create",
      entity: "stores",
      entityId: String(data?.id ?? ""),
      metadata: { name: parsed.data.name, code: parsed.data.code },
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Requisição inválida ao cadastrar loja." },
      { status: 400 }
    );
  }
}

/**
 * PATCH /api/stores
 * Atualiza uma loja existente validando o payload com Zod e respeitando RLS.
 */
export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Origem da requisição não permitida." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const id = String(body?.id ?? "").trim();

    if (!id) {
      return NextResponse.json(
        {
          error: "ID da loja é obrigatório para atualização.",
          details: [{ field: "id", message: "ID da loja é obrigatório." }],
        },
        { status: 400 }
      );
    }

    const parsed = storeSchema.safeParse(body);
    if (!parsed.success) {
      const details = formatZodErrors(parsed.error);
      return NextResponse.json(
        {
          error:
            details[0]?.message || "Dados inválidos para atualização de loja.",
          details,
        },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Só altera o status quando ele foi enviado explicitamente, evitando que
    // atualizações parciais (ex.: orçamento) reativem uma loja inativa.
    const hasStatusField =
      body !== null &&
      typeof body === "object" &&
      Object.prototype.hasOwnProperty.call(body, "status");

    const payloadWithoutStatus: Partial<typeof parsed.data> = {
      ...parsed.data,
    };
    delete payloadWithoutStatus.status;

    const updatePayload = hasStatusField ? parsed.data : payloadWithoutStatus;

    const { monthly_budget, monthly_items_limit, ...corePayload } =
      updatePayload;

    const { data, error } = await supabase
      .from("stores")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("stores")
        .update(corePayload)
        .eq("id", id)
        .select("*")
        .single();

      if (fallbackError) {
        return NextResponse.json(
          { error: fallbackError.message },
          { status: 400 }
        );
      }

      await recordAuditLog({
        action: "store.update",
        entity: "stores",
        entityId: id,
        metadata: {
          name: parsed.data.name,
          code: parsed.data.code,
          monthly_budget,
          monthly_items_limit,
          status_changed: hasStatusField,
        },
      });

      return NextResponse.json(
        {
          data: {
            ...fallbackData,
            monthly_budget,
            monthly_items_limit,
          },
        },
        { status: 200 }
      );
    }

    await recordAuditLog({
      action: "store.update",
      entity: "stores",
      entityId: id,
      metadata: {
        name: parsed.data.name,
        code: parsed.data.code,
        monthly_budget,
        monthly_items_limit,
        status_changed: hasStatusField,
      },
    });

    return NextResponse.json({ data }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Requisição inválida ao atualizar loja." },
      { status: 400 }
    );
  }
}
