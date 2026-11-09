export interface ParsedOrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

/**
 * Sanitiza strings extraídas do PDF ou digitadas manualmente contra XSS e injeção de scripts.
 * Remove blocos <script>, tags HTML, atributos de eventos maliciosos e caracteres de controle.
 */
export function sanitizeProductText(raw: string | undefined | null): string {
  if (!raw || typeof raw !== "string") return "";

  return raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<\/?[a-z][^>]*>/gi, "")
    .replace(/\b(?:javascript|vbscript|data):/gi, "")
    .replace(/\bon[a-z]+\s*=/gi, "")
    .replace(/[\u0000-\u001F\u007F<>]/g, "")
    .replace(/^[-–—•*|\s]+/, "")
    .replace(/[-–—•*|\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/**
 * Converte números no formato brasileiro ("1.234,56" ou "12,50") ou internacional ("12.50")
 * para float (number).
 */
export function parseBrazilianNumber(raw: string | undefined | null): number {
  if (!raw) return 0;

  const cleaned = raw
    .replace(/R\$/gi, "")
    .replace(/\s+/g, "")
    .trim();

  if (!cleaned) return 0;

  if (cleaned.includes(",")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const dotParts = cleaned.split(".");
  if (dotParts.length > 2) {
    const parsed = parseFloat(cleaned.replace(/\./g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

const IGNORED_LINE_PATTERNS: RegExp[] = [
  /^p[aá]gina\s+\d+/i,
  /^total\s+(geral|do\s+pedido|líquido|bruto)/i,
  /^subtotal/i,
  /^cnpj[:\s]/i,
  /^inscri[cç][aã]o\s+estadual/i,
  /^endere[cç]o[:\s]/i,
  /^telefone[:\s]/i,
  /^data\s+(de\s+)?(emiss[aã]o|entrega|pedido)/i,
  /^(item|c[oó]d\.?|c[oó]digo|descri[cç][aã]o|produto)\s+(qtd|quant|unid|valor|pre[cç]o)/i,
  /^[-=_*.\s]{3,}$/,
];

/**
 * Processa o texto bruto extraído de um PDF linha por linha usando Regex.
 * Identifica linhas no padrão:
 * - 3 colunas: [Nome do Produto] [Quantidade] [Valor Total em R$]
 * - 4 colunas: [Nome do Produto] [Quantidade] [Valor Unitário] [Valor Total]
 */
export function parseOrderPdfText(rawText: string): ParsedOrderItem[] {
  if (!rawText || typeof rawText !== "string") {
    return [];
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\t+/g, " ").replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 3);

  const items: ParsedOrderItem[] = [];

  const numPattern = "(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d{1,4}|\\.\\d{1,4})?";

  const regexThreeNumbers = new RegExp(
    `^(?:\\d+\\s*[-.)]\\s*)?(.+?)\\s+(?:(?:UN|UND|CX|KG|PC|PCT|LT|FD|DZ|ML|G|M)\\s+)?(${numPattern})\\s+(?:(?:UN|UND|CX|KG|PC|PCT|LT|FD|DZ|ML|G|M)\\s+)?(?:R\\$\\s*)?(${numPattern})\\s+(?:R\\$\\s*)?(${numPattern})$`,
    "i"
  );

  const regexTwoNumbers = new RegExp(
    `^(?:\\d+\\s*[-.)]\\s*)?(.+?)\\s+(?:(?:UN|UND|CX|KG|PC|PCT|LT|FD|DZ|ML|G|M)\\s+)?(${numPattern})\\s+(?:(?:UN|UND|CX|KG|PC|PCT|LT|FD|DZ|ML|G|M)\\s+)?(?:R\\$\\s*)?(${numPattern})$`,
    "i"
  );

  const regexOneNumber = new RegExp(
    `^(?:\\d+\\s*[-.)]\\s*)?(.+?)\\s+(${numPattern})(?:\\s*(?:UN|UND|CX|KG|PC|PCT|LT|FD|DZ|ML|G|M))?$`,
    "i"
  );

  for (const line of lines) {
    if (IGNORED_LINE_PATTERNS.some((pattern) => pattern.test(line))) {
      continue;
    }

    let match = line.match(regexThreeNumbers);
    if (match) {
      const productName = sanitizeProductText(match[1]);
      const quantity = parseBrazilianNumber(match[2]);
      const unitPrice = parseBrazilianNumber(match[3]);
      const totalPrice = parseBrazilianNumber(match[4]);

      if (isValidProductCandidate(productName, quantity)) {
        items.push({
          product_name: productName,
          quantity,
          unit_price: Number(unitPrice.toFixed(2)),
          total_price: Number(
            (totalPrice > 0 ? totalPrice : quantity * unitPrice).toFixed(2)
          ),
        });
        continue;
      }
    }

    match = line.match(regexTwoNumbers);
    if (match) {
      // Layout de 3 colunas (produto, quantidade, valor em R$):
      // o último número é o valor total do item, não o valor unitário.
      const productName = sanitizeProductText(match[1]);
      const quantity = parseBrazilianNumber(match[2]);
      const totalPrice = parseBrazilianNumber(match[3]);

      if (isValidProductCandidate(productName, quantity)) {
        const unitPrice = quantity > 0 ? totalPrice / quantity : 0;
        items.push({
          product_name: productName,
          quantity,
          unit_price: Number(unitPrice.toFixed(2)),
          total_price: Number(totalPrice.toFixed(2)),
        });
        continue;
      }
    }

    match = line.match(regexOneNumber);
    if (match) {
      const productName = sanitizeProductText(match[1]);
      const quantity = parseBrazilianNumber(match[2]);

      if (isValidProductCandidate(productName, quantity)) {
        items.push({
          product_name: productName,
          quantity,
          unit_price: 0,
          total_price: 0,
        });
      }
    }
  }

  return items;
}

function isValidProductCandidate(name: string, quantity: number): boolean {
  if (!name || name.length < 2) return false;
  const letterCount = (name.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
  if (letterCount < 2) return false;
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) {
    return false;
  }
  return true;
}
