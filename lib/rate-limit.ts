import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";

export interface RateLimitResult {
  allowed: boolean;
  blockedUntil: Date | null;
  secondsRemaining: number;
}

/**
 * Checks if a given key is currently rate-limited/blocked.
 *
 * Backed by the `rate_limits` table (see supabase/migrations) rather than
 * in-process memory: on Vercel, concurrent Server Action invocations are not
 * guaranteed to share a process, so a single shared Postgres row is what
 * actually makes the lockout visible across every instance handling a given
 * key. This is a single indexed (primary key) read.
 */
export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("rate_limits")
    .select("blocked_until")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const blockedUntil = data?.blocked_until
    ? new Date(data.blocked_until).getTime()
    : null;
  const now = Date.now();

  if (blockedUntil && blockedUntil > now) {
    return {
      allowed: false,
      blockedUntil: new Date(blockedUntil),
      secondsRemaining: Math.ceil((blockedUntil - now) / 1000),
    };
  }

  return {
    allowed: true,
    blockedUntil: null,
    secondsRemaining: 0,
  };
}

/**
 * Records a failed attempt for the given key and calculates lockout backoff if necessary.
 *
 * Backoff rules (enforced atomically in Postgres by the
 * rate_limit_record_failure() function — see its migration for details):
 * - Attempts 1-4: Allowed, no lockout.
 * - Attempt 5: Locked out for 30 seconds.
 * - Attempts 6+: Locked out with exponential doubling (30s * 2^(attempts-5)) up to a maximum of 15 minutes (900s).
 *
 * The increment-then-check is done as a single `INSERT ... ON CONFLICT DO
 * UPDATE` statement inside that function, so concurrent failures for the
 * same key (whether from one instance or many) never lose an increment.
 */
export async function recordFailure(key: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("rate_limit_record_failure", {
    p_key: key,
  });

  if (error) {
    throw error;
  }
}

/**
 * Resets the rate limit records for a given key on successful attempt.
 */
export async function recordSuccess(key: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("rate_limits").delete().eq("key", key);

  if (error) {
    throw error;
  }
}

/**
 * Helper to clear all rate limits (useful in tests).
 */
export async function clearAllRateLimits(): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("rate_limits")
    .delete()
    .not("key", "is", null);

  if (error) {
    throw error;
  }
}

/**
 * Resolves the client IP address from the request headers.
 */
export async function getClientIp(): Promise<string> {
  const headersList = await headers();
  // x-forwarded-for is standard on reverse proxies like Vercel, Cloudflare, etc.
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    const ip = forwardedFor.split(",")[0]?.trim();
    if (ip) return ip;
  }
  const realIp = headersList.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "127.0.0.1";
}
