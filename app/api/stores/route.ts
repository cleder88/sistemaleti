import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatZodErrors, storeSchema } from "@/lib/validations";

/**
 * POST /api/stores
 * Cria uma nova loja validando o payload com Zod e utilizando o cliente
 * com contexto da sessão do utilizador (respeitando RLS).
 */
export async function POST(request: Request) {
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
    const { data, error } = await supabase
      .from("stores")
      .insert([parsed.data])
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

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
          error: details[0]?.message || "Dados inválidos para atualização de loja.",
          details,
        },
        { status: 400 }
      );
    }

    const supabase = createClient();
    const { data, error } = await supabase
      .from("stores")
      .update(parsed.data)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Requisição inválida ao atualizar loja." },
      { status: 400 }
    );
  }
}
