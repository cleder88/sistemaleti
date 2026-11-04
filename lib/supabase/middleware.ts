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
  const isPublicWebhook =
    pathname.startsWith("/api/webhooks") || pathname === "/api/auth/logout";
  const isLoginPage = pathname === "/login" || pathname.startsWith("/login/");
  const isPrivateRoute =
    pathname === "/" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/lojas") ||
    pathname.startsWith("/pedidos");

  // Regra de API: bloqueia chamadas não autenticadas em /api/* (exceto webhooks públicos)
  if (isApiRoute && !isPublicWebhook && !user) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    );
  }

  // Regra de Redirecionamento 1: usuário não autenticado tentando acessar rota privada -> /login
  if (!user && isPrivateRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Regra de Redirecionamento 2: usuário já autenticado tentando acessar /login (ou /) -> /dashboard
  if (user && (isLoginPage || pathname === "/")) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}
