import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env";

/**
 * Supabase client for use in Client Components. Session cookies are read
 * and written automatically by @supabase/ssr's browser client.
 */
export function createClient() {
  return createBrowserClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
