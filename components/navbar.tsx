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
} from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/pedidos/novo", label: "Novo Pedido (PDF)", icon: FilePlus2 },
    { href: "/lojas", label: "Lojas da Rede", icon: Store },
    { href: "/dashboard#comparativo-itens", label: "Consumo & Produtos", icon: Package },
    { href: "/dashboard#central-relatorios", label: "Relatórios PDF", icon: FileText },
    { href: "/configuracoes", label: "Segurança (2FA)", icon: ShieldCheck },
  ];

  const handleLogout = async () => {
    if (signingOut) return;
    setSigningOut(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();

      await fetch("/auth/logout", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
      });

      document.cookie.split(";").forEach((c) => {
        const cookieName = c.split("=")[0]?.trim();
        if (
          cookieName &&
          (cookieName.startsWith("sb-") ||
            cookieName.includes("supabase") ||
            cookieName.includes("auth-token"))
        ) {
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/`;
        }
      });
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
            <span className="block truncate text-base font-extrabold uppercase tracking-wider text-amber-400">
              SISTEMA LETI
            </span>
            <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
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
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
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

          {/* Centro: Barra de Busca Rápida (Visual da referência) */}
          <div className="hidden max-w-md flex-1 md:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-400/70" />
              <input
                type="search"
                placeholder="Pesquisar lojas, pedidos ou relatórios..."
                aria-label="Pesquisar no sistema"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = (e.currentTarget.value || "").toLowerCase();
                    if (val.includes("loja")) window.location.href = "/lojas";
                    else if (val.includes("novo") || val.includes("pdf"))
                      window.location.href = "/pedidos/novo";
                    else if (val.includes("seg") || val.includes("2fa"))
                      window.location.href = "/configuracoes";
                  }
                }}
                className="w-full rounded-xl border border-amber-500/20 bg-[#141419] py-2 pl-10 pr-4 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-amber-500/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Direita: Notificação + Perfil Administrador + Botão Sair Mobile */}
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard#central-relatorios"
              title="Central de Relatórios e Alertas"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/25 bg-[#141419] text-amber-400 transition-colors hover:border-amber-500/50 hover:bg-amber-500/10"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-extrabold text-black">
                !
              </span>
            </Link>

            <div className="hidden items-center gap-3 rounded-xl border border-amber-500/20 bg-[#141419] px-3 py-1.5 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/50 bg-gradient-to-br from-amber-400 to-amber-600 text-xs font-extrabold text-black">
                ADM
              </div>
              <div className="text-left">
                <p className="text-xs font-bold leading-none text-white">
                  Gestão da Rede
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-amber-400/90">
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
