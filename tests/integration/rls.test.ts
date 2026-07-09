import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "@/lib/supabase/types";

import {
  createTestUser,
  deleteTestUser,
  type TestUser,
} from "./helpers/testUser";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe("profiles RLS", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
  });

  afterAll(async () => {
    // Cascades to each user's profiles row via the FK's ON DELETE CASCADE.
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  it("denies anon direct table access entirely — no GRANT, not just no matching rows", async () => {
    const anon = createClient<Database>(url, anonKey);
    const { data, error } = await anon.from("profiles").select("*");

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("lets an owner insert and read their own row", async () => {
    const { error: insertError } = await userA.client
      .from("profiles")
      .insert({ user_id: userA.id, name: "Owner A" });
    expect(insertError).toBeNull();

    const { data } = await userA.client
      .from("profiles")
      .select("*")
      .eq("user_id", userA.id)
      .maybeSingle();
    expect(data?.name).toBe("Owner A");
  });

  it("lets an owner update their own row", async () => {
    const { error } = await userA.client
      .from("profiles")
      .update({ name: "Owner A Updated" })
      .eq("user_id", userA.id);
    expect(error).toBeNull();

    const { data } = await userA.client
      .from("profiles")
      .select("name")
      .eq("user_id", userA.id)
      .maybeSingle();
    expect(data?.name).toBe("Owner A Updated");
  });

  it("returns no row (not an error) when another user reads it", async () => {
    const { data, error } = await userB.client
      .from("profiles")
      .select("*")
      .eq("user_id", userA.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("denies inserting a row impersonating another user's user_id", async () => {
    const { error } = await userB.client
      .from("profiles")
      .insert({ user_id: userA.id, name: "Hacked" });

    expect(error).not.toBeNull();
  });

  it("silently touches zero rows when updating another user's row", async () => {
    await userB.client
      .from("profiles")
      .update({ name: "Hacked" })
      .eq("user_id", userA.id);

    // RLS filters the row out of the UPDATE's visibility rather than
    // erroring, so the only reliable check is that it was left untouched.
    const { data } = await userA.client
      .from("profiles")
      .select("name")
      .eq("user_id", userA.id)
      .maybeSingle();
    expect(data?.name).toBe("Owner A Updated");
  });
});
