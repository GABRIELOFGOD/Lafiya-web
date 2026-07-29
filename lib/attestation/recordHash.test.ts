import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import type { EmergencyCardRow } from "@/lib/supabase/types";

import { computeRecordHash, validateAttestation } from "./recordHash";

// Mock getAttestation at the top level
vi.mock("@/lib/stellar/attestation", () => ({
  getAttestation: vi.fn(),
}));

import { getAttestation } from "@/lib/stellar/attestation";

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

describe("validateAttestation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true for a valid attestation", async () => {
    const recordHash = "a".repeat(64);

    vi.mocked(getAttestation).mockResolvedValue({
      recordHash,
      attester: "GATTESTERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      timestamp: 1735689600,
    });

    const result = await validateAttestation(recordHash);
    expect(result).toBe(true);
  });

  it("returns false for a revoked attestation", async () => {
    const recordHash = "a".repeat(64);

    vi.mocked(getAttestation).mockResolvedValue({
      recordHash,
      attester: "GATTESTERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      timestamp: 1735689600,
      revoked: true,
    });

    const result = await validateAttestation(recordHash);
    expect(result).toBe(false);
  });

  it("returns false for an expired attestation", async () => {
    const recordHash = "a".repeat(64);
    const pastExpiry = Math.floor(Date.now() / 1000) - 1000; // 1000 seconds ago

    vi.mocked(getAttestation).mockResolvedValue({
      recordHash,
      attester: "GATTESTERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      timestamp: 1735689600,
      expiry: pastExpiry,
    });

    const result = await validateAttestation(recordHash);
    expect(result).toBe(false);
  });

  it("returns false when attestation is null", async () => {
    const recordHash = "a".repeat(64);

    vi.mocked(getAttestation).mockResolvedValue(null);

    const result = await validateAttestation(recordHash);
    expect(result).toBe(false);
  });
});
