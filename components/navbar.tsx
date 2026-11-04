"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Store,
  FilePlus2,
  LogOut,
  Loader2,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { signOutAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/lojas", label: "Lojas", icon: Store },
    { href: "/pedidos/novo", label: "Novo Pedido", icon: FilePlus2 },
  ];

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);

    try {
      // 1. Encerra sessão no cliente e limpa cookies no servidor (/api/auth/logout)
      const supabase = createClient();
      await supabase.auth.signOut();
      await fetch("/api/auth/logout", { method: "POST" });

      // 2. Limpa eventuais cookies acessíveis no navegador e invalida cache de rotas
      document.cookie.split(";").forEach((c) => {
        const cookieName = c.split("=")[0]?.trim();
        if (
          cookieName &&
          (cookieName.startsWith("sb-") || cookieName.includes("supabase"))
        ) {
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        }
      });

      await signOutAction();
    } catch {
      router.replace("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
      setMobileMenuOpen(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Store className="h-5 w-5" />
            </div>
            <span>Controle de Pedidos</span>
          </Link>

          {/* Links de navegação com espaçamento */}
          <nav
            aria-label="Navegação Principal"
            className="hidden items-center gap-2 md:flex"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Botão Sair alinhado à direita */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex"
          >
            {signingOut ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            <span>{signingOut ? "A sair..." : "Sair"}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-100 md:hidden"
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Menu Mobile */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 shadow-lg md:hidden">
          <nav
            aria-label="Navegação Mobile"
            className="flex flex-col space-y-1.5"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}

            <div className="my-2 border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
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
  );
}
