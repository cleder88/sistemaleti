"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Target,
  Flame,
  Pencil,
  Check,
  Presentation,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/navbar";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { cn } from "@/lib/utils";
import {
  downloadOrderItemsPdf,
  downloadStoresRankingPdf,
  downloadMonthlyEvolutionPdf,
  downloadItemsQuantityComparisonPdf,
  downloadCompleteDashboardReportPdf,
  downloadProductAbcAndInflationPdf,
} from "@/lib/pdf-export";
import { saveStoreBudgetLocal } from "@/lib/store-budgets";
import {
  formatCurrencyBRL,
  formatMonthLabel,
  formatPercent,
  getDefaultYearMonth,
  getPreviousYearMonth,
  type OrderItemDetail,
  type StoreInfo,
  type StoreMonthlyAnalyticsRow,
} from "@/lib/dashboard/analytics";
import { useDashboardData } from "@/lib/dashboard/use-dashboard-data";
import { useUrlContext } from "@/lib/use-url-context";
import { useUserRole } from "@/lib/auth/use-user-role";
import { Button, ButtonLink, Card, Input, Select } from "@/components/ui";
import { chartColor, chartColors } from "@/lib/chart-theme";

export default function DashboardPage() {
  const {
    context: urlContext,
    updateContext: updateUrlContext,
    ready: urlContextReady,
  } = useUrlContext();
  const { isAdmin } = useUserRole();
  const urlAppliedRef = useRef(false);

  const [selectedYearMonth, setSelectedYearMonth] =
    useState<string>(getDefaultYearMonth);
  const [rankingYearMonth, setRankingYearMonth] =
    useState<string>(getDefaultYearMonth);
  const [evolutionYearMonth, setEvolutionYearMonth] = useState<string>("all");
  const [itemsComparisonYearMonth, setItemsComparisonYearMonth] =
    useState<string>(getDefaultYearMonth);
  const [generalReportYearMonth, setGeneralReportYearMonth] =
    useState<string>(getDefaultYearMonth);
  const [abcYearMonth, setAbcYearMonth] =
    useState<string>(getDefaultYearMonth);
  const [itemsComparisonMode, setItemsComparisonMode] = useState<
    "stores" | "monthly"
  >("stores");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");

  const {
    stores,
    setStores,
    analyticsRows,
    orderItemsHistory,
    loading,
    errorMessage,
    reload: loadDashboardData,
  } = useDashboardData();

  // Edição rápida de Teto de Orçamento Mensal por Loja direto no Dashboard
  const [editingBudgetStoreId, setEditingBudgetStoreId] = useState<
    string | null
  >(null);
  const [budgetFormValue, setBudgetFormValue] = useState<string>("0");
  const [itemsLimitFormValue, setItemsLimitFormValue] = useState<string>("0");
  const [savingBudget, setSavingBudget] = useState<boolean>(false);

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


  useEffect(() => {
    if (!urlContextReady || urlAppliedRef.current) return;
    urlAppliedRef.current = true;

    if (urlContext.month) {
      setSelectedYearMonth(urlContext.month);
      setRankingYearMonth(urlContext.month);
      setItemsComparisonYearMonth(urlContext.month);
      setGeneralReportYearMonth(urlContext.month);
      setAbcYearMonth(urlContext.month);
    }

    if (urlContext.storeId) {
      setSelectedStoreId(urlContext.storeId);
    }
  }, [urlContextReady, urlContext.month, urlContext.storeId]);

  useEffect(() => {
    if (stores.length === 0) return;
    if (
      selectedStoreId !== "all" &&
      !stores.some((store) => store.id === selectedStoreId)
    ) {
      setSelectedStoreId("all");
    }
  }, [stores, selectedStoreId]);

  useEffect(() => {
    if (!urlContextReady || !urlContext.product || loading) return;
    const section = document.getElementById("curva-abc");
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [urlContextReady, urlContext.product, loading]);

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

  // =========================================================================
  // ITEM 1 & ITEM 2: Curva ABC de Produtos + Alerta de Variação de Preço Unitário
  // =========================================================================
  const productAbcRows = useMemo(() => {
    const targetMonth = abcYearMonth || selectedYearMonth;
    const isAllMonths = targetMonth === "all";
    const prevMonth = isAllMonths ? null : getPreviousYearMonth(targetMonth);

    // Filtra itens do período selecionado e da loja selecionada
    const currentItems = orderItemsHistory.filter((item) => {
      const matchMonth = isAllMonths || item.reference_month === targetMonth;
      const matchStore =
        selectedStoreId === "all" || item.store_id === selectedStoreId;
      return matchMonth && matchStore;
    });

    // Filtra itens do mês anterior (para auditoria de inflação interna por produto)
    const prevItems = prevMonth
      ? orderItemsHistory.filter((item) => {
          const matchMonth = item.reference_month === prevMonth;
          const matchStore =
            selectedStoreId === "all" || item.store_id === selectedStoreId;
          return matchMonth && matchStore;
        })
      : [];

    const prevMap = new Map<
      string,
      { totalQty: number; totalVal: number; weightedPriceSum: number }
    >();
    for (const it of prevItems) {
      const key = it.product_name.toUpperCase();
      if (!key) continue;
      const cur = prevMap.get(key) ?? {
        totalQty: 0,
        totalVal: 0,
        weightedPriceSum: 0,
      };
      const qty = it.quantity > 0 ? it.quantity : 1;
      cur.totalQty += it.quantity;
      cur.totalVal += it.total_price;
      cur.weightedPriceSum += it.unit_price * qty;
      prevMap.set(key, cur);
    }

    const groupMap = new Map<
      string,
      {
        displayName: string;
        totalQuantity: number;
        totalAmount: number;
        weightedPriceSum: number;
        qtyForPriceWeight: number;
        minUnitPrice: number;
        maxUnitPrice: number;
        minPriceStore: string;
        maxPriceStore: string;
        byStoreQty: Map<string, { label: string; qty: number; amount: number }>;
      }
    >();

    for (const it of currentItems) {
      const key = it.product_name.toUpperCase();
      if (!key) continue;
      const storeLabel = it.store_code
        ? `${it.store_name} (${it.store_code})`
        : it.store_name;
      const unitPrice =
        it.unit_price > 0
          ? it.unit_price
          : it.quantity > 0
          ? it.total_price / it.quantity
          : 0;
      const weightQty = it.quantity > 0 ? it.quantity : 1;

      const existing = groupMap.get(key);
      if (!existing) {
        const byStoreQty = new Map<
          string,
          { label: string; qty: number; amount: number }
        >();
        byStoreQty.set(it.store_id, {
          label: storeLabel,
          qty: it.quantity,
          amount: it.total_price,
        });

        groupMap.set(key, {
          displayName: it.product_name,
          totalQuantity: it.quantity,
          totalAmount: it.total_price,
          weightedPriceSum: unitPrice * weightQty,
          qtyForPriceWeight: weightQty,
          minUnitPrice: unitPrice,
          maxUnitPrice: unitPrice,
          minPriceStore: storeLabel,
          maxPriceStore: storeLabel,
          byStoreQty,
        });
      } else {
        existing.totalQuantity += it.quantity;
        existing.totalAmount += it.total_price;
        existing.weightedPriceSum += unitPrice * weightQty;
        existing.qtyForPriceWeight += weightQty;

        if (unitPrice > 0 && (existing.minUnitPrice === 0 || unitPrice < existing.minUnitPrice)) {
          existing.minUnitPrice = unitPrice;
          existing.minPriceStore = storeLabel;
        }
        if (unitPrice > existing.maxUnitPrice) {
          existing.maxUnitPrice = unitPrice;
          existing.maxPriceStore = storeLabel;
        }

        const stEntry = existing.byStoreQty.get(it.store_id) ?? {
          label: storeLabel,
          qty: 0,
          amount: 0,
        };
        stEntry.qty += it.quantity;
        stEntry.amount += it.total_price;
        existing.byStoreQty.set(it.store_id, stEntry);
      }
    }

    const sorted = Array.from(groupMap.entries())
      .map(([key, g]) => {
        const avgUnitPrice =
          g.qtyForPriceWeight > 0
            ? g.weightedPriceSum / g.qtyForPriceWeight
            : 0;

        const prevEntry = prevMap.get(key);
        const prevAvgUnitPrice =
          prevEntry && prevEntry.totalQty > 0
            ? prevEntry.weightedPriceSum / prevEntry.totalQty
            : null;

        const priceDiffVsPrevMonthPct =
          prevAvgUnitPrice && prevAvgUnitPrice > 0 && avgUnitPrice > 0
            ? ((avgUnitPrice - prevAvgUnitPrice) / prevAvgUnitPrice) * 100
            : null;

        const interStoreSpreadPct =
          g.minUnitPrice > 0 && g.maxUnitPrice > g.minUnitPrice
            ? ((g.maxUnitPrice - g.minUnitPrice) / g.minUnitPrice) * 100
            : 0;

        let topStore = { label: "—", qty: 0, amount: 0 };
        g.byStoreQty.forEach((v) => {
          if (v.qty > topStore.qty || (v.qty === topStore.qty && v.amount > topStore.amount)) {
            topStore = v;
          }
        });

        return {
          key,
          product_name: g.displayName,
          total_quantity: Number(g.totalQuantity.toFixed(2)),
          total_amount: Number(g.totalAmount.toFixed(2)),
          avg_unit_price: Number(avgUnitPrice.toFixed(2)),
          prev_avg_unit_price:
            prevAvgUnitPrice !== null ? Number(prevAvgUnitPrice.toFixed(2)) : null,
          price_diff_pct:
            priceDiffVsPrevMonthPct !== null
              ? Number(priceDiffVsPrevMonthPct.toFixed(2))
              : null,
          min_unit_price: Number(g.minUnitPrice.toFixed(2)),
          max_unit_price: Number(g.maxUnitPrice.toFixed(2)),
          min_price_store: g.minPriceStore,
          max_price_store: g.maxPriceStore,
          inter_store_spread_pct: Number(interStoreSpreadPct.toFixed(2)),
          stores_count: g.byStoreQty.size,
          top_store_label:
            topStore.qty > 0 ? `${topStore.label} (${topStore.qty} un.)` : topStore.label,
        };
      })
      .sort((a, b) => b.total_amount - a.total_amount);

    const grandTotalAmount = sorted.reduce((acc, r) => acc + r.total_amount, 0);
    let runningAmount = 0;

    return sorted.map((row, idx) => {
      const sharePct =
        grandTotalAmount > 0 ? (row.total_amount / grandTotalAmount) * 100 : 0;
      const prevCumulativePct =
        grandTotalAmount > 0 ? (runningAmount / grandTotalAmount) * 100 : 0;
      runningAmount += row.total_amount;
      const cumulativePct =
        grandTotalAmount > 0 ? (runningAmount / grandTotalAmount) * 100 : 0;

      const abcClass: "A" | "B" | "C" =
        idx === 0 || prevCumulativePct < 80
          ? "A"
          : prevCumulativePct < 95
          ? "B"
          : "C";

      return {
        ...row,
        share_pct: Number(sharePct.toFixed(2)),
        cumulative_pct: Number(cumulativePct.toFixed(2)),
        abc_class: abcClass,
      };
    });
  }, [orderItemsHistory, abcYearMonth, selectedYearMonth, selectedStoreId]);

  const filteredAbcRows = useMemo(() => {
    const term = urlContext.product?.trim().toUpperCase();
    if (!term) return productAbcRows;
    return productAbcRows.filter((row) =>
      row.product_name.toUpperCase().includes(term)
    );
  }, [productAbcRows, urlContext.product]);

  // Produtos com Alerta de Variação de Preço Unitário (vs. mês anterior ou divergência entre lojas)
  const priceAlertRows = useMemo(() => {
    return productAbcRows
      .filter(
        (r) =>
          (r.price_diff_pct !== null && Math.abs(r.price_diff_pct) >= 1) ||
          r.inter_store_spread_pct >= 1
      )
      .sort((a, b) => {
        const scoreA =
          Math.max(Math.abs(a.price_diff_pct ?? 0), a.inter_store_spread_pct);
        const scoreB =
          Math.max(Math.abs(b.price_diff_pct ?? 0), b.inter_store_spread_pct);
        return scoreB - scoreA;
      });
  }, [productAbcRows]);

  function handleDownloadAbcAndPricePdf() {
    if (productAbcRows.length === 0) return;
    const targetMonth = abcYearMonth || selectedYearMonth;
    const periodLabel =
      targetMonth === "all"
        ? "Todos os Meses (Histórico Acumulado)"
        : `${formatMonthLabel(`${targetMonth}-01`).toUpperCase()} (${targetMonth})`;

    downloadProductAbcAndInflationPdf({
      periodLabel,
      storeFilterLabel: selectedStoreLabel,
      rows: productAbcRows.map((r) => ({
        productName: r.product_name,
        totalQuantity: r.total_quantity,
        avgUnitPrice: r.avg_unit_price,
        totalAmount: r.total_amount,
        sharePct: r.share_pct,
        abcClass: r.abc_class,
        topStoreLabel: r.top_store_label,
        priceDiffVsPrevMonthPct: r.price_diff_pct,
      })),
    });
  }

  // =========================================================================
  // ITEM 3: Teto de Orçamento Mensal (Meta / Budget por Loja em R$ e em Qtd)
  // =========================================================================
  const storeBudgetsStatus = useMemo(() => {
    const filteredStores =
      selectedStoreId === "all"
        ? stores
        : stores.filter((s) => s.id === selectedStoreId);

    const monthByStore = new Map<string, StoreMonthlyAnalyticsRow>();
    monthRowsAllStores.forEach((r) => monthByStore.set(r.store_id, r));

    return filteredStores.map((st) => {
      const mRow = monthByStore.get(st.id);
      const currentAmount = mRow?.current_month_total ?? 0;
      const currentItems = mRow?.total_items ?? 0;
      const budget = st.monthly_budget ?? 0;
      const itemsLimit = st.monthly_items_limit ?? 0;

      const budgetUsagePct = budget > 0 ? (currentAmount / budget) * 100 : null;
      const itemsUsagePct =
        itemsLimit > 0 ? (currentItems / itemsLimit) * 100 : null;

      const maxUsage = Math.max(budgetUsagePct ?? 0, itemsUsagePct ?? 0);
      const status: "exceeded" | "warning" | "ok" | "unconfigured" =
        budget <= 0 && itemsLimit <= 0
          ? "unconfigured"
          : maxUsage >= 100
          ? "exceeded"
          : maxUsage >= 80
          ? "warning"
          : "ok";

      return {
        store: st,
        currentAmount,
        currentItems,
        budget,
        itemsLimit,
        budgetUsagePct,
        itemsUsagePct,
        remainingBudget: budget > 0 ? budget - currentAmount : null,
        remainingItems: itemsLimit > 0 ? itemsLimit - currentItems : null,
        status,
      };
    });
  }, [stores, selectedStoreId, monthRowsAllStores]);

  function startEditingStoreBudget(store: StoreInfo) {
    setEditingBudgetStoreId(store.id);
    setBudgetFormValue(String(store.monthly_budget || 0));
    setItemsLimitFormValue(String(store.monthly_items_limit || 0));
  }

  async function handleSaveStoreBudget(store: StoreInfo) {
    setSavingBudget(true);
    const parsedBudget = Math.max(0, Number(budgetFormValue) || 0);
    const parsedItemsLimit = Math.max(0, Number(itemsLimitFormValue) || 0);

    try {
      // Salva localmente de imediato (garante persistência mesmo sem migração SQL manual)
      saveStoreBudgetLocal(store.id, {
        monthly_budget: parsedBudget,
        monthly_items_limit: parsedItemsLimit,
      });

      // Atualiza no estado em memória imediatamente
      setStores((prev) =>
        prev.map((s) =>
          s.id === store.id
            ? {
                ...s,
                monthly_budget: parsedBudget,
                monthly_items_limit: parsedItemsLimit,
              }
            : s
        )
      );

      // Tenta persistir também no banco via API /api/stores
      await fetch("/api/stores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: store.id,
          name: store.name,
          code: store.code,
          city: store.city,
          monthly_budget: parsedBudget,
          monthly_items_limit: parsedItemsLimit,
        }),
      });
    } finally {
      setSavingBudget(false);
      setEditingBudgetStoreId(null);
    }
  }

  const newOrderParams = new URLSearchParams({ mes: selectedYearMonth });
  if (selectedStoreId !== "all") {
    newOrderParams.set("loja", selectedStoreId);
  }
  const newOrderHref = `/pedidos/novo?${newOrderParams.toString()}`;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Navbar />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:pl-72 lg:pr-8">
        {/* 1. Barra de Controle e Filtros Superiores (Estilo Executivo Dark & Gold) */}
        <Card className="flex flex-col justify-between gap-4 p-5 lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b]" />
              <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                Visão Geral Executiva
              </h1>
            </div>
            <p className="mt-1 text-xs text-inkMuted sm:text-sm">
              Controle financeiro, volume físico de produtos, média móvel (3M) e relatórios consolidados.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="month"
              aria-label="Período (Mês/Ano)"
              value={selectedYearMonth}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedYearMonth(value);
                setRankingYearMonth(value);
                setItemsComparisonYearMonth(value);
                setGeneralReportYearMonth(value);
                setAbcYearMonth(value);
                updateUrlContext({ month: value });
              }}
              leftIcon={<Calendar className="h-4 w-4" />}
              size="sm"
              className="w-auto text-xs font-bold text-brand"
            />

            <Select
              aria-label="Filtrar por Loja"
              value={selectedStoreId}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedStoreId(value);
                updateUrlContext({ storeId: value === "all" ? null : value });
              }}
              leftIcon={<Store className="h-4 w-4" />}
              size="sm"
              className="min-w-[210px] text-xs font-bold"
            >
              <option value="all">Todas as Lojas</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} {store.code ? `(${store.code})` : ""}
                </option>
              ))}
            </Select>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={loadDashboardData}
              disabled={loading}
              title="Atualizar dados"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>

            <ButtonLink href={`/apresentacao?mes=${selectedYearMonth}`} variant="secondary" size="sm">
              <Presentation className="h-4 w-4" />
              Apresentar este mês
            </ButtonLink>

            <ButtonLink href={newOrderHref} variant="primary" size="sm">
              <FilePlus2 className="h-4 w-4" />
              Novo Pedido
            </ButtonLink>
          </div>
        </Card>

        {errorMessage && (
          <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            {errorMessage}
          </div>
        )}

        <KpiCards
          kpis={kpis}
          currentReferenceMonth={currentReferenceMonth}
          monthRowsFilteredCount={monthRowsFiltered.length}
          monthRowsAllStoresCount={monthRowsAllStores.length}
          storesCount={stores.length}
        />

        {/* 3. SEGUNDA LINHA: 4 CARDS VISUAIS EXECUTIVOS (Inspirados na linha central da foto) */}
        <section className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Card 3.1 (4 cols): Evolução Mensal de Gastos (Area + Line Dourado - estilo "Revenue Overview") */}
          <div className="flex flex-col justify-between rounded-2xl border border-amber-500/20 bg-panel p-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] lg:col-span-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-ink">
                    Evolução Mensal vs. Rede
                  </h2>
                  <p className="text-xs text-inkMuted">
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
                    className="rounded-lg border border-amber-500/25 bg-panelElevated px-2 py-1 text-xs font-semibold text-amber-300 focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleDownloadEvolutionPdf}
                    disabled={composedChartData.length === 0}
                    title="Baixar PDF da Evolução Mensal"
                    className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-2.5 py-1 text-xs font-bold text-onBrand hover:brightness-110 disabled:opacity-50"
                  >
                    <Download className="h-3 w-3" />
                    PDF
                  </button>
                </div>
              </div>

              {/* Valor em destaque + atalhos de meses */}
              <div className="mt-3 flex items-baseline gap-2.5">
                <span className="text-2xl font-bold text-ink">
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
                      "rounded-md px-2 py-0.5 text-xs font-semibold transition-colors",
                      evolutionYearMonth === "all"
                        ? "bg-amber-500 text-onBrand"
                        : "border border-amber-500/20 bg-panelElevated text-inkMuted hover:text-amber-300"
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
                        "rounded-md px-2 py-0.5 text-xs font-semibold transition-colors",
                        evolutionYearMonth === ym
                          ? "bg-amber-500 text-onBrand"
                          : "border border-amber-500/20 bg-panelElevated text-inkMuted hover:text-amber-300"
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
                <div className="flex h-full items-center justify-center text-center text-xs text-inkMuted">
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
                          stopColor={chartColors.brand}
                          stopOpacity={0.45}
                        />
                        <stop
                          offset="95%"
                          stopColor={chartColors.brand}
                          stopOpacity={0.0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={chartColors.grid}
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: chartColors.tick }}
                      axisLine={{ stroke: chartColors.axis }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: chartColors.tick }}
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
                        backgroundColor: chartColors.tooltipBackground,
                        borderRadius: "12px",
                        borderColor: chartColors.tooltipBorder,
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="compras"
                      name="Compras no Mês"
                      stroke={chartColors.brand}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#goldAreaGradient)"
                      dot={{ r: 4, fill: chartColors.brandSoft, stroke: "#121216", strokeWidth: 1.5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="mediaRede"
                      name="Média da Rede"
                      stroke={chartColors.teal}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={{ r: 3, fill: chartColors.teal }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Card 3.2 (4 cols): Ranking de Gastos por Loja com Barras de Progresso Douradas (estilo "Top Services" da foto) */}
          <div className="flex flex-col justify-between rounded-2xl border border-amber-500/20 bg-panel p-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] lg:col-span-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-ink">
                    Ranking de Gastos por Loja
                  </h2>
                  <p className="text-xs text-inkMuted">
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
                    className="rounded-lg border border-amber-500/25 bg-panelElevated px-2 py-1 text-xs font-semibold text-amber-300 focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleDownloadRankingPdf}
                    disabled={rankingMonthRows.length === 0}
                    title="Baixar PDF do Ranking por Loja"
                    className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-2.5 py-1 text-xs font-bold text-onBrand hover:brightness-110 disabled:opacity-50"
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
                        "rounded-md px-2 py-0.5 text-xs font-semibold transition-colors",
                        rankingYearMonth === ym
                          ? "bg-amber-500 text-onBrand"
                          : "border border-amber-500/20 bg-panelElevated text-inkMuted hover:text-amber-300"
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
                <div className="flex h-52 items-center justify-center text-center text-xs text-inkMuted">
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
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/10 text-xs font-bold text-amber-400">
                            {idx + 1}º
                          </span>
                          <span className="truncate font-semibold text-ink">
                            {store.name}
                          </span>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="font-bold text-ink">
                            {formatCurrencyBRL(store.total)}
                          </span>
                          <span className="ml-1.5 text-xs text-inkMuted">
                            ({store.items} un.)
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-panelMuted">
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
          <div className="flex flex-col justify-between rounded-2xl border border-amber-500/20 bg-panel p-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] lg:col-span-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-ink">
                  Participação por Loja (Rede)
                </h2>
                <p className="text-xs text-inkMuted">
                  Distribuição em{" "}
                  {formatMonthLabel(
                    `${rankingYearMonth || selectedYearMonth}-01`
                  )}
                </p>
              </div>
              <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-300">
                {horizontalRankingData.length} lojas
              </span>
            </div>

            {loading ? (
              <div className="flex h-56 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
              </div>
            ) : horizontalRankingData.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-center text-xs text-inkMuted">
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
                        stroke="#121216"
                        strokeWidth={2}
                      >
                        {horizontalRankingData.map((entry, index) => (
                          <Cell
                            key={entry.store_id}
                            fill={chartColor(index)}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) =>
                          formatCurrencyBRL(Number(value))
                        }
                        contentStyle={{
                          backgroundColor: chartColors.tooltipBackground,
                          borderRadius: "10px",
                          borderColor: chartColors.tooltipBorder,
                          color: "#fff",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Centro da Rosca (Total da Rede) */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-medium uppercase tracking-wider text-inkMuted">
                      Total Rede
                    </span>
                    <span className="mt-0.5 text-xs font-bold text-ink">
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
                          backgroundColor: chartColor(idx),
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-ink">
                          {item.shortName}
                        </p>
                        <p className="text-xs text-inkMuted">
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
          className="mt-6 rounded-2xl border border-amber-500/20 bg-panel p-6 shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
        >
          <div className="mb-5 flex flex-col justify-between gap-4 border-b border-amber-500/15 pb-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400">
                  <Package className="h-4 w-4" />
                </div>
                <h2 className="text-base font-bold text-ink">
                  Comparativo de Consumo em Quantidade de Produtos (
                  {itemsComparisonMode === "monthly"
                    ? "Evolução Mensal"
                    : formatMonthLabel(`${itemsComparisonTargetMonth}-01`)}
                  )
                </h2>
              </div>
              <p className="mt-1 text-xs text-inkMuted">
                Comparação de volume físico em unidades solicitadas vs. média móvel de 3 meses e média da rede ({selectedStoreLabel}).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Alternador de Visão: Por Loja vs. Evolução Mensal */}
              <div className="inline-flex rounded-xl border border-amber-500/25 bg-panelElevated p-0.5">
                <button
                  type="button"
                  onClick={() => setItemsComparisonMode("stores")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
                    itemsComparisonMode === "stores"
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 text-onBrand"
                      : "text-inkMuted hover:text-amber-300"
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
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 text-onBrand"
                      : "text-inkMuted hover:text-amber-300"
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
                  className="rounded-xl border border-amber-500/30 bg-panelElevated py-1.5 pl-8 pr-2.5 text-xs font-bold text-amber-300 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleDownloadItemsComparisonPdf}
                disabled={itemsComparisonChartData.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand via-warning to-brandStrong px-3.5 py-1.5 text-xs font-bold text-onBrand shadow-[0_4px_15px_rgba(245,158,11,0.25)] transition-all hover:brightness-110 disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar PDF (Quantidade)
              </button>
            </div>
          </div>

          {/* Atalhos rápidos de meses anteriores */}
          {availableRankingMonths.length > 0 && (
            <div className="mb-5 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-inkMuted">
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
                        ? "bg-amber-500 text-onBrand"
                        : "border border-amber-500/20 bg-panelElevated text-inkMuted hover:text-amber-300"
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
            <div className="rounded-xl border border-amber-500/20 bg-panel p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-inkMuted">
                Total de Produtos (
                {formatMonthLabel(`${itemsComparisonTargetMonth}-01`)})
              </span>
              <p className="mt-1 text-2xl font-bold text-ink">
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
                    <span className="text-inkMuted">
                      vs. mês anterior ({itemsComparisonSummary.prevTotalItems}{" "}
                      unid.)
                    </span>
                  </>
                ) : (
                  <span className="text-inkMuted">
                    Sem base no mês imediatamente anterior
                  </span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-panel p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-inkMuted">
                Média por Loja (Quantidade)
              </span>
              <p className="mt-1 text-2xl font-bold text-ink">
                {itemsComparisonSummary.avgItemsPerStore
                  .toFixed(1)
                  .replace(".", ",")}{" "}
                <span className="text-xs font-normal text-amber-400">
                  unid. / loja
                </span>
              </p>
              <p className="mt-1.5 text-xs text-inkMuted">
                Baseado em {itemsComparisonStoreRows.length}{" "}
                {itemsComparisonStoreRows.length === 1
                  ? "loja ativa"
                  : "lojas ativas"}{" "}
                no mês
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-panel p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-inkMuted">
                Maior Consumo em Quantidade
              </span>
              {itemsComparisonSummary.topItemsStore ? (
                <>
                  <p
                    className="mt-1 truncate text-base font-bold text-ink"
                    title={itemsComparisonSummary.topItemsStore.store_name}
                  >
                    {itemsComparisonSummary.topItemsStore.store_name}
                  </p>
                  <p className="mt-1 text-xs font-medium text-inkSoft">
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
                <p className="mt-2 text-sm text-inkMuted">
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
            <div className="flex h-60 flex-col items-center justify-center text-center text-sm text-inkMuted">
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
                        <stop offset="0%" stopColor={chartColors.brandSoft} />
                        <stop offset="100%" stopColor={chartColors.brand} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={chartColors.grid}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: chartColors.tick }}
                      axisLine={{ stroke: chartColors.axis }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: chartColors.tick }}
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
                        backgroundColor: chartColors.tooltipBackground,
                        borderRadius: "12px",
                        borderColor: chartColors.tooltipBorder,
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
                      fill={chartColors.violet}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={38}
                    />
                    <Line
                      type="monotone"
                      dataKey="mediaRede"
                      name="Média da Rede (Produtos)"
                      stroke={chartColors.teal}
                      strokeWidth={2.5}
                      strokeDasharray="5 4"
                      dot={{ r: 4, fill: chartColors.teal }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Tabela Lateral de Comparação de Quantidade de Produtos */}
              <div className="flex flex-col justify-between overflow-hidden rounded-xl border border-amber-500/20 bg-panel lg:col-span-2">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-amber-500/15 bg-panelElevated font-bold uppercase tracking-wider text-amber-400/90">
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
                            <td className="px-3.5 py-2.5 font-semibold text-ink">
                              {item.name}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-bold text-amber-300">
                              {item.quantidade.toLocaleString("pt-BR")} un.
                            </td>
                            <td className="px-3.5 py-2.5 text-right text-inkMuted">
                              {item.media3M.toFixed(1).replace(".", ",")} un.
                            </td>
                            <td className="px-3.5 py-2.5 text-right">
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2 py-0.5 text-xs font-bold",
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
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand via-warning to-brandStrong py-2 text-xs font-bold text-onBrand shadow-md transition-all hover:brightness-110 disabled:opacity-50"
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
          <div className="overflow-hidden rounded-2xl border border-amber-500/20 bg-panel shadow-[0_8px_30px_rgba(0,0,0,0.45)] lg:col-span-8">
            <div className="flex flex-col justify-between gap-2 border-b border-amber-500/15 px-6 py-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-bold text-ink">
                  Detalhamento Operacional por Loja (
                  {formatMonthLabel(currentReferenceMonth)})
                </h2>
                <p className="text-xs text-inkMuted">
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
              <div className="flex flex-col items-center justify-center py-14 text-inkMuted">
                <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                <p className="mt-2 text-sm">Carregando indicadores por loja...</p>
              </div>
            ) : monthRowsFiltered.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                <p className="text-sm font-medium text-inkSoft">
                  Nenhum registro encontrado para o período selecionado.
                </p>
                <p className="mt-1 text-xs text-inkMuted">
                  Lance um pedido em{" "}
                  <Link
                    href={newOrderHref}
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
                    <tr className="border-b border-amber-500/15 bg-panel text-xs font-bold uppercase tracking-wider text-amber-400/90">
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
                            <div className="font-bold text-ink">
                              {row.store_name}
                            </div>
                            {(row.store_code || row.store_city) && (
                              <div className="text-xs text-inkMuted">
                                {row.store_code}
                                {row.store_code && row.store_city ? " • " : ""}
                                {row.store_city}
                              </div>
                            )}
                          </td>

                          <td className="px-5 py-3.5">
                            <div className="font-bold text-amber-300">
                              {formatCurrencyBRL(row.current_month_total)}
                            </div>
                            <div className="text-xs text-inkMuted">
                              {row.total_items} itens
                            </div>
                          </td>

                          <td className="px-5 py-3.5 text-inkSoft">
                            <div>{formatCurrencyBRL(row.historical_avg)}</div>
                            <div className="text-xs text-inkMuted">
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
                              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/35 bg-panelElevated px-3 py-1.5 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500 hover:text-onBrand"
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
            className="flex flex-col justify-between rounded-2xl border border-amber-500/20 bg-panel p-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] lg:col-span-4"
          >
            <div>
              <div className="flex items-center justify-between border-b border-amber-500/15 pb-3.5">
                <div>
                  <h2 className="text-base font-bold text-ink">
                    Central de Relatórios PDF
                  </h2>
                  <p className="text-xs text-inkMuted">
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
                  className="rounded-lg border border-amber-500/30 bg-panelElevated px-2.5 py-1 text-xs font-bold text-amber-300 focus:border-amber-400 focus:outline-none"
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
                        "rounded-md px-2 py-0.5 text-xs font-bold transition-colors",
                        generalReportYearMonth === ym
                          ? "bg-amber-500 text-onBrand"
                          : "border border-amber-500/20 bg-panelElevated text-inkMuted hover:text-amber-300"
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
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-panel p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-400">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink">
                        Relatório Geral (Todos os Cards)
                      </p>
                      <p className="truncate text-xs text-inkMuted">
                        KPIs, Valores, Quantidades e Evolução
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadCompleteReportPdf()}
                    disabled={loading || analyticsRows.length === 0}
                    className="shrink-0 rounded-lg border border-amber-500/35 bg-panel px-3 py-1.5 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500 hover:text-onBrand disabled:opacity-50"
                  >
                    Baixar
                  </button>
                </div>

                {/* Item 2: Relatório do Mês Atual (1 clique) */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-panel p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-400">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink">
                        Consolidado Mês Atual ({formatMonthLabel(`${getDefaultYearMonth()}-01`)})
                      </p>
                      <p className="truncate text-xs text-inkMuted">
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
                    className="shrink-0 rounded-lg border border-amber-500/35 bg-panel px-3 py-1.5 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500 hover:text-onBrand disabled:opacity-50"
                  >
                    Baixar
                  </button>
                </div>

                {/* Item 3: Relatório Financeiro de Ranking por Loja */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-panel p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-400">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink">
                        Ranking de Gastos por Loja
                      </p>
                      <p className="truncate text-xs text-inkMuted">
                        Comparativo financeiro e desvios 3M
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadRankingPdf}
                    disabled={rankingMonthRows.length === 0}
                    className="shrink-0 rounded-lg border border-amber-500/35 bg-panel px-3 py-1.5 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500 hover:text-onBrand disabled:opacity-50"
                  >
                    Baixar
                  </button>
                </div>

                {/* Item 4: Relatório de Consumo em Quantidade de Produtos */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-panel p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-400">
                      <Package className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink">
                        Comparativo de Quantidade (Unid.)
                      </p>
                      <p className="truncate text-xs text-inkMuted">
                        Consumo físico por loja e média 3M
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadItemsComparisonPdf}
                    disabled={itemsComparisonChartData.length === 0}
                    className="shrink-0 rounded-lg border border-amber-500/35 bg-panel px-3 py-1.5 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500 hover:text-onBrand disabled:opacity-50"
                  >
                    Baixar
                  </button>
                </div>

                {/* Item 5: Relatório de Evolução Mensal */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-panel p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-400">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink">
                        Evolução Mensal vs. Rede
                      </p>
                      <p className="truncate text-xs text-inkMuted">
                        Histórico consolidado mês a mês
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadEvolutionPdf}
                    disabled={composedChartData.length === 0}
                    className="shrink-0 rounded-lg border border-amber-500/35 bg-panel px-3 py-1.5 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500 hover:text-onBrand disabled:opacity-50"
                  >
                    Baixar
                  </button>
                </div>

                {/* Item 6: Relatório de Curva ABC de Produtos e Auditoria de Preços */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-panel p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-400">
                      <Flame className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink">
                        Curva ABC & Auditoria de Preços
                      </p>
                      <p className="truncate text-xs text-inkMuted">
                        Produtos mais pedidos e variação unitária
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadAbcAndPricePdf}
                    disabled={productAbcRows.length === 0}
                    className="shrink-0 rounded-lg border border-amber-500/35 bg-panel px-3 py-1.5 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500 hover:text-onBrand disabled:opacity-50"
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand via-warning to-brandStrong px-4 py-2.5 text-xs font-bold text-onBrand shadow-[0_4px_20px_rgba(245,158,11,0.3)] transition-all hover:brightness-110 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Baixar Relatório Completo (
                {formatMonthLabel(`${generalReportYearMonth}-01`)})
              </button>
            </div>
          </div>
        </section>

        {/* 5B. ITEM 3: TETO DE ORÇAMENTO MENSAL E LIMITE DE QUANTIDADE POR LOJA */}
        <section
          id="orcamento-lojas"
          className="mt-6 rounded-2xl border border-amber-500/20 bg-panel p-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
        >
          <div className="flex flex-col justify-between gap-4 border-b border-amber-500/15 pb-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-amber-400" />
                <h2 className="text-base font-bold text-ink">
                  Teto de Orçamento Mensal e Limite de Quantidade por Loja
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-inkMuted">
                Acompanhe o consumo em R$ e em unidades frente à meta mensal de{" "}
                <strong className="text-amber-300">
                  {formatMonthLabel(currentReferenceMonth)}
                </strong>
                . Clique em <strong>Definir Meta</strong> em qualquer loja para ajustar os limites.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-bold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Dentro da Meta (&lt;80%)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-bold text-amber-300">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Atenção (80% a 99%)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 font-bold text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-400" />
                Orçamento Estourado (≥100%)
              </span>
            </div>
          </div>

          {storeBudgetsStatus.length === 0 ? (
            <div className="py-10 text-center text-sm text-inkMuted">
              Nenhuma loja cadastrada para acompanhamento de teto de orçamento.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {storeBudgetsStatus.map((item) => {
                const isEditing = editingBudgetStoreId === item.store.id;
                const budgetBarWidth = Math.min(
                  100,
                  Math.max(0, item.budgetUsagePct ?? 0)
                );
                const itemsBarWidth = Math.min(
                  100,
                  Math.max(0, item.itemsUsagePct ?? 0)
                );

                return (
                  <div
                    key={item.store.id}
                    className={cn(
                      "flex flex-col justify-between rounded-xl border p-4 transition-colors",
                      item.status === "exceeded"
                        ? "border-red-500/40 bg-red-500/[0.04]"
                        : item.status === "warning"
                        ? "border-amber-500/40 bg-amber-500/[0.04]"
                        : "border-amber-500/20 bg-panel"
                    )}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-ink">
                            {item.store.name}{" "}
                            {item.store.code ? (
                              <span className="text-xs font-semibold text-amber-400">
                                ({item.store.code})
                              </span>
                            ) : null}
                          </h3>
                          <p className="text-xs text-inkMuted">
                            {item.store.city}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {item.status === "exceeded" && (
                            <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-0.5 text-xs font-bold text-red-400">
                              Estourado
                            </span>
                          )}
                          {item.status === "warning" && (
                            <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                              Atenção &gt;80%
                            </span>
                          )}
                          {item.status === "ok" && (
                            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                              Dentro da Meta
                            </span>
                          )}
                          {item.status === "unconfigured" && (
                            <span className="rounded-full border border-line bg-panelElevated/80 px-2.5 py-0.5 text-xs font-semibold text-inkMuted">
                              Sem Teto
                            </span>
                          )}

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() =>
                                isEditing
                                  ? setEditingBudgetStoreId(null)
                                  : startEditingStoreBudget(item.store)
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-panel px-2 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500 hover:text-onBrand"
                              title="Definir ou editar teto de orçamento mensal"
                            >
                              <Pencil className="h-3 w-3" />
                              {item.budget > 0 || item.itemsLimit > 0
                                ? "Editar"
                                : "Definir Meta"}
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="mt-3 space-y-2.5 rounded-xl border border-amber-500/30 bg-panel p-3">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-bold uppercase text-amber-300">
                                Teto Mensal (R$)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={budgetFormValue}
                                onChange={(e) =>
                                  setBudgetFormValue(e.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-amber-500/30 bg-panelElevated px-2.5 py-1.5 text-xs font-bold text-ink focus:border-amber-400 focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold uppercase text-amber-300">
                                Limite Qtd (Unid.)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={itemsLimitFormValue}
                                onChange={(e) =>
                                  setItemsLimitFormValue(e.target.value)
                                }
                                className="mt-1 w-full rounded-lg border border-amber-500/30 bg-panelElevated px-2.5 py-1.5 text-xs font-bold text-ink focus:border-amber-400 focus:outline-none"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingBudgetStoreId(null)}
                              className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-inkMuted hover:text-ink"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              disabled={savingBudget}
                              onClick={() => handleSaveStoreBudget(item.store)}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-onBrand hover:bg-amber-400 disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Salvar Meta
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3.5 space-y-3">
                          {/* Barra 1: Orçamento Financeiro (R$) */}
                          <div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-inkMuted">
                                Gasto Financeiro:
                              </span>
                              <span className="font-bold text-ink">
                                {formatCurrencyBRL(item.currentAmount)}{" "}
                                <span className="text-inkMuted">/</span>{" "}
                                <span className="text-amber-300">
                                  {item.budget > 0
                                    ? formatCurrencyBRL(item.budget)
                                    : "Sem teto R$"}
                                </span>
                              </span>
                            </div>
                            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-canvas">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  (item.budgetUsagePct ?? 0) >= 100
                                    ? "bg-red-500"
                                    : (item.budgetUsagePct ?? 0) >= 80
                                    ? "bg-amber-400"
                                    : "bg-emerald-500"
                                )}
                                style={{
                                  width: `${
                                    item.budget > 0 ? budgetBarWidth : 0
                                  }%`,
                                }}
                              />
                            </div>
                            {item.budget > 0 && (
                              <div className="mt-1 flex items-center justify-between text-xs">
                                <span className="font-bold text-inkSoft">
                                  {(item.budgetUsagePct ?? 0)
                                    .toFixed(1)
                                    .replace(".", ",")}
                                  % utilizado
                                </span>
                                <span
                                  className={cn(
                                    "font-semibold",
                                    (item.remainingBudget ?? 0) < 0
                                      ? "text-red-400"
                                      : "text-inkMuted"
                                  )}
                                >
                                  {(item.remainingBudget ?? 0) >= 0
                                    ? `Saldo: ${formatCurrencyBRL(
                                        item.remainingBudget ?? 0
                                      )}`
                                    : `Excedido em ${formatCurrencyBRL(
                                        Math.abs(item.remainingBudget ?? 0)
                                      )}`}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Barra 2: Limite de Quantidade de Produtos (Unidades) */}
                          <div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-inkMuted">
                                Volume de Produtos:
                              </span>
                              <span className="font-bold text-ink">
                                {item.currentItems} un.{" "}
                                <span className="text-inkMuted">/</span>{" "}
                                <span className="text-amber-300">
                                  {item.itemsLimit > 0
                                    ? `${item.itemsLimit} un.`
                                    : "Sem limite un."}
                                </span>
                              </span>
                            </div>
                            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-canvas">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  (item.itemsUsagePct ?? 0) >= 100
                                    ? "bg-red-500"
                                    : (item.itemsUsagePct ?? 0) >= 80
                                    ? "bg-amber-400"
                                    : "bg-amber-500"
                                )}
                                style={{
                                  width: `${
                                    item.itemsLimit > 0 ? itemsBarWidth : 0
                                  }%`,
                                }}
                              />
                            </div>
                            {item.itemsLimit > 0 && (
                              <div className="mt-1 flex items-center justify-between text-xs">
                                <span className="font-bold text-inkSoft">
                                  {(item.itemsUsagePct ?? 0)
                                    .toFixed(1)
                                    .replace(".", ",")}
                                  % da cota física
                                </span>
                                <span
                                  className={cn(
                                    "font-semibold",
                                    (item.remainingItems ?? 0) < 0
                                      ? "text-red-400"
                                      : "text-inkMuted"
                                  )}
                                >
                                  {(item.remainingItems ?? 0) >= 0
                                    ? `Restam ${item.remainingItems} un.`
                                    : `Excedido em ${Math.abs(
                                        item.remainingItems ?? 0
                                      )} un.`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 5C. ITEM 1 (CURVA ABC DE PRODUTOS) + ITEM 2 (ALERTA DE VARIAÇÃO DE PREÇO UNITÁRIO) */}
        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Coluna Esquerda (7 cols): Item 1 — Ranking dos Produtos Mais Pedidos (Curva ABC) */}
          <div
            id="curva-abc"
            className="flex flex-col justify-between rounded-2xl border border-amber-500/20 bg-panel p-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] lg:col-span-7"
          >
            <div>
              <div className="flex flex-col justify-between gap-3 border-b border-amber-500/15 pb-4 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <Flame className="h-5 w-5 text-amber-400" />
                    <h2 className="text-base font-bold text-ink">
                      Ranking dos Produtos Mais Pedidos (Curva ABC)
                    </h2>
                  </div>
                  <p className="mt-0.5 text-xs text-inkMuted">
                    Classificação Pareto dos produtos que mais consomem orçamento (R$) e volume (unid.)
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Período da Curva ABC"
                    value={abcYearMonth}
                    onChange={(e) => setAbcYearMonth(e.target.value)}
                    className="rounded-lg border border-amber-500/30 bg-panelElevated px-2.5 py-1.5 text-xs font-bold text-amber-300 focus:border-amber-400 focus:outline-none"
                  >
                    <option value="all">Todos os Meses (Acumulado)</option>
                    {availableRankingMonths.map((ym) => (
                      <option key={ym} value={ym}>
                        {formatMonthLabel(`${ym}-01`).toUpperCase()} ({ym})
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleDownloadAbcAndPricePdf}
                    disabled={productAbcRows.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-panelElevated px-3 py-1.5 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500 hover:text-onBrand disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF ABC & Preços
                  </button>
                </div>
              </div>

              {/* Resumo das Classes A, B e C */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                    Classe A (Até 80% do Gasto)
                  </span>
                  <p className="mt-0.5 text-base font-bold text-ink">
                    {
                      productAbcRows.filter((r) => r.abc_class === "A")
                        .length
                    }{" "}
                    <span className="text-xs font-normal text-amber-300">
                      produtos vitais
                    </span>
                  </p>
                </div>

                <div className="rounded-xl border border-amber-500/20 bg-panel p-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-inkSoft">
                    Classe B (80% a 95%)
                  </span>
                  <p className="mt-0.5 text-base font-bold text-ink">
                    {
                      productAbcRows.filter((r) => r.abc_class === "B")
                        .length
                    }{" "}
                    <span className="text-xs font-normal text-inkMuted">
                      intermediários
                    </span>
                  </p>
                </div>

                <div className="rounded-xl border border-amber-500/15 bg-panel p-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-inkMuted">
                    Classe C (95% a 100%)
                  </span>
                  <p className="mt-0.5 text-base font-bold text-ink">
                    {
                      productAbcRows.filter((r) => r.abc_class === "C")
                        .length
                    }{" "}
                    <span className="text-xs font-normal text-inkMuted">
                      baixo impacto
                    </span>
                  </p>
                </div>
              </div>

              {urlContext.product && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                  <span className="text-xs text-amber-100">
                    Filtrando por{" "}
                    <strong className="text-amber-300">
                      “{urlContext.product}”
                    </strong>{" "}
                    · {filteredAbcRows.length} produto(s)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateUrlContext(
                        { product: null },
                        { hash: "#curva-abc" }
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 px-2 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/15"
                  >
                    <X className="h-3 w-3" />
                    Limpar busca
                  </button>
                </div>
              )}

              {/* Tabela da Curva ABC de Produtos */}
              {productAbcRows.length === 0 ? (
                <div className="py-12 text-center text-sm text-inkMuted">
                  Nenhum item de pedido encontrado para o período selecionado.
                </div>
              ) : filteredAbcRows.length === 0 ? (
                <div className="py-12 text-center text-sm text-inkMuted">
                  Nenhum produto corresponde ao filtro informado.
                </div>
              ) : (
                <div className="mt-4 max-h-[380px] overflow-auto rounded-xl border border-amber-500/20">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-panelElevated text-xs font-bold uppercase tracking-wider text-amber-400">
                      <tr className="border-b border-amber-500/20">
                        <th className="px-3 py-2.5">#</th>
                        <th className="px-3 py-2.5">Produto</th>
                        <th className="px-3 py-2.5 text-center">Curva</th>
                        <th className="px-3 py-2.5 text-right">Qtd</th>
                        <th className="px-3 py-2.5 text-right">Vlr. Unit. Médio</th>
                        <th className="px-3 py-2.5 text-right">Gasto Total</th>
                        <th className="px-3 py-2.5 text-right">% Acum.</th>
                        <th className="px-3 py-2.5">Maior Consumidora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-500/10">
                      {filteredAbcRows.slice(0, 30).map((row, index) => (
                        <tr
                          key={row.key}
                          className="transition-colors hover:bg-amber-500/[0.05]"
                        >
                          <td className="px-3 py-2.5 font-bold text-inkMuted">
                            {index + 1}º
                          </td>
                          <td className="px-3 py-2.5 font-bold text-ink">
                            {row.product_name}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={cn(
                                "inline-flex rounded-md px-2 py-0.5 text-xs font-bold",
                                row.abc_class === "A"
                                  ? "border border-amber-500/40 bg-amber-500/20 text-amber-300"
                                  : row.abc_class === "B"
                                  ? "border border-blue-500/35 bg-blue-500/15 text-blue-300"
                                  : "border border-line bg-panelElevated text-inkMuted"
                              )}
                            >
                              Classe {row.abc_class}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-inkSoft">
                            {row.total_quantity} un.
                          </td>
                          <td className="px-3 py-2.5 text-right text-inkSoft">
                            {formatCurrencyBRL(row.avg_unit_price)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-amber-300">
                            {formatCurrencyBRL(row.total_amount)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-inkMuted">
                            {row.cumulative_pct.toFixed(1).replace(".", ",")}%
                          </td>
                          <td className="px-3 py-2.5 text-xs text-inkSoft">
                            {row.top_store_label}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Coluna Direita (5 cols): Item 2 — Alerta de Variação de Preço Unitário (Inflação Interna & Divergência entre Lojas) */}
          <div
            id="alertas-preco"
            className="flex flex-col justify-between rounded-2xl border border-amber-500/20 bg-panel p-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] lg:col-span-5"
          >
            <div>
              <div className="flex items-center justify-between border-b border-amber-500/15 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-400" />
                    <h2 className="text-base font-bold text-ink">
                      Auditoria de Variação de Preço Unitário
                    </h2>
                  </div>
                  <p className="mt-0.5 text-xs text-inkMuted">
                    Detecta aumento de preço vs. mês anterior ou mesmo produto com preços diferentes entre lojas
                  </p>
                </div>

                <span className="shrink-0 rounded-full border border-amber-500/35 bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-300">
                  {priceAlertRows.length} alerta(s)
                </span>
              </div>

              {priceAlertRows.length === 0 ? (
                <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-8 text-center">
                  <ShieldCheck className="h-8 w-8 text-emerald-400" />
                  <p className="mt-2 text-sm font-bold text-ink">
                    Preços Unitários Estáveis no Período
                  </p>
                  <p className="mt-1 text-xs text-inkMuted">
                    Nenhuma variação relevante de preço unitário contra o mês anterior ou divergência entre lojas foi detectada em{" "}
                    {abcYearMonth === "all"
                      ? "Todos os Meses"
                      : formatMonthLabel(`${abcYearMonth}-01`)}
                    .
                  </p>
                </div>
              ) : (
                <div className="mt-4 max-h-[450px] space-y-3 overflow-y-auto pr-1">
                  {priceAlertRows.slice(0, 20).map((item) => {
                    const hasMonthlyInflation =
                      item.price_diff_pct !== null &&
                      Math.abs(item.price_diff_pct) >= 1;
                    const hasStoreSpread = item.inter_store_spread_pct >= 1;

                    return (
                      <div
                        key={item.key}
                        className="rounded-xl border border-amber-500/20 bg-panel p-3.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-ink">
                              {item.product_name}
                            </p>
                            <p className="text-xs text-inkMuted">
                              Volume no período:{" "}
                              <strong className="text-inkSoft">
                                {item.total_quantity} un.
                              </strong>{" "}
                              • Gasto:{" "}
                              <strong className="text-amber-300">
                                {formatCurrencyBRL(item.total_amount)}
                              </strong>
                            </p>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            {hasMonthlyInflation && item.price_diff_pct !== null && (
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
                                  item.price_diff_pct > 0
                                    ? "border border-red-500/40 bg-red-500/15 text-red-400"
                                    : "border border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                                )}
                              >
                                {item.price_diff_pct > 0 ? "↑" : "↓"}{" "}
                                {formatPercent(item.price_diff_pct)} vs mês ant.
                              </span>
                            )}
                            {hasStoreSpread && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-300">
                                Δ{" "}
                                {item.inter_store_spread_pct
                                  .toFixed(1)
                                  .replace(".", ",")}
                                % entre lojas
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-2.5 grid grid-cols-1 gap-2 rounded-lg border border-amber-500/10 bg-panel p-2.5 text-xs sm:grid-cols-2">
                          {hasMonthlyInflation &&
                            item.prev_avg_unit_price !== null && (
                              <div>
                                <span className="block text-xs text-inkMuted">
                                  Variação vs. Mês Anterior:
                                </span>
                                <span className="font-semibold text-inkSoft">
                                  De{" "}
                                  {formatCurrencyBRL(item.prev_avg_unit_price)}{" "}
                                  para{" "}
                                  <strong className="text-ink">
                                    {formatCurrencyBRL(item.avg_unit_price)}
                                  </strong>
                                </span>
                              </div>
                            )}

                          {hasStoreSpread && (
                            <div>
                              <span className="block text-xs text-inkMuted">
                                Divergência entre Lojas:
                              </span>
                              <span className="font-semibold text-inkSoft">
                                Menor:{" "}
                                <strong className="text-emerald-400">
                                  {formatCurrencyBRL(item.min_unit_price)}
                                </strong>{" "}
                                ({item.min_price_store}) • Maior:{" "}
                                <strong className="text-red-400">
                                  {formatCurrencyBRL(item.max_unit_price)}
                                </strong>{" "}
                                ({item.max_price_store})
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 border-t border-amber-500/15 pt-3">
              <button
                type="button"
                onClick={handleDownloadAbcAndPricePdf}
                disabled={productAbcRows.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/35 bg-panelElevated px-4 py-2 text-xs font-bold text-amber-300 transition-colors hover:bg-amber-500 hover:text-onBrand disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Baixar Relatório de Auditoria de Preços e Curva ABC (PDF)
              </button>
            </div>
          </div>
        </section>

        {/* 6. QUINTA LINHA: 3 CARDS INFERIORES DE CONSOLIDADO HISTÓRICO (Idêntico ao rodapé da foto de referência) */}
        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-panel to-canvas p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-inkMuted">
                Volume Histórico Acumulado
              </span>
              <p className="mt-0.5 text-xl font-bold text-ink">
                {new Intl.NumberFormat("pt-BR").format(
                  historicalSummary.allTimeItems
                )}{" "}
                <span className="text-xs font-normal text-amber-400">
                  unidades
                </span>
              </p>
              <p className="mt-0.5 text-xs text-inkMuted">
                Total solicitado em todos os meses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-panel to-canvas p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-inkMuted">
                Compras Históricas Acumuladas
              </span>
              <p className="mt-0.5 text-xl font-bold text-ink">
                {formatCurrencyBRL(historicalSummary.allTimeAmount)}
              </p>
              <p className="mt-0.5 text-xs text-inkMuted">
                Soma de todos os períodos ({availableRankingMonths.length} meses)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-amber-500/20 bg-gradient-to-b from-panel to-canvas p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-medium text-inkMuted">
                Ticket Médio por Loja no Mês
              </span>
              <p className="mt-0.5 text-xl font-bold text-ink">
                {formatCurrencyBRL(historicalSummary.avgPerStoreMonth)}
              </p>
              <p className="mt-0.5 text-xs text-amber-400/90">
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
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-amber-500/30 bg-panel text-ink shadow-2xl">
            <div className="flex items-center justify-between border-b border-amber-500/15 px-6 py-4">
              <div>
                <h3
                  id="modal-order-items-title"
                  className="text-lg font-bold text-amber-400"
                >
                  Itens Solicitados — {modalStore.store_name}
                </h3>
                <p className="text-xs text-inkMuted">
                  Referência:{" "}
                  <strong className="text-ink">
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
                  <strong className="text-ink">
                    {formatCurrencyBRL(modalTotals.totalAmount)}
                  </strong>
                </p>
              </div>

              <button
                type="button"
                onClick={closeItemsModal}
                className="rounded-lg p-1.5 text-inkMuted hover:bg-amber-500/10 hover:text-amber-300"
                aria-label="Fechar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Barra de Seleção de Data / Meses Anteriores */}
            <div className="border-b border-amber-500/15 bg-panel px-6 py-3.5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2.5">
                  <label
                    htmlFor="modal-month-picker"
                    className="text-xs font-bold uppercase tracking-wider text-inkSoft"
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
                      className="rounded-xl border border-amber-500/30 bg-panel py-1.5 pl-9 pr-3 text-xs font-bold text-amber-300 focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                {modalItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadModalPdf}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-3.5 py-1.5 text-xs font-bold text-onBrand shadow-xs transition-all hover:brightness-110"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Baixar PDF ({formatMonthLabel(`${modalYearMonth}-01`)})
                  </button>
                )}
              </div>

              {availableModalMonths.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-inkMuted">
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
                            ? "bg-amber-500 text-onBrand"
                            : "border border-amber-500/20 bg-panel text-inkSoft hover:border-amber-500/40 hover:text-amber-300"
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
                <div className="flex flex-col items-center justify-center py-12 text-inkMuted">
                  <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
                  <p className="mt-2 text-sm">Carregando itens do pedido...</p>
                </div>
              ) : modalItems.length === 0 ? (
                <div className="py-12 text-center text-sm text-inkMuted">
                  Nenhum item encontrado para esta loja em{" "}
                  <strong className="text-ink">
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
                    <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-500/25 bg-panelElevated px-4 py-2.5 text-xs">
                      <span className="font-medium text-inkSoft">
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
                        <tr className="border-b border-amber-500/15 bg-panelElevated text-xs font-bold uppercase tracking-wider text-amber-400">
                          <th className="px-4 py-3">Produto</th>
                          <th className="px-4 py-3 text-right">Qtd</th>
                          <th className="px-4 py-3 text-right">Vlr. Unit.</th>
                          <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-500/10">
                        {modalItems.map((item) => (
                          <tr key={item.id} className="hover:bg-amber-500/5">
                            <td className="px-4 py-2.5 font-medium text-ink">
                              {item.product_name}
                            </td>
                            <td className="px-4 py-2.5 text-right text-inkSoft">
                              {item.quantity}
                            </td>
                            <td className="px-4 py-2.5 text-right text-inkMuted">
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
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-xs font-bold text-onBrand shadow-sm transition-all hover:brightness-110"
                  >
                    <Download className="h-4 w-4" />
                    Baixar Lista em PDF
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={closeItemsModal}
                className="rounded-xl border border-amber-500/30 bg-panelElevated px-4 py-2 text-xs font-bold text-inkSoft hover:bg-amber-500/10"
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
