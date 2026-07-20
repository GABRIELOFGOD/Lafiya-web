import type { Attestation } from "@/lib/attestation/types";

/**
 * Pre-M1 stub. `lafiya-contracts` (the Soroban attestation registry) hasn't
 * been built or deployed yet, so this is an in-memory mock rather than a
 * real RPC call — see README.md > Soroban Smart Contract Layer. Swap the
 * body for a real `get_attestation` Soroban contract call once that repo
 * ships; the function signature is designed to stay the same so callers
 * (the public card page, the attestation Route Handler) don't need to
 * change.
 */

/** Fixture hash for local dev/demo only — not a real record's hash. */
export const DEMO_VERIFIED_RECORD_HASH = "a".repeat(64);

/**
 * Maximum milliseconds to wait for a Soroban RPC response before treating
 * the attestation lookup as a failure. This timeout fires *inside*
 * `getAttestation`, before the result is returned to callers, so that a
 * hanging RPC endpoint counts toward the circuit-breaker failure threshold
 * and trips the breaker after `failureThreshold` consecutive slow calls.
 *
 * Callers (e.g. the public card page) should treat a rejection from
 * `getAttestation` as "verification status unavailable" rather than a
 * hard error — the card must still render the emergency data.
 */
export const ATTESTATION_TIMEOUT_MS = 2000;

const MOCK_ATTESTATIONS = new Map<string, Attestation>([
  [
    DEMO_VERIFIED_RECORD_HASH,
    {
      recordHash: DEMO_VERIFIED_RECORD_HASH,
      attester: "GDEMOATTESTERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      timestamp: 1735689600,
    },
  ],
]);

/**
 * A simple circuit breaker that prevents cascading latency when a downstream
 * dependency (e.g. the Soroban RPC endpoint) is slow or unavailable.
 *
 * States:
 *  - CLOSED  — normal operation; every call goes through.
 *  - OPEN    — fast-fail; calls are rejected immediately without hitting the
 *              RPC, so card-page latency stays bounded even during outages.
 *  - HALF-OPEN — one probe call is allowed after `cooldownPeriod` ms; a
 *               success closes the breaker, a failure reopens it.
 */
export class CircuitBreaker {
  private state: "CLOSED" | "OPEN" | "HALF-OPEN" = "CLOSED";
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private failureThreshold = 3;
  private cooldownPeriod = 30000; // 30 seconds

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    if (this.state === "OPEN") {
      if (now - this.lastFailureTime >= this.cooldownPeriod) {
        this.state = "HALF-OPEN";
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }

    try {
      const result = await fn();
      this.success();
      return result;
    } catch (error) {
      this.failure();
      throw error;
    }
  }

  private success() {
    this.consecutiveFailures = 0;
    this.state = "CLOSED";
  }

  private failure() {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }

  reset() {
    this.state = "CLOSED";
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
  }
}

export const attestationBreaker = new CircuitBreaker();

export const sorobanClient = {
  getAttestation: async (recordHash: string): Promise<Attestation | null> => {
    return MOCK_ATTESTATIONS.get(recordHash) ?? null;
    // NOTE: replace the body above with the real Soroban RPC call when
    // `lafiya-contracts` ships, e.g.:
    //   return sorobanServer.getAttestation(recordHash);
  },
};

/**
 * Look up a Soroban attestation for the given record hash.
 *
 * Resilience contract:
 *  - The call is wrapped in a circuit breaker (see `CircuitBreaker` above).
 *    After `failureThreshold` consecutive failures or timeouts the breaker
 *    opens and subsequent calls fast-fail immediately, keeping card-page
 *    latency below `ATTESTATION_TIMEOUT_MS` even during an RPC outage.
 *  - A per-call `ATTESTATION_TIMEOUT_MS` deadline is enforced *inside* this
 *    function so that a hanging RPC counts as a failure against the breaker.
 *
 * Callers MUST catch rejections from this function and degrade gracefully
 * (render a "verification status unavailable" badge) rather than letting
 * an attestation-layer outage prevent the card from rendering emergency data.
 */
export async function getAttestation(
  recordHash: string,
): Promise<Attestation | null> {
  return attestationBreaker.execute(async () => {
    let timeoutId: NodeJS.Timeout | undefined;

    const rpcCall = sorobanClient.getAttestation(recordHash);

    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("Attestation RPC timeout")),
        ATTESTATION_TIMEOUT_MS,
      );
    });

    try {
      return await Promise.race([rpcCall, timeout]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  });
}
