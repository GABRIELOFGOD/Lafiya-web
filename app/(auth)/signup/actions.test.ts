import { describe, it, expect, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";

import { signUp } from "./actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/logging/logger", () => ({
  logError: vi.fn(),
}));

describe("signUp server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject signup when consent checkbox is missing", async () => {
    const formData = new FormData();
    formData.append("email", "test@example.com");
    formData.append("password", "password123");

    const result = await signUp(undefined, formData);

    expect(result).toEqual({
      error: "You must accept the privacy notice to create an account",
    });
    expect(createClient).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("should return error if auth signup fails", async () => {
    const formData = new FormData();
    formData.append("email", "test@example.com");
    formData.append("password", "password123");
    formData.append("consent", "on");

    const mockAuthSignUp = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: new Error("Auth failed"),
    });
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockAuthSignUp },
    } as any);

    const result = await signUp(undefined, formData);

    expect(result).toEqual({ error: "Auth failed" });
    expect(mockAuthSignUp).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("should rollback user creation and return error if consent log insertion fails", async () => {
    const formData = new FormData();
    formData.append("email", "test@example.com");
    formData.append("password", "password123");
    formData.append("consent", "on");

    const mockAuthSignUp = vi.fn().mockResolvedValue({
      data: { user: { id: "test-user-id" }, session: null },
      error: null,
    });
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockAuthSignUp },
    } as any);

    const mockInsert = vi.fn().mockResolvedValue({
      error: new Error("Db insert failed"),
    });
    const mockDeleteUser = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createAdminClient).mockReturnValue({
      from: () => ({
        insert: mockInsert,
      }),
      auth: {
        admin: {
          deleteUser: mockDeleteUser,
        },
      },
    } as any);

    const result = await signUp(undefined, formData);

    expect(result).toEqual({
      error: "Failed to record consent. Please try again.",
    });
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "test-user-id",
      policy_version: "ndpa-2023-v1",
    });
    expect(mockDeleteUser).toHaveBeenCalledWith("test-user-id");
  });

  it("should succeed and redirect when email, password, and consent are valid and session is present", async () => {
    const formData = new FormData();
    formData.append("email", "test@example.com");
    formData.append("password", "password123");
    formData.append("consent", "on");

    const mockAuthSignUp = vi.fn().mockResolvedValue({
      data: { user: { id: "test-user-id" }, session: { id: "session-id" } },
      error: null,
    });
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockAuthSignUp },
    } as any);

    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createAdminClient).mockReturnValue({
      from: () => ({
        insert: mockInsert,
      }),
    } as any);

    await signUp(undefined, formData);

    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "test-user-id",
      policy_version: "ndpa-2023-v1",
    });
    expect(redirect).toHaveBeenCalledWith("/profile");
  });

  it("should succeed and return info when session is null (email confirmation required)", async () => {
    const formData = new FormData();
    formData.append("email", "test@example.com");
    formData.append("password", "password123");
    formData.append("consent", "on");

    const mockAuthSignUp = vi.fn().mockResolvedValue({
      data: { user: { id: "test-user-id" }, session: null },
      error: null,
    });
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockAuthSignUp },
    } as any);

    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createAdminClient).mockReturnValue({
      from: () => ({
        insert: mockInsert,
      }),
    } as any);

    const result = await signUp(undefined, formData);

    expect(result).toEqual({
      info: "Check your email to confirm your account, then sign in.",
    });
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "test-user-id",
      policy_version: "ndpa-2023-v1",
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
