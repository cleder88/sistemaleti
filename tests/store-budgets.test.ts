import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getSavedStoreBudgetsMap,
  saveStoreBudgetLocal,
} from "@/lib/store-budgets";

const storage = new Map<string, string>();

const mockLocalStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => storage.clear(),
};

type TestWindow = { localStorage: typeof mockLocalStorage };

function installWindow() {
  (globalThis as unknown as { window?: TestWindow }).window = {
    localStorage: mockLocalStorage,
  };
}

function removeWindow() {
  delete (globalThis as unknown as { window?: TestWindow }).window;
}

describe("store-budgets", () => {
  beforeEach(() => {
    storage.clear();
    installWindow();
  });

  afterEach(() => {
    removeWindow();
  });

  it("persiste e recupera orçamento por loja", () => {
    saveStoreBudgetLocal("loja-1", {
      monthly_budget: 1500,
      monthly_items_limit: 300,
    });

    expect(getSavedStoreBudgetsMap()["loja-1"]).toEqual({
      monthly_budget: 1500,
      monthly_items_limit: 300,
    });
  });

  it("normaliza valores negativos para zero", () => {
    saveStoreBudgetLocal("loja-2", {
      monthly_budget: -10,
      monthly_items_limit: -5,
    });

    expect(getSavedStoreBudgetsMap()["loja-2"]).toEqual({
      monthly_budget: 0,
      monthly_items_limit: 0,
    });
  });

  it("retorna objeto vazio sem window", () => {
    removeWindow();
    expect(getSavedStoreBudgetsMap()).toEqual({});
  });
});
