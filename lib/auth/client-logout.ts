import { createClient } from "@/lib/supabase/client";
import { isSupabaseAuthCookie } from "@/lib/auth/cookies";

export async function signOutClient(): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch {
    // Prossegue com a limpeza local mesmo se a chamada remota falhar
  }

  try {
    await fetch("/auth/logout", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    // A limpeza de cookies abaixo cobre a falha de rede
  }

  if (typeof document !== "undefined") {
    document.cookie.split(";").forEach((cookie) => {
      const cookieName = cookie.split("=")[0]?.trim();
      if (cookieName && isSupabaseAuthCookie(cookieName)) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/`;
      }
    });
  }
}
