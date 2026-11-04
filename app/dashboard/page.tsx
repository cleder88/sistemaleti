"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import {
  Calendar,
  Store,
  TrendingUp,
  TrendingDown,
  Package,
  Award,
  AlertTriangle,
  Eye,
  X,
  Loader2,
  FilePlus2,
  FileText,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/navbar";
import { cn } from "@/lib/utils";

interface StoreInfo {
  id: string;
  name: string;
  code: string;
  city: string;
}

interface StoreMonthlyAnalyticsRow {
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
  status: "alert" | "normal" | "empty";
}

interface OrderItemDetail {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  pdf_url?: string | null;
}

function getDefaultYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getPreviousYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m) return yearMonth;
  const date = new Date(y, m - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(referenceMonth: string): string {
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

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number): string {
  const num = Number.isFinite(value) ? value : 0;
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(1).replace(".", ",")}%`;
}

// Normaliza registros vindos da view 'store_monthly_analytics'
function normalizeAnalyticsRow(
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
    status: isAlert ? "alert" : currentTotal === 0 ? "empty" : "normal",
  };
}

export default function DashboardPage() {
  const [selectedYearMonth, setSelectedYearMonth] =
    useState<string>(getDefaultYearMonth);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");

  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [analyticsRows, setAnalyticsRows] = useState<
    StoreMonthlyAnalyticsRow[]
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal de Itens da Loja no Mês
  const [modalStore, setModalStore] = useState<StoreMonthlyAnalyticsRow | null>(
    null
  );
  const [modalItems, setModalItems] = useState<OrderItemDetail[]>([]);
  const [loadingModalItems, setLoadingModalItems] = useState<boolean>(false);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();

      // 1. Busca lojas cadastradas
      const { data: storesData } = await supabase
        .from("stores")
        .select("*")
        .order("name", { ascending: true });

      const mappedStores: StoreInfo[] = (storesData ?? []).map(
        (s: Record<string, unknown>) => ({
          id: String(s.id ?? ""),
          name: String(s.name ?? s.nome ?? "Loja"),
          code: String(s.code ?? s.codigo ?? ""),
          city: String(s.city ?? s.cidade ?? ""),
        })
      );
      setStores(mappedStores);

      // 2. Consulta principal na view 'store_monthly_analytics'
      const { data: viewData, error: viewError } = await supabase
        .from("store_monthly_analytics")
        .select("*")
        .order("reference_month", { ascending: true });

      if (!viewError && viewData && viewData.length > 0) {
        const normalized = viewData.map((row) =>
          normalizeAnalyticsRow(row as Record<string, unknown>)
        );
        setAnalyticsRows(normalized);
        return;
      }

      // 3. Fallback caso a view 'store_monthly_analytics' esteja vazia ou ainda não criada:
      // Calcula a partir da tabela 'orders' e 'stores'
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .order("reference_month", { ascending: true });

      if (ordersError) {
        if (viewError) {
          setErrorMessage(
            `Não foi possível consultar a view 'store_monthly_analytics': ${viewError.message}`
          );
        }
        setAnalyticsRows([]);
        return;
      }

      const storeMap = new Map<string, StoreInfo>();
      mappedStores.forEach((s) => storeMap.set(s.id, s));

      // Agrupa pedidos por store_id + reference_month
      const groupedMap = new Map<
        string,
        {
          store_id: string;
          reference_month: string;
          total_amount: number;
          total_items: number;
        }
      >();

      for (const rawOrder of ordersData ?? []) {
        const order = rawOrder as Record<string, unknown>;
        const storeId = String(order.store_id ?? "");
        const refMonth = String(order.reference_month ?? "").slice(0, 7) + "-01";
        const key = `${storeId}__${refMonth}`;

        const current = groupedMap.get(key) ?? {
          store_id: storeId,
          reference_month: refMonth,
          total_amount: 0,
          total_items: 0,
        };

        current.total_amount += Number(
          order.total_amount ?? order.total_value ?? 0
        );
        current.total_items += Number(
          order.total_items ?? order.total_quantity ?? 0
        );
        groupedMap.set(key, current);
      }

      const groupedList = Array.from(groupedMap.values()).sort((a, b) =>
        a.reference_month.localeCompare(b.reference_month)
      );

      // Calcula média da rede por mês
      const monthTotals = new Map<string, { sum: number; count: number }>();
      for (const item of groupedList) {
        const entry = monthTotals.get(item.reference_month) ?? {
          sum: 0,
          count: 0,
        };
        entry.sum += item.total_amount;
        entry.count += 1;
        monthTotals.set(item.reference_month, entry);
      }

      // Calcula média móvel de 3 meses por loja
      const computedRows: StoreMonthlyAnalyticsRow[] = groupedList.map(
        (item) => {
          const storeHistory = groupedList.filter(
            (h) =>
              h.store_id === item.store_id &&
              h.reference_month < item.reference_month
          );
          const last3 = storeHistory.slice(-3);

          const historicalAvg =
            last3.length > 0
              ? last3.reduce((acc, cur) => acc + cur.total_amount, 0) /
                last3.length
              : item.total_amount;

          const netEntry = monthTotals.get(item.reference_month);
          const networkAvg =
            netEntry && netEntry.count > 0
              ? netEntry.sum / netEntry.count
              : item.total_amount;

          const diffPct =
            historicalAvg > 0
              ? ((item.total_amount - historicalAvg) / historicalAvg) * 100
              : 0;

          const storeInfo = storeMap.get(item.store_id);

          return {
            store_id: item.store_id,
            store_name: storeInfo?.name ?? "Loja",
            store_code: storeInfo?.code ?? "",
            store_city: storeInfo?.city ?? "",
            reference_month: item.reference_month,
            current_month_total: Number(item.total_amount.toFixed(2)),
            total_items: Number(item.total_items.toFixed(2)),
            historical_avg: Number(historicalAvg.toFixed(2)),
            network_avg: Number(networkAvg.toFixed(2)),
            diff_percentage: Number(diffPct.toFixed(2)),
            status:
              diffPct > 25
                ? "alert"
                : item.total_amount === 0
                ? "empty"
                : "normal",
          };
        }
      );

      setAnalyticsRows(computedRows);
    } catch {
      setErrorMessage("Erro ao carregar métricas do Dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const currentReferenceMonth = `${selectedYearMonth}-01`;
  const previousReferenceMonth = `${getPreviousYearMonth(selectedYearMonth)}-01`;

  // Linhas do mês selecionado (filtradas pela loja se selecionada)
  const monthRowsAllStores = useMemo(() => {
    return analyticsRows.filter(
      (r) => r.reference_month.slice(0, 7) === selectedYearMonth
    );
  }, [analyticsRows, selectedYearMonth]);

  const monthRowsFiltered = useMemo(() => {
    if (selectedStoreId === "all") return monthRowsAllStores;
    return monthRowsAllStores.filter((r) => r.store_id === selectedStoreId);
  }, [monthRowsAllStores, selectedStoreId]);

  const prevMonthRowsFiltered = useMemo(() => {
    const prevYearMonth = previousReferenceMonth.slice(0, 7);
    const base = analyticsRows.filter(
      (r) => r.reference_month.slice(0, 7) === prevYearMonth
    );
    if (selectedStoreId === "all") return base;
    return base.filter((r) => r.store_id === selectedStoreId);
  }, [analyticsRows, previousReferenceMonth, selectedStoreId]);

  // 2. Cálculo dos 4 Cards de KPIs no Topo
  const kpis = useMemo(() => {
    const totalMonthAmount = monthRowsFiltered.reduce(
      (sum, r) => sum + r.current_month_total,
      0
    );
    const prevMonthAmount = prevMonthRowsFiltered.reduce(
      (sum, r) => sum + r.current_month_total,
      0
    );

    const monthVariationPct =
      prevMonthAmount > 0
        ? ((totalMonthAmount - prevMonthAmount) / prevMonthAmount) * 100
        : null;

    const totalItemsVolume = monthRowsFiltered.reduce(
      (sum, r) => sum + r.total_items,
      0
    );

    // Loja com Maior Volume no Mês (considerando todas as lojas no mês ou o filtro atual)
    const rankingPool =
      monthRowsAllStores.length > 0 ? monthRowsAllStores : monthRowsFiltered;
    const topStore =
      rankingPool.length > 0
        ? [...rankingPool].sort(
            (a, b) => b.current_month_total - a.current_month_total
          )[0]
        : null;

    // Alerta de Desvio (> 25% acima da média móvel de 3 meses)
    const alertStores = monthRowsFiltered
      .filter((r) => r.diff_percentage > 25)
      .sort((a, b) => b.diff_percentage - a.diff_percentage);

    return {
      totalMonthAmount,
      prevMonthAmount,
      monthVariationPct,
      totalItemsVolume,
      topStore,
      alertStores,
    };
  }, [monthRowsFiltered, prevMonthRowsFiltered, monthRowsAllStores]);

  // 3A. Dados do Gráfico Composed (Barras + Linha Tracejada da Média da Rede)
  const composedChartData = useMemo(() => {
    const monthsSet = new Set<string>();
    analyticsRows.forEach((r) => monthsSet.add(r.reference_month.slice(0, 7)));
    const sortedMonths = Array.from(monthsSet).sort();

    return sortedMonths.map((ym) => {
      const rowsInMonth = analyticsRows.filter(
        (r) => r.reference_month.slice(0, 7) === ym
      );

      const networkAvg =
        rowsInMonth.length > 0
          ? rowsInMonth.reduce((sum, r) => sum + r.network_avg, 0) /
            rowsInMonth.length
          : 0;

      let storePurchase = 0;
      if (selectedStoreId === "all") {
        // Se "Todas as Lojas" estiver selecionado, exibe a soma ou média por loja comparada à média histórica da rede
        storePurchase =
          rowsInMonth.length > 0
            ? rowsInMonth.reduce((sum, r) => sum + r.current_month_total, 0)
            : 0;
      } else {
        const storeRow = rowsInMonth.find(
          (r) => r.store_id === selectedStoreId
        );
        storePurchase = storeRow ? storeRow.current_month_total : 0;
      }

      return {
        month: formatMonthLabel(`${ym}-01`),
        rawMonth: ym,
        compras: Number(storePurchase.toFixed(2)),
        mediaRede: Number(networkAvg.toFixed(2)),
      };
    });
  }, [analyticsRows, selectedStoreId]);

  // 3B. Dados do Gráfico de Barras Horizontais (Ranking de gastos de todas as lojas no mês selecionado)
  const horizontalRankingData = useMemo(() => {
    return [...monthRowsAllStores]
      .sort((a, b) => b.current_month_total - a.current_month_total)
      .map((row) => ({
        store_id: row.store_id,
        name: row.store_code
          ? `${row.store_name} (${row.store_code})`
          : row.store_name,
        total: Number(row.current_month_total.toFixed(2)),
        isAlert: row.diff_percentage > 25,
      }));
  }, [monthRowsAllStores]);

  // Abre modal e busca os itens pedidos da loja no mês selecionado
  async function handleOpenItemsModal(row: StoreMonthlyAnalyticsRow) {
    setModalStore(row);
    setModalItems([]);
    setLoadingModalItems(true);

    try {
      const supabase = createClient();
      const monthPrefix = row.reference_month.slice(0, 7);

      // Busca os pedidos da loja no mês de referência
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, pdf_url, reference_month")
        .eq("store_id", row.store_id)
        .gte("reference_month", `${monthPrefix}-01`)
        .lte("reference_month", `${monthPrefix}-31`);

      if (ordersError || !ordersData || ordersData.length === 0) {
        setModalItems([]);
        return;
      }

      const orderIds = ordersData.map((o) => String(o.id));
      const pdfByOrder = new Map<string, string | null>();
      ordersData.forEach((o) =>
        pdfByOrder.set(String(o.id), o.pdf_url ? String(o.pdf_url) : null)
      );

      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds)
        .order("product_name", { ascending: true });

      if (itemsError || !itemsData) {
        setModalItems([]);
        return;
      }

      const mappedItems: OrderItemDetail[] = itemsData.map(
        (item: Record<string, unknown>) => ({
          id: String(item.id ?? ""),
          product_name: String(item.product_name ?? ""),
          quantity: Number(item.quantity ?? 0),
          unit_price: Number(item.unit_price ?? 0),
          total_price: Number(item.total_price ?? 0),
          pdf_url: pdfByOrder.get(String(item.order_id ?? "")) ?? null,
        })
      );

      setModalItems(mappedItems);
    } finally {
      setLoadingModalItems(false);
    }
  }

  function closeItemsModal() {
    setModalStore(null);
    setModalItems([]);
  }

  const selectedStoreLabel = useMemo(() => {
    if (selectedStoreId === "all") return "Todas as Lojas";
    const found = stores.find((s) => s.id === selectedStoreId);
    return found ? `${found.name} (${found.code})` : "Loja Selecionada";
  }, [selectedStoreId, stores]);

  return (
    <div className="min-h-screen bg-[#556b2f]">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* 1. Cabeçalho do Dashboard com Filtros */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Dashboard de Pedidos
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Acompanhamento de gastos mensais, média móvel e alertas de desvio por unidade.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Mês/Ano */}
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="month"
                aria-label="Período (Mês/Ano)"
                value={selectedYearMonth}
                onChange={(e) => setSelectedYearMonth(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3.5 text-sm font-medium text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>

            {/* Dropdown de Filtro de Loja */}
            <div className="relative min-w-[220px]">
              <Store className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                aria-label="Filtrar por Loja"
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-8 text-sm font-medium text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="all">Todas as Lojas</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name} {store.code ? `(${store.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={loadDashboardData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              title="Atualizar dados"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>

            <Link
              href="/pedidos/novo"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              <FilePlus2 className="h-4 w-4" />
              Novo Pedido
            </Link>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {errorMessage}
          </div>
        )}

        {/* 2. Cards de KPIs no Topo */}
        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {/* KPI 1: Total em Pedidos no Mês (R$) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Total em Pedidos no Mês
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>

            <p className="mt-3 text-2xl font-bold text-slate-900">
              {formatCurrencyBRL(kpis.totalMonthAmount)}
            </p>

            <div className="mt-2 flex items-center gap-1.5 text-xs">
              {kpis.monthVariationPct !== null ? (
                <>
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold",
                      kpis.monthVariationPct > 0
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700"
                    )}
                  >
                    {kpis.monthVariationPct > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {formatPercent(kpis.monthVariationPct)}
                  </span>
                  <span className="text-slate-500">vs. mês anterior</span>
                </>
              ) : (
                <span className="text-slate-400">
                  Sem base comparativa no mês anterior
                </span>
              )}
            </div>
          </div>

          {/* KPI 2: Volume Total de Itens Solicitados */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Volume Total de Itens
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <Package className="h-4 w-4" />
              </div>
            </div>

            <p className="mt-3 text-2xl font-bold text-slate-900">
              {new Intl.NumberFormat("pt-BR").format(kpis.totalItemsVolume)}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              Unidades solicitadas em {formatMonthLabel(currentReferenceMonth)}
            </p>
          </div>

          {/* KPI 3: Loja com Maior Volume no Mês */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Maior Volume no Mês
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                <Award className="h-4 w-4" />
              </div>
            </div>

            {kpis.topStore ? (
              <>
                <p
                  className="mt-3 truncate text-lg font-bold text-slate-900"
                  title={kpis.topStore.store_name}
                >
                  {kpis.topStore.store_name}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-600">
                  {formatCurrencyBRL(kpis.topStore.current_month_total)} •{" "}
                  {kpis.topStore.total_items} itens
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 text-lg font-semibold text-slate-400">—</p>
                <p className="mt-1 text-xs text-slate-400">
                  Nenhum pedido registrado no período
                </p>
              </>
            )}
          </div>

          {/* KPI 4: Alerta de Desvio (> 25% acima da média móvel de 3 meses) */}
          <div
            className={cn(
              "rounded-xl border p-5 shadow-sm",
              kpis.alertStores.length > 0
                ? "border-red-200 bg-red-50/50"
                : "border-slate-200 bg-white"
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-xs font-semibold uppercase tracking-wider",
                  kpis.alertStores.length > 0 ? "text-red-700" : "text-slate-500"
                )}
              >
                Alerta de Desvio (&gt;25%)
              </span>
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  kpis.alertStores.length > 0
                    ? "bg-red-100 text-red-700"
                    : "bg-emerald-50 text-emerald-700"
                )}
              >
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>

            {kpis.alertStores.length > 0 ? (
              <>
                <p
                  className="mt-3 truncate text-lg font-bold text-red-900"
                  title={kpis.alertStores[0].store_name}
                >
                  {kpis.alertStores[0].store_name}
                </p>
                <p className="mt-1 text-xs font-semibold text-red-700">
                  {formatPercent(kpis.alertStores[0].diff_percentage)} acima da
                  média 3M
                  {kpis.alertStores.length > 1 &&
                    ` (+${kpis.alertStores.length - 1} loja(s))`}
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 text-lg font-bold text-emerald-700">
                  Dentro da Média
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Nenhuma loja acima de +25% da média 3M
                </p>
              </>
            )}
          </div>
        </section>

        {/* 3. Gráficos (Recharts) */}
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Gráfico 1: ComposedChart (Barras + Linha Tracejada da Média da Rede) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900">
                Evolução Mensal vs. Média da Rede
              </h2>
              <p className="text-xs text-slate-500">
                Compras mês a mês ({selectedStoreLabel}) em barras e média histórica da rede na linha tracejada.
              </p>
            </div>

            {loading ? (
              <div className="flex h-72 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
              </div>
            ) : composedChartData.length === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center text-center text-sm text-slate-400">
                Sem histórico suficiente para exibir o gráfico mensal.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={composedChartData}
                    margin={{ top: 10, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={{ stroke: "#cbd5e1" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) =>
                        `R$ ${Number(v).toLocaleString("pt-BR")}`
                      }
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatCurrencyBRL(Number(value)),
                        name,
                      ]}
                      contentStyle={{
                        borderRadius: "12px",
                        borderColor: "#e2e8f0",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar
                      dataKey="compras"
                      name={
                        selectedStoreId === "all"
                          ? "Total Compras no Mês"
                          : "Compras da Loja"
                      }
                      fill="#0f172a"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={44}
                    />
                    <Line
                      type="monotone"
                      dataKey="mediaRede"
                      name="Média Histórica da Rede"
                      stroke="#e11d48"
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      dot={{ r: 4, fill: "#e11d48" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Gráfico 2: Barras Horizontais (Ranking de gastos de todas as lojas no mês selecionado) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900">
                Ranking de Gastos por Loja ({formatMonthLabel(currentReferenceMonth)})
              </h2>
              <p className="text-xs text-slate-500">
                Comparativo entre todas as lojas no mês selecionado (vermelho indica desvio &gt; 25%).
              </p>
            </div>

            {loading ? (
              <div className="flex h-72 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
              </div>
            ) : horizontalRankingData.length === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center text-center text-sm text-slate-400">
                Nenhum pedido registrado para o mês selecionado.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={horizontalRankingData}
                    margin={{ top: 5, right: 24, left: 16, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                      stroke="#e2e8f0"
                    />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12, fill: "#64748b" }}
                      axisLine={{ stroke: "#cbd5e1" }}
                      tickLine={false}
                      tickFormatter={(v) =>
                        `R$ ${Number(v).toLocaleString("pt-BR")}`
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={{ fontSize: 12, fill: "#334155" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        formatCurrencyBRL(Number(value)),
                        "Gasto no Mês",
                      ]}
                      contentStyle={{
                        borderRadius: "12px",
                        borderColor: "#e2e8f0",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="total"
                      name="Pedido Mês Atual"
                      radius={[0, 6, 6, 0]}
                      barSize={24}
                    >
                      {horizontalRankingData.map((entry) => (
                        <Cell
                          key={entry.store_id}
                          fill={entry.isAlert ? "#dc2626" : "#0f172a"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

        {/* 4. Tabela de Detalhamento por Loja (store_monthly_analytics) */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Detalhamento por Loja ({formatMonthLabel(currentReferenceMonth)})
              </h2>
              <p className="text-xs text-slate-500">
                Dados consolidados da view{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">
                  store_monthly_analytics
                </code>
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-14 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-slate-700" />
              <p className="mt-2 text-sm">Carregando indicadores por loja...</p>
            </div>
          ) : monthRowsFiltered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <p className="text-sm font-medium text-slate-700">
                Nenhum registro encontrado para o período selecionado.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Lance um pedido em{" "}
                <Link
                  href="/pedidos/novo"
                  className="font-semibold text-slate-900 underline"
                >
                  Novo Pedido
                </Link>{" "}
                ou selecione outro mês de referência.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-3.5">Nome da Loja</th>
                    <th className="px-6 py-3.5">Pedido Mês Atual</th>
                    <th className="px-6 py-3.5">Média Histórica</th>
                    <th className="px-6 py-3.5">Diferença (%)</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {monthRowsFiltered.map((row) => {
                    const isAlert = row.diff_percentage > 25;
                    const isSaving = row.diff_percentage < -5;

                    return (
                      <tr
                        key={`${row.store_id}-${row.reference_month}`}
                        className="transition-colors hover:bg-slate-50/80"
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">
                            {row.store_name}
                          </div>
                          {(row.store_code || row.store_city) && (
                            <div className="text-xs text-slate-500">
                              {row.store_code}
                              {row.store_code && row.store_city ? " • " : ""}
                              {row.store_city}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">
                            {formatCurrencyBRL(row.current_month_total)}
                          </div>
                          <div className="text-xs text-slate-500">
                            {row.total_items} itens
                          </div>
                        </td>

                        <td className="px-6 py-4 text-slate-700">
                          {formatCurrencyBRL(row.historical_avg)}
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                              isAlert
                                ? "bg-red-50 text-red-700"
                                : isSaving
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-700"
                            )}
                          >
                            {formatPercent(row.diff_percentage)}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          {isAlert ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Acima do Limite (+25%)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Normal
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenItemsModal(row)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Ver Itens
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* Modal com os Itens Pedidos pela Loja no Mês */}
      {modalStore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-order-items-title"
        >
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3
                  id="modal-order-items-title"
                  className="text-lg font-bold text-slate-900"
                >
                  Itens Solicitados — {modalStore.store_name}
                </h3>
                <p className="text-xs text-slate-500">
                  Referência: {formatMonthLabel(modalStore.reference_month)} •
                  Total:{" "}
                  <strong className="text-slate-800">
                    {formatCurrencyBRL(modalStore.current_month_total)}
                  </strong>
                </p>
              </div>

              <button
                type="button"
                onClick={closeItemsModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Fechar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingModalItems ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-700" />
                  <p className="mt-2 text-sm">Carregando itens do pedido...</p>
                </div>
              ) : modalItems.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Nenhum item detalhado encontrado para esta loja neste mês.
                </div>
              ) : (
                <>
                  {modalItems[0]?.pdf_url && (
                    <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs">
                      <span className="font-medium text-slate-700">
                        Documento PDF original vinculado a este pedido:
                      </span>
                      <a
                        href={modalItems[0].pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold text-slate-900 underline"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Abrir PDF Original
                      </a>
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3">Produto</th>
                          <th className="px-4 py-3 text-right">Qtd</th>
                          <th className="px-4 py-3 text-right">Vlr. Unit.</th>
                          <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {modalItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-2.5 font-medium text-slate-900">
                              {item.product_name}
                            </td>
                            <td className="px-4 py-2.5 text-right text-slate-700">
                              {item.quantity}
                            </td>
                            <td className="px-4 py-2.5 text-right text-slate-600">
                              {formatCurrencyBRL(item.unit_price)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                              {formatCurrencyBRL(item.total_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end border-t border-slate-200 px-6 py-3.5">
              <button
                type="button"
                onClick={closeItemsModal}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
