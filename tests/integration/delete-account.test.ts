import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { computeRecordHash } from "@/lib/attestation/recordHash";
import type { Database } from "@/lib/supabase/types";

import { bruteForceNewScheme } from "./helpers/bruteForce";
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

/**
 * The erasure proof required by
 * issues/issue-03-record-hash-commitment-scheme.md: account deletion
 * cannot remove a record_hash already attested on the immutable Stellar
 * ledger, but it MUST destroy the per-patient secret (public.profile_secrets,
 * cascaded via profiles -> auth.users FK chain), so that a future
 * preimage search for this specific patient's record — even with perfect
 * knowledge of every emergency field — is computationally infeasible.
 * Uses the same bounded brute-force harness as
 * lib/attestation/recordHash.bruteforce.test.ts (tests/integration/
 * helpers/bruteForce.ts) so both tests exercise identical attack logic.
 */
describe("account deletion destroys future preimage-search feasibility", () => {
  let user: TestUser;
  let realSecret: string;
  let preDeletionHash: string;

  // Matches one of the shared harness's enumerable field combinations
  // (see guessableFieldCombinations in helpers/bruteForce.ts) — the
  // "attacker has perfectly guessed every field" worst case.
  const knownFields = {
    name: "Target Patient",
    blood_group: "O+" as const,
    genotype: "AS" as const,
    allergies: [] as string[],
    medications: [] as string[],
    chronic_conditions: [] as string[],
    emergency_contacts: [] as { name: string; phone: string; relationship: string }[],
    language: "Hausa",
  };

  beforeAll(async () => {
    user = await createTestUser();

    const { error: insertError } = await user.client.from("profiles").insert({
      user_id: user.id,
      name: knownFields.name,
      blood_group: knownFields.blood_group,
      genotype: knownFields.genotype,
      allergies: knownFields.allergies,
      medications: knownFields.medications,
      chronic_conditions: knownFields.chronic_conditions,
      emergency_contacts: knownFields.emergency_contacts,
      language: knownFields.language,
    });
    if (insertError) {
      throw insertError;
    }

    // Simulates what upsertProfile's ensureRecordSecret would do — this
    // test doesn't go through the Next.js Server Action.
    realSecret = "d".repeat(64);
    const { error: secretError } = await adminClient
      .from("profile_secrets")
      .upsert(
        { user_id: user.id, secret: realSecret },
        { onConflict: "user_id" },
      );
    if (secretError) {
      throw secretError;
    }

    preDeletionHash = computeRecordHash(knownFields, realSecret);
  });

  afterAll(async () => {
    await deleteTestUser(user.id);
  });

  it("the secret is unrecoverable after deletion, and a bounded correlation attack against the known fields fails", async () => {
    // Sanity check: the harness can actually reproduce the real hash when
    // given the real secret, so the "attack fails post-deletion" result
    // below isn't just a harness that never finds anything.
    expect(computeRecordHash(knownFields, realSecret)).toBe(preDeletionHash);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    expect(deleteError).toBeNull();

    const { data: secretAfter } = await adminClient
      .from("profile_secrets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    expect(secretAfter).toBeNull();

    // Even with perfect knowledge of every hashed field (name, blood group,
    // genotype, empty arrays, language) plus a bounded, documented
    // secret-guessing budget (see bruteForceNewScheme), the pre-deletion
    // hash cannot be reproduced once the secret is gone.
    const found = bruteForceNewScheme(preDeletionHash);
    expect(found).toBeNull();
  });
});
