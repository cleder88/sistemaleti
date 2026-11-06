"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Loader2,
  Presentation,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { MonthlyPresentation } from "@/components/monthly-presentation";
import { createClient } from "@/lib/supabase/client";
import {
  buildPresentation,
  formatMonthLabel,
  getCurrentMonthKey,
  isValidMonthKey,
  shiftMonthKey,
  type PresentationAnalyticsRow,
  type PresentationOrderItem,
  type PresentationStoreInfo,
} from "@/lib/presentation";

function normalizeStore(row: Record<string, unknown>): PresentationStoreInfo {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? "Loja"),
    code: String(row.code ?? ""),
    city: String(row.city ?? ""),
    monthly_budget: Number(row.monthly_budget ?? 0) || 0,
    monthly_items_limit: Number(row.monthly_items_limit ?? 0) || 0,
  };
}

function normalizeAnalyticsRow(
  row: Record<string, unknown>
): PresentationAnalyticsRow {
  return {
    store_id: String(row.store_id ?? ""),
    store_name: String(row.store_name ?? "Loja"),
    store_code: String(row.store_code ?? ""),
    store_city: String(row.store_city ?? ""),
    reference_month: String(row.reference_month ?? "").slice(0, 10),
    current_month_total: Number(row.current_month_total ?? 0) || 0,
    total_items: Number(row.total_items ?? 0) || 0,
    historical_avg: Number(row.historical_avg ?? 0) || 0,
    network_avg: Number(row.network_avg ?? 0) || 0,
    diff_percentage: Number(row.diff_percentage ?? 0) || 0,
    status: String(row.status ?? "normal"),
  };
}

