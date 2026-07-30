import { describe, expect, it } from "vitest";

import { randomBytes } from "node:crypto";

import { computeRecordHash } from "./recordHash";
import {
  bruteForceNewScheme,
  bruteForceOldScheme,
  computeOldSchemeHash,
  guessableFieldCombinations,
} from "@/tests/integration/helpers/bruteForce";

/**
 * Threat-model regression test for issue-03: proves the low-entropy
 * dictionary/correlation attack described in
 * issues/issue-03-record-hash-commitment-scheme.md actually works against
 * the old (plain SHA-256) scheme, and does not work against the current
 * HMAC-with-secret scheme within the same documented, bounded attack
 * budget. See tests/integration/helpers/bruteForce.ts for the shared
 * enumeration logic and the exact budget accounting.
 */
describe("record hash brute-force resistance", () => {
  it("regression guard: the OLD unsalted scheme IS crackable by a realistic guessing dictionary (this must NOT be how the current scheme behaves)", () => {
    const combos = [...guessableFieldCombinations()];
    const target = combos[Math.floor(combos.length / 2)];
    const targetHash = computeOldSchemeHash(target);

    const found = bruteForceOldScheme(targetHash);

    expect(found).not.toBeNull();
    expect(found).toEqual(target);
  });

  it("the current HMAC scheme resists the same attack: perfect field knowledge plus a bounded, documented secret-guessing budget finds nothing", () => {
    const combos = [...guessableFieldCombinations()];
    // The attacker's exact target — modeling a fully successful field
    // guess, i.e. the worst case for our defense.
    const target = combos[Math.floor(combos.length / 2)];
    const realSecret = randomBytes(32).toString("hex");
    const targetHash = computeRecordHash(target, realSecret);

    const found = bruteForceNewScheme(targetHash);

    expect(found).toBeNull();
  });
});
