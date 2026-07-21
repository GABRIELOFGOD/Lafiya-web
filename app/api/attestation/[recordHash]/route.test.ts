import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/stellar/attestation", () => ({
  getAttestation: vi.fn(),
  DEMO_VERIFIED_RECORD_HASH: "a".repeat(64),
}));

import { getAttestation } from "@/lib/stellar/attestation";
import { GET } from "./route";

const VALID_HASH = "b".repeat(64);
const MOCK_ATTESTATION = {
  recordHash: VALID_HASH,
  attester: "GDEMOATTESTERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  timestamp: 1735689600,
};

describe("Attestation Route Handler", () => {
  it("returns verified true and attestation object for a known valid hash", async () => {
    vi.mocked(getAttestation).mockResolvedValue(MOCK_ATTESTATION);

    const request = new Request(`http://localhost/api/attestation/${VALID_HASH}`);
    const response = await GET(request, {
      params: Promise.resolve({ recordHash: VALID_HASH }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      verified: true,
      attestation: MOCK_ATTESTATION,
    });
  });

  it("returns verified false and null attestation for an unknown valid hash", async () => {
    vi.mocked(getAttestation).mockResolvedValue(null);

    const request = new Request(`http://localhost/api/attestation/${VALID_HASH}`);
    const response = await GET(request, {
      params: Promise.resolve({ recordHash: VALID_HASH }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({
      verified: false,
      attestation: null,
    });
  });

  it("accepts uppercase hex characters due to case-insensitive pattern", async () => {
    const uppercaseHash = "A".repeat(64);
    vi.mocked(getAttestation).mockResolvedValue(null);

    const request = new Request(`http://localhost/api/attestation/${uppercaseHash}`);
    const response = await GET(request, {
      params: Promise.resolve({ recordHash: uppercaseHash }),
    });

    expect(response.status).toBe(200);
    expect(getAttestation).toHaveBeenCalledWith(uppercaseHash);
  });

  describe("malformed hash and regex boundary cases (400 responses)", () => {
    const errorMsg = "recordHash must be a 64-character hex SHA-256 digest";

    it("rejects hash that is too short (63 characters)", async () => {
      const shortHash = "a".repeat(63);
      const request = new Request(`http://localhost/api/attestation/${shortHash}`);
      const response = await GET(request, {
        params: Promise.resolve({ recordHash: shortHash }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ error: errorMsg });
      expect(getAttestation).not.toHaveBeenCalled();
    });

    it("rejects hash that is too long (65 characters)", async () => {
      const longHash = "a".repeat(65);
      const request = new Request(`http://localhost/api/attestation/${longHash}`);
      const response = await GET(request, {
        params: Promise.resolve({ recordHash: longHash }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ error: errorMsg });
      expect(getAttestation).not.toHaveBeenCalled();
    });

    it("rejects hash with non-hex characters (e.g. 'g')", async () => {
      const nonHexHash = "g" + "a".repeat(63);
      const request = new Request(`http://localhost/api/attestation/${nonHexHash}`);
      const response = await GET(request, {
        params: Promise.resolve({ recordHash: nonHexHash }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ error: errorMsg });
      expect(getAttestation).not.toHaveBeenCalled();
    });

    it("rejects empty or missing hash", async () => {
      const request = new Request(`http://localhost/api/attestation/`);
      const response = await GET(request, {
        params: Promise.resolve({ recordHash: "" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({ error: errorMsg });
      expect(getAttestation).not.toHaveBeenCalled();
    });
  });

  it("ensures response shape stability with no unexpected internal fields", async () => {
    vi.mocked(getAttestation).mockResolvedValue(MOCK_ATTESTATION);

    const request = new Request(`http://localhost/api/attestation/${VALID_HASH}`);
    const response = await GET(request, {
      params: Promise.resolve({ recordHash: VALID_HASH }),
    });

    const data = await response.json();
    const keys = Object.keys(data).sort();
    expect(keys).toEqual(["attestation", "verified"]);
  });
});
