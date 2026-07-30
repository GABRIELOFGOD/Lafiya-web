import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/stellar/attestation", () => ({
  getAttestation: vi.fn(),
  DEMO_VERIFIED_RECORD_HASH: "a".repeat(64),
}));

const { mockHeaders } = vi.hoisted(() => ({ mockHeaders: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));

import { getAttestation } from "@/lib/stellar/attestation";
import { clearAllRateLimits } from "@/lib/rate-limit";
import { GET } from "./route";

const VALID_HASH = "b".repeat(64);
const MOCK_ATTESTATION = {
  recordHash: VALID_HASH,
  attester: "GDEMOATTESTERXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  timestamp: 1735689600,
};

describe("Attestation Route Handler", () => {
  beforeEach(() => {
    clearAllRateLimits();
    mockHeaders.mockResolvedValue({
      get: (name: string) => (name === "x-forwarded-for" ? "203.0.113.1" : null),
    });
  });

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

  describe("rate limiting (defense-in-depth)", () => {
    it("blocks with 429 after 5 lookups from the same IP", async () => {
      vi.mocked(getAttestation).mockResolvedValue(null);

      for (let i = 0; i < 5; i++) {
        const response = await GET(
          new Request(`http://localhost/api/attestation/${VALID_HASH}`),
          { params: Promise.resolve({ recordHash: VALID_HASH }) },
        );
        expect(response.status).toBe(200);
      }

      const blocked = await GET(
        new Request(`http://localhost/api/attestation/${VALID_HASH}`),
        { params: Promise.resolve({ recordHash: VALID_HASH }) },
      );

      expect(blocked.status).toBe(429);
      const data = await blocked.json();
      expect(data).toMatchObject({ error: expect.any(String) });
      expect(data.secondsRemaining).toBeGreaterThan(0);
    });

    it("does not consult getAttestation once blocked", async () => {
      vi.mocked(getAttestation).mockResolvedValue(null);

      for (let i = 0; i < 5; i++) {
        await GET(new Request(`http://localhost/api/attestation/${VALID_HASH}`), {
          params: Promise.resolve({ recordHash: VALID_HASH }),
        });
      }
      vi.mocked(getAttestation).mockClear();

      await GET(new Request(`http://localhost/api/attestation/${VALID_HASH}`), {
        params: Promise.resolve({ recordHash: VALID_HASH }),
      });

      expect(getAttestation).not.toHaveBeenCalled();
    });

    it("counts a lookup as an attempt even when it resolves 'verified: true' — a lucky guess must not reset the counter", async () => {
      vi.mocked(getAttestation).mockResolvedValue(MOCK_ATTESTATION);

      for (let i = 0; i < 5; i++) {
        await GET(new Request(`http://localhost/api/attestation/${VALID_HASH}`), {
          params: Promise.resolve({ recordHash: VALID_HASH }),
        });
      }

      const blocked = await GET(
        new Request(`http://localhost/api/attestation/${VALID_HASH}`),
        { params: Promise.resolve({ recordHash: VALID_HASH }) },
      );
      expect(blocked.status).toBe(429);
    });

    it("tracks limits independently per client IP", async () => {
      vi.mocked(getAttestation).mockResolvedValue(null);

      for (let i = 0; i < 5; i++) {
        await GET(new Request(`http://localhost/api/attestation/${VALID_HASH}`), {
          params: Promise.resolve({ recordHash: VALID_HASH }),
        });
      }

      mockHeaders.mockResolvedValue({
        get: (name: string) => (name === "x-forwarded-for" ? "198.51.100.7" : null),
      });

      const fromOtherIp = await GET(
        new Request(`http://localhost/api/attestation/${VALID_HASH}`),
        { params: Promise.resolve({ recordHash: VALID_HASH }) },
      );
      expect(fromOtherIp.status).toBe(200);
    });

    it("400 responses for malformed hashes are not rate-limited attempts", async () => {
      const shortHash = "a".repeat(63);

      for (let i = 0; i < 10; i++) {
        const response = await GET(
          new Request(`http://localhost/api/attestation/${shortHash}`),
          { params: Promise.resolve({ recordHash: shortHash }) },
        );
        expect(response.status).toBe(400);
      }
    });
  });
});