export default function ApresentacaoPage() {
  const [stores, setStores] = useState<PresentationStoreInfo[]>([]);
  const [analyticsRows, setAnalyticsRows] = useState<
    PresentationAnalyticsRow[]
  >([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    getCurrentMonthKey()
  );
  const [generatedMonth, setGeneratedMonth] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const [orderItems, setOrderItems] = useState<PresentationOrderItem[]>([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [baseReload, setBaseReload] = useState(0);

  useEffect(() => {
    let active = true;

    (async () => {
      setLoadingBase(true);
      setErrorMessage(null);

      try {
        const supabase = createClient();
        const [storesResult, analyticsResult] = await Promise.all([
          supabase
            .from("stores")
            .select(
              "id, name, code, city, monthly_budget, monthly_items_limit"
            )
            .order("name", { ascending: true }),
          supabase
            .from("store_monthly_analytics")
            .select("*")
            .order("reference_month", { ascending: true }),
        ]);

        if (!active) return;

        if (storesResult.error) throw new Error(storesResult.error.message);
        if (analyticsResult.error)
          throw new Error(analyticsResult.error.message);

        const mappedStores = (storesResult.data ?? []).map((row) =>
          normalizeStore(row as Record<string, unknown>)
        );
        const rows = (analyticsResult.data ?? [])
          .map((row) =>
            normalizeAnalyticsRow(row as Record<string, unknown>)
          )
          .filter((row) =>
            isValidMonthKey(row.reference_month.slice(0, 7))
          );

        const months = Array.from(
          new Set(rows.map((row) => row.reference_month.slice(0, 7)))
        ).sort((a, b) => b.localeCompare(a));

        setStores(mappedStores);
        setAnalyticsRows(rows);
        setAvailableMonths(months);
        setSelectedMonth((current) =>
          months.includes(current) ? current : months[0] ?? getCurrentMonthKey()
        );
      } catch (error) {
        if (!active) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Erro ao carregar os dados da apresentação."
        );
      } finally {
        if (active) setLoadingBase(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [baseReload]);

  useEffect(() => {
    if (!generatedMonth) {
      setOrderItems([]);
      return;
    }

    let active = true;

    (async () => {
      setLoadingItems(true);
      setErrorMessage(null);
      setOrderItems([]);

      try {
        const supabase = createClient();
        const start = `${generatedMonth}-01`;
        const end = `${shiftMonthKey(generatedMonth, 1)}-01`;

        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select("id, store_id")
          .gte("reference_month", start)
          .lt("reference_month", end);

        if (ordersError) throw new Error(ordersError.message);
        if (!active) return;

        const orders = ordersData ?? [];
        if (orders.length === 0) {
          setOrderItems([]);
          return;
        }

        const storeByOrder = new Map<string, string>();
        for (const rawOrder of orders) {
          const order = rawOrder as Record<string, unknown>;
          storeByOrder.set(
            String(order.id ?? ""),
            String(order.store_id ?? "")
          );
        }

        const orderIds = Array.from(storeByOrder.keys());
        const { data: itemsData, error: itemsError } = await supabase
          .from("order_items")
          .select("order_id, product_name, quantity, unit_price, total_price")
          .in("order_id", orderIds);

        if (itemsError) throw new Error(itemsError.message);
        if (!active) return;

        const mappedItems: PresentationOrderItem[] = (itemsData ?? []).map(
          (rawItem) => {
            const item = rawItem as Record<string, unknown>;
            return {
              product_name: String(item.product_name ?? ""),
              quantity: Number(item.quantity ?? 0) || 0,
              unit_price: Number(item.unit_price ?? 0) || 0,
              total_price: Number(item.total_price ?? 0) || 0,
              store_id:
                storeByOrder.get(String(item.order_id ?? "")) ?? "",
            };
          }
        );

        setOrderItems(mappedItems);
      } catch (error) {
        if (!active) return;
        setOrderItems([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Erro ao carregar os itens do mês selecionado."
        );
      } finally {
        if (active) setLoadingItems(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [generatedMonth]);

  const monthOptions = useMemo(() => {
    const options = new Set(availableMonths);
    if (isValidMonthKey(selectedMonth)) options.add(selectedMonth);
    return Array.from(options).sort((a, b) => b.localeCompare(a));
  }, [availableMonths, selectedMonth]);

  const presentation = useMemo(() => {
    if (!generatedMonth) return null;
    return buildPresentation({
      monthKey: generatedMonth,
      analyticsRows,
      stores,
      orderItems,
    });
  }, [generatedMonth, analyticsRows, stores, orderItems]);

  function generatePresentation(month: string) {
    if (!month) return;
    setSelectedMonth(month);
    setGeneratedMonth(month);
    setGeneration((current) => current + 1);
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      <Navbar />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:pl-72 lg:pr-8">
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-amber-500/20 bg-[#121217] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.45)] lg:flex-row lg:items-center">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b]" />
              <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                Apresentação Mensal
              </h1>
            </div>
            <p className="mt-1 text-xs text-zinc-400 sm:text-sm">
              Gere um carrossel executivo com os indicadores, rankings e
              destaques do mês escolhido.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-400" />
              <select
                aria-label="Mês da apresentação"
                value={selectedMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="rounded-xl border border-amber-500/30 bg-[#181820] py-2 pl-10 pr-8 text-xs font-bold text-zinc-100 focus:border-amber-400 focus:outline-none"
              >
                {monthOptions.length === 0 && (
                  <option value={selectedMonth}>
                    {formatMonthLabel(selectedMonth)}
                  </option>
                )}
                {monthOptions.map((month) => (
                  <option key={month} value={month}>
                    {formatMonthLabel(month)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => generatePresentation(selectedMonth)}
              disabled={loadingBase}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#f59e0b] via-[#eab308] to-[#d97706] px-4 py-2 text-xs font-extrabold text-black shadow-[0_4px_20px_rgba(245,158,11,0.3)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingBase ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : generatedMonth ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {loadingBase
                ? "Carregando..."
                : generatedMonth
                ? "Atualizar apresentação"
                : "Gerar apresentação"}
            </button>

            <button
              type="button"
              onClick={() => setBaseReload((current) => current + 1)}
              disabled={loadingBase}
              title="Recarregar dados do banco"
              className="inline-flex items-center justify-center rounded-xl border border-amber-500/25 bg-[#181820] p-2 text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loadingBase ? "animate-spin" : ""}`}
              />
            </button>

            {generatedMonth && (
              <button
                type="button"
                onClick={() => setGeneratedMonth(null)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-[#181820] px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-amber-500/50 hover:text-amber-300"
              >
                <X className="h-4 w-4" />
                Fechar
              </button>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
            {errorMessage}
          </div>
        )}

        {!generatedMonth ? (
          <div className="mt-6 flex min-h-[460px] flex-col items-center justify-center rounded-3xl border border-dashed border-amber-500/20 bg-[#0d0d11] px-6 py-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
              <Presentation className="h-8 w-8" />
            </span>
            <h2 className="mt-5 text-xl font-extrabold text-white">
              Escolha um mês para montar a apresentação
            </h2>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
              O carrossel reúne panorama financeiro, ranking de lojas, produtos
              em destaque, alertas, orçamento e um resumo executivo.
            </p>

            {loadingBase ? (
              <div className="mt-6 flex items-center gap-2 text-xs text-amber-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando meses disponíveis...
              </div>
            ) : monthOptions.length === 0 ? (
              <p className="mt-6 text-xs text-zinc-500">
                Nenhum mês com pedidos foi encontrado. Importe um pedido em PDF
                para começar.
              </p>
            ) : (
              <div className="mt-7 w-full max-w-3xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">
                  Meses com dados
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {monthOptions.slice(0, 8).map((month) => (
                    <button
                      key={month}
                      type="button"
                      onClick={() => generatePresentation(month)}
                      className="rounded-xl border border-amber-500/25 bg-[#141419] px-3.5 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-300"
                    >
                      {formatMonthLabel(month)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : presentation ? (
          <div className="mt-6">
            <MonthlyPresentation
              key={`${generatedMonth}-${generation}`}
              data={presentation}
              loading={loadingItems}
            />
          </div>
        ) : (
          <div className="mt-6 flex min-h-[420px] items-center justify-center rounded-3xl border border-amber-500/20 bg-[#0d0d11]">
            <div className="flex items-center gap-2 text-sm text-amber-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Montando apresentação...
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
