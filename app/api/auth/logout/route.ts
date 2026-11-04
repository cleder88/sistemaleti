import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch {
    // Mesmo em caso de falha na chamada remota, garante a limpeza local dos cookies
  }

  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();

  const response = NextResponse.json({ success: true });

  for (const cookie of allCookies) {
    if (
      cookie.name.startsWith("sb-") ||
      cookie.name.includes("supabase") ||
      cookie.name.includes("auth-token")
    ) {
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
