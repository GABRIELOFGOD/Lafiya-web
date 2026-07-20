import { beforeEach, describe, expect, vi } from "vitest";

import { upsertProfile } from "./actions";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));

const mockCreateClient =
  await import("@/lib/supabase/server") as Promise<typeof import("@/lib/supabase/server")>;

describe("upsertProfile optimistic concurrency", () => {
  const authUser = { id: crypto.randomUUID() };

  beforeEach(() => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const mockMaybeSingle = vi
      .fn()
      .mockResolvedValue({
        data: { user_id: authUser.id, updated_at: "now" },
      });
    const mockSelect = vi.fn().mockReturnValue({
      maybeSingle: mockMaybeSingle,
    });
    const mockFrom = vi.fn().mockReturnValue({
      select: mockSelect,
      upsert: mockUpsert,
    });

    (mockCreateClient.createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: authUser },
        }),
      },
      from: mockFrom,
    });
  });

  const staleFormData = (expected: string, name = "New Name") => {
    const data = new FormData();
    data.set("expectedUpdatedAt", expected);
    data.set("name", name);
    return data;
  };

  it("returns a conflict error when updated_at changed since form was loaded", async () => {
    (mockCreateClient.createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: authUser },
        }),
      },
      from() {
        return {
          select() {
            return {
              maybeSingle() {
                return Promise.resolve({ data: { user_id: authUser.id, updated_at: "newer" } });
              },
            };
          },
        };
      },
    });

    const result = await upsertProfile(undefined, staleFormData("stale"));

    expect(result).toEqual({
      error:
        "This profile was updated elsewhere since you loaded this page. Reload and reapply your changes before saving.",
    });
  });

  it("allows a save when the submitted updated_at matches the current row", async () => {
    let upsertCalls = 0;
    (mockCreateClient.createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: authUser },
        }),
      },
      from() {
        return {
          select() {
            return {
              maybeSingle() {
                return Promise.resolve({ data: { user_id: authUser.id, updated_at: "now" } });
              },
            };
          },
          upsert() {
            upsertCalls += 1;
            return Promise.resolve({ error: null });
          },
        };
      },
    });

    const result = await upsertProfile(undefined, staleFormData("now"));

    expect(result).toEqual({ success: true });
    expect(upsertCalls).toBe(1);
  });
});
