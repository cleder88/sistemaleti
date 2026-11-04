import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key",
    {
      cookies: {
        async getAll() {
          const cookieStore = await cookies();
          return cookieStore.getAll();
        },
        async setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[]
        ) {
          try {
            const cookieStore = await cookies();
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignorado quando chamado a partir de um Server Component.
          }
        },
      },
    }
  );
}
