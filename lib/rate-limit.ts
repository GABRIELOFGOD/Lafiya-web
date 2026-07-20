import { headers } from "next/headers";

interface RateLimitRecord {
  attempts: number;
  blockedUntil: number | null;
}

// Store in globalThis to survive Hot Module Replacement (HMR) during dev
const globalStore = globalThis as unknown as {
  rateLimitStore?: Map<string, RateLimitRecord>;
};

if (!globalStore.rateLimitStore) {
  globalStore.rateLimitStore = new Map<string, RateLimitRecord>();
}

const store = globalStore.rateLimitStore;

export interface RateLimitResult {
  allowed: boolean;
  blockedUntil: Date | null;
  secondsRemaining: number;
}

/**
 * Checks if a given key is currently rate-limited/blocked.
 */
export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const now = Date.now();
  const record = store.get(key);

  if (record && record.blockedUntil && record.blockedUntil > now) {
    const secondsRemaining = Math.ceil((record.blockedUntil - now) / 1000);
    return {
      allowed: false,
      blockedUntil: new Date(record.blockedUntil),
      secondsRemaining,
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
 * Backoff rules:
 * - Attempts 1-4: Allowed, no lockout.
 * - Attempt 5: Locked out for 30 seconds.
 * - Attempts 6+: Locked out with exponential doubling (30s * 2^(attempts-5)) up to a maximum of 15 minutes (900s).
 */
export async function recordFailure(key: string): Promise<void> {
  const now = Date.now();
  const record = store.get(key) || { attempts: 0, blockedUntil: null };

  record.attempts += 1;

  if (record.attempts >= 5) {
    const exponent = record.attempts - 5;
    const durationSeconds = Math.min(900, 30 * Math.pow(2, exponent));
    record.blockedUntil = now + durationSeconds * 1000;
  }

  store.set(key, record);
}

/**
 * Resets the rate limit records for a given key on successful attempt.
 */
export async function recordSuccess(key: string): Promise<void> {
  store.delete(key);
}

/**
 * Helper to clear all rate limits (useful in tests).
 */
export function clearAllRateLimits(): void {
  store.clear();
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
