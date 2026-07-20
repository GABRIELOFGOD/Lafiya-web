import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { serverEnv } from "@/lib/env-server";
import type { Database } from "@/lib/supabase/types";

/**
 * Supabase client for use in Server Components, Server Actions, and Route
 * Handlers. Reads the session from request cookies via RLS as the current
 * user (anon/authenticated role) — never bypasses Row Level Security.
 *
 * Cookie writes are a no-op when called from a Server Component (Next.js
 * only allows writing cookies from Server Actions and Route Handlers);
 * `middleware.ts` is responsible for refreshing the session cookie on every
 * request regardless.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — middleware refreshes the
            // session cookie instead, so this can be safely ignored.
          }
        },
      },
    },
  );
}
