import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/types";
import { checkRateLimit, recordFailure, recordSuccess } from "@/lib/rate-limit";

import { adminClient } from "./helpers/testUser";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function testKey(label: string): string {
  return `test:${label}:${crypto.randomUUID()}`;
}

/** A fresh service-role client + connection, standing in for a request
 * handled by a completely separate serverless instance -- the actual
 * threat model here (see migration comment): under real credential-
 * stuffing traffic, concurrent sign-in attempts for the same key are very
 * likely to land on different Vercel function instances, each of which
 * would have had its own empty in-memory Map under the old implementation.
 */
function newServiceRoleClient() {
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const cleanupKeys = new Set<string>();
function tracked(key: string): string {
  cleanupKeys.add(key);
  return key;
}

afterEach(async () => {
  await Promise.all(
    Array.from(cleanupKeys).map((key) =>
      adminClient.from("rate_limits").delete().eq("key", key),
    ),
  );
  cleanupKeys.clear();
});

describe("rate_limits table", () => {
  it("denies anon direct access entirely -- no GRANT, not just no matching rows", async () => {
    const anon = createClient<Database>(url, anonKey);
    const { data, error } = await anon.from("rate_limits").select("*");

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe("rate_limit_record_failure RPC", () => {
  it("enforces the exact backoff policy: attempts 1-4 unlocked, 5 -> 30s, doubling to a 900s cap", async () => {
    const key = tracked(testKey("policy"));
    // expected lockout seconds for attempts 1..11 (null = not locked out)
    const expectedSeconds = [
      null,
      null,
      null,
      null,
      30,
      60,
      120,
      240,
      480,
      900, // 30 * 2^5 = 960, capped to 900
      900, // stays capped
    ];

    for (let i = 0; i < expectedSeconds.length; i++) {
      const { data, error } = await adminClient
        .rpc("rate_limit_record_failure", { p_key: key })
        .single();

      expect(error).toBeNull();
      expect(data?.attempts).toBe(i + 1);

      const expected = expectedSeconds[i];
      if (expected === null) {
        expect(data?.blocked_until).toBeNull();
      } else {
        const secondsUntil =
          (new Date(data!.blocked_until!).getTime() - Date.now()) / 1000;
        // Generous tolerance for test/network execution time -- we only
        // care that it lands in the right doubling bucket, not to the ms.
        expect(secondsUntil).toBeGreaterThan(expected - 5);
        expect(secondsUntil).toBeLessThanOrEqual(expected);
      }
    }
  });

  it("records exactly N attempts under N concurrent, independent connections for the same key (no lost updates)", async () => {
    const key = tracked(testKey("concurrent"));
    const N = 25;

    const clients = Array.from({ length: N }, () => newServiceRoleClient());
    const results = await Promise.all(
      clients.map((client) =>
        client.rpc("rate_limit_record_failure", { p_key: key }),
      ),
    );

    for (const { error } of results) {
      expect(error).toBeNull();
    }

    const { data, error } = await adminClient
      .from("rate_limits")
      .select("attempts")
      .eq("key", key)
      .single();

    expect(error).toBeNull();
    // The whole point of the INSERT ... ON CONFLICT DO UPDATE: every one of
    // the N concurrent increments is preserved, none clobbered by a
    // concurrent read-modify-write race.
    expect(data?.attempts).toBe(N);
  });

  it("makes a lockout triggered via one client instance immediately visible to a second, independent instance", async () => {
    const key = tracked(testKey("distributed"));
    const instanceA = newServiceRoleClient();
    const instanceB = newServiceRoleClient();

    for (let i = 0; i < 5; i++) {
      const { error } = await instanceA.rpc("rate_limit_record_failure", {
        p_key: key,
      });
      expect(error).toBeNull();
    }

    // instanceB never made a single call for this key before now -- if
    // state lived in a per-instance in-memory Map, this would see nothing.
    const { data, error } = await instanceB
      .from("rate_limits")
      .select("blocked_until")
      .eq("key", key)
      .single();

    expect(error).toBeNull();
    expect(data?.blocked_until).not.toBeNull();
    expect(new Date(data!.blocked_until!).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });
});

describe("lib/rate-limit.ts against the real backend", () => {
  it("allows attempts 1-4, locks out at attempt 5, and clears on success", async () => {
    const key = tracked(testKey("lib-policy"));

    for (let i = 0; i < 4; i++) {
      expect((await checkRateLimit(key)).allowed).toBe(true);
      await recordFailure(key);
    }

    // 5th failure crosses the threshold.
    await recordFailure(key);

    const blocked = await checkRateLimit(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.secondsRemaining).toBeGreaterThan(0);
    expect(blocked.secondsRemaining).toBeLessThanOrEqual(30);

    await recordSuccess(key);
    expect((await checkRateLimit(key)).allowed).toBe(true);
  });

  it("gives a completely separate call a consistent, immediately-visible lockout (no per-call in-process state to go stale)", async () => {
    const key = tracked(testKey("lib-distributed"));

    // Every call below constructs its own admin client from scratch
    // (createAdminClient() is called fresh inside each of checkRateLimit/
    // recordFailure) -- there is no shared in-process Map to accidentally
    // rely on, so "distributed" here is the normal, only mode of operation.
    for (let i = 0; i < 5; i++) {
      await recordFailure(key);
    }

    expect((await checkRateLimit(key)).allowed).toBe(false);
  });

  it("documents the added latency on the sign-in happy path", async () => {
    const iterations = 10;
    const timingsMs: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const key = tracked(testKey(`latency-${i}`));
      const start = performance.now();
      await checkRateLimit(key);
      await recordSuccess(key); // mirrors the successful sign-in path
      timingsMs.push(performance.now() - start);
    }

    const avgMs = timingsMs.reduce((a, b) => a + b, 0) / timingsMs.length;
    console.log(
      `[rate-limit latency] checkRateLimit+recordSuccess round trip: avg=${avgMs.toFixed(1)}ms over ${iterations} runs against local Supabase (min=${Math.min(...timingsMs).toFixed(1)}ms, max=${Math.max(...timingsMs).toFixed(1)}ms)`,
    );

    // Generous bound so this documents a regression rather than flaking on
    // CI/network jitter -- each call is a single indexed primary-key
    // lookup or delete, not a scan.
    expect(avgMs).toBeLessThan(500);
  });
});
