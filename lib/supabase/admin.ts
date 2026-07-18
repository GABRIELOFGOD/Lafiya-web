import { createClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Creates a Supabase client that bypasses RLS using the service role key.
 * Only use this on the server side (Server Actions, API routes).
 */
export function createAdminClient() {
  return createClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
