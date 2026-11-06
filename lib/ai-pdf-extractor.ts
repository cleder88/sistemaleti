import { sanitizeProductText, type ParsedOrderItem } from "@/lib/pdf-parser";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";
const REQUEST_TIMEOUT_MS = 20000;
const MAX_INPUT_CHARS = 30000;
const MAX_ITEMS = 500;

const SYSTEM_PROMPT = [
  "Você extrai itens de pedidos de compra a partir do texto bruto de um PDF.",
  "Responda SOMENTE com um objeto JSON válido no formato:",
  '{"items":[{"product_name":"string","quantity":number,"unit_price":number,"total_price":number}]}',
  "Regras:",
  "- Inclua apenas produtos/linhas de item realmente presentes no texto.",
  "- Ignore cabeçalhos, CNPJ, endereço, totais, subtotais, rodapés e números de página.",
  "- Use 0 quando o preço unitário ou total não estiver disponível.",
  "- Não invente produtos. Se não houver itens, retorne {\"items\":[]}.",
].join("\n");

export interface AiExtractionResult {
  items: ParsedOrderItem[];
  error: string | null;
}

interface RawAiItem {
  product_name?: unknown;
  quantity?: unknown;
  unit_price?: unknown;
  total_price?: unknown;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeAiItems(raw: unknown): ParsedOrderItem[] {
  if (!Array.isArray(raw)) return [];

  const items: ParsedOrderItem[] = [];

  for (const entry of raw.slice(0, MAX_ITEMS)) {
    if (!entry || typeof entry !== "object") continue;

    const candidate = entry as RawAiItem;
    const productName = sanitizeProductText(
      typeof candidate.product_name === "string" ? candidate.product_name : ""
    );
    const quantity = toNumber(candidate.quantity);
    const unitPrice = Math.max(0, toNumber(candidate.unit_price));

    if (!productName || quantity <= 0 || quantity > 1_000_000) continue;
    if (unitPrice > 100_000_000) continue;

    const rawTotal = Math.max(0, toNumber(candidate.total_price));
    const totalPrice = rawTotal > 0 ? rawTotal : quantity * unitPrice;

    items.push({
      product_name: productName,
      quantity: Number(quantity.toFixed(2)),
      unit_price: Number(unitPrice.toFixed(2)),
      total_price: Number(totalPrice.toFixed(2)),
    });
  }

  return items;
}

function extractJson(content: string): unknown {
  const withoutFence = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    // Continua para as tentativas de extração parcial
  }

  const objectStart = withoutFence.indexOf("{");
  const objectEnd = withoutFence.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) {
    try {
      return JSON.parse(withoutFence.slice(objectStart, objectEnd + 1));
    } catch {
      // Continua para o array
    }
  }

  const arrayStart = withoutFence.indexOf("[");
  const arrayEnd = withoutFence.lastIndexOf("]");
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    try {
      return JSON.parse(withoutFence.slice(arrayStart, arrayEnd + 1));
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Extrai itens de pedido via DeepSeek quando o parser por regex não encontra nada.
 * Retorna lista vazia (sem erro) quando a IA não está configurada.
 */
export async function extractOrderItemsWithAI(
  rawText: string
): Promise<AiExtractionResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) return { items: [], error: null };

  const input = rawText.slice(0, MAX_INPUT_CHARS);
  if (!input.trim()) return { items: [], error: null };

  try {
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Texto bruto do PDF:\n\n${input}` },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        items: [],
        error: `Falha na extração por IA (HTTP ${response.status}).`,
      };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return { items: [], error: "Resposta vazia da extração por IA." };
    }

    const parsed = extractJson(content);
    const rawItems = Array.isArray(parsed)
      ? parsed
      : (parsed as { items?: unknown } | null)?.items;

    return { items: normalizeAiItems(rawItems), error: null };
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");

    return {
      items: [],
      error: isTimeout
        ? "Tempo esgotado na extração por IA."
        : "Erro ao chamar a extração por IA.",
    };
  }
}
