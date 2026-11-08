import {
  AlertTriangle,
  Award,
  DollarSign,
  Package,
  ShieldCheck,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatCurrencyBRL,
  formatMonthLabel,
  formatPercent,
  type StoreMonthlyAnalyticsRow,
} from "@/lib/dashboard/analytics";

export interface DashboardKpis {
  totalMonthAmount: number;
  monthVariationPct: number | null;
  totalItemsVolume: number;
  itemsVariationPct: number | null;
  topStore: StoreMonthlyAnalyticsRow | null;
  alertStores: StoreMonthlyAnalyticsRow[];
  complianceRate: number;
}

interface KpiCardsProps {
  kpis: DashboardKpis;
  currentReferenceMonth: string;
  monthRowsFilteredCount: number;
  monthRowsAllStoresCount: number;
  storesCount: number;
}

const cardClass =
  "flex items-center gap-4 rounded-2xl border border-brand/20 bg-panel p-4 shadow-soft";
const iconClass =
  "flex h-13 w-13 shrink-0 items-center justify-center rounded-full border border-brand/40 bg-brand/10 text-brand shadow-glow";
const labelClass = "block truncate text-xs font-medium text-inkMuted";
const valueClass = "mt-0.5 truncate text-lg font-bold text-ink";
const mutedClass = "text-inkMuted";

function Variation({
  value,
  fallback,
}: {
  value: number | null;
  fallback: string;
}) {
  if (value === null) {
    return <span className={mutedClass}>{fallback}</span>;
  }
  return (
    <>
      <span
        className={cn("font-bold", value > 0 ? "text-brand" : "text-success")}
      >
        {value > 0 ? "↑" : "↓"} {formatPercent(value)}
      </span>
      <span className={mutedClass}>vs mês ant.</span>
    </>
  );
}

export function KpiCards({
  kpis,
  currentReferenceMonth,
  monthRowsFilteredCount,
  monthRowsAllStoresCount,
  storesCount,
}: KpiCardsProps) {
  return (
    <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <div className={cardClass}>
        <div className={iconClass}>
          <DollarSign className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <span className={labelClass}>Total em Pedidos</span>
          <p className={valueClass}>
            {formatCurrencyBRL(kpis.totalMonthAmount)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-xs">
            <Variation
              value={kpis.monthVariationPct}
              fallback={`Ref. ${formatMonthLabel(currentReferenceMonth)}`}
            />
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <div className={iconClass}>
          <Package className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <span className={labelClass}>Qtd. de Produtos</span>
          <p className={valueClass}>
            {new Intl.NumberFormat("pt-BR").format(kpis.totalItemsVolume)}{" "}
            <span className="text-xs font-normal text-inkMuted">un.</span>
          </p>
          <div className="mt-1 flex items-center gap-1 text-xs">
            <Variation
              value={kpis.itemsVariationPct}
              fallback="Unidades no mês"
            />
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <div className={iconClass}>
          <Store className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <span className={labelClass}>Lojas no Período</span>
          <p className={valueClass}>
            {monthRowsFilteredCount}{" "}
            <span className="text-xs font-normal text-inkMuted">
              / {storesCount || monthRowsAllStoresCount}
            </span>
          </p>
          <p className="mt-1 truncate text-xs text-brand/90">
            Unidades com pedido
          </p>
        </div>
      </div>

      <div className={cardClass}>
        <div className={iconClass}>
          <Award className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <span className={labelClass}>Maior Volume no Mês</span>
          {kpis.topStore ? (
            <>
              <p
                className="mt-0.5 truncate text-sm font-bold text-ink"
                title={kpis.topStore.store_name}
              >
                {kpis.topStore.store_name}
              </p>
              <p className="mt-1 truncate text-xs font-semibold text-brand">
                {formatCurrencyBRL(kpis.topStore.current_month_total)} •{" "}
                {kpis.topStore.total_items} un.
              </p>
            </>
          ) : (
            <>
              <p className="mt-0.5 text-base font-bold text-inkMuted">—</p>
              <p className="mt-1 text-xs text-inkMuted">Sem pedidos</p>
            </>
          )}
        </div>
      </div>

      <div className={cardClass}>
        <div
          className={cn(
            "flex h-13 w-13 shrink-0 items-center justify-center rounded-full border shadow-glow",
            kpis.alertStores.length > 0
              ? "border-danger/40 bg-danger/10 text-danger"
              : "border-brand/40 bg-brand/10 text-brand"
          )}
        >
          {kpis.alertStores.length > 0 ? (
            <AlertTriangle className="h-6 w-6" />
          ) : (
            <ShieldCheck className="h-6 w-6" />
          )}
        </div>
        <div className="min-w-0">
          <span className={labelClass}>Conformidade 3M</span>
          <p className={valueClass}>{kpis.complianceRate.toFixed(0)}%</p>
          <p
            className={cn(
              "mt-1 truncate text-xs font-semibold",
              kpis.alertStores.length > 0 ? "text-danger" : "text-success"
            )}
          >
            {kpis.alertStores.length > 0
              ? `${kpis.alertStores.length} loja(s) > +25%`
              : "Todas dentro da meta"}
          </p>
        </div>
      </div>
    </section>
  );
}
