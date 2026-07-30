import { createHmac } from "node:crypto";

import type { EmergencyCardRow } from "@/lib/supabase/types";

/**
 * The subset of card fields that feed the commitment. `age` is deliberately
 * excluded: EmergencyCardRow.age is derived live from date_of_birth
 * (`extract(year from age(dob))` in get_emergency_card()) and would
 * otherwise silently change every year on the patient's birthday, which
 * would falsely flag an unedited profile as "stale" (see
 * app/(auth)/profile/page.tsx). `photo_url` is excluded for the same
 * cosmetic-not-medical reason it always was.
 *
 * EmergencyCardRow and ProfileRow both already use these exact field
 * names/types for this subset, so either row type can be passed to
 * computeRecordHash directly with no mapping glue.
 */
export type RecordHashFields = Pick<
  EmergencyCardRow,
  | "name"
  | "blood_group"
  | "genotype"
  | "allergies"
  | "medications"
  | "chronic_conditions"
  | "emergency_contacts"
  | "language"
>;

/** Matches the 64-hex-char hex-encoded secret stored in profile_secrets. */
const HEX_SECRET_PATTERN = /^[0-9a-f]{64}$/i;

function canonicalize(fields: RecordHashFields): string {
  return JSON.stringify({
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
}

/**
 * Deterministic HMAC-SHA256 over the emergency-relevant facts of a card,
 * keyed by a per-patient secret (see lib/attestation/recordSecret.ts) —
 * the value attested on-chain (see README.md > Attestation & Trust Layer).
 *
 * This is a commitment scheme, not a plain hash: without `secretHex`
 * (256 bits, held only in the zero-grant `profile_secrets` table), an
 * adversary who has perfectly guessed every hashed field still cannot
 * compute a matching record_hash. This is what resists the low-entropy
 * dictionary/correlation attack described in
 * issues/issue-03-record-hash-commitment-scheme.md — plain SHA-256 over
 * low-entropy fields (bloodGroup: 9 values, genotype: 6, frequently-empty
 * arrays) would not.
 *
 * Array fields are sorted first so field order never changes the hash.
 */
export function computeRecordHash(
  fields: RecordHashFields,
  secretHex: string,
): string {
  if (!HEX_SECRET_PATTERN.test(secretHex)) {
    throw new Error("computeRecordHash: secretHex must be a 64-character hex string");
  }

  const canonical = canonicalize(fields);
  return createHmac("sha256", Buffer.from(secretHex, "hex"))
    .update(canonical)
    .digest("hex");
}
