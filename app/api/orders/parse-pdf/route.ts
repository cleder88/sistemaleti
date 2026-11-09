import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/security/origin";
import { parseOrderPdfText, type ParsedOrderItem } from "@/lib/pdf-parser";
import { extractOrderItemsWithAI } from "@/lib/ai-pdf-extractor";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

type LegacyPdfParse = (data: Buffer) => Promise<{ text?: string }>;

interface ModernPdfParseModule {
  PDFParse?: new (options: { data: Uint8Array }) => {
    getText: () => Promise<{ text?: string }>;
    destroy?: () => Promise<void>;
  };
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const imported = (await import("pdf-parse")) as unknown;

  // API antiga (pdf-parse v1): o módulo exporta uma função.
  if (typeof imported === "function") {
    const result = await (imported as LegacyPdfParse)(buffer);
    return result.text ?? "";
  }

  const pdfModule = imported as { default?: unknown } & ModernPdfParseModule;

  if (typeof pdfModule.default === "function") {
    const result = await (pdfModule.default as LegacyPdfParse)(buffer);
    return result.text ?? "";
  }

  // API nova (pdf-parse v2): classe PDFParse.
  if (typeof pdfModule.PDFParse === "function") {
    const parser = new pdfModule.PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text ?? "";
    } finally {
      await parser.destroy?.();
    }
  }

  throw new Error("Biblioteca pdf-parse não suportada.");
}

/**
 * POST /api/orders/parse-pdf
 * Recebe um PDF (multipart/form-data, campo "file"), extrai o texto e devolve
 * os itens do pedido (produto, quantidade e valor). Usa regex primeiro e, se
 * nada for encontrado, recorre à IA (DeepSeek) quando configurada.
 */
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Origem da requisição não permitida." },
      { status: 403 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit({
    key: `orders-parse-pdf:${user.id}:${getClientIp(request)}`,
    limit: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  const headers = buildRateLimitHeaders(rateLimit);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Tente novamente em instantes." },
      { status: 429, headers }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Envie o PDF no campo 'file'." },
      { status: 400, headers }
    );
  }

  const file = formData.get("file");
  if (!file || typeof file === "string" || file.size === 0) {
    return NextResponse.json(
      { error: "Nenhum arquivo PDF foi enviado." },
      { status: 400, headers }
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "O PDF deve ter no máximo 15 MB." },
      { status: 413, headers }
    );
  }

  const isPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    return NextResponse.json(
      { error: "O arquivo enviado não é um PDF." },
      { status: 415, headers }
    );
  }

  let rawText = "";
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    rawText = await extractPdfText(buffer);
  } catch {
    return NextResponse.json(
      {
        error:
          "Não foi possível ler o PDF. Verifique se o arquivo não está corrompido ou protegido por senha.",
      },
      { status: 422, headers }
    );
  }

  if (!rawText.trim()) {
    return NextResponse.json(
      {
        error:
          "Nenhum texto legível encontrado no PDF. Ele pode ser uma imagem digitalizada.",
      },
      { status: 422, headers }
    );
  }

  let items: ParsedOrderItem[] = parseOrderPdfText(rawText);
  let source: "regex" | "ai" = "regex";

  if (items.length === 0) {
    const aiResult = await extractOrderItemsWithAI(rawText);
    if (aiResult.items.length > 0) {
      items = aiResult.items;
      source = "ai";
    } else {
      return NextResponse.json(
        {
          error:
            aiResult.error ||
            "Não foi possível identificar os itens do pedido no PDF.",
          items: [],
        },
        { status: 422, headers }
      );
    }
  }

  return NextResponse.json(
    { items, source, total_items: items.length },
    { headers: { ...headers, "Cache-Control": "no-store" } }
  );
}
