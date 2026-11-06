export interface PresentationStoreInfo {
  id: string;
  name: string;
  code: string;
  city: string;
  monthly_budget: number;
  monthly_items_limit: number;
}

export interface PresentationAnalyticsRow {
  store_id: string;
  store_name: string;
  store_code: string;
  store_city: string;
  reference_month: string;
  current_month_total: number;
  total_items: number;
  historical_avg: number;
  network_avg: number;
  diff_percentage: number;
  status: string;
}

export interface PresentationOrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  store_id: string;
}

export type PresentationBudgetStatus =
  | "exceeded"
  | "warning"
  | "ok"
  | "unconfigured";

export interface PresentationRankingRow {
  storeId: string;
  storeName: string;
  storeCode: string;
  storeCity: string;
  amount: number;
  items: number;
  sharePct: number;
  itemsSharePct: number;
  diffPct: number;
  historicalAvg: number;
  networkAvg: number;
  status: string;
  previousAmount: number | null;
  previousItems: number | null;
  variationPct: number | null;
  itemsVariationPct: number | null;
}

export interface PresentationProductRow {
  name: string;
  quantity: number;
  amount: number;
  avgUnitPrice: number;
  sharePct: number;
  storesCount: number;
}

export interface PresentationBudgetRow {
  storeId: string;
  storeName: string;
  storeCode: string;
  amount: number;
  items: number;
  budget: number;
  itemsLimit: number;
  budgetUsagePct: number | null;
  itemsUsagePct: number | null;
  status: PresentationBudgetStatus;
}

export interface PresentationData {
  monthKey: string;
  monthLabel: string;
  previousMonthKey: string;
  previousMonthLabel: string;
  totalAmount: number;
  totalItems: number;
  totalStores: number;
  storesWithOrders: number;
  averagePerStore: number;
  averageItemsPerStore: number;
  previousAmount: number;
  previousItems: number;
  amountVariationPct: number | null;
  itemsVariationPct: number | null;
  complianceRate: number;
  uniqueProducts: number;
  rankingByAmount: PresentationRankingRow[];
  rankingByItems: PresentationRankingRow[];
  topProductsByAmount: PresentationProductRow[];
  topProductsByQuantity: PresentationProductRow[];
  alerts: PresentationRankingRow[];
  budgets: PresentationBudgetRow[];
  budgetConfiguredCount: number;
  budgetExceededCount: number;
  budgetWarningCount: number;
  highlights: string[];
}

