import { afterEach, describe, expect, it } from "vitest";
import { extractOrderItemsWithAI } from "@/lib/ai-pdf-extractor";

const originalKey = process.env.DEEPSEEK_API_KEY;

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.DEEPSEEK_API_KEY;
  } else {
    process.env.DEEPSEEK_API_KEY = originalKey;
  }
});

describe("extractOrderItemsWithAI", () => {
  it("retorna vazio, sem erro, quando a IA não está configurada", async () => {
    delete process.env.DEEPSEEK_API_KEY;

    const result = await extractOrderItemsWithAI("Caneta 10 2,50 25,00");

    expect(result.items).toEqual([]);
    expect(result.error).toBeNull();
  });

  it("retorna vazio para texto em branco", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";

    const result = await extractOrderItemsWithAI("   ");

    expect(result.items).toEqual([]);
    expect(result.error).toBeNull();
  });
});
