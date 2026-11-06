"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseAuthCookie } from "@/lib/auth/cookies";

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();

  // Limpa explicitamente todos os cookies de sessão do Supabase
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (isSupabaseAuthCookie(cookie.name)) {
      cookieStore.delete(cookie.name);
    }
  }

  revalidatePath("/", "layout");
  redirect("/login");
}
