import { describe, expect, it } from "vitest";

import type { EmergencyCardRow } from "@/lib/supabase/types";

import { computeRecordHash } from "./recordHash";

const baseCard: EmergencyCardRow = {
  name: "Amina Yusuf",
  age: 28,
  photo_url: "https://example.com/photo.png",
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
    expect(computeRecordHash(baseCard)).toBe(
      computeRecordHash({ ...baseCard }),
    );
  });

  it("produces a 64-character hex SHA-256 digest", () => {
    const hash = computeRecordHash(baseCard);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is independent of array field order", () => {
    const reordered: EmergencyCardRow = {
      ...baseCard,
      allergies: ["Peanuts", "Penicillin"],
    };
    expect(computeRecordHash(baseCard)).toBe(computeRecordHash(reordered));
  });

  it("ignores photo_url changes", () => {
    const differentPhoto: EmergencyCardRow = {
      ...baseCard,
      photo_url: "https://example.com/different.png",
    };
    expect(computeRecordHash(baseCard)).toBe(computeRecordHash(differentPhoto));
  });

  it("changes when a medical fact changes", () => {
    const differentBloodGroup: EmergencyCardRow = {
      ...baseCard,
      blood_group: "A+",
    };
    expect(computeRecordHash(baseCard)).not.toBe(
      computeRecordHash(differentBloodGroup),
    );
  });

  it("changes when emergency contacts change", () => {
    const differentContact: EmergencyCardRow = {
      ...baseCard,
      emergency_contacts: [
        { name: "Someone Else", phone: "+10000000000", relationship: "Father" },
      ],
    };
    expect(computeRecordHash(baseCard)).not.toBe(
      computeRecordHash(differentContact),
    );
  });
});
