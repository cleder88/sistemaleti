"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Calendar,
  Store,
  Save,
  Upload,
  ClipboardPaste,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/navbar";
import { cn } from "@/lib/utils";
import { sanitizeProductText, type ParsedOrderItem } from "@/lib/pdf-parser";
import { orderSchema } from "@/lib/validations";
import { useUrlContext } from "@/lib/use-url-context";
import { Button, Card, Field, Input, Select } from "@/components/ui";

interface StoreOption {
  id: string;
  name: string;
  code: string;
  city: string;
  status: "active" | "inactive";
}

interface EditableOrderItem extends ParsedOrderItem {
  id: string;
}

interface ToastMessage {
  id: number;
  type: "success" | "error";
  text: string;
}

function createEmptyItem(): EditableOrderItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    product_name: "",
    quantity: 1,
    unit_price: 0,
    total_price: 0,
  };
}

function getDefaultYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

export default function NovoPedidoPage() {
  const router = useRouter();
  const {
    context: urlContext,
    updateContext: updateUrlContext,
    ready: urlContextReady,
  } = useUrlContext();
  const storeFromUrlAppliedRef = useRef(false);

  // Cabeçalho do pedido
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [yearMonth, setYearMonth] = useState(getDefaultYearMonth);

  // Itens da tabela de conferência
  const [items, setItems] = useState<EditableOrderItem[]>([createEmptyItem()]);
  const [savingOrder, setSavingOrder] = useState(false);

  // Importação de PDF
  const [parsingPdf, setParsingPdf] = useState(false);
  const [pdfFileName, setPdfFileName] = useState("");
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: "success" | "error", text: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Lê o PDF no servidor e popula a tabela com os itens do pedido
  const importPdfFile = useCallback(
    async (file: File) => {
      if (parsingPdf) return;

      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");

      if (!isPdf) {
        showToast("error", "Selecione um arquivo PDF.");
        return;
      }

      if (file.size > 15 * 1024 * 1024) {
        showToast("error", "O PDF deve ter no máximo 15 MB.");
        return;
      }

      setParsingPdf(true);
      setPdfFileName(file.name);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/orders/parse-pdf", {
          method: "POST",
          body: formData,
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          showToast(
            "error",
            result.error || "Não foi possível ler os itens do PDF."
          );
          return;
        }

        const parsedItems: ParsedOrderItem[] = Array.isArray(result.items)
          ? result.items
          : [];

        if (parsedItems.length === 0) {
          showToast("error", "Nenhum item de pedido foi encontrado no PDF.");
          return;
        }

        const importedItems: EditableOrderItem[] = parsedItems.map((item) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        }));

        setItems(importedItems);
        showToast(
          "success",
          `${importedItems.length} ${
            importedItems.length === 1
              ? "item importado"
              : "itens importados"
          } do PDF.`
        );
      } catch {
        showToast("error", "Falha inesperada ao processar o PDF.");
      } finally {
        setParsingPdf(false);
      }
    },
    [parsingPdf, showToast]
  );

  // Permite colar um PDF copiado do explorador de arquivos com Ctrl+V
  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const clipboardItems = event.clipboardData?.items;
      if (!clipboardItems) return;

      for (const item of Array.from(clipboardItems)) {
        if (item.kind !== "file") continue;

        const file = item.getAsFile();
        if (!file) continue;

        const isPdf =
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf");

        if (isPdf) {
          event.preventDefault();
          void importPdfFile(file);
          return;
        }
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [importPdfFile]);

  // Carrega lojas ativas da tabela 'stores'
  useEffect(() => {
    async function loadStores() {
      setLoadingStores(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("stores")
          .select("*")
          .order("name", { ascending: true });

        if (error) {
          showToast("error", `Erro ao carregar lojas: ${error.message}`);
          return;
        }

        const mapped: StoreOption[] = (data ?? [])
          .map((row: Record<string, unknown>) => {
            const rawStatus = row.status ?? row.is_active ?? row.active;
            let status: "active" | "inactive" = "active";
            if (typeof rawStatus === "boolean") {
              status = rawStatus ? "active" : "inactive";
            } else if (typeof rawStatus === "string") {
              const lower = rawStatus.toLowerCase();
              status =
                lower === "inactive" ||
                lower === "inativa" ||
                lower === "inativo" ||
                lower === "false"
                  ? "inactive"
                  : "active";
            }

            return {
              id: String(row.id ?? ""),
              name: String(row.name ?? row.nome ?? ""),
              code: String(row.code ?? row.codigo ?? ""),
              city: String(row.city ?? row.cidade ?? ""),
              status,
            };
          })
          .filter((store) => store.status === "active");

        setStores(mapped);
        if (mapped.length > 0) {
          setSelectedStoreId((prev) => prev || mapped[0].id);
        }
      } catch {
        showToast("error", "Falha inesperada ao carregar lista de lojas.");
      } finally {
        setLoadingStores(false);
      }
    }

    loadStores();
  }, [showToast]);

  useEffect(() => {
    if (!urlContextReady || !urlContext.month) return;
    setYearMonth(urlContext.month);
  }, [urlContextReady, urlContext.month]);

  useEffect(() => {
    if (
      !urlContextReady ||
      storeFromUrlAppliedRef.current ||
      loadingStores ||
      stores.length === 0
    ) {
      return;
    }

    storeFromUrlAppliedRef.current = true;
    if (
      urlContext.storeId &&
      stores.some((store) => store.id === urlContext.storeId)
    ) {
      setSelectedStoreId(urlContext.storeId);
    }
  }, [urlContextReady, urlContext.storeId, loadingStores, stores]);

  // Manipulação da tabela de conferência
  function handleAddManualRow() {
    setItems((prev) => [...prev, createEmptyItem()]);
  }

  function handleRemoveRow(id: string) {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      return next.length > 0 ? next : [createEmptyItem()];
    });
  }

  function handleItemChange(
    id: string,
    field: keyof ParsedOrderItem,
    rawValue: string
  ) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        if (field === "product_name") {
          return { ...item, product_name: rawValue };
        }

        const numericValue =
          rawValue === "" ? 0 : Math.max(0, parseFloat(rawValue) || 0);

        if (field === "quantity") {
          const newTotal = Number((numericValue * item.unit_price).toFixed(2));
          return {
            ...item,
            quantity: numericValue,
            total_price: item.unit_price > 0 ? newTotal : item.total_price,
          };
        }

        if (field === "unit_price") {
          const newTotal = Number((item.quantity * numericValue).toFixed(2));
          return {
            ...item,
            unit_price: numericValue,
            total_price: newTotal,
          };
        }

        if (field === "total_price") {
          return {
            ...item,
            total_price: numericValue,
          };
        }

        return item;
      })
    );
  }

  // Cálculos consolidados no rodapé
  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const qty = Number(item.quantity) || 0;
        const total = Number(item.total_price) || 0;
        if (item.product_name.trim() && qty > 0) {
          acc.validRows += 1;
        }
        acc.totalQuantity += qty;
        acc.totalAmount += total;
        return acc;
      },
      { validRows: 0, totalQuantity: 0, totalAmount: 0 }
    );
  }, [items]);

  // Grava o pedido em 'orders' e os itens em 'order_items' com validação Zod
  async function handleConfirmAndSaveOrder() {
    const referenceMonth = yearMonth ? `${yearMonth}-01` : "";

    const candidateItems = items
      .filter((item) => item.product_name.trim().length > 0)
      .map((item) => ({
        product_name: sanitizeProductText(item.product_name),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price || 0),
        total_price: Number(item.total_price || 0),
      }));

    const parsedOrder = orderSchema.safeParse({
      store_id: selectedStoreId,
      reference_month: referenceMonth,
      pdf_url: null,
      items: candidateItems,
    });

    if (!parsedOrder.success) {
      const firstIssue =
        parsedOrder.error.issues[0]?.message ||
        "Verifique os campos obrigatórios do pedido e dos itens.";
      showToast("error", firstIssue);
      return;
    }

    setSavingOrder(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsedOrder.data),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        showToast(
          "error",
          result.error || "Não foi possível gravar o pedido."
        );
        return;
      }

      showToast(
        "success",
        "Pedido confirmado e gravado com sucesso! Redirecionando..."
      );

      setTimeout(() => {
        const params = new URLSearchParams({ mes: yearMonth });
        if (selectedStoreId) params.set("loja", selectedStoreId);
        router.push(`/dashboard?${params.toString()}`);
        router.refresh();
      }, 1200);
    } catch {
      showToast("error", "Ocorreu um erro inesperado ao gravar o pedido.");
    } finally {
      setSavingOrder(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Navbar />

      {/* Toasts */}
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
              className="rounded-lg p-1 text-inkMuted hover:bg-white/5 hover:text-inkSoft"
              aria-label="Fechar notificação"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:pl-[var(--sidebar-offset)] lg:pr-8 lg:transition-[padding] lg:duration-300">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-amber-400">
            Novo Pedido
          </h1>
          <p className="mt-1 text-sm text-inkMuted">
            Importe os itens diretamente de um PDF ou preencha manualmente antes
            de gravar.
          </p>
        </div>

        {/* 1. Formulário de Cabeçalho */}
        <Card>
          <h2 className="text-base font-semibold text-ink">
            1. Dados do Pedido
          </h2>

          <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field htmlFor="store-select" label="Loja">
              <Select
                id="store-select"
                value={selectedStoreId}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedStoreId(value);
                  updateUrlContext({ storeId: value || null });
                }}
                disabled={loadingStores}
                leftIcon={<Store className="h-4 w-4" />}
              >
                  {loadingStores ? (
                    <option value="">Carregando lojas...</option>
                  ) : stores.length === 0 ? (
                    <option value="">Nenhuma loja ativa encontrada</option>
                  ) : (
                    <>
                      <option value="">Selecione uma loja...</option>
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name} ({store.code}) - {store.city}
                        </option>
                      ))}
                    </>
                  )}
              </Select>
            </Field>

            <Field
              htmlFor="reference-month"
              label="Mês de Referência"
              hint={
                yearMonth
                  ? `Será gravado como ${yearMonth}-01`
                  : "Será gravado como YYYY-MM-01"
              }
            >
              <Input
                id="reference-month"
                type="month"
                value={yearMonth}
                onChange={(e) => {
                  const value = e.target.value;
                  setYearMonth(value);
                  updateUrlContext({ month: value || null });
                }}
                leftIcon={<Calendar className="h-4 w-4" />}
              />
            </Field>
          </div>
        </Card>

        {/* 2. Importação via PDF */}
        <Card className="mt-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold text-ink">
                2. Importar Itens do PDF
              </h2>
              <p className="mt-0.5 text-xs text-inkMuted">
                Cole o PDF (Ctrl+V), arraste o arquivo ou clique para selecionar.
                A leitura preenche a tabela com produto, quantidade e valor (R$).
              </p>
            </div>

            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsingPdf}
            >
              {parsingPdf ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {parsingPdf ? "Lendo PDF..." : "Selecionar PDF"}
            </Button>
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-label="Importar itens de um PDF"
            onClick={() => {
              if (!parsingPdf) fileInputRef.current?.click();
            }}
            onKeyDown={(event) => {
              if (
                !parsingPdf &&
                (event.key === "Enter" || event.key === " ")
              ) {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (!parsingPdf) setIsDraggingPdf(true);
            }}
            onDragLeave={() => setIsDraggingPdf(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDraggingPdf(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void importPdfFile(file);
            }}
            className={cn(
              "mt-5 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
              isDraggingPdf
                ? "border-brand bg-brand/10"
                : "border-line bg-panelMuted/40 hover:border-inkMuted",
              parsingPdf && "pointer-events-none opacity-70"
            )}
          >
            {parsingPdf ? (
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
            ) : (
              <ClipboardPaste className="h-8 w-8 text-inkMuted" />
            )}
            <p className="text-sm font-medium text-ink">
              {parsingPdf
                ? "Lendo o PDF e extraindo os itens..."
                : "Cole (Ctrl+V), arraste ou clique para selecionar o PDF"}
            </p>
            <p className="text-xs text-inkMuted">
              Extração automática das colunas: produto, quantidade e valor total
              (R$).
            </p>
            {pdfFileName ? (
              <p className="mt-1 max-w-full truncate font-mono text-xs text-inkSoft">
                Arquivo: {pdfFileName}
              </p>
            ) : null}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importPdfFile(file);
              event.target.value = "";
            }}
          />
        </Card>

        <Card className="mt-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold text-ink">
                3. Itens do Pedido
              </h2>
              <p className="mt-0.5 text-xs text-inkMuted">
                Revise os itens importados, ajuste valores ou adicione/remova
                linhas antes de gravar.
              </p>
            </div>

            <Button type="button" onClick={handleAddManualRow}>
              <Plus className="h-4 w-4" />
              Adicionar Linha Manualmente
            </Button>
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-line">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-panelMuted text-xs font-semibold uppercase tracking-wider text-inkMuted">
                  <th className="w-12 px-4 py-3 text-center">#</th>
                  <th className="min-w-[260px] px-4 py-3">Nome do Produto</th>
                  <th className="w-36 px-4 py-3">Quantidade</th>
                  <th className="w-40 px-4 py-3">Valor Unitário (R$)</th>
                  <th className="w-40 px-4 py-3">Valor Total (R$)</th>
                  <th className="w-16 px-4 py-3 text-center">Excluir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((item, index) => (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-panelMuted/60"
                  >
                    <td className="px-4 py-2.5 text-center font-mono text-xs text-inkMuted">
                      {index + 1}
                    </td>

                    <td className="px-4 py-2.5">
                      <Input
                        type="text"
                        size="sm"
                        value={item.product_name}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "product_name",
                            e.target.value
                          )
                        }
                        placeholder="Ex: Bobina Térmica 80x40"
                        className="bg-panel"
                      />
                    </td>

                    <td className="px-4 py-2.5">
                      <Input
                        type="number"
                        size="sm"
                        min="0"
                        step="any"
                        value={item.quantity === 0 ? "" : item.quantity}
                        onChange={(e) =>
                          handleItemChange(item.id, "quantity", e.target.value)
                        }
                        placeholder="0"
                        className="bg-panel"
                      />
                    </td>

                    <td className="px-4 py-2.5">
                      <Input
                        type="number"
                        size="sm"
                        min="0"
                        step="0.01"
                        value={item.unit_price === 0 ? "" : item.unit_price}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "unit_price",
                            e.target.value
                          )
                        }
                        placeholder="0,00"
                        className="bg-panel"
                      />
                    </td>

                    <td className="px-4 py-2.5">
                      <Input
                        type="number"
                        size="sm"
                        min="0"
                        step="0.01"
                        value={item.total_price === 0 ? "" : item.total_price}
                        onChange={(e) =>
                          handleItemChange(
                            item.id,
                            "total_price",
                            e.target.value
                          )
                        }
                        placeholder="0,00"
                        className="bg-panelMuted font-medium focus:bg-panelElevated"
                      />
                    </td>

                    <td className="px-4 py-2.5 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveRow(item.id)}
                        className="p-1.5 text-inkMuted hover:bg-danger/10 hover:text-danger"
                        title="Remover linha"
                        aria-label={`Remover linha ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Rodapé com Cálculo Automático */}
              <tfoot>
                <tr className="border-t-2 border-line bg-panelMuted/90 font-semibold text-ink">
                  <td colSpan={2} className="px-4 py-3.5 text-right text-sm">
                    Totais Consolidados ({totals.validRows}{" "}
                    {totals.validRows === 1 ? "item válido" : "itens válidos"}):
                  </td>
                  <td className="px-4 py-3.5 text-sm">
                    <span className="text-xs font-normal text-inkMuted">
                      Qtd Total:{" "}
                    </span>
                    {Number(totals.totalQuantity.toFixed(2))}
                  </td>
                  <td className="px-4 py-3.5 text-right text-xs font-normal text-inkMuted">
                    Valor Consolidado:
                  </td>
                  <td className="px-4 py-3.5 text-sm font-bold text-emerald-700">
                    {formatCurrencyBRL(totals.totalAmount)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Botão Confirmar e Gravar Pedido */}
          <div className="mt-6 flex flex-col items-stretch justify-between gap-4 border-t border-line pt-5 sm:flex-row sm:items-center">
            <div className="text-xs text-inkMuted">
              Ao confirmar, o pedido será gravado na tabela{" "}
              <code className="rounded bg-panelMuted px-1.5 py-0.5 font-mono text-inkSoft">
                orders
              </code>{" "}
              e seus itens em{" "}
              <code className="rounded bg-panelMuted px-1.5 py-0.5 font-mono text-inkSoft">
                order_items
              </code>
              .
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={handleConfirmAndSaveOrder}
              disabled={savingOrder}
              className="px-6"
            >
              {savingOrder ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gravando Pedido...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Confirmar e Gravar Pedido
                </>
              )}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
