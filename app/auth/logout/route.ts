import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseAuthCookie } from "@/lib/auth/cookies";

async function performLogout(request: NextRequest) {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch {
    // Prossegue com a limpeza de cookies mesmo se a chamada remota falhar
  }

  revalidatePath("/", "layout");

  const loginUrl = new URL("/login", request.url);
  const response = NextResponse.redirect(loginUrl, { status: 302 });

  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (isSupabaseAuthCookie(cookie.name)) {
      cookieStore.delete(cookie.name);
      response.cookies.set({
        name: cookie.name,
        value: "",
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
    }
  }

  return response;
}

export async function POST(request: NextRequest) {
  return await performLogout(request);
}

export async function GET(request: NextRequest) {
  return await performLogout(request);
}
