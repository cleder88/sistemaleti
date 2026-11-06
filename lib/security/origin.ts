/**
 * Verifica se a requisição veio da mesma origem da aplicação.
 * Requisições sem cabeçalho Origin (ex.: curl/server-to-server) são aceitas.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  const host = request.headers.get("host")?.split(",")[0]?.trim();
  if (host && host === originHost) return true;

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  if (forwardedHost && forwardedHost === originHost) return true;

  try {
    if (new URL(request.url).host === originHost) return true;
  } catch {
    return false;
  }

  return false;
}
