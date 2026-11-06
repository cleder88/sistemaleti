"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Layers,
  Loader2,
  Package,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatCurrencyBRL,
  formatNumber,
  formatPercent,
  type PresentationBudgetRow,
  type PresentationBudgetStatus,
  type PresentationData,
  type PresentationProductRow,
  type PresentationRankingRow,
} from "@/lib/presentation";

interface MonthlyPresentationProps {
  data: PresentationData;
  loading?: boolean;
}

export function MonthlyPresentation({
  data,
  loading = false,
}: MonthlyPresentationProps) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef<number | null>(null);

  const slides = useMemo(
    () => [
      {
        id: "capa",
        label: "Capa",
        icon: Sparkles,
        content: <CoverSlide data={data} />,
      },
      {
        id: "panorama",
        label: "Panorama",
        icon: BarChart3,
        content: <OverviewSlide data={data} />,
      },
      {
        id: "ranking-valor",
        label: "Ranking por valor",
        icon: Award,
        content: <RankingByAmountSlide data={data} />,
      },
      {
        id: "ranking-volume",
        label: "Ranking por volume",
        icon: Layers,
        content: <RankingByItemsSlide data={data} />,
      },
      {
        id: "produtos",
        label: "Produtos",
        icon: Package,
        content: <ProductsSlide data={data} />,
      },
      {
        id: "comparativo",
        label: "Comparativo",
        icon: TrendingUp,
        content: <ComparisonSlide data={data} />,
      },
      {
        id: "alertas",
        label: "Alertas",
        icon: AlertTriangle,
        content: <AlertsSlide data={data} />,
      },
      {
        id: "orcamento",
        label: "Orçamento",
        icon: Wallet,
        content: <BudgetSlide data={data} />,
      },
      {
        id: "resumo",
        label: "Resumo",
        icon: CheckCircle2,
        content: <SummarySlide data={data} />,
      },
    ],
    [data]
  );

  const totalSlides = slides.length;
  const currentSlide = slides[index] ?? slides[0];
  const CurrentIcon = currentSlide.icon;

  const goTo = (nextIndex: number) => {
    setIndex(Math.min(Math.max(nextIndex, 0), totalSlides - 1));
  };

  const goPrevious = () => goTo(index - 1);
  const goNext = () => goTo(index + 1);

  useEffect(() => {
    setIndex(0);
  }, [data.monthKey]);

  useEffect(() => {
    setIndex((current) => Math.min(current, totalSlides - 1));
  }, [totalSlides]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setIndex((current) => Math.min(current + 1, totalSlides - 1));
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((current) => Math.max(current - 1, 0));
      } else if (event.key === "Home") {
        event.preventDefault();
        setIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setIndex(totalSlides - 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [totalSlides]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-[#0d0d11] shadow-[0_10px_50px_rgba(0,0,0,0.55)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/15 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
            <CurrentIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">
              {currentSlide.label}
            </p>
            <p className="truncate text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              {data.monthLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1.5 sm:flex">
            {slides.map((slide, slideIndex) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(slideIndex)}
                aria-label={`Ir para ${slide.label}`}
                title={slide.label}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  slideIndex === index
                    ? "w-7 bg-amber-400"
                    : "w-1.5 bg-zinc-700 hover:bg-amber-500/60"
                )}
              />
            ))}
          </div>
          <span className="rounded-full border border-amber-500/20 bg-[#141419] px-2.5 py-1 text-[11px] font-bold text-amber-300">
            {index + 1} / {totalSlides}
          </span>
        </div>
      </div>

      <div className="h-1 bg-zinc-900">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500"
          style={{ width: `${((index + 1) / totalSlides) * 100}%` }}
        />
      </div>

      <div
        className="relative h-[calc(100vh-17rem)] min-h-[520px] max-h-[760px] overflow-hidden"
        onTouchStart={(event) => {
          touchStart.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          if (touchStart.current === null) return;
          const distance =
            (event.changedTouches[0]?.clientX ?? touchStart.current) -
            touchStart.current;
          touchStart.current = null;
          if (Math.abs(distance) < 55) return;
          if (distance < 0) goNext();
          else goPrevious();
        }}
      >
        <div
          className="flex h-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide) => (
            <div
              key={slide.id}
              className="h-full w-full shrink-0 overflow-y-auto overscroll-contain"
            >
              {slide.content}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={goPrevious}
          disabled={index === 0}
          aria-label="Slide anterior"
          className="absolute left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-amber-500/30 bg-[#0b0b0e]/90 text-amber-300 shadow-xl backdrop-blur transition-colors hover:bg-amber-500/15 disabled:pointer-events-none disabled:opacity-0 sm:flex"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          type="button"
          onClick={goNext}
          disabled={index === totalSlides - 1}
          aria-label="Próximo slide"
          className="absolute right-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-amber-500/30 bg-[#0b0b0e]/90 text-amber-300 shadow-xl backdrop-blur transition-colors hover:bg-amber-500/15 disabled:pointer-events-none disabled:opacity-0 sm:flex"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#09090b]/80 backdrop-blur-sm">
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-[#141419] px-4 py-3 text-sm font-semibold text-amber-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparando apresentação...
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-amber-500/15 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={goPrevious}
          disabled={index === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-[#141419] px-3 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:border-amber-500/50 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>

        <div className="flex items-center gap-1.5 sm:hidden">
          {slides.map((slide, slideIndex) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => goTo(slideIndex)}
              aria-label={`Ir para ${slide.label}`}
              className={cn(
                "h-1.5 rounded-full transition-all",
                slideIndex === index
                  ? "w-6 bg-amber-400"
                  : "w-1.5 bg-zinc-700"
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={index === totalSlides - 1}
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-[#141421] px-3 py-2 text-xs font-semibold text-zinc-200 transition-colors hover:border-amber-500/50 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Próximo
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SlideHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-400">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-xs text-zinc-400">{subtitle}</p>}
    </div>
  );
}

function DeltaBadge({
  value,
  invert = false,
}: {
  value: number | null;
  invert?: boolean;
}) {
  if (value === null || !Number.isFinite(value)) {
    return (
      <span className="text-[11px] font-medium text-zinc-500">
        Sem base anterior
      </span>
    );
  }

  const positive = value >= 0;
  const good = invert ? !positive : positive;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold",
        good
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-red-500/10 text-red-400"
      )}
    >
      {positive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {formatPercent(value)}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "gold",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: "gold" | "green" | "red";
}) {
  return (
    <div className="rounded-2xl border border-amber-500/15 bg-gradient-to-b from-[#16161d] to-[#111116] p-4 shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
            tone === "red"
              ? "border-red-500/40 bg-red-500/10 text-red-400"
              : tone === "green"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : "border-amber-500/40 bg-amber-500/10 text-amber-400"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          {label}
        </span>
      </div>
      <p className="mt-3 truncate text-xl font-extrabold text-white">{value}</p>
      {hint && <div className="mt-1.5 text-[11px]">{hint}</div>}
    </div>
  );
}

function EmptyState({
  icon: Icon = Package,
  title,
  description,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-500/20 bg-[#121217] px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-sm font-bold text-white">{title}</p>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-400">
        {description}
      </p>
    </div>
  );
}

function CoverSlide({ data }: { data: PresentationData }) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-6 py-10 text-center">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-amber-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-amber-600/10 blur-3xl" />

      <span className="relative inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300">
        <Sparkles className="h-3.5 w-3.5" />
        Apresentação Executiva
      </span>

      <h2 className="relative mt-6 text-4xl font-black tracking-tight text-white sm:text-6xl">
        {data.monthLabel}
      </h2>
      <p className="relative mt-2 text-sm font-medium text-zinc-400">
        Controle de Pedidos • Rede de Lojas
      </p>

      <div className="relative mt-9 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-500/20 bg-[#121217]/85 p-4 text-left">
          <DollarSign className="h-5 w-5 text-amber-400" />
          <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Total em pedidos
          </p>
          <p className="mt-1 truncate text-lg font-extrabold text-white">
            {formatCurrencyBRL(data.totalAmount)}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-[#121217]/85 p-4 text-left">
          <Package className="h-5 w-5 text-amber-400" />
          <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Volume de itens
          </p>
          <p className="mt-1 truncate text-lg font-extrabold text-white">
            {formatNumber(data.totalItems)}{" "}
            <span className="text-xs font-normal text-zinc-400">un.</span>
          </p>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-[#121217]/85 p-4 text-left">
          <Store className="h-5 w-5 text-amber-400" />
          <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Lojas com pedido
          </p>
          <p className="mt-1 truncate text-lg font-extrabold text-white">
            {data.storesWithOrders}{" "}
            <span className="text-xs font-normal text-zinc-400">
              / {data.totalStores}
            </span>
          </p>
        </div>
      </div>

      <p className="relative mt-9 text-[11px] text-zinc-500">
        Use as setas laterais, os botões abaixo ou o teclado (← →) para
        navegar.
      </p>
    </div>
  );
}

function OverviewSlide({ data }: { data: PresentationData }) {
  const topStore = data.rankingByAmount[0];
  const topProduct = data.topProductsByAmount[0];

  return (
    <div className="p-5 sm:p-7">
      <SlideHeading
        eyebrow="Panorama"
        title="Indicadores do mês"
        subtitle={`Consolidado de ${data.storesWithOrders} loja(s) com pedidos em ${data.monthLabel}.`}
      />

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={DollarSign}
          label="Total em pedidos"
          value={formatCurrencyBRL(data.totalAmount)}
          hint={<DeltaBadge value={data.amountVariationPct} />}
        />
        <StatCard
          icon={Package}
          label="Volume de itens"
          value={`${formatNumber(data.totalItems)} un.`}
          hint={<DeltaBadge value={data.itemsVariationPct} />}
        />
        <StatCard
          icon={Store}
          label="Lojas com pedido"
          value={`${data.storesWithOrders} / ${data.totalStores}`}
          hint={
            <span className="text-zinc-500">
              {data.totalStores > 0
                ? `${((data.storesWithOrders / data.totalStores) * 100).toFixed(
                    0
                  )}% da rede`
                : "Sem lojas cadastradas"}
            </span>
          }
        />
        <StatCard
          icon={BarChart3}
          label="Ticket médio por loja"
          value={formatCurrencyBRL(data.averagePerStore)}
          hint={
            <span className="text-zinc-500">Média de valor por loja</span>
          }
        />
        <StatCard
          icon={Layers}
          label="Itens por loja"
          value={`${formatNumber(data.averageItemsPerStore)} un.`}
          hint={
            <span className="text-zinc-500">Média de unidades por loja</span>
          }
        />
        <StatCard
          icon={data.alerts.length > 0 ? AlertTriangle : ShieldCheck}
          label="Conformidade"
          value={`${data.complianceRate.toFixed(0)}%`}
          tone={data.alerts.length > 0 ? "red" : "green"}
          hint={
            <span
              className={cn(
                "font-semibold",
                data.alerts.length > 0 ? "text-red-400" : "text-emerald-400"
              )}
            >
              {data.alerts.length > 0
                ? `${data.alerts.length} loja(s) acima de +25%`
                : "Todas dentro da meta"}
            </span>
          }
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-amber-500/15 bg-[#121217] p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Comparativo com {data.previousMonthLabel}
            </p>
            <TrendingUp className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Valor anterior
              </p>
              <p className="mt-0.5 text-sm font-bold text-white">
                {formatCurrencyBRL(data.previousAmount)}
              </p>
              <div className="mt-1">
                <DeltaBadge value={data.amountVariationPct} />
              </div>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Itens anteriores
              </p>
              <p className="mt-0.5 text-sm font-bold text-white">
                {formatNumber(data.previousItems)} un.
              </p>
              <div className="mt-1">
                <DeltaBadge value={data.itemsVariationPct} />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/15 bg-[#121217] p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Destaques do mês
            </p>
            <Award className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3 space-y-2.5">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Maior valor
              </p>
              <p className="truncate text-sm font-bold text-white">
                {topStore ? topStore.storeName : "Sem pedidos"}
              </p>
              {topStore && (
                <p className="text-[11px] text-amber-300">
                  {formatCurrencyBRL(topStore.amount)} •{" "}
                  {topStore.sharePct.toFixed(1).replace(".", ",")}% do total
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Produto de maior valor
              </p>
              <p className="truncate text-sm font-bold text-white">
                {topProduct ? topProduct.name : "Sem itens no período"}
              </p>
              {topProduct && (
                <p className="text-[11px] text-amber-300">
                  {formatCurrencyBRL(topProduct.amount)} •{" "}
                  {formatNumber(topProduct.quantity)} un.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RankBadge({ position }: { position: number }) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black",
        position === 0
          ? "bg-amber-400 text-black"
          : position === 1
          ? "bg-zinc-300 text-black"
          : position === 2
          ? "bg-amber-700 text-white"
          : "bg-zinc-800 text-zinc-400"
      )}
    >
      {position + 1}
    </span>
  );
}

function RankingByAmountSlide({ data }: { data: PresentationData }) {
  return (
    <div className="p-5 sm:p-7">
      <SlideHeading
        eyebrow="Ranking"
        title="Lojas por valor de compra"
        subtitle={`${data.rankingByAmount.length} loja(s) com pedidos • total de ${formatCurrencyBRL(
          data.totalAmount
        )}.`}
      />

      {data.rankingByAmount.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="Nenhum pedido neste mês"
            description="Não há lojas com pedidos registrados no período selecionado."
          />
        </div>
      ) : (
        <div className="mt-5 space-y-2.5">
          {data.rankingByAmount.map((row, position) => (
            <RankingAmountRow key={row.storeId} row={row} position={position} />
          ))}
        </div>
      )}
    </div>
  );
}

function RankingAmountRow({
  row,
  position,
}: {
  row: PresentationRankingRow;
  position: number;
}) {
  return (
    <div className="rounded-xl border border-amber-500/10 bg-[#121217] p-3">
      <div className="flex items-center gap-3">
        <RankBadge position={position} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p
              className="truncate text-sm font-bold text-white"
              title={row.storeName}
            >
              {row.storeName}
              {row.storeCode && (
                <span className="ml-1.5 text-[10px] font-medium text-zinc-500">
                  ({row.storeCode})
                </span>
              )}
            </p>
            <span className="shrink-0 text-sm font-extrabold text-amber-300">
              {formatCurrencyBRL(row.amount)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
            <span>
              {row.storeCity || "Cidade não informada"} •{" "}
              {formatNumber(row.items)} un.
            </span>
            <span className="flex items-center gap-2">
              <span className="text-zinc-500">
                {row.sharePct.toFixed(1).replace(".", ",")}% do total
              </span>
              <span
                className={cn(
                  "font-bold",
                  row.diffPct > 25 ? "text-red-400" : "text-zinc-400"
                )}
              >
                {formatPercent(row.diffPct)} vs média 3M
              </span>
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
              style={{
                width: `${Math.max(2, Math.min(100, row.sharePct))}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function RankingByItemsSlide({ data }: { data: PresentationData }) {
  return (
    <div className="p-5 sm:p-7">
      <SlideHeading
        eyebrow="Ranking"
        title="Lojas por volume de itens"
        subtitle={`${formatNumber(
          data.totalItems
        )} unidades compradas no mês em ${data.storesWithOrders} loja(s).`}
      />

      {data.rankingByItems.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="Nenhum volume registrado"
            description="Não há itens de pedido para o período selecionado."
          />
        </div>
      ) : (
        <div className="mt-5 space-y-2.5">
          {data.rankingByItems.map((row, position) => (
            <div
              key={row.storeId}
              className="rounded-xl border border-amber-500/10 bg-[#121217] p-3"
            >
              <div className="flex items-center gap-3">
                <RankBadge position={position} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p
                      className="truncate text-sm font-bold text-white"
                      title={row.storeName}
                    >
                      {row.storeName}
                      {row.storeCode && (
                        <span className="ml-1.5 text-[10px] font-medium text-zinc-500">
                          ({row.storeCode})
                        </span>
                      )}
                    </p>
                    <span className="shrink-0 text-sm font-extrabold text-amber-300">
                      {formatNumber(row.items)} un.
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
                    <span>
                      {row.itemsSharePct.toFixed(1).replace(".", ",")}% do
                      volume total
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-zinc-500">vs mês ant.:</span>
                      <DeltaBadge value={row.itemsVariationPct} />
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                      style={{
                        width: `${Math.max(
                          2,
                          Math.min(100, row.itemsSharePct)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductsSlide({ data }: { data: PresentationData }) {
  return (
    <div className="p-5 sm:p-7">
      <SlideHeading
        eyebrow="Produtos"
        title="Itens em destaque"
        subtitle={`${data.uniqueProducts} produto(s) distinto(s) identificados no mês.`}
      />

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <ProductList
          title="Top 5 por valor"
          rows={data.topProductsByAmount}
          metric="amount"
        />
        <ProductList
          title="Top 5 por quantidade"
          rows={data.topProductsByQuantity}
          metric="quantity"
        />
      </div>
    </div>
  );
}

function ProductList({
  title,
  rows,
  metric,
}: {
  title: string;
  rows: PresentationProductRow[];
  metric: "amount" | "quantity";
}) {
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);

  return (
    <div className="rounded-2xl border border-amber-500/15 bg-[#121217] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
          {title}
        </h3>
        <Package className="h-4 w-4 text-amber-400/70" />
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-xs text-zinc-500">Sem produtos no período.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {rows.map((row, position) => {
            const sharePct =
              metric === "amount"
                ? row.sharePct
                : totalQuantity > 0
                ? (row.quantity / totalQuantity) * 100
                : 0;

            return (
              <div key={`${row.name}-${position}`}>
                <div className="flex items-center gap-2">
                  <span className="w-4 shrink-0 text-[10px] font-bold text-zinc-500">
                    {position + 1}
                  </span>
                  <p
                    className="min-w-0 flex-1 truncate text-xs font-semibold text-white"
                    title={row.name}
                  >
                    {row.name}
                  </p>
                  <span className="shrink-0 text-xs font-extrabold text-amber-300">
                    {metric === "amount"
                      ? formatCurrencyBRL(row.amount)
                      : `${formatNumber(row.quantity)} un.`}
                  </span>
                </div>
                <div className="ml-6 mt-1 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300"
                      style={{
                        width: `${Math.max(2, Math.min(100, sharePct))}%`,
                      }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-[10px] text-zinc-500">
                    {row.storesCount} loja(s)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ComparisonSlide({ data }: { data: PresentationData }) {
  return (
    <div className="p-5 sm:p-7">
      <SlideHeading
        eyebrow="Comparativo"
        title={`${data.monthLabel} vs ${data.previousMonthLabel}`}
        subtitle="Variação de valor e volume por loja em relação ao mês anterior."
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-amber-500/15 bg-[#121217] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Valor total
          </p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div>
              <p className="text-lg font-extrabold text-white">
                {formatCurrencyBRL(data.totalAmount)}
              </p>
              <p className="text-[11px] text-zinc-500">
                Anterior: {formatCurrencyBRL(data.previousAmount)}
              </p>
            </div>
            <DeltaBadge value={data.amountVariationPct} />
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/15 bg-[#121217] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Volume de itens
          </p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div>
              <p className="text-lg font-extrabold text-white">
                {formatNumber(data.totalItems)} un.
              </p>
              <p className="text-[11px] text-zinc-500">
                Anterior: {formatNumber(data.previousItems)} un.
              </p>
            </div>
            <DeltaBadge value={data.itemsVariationPct} />
          </div>
        </div>
      </div>

      {data.rankingByAmount.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Sem dados para comparar"
            description="Não há pedidos no mês selecionado para montar o comparativo."
          />
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-amber-500/15">
          <table className="min-w-[680px] w-full border-collapse text-left text-xs">
            <thead className="bg-[#16161d] text-[10px] uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2.5 font-bold">Loja</th>
                <th className="px-3 py-2.5 text-right font-bold">Valor atual</th>
                <th className="px-3 py-2.5 text-right font-bold">
                  Valor anterior
                </th>
                <th className="px-3 py-2.5 text-right font-bold">Itens</th>
                <th className="px-3 py-2.5 text-right font-bold">Variação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-500/10">
              {data.rankingByAmount.map((row) => (
                <tr key={row.storeId} className="bg-[#121217]">
                  <td className="px-3 py-2.5">
                    <p className="font-semibold text-white">{row.storeName}</p>
                    <p className="text-[10px] text-zinc-500">
                      {row.storeCode || "—"} • {row.storeCity || "—"}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-amber-300">
                    {formatCurrencyBRL(row.amount)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-zinc-400">
                    {row.previousAmount === null
                      ? "—"
                      : formatCurrencyBRL(row.previousAmount)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-zinc-300">
                    {formatNumber(row.items)} un.
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <DeltaBadge value={row.variationPct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AlertsSlide({ data }: { data: PresentationData }) {
  return (
    <div className="p-5 sm:p-7">
      <SlideHeading
        eyebrow="Atenção"
        title="Desvios acima de +25%"
        subtitle="Comparação do valor comprado no mês com a média histórica da loja."
      />

      {data.alerts.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={ShieldCheck}
            title="Nenhuma loja acima do limite"
            description="Todas as lojas ficaram dentro da faixa de conformidade de ±25% da média histórica. Nenhuma ação corretiva é necessária neste momento."
          />
        </div>
      ) : (
        <div className="mt-5 space-y-2.5">
          {data.alerts.map((row, position) => {
            const overage = row.amount - row.historicalAvg;
            return (
              <div
                key={row.storeId}
                className="rounded-xl border border-red-500/20 bg-red-500/5 p-3"
              >
                <div className="flex items-start gap-3">
                  <RankBadge position={position} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p
                        className="truncate text-sm font-bold text-white"
                        title={row.storeName}
                      >
                        {row.storeName}
                        {row.storeCode && (
                          <span className="ml-1.5 text-[10px] font-medium text-zinc-500">
                            ({row.storeCode})
                          </span>
                        )}
                      </p>
                      <span className="rounded-md bg-red-500/15 px-2 py-0.5 text-[11px] font-bold text-red-300">
                        {formatPercent(row.diffPct)} acima da média
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400">
                      <span>
                        Atual:{" "}
                        <strong className="text-white">
                          {formatCurrencyBRL(row.amount)}
                        </strong>
                      </span>
                      <span>
                        Média 3M:{" "}
                        <strong className="text-zinc-300">
                          {formatCurrencyBRL(row.historicalAvg)}
                        </strong>
                      </span>
                      <span>
                        Excesso:{" "}
                        <strong className="text-red-300">
                          {formatCurrencyBRL(overage)}
                        </strong>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-red-500/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-500 to-amber-400"
                        style={{
                          width: `${Math.max(
                            2,
                            Math.min(100, row.diffPct)
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function budgetStatusLabel(status: PresentationBudgetStatus): string {
  if (status === "exceeded") return "Teto ultrapassado";
  if (status === "warning") return "Próximo do limite";
  if (status === "ok") return "Dentro do teto";
  return "Não configurado";
}

function BudgetSlide({ data }: { data: PresentationData }) {
  const configured = data.budgets.filter(
    (row) => row.status !== "unconfigured"
  );

  return (
    <div className="p-5 sm:p-7">
      <SlideHeading
        eyebrow="Orçamento"
        title="Uso dos tetos mensais"
        subtitle="Acompanhamento dos limites de valor e de itens configurados por loja."
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-300">
          {data.budgetExceededCount} ultrapassado(s)
        </span>
        <span className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-300">
          {data.budgetWarningCount} próximo(s) do limite
        </span>
        <span className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
          {Math.max(
            data.budgetConfiguredCount -
              data.budgetExceededCount -
              data.budgetWarningCount,
            0
          )}{" "}
          dentro do teto
        </span>
      </div>

      {configured.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon={Target}
            title="Nenhum teto de orçamento configurado"
            description="Configure o orçamento mensal e o limite de itens por loja no Dashboard para acompanhar o uso nesta apresentação."
          />
        </div>
      ) : (
        <div className="mt-5 space-y-2.5">
          {configured.map((row) => (
            <BudgetRow key={row.storeId} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function BudgetRow({ row }: { row: PresentationBudgetRow }) {
  const statusClasses =
    row.status === "exceeded"
      ? "border-red-500/30 bg-red-500/10 text-red-300"
      : row.status === "warning"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

  return (
    <div className="rounded-xl border border-amber-500/10 bg-[#121217] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className="truncate text-sm font-bold text-white"
          title={row.storeName}
        >
          {row.storeName}
          {row.storeCode && (
            <span className="ml-1.5 text-[10px] font-medium text-zinc-500">
              ({row.storeCode})
            </span>
          )}
        </p>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 text-[10px] font-bold",
            statusClasses
          )}
        >
          {budgetStatusLabel(row.status)}
        </span>
      </div>

      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        {row.budget > 0 && (
          <UsageBar
            label={`Valor: ${formatCurrencyBRL(row.amount)} / ${formatCurrencyBRL(
              row.budget
            )}`}
            pct={row.budgetUsagePct ?? 0}
            tone={row.status === "exceeded" ? "red" : "gold"}
          />
        )}
        {row.itemsLimit > 0 && (
          <UsageBar
            label={`Itens: ${formatNumber(row.items)} / ${formatNumber(
              row.itemsLimit
            )} un.`}
            pct={row.itemsUsagePct ?? 0}
            tone={row.status === "exceeded" ? "red" : "gold"}
          />
        )}
      </div>
    </div>
  );
}

function UsageBar({
  label,
  pct,
  tone,
}: {
  label: string;
  pct: number;
  tone: "gold" | "red";
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-400">
        <span className="truncate">{label}</span>
        <span className="shrink-0 font-bold text-zinc-300">
          {pct.toFixed(0)}%
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r",
            tone === "red"
              ? "from-red-500 to-amber-400"
              : "from-amber-500 to-amber-300"
          )}
          style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

function SummarySlide({ data }: { data: PresentationData }) {
  return (
    <div className="p-5 sm:p-7">
      <SlideHeading
        eyebrow="Conclusão"
        title="Resumo executivo"
        subtitle={`Principais leituras de ${data.monthLabel}.`}
      />

      <div className="mt-5 space-y-2.5">
        {data.highlights.map((highlight, position) => (
          <div
            key={`${position}-${highlight.slice(0, 24)}`}
            className="flex items-start gap-3 rounded-xl border border-amber-500/15 bg-[#121217] p-3"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-[11px] font-black text-amber-300">
              {position + 1}
            </span>
            <p className="text-xs leading-relaxed text-zinc-300">
              {highlight}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Próximos passos sugeridos
          </p>
        </div>
        <ul className="mt-2.5 list-disc space-y-1.5 pl-5 text-[11px] leading-relaxed text-zinc-400">
          <li>
            Revisar as lojas com desvio acima de 25% e validar os pedidos do
            mês.
          </li>
          <li>
            Comparar os produtos de maior valor com o histórico para negociar
            melhores condições.
          </li>
          <li>
            Acompanhar o uso dos tetos de orçamento no Dashboard e ajustar os
            limites quando necessário.
          </li>
        </ul>
      </div>
    </div>
  );
}
