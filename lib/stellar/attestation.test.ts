import { describe, expect, it, vi } from "vitest";
import { CircuitBreaker } from "./attestation";

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
    await expect(breaker.execute(mockFn)).rejects.toThrow("Circuit breaker is OPEN");
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
    await expect(breaker.execute(mockFn)).rejects.toThrow("Circuit breaker is OPEN");

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
