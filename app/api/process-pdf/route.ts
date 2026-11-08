import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { parseOrderPdfText, extractItensDoPedidoSection } from "@/lib/pdf-parser";
import { extractOrderItemsWithAI } from "@/lib/ai-pdf-extractor";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  getClientIp,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/security/origin";

export const runtime = "nodejs";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const PDF_PARSE_TIMEOUT_MS = 15 * 1000; // 15 segundos de timeout defensivo
const SIGNED_URL_EXPIRES_IN_SECONDS = 60; // 60 segundos de validade
const PDF_RATE_LIMIT_MAX = 15;
const PDF_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parsePdfWithTimeout(
  buffer: Buffer,
  timeoutMs: number
): Promise<Awaited<ReturnType<typeof pdfParse>>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("PDF_PARSE_TIMEOUT"));
    }, timeoutMs);

    pdfParse(buffer)
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Origem da requisição não permitida." },
      { status: 403 }
    );
  }

  const clientIp = getClientIp(request);
  const rateLimit = await checkRateLimit({
    key: `process-pdf:${clientIp}`,
    limit: PDF_RATE_LIMIT_MAX,
    windowMs: PDF_RATE_LIMIT_WINDOW_MS,
  });

  const rateHeaders = buildRateLimitHeaders(rateLimit);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error:
          "Demasiadas tentativas de acesso. Por favor, tente novamente após 15 minutos.",
      },
      {
        status: 429,
        headers: rateHeaders,
      }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const storeId = String(formData.get("store_id") ?? "").trim();
    const rawMonth = String(formData.get("reference_month") ?? "").trim();

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Arquivo PDF não enviado ou inválido." },
        { status: 400, headers: rateHeaders }
      );
    }

    // 1. Validação estrita da extensão (.pdf) e do tipo MIME (application/pdf)
    const fileNameLower = file.name.trim().toLowerCase();
    if (!fileNameLower.endsWith(".pdf") || file.type !== "application/pdf") {
      return NextResponse.json(
        {
          error:
            "Formato de ficheiro inválido. Apenas ficheiros com extensão .pdf são permitidos.",
        },
        { status: 400, headers: rateHeaders }
      );
    }

    // 2. Validação do tamanho máximo (10 MB)
    if (file.size <= 0 || file.size > MAX_PDF_SIZE_BYTES) {
      return NextResponse.json(
        {
          error:
            "O ficheiro excede o tamanho máximo permitido de 10 MB ou está vazio.",
        },
        { status: 413, headers: rateHeaders }
      );
    }

    // 3. Validação de store_id (UUID) e reference_month (YYYY-MM-01)
    if (!storeId || !UUID_REGEX.test(storeId)) {
      return NextResponse.json(
        { error: "Identificador de loja inválido." },
        { status: 400, headers: rateHeaders }
      );
    }

    const referenceMonth =
      /^\d{4}-\d{2}$/.test(rawMonth) ? `${rawMonth}-01` : rawMonth;
    if (!/^\d{4}-\d{2}-01$/.test(referenceMonth)) {
      return NextResponse.json(
        { error: "Formato de mês de referência inválido (esperado YYYY-MM-01)." },
        { status: 400, headers: rateHeaders }
      );
    }

    const userSupabase = createClient();
    const { data: storeData, error: storeError } = await userSupabase
      .from("stores")
      .select("id")
      .eq("id", storeId)
      .eq("status", "active")
      .maybeSingle();

    if (storeError || !storeData) {
      return NextResponse.json(
        { error: "Loja não encontrada ou inativa." },
        { status: 404, headers: rateHeaders }
      );
    }

    // 4. Converte o arquivo em Buffer e valida a assinatura binária (%PDF-)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const pdfSignature = buffer.subarray(0, 5).toString("ascii");
    if (pdfSignature !== "%PDF-") {
      return NextResponse.json(
        {
          error:
            "Não foi possível ler o arquivo PDF. Verifique se o documento não está corrompido.",
        },
        { status: 422, headers: rateHeaders }
      );
    }

    // 5. Extrai o texto bruto do PDF com timeout defensivo de 15 segundos
    let rawText = "";
    try {
      const parsedPdf = await parsePdfWithTimeout(buffer, PDF_PARSE_TIMEOUT_MS);
      rawText = parsedPdf.text ?? "";
    } catch (pdfError) {
      console.error("Erro ou timeout ao extrair texto do PDF:", pdfError);
      return NextResponse.json(
        {
          error:
            "Não foi possível ler o arquivo PDF. Verifique se o documento não está corrompido.",
        },
        { status: 422, headers: rateHeaders }
      );
    }

    // 6. Processa e sanitiza linha por linha do texto bruto
    let items = parseOrderPdfText(rawText);
    let parseSource: "regex" | "ai" = "regex";
    let aiWarning: string | null = null;

    // Fallback opcional de IA quando o formato não é reconhecido pelo regex
    if (items.length === 0 && rawText.trim().length > 0) {
      const sectionText = extractItensDoPedidoSection(rawText);
      const aiResult = await extractOrderItemsWithAI(sectionText);

      if (aiResult.items.length > 0) {
        items = aiResult.items;
        parseSource = "ai";
      }

      if (aiResult.error) {
        aiWarning = aiResult.error;
      }
    }

    // 7. Faz o upload do PDF original para o bucket privado 'order-files' e gera URL assinada de 60 segundos
    const sanitizedName = file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 120);
    const storagePath = `${storeId}/${referenceMonth}/${Date.now()}-${sanitizedName}`;

    let signedUrl: string | null = null;
    let storageWarning: string | null = null;
    let uploadSucceeded = false;

    try {
      const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
        ? createAdminClient()
        : createClient();

      let { error: uploadError } = await supabase.storage
        .from("order-files")
        .upload(storagePath, buffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (
        uploadError &&
        process.env.SUPABASE_SERVICE_ROLE_KEY &&
        uploadError.message.toLowerCase().includes("bucket")
      ) {
        const adminClient = createAdminClient();
        await adminClient.storage.createBucket("order-files", {
          public: false,
          fileSizeLimit: MAX_PDF_SIZE_BYTES,
          allowedMimeTypes: ["application/pdf"],
        });

        const retry = await adminClient.storage
          .from("order-files")
          .upload(storagePath, buffer, {
            contentType: "application/pdf",
            upsert: true,
          });
        uploadError = retry.error;
      }

      if (uploadError) {
        storageWarning = `Aviso no upload do PDF para o bucket 'order-files': ${uploadError.message}`;
      } else {
        uploadSucceeded = true;

        // Gera URL assinada com validade de 60 segundos apenas para pré-visualização imediata
        const { data: signedUrlData } = await supabase.storage
          .from("order-files")
          .createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN_SECONDS);

        signedUrl = signedUrlData?.signedUrl ?? null;
      }
    } catch (storageErr) {
      storageWarning =
        storageErr instanceof Error
          ? storageErr.message
          : "Não foi possível salvar o PDF no Supabase Storage.";
    }

    return NextResponse.json(
      {
        items,
        parse_source: parseSource,
        ai_warning: aiWarning,
        pdf_url: signedUrl,
        storage_path: uploadSucceeded ? storagePath : null,
        reference_month: referenceMonth,
        store_id: storeId,
        storage_warning: storageWarning,
      },
      { headers: rateHeaders }
    );
  } catch (error) {
    console.error("Erro inesperado em /api/process-pdf:", error);
    return NextResponse.json(
      {
        error:
          "Não foi possível ler o arquivo PDF. Verifique se o documento não está corrompido.",
      },
      { status: 500, headers: rateHeaders }
    );
  }
}
