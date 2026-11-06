"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Store,
  Plus,
  Pencil,
  Power,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  MapPin,
  Hash,
  Building2,
  DollarSign,
  Package,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/navbar";
import { cn } from "@/lib/utils";
import { storeSchema } from "@/lib/validations";
import {
  getSavedStoreBudgetsMap,
  saveStoreBudgetLocal,
} from "@/lib/store-budgets";

export interface StoreRecord {
  id: string;
  name: string;
  code: string;
  city: string;
  status: "active" | "inactive";
  monthly_budget: number;
  monthly_items_limit: number;
  created_at?: string;
}

interface ToastMessage {
  id: number;
  type: "success" | "error";
  text: string;
}

interface StoreFormData {
  name: string;
  code: string;
  city: string;
  status: "active" | "inactive";
  monthly_budget: string;
  monthly_items_limit: string;
}

const initialFormState: StoreFormData = {
  name: "",
  code: "",
  city: "",
  status: "active",
  monthly_budget: "",
  monthly_items_limit: "",
};

// Normaliza registros vindos do Supabase independentemente de variações de coluna
function normalizeStore(row: Record<string, unknown>): StoreRecord {
  const rawStatus = row.status ?? row.is_active ?? row.active;
  let normalizedStatus: "active" | "inactive" = "active";

  if (typeof rawStatus === "boolean") {
    normalizedStatus = rawStatus ? "active" : "inactive";
  } else if (typeof rawStatus === "string") {
    const lower = rawStatus.toLowerCase();
    normalizedStatus =
      lower === "inactive" ||
      lower === "inativa" ||
      lower === "inativo" ||
      lower === "false"
        ? "inactive"
        : "active";
  }

  const id = String(row.id ?? "");
  const localMap = getSavedStoreBudgetsMap();
  const localBudget = id ? localMap[id] : undefined;

  const dbBudget = Number(row.monthly_budget ?? row.budget ?? NaN);
  const dbItemsLimit = Number(
    row.monthly_items_limit ?? row.items_limit ?? NaN
  );

  return {
    id,
    name: String(row.name ?? row.nome ?? ""),
    code: String(row.code ?? row.codigo ?? ""),
    city: String(row.city ?? row.cidade ?? ""),
    status: normalizedStatus,
    monthly_budget: Number.isFinite(dbBudget)
      ? dbBudget
      : localBudget?.monthly_budget ?? 0,
    monthly_items_limit: Number.isFinite(dbItemsLimit)
      ? dbItemsLimit
      : localBudget?.monthly_items_limit ?? 0,
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

export default function LojasPage() {
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Estado do Modal (criar / editar)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreRecord | null>(null);
  const [formData, setFormData] = useState<StoreFormData>(initialFormState);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Toasts de feedback visual
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: "success" | "error", text: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        showToast(
          "error",
          `Erro ao carregar lojas: ${error.message}`
        );
        return;
      }

      const normalized = (data ?? []).map((item) =>
        normalizeStore(item as Record<string, unknown>)
      );
      setStores(normalized);
    } catch {
      showToast("error", "Falha inesperada ao buscar as lojas cadastradas.");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  function openCreateModal() {
    setEditingStore(null);
    setFormData(initialFormState);
    setIsModalOpen(true);
  }

  function openEditModal(store: StoreRecord) {
    setEditingStore(store);
    setFormData({
      name: store.name,
      code: store.code,
      city: store.city,
      status: store.status,
      monthly_budget:
        store.monthly_budget > 0 ? String(store.monthly_budget) : "",
      monthly_items_limit:
        store.monthly_items_limit > 0 ? String(store.monthly_items_limit) : "",
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setIsModalOpen(false);
    setEditingStore(null);
    setFormData(initialFormState);
  }

  async function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = storeSchema.safeParse(formData);
    if (!validation.success) {
      const firstError =
        validation.error.issues[0]?.message ||
        "Dados inválidos para o cadastro da loja.";
      showToast("error", firstError);
      return;
    }

    setSubmitting(true);

    try {
      if (editingStore) {
        const response = await fetch("/api/stores", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingStore.id,
            ...validation.data,
          }),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          showToast(
            "error",
            result.error || "Não foi possível atualizar a loja."
          );
          return;
        }

        saveStoreBudgetLocal(editingStore.id, {
          monthly_budget: validation.data.monthly_budget ?? 0,
          monthly_items_limit: validation.data.monthly_items_limit ?? 0,
        });

        const updated = normalizeStore({
          ...editingStore,
          ...((result.data as Record<string, unknown>) ?? {}),
          monthly_budget: validation.data.monthly_budget ?? 0,
          monthly_items_limit: validation.data.monthly_items_limit ?? 0,
        });
        setStores((prev) =>
          prev.map((item) => (item.id === editingStore.id ? updated : item))
        );
        showToast("success", `Loja "${updated.name}" atualizada com sucesso!`);
      } else {
        const response = await fetch("/api/stores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validation.data),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          showToast(
            "error",
            result.error || "Não foi possível cadastrar a loja."
          );
          return;
        }

        const rawCreated =
          (result.data as Record<string, unknown>) ?? validation.data;
        const createdId = String(rawCreated.id ?? "");
        if (createdId) {
          saveStoreBudgetLocal(createdId, {
            monthly_budget: validation.data.monthly_budget ?? 0,
            monthly_items_limit: validation.data.monthly_items_limit ?? 0,
          });
        }

        const created = normalizeStore({
          ...rawCreated,
          monthly_budget: validation.data.monthly_budget ?? 0,
          monthly_items_limit: validation.data.monthly_items_limit ?? 0,
        });
        setStores((prev) =>
          [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
        );
        showToast("success", `Loja "${created.name}" cadastrada com sucesso!`);
      }

      setIsModalOpen(false);
      setEditingStore(null);
      setFormData(initialFormState);
    } catch {
      showToast("error", "Erro de comunicação ao salvar a loja.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(store: StoreRecord) {
    const newStatus: "active" | "inactive" =
      store.status === "active" ? "inactive" : "active";

    setTogglingId(store.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("stores")
        .update({ status: newStatus })
        .eq("id", store.id);

      if (error) {
        showToast(
          "error",
          `Erro ao alterar status da loja "${store.name}": ${error.message}`
        );
        return;
      }

      setStores((prev) =>
        prev.map((item) =>
          item.id === store.id ? { ...item, status: newStatus } : item
        )
      );

      showToast(
        "success",
        newStatus === "active"
          ? `Loja "${store.name}" ativada com sucesso.`
          : `Loja "${store.name}" desativada com sucesso.`
      );
    } catch {
      showToast("error", "Erro inesperado ao atualizar status da loja.");
    } finally {
      setTogglingId(null);
    }
  }

  const filteredStores = stores.filter((store) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      store.name.toLowerCase().includes(q) ||
      store.code.toLowerCase().includes(q) ||
      store.city.toLowerCase().includes(q)
    );
  });

  return (
    <div className="dark-gold-page min-h-screen bg-[#09090b] text-zinc-100">
      <Navbar />

      {/* Toast Container */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "flex items-start justify-between gap-3 rounded-xl border p-4 shadow-lg transition-all",
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            )}
          >
            <div className="flex items-start gap-2.5">
              {toast.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              )}
              <p className="text-sm font-medium">{toast.text}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="rounded-lg p-1 text-slate-400 hover:bg-black/5 hover:text-slate-600"
              aria-label="Fechar notificação"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:pl-72 lg:pr-8">
        {/* Cabeçalho */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-amber-400">
              Gestão de Lojas
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Cadastre, edite e gerencie o status das unidades no sistema.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-bold text-black shadow-[0_4px_20px_rgba(245,158,11,0.25)] transition-all hover:from-amber-400 hover:to-amber-500"
          >
            <Plus className="h-4 w-4" />
            Nova Loja
          </button>
        </div>

        {/* Barra de busca e resumo */}
        <div className="mt-6 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, código ou cidade..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-slate-900 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
            <span>
              Total: <strong className="text-slate-900">{stores.length}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Ativas: {stores.filter((s) => s.status === "active").length}
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              Inativas: {stores.filter((s) => s.status === "inactive").length}
            </span>
          </div>
        </div>

        {/* Tabela de Lojas */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Loader2 className="h-7 w-7 animate-spin text-slate-700" />
              <p className="mt-3 text-sm">Carregando lojas cadastradas...</p>
            </div>
          ) : filteredStores.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <Store className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-slate-900">
                {searchQuery
                  ? "Nenhuma loja encontrada para sua busca"
                  : "Nenhuma loja cadastrada"}
              </h2>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                {searchQuery
                  ? "Tente alterar os termos de pesquisa ou limpar o filtro."
                  : "Comece adicionando a primeira loja clicando no botão Nova Loja."}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Loja
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-3.5">Nome</th>
                    <th className="px-6 py-3.5">Código</th>
                    <th className="px-6 py-3.5">Cidade</th>
                    <th className="px-6 py-3.5">Teto / Meta Mensal</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredStores.map((store) => {
                    const isActive = store.status === "active";
                    const isToggling = togglingId === store.id;

                    return (
                      <tr
                        key={store.id}
                        className="transition-colors hover:bg-slate-50/80"
                      >
                        <td className="px-6 py-4 font-medium text-slate-900">
                          {store.name}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-medium text-slate-700">
                            {store.code}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {store.city}
                        </td>
                        <td className="px-6 py-4">
                          {store.monthly_budget > 0 ||
                          store.monthly_items_limit > 0 ? (
                            <div className="space-y-0.5 text-xs">
                              {store.monthly_budget > 0 && (
                                <div className="font-bold text-amber-400">
                                  {new Intl.NumberFormat("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  }).format(store.monthly_budget)}
                                </div>
                              )}
                              {store.monthly_items_limit > 0 && (
                                <div className="text-zinc-400">
                                  Até{" "}
                                  {store.monthly_items_limit.toLocaleString(
                                    "pt-BR"
                                  )}{" "}
                                  unid./mês
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-500">
                              Sem limite definido
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                              isActive
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                isActive ? "bg-emerald-500" : "bg-slate-400"
                              )}
                            />
                            {isActive ? "Ativa" : "Inativa"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(store)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </button>

                            <button
                              type="button"
                              disabled={isToggling}
                              onClick={() => handleToggleStatus(store)}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                                isActive
                                  ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                              )}
                            >
                              {isToggling ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Power className="h-3.5 w-3.5" />
                              )}
                              {isActive ? "Desativar" : "Ativar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal de Criar / Editar Loja */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-store-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h2
                    id="modal-store-title"
                    className="text-lg font-bold text-slate-900"
                  >
                    {editingStore ? "Editar Loja" : "Nova Loja"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {editingStore
                      ? "Atualize os dados da loja selecionada"
                      : "Preencha as informações para cadastrar a loja"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Fechar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="store-name"
                  className="block text-sm font-medium text-slate-700"
                >
                  Nome da Loja
                </label>
                <div className="relative mt-1.5">
                  <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="store-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Ex: Matriz Centro"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="store-code"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Código
                  </label>
                  <div className="relative mt-1.5">
                    <Hash className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="store-code"
                      type="text"
                      required
                      value={formData.code}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          code: e.target.value,
                        }))
                      }
                      placeholder="Ex: LJ01"
                      className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm uppercase text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="store-city"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Cidade
                  </label>
                  <div className="relative mt-1.5">
                    <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="store-city"
                      type="text"
                      required
                      value={formData.city}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          city: e.target.value,
                        }))
                      }
                      placeholder="Ex: São Paulo"
                      className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                </div>
              </div>

              {/* Teto de Orçamento Mensal (Meta / Budget por Loja) */}
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-amber-500/20 bg-slate-50 p-3.5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="store-budget"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Teto de Orçamento Mensal (R$)
                  </label>
                  <div className="relative mt-1.5">
                    <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-400" />
                    <input
                      id="store-budget"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.monthly_budget}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          monthly_budget: e.target.value,
                        }))
                      }
                      placeholder="Ex: 5000.00 (0 = livre)"
                      className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="store-items-limit"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Limite Mensal de Produtos (Unid.)
                  </label>
                  <div className="relative mt-1.5">
                    <Package className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-400" />
                    <input
                      id="store-items-limit"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.monthly_items_limit}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          monthly_items_limit: e.target.value,
                        }))
                      }
                      placeholder="Ex: 300 (0 = livre)"
                      className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="store-status"
                  className="block text-sm font-medium text-slate-700"
                >
                  Status
                </label>
                <select
                  id="store-status"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: e.target.value as "active" | "inactive",
                    }))
                  }
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  <option value="active">Ativa</option>
                  <option value="inactive">Inativa</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingStore ? "Salvar Alterações" : "Cadastrar Loja"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
