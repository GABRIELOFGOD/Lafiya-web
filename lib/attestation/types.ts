/**
 * Mirrors the planned Soroban Attestation struct (README.md > Soroban Smart
 * Contract Layer). Never carries patient data — only a hash, an attester
 * identity, and a timestamp.
 */
export type Attestation = {
  recordHash: string;
  /** Stellar address of the allowlisted health worker who attested. */
  attester: string;
  /** Unix seconds. */
  timestamp: number;
};
