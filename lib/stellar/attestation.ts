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

export async function getAttestation(
  recordHash: string,
): Promise<Attestation | null> {
  return attestationBreaker.execute(async () => {
    return MOCK_ATTESTATIONS.get(recordHash) ?? null;
  });
}
