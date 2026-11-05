"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Area,
  Line,
  PieChart,
  Pie,
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
  Download,
  DollarSign,
  ShieldCheck,
  BarChart3,
  Layers,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/navbar";
import { cn } from "@/lib/utils";
import {
  downloadOrderItemsPdf,
  downloadStoresRankingPdf,
  downloadMonthlyEvolutionPdf,
  downloadItemsQuantityComparisonPdf,
  downloadCompleteDashboardReportPdf,
} from "@/lib/pdf-export";

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
  historical_items_avg: number;
  network_items_avg: number;
  items_diff_percentage: number;
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

const GOLD_DONUT_COLORS = [
  "#f59e0b",
  "#d97706",
  "#fbbf24",
  "#b45309",
  "#eab308",
  "#92400e",
  "#fde047",
  "#78350f",
];

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
    historical_items_avg: totalItems,
    network_items_avg: totalItems,
    items_diff_percentage: 0,
    status: isAlert ? "alert" : currentTotal === 0 ? "empty" : "normal",
  };
}

// Calcula média móvel 3M de quantidade de itens, média da rede em itens e desvio % em quantidade
function enrichAnalyticsWithItemsMetrics(
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

export default function DashboardPage() {
  const [selectedYearMonth, setSelectedYearMonth] =
    useState<string>(getDefaultYearMonth);
  const [rankingYearMonth, setRankingYearMonth] =
    useState<string>(getDefaultYearMonth);
  const [evolutionYearMonth, setEvolutionYearMonth] = useState<string>("all");
  const [itemsComparisonYearMonth, setItemsComparisonYearMonth] =
    useState<string>(getDefaultYearMonth);
  const [generalReportYearMonth, setGeneralReportYearMonth] =
    useState<string>(getDefaultYearMonth);
  const [itemsComparisonMode, setItemsComparisonMode] = useState<
    "stores" | "monthly"
  >("stores");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");

  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [analyticsRows, setAnalyticsRows] = useState<
    StoreMonthlyAnalyticsRow[]
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal de Itens da Loja no Mês (com suporte a escolha de meses anteriores)
  const [modalStore, setModalStore] = useState<StoreMonthlyAnalyticsRow | null>(
    null
  );
  const [modalYearMonth, setModalYearMonth] = useState<string>("");
  const [availableModalMonths, setAvailableModalMonths] = useState<string[]>(
    []
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
        setAnalyticsRows(enrichAnalyticsWithItemsMetrics(normalized));
        return;
      }

      // 3. Fallback caso a view 'store_monthly_analytics' esteja vazia ou ainda não criada
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
        const refMonth =
          String(order.reference_month ?? "").slice(0, 7) + "-01";
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
            historical_items_avg: Number(item.total_items.toFixed(2)),
            network_items_avg: Number(item.total_items.toFixed(2)),
            items_diff_percentage: 0,
            status:
              diffPct > 25
                ? "alert"
                : item.total_amount === 0
                ? "empty"
                : "normal",
          };
        }
      );

      setAnalyticsRows(enrichAnalyticsWithItemsMetrics(computedRows));
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

  // Cálculo dos KPIs de Topo e de Rodapé
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
    const prevMonthItemsVolume = prevMonthRowsFiltered.reduce(
      (sum, r) => sum + r.total_items,
      0
    );
    const itemsVariationPct =
      prevMonthItemsVolume > 0
        ? ((totalItemsVolume - prevMonthItemsVolume) / prevMonthItemsVolume) *
          100
        : null;

    const rankingPool =
      monthRowsAllStores.length > 0 ? monthRowsAllStores : monthRowsFiltered;
    const topStore =
      rankingPool.length > 0
        ? [...rankingPool].sort(
            (a, b) => b.current_month_total - a.current_month_total
          )[0]
        : null;

    const alertStores = monthRowsFiltered
      .filter((r) => r.diff_percentage > 25)
      .sort((a, b) => b.diff_percentage - a.diff_percentage);

    const complianceRate =
      monthRowsFiltered.length > 0
        ? ((monthRowsFiltered.length - alertStores.length) /
            monthRowsFiltered.length) *
          100
        : 100;

    return {
      totalMonthAmount,
      prevMonthAmount,
      monthVariationPct,
      totalItemsVolume,
      prevMonthItemsVolume,
      itemsVariationPct,
      topStore,
      alertStores,
      complianceRate,
    };
  }, [monthRowsFiltered, prevMonthRowsFiltered, monthRowsAllStores]);

  // Dados Acumulados Históricos para a linha inferior de Cards
  const historicalSummary = useMemo(() => {
    const filteredAllMonths =
      selectedStoreId === "all"
        ? analyticsRows
        : analyticsRows.filter((r) => r.store_id === selectedStoreId);

    const allTimeAmount = filteredAllMonths.reduce(
      (sum, r) => sum + r.current_month_total,
      0
    );
    const allTimeItems = filteredAllMonths.reduce(
      (sum, r) => sum + r.total_items,
      0
    );
    const avgPerStoreMonth =
      monthRowsFiltered.length > 0
        ? kpis.totalMonthAmount / monthRowsFiltered.length
        : 0;

    return {
      allTimeAmount,
      allTimeItems,
      avgPerStoreMonth,
    };
  }, [analyticsRows, selectedStoreId, monthRowsFiltered.length, kpis.totalMonthAmount]);

  // 3A. Dados do Gráfico de Evolução Mensal vs. Média da Rede
  const composedChartData = useMemo(() => {
    const monthsSet = new Set<string>();
    analyticsRows.forEach((r) => {
      const ym = r.reference_month.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) {
        monthsSet.add(ym);
      }
    });
    const sortedMonths = Array.from(monthsSet).sort();
    const filteredMonths =
      evolutionYearMonth === "all"
        ? sortedMonths
        : sortedMonths.filter((ym) => ym === evolutionYearMonth);

    return filteredMonths.map((ym) => {
      const rowsInMonth = analyticsRows.filter(
        (r) => r.reference_month.slice(0, 7) === ym
      );

      const networkAvg =
        rowsInMonth.length > 0
          ? rowsInMonth.reduce((sum, r) => sum + r.network_avg, 0) /
            rowsInMonth.length
          : 0;

      let storePurchase = 0;
      let totalItems = 0;
      if (selectedStoreId === "all") {
        storePurchase =
          rowsInMonth.length > 0
            ? rowsInMonth.reduce((sum, r) => sum + r.current_month_total, 0)
            : 0;
        totalItems =
          rowsInMonth.length > 0
            ? rowsInMonth.reduce((sum, r) => sum + r.total_items, 0)
            : 0;
      } else {
        const storeRow = rowsInMonth.find(
          (r) => r.store_id === selectedStoreId
        );
        storePurchase = storeRow ? storeRow.current_month_total : 0;
        totalItems = storeRow ? storeRow.total_items : 0;
      }

      return {
        month: formatMonthLabel(`${ym}-01`),
        rawMonth: ym,
        totalItems: Number(totalItems.toFixed(2)),
        compras: Number(storePurchase.toFixed(2)),
        mediaRede: Number(networkAvg.toFixed(2)),
      };
    });
  }, [analyticsRows, selectedStoreId, evolutionYearMonth]);

  // Meses disponíveis (ordenados do mais recente ao mais antigo)
  const availableRankingMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    analyticsRows.forEach((r) => {
      const ym = r.reference_month.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) {
        monthsSet.add(ym);
      }
    });
    return Array.from(monthsSet).sort((a, b) => b.localeCompare(a));
  }, [analyticsRows]);

  // Linhas de todas as lojas para o mês escolhido no Ranking por Loja
  const rankingMonthRows = useMemo(() => {
    const targetMonth = rankingYearMonth || selectedYearMonth;
    return analyticsRows
      .filter((r) => r.reference_month.slice(0, 7) === targetMonth)
      .sort((a, b) => b.current_month_total - a.current_month_total);
  }, [analyticsRows, rankingYearMonth, selectedYearMonth]);

  // 3B. Dados do Gráfico de Barras / Donut e Top Lojas no mês selecionado do Ranking
  const horizontalRankingData = useMemo(() => {
    const totalSum = rankingMonthRows.reduce(
      (s, r) => s + r.current_month_total,
      0
    );
    return rankingMonthRows.map((row) => ({
      store_id: row.store_id,
      name: row.store_code
        ? `${row.store_name} (${row.store_code})`
        : row.store_name,
      shortName: row.store_name,
      total: Number(row.current_month_total.toFixed(2)),
      items: row.total_items,
      sharePct: totalSum > 0 ? (row.current_month_total / totalSum) * 100 : 0,
      isAlert: row.diff_percentage > 25,
    }));
  }, [rankingMonthRows]);

  const selectedStoreLabel = useMemo(() => {
    if (selectedStoreId === "all") return "Todas as Lojas";
    const found = stores.find((s) => s.id === selectedStoreId);
    return found ? `${found.name} (${found.code})` : "Loja Selecionada";
  }, [selectedStoreId, stores]);

  function handleDownloadEvolutionPdf() {
    if (composedChartData.length === 0) return;
    const periodLabel =
      evolutionYearMonth === "all"
        ? "Todos os Meses"
        : `${formatMonthLabel(`${evolutionYearMonth}-01`).toUpperCase()} (${evolutionYearMonth})`;

    downloadMonthlyEvolutionPdf({
      storeLabel: selectedStoreLabel,
      periodLabel,
      rows: composedChartData.map((row) => ({
        monthLabel: row.month,
        rawMonth: row.rawMonth,
        totalItems: row.totalItems,
        compras: row.compras,
        mediaRede: row.mediaRede,
      })),
    });
  }

  function handleDownloadRankingPdf() {
    if (rankingMonthRows.length === 0) return;
    const targetMonth = rankingYearMonth || selectedYearMonth;
    downloadStoresRankingPdf({
      referenceMonth: `${targetMonth}-01`,
      rows: rankingMonthRows.map((row) => ({
        store_name: row.store_name,
        store_code: row.store_code,
        store_city: row.store_city,
        total_items: row.total_items,
        current_month_total: row.current_month_total,
        historical_avg: row.historical_avg,
        diff_percentage: row.diff_percentage,
      })),
    });
  }

  // 3C. Dados do Card de Comparativo em Quantidade de Produtos (Unidades)
  const itemsComparisonTargetMonth =
    itemsComparisonYearMonth || selectedYearMonth;

  const itemsComparisonStoreRows = useMemo(() => {
    const base = analyticsRows.filter(
      (r) => r.reference_month.slice(0, 7) === itemsComparisonTargetMonth
    );
    const filtered =
      selectedStoreId === "all"
        ? base
        : base.filter((r) => r.store_id === selectedStoreId);
    return [...filtered].sort((a, b) => b.total_items - a.total_items);
  }, [analyticsRows, itemsComparisonTargetMonth, selectedStoreId]);

  const itemsComparisonMonthlyRows = useMemo(() => {
    const monthsSet = new Set<string>();
    analyticsRows.forEach((r) => {
      const ym = r.reference_month.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym)) {
        monthsSet.add(ym);
      }
    });
    const sortedMonths = Array.from(monthsSet).sort();

    return sortedMonths.map((ym) => {
      const rowsInMonth = analyticsRows.filter(
        (r) => r.reference_month.slice(0, 7) === ym
      );
      const filtered =
        selectedStoreId === "all"
          ? rowsInMonth
          : rowsInMonth.filter((r) => r.store_id === selectedStoreId);

      const totalItems = filtered.reduce((sum, r) => sum + r.total_items, 0);
      const historicalItemsAvg =
        selectedStoreId === "all"
          ? filtered.reduce((sum, r) => sum + r.historical_items_avg, 0)
          : filtered[0]?.historical_items_avg ?? 0;
      const networkItemsAvg =
        rowsInMonth.length > 0
          ? rowsInMonth.reduce((sum, r) => sum + r.network_items_avg, 0) /
            rowsInMonth.length
          : 0;
      const totalAmount = filtered.reduce(
        (sum, r) => sum + r.current_month_total,
        0
      );
      const diffPct =
        historicalItemsAvg > 0
          ? ((totalItems - historicalItemsAvg) / historicalItemsAvg) * 100
          : 0;

      return {
        label: `${formatMonthLabel(`${ym}-01`)} (${ym})`,
        shortLabel: formatMonthLabel(`${ym}-01`),
        rawMonth: ym,
        total_items: Number(totalItems.toFixed(2)),
        historical_items_avg: Number(historicalItemsAvg.toFixed(2)),
        network_items_avg: Number(networkItemsAvg.toFixed(2)),
        items_diff_percentage: Number(diffPct.toFixed(2)),
        current_month_total: Number(totalAmount.toFixed(2)),
      };
    });
  }, [analyticsRows, selectedStoreId]);

  const itemsComparisonChartData = useMemo(() => {
    if (itemsComparisonMode === "monthly") {
      return itemsComparisonMonthlyRows.map((r) => ({
        name: r.shortLabel,
        fullLabel: r.label,
        quantidade: r.total_items,
        media3M: r.historical_items_avg,
        mediaRede: r.network_items_avg,
        desvioPct: r.items_diff_percentage,
        valorTotal: r.current_month_total,
      }));
    }

    return itemsComparisonStoreRows.map((r) => ({
      name: r.store_code ? `${r.store_name} (${r.store_code})` : r.store_name,
      fullLabel: r.store_code
        ? `${r.store_name} (${r.store_code})`
        : r.store_name,
      quantidade: r.total_items,
      media3M: r.historical_items_avg,
      mediaRede: r.network_items_avg,
      desvioPct: r.items_diff_percentage,
      valorTotal: r.current_month_total,
    }));
  }, [
    itemsComparisonMode,
    itemsComparisonMonthlyRows,
    itemsComparisonStoreRows,
  ]);

  const itemsComparisonSummary = useMemo(() => {
    const prevYm = getPreviousYearMonth(itemsComparisonTargetMonth);
    const prevRows = analyticsRows.filter(
      (r) =>
        r.reference_month.slice(0, 7) === prevYm &&
        (selectedStoreId === "all" || r.store_id === selectedStoreId)
    );
    const currentTotalItems = itemsComparisonStoreRows.reduce(
      (sum, r) => sum + r.total_items,
      0
    );
    const prevTotalItems = prevRows.reduce((sum, r) => sum + r.total_items, 0);
    const variationVsPrevMonth =
      prevTotalItems > 0
        ? ((currentTotalItems - prevTotalItems) / prevTotalItems) * 100
        : null;

    const avgItemsPerStore =
      itemsComparisonStoreRows.length > 0
        ? currentTotalItems / itemsComparisonStoreRows.length
        : 0;

    const topItemsStore =
      itemsComparisonStoreRows.length > 0 ? itemsComparisonStoreRows[0] : null;

    return {
      currentTotalItems,
      prevTotalItems,
      variationVsPrevMonth,
      avgItemsPerStore,
      topItemsStore,
    };
  }, [
    analyticsRows,
    itemsComparisonStoreRows,
    itemsComparisonTargetMonth,
    selectedStoreId,
  ]);

  function handleDownloadItemsComparisonPdf() {
    if (itemsComparisonChartData.length === 0) return;

    const periodLabel =
      itemsComparisonMode === "monthly"
        ? "Todos os Meses"
        : `${formatMonthLabel(`${itemsComparisonTargetMonth}-01`).toUpperCase()} (${itemsComparisonTargetMonth})`;

    downloadItemsQuantityComparisonPdf({
      periodLabel,
      modeLabel:
        itemsComparisonMode === "monthly"
          ? `Evolução Mensal (${selectedStoreLabel})`
          : `Por Loja no Mês (${selectedStoreLabel})`,
      rows: itemsComparisonChartData.map((row) => ({
        label: row.fullLabel,
        total_items: row.quantidade,
        historical_items_avg: row.media3M,
        network_items_avg: row.mediaRede,
        items_diff_percentage: row.desvioPct,
        current_month_total: row.valorTotal,
      })),
    });
  }

  // Gera o Relatório Geral Consolidado com todos os dados de todos os cards
  function handleDownloadCompleteReportPdf(overrideMonth?: string) {
    const targetYm =
      overrideMonth || generalReportYearMonth || selectedYearMonth;
    const prevYm = getPreviousYearMonth(targetYm);

    const monthRowsAll = analyticsRows.filter(
      (r) => r.reference_month.slice(0, 7) === targetYm
    );
    const monthRows =
      selectedStoreId === "all"
        ? monthRowsAll
        : monthRowsAll.filter((r) => r.store_id === selectedStoreId);

    const prevRows = analyticsRows.filter(
      (r) =>
        r.reference_month.slice(0, 7) === prevYm &&
        (selectedStoreId === "all" || r.store_id === selectedStoreId)
    );

    const totalMonthAmount = monthRows.reduce(
      (s, r) => s + r.current_month_total,
      0
    );
    const prevMonthAmount = prevRows.reduce(
      (s, r) => s + r.current_month_total,
      0
    );
    const monthVariationPct =
      prevMonthAmount > 0
        ? ((totalMonthAmount - prevMonthAmount) / prevMonthAmount) * 100
        : null;

    const totalItemsVolume = monthRows.reduce((s, r) => s + r.total_items, 0);
    const prevItemsVolume = prevRows.reduce((s, r) => s + r.total_items, 0);
    const itemsVariationPct =
      prevItemsVolume > 0
        ? ((totalItemsVolume - prevItemsVolume) / prevItemsVolume) * 100
        : null;

    const pool = monthRowsAll.length > 0 ? monthRowsAll : monthRows;
    const topValueStore =
      pool.length > 0
        ? [...pool].sort(
            (a, b) => b.current_month_total - a.current_month_total
          )[0]
        : null;
    const topItemsStore =
      pool.length > 0
        ? [...pool].sort((a, b) => b.total_items - a.total_items)[0]
        : null;

    const alertList = monthRows
      .filter((r) => r.diff_percentage > 25)
      .sort((a, b) => b.diff_percentage - a.diff_percentage);

    const alertStoresSummary =
      alertList.length > 0
        ? `${alertList[0].store_name} (${formatPercent(
            alertList[0].diff_percentage
          )})${
            alertList.length > 1 ? ` +${alertList.length - 1} loja(s)` : ""
          }`
        : "Dentro da Média (nenhuma loja acima de +25%)";

    const monthsSet = new Set<string>();
    analyticsRows.forEach((r) => {
      const ym = r.reference_month.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(ym) && ym <= targetYm) {
        monthsSet.add(ym);
      }
    });
    const sortedMonths = Array.from(monthsSet).sort();

    const monthlyEvolutionRows = sortedMonths.map((ym) => {
      const rowsInYm = analyticsRows.filter(
        (r) => r.reference_month.slice(0, 7) === ym
      );
      const filteredYm =
        selectedStoreId === "all"
          ? rowsInYm
          : rowsInYm.filter((r) => r.store_id === selectedStoreId);

      const compras = filteredYm.reduce((s, r) => s + r.current_month_total, 0);
      const totalItems = filteredYm.reduce((s, r) => s + r.total_items, 0);
      const mediaRedeValor =
        rowsInYm.length > 0
          ? rowsInYm.reduce((s, r) => s + r.network_avg, 0) / rowsInYm.length
          : 0;
      const mediaRedeItens =
        rowsInYm.length > 0
          ? rowsInYm.reduce((s, r) => s + r.network_items_avg, 0) /
            rowsInYm.length
          : 0;

      return {
        monthLabel: formatMonthLabel(`${ym}-01`),
        rawMonth: ym,
        totalItems: Number(totalItems.toFixed(2)),
        compras: Number(compras.toFixed(2)),
        mediaRedeValor: Number(mediaRedeValor.toFixed(2)),
        mediaRedeItens: Number(mediaRedeItens.toFixed(2)),
      };
    });

    downloadCompleteDashboardReportPdf({
      referenceMonthLabel: `${formatMonthLabel(`${targetYm}-01`).toUpperCase()} (${targetYm})`,
      referenceMonthSlug: targetYm,
      storeFilterLabel: selectedStoreLabel,
      kpis: {
        totalMonthAmount,
        monthVariationPct,
        totalItemsVolume,
        itemsVariationPct,
        topValueStoreLabel: topValueStore
          ? `${topValueStore.store_name} (${formatCurrencyBRL(
              topValueStore.current_month_total
            )})`
          : "Sem registros no mês",
        topItemsStoreLabel: topItemsStore
          ? `${topItemsStore.store_name} (${topItemsStore.total_items} unid.)`
          : "Sem registros no mês",
        alertStoresSummary,
      },
      storeRows: monthRows.map((r) => ({
        store_name: r.store_name,
        store_code: r.store_code,
        store_city: r.store_city,
        total_items: r.total_items,
        current_month_total: r.current_month_total,
        historical_avg: r.historical_avg,
        network_avg: r.network_avg,
        diff_percentage: r.diff_percentage,
        historical_items_avg: r.historical_items_avg,
        network_items_avg: r.network_items_avg,
        items_diff_percentage: r.items_diff_percentage,
      })),
      monthlyEvolutionRows,
    });
  }

  // Busca os itens pedidos de uma loja para um mês específico (YYYY-MM)
  const fetchModalItemsForMonth = useCallback(
    async (storeId: string, monthPrefix: string) => {
      if (!storeId || !monthPrefix) return;
      setLoadingModalItems(true);
      setModalItems([]);

      try {
        const supabase = createClient();

        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select("id, pdf_url, reference_month")
          .eq("store_id", storeId)
          .order("reference_month", { ascending: false });

        if (ordersError || !ordersData) {
          setModalItems([]);
          return;
        }

        const uniqueMonths = Array.from(
          new Set(
            ordersData
              .map((o: Record<string, unknown>) =>
                String(o.reference_month ?? "").slice(0, 7)
              )
              .filter((m) => /^\d{4}-\d{2}$/.test(m))
          )
        ).sort((a, b) => b.localeCompare(a));

        setAvailableModalMonths(uniqueMonths);

        const matchingOrders = ordersData.filter(
          (o: Record<string, unknown>) =>
            String(o.reference_month ?? "").slice(0, 7) === monthPrefix
        );

        if (matchingOrders.length === 0) {
          setModalItems([]);
          return;
        }

        const orderIds = matchingOrders.map((o) => String(o.id));
        const pdfByOrder = new Map<string, string | null>();

        for (const o of matchingOrders) {
          const rawRef = o.pdf_url ? String(o.pdf_url).trim() : "";
          if (!rawRef) {
            pdfByOrder.set(String(o.id), null);
            continue;
          }

          let storagePath = rawRef;
          const bucketMarker = "/order-files/";
          const markerIdx = rawRef.indexOf(bucketMarker);
          if (markerIdx !== -1) {
            storagePath = rawRef
              .slice(markerIdx + bucketMarker.length)
              .split("?")[0];
          }

          const { data: signedData } = await supabase.storage
            .from("order-files")
            .createSignedUrl(storagePath, 60);

          pdfByOrder.set(
            String(o.id),
            signedData?.signedUrl ?? (rawRef.startsWith("http") ? rawRef : null)
          );
        }

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
    },
    []
  );

  async function handleOpenItemsModal(row: StoreMonthlyAnalyticsRow) {
    const initialMonth = row.reference_month.slice(0, 7) || selectedYearMonth;
    setModalStore(row);
    setModalYearMonth(initialMonth);
    await fetchModalItemsForMonth(row.store_id, initialMonth);
  }

  async function handleModalMonthChange(newYearMonth: string) {
    setModalYearMonth(newYearMonth);
    if (modalStore && newYearMonth) {
      await fetchModalItemsForMonth(modalStore.store_id, newYearMonth);
    }
  }

  function closeItemsModal() {
    setModalStore(null);
    setModalYearMonth("");
    setAvailableModalMonths([]);
    setModalItems([]);
  }

  const modalTotals = useMemo(() => {
    const totalItems = modalItems.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0),
      0
    );
    const totalAmount = modalItems.reduce(
      (sum, item) => sum + (Number(item.total_price) || 0),
      0
    );
    return { totalItems, totalAmount };
  }, [modalItems]);

  function handleDownloadModalPdf() {
    if (!modalStore || modalItems.length === 0) return;

    const targetReferenceMonth = modalYearMonth
      ? `${modalYearMonth}-01`
      : modalStore.reference_month;

    downloadOrderItemsPdf({
      storeName: modalStore.store_name,
      storeCode: modalStore.store_code,
      storeCity: modalStore.store_city,
      referenceMonth: targetReferenceMonth,
      totalItems: modalTotals.totalItems,
      totalAmount: modalTotals.totalAmount,
      items: modalItems.map((item) => ({
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      })),
    });
  }

  const totalRankingSpend = useMemo(
    () => horizontalRankingData.reduce((s, r) => s + r.total, 0),
    [horizontalRankingData]
  );

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <Navbar />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:pl-72 lg:pr-8">
        {/* 1. Barra de Controle e Filtros Superiores (Estilo Executivo Dark & Gold) */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-amber-500/20 bg-[#121217] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b]" />
              <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                Visão Geral Executiva
              </h1>
            </div>
            <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
              Controle financeiro, volume físico de produtos, média móvel (3M) e relatórios consolidados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Seletor de Mês/Ano Principal */}
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-400" />
              <input
                type="month"
                aria-label="Período (Mês/Ano)"
                value={selectedYearMonth}
                onChange={(e) => {
                  setSelectedYearMonth(e.target.value);
                  setRankingYearMonth(e.target.value);
                  setItemsComparisonYearMonth(e.target.value);
                  setGeneralReportYearMonth(e.target.value);
                }}
                className="rounded-xl border border-amber-500/30 bg-[#181820] py-2 pl-10 pr-3.5 text-xs font-bold text-amber-300 focus:border-amber-400 focus:outline-none"
              />
            </div>

            {/* Dropdown de Filtro de Loja */}
            <div className="relative min-w-[210px]">
              <Store className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-400" />
              <select
                aria-label="Filtrar por Loja"
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full rounded-xl border border-amber-500/30 bg-[#181820] py-2 pl-10 pr-8 text-xs font-bold text-zinc-100 focus:border-amber-400 focus:outline-none"
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-[#181820] px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
              title="Atualizar dados"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>

            <Link
              href="/pedidos/novo"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#f59e0b] via-[#eab308] to-[#d97706] px-4 py-2 text-xs font-extrabold text-black shadow-[0_4px_20px_rgba(245,158,11,0.3)] transition-all hover:brightness-110"
            >
              <FilePlus2 className="h-4 w-4" />
              Novo Pedido
            </Link>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            {errorMessage}
          </div>
        )}

        {/* 2. LINHA DE 5 CARDS DE KPIS NO TOPO (Idêntica à referência com anéis dourados iluminados) */}
        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* KPI 1: Gasto Total no Mês (R$) */}
          <div className=" flex items-center gap-4 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#16161d] to-[#111116] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <DollarSign className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-[11px] font-medium text-zinc-400">
                Total em Pedidos
              </span>
              <p className="mt-0.5 truncate text-lg font-extrabold text-white">
                {formatCurrencyBRL(kpis.totalMonthAmount)}
              </p>
              <div className="mt-1 flex items-center gap-1 text-[11px]">
                {kpis.monthVariationPct !== null ? (
                  <>
                    <span
                      className={cn(
                        "font-bold",
                        kpis.monthVariationPct > 0
                          ? "text-amber-400"
                          : "text-emerald-400"
                      )}
                    >
                      {kpis.monthVariationPct > 0 ? "↑" : "↓"}{" "}
                      {formatPercent(kpis.monthVariationPct)}
                    </span>
                    <span className="text-zinc-500">vs mês ant.</span>
                  </>
                ) : (
                  <span className="text-zinc-500">
                    Ref. {formatMonthLabel(currentReferenceMonth)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* KPI 2: Volume Total de Produtos (Unidades) */}
          <div className="flex items-center gap-4 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#16161d] to-[#111116] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Package className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-[11px] font-medium text-zinc-400">
                Qtd. de Produtos
              </span>
              <p className="mt-0.5 truncate text-lg font-extrabold text-white">
                {new Intl.NumberFormat("pt-BR").format(kpis.totalItemsVolume)}{" "}
                <span className="text-xs font-normal text-zinc-400">un.</span>
              </p>
              <div className="mt-1 flex items-center gap-1 text-[11px]">
                {kpis.itemsVariationPct !== null ? (
                  <>
                    <span
                      className={cn(
                        "font-bold",
                        kpis.itemsVariationPct > 0
                          ? "text-amber-400"
                          : "text-emerald-400"
                      )}
                    >
                      {kpis.itemsVariationPct > 0 ? "↑" : "↓"}{" "}
                      {formatPercent(kpis.itemsVariationPct)}
                    </span>
                    <span className="text-zinc-500">vs mês ant.</span>
                  </>
                ) : (
                  <span className="text-zinc-500">Unidades no mês</span>
                )}
              </div>
            </div>
          </div>

          {/* KPI 3: Lojas com Pedidos no Mês */}
          <div className="flex items-center gap-4 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#16161d] to-[#111116] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Store className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-[11px] font-medium text-zinc-400">
                Lojas no Período
              </span>
              <p className="mt-0.5 truncate text-lg font-extrabold text-white">
                {monthRowsFiltered.length}{" "}
                <span className="text-xs font-normal text-zinc-400">
                  / {stores.length || monthRowsAllStores.length}
                </span>
              </p>
              <p className="mt-1 truncate text-[11px] text-amber-400/90">
                Unidades com pedido
              </p>
            </div>
          </div>

          {/* KPI 4: Loja com Maior Volume */}
          <div className="flex items-center gap-4 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#16161d] to-[#111116] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Award className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <span className="block truncate text-[11px] font-medium text-zinc-400">
                Maior Volume no Mês
              </span>
              {kpis.topStore ? (
                <>
                  <p
                    className="mt-0.5 truncate text-sm font-extrabold text-white"
                    title={kpis.topStore.store_name}
                  >
                    {kpis.topStore.store_name}
                  </p>
                  <p className="mt-1 truncate text-[11px] font-semibold text-amber-400">
                    {formatCurrencyBRL(kpis.topStore.current_month_total)} •{" "}
                    {kpis.topStore.total_items} un.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-0.5 text-base font-bold text-zinc-500">—</p>
                  <p className="mt-1 text-[11px] text-zinc-500">Sem pedidos</p>
                </>
              )}
            </div>
          </div>

          {/* KPI 5: Taxa de Conformidade / Alerta de Desvio (>25%) */}
          <div className="flex items-center gap-4 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#16161d] to-[#111116] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div
              className={cn(
                "flex h-13 w-13 shrink-0 items-center justify-center rounded-full border shadow-[0_0_20px_rgba(245,158,11,0.2)]",
                kpis.alertStores.length > 0
                  ? "border-red-500/40 bg-red-500/10 text-red-400"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-400"
              )}
            >
              {kpis.alertStores.length > 0 ? (
                <AlertTriangle className="h-6 w-6" />
              ) : (
                <ShieldCheck className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0">
              <span className="block truncate text-[11px] font-medium text-zinc-400">
                Conformidade 3M
              </span>
              <p className="mt-0.5 truncate text-lg font-extrabold text-white">
                {kpis.complianceRate.toFixed(0)}%
              </p>
              <p
                className={cn(
                  "mt-1 truncate text-[11px] font-semibold",
                  kpis.alertStores.length > 0
                    ? "text-red-400"
                    : "text-emerald-400"
                )}
              >
                {kpis.alertStores.length > 0
                  ? `${kpis.alertStores.length} loja(s) > +25%`
                  : "Todas dentro da meta"}
              </p>
            </div>
          </div>
        </section>

        {/* 3. SEGUNDA LINHA: 4 CARDS VISUAIS EXECUTIVOS (Inspirados na linha central da foto) */}
        <section className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Card 3.1 (4 cols): Evolução Mensal de Gastos (Area + Line Dourado - estilo "Revenue Overview") */}
          <div className="flex flex-col justify-between rounded-2xl border border-amber-500/20 bg-[#121217] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] lg:col-span-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Evolução Mensal vs. Rede
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    {evolutionYearMonth === "all"
                      ? "Todos os Meses"
                      : formatMonthLabel(`${evolutionYearMonth}-01`)}{" "}
                    • {selectedStoreLabel}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="month"
                    aria-label="Escolher mês da Evolução Mensal"
                    value={
                      evolutionYearMonth === "all"
                        ? selectedYearMonth
                        : evolutionYearMonth
                    }
                    onChange={(e) =>
                      setEvolutionYearMonth(e.target.value || "all")
                    }
                    className="rounded-lg border border-amber-500/25 bg-[#181820] px-2 py-1 text-[11px] font-semibold text-amber-300 focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleDownloadEvolutionPdf}
                    disabled={composedChartData.length === 0}
                    title="Baixar PDF da Evolução Mensal"
                    className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-2.5 py-1 text-[11px] font-bold text-black hover:brightness-110 disabled:opacity-50"
                  >
                    <Download className="h-3 w-3" />
                    PDF
                  </button>
                </div>
              </div>

              {/* Valor em destaque + atalhos de meses */}
              <div className="mt-3 flex items-baseline gap-2.5">
                <span className="text-2xl font-extrabold text-white">
                  {formatCurrencyBRL(kpis.totalMonthAmount)}
                </span>
                {kpis.monthVariationPct !== null && (
                  <span className="text-xs font-bold text-amber-400">
                    {kpis.monthVariationPct > 0 ? "↑" : "↓"}{" "}
                    {formatPercent(kpis.monthVariationPct)}
                  </span>
                )}
              </div>

              {availableRankingMonths.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEvolutionYearMonth("all")}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors",
                      evolutionYearMonth === "all"
                        ? "bg-amber-500 text-black"
                        : "border border-amber-500/20 bg-[#181820] text-zinc-400 hover:text-amber-300"
                    )}
                  >
                    Todos
                  </button>
                  {availableRankingMonths.slice(0, 4).map((ym) => (
                    <button
                      key={ym}
                      type="button"
                      onClick={() => setEvolutionYearMonth(ym)}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors",
                        evolutionYearMonth === ym
                          ? "bg-amber-500 text-black"
                          : "border border-amber-500/20 bg-[#181820] text-zinc-400 hover:text-amber-300"
                      )}
                    >
                      {formatMonthLabel(`${ym}-01`)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 h-56 w-full">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                </div>
              ) : composedChartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-xs text-zinc-500">
                  Sem histórico para o período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={composedChartData}
                    margin={{ top: 10, right: 10, left: -12, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="goldAreaGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#f59e0b"
                          stopOpacity={0.45}
                        />
                        <stop
                          offset="95%"
                          stopColor="#f59e0b"
                          stopOpacity={0.0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="rgba(245, 158, 11, 0.1)"
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "#a1a1aa" }}
                      axisLine={{ stroke: "rgba(245,158,11,0.2)" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#a1a1aa" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) =>
                        `R$${Number(v).toLocaleString("pt-BR")}`
                      }
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatCurrencyBRL(Number(value)),
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: "#141419",
                        borderRadius: "12px",
                        borderColor: "rgba(245,158,11,0.35)",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="compras"
                      name="Compras no Mês"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#goldAreaGradient)"
                      dot={{ r: 4, fill: "#fbbf24", stroke: "#09090b", strokeWidth: 1.5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="mediaRede"
                      name="Média da Rede"
                      stroke="#fde047"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={{ r: 3, fill: "#fde047" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Card 3.2 (4 cols): Ranking de Gastos por Loja com Barras de Progresso Douradas (estilo "Top Services" da foto) */}
          <div className="flex flex-col justify-between rounded-2xl border border-amber-500/20 bg-[#121217] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] lg:col-span-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Ranking de Gastos por Loja
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Ref.{" "}
                    {formatMonthLabel(
                      `${rankingYearMonth || selectedYearMonth}-01`
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="month"
                    aria-label="Escolher mês do Ranking por Loja"
                    value={rankingYearMonth}
                    onChange={(e) => setRankingYearMonth(e.target.value)}
                    className="rounded-lg border border-amber-500/25 bg-[#181820] px-2 py-1 text-[11px] font-semibold text-amber-300 focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleDownloadRankingPdf}
                    disabled={rankingMonthRows.length === 0}
                    title="Baixar PDF do Ranking por Loja"
                    className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-2.5 py-1 text-[11px] font-bold text-black hover:brightness-110 disabled:opacity-50"
                  >
                    <Download className="h-3 w-3" />
                    PDF
                  </button>
                </div>
              </div>

              {availableRankingMonths.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1">
                  {availableRankingMonths.slice(0, 5).map((ym) => (
                    <button
                      key={ym}
                      type="button"
                      onClick={() => setRankingYearMonth(ym)}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors",
                        rankingYearMonth === ym
                          ? "bg-amber-500 text-black"
                          : "border border-amber-500/20 bg-[#181820] text-zinc-400 hover:text-amber-300"
                      )}
                    >
                      {formatMonthLabel(`${ym}-01`)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 flex-1 space-y-3.5 overflow-y-auto pr-1">
              {loading ? (
                <div className="flex h-52 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                </div>
              ) : horizontalRankingData.length === 0 ? (
                <div className="flex h-52 items-center justify-center text-center text-xs text-zinc-500">
                  Nenhum pedido registrado neste mês.
                </div>
              ) : (
                horizontalRankingData.slice(0, 5).map((store, idx) => {
                  const maxVal = horizontalRankingData[0]?.total || 1;
                  const widthPct = Math.max(
                    8,
                    Math.min(100, (store.total / maxVal) * 100)
                  );
                  return (
                    <div key={store.store_id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/10 text-[11px] font-extrabold text-amber-400">
                            {idx + 1}º
                          </span>
                          <span className="truncate font-semibold text-zinc-100">
                            {store.name}
                          </span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="font-extrabold text-white">
                            {formatCurrencyBRL(store.total)}
                          </span>
                          <span className="ml-1.5 text-[10px] text-zinc-400">
                            ({store.items} un.)
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#1d1d26]">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            store.isAlert
                              ? "bg-gradient-to-r from-red-500 to-amber-500"
                              : "bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-400"
                          )}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Card 3.3 (4 cols): Distribuição de Gastos por Loja - Gráfico Donut Dourado (estilo "Revenue by Service" da foto) */}
          <div className="flex flex-col justify-between rounded-2xl border border-amber-500/20 bg-[#121217] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] lg:col-span-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">
                  Participação por Loja (Rede)
                </h2>
                <p className="text-[11px] text-zinc-400">
                  Distribuição em{" "}
                  {formatMonthLabel(
                    `${rankingYearMonth || selectedYearMonth}-01`
                  )}
                </p>
              </div>
              <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300">
                {horizontalRankingData.length} lojas
              </span>
            </div>

            {loading ? (
              <div className="flex h-56 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
              </div>
            ) : horizontalRankingData.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-center text-xs text-zinc-500">
                Sem dados para o gráfico de participação.
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-1 items-center gap-3 sm:grid-cols-2">
                <div className="relative h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={horizontalRankingData}
                        dataKey="total"
                        nameKey="shortName"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={76}
                        paddingAngle={3}
                        stroke="#121217"
                        strokeWidth={2}
                      >
                        {horizontalRankingData.map((entry, index) => (
                          <Cell
                            key={entry.store_id}
                            fill={
                              GOLD_DONUT_COLORS[
                                index % GOLD_DONUT_COLORS.length
                              ]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) =>
                          formatCurrencyBRL(Number(value))
                        }
                        contentStyle={{
                          backgroundColor: "#141419",
                          borderRadius: "10px",
                          borderColor: "rgba(245,158,11,0.35)",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Centro da Rosca (Total da Rede) */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                      Total Rede
                    </span>
                    <span className="mt-0.5 text-xs font-extrabold text-white">
                      {formatCurrencyBRL(totalRankingSpend)}
                    </span>
                  </div>
                </div>

                {/* Legenda lateral estilo referência */}
                <div className="space-y-2.5">
                  {horizontalRankingData.slice(0, 4).map((item, idx) => (
                    <div key={item.store_id} className="flex items-start gap-2">
                      <span
                        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            GOLD_DONUT_COLORS[idx % GOLD_DONUT_COLORS.length],
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-zinc-100">
                          {item.shortName}
                        </p>
                        <p className="text-[11px] text-zinc-400">
                          {formatCurrencyBRL(item.total)} (
                          {item.sharePct.toFixed(1).replace(".", ",")}%)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 4. TERCEIRA LINHA: CARD COMPLETO DE COMPARAÇÃO EM QUANTIDADE DE PRODUTOS (Estilo "Bookings Overview" + Tabela) */}
        <section
          id="comparativo-itens"
          className="mt-6 rounded-2xl border border-amber-500/20 bg-[#121217] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
        >
          <div className="mb-5 flex flex-col justify-between gap-4 border-b border-amber-500/15 pb-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400">
                  <Package className="h-4 w-4" />
                </div>
                <h2 className="text-base font-extrabold text-white">
                  Comparativo de Consumo em Quantidade de Produtos (
                  {itemsComparisonMode === "monthly"
                    ? "Evolução Mensal"
                    : formatMonthLabel(`${itemsComparisonTargetMonth}-01`)}
                  )
                </h2>
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                Comparação de volume físico em unidades solicitadas vs. média móvel de 3 meses e média da rede ({selectedStoreLabel}).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Alternador de Visão: Por Loja vs. Evolução Mensal */}
              <div className="inline-flex rounded-xl border border-amber-500/25 bg-[#181820] p-0.5">
                <button
                  type="button"
                  onClick={() => setItemsComparisonMode("stores")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                    itemsComparisonMode === "stores"
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black"
                      : "text-zinc-400 hover:text-amber-300"
                  )}
                >
                  Por Loja no Mês
                </button>
                <button
                  type="button"
                  onClick={() => setItemsComparisonMode("monthly")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                    itemsComparisonMode === "monthly"
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 text-black"
                      : "text-zinc-400 hover:text-amber-300"
                  )}
                >
                  Evolução Mês a Mês
                </button>
              </div>

              <div className="relative">
                <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-amber-400" />
                <input
                  type="month"
                  aria-label="Escolher mês do Comparativo de Quantidade de Produtos"
                  value={itemsComparisonTargetMonth}
                  onChange={(e) => {
                    setItemsComparisonYearMonth(e.target.value);
                    setItemsComparisonMode("stores");
                  }}
                  className="rounded-xl border border-amber-500/30 bg-[#181820] py-1.5 pl-8 pr-2.5 text-xs font-bold text-amber-300 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleDownloadItemsComparisonPdf}
                disabled={itemsComparisonChartData.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#f59e0b] via-[#eab308] to-[#d97706] px-3.5 py-1.5 text-xs font-extrabold text-black shadow-[0_4px_15px_rgba(245,158,11,0.25)] transition-all hover:brightness-110 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar PDF (Quantidade)
              </button>
            </div>
          </div>

          {/* Atalhos rápidos de meses anteriores */}
          {availableRankingMonths.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-zinc-400">
                Meses disponíveis:
              </span>
              {availableRankingMonths.map((ym) => {
                const isSelected =
                  itemsComparisonMode === "stores" &&
                  ym === itemsComparisonTargetMonth;
                return (
                  <button
                    key={ym}
                    type="button"
                    onClick={() => {
                      setItemsComparisonYearMonth(ym);
                      setItemsComparisonMode("stores");
                    }}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                      isSelected
                        ? "bg-amber-500 text-black"
                        : "border border-amber-500/20 bg-[#181820] text-zinc-400 hover:text-amber-300"
                    )}
                  >
                    {formatMonthLabel(`${ym}-01`)} ({ym})
                  </button>
                );
              })}
            </div>
          )}

          {/* 3 Mini-KPIs de Quantidade de Produtos */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-amber-500/20 bg-[#17171f] p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Total de Produtos (
                {formatMonthLabel(`${itemsComparisonTargetMonth}-01`)})
              </span>
              <p className="mt-1 text-2xl font-extrabold text-white">
                {new Intl.NumberFormat("pt-BR").format(
                  itemsComparisonSummary.currentTotalItems
                )}{" "}
                <span className="text-xs font-normal text-amber-400">
                  unidades
                </span>
              </p>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                {itemsComparisonSummary.variationVsPrevMonth !== null ? (
                  <>
                    <span
                      className={cn(
                        "font-bold",
                        itemsComparisonSummary.variationVsPrevMonth > 0
                          ? "text-amber-400"
                          : "text-emerald-400"
                      )}
                    >
                      {itemsComparisonSummary.variationVsPrevMonth > 0
                        ? "↑"
                        : "↓"}{" "}
                      {formatPercent(
                        itemsComparisonSummary.variationVsPrevMonth
                      )}
                    </span>
                    <span className="text-zinc-400">
                      vs. mês anterior ({itemsComparisonSummary.prevTotalItems}{" "}
                      unid.)
                    </span>
                  </>
                ) : (
                  <span className="text-zinc-500">
                    Sem base no mês imediatamente anterior
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-[#17171f] p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Média por Loja (Quantidade)
              </span>
              <p className="mt-1 text-2xl font-extrabold text-white">
                {itemsComparisonSummary.avgItemsPerStore
                  .toFixed(1)
                  .replace(".", ",")}{" "}
                <span className="text-xs font-normal text-amber-400">
                  unid. / loja
                </span>
              </p>
              <p className="mt-1.5 text-xs text-zinc-400">
                Baseado em {itemsComparisonStoreRows.length}{" "}
                {itemsComparisonStoreRows.length === 1
                  ? "loja ativa"
                  : "lojas ativas"}{" "}
                no mês
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-[#17171f] p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Maior Consumo em Quantidade
              </span>
              {itemsComparisonSummary.topItemsStore ? (
                <>
                  <p
                    className="mt-1 truncate text-base font-extrabold text-white"
                    title={itemsComparisonSummary.topItemsStore.store_name}
                  >
                    {itemsComparisonSummary.topItemsStore.store_name}
                  </p>
                  <p className="mt-1 text-xs font-medium text-zinc-300">
                    <span className="font-bold text-amber-400">
                      {itemsComparisonSummary.topItemsStore.total_items} unid.
                    </span>{" "}
                    • Desvio:{" "}
                    <span
                      className={cn(
                        "font-bold",
                        itemsComparisonSummary.topItemsStore
                          .items_diff_percentage > 25
                          ? "text-red-400"
                          : "text-emerald-400"
                      )}
                    >
                      {formatPercent(
                        itemsComparisonSummary.topItemsStore
                          .items_diff_percentage
                      )}
                    </span>{" "}
                    vs. média 3M
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-zinc-500">
                  Sem registros no período
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex h-72 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
            </div>
          ) : itemsComparisonChartData.length === 0 ? (
            <div className="flex h-60 flex-col items-center justify-center text-center text-sm text-zinc-500">
              Nenhum pedido registrado para comparar quantidade de produtos neste período.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              {/* Gráfico de Colunas Douradas (estilo "Bookings Overview" da foto) */}
              <div className="h-72 w-full lg:col-span-3">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={itemsComparisonChartData}
                    margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="goldBarGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#b45309" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="rgba(245, 158, 11, 0.1)"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#a1a1aa" }}
                      axisLine={{ stroke: "rgba(245,158,11,0.2)" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#a1a1aa" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) =>
                        `${Number(v).toLocaleString("pt-BR")} un.`
                      }
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        `${Number(value).toLocaleString("pt-BR")} unidades`,
                        name,
                      ]}
                      contentStyle={{
                        backgroundColor: "#141419",
                        borderRadius: "12px",
                        borderColor: "rgba(245,158,11,0.35)",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", color: "#d4d4d8" }} />
                    <Bar
                      dataKey="quantidade"
                      name="Qtd. Produtos Solicitados"
                      fill="url(#goldBarGradient)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={38}
                    />
                    <Bar
                      dataKey="media3M"
                      name="Média Móvel 3M (Produtos)"
                      fill="#3f3f46"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={38}
                    />
                    <Line
                      type="monotone"
                      dataKey="mediaRede"
                      name="Média da Rede (Produtos)"
                      stroke="#fde047"
                      strokeWidth={2.5}
                      strokeDasharray="5 4"
                      dot={{ r: 4, fill: "#fde047" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Tabela Lateral de Comparação de Quantidade de Produtos */}
              <div className="flex flex-col justify-between overflow-hidden rounded-xl border border-amber-500/20 bg-[#16161d] lg:col-span-2">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-amber-500/15 bg-[#1b1b24] font-bold uppercase tracking-wider text-amber-400/90">
                        <th className="px-3.5 py-3">
                          {itemsComparisonMode === "monthly" ? "Mês" : "Loja"}
                        </th>
                        <th className="px-3.5 py-3 text-right">Qtd. Atual</th>
                        <th className="px-3.5 py-3 text-right">Média 3M</th>
                        <th className="px-3.5 py-3 text-right">Desvio Qtd.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-500/10">
                      {itemsComparisonChartData.map((item) => {
                        const isHighItems = item.desvioPct > 25;
                        const isLowItems = item.desvioPct < -5;
                        return (
                          <tr
                            key={item.fullLabel}
                            className="hover:bg-amber-500/5"
                          >
                            <td className="px-3.5 py-2.5 font-semibold text-zinc-100">
                              {item.name}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-extrabold text-amber-300">
                              {item.quantidade.toLocaleString("pt-BR")} un.
                            </td>
                            <td className="px-3.5 py-2.5 text-right text-zinc-400">
                              {item.media3M.toFixed(1).replace(".", ",")} un.
                            </td>
                            <td className="px-3.5 py-2.5 text-right">
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold",
                                  isHighItems
                                    ? "border border-red-500/30 bg-red-500/15 text-red-400"
                                    : isLowItems
                                    ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                                    : "border border-amber-500/25 bg-amber-500/10 text-amber-300"
                                )}
                              >
                                {formatPercent(item.desvioPct)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-amber-500/15 p-3">
                  <button
                    type="button"
                    onClick={handleDownloadItemsComparisonPdf}
                    disabled={itemsComparisonChartData.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f59e0b] via-[#eab308] to-[#d97706] py-2 text-xs font-extrabold text-black shadow-md transition-all hover:brightness-110 disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Exportar Comparativo de Quantidade em PDF
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 5. QUARTA LINHA: TABELA DE DETALHAMENTO POR LOJA + CENTRAL DE RELATÓRIOS PDF (Estilo "Bookings" + "Reports" da foto) */}
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Coluna Esquerda (8 cols): Tabela de Detalhamento por Loja */}
          <div className="overflow-hidden rounded-2xl border border-amber-500/20 bg-[#121217] shadow-[0_8px_30px_rgba(0,0,0,0.45)] lg:col-span-8">
            <div className="flex flex-col justify-between gap-2 border-b border-amber-500/15 px-6 py-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-extrabold text-white">
                  Detalhamento Operacional por Loja (
                  {formatMonthLabel(currentReferenceMonth)})
                </h2>
                <p className="text-xs text-zinc-400">
                  Clique em <strong className="text-amber-300">Ver Itens</strong> para consultar ou baixar PDFs de meses anteriores de cada unidade.
                </p>
              </div>
              <Link
                href="/lojas"
                className="text-xs font-bold text-amber-400 hover:underline"
              >
                Gerenciar Lojas →
              </Link>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-14 text-zinc-400">
                <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                <p className="mt-2 text-sm">Carregando indicadores por loja...</p>
              </div>
            ) : monthRowsFiltered.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <p className="text-sm font-medium text-zinc-300">
                  Nenhum registro encontrado para o período selecionado.
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Lance um pedido em{" "}
                  <Link
                    href="/pedidos/novo"
                    className="font-bold text-amber-400 underline"
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
                    <tr className="border-b border-amber-500/15 bg-[#17171f] text-[11px] font-bold uppercase tracking-wider text-amber-400/90">
                      <th className="px-5 py-3.5">Loja / Unidade</th>
                      <th className="px-5 py-3.5">Pedido Mês Atual</th>
                      <th className="px-5 py-3.5">Média 3M</th>
                      <th className="px-5 py-3.5">Desvio (%)</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-500/10">
                    {monthRowsFiltered.map((row) => {
                      const isAlert = row.diff_percentage > 25;
                      const isSaving = row.diff_percentage < -5;

                      return (
                        <tr
                          key={`${row.store_id}-${row.reference_month}`}
                          className="transition-colors hover:bg-amber-500/5"
                        >
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-white">
                              {row.store_name}
                            </div>
                            {(row.store_code || row.store_city) && (
                              <div className="text-xs text-zinc-400">
                                {row.store_code}
                                {row.store_code && row.store_city ? " • " : ""}
                                {row.store_city}
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-3.5">
                            <div className="font-extrabold text-amber-300">
                              {formatCurrencyBRL(row.current_month_total)}
                            </div>
                            <div className="text-xs text-zinc-400">
                              {row.total_items} itens
                            </div>
                          </td>

                          <td className="px-5 py-3.5 text-zinc-300">
                            <div>{formatCurrencyBRL(row.historical_avg)}</div>
                            <div className="text-[11px] text-zinc-500">
                              {row.historical_items_avg
                                .toFixed(1)
                                .replace(".", ",")}{" "}
                              un. (3M)
                            </div>
                          </td>

                          <td className="px-5 py-3.5">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
                                isAlert
                                  ? "border border-red-500/35 bg-red-500/15 text-red-400"
                                  : isSaving
                                  ? "border border-emerald-500/35 bg-emerald-500/15 text-emerald-400"
                                  : "border border-amber-500/25 bg-amber-500/10 text-amber-300"
                              )}
                            >
                              {formatPercent(row.diff_percentage)}
                            </span>
                          </td>

                          <td className="px-5 py-3.5">
                            {isAlert ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/35 bg-red-500/15 px-2.5 py-1 text-xs font-bold text-red-400">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Alerta (+25%)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Normal
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleOpenItemsModal(row)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/35 bg-[#181820] px-3 py-1.5 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500 hover:text-black"
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
          </div>

          {/* Coluna Direita (4 cols): Card "Reports / Central de Relatórios PDF" (Idêntico ao card "Reports" da foto) */}
          <div
            id="central-relatorios"
            className="flex flex-col justify-between rounded-2xl border border-amber-500/20 bg-[#121217] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] lg:col-span-4"
          >
            <div>
              <div className="flex items-center justify-between border-b border-amber-500/15 pb-3.5">
                <div>
                  <h2 className="text-base font-extrabold text-white">
                    Central de Relatórios PDF
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Baixe o mês atual ou escolha meses anteriores
                  </p>
                </div>
                <input
                  type="month"
                  aria-label="Mês do Relatório Geral Consolidado"
                  value={generalReportYearMonth}
                  onChange={(e) => {
                    setGeneralReportYearMonth(e.target.value);
                    setRankingYearMonth(e.target.value);
                    setItemsComparisonYearMonth(e.target.value);
                  }}
                  className="rounded-lg border border-amber-500/30 bg-[#181820] px-2.5 py-1 text-xs font-bold text-amber-300 focus:border-amber-400 focus:outline-none"
                />
              </div>

              {/* Atalhos rápidos de meses */}
              {availableRankingMonths.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1">
                  {availableRankingMonths.map((ym) => (
                    <button
                      key={ym}
                      type="button"
                      onClick={() => {
                        setGeneralReportYearMonth(ym);
                        setRankingYearMonth(ym);
                        setItemsComparisonYearMonth(ym);
                      }}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-bold transition-colors",
                        generalReportYearMonth === ym
                          ? "bg-amber-500 text-black"
                          : "border border-amber-500/20 bg-[#181820] text-zinc-400 hover:text-amber-300"
                      )}
                    >
                      {formatMonthLabel(`${ym}-01`)}
                    </button>
                  ))}
                </div>
              )}

              {/* Lista de Relatórios no estilo do card "Reports" da foto de referência */}
              <div className="mt-4 space-y-3">
                {/* Item 1: Relatório Geral Consolidado (Todos os Cards) */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-[#17171f] p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-400">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">
                        Relatório Geral (Todos os Cards)
                      </p>
                      <p className="truncate text-[11px] text-zinc-400">
                        KPIs, Valores, Quantidades e Evolução
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadCompleteReportPdf()}
                    disabled={loading || analyticsRows.length === 0}
                    className="shrink-0 rounded-lg border border-amber-500/35 bg-[#121217] px-3 py-1.5 text-[11px] font-bold text-amber-300 transition-colors hover:bg-amber-500 hover:text-black disabled:opacity-50"
                  >
                    Baixar
                  </button>
                </div>

                {/* Item 2: Relatório do Mês Atual (1 clique) */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-[#17171f] p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-400">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">
                        Consolidado Mês Atual ({formatMonthLabel(`${getDefaultYearMonth()}-01`)})
                      </p>
                      <p className="truncate text-[11px] text-zinc-400">
                        Todos os dados do período vigente
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadCompleteReportPdf(getDefaultYearMonth())
                    }
                    disabled={loading || analyticsRows.length === 0}
                    className="shrink-0 rounded-lg border border-amber-500/35 bg-[#121217] px-3 py-1.5 text-[11px] font-bold text-amber-300 transition-colors hover:bg-amber-500 hover:text-black disabled:opacity-50"
                  >
                    Baixar
                  </button>
                </div>

                {/* Item 3: Relatório Financeiro de Ranking por Loja */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-[#17171f] p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-400">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">
                        Ranking de Gastos por Loja
                      </p>
                      <p className="truncate text-[11px] text-zinc-400">
                        Comparativo financeiro e desvios 3M
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadRankingPdf}
                    disabled={rankingMonthRows.length === 0}
                    className="shrink-0 rounded-lg border border-amber-500/35 bg-[#121217] px-3 py-1.5 text-[11px] font-bold text-amber-300 transition-colors hover:bg-amber-500 hover:text-black disabled:opacity-50"
                  >
                    Baixar
                  </button>
                </div>

                {/* Item 4: Relatório de Consumo em Quantidade de Produtos */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-[#17171f] p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-400">
                      <Package className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">
                        Comparativo de Quantidade (Unid.)
                      </p>
                      <p className="truncate text-[11px] text-zinc-400">
                        Consumo físico por loja e média 3M
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadItemsComparisonPdf}
                    disabled={itemsComparisonChartData.length === 0}
                    className="shrink-0 rounded-lg border border-amber-500/35 bg-[#121217] px-3 py-1.5 text-[11px] font-bold text-amber-300 transition-colors hover:bg-amber-500 hover:text-black disabled:opacity-50"
                  >
                    Baixar
                  </button>
                </div>

                {/* Item 5: Relatório de Evolução Mensal */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-[#17171f] p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-400">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">
                        Evolução Mensal vs. Rede
                      </p>
                      <p className="truncate text-[11px] text-zinc-400">
                        Histórico consolidado mês a mês
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadEvolutionPdf}
                    disabled={composedChartData.length === 0}
                    className="shrink-0 rounded-lg border border-amber-500/35 bg-[#121217] px-3 py-1.5 text-[11px] font-bold text-amber-300 transition-colors hover:bg-amber-500 hover:text-black disabled:opacity-50"
                  >
                    Baixar
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-amber-500/15 pt-4">
              <button
                type="button"
                onClick={() => handleDownloadCompleteReportPdf()}
                disabled={loading || analyticsRows.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f59e0b] via-[#eab308] to-[#d97706] px-4 py-2.5 text-xs font-extrabold text-black shadow-[0_4px_20px_rgba(245,158,11,0.3)] transition-all hover:brightness-110 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Baixar Relatório Completo (
                {formatMonthLabel(`${generalReportYearMonth}-01`)})
              </button>
            </div>
          </div>
        </section>

        {/* 6. QUINTA LINHA: 3 CARDS INFERIORES DE CONSOLIDADO HISTÓRICO (Idêntico ao rodapé da foto de referência) */}
        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#16161d] to-[#111116] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-zinc-400">
                Volume Histórico Acumulado
              </span>
              <p className="mt-0.5 text-xl font-extrabold text-white">
                {new Intl.NumberFormat("pt-BR").format(
                  historicalSummary.allTimeItems
                )}{" "}
                <span className="text-xs font-normal text-amber-400">
                  unidades
                </span>
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Total solicitado em todos os meses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#16161d] to-[#111116] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-zinc-400">
                Compras Históricas Acumuladas
              </span>
              <p className="mt-0.5 text-xl font-extrabold text-white">
                {formatCurrencyBRL(historicalSummary.allTimeAmount)}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Soma de todos os períodos ({availableRankingMonths.length} meses)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#16161d] to-[#111116] p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-zinc-400">
                Ticket Médio por Loja no Mês
              </span>
              <p className="mt-0.5 text-xl font-extrabold text-white">
                {formatCurrencyBRL(historicalSummary.avgPerStoreMonth)}
              </p>
              <p className="mt-0.5 text-[11px] text-amber-400/90">
                Média de{" "}
                {itemsComparisonSummary.avgItemsPerStore
                  .toFixed(1)
                  .replace(".", ",")}{" "}
                unid. por loja
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Modal com os Itens Pedidos pela Loja (com escolha de data/meses anteriores) */}
      {modalStore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-order-items-title"
        >
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-amber-500/30 bg-[#121217] text-zinc-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-amber-500/15 px-6 py-4">
              <div>
                <h3
                  id="modal-order-items-title"
                  className="text-lg font-extrabold text-amber-400"
                >
                  Itens Solicitados — {modalStore.store_name}
                </h3>
                <p className="text-xs text-zinc-400">
                  Referência:{" "}
                  <strong className="text-white">
                    {formatMonthLabel(
                      modalYearMonth
                        ? `${modalYearMonth}-01`
                        : modalStore.reference_month
                    )}
                  </strong>{" "}
                  • Qtd:{" "}
                  <strong className="text-amber-300">
                    {modalTotals.totalItems} itens
                  </strong>{" "}
                  • Total:{" "}
                  <strong className="text-white">
                    {formatCurrencyBRL(modalTotals.totalAmount)}
                  </strong>
                </p>
              </div>

              <button
                type="button"
                onClick={closeItemsModal}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-amber-500/10 hover:text-amber-300"
                aria-label="Fechar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Barra de Seleção de Data / Meses Anteriores */}
            <div className="border-b border-amber-500/15 bg-[#17171f] px-6 py-3.5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2.5">
                  <label
                    htmlFor="modal-month-picker"
                    className="text-xs font-bold uppercase tracking-wider text-zinc-300"
                  >
                    Escolher Data (Mês/Ano):
                  </label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-amber-400" />
                    <input
                      id="modal-month-picker"
                      type="month"
                      value={modalYearMonth}
                      onChange={(e) => handleModalMonthChange(e.target.value)}
                      className="rounded-xl border border-amber-500/30 bg-[#121217] py-1.5 pl-9 pr-3 text-xs font-bold text-amber-300 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                {modalItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadModalPdf}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-3.5 py-1.5 text-xs font-extrabold text-black shadow-xs transition-all hover:brightness-110"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar PDF ({formatMonthLabel(`${modalYearMonth}-01`)})
                  </button>
                )}
              </div>

              {availableModalMonths.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-zinc-400">
                    Meses com pedidos:
                  </span>
                  {availableModalMonths.map((ym) => {
                    const isSelected = ym === modalYearMonth;
                    return (
                      <button
                        key={ym}
                        type="button"
                        onClick={() => handleModalMonthChange(ym)}
                        className={cn(
                          "rounded-lg px-2.5 py-1 text-xs font-bold transition-colors",
                          isSelected
                            ? "bg-amber-500 text-black"
                            : "border border-amber-500/20 bg-[#121217] text-zinc-300 hover:border-amber-500/40 hover:text-amber-300"
                        )}
                      >
                        {formatMonthLabel(`${ym}-01`)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingModalItems ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                  <p className="mt-2 text-sm">Carregando itens do pedido...</p>
                </div>
              ) : modalItems.length === 0 ? (
                <div className="py-12 text-center text-sm text-zinc-400">
                  Nenhum item encontrado para esta loja em{" "}
                  <strong className="text-white">
                    {formatMonthLabel(
                      modalYearMonth
                        ? `${modalYearMonth}-01`
                        : modalStore.reference_month
                    )}
                  </strong>
                  . Selecione outro mês acima.
                </div>
              ) : (
                <>
                  {modalItems[0]?.pdf_url && (
                    <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-500/25 bg-[#181820] px-4 py-2.5 text-xs">
                      <span className="font-medium text-zinc-300">
                        Documento PDF original vinculado a este pedido:
                      </span>
                      <a
                        href={modalItems[0].pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-bold text-amber-400 underline"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Abrir PDF Original
                      </a>
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-xl border border-amber-500/20">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-amber-500/15 bg-[#181820] text-xs font-bold uppercase tracking-wider text-amber-400">
                          <th className="px-4 py-3">Produto</th>
                          <th className="px-4 py-3 text-right">Qtd</th>
                          <th className="px-4 py-3 text-right">Vlr. Unit.</th>
                          <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-500/10">
                        {modalItems.map((item) => (
                          <tr key={item.id} className="hover:bg-amber-500/5">
                            <td className="px-4 py-2.5 font-medium text-zinc-100">
                              {item.product_name}
                            </td>
                            <td className="px-4 py-2.5 text-right text-zinc-300">
                              {item.quantity}
                            </td>
                            <td className="px-4 py-2.5 text-right text-zinc-400">
                              {formatCurrencyBRL(item.unit_price)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold text-amber-300">
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

            <div className="flex items-center justify-between gap-3 border-t border-amber-500/15 px-6 py-3.5">
              <div>
                {modalItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadModalPdf}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-xs font-extrabold text-black shadow-sm transition-all hover:brightness-110"
                  >
                    <Download className="h-4 w-4" />
                    Baixar Lista em PDF
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={closeItemsModal}
                className="rounded-xl border border-amber-500/30 bg-[#181820] px-4 py-2 text-xs font-bold text-zinc-200 hover:bg-amber-500/10"
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
