import { describe, expect, it } from "vitest";
import {
  parseBrazilianNumber,
  parseOrderPdfText,
  sanitizeProductText,
} from "@/lib/pdf-parser";

describe("sanitizeProductText", () => {
  it("remove scripts e tags HTML", () => {
    expect(sanitizeProductText("<script>alert(1)</script>Papel A4")).toBe(
      "Papel A4"
    );
    expect(sanitizeProductText("<b>Caneta</b> azul")).toBe("Caneta azul");
  });

  it("remove caracteres de controle e limita o tamanho", () => {
    expect(sanitizeProductText("  Produto\u0000 X  ")).toBe("Produto X");
    expect(sanitizeProductText("a".repeat(300))).toHaveLength(200);
  });

  it("retorna vazio para entrada inválida", () => {
    expect(sanitizeProductText(undefined)).toBe("");
    expect(sanitizeProductText(null)).toBe("");
  });
});

describe("parseBrazilianNumber", () => {
  it("interpreta formato brasileiro", () => {
    expect(parseBrazilianNumber("1.234,56")).toBe(1234.56);
    expect(parseBrazilianNumber("R$ 12,50")).toBe(12.5);
  });

  it("interpreta formato com ponto decimal", () => {
    expect(parseBrazilianNumber("12.50")).toBe(12.5);
  });

  it("retorna 0 para valores inválidos", () => {
    expect(parseBrazilianNumber("abc")).toBe(0);
    expect(parseBrazilianNumber("")).toBe(0);
    expect(parseBrazilianNumber(undefined)).toBe(0);
  });
});

describe("parseOrderPdfText", () => {
  it("extrai item com quantidade, valor unitário e total", () => {
    const items = parseOrderPdfText("Caneta Azul UN 10 2,50 25,00");

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      product_name: "Caneta Azul",
      quantity: 10,
      unit_price: 2.5,
      total_price: 25,
    });
  });

  it("ignora linhas de total e cabeçalho", () => {
    const items = parseOrderPdfText(
      "Total geral 100,00\nPapel A4 5 10,00 50,00"
    );

    expect(items).toHaveLength(1);
    expect(items[0].product_name).toBe("Papel A4");
  });

  it("retorna lista vazia para texto vazio", () => {
    expect(parseOrderPdfText("")).toEqual([]);
  });
});
