export interface StoreInfo {
  id: string;
  name: string;
  code: string;
  city: string;
  monthly_budget: number;
  monthly_items_limit: number;
}

export interface OrderItemWithContext {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  store_id: string;
  store_name: string;
  store_code: string;
  reference_month: string; // YYYY-MM
}

export interface StoreMonthlyAnalyticsRow {
  store_id: string;
  store_name: string;
  store_code: string;
  store_city: string;
  reference_month: string; // YYYY-MM-01
  current_month_total: number;
  total_items: number;
  historical_avg: number;
  network_avg: number;
  diff_percentage: number;
  historical_items_avg: number;
  network_items_avg: number;
  items_diff_percentage: number;
  status: "alert" | "normal" | "empty";
}

export interface OrderItemDetail {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  pdf_url?: string | null;
}

export function getDefaultYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getPreviousYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m) return yearMonth;
  const date = new Date(y, m - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(referenceMonth: string): string {
  const clean = referenceMonth.slice(0, 7);
  const [year, month] = clean.split("-").map(Number);
  if (!year || !month) return referenceMonth;
  const date = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "2-digit",
  })
    .format(date)
    .replace(".", "");
}

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatPercent(value: number): string {
  const num = Number.isFinite(value) ? value : 0;
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(1).replace(".", ",")}%`;
}

// Normaliza registros vindos da view 'store_monthly_analytics'
export function normalizeAnalyticsRow(
  row: Record<string, unknown>
): StoreMonthlyAnalyticsRow {
  const currentTotal = Number(
    row.current_month_total ??
      row.total_amount ??
      row.order_total ??
      row.month_total ??
      0
  );
  const totalItems = Number(
    row.total_items ?? row.items_count ?? row.total_quantity ?? 0
  );
  const historicalAvg = Number(
    row.historical_avg ??
      row.moving_avg_3m ??
      row.avg_3m ??
      row.store_avg ??
      0
  );
  const networkAvg = Number(row.network_avg ?? row.rede_avg ?? historicalAvg);

  let diffPercentage = Number(
    row.diff_percentage ?? row.deviation_pct ?? row.diff_pct ?? NaN
  );
  if (!Number.isFinite(diffPercentage)) {
    diffPercentage =
      historicalAvg > 0
        ? ((currentTotal - historicalAvg) / historicalAvg) * 100
        : 0;
  }

  const rawMonth = String(row.reference_month ?? row.month ?? "").slice(0, 10);
  const referenceMonth =
    /^\d{4}-\d{2}$/.test(rawMonth) ? `${rawMonth}-01` : rawMonth;

  const isAlert =
    diffPercentage > 25 ||
    String(row.status ?? "").toLowerCase() === "alert" ||
    String(row.status ?? "").toLowerCase() === "alerta";

  return {
    store_id: String(row.store_id ?? row.id ?? ""),
    store_name: String(row.store_name ?? row.name ?? row.nome ?? "Loja"),
    store_code: String(row.store_code ?? row.code ?? row.codigo ?? ""),
    store_city: String(row.store_city ?? row.city ?? row.cidade ?? ""),
    reference_month: referenceMonth,
    current_month_total: currentTotal,
    total_items: totalItems,
    historical_avg: historicalAvg,
    network_avg: networkAvg,
    diff_percentage: Number(diffPercentage.toFixed(2)),
    historical_items_avg: totalItems,
    network_items_avg: totalItems,
    items_diff_percentage: 0,
    status: isAlert ? "alert" : currentTotal === 0 ? "empty" : "normal",
  };
}

// Calcula média móvel 3M de quantidade de itens, média da rede em itens e desvio % em quantidade
export function enrichAnalyticsWithItemsMetrics(
  rows: StoreMonthlyAnalyticsRow[]
): StoreMonthlyAnalyticsRow[] {
  const sorted = [...rows].sort((a, b) =>
    a.reference_month.localeCompare(b.reference_month)
  );

  const monthItemsTotals = new Map<string, { sum: number; count: number }>();
  for (const r of sorted) {
    const entry = monthItemsTotals.get(r.reference_month) ?? {
      sum: 0,
      count: 0,
    };
    entry.sum += r.total_items;
    entry.count += 1;
    monthItemsTotals.set(r.reference_month, entry);
  }

  return sorted.map((item) => {
    const storeHistory = sorted.filter(
      (h) =>
        h.store_id === item.store_id &&
        h.reference_month < item.reference_month
    );
    const last3 = storeHistory.slice(-3);

    const historicalItemsAvg =
      last3.length > 0
        ? last3.reduce((acc, cur) => acc + cur.total_items, 0) / last3.length
        : item.total_items;

    const netEntry = monthItemsTotals.get(item.reference_month);
    const networkItemsAvg =
      netEntry && netEntry.count > 0
        ? netEntry.sum / netEntry.count
        : item.total_items;

    const itemsDiffPct =
      historicalItemsAvg > 0
        ? ((item.total_items - historicalItemsAvg) / historicalItemsAvg) * 100
        : 0;

    return {
      ...item,
      historical_items_avg: Number(historicalItemsAvg.toFixed(2)),
      network_items_avg: Number(networkItemsAvg.toFixed(2)),
      items_diff_percentage: Number(itemsDiffPct.toFixed(2)),
    };
  });
}
