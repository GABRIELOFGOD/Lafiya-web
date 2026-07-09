import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverEnvSchema = clientEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STELLAR_NETWORK_PASSPHRASE: z.string().min(1),
  SOROBAN_RPC_URL: z.url(),
  ATTESTATION_CONTRACT_ID: z.string().optional(),
});

/**
 * Client-safe environment variables. Import this from code that can run in
 * the browser (Client Components, `lib/supabase/client.ts`).
 */
export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

/**
 * Full environment, including server-only secrets. Never import this from a
 * file that can be bundled into client JavaScript.
 */
export const serverEnv = serverEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  STELLAR_NETWORK_PASSPHRASE: process.env.STELLAR_NETWORK_PASSPHRASE,
  SOROBAN_RPC_URL: process.env.SOROBAN_RPC_URL,
  ATTESTATION_CONTRACT_ID: process.env.ATTESTATION_CONTRACT_ID,
});
