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
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const adminClient = createClient<Database>(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

describe("account deletion", () => {
  let user: TestUser;
  let cardPublicId: string;
  const storagePath = "test-avatar.png";

  beforeAll(async () => {
    user = await createTestUser();

    const { data, error } = await user.client
      .from("profiles")
      .insert({
        user_id: user.id,
        name: "Delete Test Patient",
        date_of_birth: "1995-06-15",
        blood_group: "A+",
        genotype: "AA",
        allergies: ["Sulfa"],
        medications: ["Metformin"],
        chronic_conditions: ["Diabetes"],
        emergency_contacts: [
          {
            name: "Emergency Contact",
            phone: "+20000000000",
            relationship: "Spouse",
          },
        ],
        language: "French",
      })
      .select("card_public_id")
      .single();

    if (error || !data) {
      throw error ?? new Error("Failed to seed profile");
    }
    cardPublicId = data.card_public_id;

    const { error: uploadError } = await adminClient.storage
      .from("avatars")
      .upload(`${user.id}/${storagePath}`, new Blob(["fake-image-data"]), {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }
  });

  afterAll(async () => {
    // Best-effort cleanup if a test failed before deletion happened.
    await adminClient.storage.from("avatars").remove([`${user.id}/${storagePath}`]);
    await deleteTestUser(user.id);
  });

  it("deletes the profile row, the auth user, and storage objects, and the old card 404s", async () => {
    // 1. Confirm the profile exists before deletion.
    const { data: profileBefore } = await adminClient
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    expect(profileBefore).not.toBeNull();

    // 2. Confirm storage object exists.
    const { data: objectsBefore } = await adminClient.storage
      .from("avatars")
      .list(user.id);
    expect(objectsBefore).toHaveLength(1);

    // 3. Delete the auth user (same as what the server action does —
    //    auth.admin.deleteUser). This cascades to the profile row.
    const { error: deleteError } =
      await adminClient.auth.admin.deleteUser(user.id);
    expect(deleteError).toBeNull();

    // 4. Profile row is gone (cascade delete).
    const { data: profileAfter } = await adminClient
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    expect(profileAfter).toBeNull();

    // 5. Storage object is gone (explicitly cleaned up).
    const { data: objectsAfter } = await adminClient.storage
      .from("avatars")
      .list(user.id);
    expect(objectsAfter).toHaveLength(0);

    // 6. Auth user is gone — sign-in fails.
    const { error: signInError } = await createClient<Database>(
      url,
      anonKey,
    ).auth.signInWithPassword({
      email: user.email,
      password: "test-password-123456",
    });
    expect(signInError).not.toBeNull();

    // 7. Public emergency card RPC returns empty for the old card_public_id.
    const anon = createClient<Database>(url, anonKey);
    const { data: cardData, error: cardError } = await anon.rpc(
      "get_emergency_card",
      { p_card_id: cardPublicId },
    );
    expect(cardError).toBeNull();
    expect(cardData).toEqual([]);
  });
});
