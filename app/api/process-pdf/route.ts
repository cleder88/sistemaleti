import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { parseOrderPdfText } from "@/lib/pdf-parser";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  getClientIp,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const PDF_RATE_LIMIT_MAX = 15; // 15 processamentos por janela de 15 min por IP
const PDF_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit({
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
            "Formato de ficheiro inválido. Apenas ficheiros com extensão .pdf e tipo MIME application/pdf são permitidos.",
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

    // 4. Converte o arquivo em Buffer e valida a assinatura binária (Magic Bytes %PDF-)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const pdfSignature = buffer.subarray(0, 5).toString("ascii");
    if (pdfSignature !== "%PDF-") {
      return NextResponse.json(
        {
          error:
            "Assinatura binária inválida. O ficheiro enviado não é um documento PDF autêntico.",
        },
        { status: 400, headers: rateHeaders }
      );
    }

    let rawText = "";
    try {
      const parsedPdf = await pdfParse(buffer);
      rawText = parsedPdf.text ?? "";
    } catch (pdfError) {
      console.error("Erro ao extrair texto do PDF:", pdfError);
      return NextResponse.json(
        {
          error:
            "Não foi possível ler o conteúdo do arquivo PDF. Verifique se o arquivo não está corrompido ou protegido por senha.",
        },
        { status: 422, headers: rateHeaders }
      );
    }

    // 5. Processa e sanitiza linha por linha do texto bruto
    const items = parseOrderPdfText(rawText);

    // 6. Faz o upload do PDF original para o bucket PRIVADO 'order-files'
    const sanitizedName = file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 120);
    const storagePath = `${storeId}/${referenceMonth}/${Date.now()}-${sanitizedName}`;

    let pdfUrl: string | null = null;
    let storageWarning: string | null = null;

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

      // Caso o bucket ainda não exista e estejamos com Service Role, cria como PRIVADO (public: false)
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
        // Gera URL assinada temporária (válida por 7 dias) para bucket privado
        const { data: signedUrlData } = await supabase.storage
          .from("order-files")
          .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

        pdfUrl = signedUrlData?.signedUrl ?? storagePath;
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
        pdf_url: pdfUrl,
        storage_path: storagePath,
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
          error instanceof Error
            ? error.message
            : "Erro interno ao processar o PDF.",
      },
      { status: 500, headers: rateHeaders }
    );
  }
}
