import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client (RLS-enforced). Use in Client Components. */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
