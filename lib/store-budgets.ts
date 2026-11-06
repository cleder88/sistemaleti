export interface StoreBudgetConfig {
  monthly_budget: number; // Teto mensal em R$
  monthly_items_limit: number; // Teto mensal em unidades de produtos
}

const STORAGE_KEY = "sistema_leti_store_budgets_v1";

export function getSavedStoreBudgetsMap(): Record<string, StoreBudgetConfig> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, StoreBudgetConfig>;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveStoreBudgetLocal(
  storeId: string,
  config: StoreBudgetConfig
): void {
  if (typeof window === "undefined" || !storeId) return;
  try {
    const current = getSavedStoreBudgetsMap();
    current[storeId] = {
      monthly_budget: Math.max(0, Number(config.monthly_budget) || 0),
      monthly_items_limit: Math.max(0, Number(config.monthly_items_limit) || 0),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Ignora falha de escrita em modo privado
  }
}
