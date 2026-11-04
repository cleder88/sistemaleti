export interface ParsedOrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
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

  // Caso possua vírgula, assume padrão brasileiro: pontos são separadores de milhar e vírgula é decimal
  if (cleaned.includes(",")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  // Sem vírgula: verifica se há múltiplos pontos de milhar (ex: "1.000.000")
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
 * [Nome do Produto] [Quantidade] [Valor Unitário opcional] [Valor Total opcional]
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

  // Padrão numérico brasileiro/decimal: aceita inteiros ou decimais com vírgula/ponto (ex: 10, 2,5, 1.250,90)
  const numPattern = "(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d{1,4}|\\.\\d{1,4})?";

  // Regex 1: [Nome do Produto] [Qtd] [Valor Unitário] [Valor Total]
  const regexThreeNumbers = new RegExp(
    `^(?:\\d+\\s*[-.)]\\s*)?(.+?)\\s+(?:(?:UN|UND|CX|KG|PC|PCT|LT|FD|DZ|ML|G|M)\\s+)?(${numPattern})\\s+(?:(?:UN|UND|CX|KG|PC|PCT|LT|FD|DZ|ML|G|M)\\s+)?(?:R\\$\\s*)?(${numPattern})\\s+(?:R\\$\\s*)?(${numPattern})$`,
    "i"
  );

  // Regex 2: [Nome do Produto] [Qtd] [Valor Unitário ou Total]
  const regexTwoNumbers = new RegExp(
    `^(?:\\d+\\s*[-.)]\\s*)?(.+?)\\s+(?:(?:UN|UND|CX|KG|PC|PCT|LT|FD|DZ|ML|G|M)\\s+)?(${numPattern})\\s+(?:(?:UN|UND|CX|KG|PC|PCT|LT|FD|DZ|ML|G|M)\\s+)?(?:R\\$\\s*)?(${numPattern})$`,
    "i"
  );

  // Regex 3: [Nome do Produto] [Qtd] (apenas nome e quantidade no final da linha)
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
      const productName = cleanProductName(match[1]);
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
      const productName = cleanProductName(match[1]);
      const quantity = parseBrazilianNumber(match[2]);
      const unitPrice = parseBrazilianNumber(match[3]);

      if (isValidProductCandidate(productName, quantity)) {
        const totalPrice = quantity * unitPrice;
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
      const productName = cleanProductName(match[1]);
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

function cleanProductName(rawName: string): string {
  return rawName
    .replace(/[\u0000-\u001F\u007F<>]/g, "") // Remove caracteres de controle e tags HTML
    .replace(/^[-–—•*|\s]+/, "")
    .replace(/[-–—•*|\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function isValidProductCandidate(name: string, quantity: number): boolean {
  if (!name || name.length < 2) return false;
  // Deve conter pelo menos duas letras para evitar linhas compostas apenas por códigos/datas/telefones
  const letterCount = (name.match(/[a-zA-ZÀ-ÿ]/g) || []).length;
  if (letterCount < 2) return false;
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) {
    return false;
  }
  return true;
}
