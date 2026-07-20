import { beforeEach, describe, expect, it, vi } from "vitest";
import { signIn } from "./actions";
import { clearAllRateLimits } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Mock functions hoisted before module imports are processed
const { mockSignInWithPassword, mockHeaders } = vi.hoisted(() => ({
  mockSignInWithPassword: vi.fn(),
  mockHeaders: vi.fn(),
}));

// Mock Supabase Server Client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  })),
}));

// Mock Next.js Navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Mock Next.js Headers
vi.mock("next/headers", () => ({
  headers: mockHeaders,
}));


describe("signIn server action rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllRateLimits();
    
    // Default headers mock returning client IP header
    mockHeaders.mockResolvedValue({
      get: (name: string) => {
        if (name === "x-forwarded-for") return "192.168.1.1";
        return null;
      },
    });
  });

  it("handles successful sign-in, resets attempts, and redirects", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: {} }, error: null });

    const formData = new FormData();
    formData.append("email", "patient@lafiya.com");
    formData.append("password", "correct-password");

    const result = await signIn(undefined, formData);

    expect(result).toBeUndefined(); // redirect doesn't return anything
    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/profile");
  });

  it("handles failed sign-in by returning incorrect email/password error", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: null, error: new Error("Invalid credentials") });

    const formData = new FormData();
    formData.append("email", "patient@lafiya.com");
    formData.append("password", "wrong-password");

    const result = await signIn(undefined, formData);

    expect(result).toEqual({ error: "Incorrect email or password." });
    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("locks out sign-ins after 5 consecutive failed attempts on same email + IP", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: null, error: new Error("Invalid credentials") });

    const formData = new FormData();
    formData.append("email", "patient@lafiya.com");
    formData.append("password", "wrong-password");

    // First 4 attempts: allowed but return error
    for (let i = 0; i < 4; i++) {
      const res = await signIn(undefined, formData);
      expect(res).toEqual({ error: "Incorrect email or password." });
    }
    expect(mockSignInWithPassword).toHaveBeenCalledTimes(4);

    // 5th attempt: triggers lockout
    const res5 = await signIn(undefined, formData);
    expect(res5).toEqual({ error: "Incorrect email or password." });
    expect(mockSignInWithPassword).toHaveBeenCalledTimes(5);

    // 6th attempt: blocked immediately before reaching Supabase
    vi.clearAllMocks();
    const res6 = await signIn(undefined, formData);
    expect(res6.error).toContain("Too many failed sign-in attempts. Please try again in 30 seconds.");
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("keys rate limit by email and IP address combination", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: null, error: new Error("Invalid credentials") });

    // Lockout patient@lafiya.com from IP 192.168.1.1
    mockHeaders.mockResolvedValue({
      get: (name: string) => {
        if (name === "x-forwarded-for") return "192.168.1.1";
        return null;
      },
    });
    
    const formData1 = new FormData();
    formData1.append("email", "patient@lafiya.com");
    formData1.append("password", "wrong-password");

    for (let i = 0; i < 5; i++) {
      await signIn(undefined, formData1);
    }

    // Verify it is blocked on next attempt from same IP
    const blockedRes = await signIn(undefined, formData1);
    expect(blockedRes.error).toContain("Too many failed sign-in attempts.");

    // Same email but from a different IP: should still be allowed to try (and fail normally)
    mockHeaders.mockResolvedValue({
      get: (name: string) => {
        if (name === "x-forwarded-for") return "192.168.1.222";
        return null;
      },
    });
    
    const allowedRes = await signIn(undefined, formData1);
    expect(allowedRes).toEqual({ error: "Incorrect email or password." });

    // Different email from original IP: should still be allowed to try (and fail normally)
    mockHeaders.mockResolvedValue({
      get: (name: string) => {
        if (name === "x-forwarded-for") return "192.168.1.1";
        return null;
      },
    });
    
    const formData2 = new FormData();
    formData2.append("email", "other@lafiya.com");
    formData2.append("password", "wrong-password");
    
    const allowedEmailRes = await signIn(undefined, formData2);
    expect(allowedEmailRes).toEqual({ error: "Incorrect email or password." });
  });

  it("trims and lowercases email to prevent casing and trailing whitespace bypasses", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: null, error: new Error("Invalid credentials") });

    // Failed attempts with different casings and whitespace
    const emails = [
      "patient@lafiya.com",
      " PATIENT@lafiya.com ",
      "patient@LAFIYA.com",
      "Patient@Lafiya.Com",
      "  patient@lafiya.com  ",
    ];

    for (const email of emails) {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", "wrong-password");
      await signIn(undefined, formData);
    }

    // The 6th attempt (even with original casing) should be blocked immediately
    const formData6 = new FormData();
    formData6.append("email", "patient@lafiya.com");
    formData6.append("password", "wrong-password");
    
    vi.clearAllMocks();
    const res = await signIn(undefined, formData6);
    expect(res.error).toContain("Too many failed sign-in attempts.");
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });
});
