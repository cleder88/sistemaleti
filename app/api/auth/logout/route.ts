import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseAuthCookie } from "@/lib/auth/cookies";

export async function POST() {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch {
    // Mesmo em caso de falha na chamada remota, garante a limpeza local dos cookies
  }

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  const response = NextResponse.json({ success: true });

  for (const cookie of allCookies) {
    if (isSupabaseAuthCookie(cookie.name)) {
      cookieStore.delete(cookie.name);
      response.cookies.set({
        name: cookie.name,
        value: "",
        path: "/",
        maxAge: 0,
      });
    }
  }

  return response;
}
