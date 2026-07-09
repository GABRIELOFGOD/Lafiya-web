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

export async function getAttestation(
  recordHash: string,
): Promise<Attestation | null> {
  return MOCK_ATTESTATIONS.get(recordHash) ?? null;
}
