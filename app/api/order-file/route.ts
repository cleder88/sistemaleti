import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  getClientIp,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORAGE_PATH_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/\d{4}-\d{2}-\d{2}\/[^/]+$/i;
const SIGNED_URL_TTL_SECONDS = 60;
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

/**
 * Gera uma URL assinada de curta duração para o PDF de um pedido.
 * A leitura direta do bucket por utilizadores autenticados foi removida na
 * migration 011; o servidor valida a sessão e assina apenas o caminho guardado
 * no próprio pedido.
 */
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit({
    key: `order-file:${user.id}:${getClientIp(request)}`,
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

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("order_id")?.trim() ?? "";

  if (!UUID_REGEX.test(orderId)) {
    return NextResponse.json(
      { error: "Pedido inválido." },
      { status: 400, headers }
    );
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("id, pdf_url")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível consultar o pedido." },
      { status: 500, headers }
    );
  }

  if (!order?.pdf_url) {
    return NextResponse.json({ url: null }, { headers });
  }

  const rawRef = String(order.pdf_url).trim();
  let storagePath = rawRef;

  const bucketMarker = "/order-files/";
  const markerIndex = rawRef.indexOf(bucketMarker);
  if (markerIndex !== -1) {
    storagePath = rawRef
      .slice(markerIndex + bucketMarker.length)
      .split("?")[0];
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(rawRef)) {
    // Bloqueia URLs externas, data:, javascript: e afins.
    return NextResponse.json({ url: null }, { headers });
  }

  if (!STORAGE_PATH_REGEX.test(storagePath)) {
    return NextResponse.json({ url: null }, { headers });
  }

  const admin = createAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from("order-files")
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json({ url: null }, { headers });
  }

  return NextResponse.json(
    { url: signed.signedUrl },
    { headers: { ...headers, "Cache-Control": "no-store" } }
  );
}
