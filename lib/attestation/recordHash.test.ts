import { describe, expect, it, vi, beforeEach } from "vitest";

import type { RecordHashFields } from "./recordHash";

import { computeRecordHash, validateAttestation } from "./recordHash";

// Mock getAttestation at the top level
vi.mock("@/lib/stellar/attestation", () => ({
  getAttestation: vi.fn(),
}));

import { getAttestation } from "@/lib/stellar/attestation";

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