export interface BuildPresentationInput {
  monthKey: string;
  analyticsRows: PresentationAnalyticsRow[];
  stores: PresentationStoreInfo[];
  orderItems: PresentationOrderItem[];
}

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const SHORT_MONTH_NAMES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export function getCurrentMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function isValidMonthKey(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

export function formatMonthLabel(
  monthKey: string,
  style: "long" | "short" = "long"
): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return monthKey;
  if (style === "short") {
    return `${SHORT_MONTH_NAMES[month - 1]}/${String(year).slice(-2)}`;
  }
  return `${MONTH_NAMES[month - 1]} de ${year}`;
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1).replace(".", ",")}%`;
}

function sumBy<T>(rows: T[], selector: (row: T) => number): number {
  return rows.reduce((total, row) => total + (selector(row) || 0), 0);
}

export function buildPresentation({
  monthKey,
  analyticsRows,
  stores,
  orderItems,
}: BuildPresentationInput): PresentationData {
  const previousMonthKey = shiftMonthKey(monthKey, -1);

  const monthRows = analyticsRows.filter(
    (row) => row.reference_month.slice(0, 7) === monthKey
  );
  const previousRows = analyticsRows.filter(
    (row) => row.reference_month.slice(0, 7) === previousMonthKey
  );

  const totalAmount = sumBy(monthRows, (row) => row.current_month_total);
  const totalItems = sumBy(monthRows, (row) => row.total_items);
  const previousAmount = sumBy(
    previousRows,
    (row) => row.current_month_total
  );
  const previousItems = sumBy(previousRows, (row) => row.total_items);
  const storesWithOrders = monthRows.length;
  const totalStores = stores.length || storesWithOrders;

  const amountVariationPct =
    previousAmount > 0
      ? ((totalAmount - previousAmount) / previousAmount) * 100
      : null;
  const itemsVariationPct =
    previousItems > 0
      ? ((totalItems - previousItems) / previousItems) * 100
      : null;

  const previousByStore = new Map(
    previousRows.map((row) => [row.store_id, row])
  );

  const rankingByAmount: PresentationRankingRow[] = monthRows
    .map((row) => {
      const previous = previousByStore.get(row.store_id);
      const previousAmountForStore = previous
        ? previous.current_month_total
        : null;
      const previousItemsForStore = previous ? previous.total_items : null;

      return {
        storeId: row.store_id,
        storeName: row.store_name,
        storeCode: row.store_code,
        storeCity: row.store_city,
        amount: row.current_month_total,
        items: row.total_items,
        sharePct:
          totalAmount > 0 ? (row.current_month_total / totalAmount) * 100 : 0,
        itemsSharePct:
          totalItems > 0 ? (row.total_items / totalItems) * 100 : 0,
        diffPct: row.diff_percentage,
        historicalAvg: row.historical_avg,
        networkAvg: row.network_avg,
        status: row.status,
        previousAmount: previousAmountForStore,
        previousItems: previousItemsForStore,
        variationPct:
          previousAmountForStore && previousAmountForStore > 0
            ? ((row.current_month_total - previousAmountForStore) /
                previousAmountForStore) *
              100
            : null,
        itemsVariationPct:
          previousItemsForStore && previousItemsForStore > 0
            ? ((row.total_items - previousItemsForStore) /
                previousItemsForStore) *
              100
            : null,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const rankingByItems = [...rankingByAmount].sort((a, b) => b.items - a.items);

  const alerts = rankingByAmount
    .filter((row) => row.diffPct > 25)
    .sort((a, b) => b.diffPct - a.diffPct);

  const complianceRate =
    rankingByAmount.length > 0
      ? ((rankingByAmount.length - alerts.length) / rankingByAmount.length) * 100
      : 100;

  const productMap = new Map<
    string,
    {
      displayName: string;
      quantity: number;
      amount: number;
      weightedPriceSum: number;
      weightQuantity: number;
      stores: Set<string>;
    }
  >();

  for (const item of orderItems) {
    const key = item.product_name.trim().toUpperCase();
    if (!key) continue;

    const quantity = Number(item.quantity) || 0;
    const totalPrice = Number(item.total_price) || 0;
    const unitPrice =
      Number(item.unit_price) > 0
        ? Number(item.unit_price)
        : quantity > 0
        ? totalPrice / quantity
        : 0;
    const weightQuantity = quantity > 0 ? quantity : 1;

    const current = productMap.get(key) ?? {
      displayName: item.product_name.trim(),
      quantity: 0,
      amount: 0,
      weightedPriceSum: 0,
      weightQuantity: 0,
      stores: new Set<string>(),
    };

    current.quantity += quantity;
    current.amount += totalPrice;
    current.weightedPriceSum += unitPrice * weightQuantity;
    current.weightQuantity += weightQuantity;
    if (item.store_id) current.stores.add(item.store_id);

    productMap.set(key, current);
  }

  const totalProductAmount = Array.from(productMap.values()).reduce(
    (total, product) => total + product.amount,
    0
  );

  const products: PresentationProductRow[] = Array.from(productMap.values())
    .map((product) => ({
      name: product.displayName,
      quantity: product.quantity,
      amount: product.amount,
      avgUnitPrice:
        product.weightQuantity > 0
          ? product.weightedPriceSum / product.weightQuantity
          : 0,
      sharePct:
        totalProductAmount > 0
          ? (product.amount / totalProductAmount) * 100
          : 0,
      storesCount: product.stores.size,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topProductsByAmount = products.slice(0, 5);
  const topProductsByQuantity = [...products]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const monthByStore = new Map(monthRows.map((row) => [row.store_id, row]));

  const budgets: PresentationBudgetRow[] = stores
    .map((store) => {
      const row = monthByStore.get(store.id);
      const amount = row?.current_month_total ?? 0;
      const items = row?.total_items ?? 0;
      const budget = Number(store.monthly_budget) || 0;
      const itemsLimit = Number(store.monthly_items_limit) || 0;

      const budgetUsagePct =
        budget > 0 ? (amount / budget) * 100 : null;
      const itemsUsagePct =
        itemsLimit > 0 ? (items / itemsLimit) * 100 : null;
      const maxUsage = Math.max(budgetUsagePct ?? 0, itemsUsagePct ?? 0);

      const status: PresentationBudgetStatus =
        budget <= 0 && itemsLimit <= 0
          ? "unconfigured"
          : maxUsage >= 100
          ? "exceeded"
          : maxUsage >= 80
          ? "warning"
          : "ok";

      return {
        storeId: store.id,
        storeName: store.name,
        storeCode: store.code,
        amount,
        items,
        budget,
        itemsLimit,
        budgetUsagePct,
        itemsUsagePct,
        status,
      };
    })
    .sort((a, b) => {
      if (a.status === "unconfigured" && b.status !== "unconfigured") return 1;
      if (b.status === "unconfigured" && a.status !== "unconfigured") return -1;
      return (
        Math.max(b.budgetUsagePct ?? 0, b.itemsUsagePct ?? 0) -
        Math.max(a.budgetUsagePct ?? 0, a.itemsUsagePct ?? 0)
      );
    });

  const budgetConfiguredCount = budgets.filter(
    (row) => row.status !== "unconfigured"
  ).length;
  const budgetExceededCount = budgets.filter(
    (row) => row.status === "exceeded"
  ).length;
  const budgetWarningCount = budgets.filter(
    (row) => row.status === "warning"
  ).length;

  const highlights: string[] = [];

  if (monthRows.length === 0) {
    highlights.push(
      "Nenhum pedido foi registrado para o mês selecionado."
    );
    highlights.push(
      "Selecione outro período ou importe novos pedidos em PDF para gerar a apresentação."
    );
  } else {
    const topStore = rankingByAmount[0];
    if (topStore) {
      highlights.push(
        `A loja ${topStore.storeName}${
          topStore.storeCode ? ` (${topStore.storeCode})` : ""
        } liderou o mês com ${formatCurrencyBRL(
          topStore.amount
        )}, equivalente a ${topStore.sharePct
          .toFixed(1)
          .replace(".", ",")}% do total da rede.`
      );
    }

    highlights.push(
      previousItems > 0
        ? `O volume total foi de ${formatNumber(
            totalItems
          )} unidades, com variação de ${formatPercent(
            itemsVariationPct
          )} em relação a ${formatMonthLabel(previousMonthKey)}.`
        : `Foram registradas ${formatNumber(
            totalItems
          )} unidades em ${storesWithOrders} loja(s) no período.`
    );

    if (alerts.length > 0) {
      highlights.push(
        `Atenção: ${alerts.length} loja(s) ficaram acima de +25% da média histórica. O maior desvio foi de ${alerts[0].storeName} (${formatPercent(
          alerts[0].diffPct
        )}).`
      );
    } else {
      highlights.push(
        "Todas as lojas ficaram dentro da faixa de conformidade de ±25% da média histórica."
      );
    }

    const topProduct = topProductsByAmount[0];
    if (topProduct) {
      highlights.push(
        `O produto ${topProduct.name} concentrou ${formatCurrencyBRL(
          topProduct.amount
        )} em compras (${topProduct.sharePct
          .toFixed(1)
          .replace(".", ",")}% do total).`
      );
    }

    if (budgetExceededCount > 0) {
      highlights.push(
        `${budgetExceededCount} loja(s) ultrapassaram o teto de orçamento configurado neste mês.`
      );
    } else if (budgetWarningCount > 0) {
      highlights.push(
        `${budgetWarningCount} loja(s) estão próximas do limite de orçamento (80% ou mais).`
      );
    } else if (budgetConfiguredCount > 0) {
      highlights.push(
        "Todas as lojas com teto configurado permaneceram dentro do orçamento."
      );
    } else {
      highlights.push(
        "Nenhum teto de orçamento está configurado para as lojas."
      );
    }
  }

  return {
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
    previousMonthKey,
    previousMonthLabel: formatMonthLabel(previousMonthKey),
    totalAmount,
    totalItems,
    totalStores,
    storesWithOrders,
    averagePerStore:
      storesWithOrders > 0 ? totalAmount / storesWithOrders : 0,
    averageItemsPerStore:
      storesWithOrders > 0 ? totalItems / storesWithOrders : 0,
    previousAmount,
    previousItems,
    amountVariationPct,
    itemsVariationPct,
    complianceRate,
    uniqueProducts: products.length,
    rankingByAmount,
    rankingByItems,
    topProductsByAmount,
    topProductsByQuantity,
    alerts,
    budgets,
    budgetConfiguredCount,
    budgetExceededCount,
    budgetWarningCount,
    highlights,
  };
}
