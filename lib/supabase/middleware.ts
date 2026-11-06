import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({
          name,
          value,
          ...options,
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({
          name,
          value,
          ...options,
        });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({
          name,
          value: "",
          ...options,
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({
          name,
          value: "",
          ...options,
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isApiRoute = pathname.startsWith("/api");
  const isAuthLogoutRoute = pathname === "/auth/logout";
  const isPublicWebhook =
    pathname.startsWith("/api/webhooks") ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout";
  const isLoginPage = pathname === "/login" || pathname.startsWith("/login/");
  const isPrivateRoute =
    pathname === "/" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/apresentacao") ||
    pathname.startsWith("/lojas") ||
    pathname.startsWith("/pedidos") ||
    pathname.startsWith("/configuracoes");

  if (isAuthLogoutRoute) {
    return response;
  }

  // Regra de API: bloqueia chamadas não autenticadas em /api/* (exceto webhooks públicos / login / logout)
  if (isApiRoute && !isPublicWebhook && !user) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    );
  }

  // Verifica se o utilizador autenticado possui MFA ativo pendente de verificação (aal1 -> aal2)
  let requiresMfaVerification = false;
  if (user) {
    const { data: aalData } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (
      aalData &&
      aalData.currentLevel === "aal1" &&
      aalData.nextLevel === "aal2"
    ) {
      requiresMfaVerification = true;
    }
  }

  // Regra de Redirecionamento 1: usuário não autenticado (ou com MFA pendente) tentando acessar rota privada -> /login
  if ((!user || requiresMfaVerification) && isPrivateRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    return redirectResponse;
  }

  // Regra de Redirecionamento 2: usuário já totalmente autenticado tentando acessar /login (ou /) -> /dashboard
  if (user && !requiresMfaVerification && (isLoginPage || pathname === "/")) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  // Impede cache de histórico do navegador em rotas privadas para barrar botão Voltar após logout
  if (isPrivateRoute) {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }

  return response;
}
