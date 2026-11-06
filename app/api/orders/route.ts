import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatZodErrors, orderSchema } from "@/lib/validations";
import { isSameOriginRequest } from "@/lib/security/origin";
import { recordAuditLog } from "@/lib/audit";

/**
 * POST /api/orders
 * Valida o pedido e todos os seus itens com Zod antes de inserir nas tabelas
 * 'orders' e 'order_items', utilizando exclusivamente o cliente com sessão do
 * utilizador (respeitando RLS).
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
    const parsed = orderSchema.safeParse(body);

    if (!parsed.success) {
      const details = formatZodErrors(parsed.error);
      return NextResponse.json(
        {
          error: details[0]?.message || "Dados do pedido inválidos.",
          details,
        },
        { status: 400 }
      );
    }

    const { store_id, reference_month, pdf_url, items } = parsed.data;
    const supabase = createClient();

    const normalizedItems = items.map((item) => {
      const computedTotal =
        item.total_price !== undefined && item.total_price > 0
          ? item.total_price
          : item.quantity * item.unit_price;

      return {
        product_name: item.product_name,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price.toFixed(2)),
        total_price: Number(computedTotal.toFixed(2)),
      };
    });

    const totalQuantity = normalizedItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    const totalAmount = Number(
      normalizedItems
        .reduce((sum, item) => sum + item.total_price, 0)
        .toFixed(2)
    );

    let orderId: string | null = null;

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert([
        {
          store_id,
          reference_month,
          pdf_url: pdf_url ?? null,
          total_items: totalQuantity,
          total_amount: totalAmount,
        },
      ])
      .select("id")
      .single();

    if (orderError) {
      const { data: fallbackOrder, error: fallbackError } = await supabase
        .from("orders")
        .insert([
          {
            store_id,
            reference_month,
            ...(pdf_url ? { pdf_url } : {}),
          },
        ])
        .select("id")
        .single();

      if (fallbackError || !fallbackOrder) {
        return NextResponse.json(
          {
            error: `Erro ao gravar pedido na tabela 'orders': ${
              fallbackError?.message ?? orderError.message
            }`,
          },
          { status: 400 }
        );
      }
      orderId = String(fallbackOrder.id);
    } else {
      orderId = String(orderData.id);
    }

    const orderItemsPayload = normalizedItems.map((item) => ({
      order_id: orderId,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsPayload);

    if (itemsError) {
      // Compensação: evita deixar um pedido órfão caso a gravação dos itens falhe
      await supabase.from("orders").delete().eq("id", orderId);

      return NextResponse.json(
        {
          error: `Erro ao gravar itens na tabela 'order_items': ${itemsError.message}`,
        },
        { status: 400 }
      );
    }

    await recordAuditLog({
      action: "order.create",
      entity: "orders",
      entityId: orderId,
      metadata: {
        store_id,
        reference_month,
        items_count: orderItemsPayload.length,
        total_amount: totalAmount,
        total_items: totalQuantity,
      },
    });

    return NextResponse.json(
      { order_id: orderId, items_count: orderItemsPayload.length },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Requisição inválida ao registrar pedido." },
      { status: 400 }
    );
  }
}
