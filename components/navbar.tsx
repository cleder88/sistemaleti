"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  FilePlus2,
  ShieldCheck,
  LogOut,
  Loader2,
  Menu,
  X,
  FileText,
  Package,
  Bell,
  Search,
  Sparkles,
  ChevronRight,
  Presentation,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { signOutClient } from "@/lib/auth/client-logout";
import { cn } from "@/lib/utils";
import { getCurrentMonthKey } from "@/lib/presentation";
import { useUrlContext } from "@/lib/use-url-context";

interface StoreSearchHit {
  id: string;
  name: string;
  code: string;
  city: string;
}

export function Navbar() {
  const pathname = usePathname();
  const { context: urlContext } = useUrlContext();
  const contextMonth = urlContext.month ?? getCurrentMonthKey();

  const [signingOut, setSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [storeHits, setStoreHits] = useState<StoreSearchHit[]>([]);
  const [productHits, setProductHits] = useState<string[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [alertMonth, setAlertMonth] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  const alertHref = alertMonth ? `/dashboard?mes=${alertMonth}` : "/dashboard";
  const buildStoreHitHref = (store: StoreSearchHit) =>
    `/lojas?q=${encodeURIComponent(store.name)}&loja=${store.id}`;
  const buildProductHitHref = (product: string) =>
    `/dashboard?produto=${encodeURIComponent(
      product
    )}&mes=${contextMonth}#curva-abc`;

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/apresentacao", label: "Apresentação", icon: Presentation, exact: true },
    { href: "/pedidos/novo", label: "Novo Pedido (PDF)", icon: FilePlus2 },
    { href: "/lojas", label: "Lojas da Rede", icon: Store },
    { href: "/dashboard#comparativo-itens", label: "Consumo & Produtos", icon: Package },
    { href: "/dashboard#central-relatorios", label: "Relatórios PDF", icon: FileText },
    { href: "/configuracoes", label: "Segurança (2FA)", icon: ShieldCheck },
  ];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 2) {
      setStoreHits([]);
      setProductHits([]);
      setSearching(false);
      return;
    }

    const sanitized = term
      .replace(/[%(),*\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);

    if (!sanitized) {
      setStoreHits([]);
      setProductHits([]);
      return;
    }

    let active = true;
    setSearching(true);

    const timer = setTimeout(async () => {
      try {
        const supabase = createClient();
        const [storesResult, itemsResult] = await Promise.all([
          supabase
            .from("stores")
            .select("id, name, code, city")
            .or(
              `name.ilike.%${sanitized}%,code.ilike.%${sanitized}%,city.ilike.%${sanitized}%`
            )
            .limit(5),
          supabase
            .from("order_items")
            .select("product_name")
            .ilike("product_name", `%${sanitized}%`)
            .limit(30),
        ]);

        if (!active) return;

        setStoreHits(
          (storesResult.data ?? []).map((row: Record<string, unknown>) => ({
            id: String(row.id ?? ""),
            name: String(row.name ?? ""),
            code: String(row.code ?? ""),
            city: String(row.city ?? ""),
          }))
        );

        setProductHits(
          Array.from(
            new Set(
              (itemsResult.data ?? [])
                .map((row: Record<string, unknown>) =>
                  String(row.product_name ?? "").trim()
                )
                .filter(Boolean)
            )
          ).slice(0, 5)
        );
      } catch {
        if (active) {
          setStoreHits([]);
          setProductHits([]);
        }
      } finally {
        if (active) setSearching(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchTerm]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const supabase = createClient();
        const { data, count } = await supabase
          .from("store_monthly_analytics")
          .select("reference_month", { count: "exact" })
          .eq("status", "alert")
          .order("reference_month", { ascending: false })
          .limit(1);

        if (active) {
          setAlertCount(count ?? 0);
          const latest = data?.[0] as Record<string, unknown> | undefined;
          const referenceMonth = String(latest?.reference_month ?? "").slice(
            0,
            7
          );
          setAlertMonth(/^\d{4}-\d{2}$/.test(referenceMonth) ? referenceMonth : null);
        }
      } catch {
        if (active) {
          setAlertCount(0);
          setAlertMonth(null);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);

    try {
      await signOutClient();
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <>
      {/* SIDEBAR LATERAL FIXA (DESKTOP) - Inspirada na referência Dark & Gold */}
      <aside
        id="app-sidebar"
        className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-amber-500/15 lg:bg-[#0b0b0e]"
      >
        {/* Logo / Marca no Topo da Sidebar */}
        <div className="flex h-20 items-center gap-3.5 border-b border-amber-500/15 px-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/25 via-amber-600/15 to-transparent text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <Store className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-base font-bold uppercase tracking-wider text-amber-400">
              SISTEMA LETI
            </span>
            <span className="block truncate text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Controle de Pedidos
            </span>
          </div>
        </div>

        {/* Navegação Vertical */}
        <nav
          aria-label="Navegação Principal"
          className="flex-1 space-y-1.5 overflow-y-auto px-4 py-6"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isHashLink = item.href.includes("#");
            const isActive = isHashLink
              ? false
              : item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center justify-between rounded-xl px-4 py-3 text-sm transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-[#f59e0b] via-[#eab308] to-[#d97706] font-bold text-black shadow-[0_4px_20px_rgba(245,158,11,0.3)]"
                    : "font-medium text-zinc-300 hover:bg-amber-500/10 hover:text-amber-300"
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-colors",
                      isActive
                        ? "text-black"
                        : "text-amber-400/80 group-hover:text-amber-300"
                    )}
                  />
                  <span>{item.label}</span>
                </span>
                {isActive && <ChevronRight className="h-4 w-4 text-black/70" />}
              </Link>
            );
          })}
        </nav>

        {/* Card Resumo + Botão Sair no Rodapé da Sidebar */}
        <div className="border-t border-amber-500/15 p-4">
          <div className="mb-3 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-[#141418] to-[#0e0e12] p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Painel Executivo</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              Monitoramento financeiro, volume de produtos e relatórios em PDF.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-amber-500/25 bg-[#141419] px-4 py-2.5 text-sm font-semibold text-zinc-200 transition-all hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
            ) : (
              <LogOut className="h-4 w-4 text-amber-400" />
            )}
            <span>{signingOut ? "A sair..." : "Sair do Sistema"}</span>
          </button>
        </div>
      </aside>

      {/* BARRA SUPERIOR (TOPBAR) - Inspirada na referência Dark & Gold */}
      <header className="sticky top-0 z-30 border-b border-amber-500/15 bg-[#0b0b0e]/95 backdrop-blur-md lg:pl-64">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Esquerda: Botão Mobile + Saudação Executiva */}
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex items-center justify-center rounded-xl border border-amber-500/25 bg-[#141419] p-2.5 text-amber-400 hover:bg-amber-500/10 lg:hidden"
              aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>

            <div>
              <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-white sm:text-lg">
                <span>Bem-vindo de volta!</span>
                <span aria-hidden="true">👋</span>
              </h2>
              <p className="hidden text-xs text-zinc-400 sm:block">
                Acompanhe o desempenho de pedidos, quantidades e gastos da sua rede hoje.
              </p>
            </div>
          </div>

          {/* Centro: Busca real em lojas e produtos */}
          <div
            ref={searchContainerRef}
            className="relative hidden max-w-md flex-1 md:block"
          >
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-400/70" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setSearchOpen(false);
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  const term = searchTerm.trim();
                  if (storeHits[0]) {
                    window.location.href = buildStoreHitHref(storeHits[0]);
                  } else if (productHits[0]) {
                    window.location.href = buildProductHitHref(productHits[0]);
                  } else if (term) {
                    window.location.href = `/lojas?q=${encodeURIComponent(
                      term
                    )}`;
                  }
                }
              }}
              placeholder="Pesquisar lojas e produtos..."
              aria-label="Pesquisar lojas e produtos"
              className="w-full rounded-xl border border-amber-500/20 bg-[#141419] py-2 pl-10 pr-4 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-amber-500/50 focus:outline-none"
            />

            {searchOpen && searchTerm.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-amber-500/20 bg-[#141419] shadow-2xl">
                {searching ? (
                  <div className="flex items-center gap-2 px-4 py-3 text-xs text-zinc-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                    Pesquisando...
                  </div>
                ) : storeHits.length === 0 && productHits.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-zinc-400">
                    Nenhum resultado encontrado.
                  </div>
                ) : (
                  <>
                    {storeHits.length > 0 && (
                      <div className="border-b border-amber-500/10 py-1.5">
                        <p className="px-4 py-1 text-xs font-bold uppercase tracking-wider text-amber-400/80">
                          Lojas
                        </p>
                        {storeHits.map((store) => (
                          <Link
                            key={store.id}
                            href={buildStoreHitHref(store)}
                            onClick={() => setSearchOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-xs text-zinc-200 hover:bg-amber-500/10"
                          >
                            <Store className="h-3.5 w-3.5 text-amber-400" />
                            <span className="truncate">{store.name}</span>
                            {store.code && (
                              <span className="ml-auto text-xs text-zinc-500">
                                {store.code}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}

                    {productHits.length > 0 && (
                      <div className="py-1.5">
                        <p className="px-4 py-1 text-xs font-bold uppercase tracking-wider text-amber-400/80">
                          Produtos
                        </p>
                        {productHits.map((product) => (
                          <Link
                            key={product}
                            href={buildProductHitHref(product)}
                            onClick={() => setSearchOpen(false)}
                            className="flex items-center gap-2 px-4 py-2 text-xs text-zinc-200 hover:bg-amber-500/10"
                          >
                            <Package className="h-3.5 w-3.5 text-amber-400" />
                            <span className="truncate">{product}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Direita: Notificação + Perfil Administrador + Botão Sair Mobile */}
          <div className="flex items-center gap-3">
            <Link
              href={alertHref}
              title={
                alertCount > 0
                  ? `${alertCount} loja(s) com desvio acima de 25%`
                  : "Sem alertas de desvio"
              }
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/25 bg-[#141419] text-amber-400 transition-colors hover:border-amber-500/50 hover:bg-amber-500/10"
            >
              <Bell className="h-4 w-4" />
              {alertCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-bold text-black">
                  {alertCount > 9 ? "9+" : alertCount}
                </span>
              )}
            </Link>

            <div className="hidden items-center gap-3 rounded-xl border border-amber-500/20 bg-[#141419] px-3 py-1.5 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/50 bg-gradient-to-br from-amber-400 to-amber-600 text-xs font-bold text-black">
                ADM
              </div>
              <div className="text-left">
                <p className="text-xs font-bold leading-none text-white">
                  Gestão da Rede
                </p>
                <p className="mt-0.5 text-xs font-medium text-amber-400/90">
                  Administrador
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              title="Sair"
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-[#141419] px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-amber-500/50 hover:text-amber-300 lg:hidden"
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
              ) : (
                <LogOut className="h-4 w-4 text-amber-400" />
              )}
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        {/* Menu Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="border-t border-amber-500/20 bg-[#0e0e12] px-4 py-4 shadow-2xl lg:hidden">
            <nav
              aria-label="Navegação Mobile"
              className="flex flex-col space-y-1.5"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isHashLink = item.href.includes("#");
                const isActive = isHashLink
                  ? false
                  : item.exact
                  ? pathname === item.href
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors",
                      isActive
                        ? "bg-gradient-to-r from-amber-500 to-amber-600 font-bold text-black"
                        : "font-medium text-zinc-300 hover:bg-amber-500/10 hover:text-amber-300"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        isActive ? "text-black" : "text-amber-400"
                      )}
                    />
                    {item.label}
                  </Link>
                );
              })}

              <div className="my-2 border-t border-amber-500/15 pt-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={signingOut}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {signingOut ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  <span>{signingOut ? "A terminar sessão..." : "Sair"}</span>
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
