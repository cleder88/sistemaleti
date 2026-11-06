const SUPABASE_COOKIE_PREFIXES = ["sb-"];
const SUPABASE_COOKIE_FRAGMENTS = ["supabase", "auth-token"];

export function isSupabaseAuthCookie(name: string): boolean {
  if (!name) return false;
  return (
    SUPABASE_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix)) ||
    SUPABASE_COOKIE_FRAGMENTS.some((fragment) => name.includes(fragment))
  );
}
