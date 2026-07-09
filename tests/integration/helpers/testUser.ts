import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Bypasses RLS — only used here to create/delete throwaway test users. */
export const adminClient: SupabaseClient<Database> = createClient(
  url,
  serviceRoleKey,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export interface TestUser {
  id: string;
  email: string;
  /** RLS-scoped client, signed in as this user — use this for all assertions. */
  client: SupabaseClient<Database>;
}

/** Creates a throwaway auth user and returns an RLS-scoped client for it. */
export async function createTestUser(): Promise<TestUser> {
  const email = `test-${crypto.randomUUID()}@example.com`;
  const password = "test-password-123456";

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw error ?? new Error("Failed to create test user");
  }

  const client = createClient<Database>(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    throw signInError;
  }

  return { id: data.user.id, email, client };
}

export async function deleteTestUser(userId: string): Promise<void> {
  await adminClient.auth.admin.deleteUser(userId);
}
