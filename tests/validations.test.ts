import { describe, expect, it } from "vitest";
import { orderSchema, storeSchema } from "@/lib/validations";

const validItem = {
  product_name: "Papel A4",
  quantity: 2,
  unit_price: 5,
  total_price: 10,
};

describe("storeSchema", () => {
  it("sanitiza nome, normaliza código e aplica defaults", () => {
    const parsed = storeSchema.parse({
      name: "  Loja <b>Centro</b> ",
      code: "loja-1",
    });

    expect(parsed.name).toBe("Loja Centro");
    expect(parsed.code).toBe("LOJA-1");
    expect(parsed.status).toBe("active");
    expect(parsed.monthly_budget).toBe(0);
    expect(parsed.monthly_items_limit).toBe(0);
  });

  it("rejeita nome com menos de 3 caracteres", () => {
    expect(storeSchema.safeParse({ name: "ab" }).success).toBe(false);
  });

  it("rejeita orçamento negativo", () => {
    expect(
      storeSchema.safeParse({ name: "Loja Centro", monthly_budget: -1 }).success
    ).toBe(false);
  });
});

describe("orderSchema", () => {
  it("aceita pedido válido", () => {
    const result = orderSchema.safeParse({
      store_id: "550e8400-e29b-41d4-a716-446655440000",
      reference_month: "2026-11-01",
      items: [validItem],
    });

    expect(result.success).toBe(true);
  });

  it("rejeita mês de referência fora do formato", () => {
    const result = orderSchema.safeParse({
      store_id: "550e8400-e29b-41d4-a716-446655440000",
      reference_month: "11/2026",
      items: [validItem],
    });

    expect(result.success).toBe(false);
  });

  it("rejeita pedido sem itens", () => {
    const result = orderSchema.safeParse({
      store_id: "550e8400-e29b-41d4-a716-446655440000",
      reference_month: "2026-11-01",
      items: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejeita item com quantidade zero", () => {
    const result = orderSchema.safeParse({
      store_id: "550e8400-e29b-41d4-a716-446655440000",
      reference_month: "2026-11-01",
      items: [{ ...validItem, quantity: 0 }],
    });

    expect(result.success).toBe(false);
  });
});
