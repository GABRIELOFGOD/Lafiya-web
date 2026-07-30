import { describe, expect, it } from "vitest";

import type { RecordHashFields } from "./recordHash";

import { computeRecordHash } from "./recordHash";

const SECRET_A = "a".repeat(64);
const SECRET_B = "b".repeat(64);

const baseCard: RecordHashFields = {
  name: "Amina Yusuf",
  blood_group: "O+",
  genotype: "AS",
  allergies: ["Penicillin", "Peanuts"],
  medications: ["Insulin"],
  chronic_conditions: ["Asthma"],
  emergency_contacts: [
    { name: "Halima Yusuf", phone: "+2348012345678", relationship: "Mother" },
  ],
  language: "Hausa",
};

describe("computeRecordHash", () => {
  it("is deterministic for identical input", () => {
    expect(computeRecordHash(baseCard, SECRET_A)).toBe(
      computeRecordHash({ ...baseCard }, SECRET_A),
    );
  });

  it("produces a 64-character hex digest", () => {
    const hash = computeRecordHash(baseCard, SECRET_A);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is independent of array field order", () => {
    const reordered: RecordHashFields = {
      ...baseCard,
      allergies: ["Peanuts", "Penicillin"],
    };
    expect(computeRecordHash(baseCard, SECRET_A)).toBe(
      computeRecordHash(reordered, SECRET_A),
    );
  });

  it("changes when a medical fact changes", () => {
    const differentBloodGroup: RecordHashFields = {
      ...baseCard,
      blood_group: "A+",
    };
    expect(computeRecordHash(baseCard, SECRET_A)).not.toBe(
      computeRecordHash(differentBloodGroup, SECRET_A),
    );
  });

  it("changes when emergency contacts change", () => {
    const differentContact: RecordHashFields = {
      ...baseCard,
      emergency_contacts: [
        { name: "Someone Else", phone: "+10000000000", relationship: "Father" },
      ],
    };
    expect(computeRecordHash(baseCard, SECRET_A)).not.toBe(
      computeRecordHash(differentContact, SECRET_A),
    );
  });

  it("changes when only the secret changes, with all fields identical", () => {
    expect(computeRecordHash(baseCard, SECRET_A)).not.toBe(
      computeRecordHash(baseCard, SECRET_B),
    );
  });

  it("rejects a malformed secret", () => {
    expect(() => computeRecordHash(baseCard, "not-hex")).toThrow();
    expect(() => computeRecordHash(baseCard, "ab")).toThrow();
  });
});
