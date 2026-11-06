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
  FilePlus2,
  LayoutDashboard,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/navbar";
import { cn } from "@/lib/utils";
import { storeSchema } from "@/lib/validations";
import {
  getSavedStoreBudgetsMap,
  saveStoreBudgetLocal,
} from "@/lib/store-budgets";
import { getCurrentMonthKey } from "@/lib/presentation";
import { useUrlContext } from "@/lib/use-url-context";
import { Badge, Button, ButtonLink, Card, Field, Input, Select } from "@/components/ui";

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
  const {
    context: urlContext,
    ready: urlContextReady,
  } = useUrlContext();
  const contextMonth = urlContext.month ?? getCurrentMonthKey();

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = new URLSearchParams(window.location.search).get("q");
    if (query) setSearchQuery(query);
  }, []);

  useEffect(() => {
    if (!urlContextReady || !urlContext.storeId || loading) return;
    const row = document.getElementById(`store-row-${urlContext.storeId}`);
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [urlContextReady, urlContext.storeId, loading]);

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
    <div className="min-h-screen bg-canvas text-ink">
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
              className="rounded-lg p-1 text-inkMuted hover:bg-black/5 hover:text-inkSoft"
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

          <Button type="button" variant="primary" onClick={openCreateModal}>
            <Plus className="h-4 w-4" />
            Nova Loja
          </Button>
        </div>

        {/* Barra de busca e resumo */}
        <Card className="mt-6 flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, código ou cidade..."
            leftIcon={<Search className="h-4 w-4" />}
            className="flex-1 border-line bg-panelMuted focus:bg-panelElevated"
          />

          <div className="flex items-center gap-4 text-xs font-medium text-inkSoft">
            <span>
              Total: <strong className="text-ink">{stores.length}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Ativas: {stores.filter((s) => s.status === "active").length}
            </span>
            <span className="inline-flex items-center gap-1.5 text-inkMuted">
              <span className="h-2 w-2 rounded-full bg-inkMuted" />
              Inativas: {stores.filter((s) => s.status === "inactive").length}
            </span>
          </div>
        </Card>

        {/* Tabela de Lojas */}
        <Card padded={false} className="mt-6 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-inkMuted">
              <Loader2 className="h-7 w-7 animate-spin text-inkSoft" />
              <p className="mt-3 text-sm">Carregando lojas cadastradas...</p>
            </div>
          ) : filteredStores.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-panelMuted text-inkMuted">
                <Store className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-ink">
                {searchQuery
                  ? "Nenhuma loja encontrada para sua busca"
                  : "Nenhuma loja cadastrada"}
              </h2>
              <p className="mt-1 max-w-sm text-sm text-inkMuted">
                {searchQuery
                  ? "Tente alterar os termos de pesquisa ou limpar o filtro."
                  : "Comece adicionando a primeira loja clicando no botão Nova Loja."}
              </p>
              {!searchQuery && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={openCreateModal}
                  className="mt-5"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Loja
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-panelMuted/80 text-xs font-semibold uppercase tracking-wider text-inkMuted">
                    <th className="px-6 py-3.5">Nome</th>
                    <th className="px-6 py-3.5">Código</th>
                    <th className="px-6 py-3.5">Cidade</th>
                    <th className="px-6 py-3.5">Teto / Meta Mensal</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredStores.map((store) => {
                    const isActive = store.status === "active";
                    const isToggling = togglingId === store.id;

                    return (
                      <tr
                        key={store.id}
                        id={`store-row-${store.id}`}
                        className={cn(
                          "transition-colors hover:bg-panelMuted/80",
                          urlContext.storeId === store.id &&
                            "bg-brand/10 ring-2 ring-inset ring-amber-400/60"
                        )}
                      >
                        <td className="px-6 py-4 font-medium text-ink">
                          {store.name}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center rounded-md bg-panelMuted px-2.5 py-1 font-mono text-xs font-medium text-inkSoft">
                            {store.code}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-inkSoft">
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
                          <Badge variant={isActive ? "success" : "neutral"} dot>
                            {isActive ? "Ativa" : "Inativa"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <ButtonLink
                              href={`/pedidos/novo?loja=${store.id}&mes=${contextMonth}`}
                              title="Criar novo pedido para esta loja"
                              variant="secondary"
                              size="sm"
                            >
                              <FilePlus2 className="h-3.5 w-3.5" />
                              Novo pedido
                            </ButtonLink>

                            <ButtonLink
                              href={`/dashboard?mes=${contextMonth}&loja=${store.id}`}
                              title="Ver esta loja no Dashboard"
                              variant="secondary"
                              size="sm"
                            >
                              <LayoutDashboard className="h-3.5 w-3.5" />
                              Dashboard
                            </ButtonLink>

                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => openEditModal(store)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </Button>

                            <Button
                              type="button"
                              variant={isActive ? "danger" : "secondary"}
                              size="sm"
                              disabled={isToggling}
                              onClick={() => handleToggleStatus(store)}
                              className={
                                isActive
                                  ? undefined
                                  : "border-success/30 bg-success/10 text-success hover:bg-success/15 hover:text-success"
                              }
                            >
                              {isToggling ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Power className="h-3.5 w-3.5" />
                              )}
                              {isActive ? "Desativar" : "Ativar"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>

      {/* Modal de Criar / Editar Loja */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-store-title"
        >
          <Card className="w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-black">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h2
                    id="modal-store-title"
                    className="text-lg font-bold text-ink"
                  >
                    {editingStore ? "Editar Loja" : "Nova Loja"}
                  </h2>
                  <p className="text-xs text-inkMuted">
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
                className="rounded-lg p-1.5 text-inkMuted hover:bg-panelMuted hover:text-inkSoft"
                aria-label="Fechar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="mt-5 space-y-4">
              <Field htmlFor="store-name" label="Nome da Loja">
                <Input
                  id="store-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Ex: Matriz Centro"
                  leftIcon={<Building2 className="h-4 w-4" />}
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field htmlFor="store-code" label="Código">
                  <Input
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
                    leftIcon={<Hash className="h-4 w-4" />}
                    className="uppercase"
                  />
                </Field>

                <Field htmlFor="store-city" label="Cidade">
                  <Input
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
                    leftIcon={<MapPin className="h-4 w-4" />}
                  />
                </Field>
              </div>

              {/* Teto de Orçamento Mensal (Meta / Budget por Loja) */}
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-amber-500/20 bg-panelMuted p-3.5 sm:grid-cols-2">
                <Field
                  htmlFor="store-budget"
                  label="Teto de Orçamento Mensal (R$)"
                  labelClassName="text-xs font-semibold"
                >
                  <Input
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
                    leftIcon={<DollarSign className="h-4 w-4" />}
                  />
                </Field>

                <Field
                  htmlFor="store-items-limit"
                  label="Limite Mensal de Produtos (Unid.)"
                  labelClassName="text-xs font-semibold"
                >
                  <Input
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
                    leftIcon={<Package className="h-4 w-4" />}
                  />
                </Field>
              </div>

              <Field htmlFor="store-status" label="Status">
                <Select
                  id="store-status"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      status: e.target.value as "active" | "inactive",
                    }))
                  }
                >
                  <option value="active">Ativa</option>
                  <option value="inactive">Inativa</option>
                </Select>
              </Field>

              <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingStore ? "Salvar Alterações" : "Cadastrar Loja"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
