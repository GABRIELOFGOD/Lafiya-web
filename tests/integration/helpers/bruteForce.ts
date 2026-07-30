import { createHash, randomBytes } from "node:crypto";

import type { RecordHashFields } from "@/lib/attestation/recordHash";
import { computeRecordHash } from "@/lib/attestation/recordHash";
import { BLOOD_GROUPS, GENOTYPES } from "@/lib/validation/profile";

/**
 * Shared brute-force/correlation-attack harness used by both
 * lib/attestation/recordHash.bruteforce.test.ts (a unit-test regression
 * guard) and tests/integration/delete-account.test.ts (the account-deletion
 * erasure proof). Kept in one place so both tests exercise identical
 * enumeration logic — see issues/issue-03-record-hash-commitment-scheme.md.
 *
 * Models a realistic "attacker knows/guesses a target patient's name and
 * medical-category fields, and assumes the common case of empty
 * allergies/medications/chronic-conditions arrays" scenario. `age` is
 * intentionally not part of this dictionary — it's excluded from the hash
 * entirely (see recordHash.ts) precisely because it's a near-zero-cost
 * field for an attacker to guess/know.
 */
const GUESSABLE_NAMES = ["Amina Yusuf", "John Doe", "Target Patient"];
const GUESSABLE_LANGUAGES: (string | null)[] = [null, "Hausa", "English"];

/** Number of random secret guesses tried per field combination when attacking the new (HMAC) scheme. */
export const SECRET_GUESSES_PER_FIELD_COMBO = 200;

/** Every field combination the attack dictionary enumerates (3 x 9 x 6 x 3 = 486). */
export function* guessableFieldCombinations(): Generator<RecordHashFields> {
  for (const name of GUESSABLE_NAMES) {
    for (const blood_group of BLOOD_GROUPS) {
      for (const genotype of GENOTYPES) {
        for (const language of GUESSABLE_LANGUAGES) {
          yield {
            name,
            blood_group,
            genotype,
            allergies: [],
            medications: [],
            chronic_conditions: [],
            emergency_contacts: [],
            language,
          };
        }
      }
    }
  }
}

/**
 * The pre-fix scheme being regression-guarded against: plain, unsalted
 * SHA-256 over the same canonical fields. Reimplemented locally (not
 * imported) since the real computeRecordHash no longer has this code path
 * at all — that's the point of this fix.
 */
export function computeOldSchemeHash(fields: RecordHashFields): string {
  const canonical = JSON.stringify({
    name: fields.name,
    bloodGroup: fields.blood_group,
    genotype: fields.genotype,
    allergies: [...fields.allergies].sort(),
    medications: [...fields.medications].sort(),
    chronicConditions: [...fields.chronic_conditions].sort(),
    emergencyContacts: [...fields.emergency_contacts]
      .map((contact) => ({
        name: contact.name,
        phone: contact.phone,
        relationship: contact.relationship,
      }))
      .sort((a, b) =>
        `${a.name}${a.phone}`.localeCompare(`${b.name}${b.phone}`),
      ),
    language: fields.language,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Attacks the old (plain SHA-256, no secret) scheme: for each guessable
 * field combination, checks whether it reproduces the target hash. No
 * secret is needed at all, so finding a match here is expected — this is
 * the regression guard proving the *harness* has real power, not a rigged
 * always-pass.
 */
export function bruteForceOldScheme(
  targetHash: string,
): RecordHashFields | null {
  for (const fields of guessableFieldCombinations()) {
    if (computeOldSchemeHash(fields) === targetHash) {
      return fields;
    }
  }
  return null;
}

/**
 * Attacks the real, current HMAC scheme: for each guessable field
 * combination — including, deliberately, the exact correct fields, i.e.
 * the attacker is modeled as having perfectly guessed everything except
 * the secret — tries SECRET_GUESSES_PER_FIELD_COMBO uniformly-random
 * 256-bit secret guesses. Total attempts = 486 combos *
 * SECRET_GUESSES_PER_FIELD_COMBO ≈ 10^5, a documented, tiny fraction of
 * the 2^256 secret space (~10^5 / 2^256 ≈ 0) — this is an honest
 * illustration of the entropy-budget argument, not an attempted
 * exhaustive proof.
 */
export function bruteForceNewScheme(
  targetHash: string,
): { fields: RecordHashFields; secretGuess: string } | null {
  for (const fields of guessableFieldCombinations()) {
    for (let i = 0; i < SECRET_GUESSES_PER_FIELD_COMBO; i++) {
      const secretGuess = randomBytes(32).toString("hex");
      if (computeRecordHash(fields, secretGuess) === targetHash) {
        return { fields, secretGuess };
      }
    }
  }
  return null;
}
