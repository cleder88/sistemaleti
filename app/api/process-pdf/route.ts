import { NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { parseOrderPdfText } from "@/lib/pdf-parser";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const storeId = String(formData.get("store_id") ?? "").trim();
    const rawMonth = String(formData.get("reference_month") ?? "").trim();

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Arquivo PDF não enviado ou inválido." },
        { status: 400 }
      );
    }

    if (!storeId) {
      return NextResponse.json(
        { error: "Selecione uma loja antes de processar o PDF." },
        { status: 400 }
      );
    }

    if (!rawMonth) {
      return NextResponse.json(
        { error: "Informe o mês de referência (YYYY-MM-01)." },
        { status: 400 }
      );
    }

    // Garante formato YYYY-MM-01
    const referenceMonth =
      /^\d{4}-\d{2}$/.test(rawMonth) ? `${rawMonth}-01` : rawMonth;

    // 1. Converte o arquivo em Buffer e extrai o texto bruto com pdf-parse
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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
        { status: 422 }
      );
    }

    // 2. Processa linha por linha do texto bruto com Regex
    const items = parseOrderPdfText(rawText);

    // 3. Faz o upload do PDF original para o Supabase Storage no bucket 'order-files'
    const sanitizedName = file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
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
          contentType: file.type || "application/pdf",
          upsert: true,
        });

      // Caso o bucket ainda não exista e estejamos com Service Role, tenta criá-lo automaticamente
      if (
        uploadError &&
        process.env.SUPABASE_SERVICE_ROLE_KEY &&
        uploadError.message.toLowerCase().includes("bucket")
      ) {
        const adminClient = createAdminClient();
        await adminClient.storage.createBucket("order-files", {
          public: true,
          fileSizeLimit: 20 * 1024 * 1024,
        });

        const retry = await adminClient.storage
          .from("order-files")
          .upload(storagePath, buffer, {
            contentType: file.type || "application/pdf",
            upsert: true,
          });
        uploadError = retry.error;
      }

      if (uploadError) {
        storageWarning = `Aviso no upload do PDF para o bucket 'order-files': ${uploadError.message}`;
      } else {
        const { data: publicUrlData } = supabase.storage
          .from("order-files")
          .getPublicUrl(storagePath);
        pdfUrl = publicUrlData.publicUrl;
      }
    } catch (storageErr) {
      storageWarning =
        storageErr instanceof Error
          ? storageErr.message
          : "Não foi possível salvar o PDF no Supabase Storage.";
    }

    return NextResponse.json({
      items,
      pdf_url: pdfUrl,
      storage_path: storagePath,
      reference_month: referenceMonth,
      store_id: storeId,
      storage_warning: storageWarning,
    });
  } catch (error) {
    console.error("Erro inesperado em /api/process-pdf:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro interno ao processar o PDF.",
      },
      { status: 500 }
    );
  }
}
