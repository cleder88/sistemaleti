import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Ignora arquivos estáticos:
     * - _next/static (arquivos estáticos de build)
     * - _next/image (otimização de imagens)
     * - favicon.ico, manifest.json, sw.js, workbox-*.js
     * - arquivos de imagem (.png, .svg, .jpg, .jpeg, .gif, .webp, .ico)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|swe-worker-.*\\.js|workbox-.*\\.js|.*\\.(?:png|svg|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
