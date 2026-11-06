import { describe, expect, it } from "vitest";
import {
  buildPresentation,
  formatMonthLabel,
  formatPercent,
  shiftMonthKey,
  type PresentationAnalyticsRow,
  type PresentationOrderItem,
  type PresentationStoreInfo,
} from "@/lib/presentation";

const stores: PresentationStoreInfo[] = [
  {
    id: "s1",
    name: "Loja Centro",
    code: "L1",
    city: "São Paulo",
    monthly_budget: 1000,
    monthly_items_limit: 100,
  },
  {
    id: "s2",
    name: "Loja Norte",
    code: "L2",
    city: "Campinas",
    monthly_budget: 500,
    monthly_items_limit: 50,
  },
  {
    id: "s3",
    name: "Loja Sul",
    code: "L3",
    city: "Santos",
    monthly_budget: 0,
    monthly_items_limit: 0,
  },
];

const analyticsRows: PresentationAnalyticsRow[] = [
  {
    store_id: "s1",
    store_name: "Loja Centro",
    store_code: "L1",
    store_city: "São Paulo",
    reference_month: "2026-10-01",
    current_month_total: 800,
    total_items: 80,
    historical_avg: 700,
    network_avg: 600,
    diff_percentage: 14.29,
    status: "normal",
  },
  {
    store_id: "s2",
    store_name: "Loja Norte",
    store_code: "L2",
    store_city: "Campinas",
    reference_month: "2026-10-01",
    current_month_total: 400,
    total_items: 40,
    historical_avg: 420,
    network_avg: 600,
    diff_percentage: -4.76,
    status: "normal",
  },
  {
    store_id: "s1",
    store_name: "Loja Centro",
    store_code: "L1",
    store_city: "São Paulo",
    reference_month: "2026-11-01",
    current_month_total: 1200,
    total_items: 120,
    historical_avg: 800,
    network_avg: 750,
    diff_percentage: 50,
    status: "alert",
  },
  {
    store_id: "s2",
    store_name: "Loja Norte",
    store_code: "L2",
    store_city: "Campinas",
    reference_month: "2026-11-01",
    current_month_total: 300,
    total_items: 30,
    historical_avg: 400,
    network_avg: 750,
    diff_percentage: -25,
    status: "normal",
  },
];

const orderItems: PresentationOrderItem[] = [
  {
    product_name: "Produto A",
    quantity: 20,
    unit_price: 15,
    total_price: 300,
    store_id: "s1",
  },
  {
    product_name: "Produto B",
    quantity: 2,
    unit_price: 100,
    total_price: 200,
    store_id: "s1",
  },
  {
    product_name: "Produto A",
    quantity: 5,
    unit_price: 15,
    total_price: 75,
    store_id: "s2",
  },
];

describe("presentation", () => {
  it("consolida totais, rankings e produtos do mês", () => {
    const data = buildPresentation({
      monthKey: "2026-11",
      analyticsRows,
      stores,
      orderItems,
    });

    expect(data.totalAmount).toBe(1500);
    expect(data.totalItems).toBe(150);
    expect(data.previousAmount).toBe(1200);
    expect(data.previousItems).toBe(120);
    expect(data.amountVariationPct).toBeCloseTo(25, 5);
    expect(data.itemsVariationPct).toBeCloseTo(25, 5);
    expect(data.storesWithOrders).toBe(2);
    expect(data.totalStores).toBe(3);

    expect(data.rankingByAmount[0].storeId).toBe("s1");
    expect(data.rankingByAmount[0].sharePct).toBeCloseTo(80, 5);
    expect(data.rankingByAmount[0].variationPct).toBeCloseTo(50, 5);

    expect(data.rankingByItems[0].storeId).toBe("s1");
    expect(data.rankingByItems[0].itemsSharePct).toBeCloseTo(80, 5);

    expect(data.uniqueProducts).toBe(2);
    expect(data.topProductsByAmount[0].name).toBe("Produto A");
    expect(data.topProductsByAmount[0].amount).toBe(375);
    expect(data.topProductsByQuantity[0].name).toBe("Produto A");
    expect(data.topProductsByQuantity[0].quantity).toBe(25);
  });

  it("identifica alertas e uso do orçamento", () => {
    const data = buildPresentation({
      monthKey: "2026-11",
      analyticsRows,
      stores,
      orderItems,
    });

    expect(data.alerts).toHaveLength(1);
    expect(data.alerts[0].storeId).toBe("s1");
    expect(data.complianceRate).toBe(50);

    expect(data.budgetConfiguredCount).toBe(2);
    expect(data.budgetExceededCount).toBe(1);
    expect(data.budgetWarningCount).toBe(0);

    const s1Budget = data.budgets.find((row) => row.storeId === "s1");
    expect(s1Budget?.status).toBe("exceeded");
    expect(s1Budget?.budgetUsagePct).toBeCloseTo(120, 5);

    const s3Budget = data.budgets.find((row) => row.storeId === "s3");
    expect(s3Budget?.status).toBe("unconfigured");
  });

  it("retorna um resumo vazio quando o mês não tem pedidos", () => {
    const data = buildPresentation({
      monthKey: "2026-12",
      analyticsRows,
      stores,
      orderItems: [],
    });

    expect(data.totalAmount).toBe(0);
    expect(data.totalItems).toBe(0);
    expect(data.rankingByAmount).toHaveLength(0);
    expect(data.alerts).toHaveLength(0);
    expect(data.highlights[0]).toContain("Nenhum pedido");
  });

  it("formata meses e percentuais", () => {
    expect(formatMonthLabel("2026-11")).toBe("Novembro de 2026");
    expect(formatMonthLabel("2026-01", "short")).toBe("jan/26");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(formatPercent(12.345)).toBe("+12,3%");
    expect(formatPercent(-5)).toBe("-5,0%");
    expect(formatPercent(null)).toBe("—");
  });
});
