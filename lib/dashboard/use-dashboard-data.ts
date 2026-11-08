"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getSavedStoreBudgetsMap } from "@/lib/store-budgets";
import {
  enrichAnalyticsWithItemsMetrics,
  normalizeAnalyticsRow,
  type OrderItemWithContext,
  type StoreInfo,
  type StoreMonthlyAnalyticsRow,
} from "@/lib/dashboard/analytics";

interface UseDashboardDataResult {
  stores: StoreInfo[];
  setStores: React.Dispatch<React.SetStateAction<StoreInfo[]>>;
  analyticsRows: StoreMonthlyAnalyticsRow[];
  orderItemsHistory: OrderItemWithContext[];
  loading: boolean;
  errorMessage: string | null;
  reload: () => Promise<void>;
}

export function useDashboardData(): UseDashboardDataResult {
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [analyticsRows, setAnalyticsRows] = useState<
    StoreMonthlyAnalyticsRow[]
  >([]);
  const [orderItemsHistory, setOrderItemsHistory] = useState<
    OrderItemWithContext[]
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const localBudgets = getSavedStoreBudgetsMap();

      // 1. Busca lojas cadastradas
      const { data: storesData } = await supabase
        .from("stores")
        .select("*")
        .order("name", { ascending: true });

      const mappedStores: StoreInfo[] = (storesData ?? []).map(
        (s: Record<string, unknown>) => {
          const id = String(s.id ?? "");
          const dbBudget = Number(s.monthly_budget ?? s.orcamento_mensal ?? NaN);
          const dbItemsLimit = Number(
            s.monthly_items_limit ?? s.limite_itens_mensal ?? NaN
          );
          const localEntry = localBudgets[id];

          return {
            id,
            name: String(s.name ?? s.nome ?? "Loja"),
            code: String(s.code ?? s.codigo ?? ""),
            city: String(s.city ?? s.cidade ?? ""),
            monthly_budget:
              Number.isFinite(dbBudget) && dbBudget > 0
                ? dbBudget
                : localEntry?.monthly_budget ?? 0,
            monthly_items_limit:
              Number.isFinite(dbItemsLimit) && dbItemsLimit > 0
                ? dbItemsLimit
                : localEntry?.monthly_items_limit ?? 0,
          };
        }
      );
      setStores(mappedStores);

      const storeMap = new Map<string, StoreInfo>();
      mappedStores.forEach((s) => storeMap.set(s.id, s));

      // 1B. Busca histórico de pedidos e itens para Curva ABC de Produtos e Auditoria de Preços
      const [ordersResult, orderItemsResult] = await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .order("reference_month", { ascending: true }),
        supabase
          .from("order_items")
          .select("order_id, product_name, quantity, unit_price, total_price"),
      ]);

      const ordersData = ordersResult.data;
      const ordersError = ordersResult.error;

      if (ordersData && orderItemsResult.data) {
        const orderContextById = new Map<
          string,
          {
            store_id: string;
            store_name: string;
            store_code: string;
            reference_month: string;
          }
        >();

        for (const rawOrder of ordersData) {
          const o = rawOrder as Record<string, unknown>;
          const orderId = String(o.id ?? "");
          const storeId = String(o.store_id ?? "");
          const ym = String(o.reference_month ?? "").slice(0, 7);
          const st = storeMap.get(storeId);
          orderContextById.set(orderId, {
            store_id: storeId,
            store_name: st?.name ?? "Loja",
            store_code: st?.code ?? "",
            reference_month: ym,
          });
        }

        const enrichedItems: OrderItemWithContext[] = [];
        for (const rawItem of orderItemsResult.data) {
          const item = rawItem as Record<string, unknown>;
          const ctx = orderContextById.get(String(item.order_id ?? ""));
          if (!ctx || !ctx.reference_month) continue;
          enrichedItems.push({
            product_name: String(item.product_name ?? "").trim(),
            quantity: Number(item.quantity ?? 0),
            unit_price: Number(item.unit_price ?? 0),
            total_price: Number(item.total_price ?? 0),
            store_id: ctx.store_id,
            store_name: ctx.store_name,
            store_code: ctx.store_code,
            reference_month: ctx.reference_month,
          });
        }
        setOrderItemsHistory(enrichedItems);
      }

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
      if (ordersError) {
        if (viewError) {
          setErrorMessage(
            `Não foi possível consultar a view 'store_monthly_analytics': ${viewError.message}`
          );
        }
        setAnalyticsRows([]);
        return;
      }

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
    reload();
  }, [reload]);

  return {
    stores,
    setStores,
    analyticsRows,
    orderItemsHistory,
    loading,
    errorMessage,
    reload,
  };
}
