import { describe, expect, it, vi } from "vitest";
import {
  ATTESTATION_TIMEOUT_MS,
  CircuitBreaker,
  DEMO_VERIFIED_RECORD_HASH,
  attestationBreaker,
  getAttestation,
} from "./attestation";

describe("CircuitBreaker", () => {
  it("allows execution under normal circumstances (CLOSED state)", async () => {
    const breaker = new CircuitBreaker();
    const mockFn = vi.fn().mockResolvedValue("success");

    const result = await breaker.execute(mockFn);
    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("trips and fast-fails after failureThreshold (3 consecutive failures)", async () => {
    const breaker = new CircuitBreaker();
    const failingFn = vi.fn().mockRejectedValue(new Error("RPC Error"));

    // 1st failure
    await expect(breaker.execute(failingFn)).rejects.toThrow("RPC Error");
    // 2nd failure
    await expect(breaker.execute(failingFn)).rejects.toThrow("RPC Error");
    // 3rd failure (trips the breaker)
    await expect(breaker.execute(failingFn)).rejects.toThrow("RPC Error");

    // 4th execution - should fast-fail immediately without calling function
    const mockFn = vi.fn().mockResolvedValue("success");
    await expect(breaker.execute(mockFn)).rejects.toThrow(
      "Circuit breaker is OPEN",
    );
    expect(mockFn).not.toHaveBeenCalled();
  });

  it("resets to CLOSED after success in HALF-OPEN state", async () => {
    const breaker = new CircuitBreaker();
    vi.useFakeTimers();

    const failingFn = vi.fn().mockRejectedValue(new Error("RPC Error"));
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(failingFn)).rejects.toThrow("RPC Error");
    }

    // Breaker is now OPEN. Fast-fail check.
    const mockFn = vi.fn().mockResolvedValue("success");
    await expect(breaker.execute(mockFn)).rejects.toThrow(
      "Circuit breaker is OPEN",
    );

    // Fast-forward cooldown period (30 seconds)
    vi.advanceTimersByTime(30000);

    // Should allow execution once (HALF-OPEN state)
    const result = await breaker.execute(mockFn);
    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(1);

    // Should be CLOSED again, allowing normal calls
    const result2 = await breaker.execute(mockFn);
    expect(result2).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

describe("getAttestation", () => {
  it("returns the attestation for the demo verified hash", async () => {
    // Reset the shared breaker state between tests
    attestationBreaker.reset();

    const attestation = await getAttestation(DEMO_VERIFIED_RECORD_HASH);
    expect(attestation).not.toBeNull();
    expect(attestation?.recordHash).toBe(DEMO_VERIFIED_RECORD_HASH);
  });

  it("returns null for an unknown hash (not_verified path)", async () => {
    attestationBreaker.reset();

    const attestation = await getAttestation("b".repeat(64));
    expect(attestation).toBeNull();
  });

  it("rejects with a timeout error when the RPC hangs, and counts toward the circuit-breaker failure threshold", async () => {
    // This test validates the core resilience contract: a hanging RPC must
    // not hold up the card page indefinitely, and each timeout must register
    // as a failure so the circuit breaker trips after repeated outages.
    vi.useFakeTimers();
    attestationBreaker.reset();

    // Patch the module-level MOCK_ATTESTATIONS lookup to simulate a hanging
    // RPC by making the underlying promise never resolve within the timeout.
    // We do this by using a real spy on the module: instead we verify the
    // timeout via the exported ATTESTATION_TIMEOUT_MS constant and fake timers.
    const hangingCall = getAttestation("c".repeat(64));

    // Advance past the internal deadline
    await vi.advanceTimersByTimeAsync(ATTESTATION_TIMEOUT_MS);

    await expect(hangingCall).rejects.toThrow("Attestation RPC timeout");

    vi.useRealTimers();
  });

  it("fast-fails immediately when the circuit breaker is OPEN (protects page latency during outages)", async () => {
    vi.useFakeTimers();
    attestationBreaker.reset();

    // Trip the breaker: 3 consecutive timeouts
    for (let i = 0; i < 3; i++) {
      const call = getAttestation("d".repeat(64));
      await vi.advanceTimersByTimeAsync(ATTESTATION_TIMEOUT_MS);
      await expect(call).rejects.toThrow("Attestation RPC timeout");
    }

    vi.useRealTimers();

    // The breaker is now OPEN; the next call must reject instantly without
    // waiting for any timeout, keeping card-page render latency bounded.
    const start = Date.now();
    await expect(getAttestation("e".repeat(64))).rejects.toThrow(
      "Circuit breaker is OPEN",
    );
    // Should complete far under 100ms (no timer involved)
    expect(Date.now() - start).toBeLessThan(100);
  });
});
