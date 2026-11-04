"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();

  // Limpa explicitamente todos os cookies de sessão do Supabase
  const cookieStore = cookies();
  for (const cookie of cookieStore.getAll()) {
    if (
      cookie.name.startsWith("sb-") ||
      cookie.name.includes("supabase") ||
      cookie.name.includes("auth-token")
    ) {
      cookieStore.delete(cookie.name);
    }
  }

  revalidatePath("/", "layout");
  redirect("/login");
}
