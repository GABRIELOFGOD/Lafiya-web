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

// Minimal valid 1x1 PNG (67 bytes) — real PNG magic bytes/IHDR, not just an
// arbitrary buffer with a spoofed extension. Storage's allowed_mime_types
// check is against the client-declared contentType, but using genuine PNG
// bytes keeps this fixture honest and reusable if that ever changes.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function pngBlob(): Blob {
  const bytes = Buffer.from(PNG_BASE64, "base64");
  return new Blob([bytes], { type: "image/png" });
}

function oversizedBlob(): Blob {
  // 5 MiB limit — one byte over.
  return new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], {
    type: "image/png",
  });
}

function disallowedMimeBlob(): Blob {
  return new Blob([new Uint8Array(10)], { type: "application/pdf" });
}

describe("avatars storage RLS", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    userA = await createTestUser();
    userB = await createTestUser();
  });

  afterAll(async () => {
    // Best-effort cleanup — objects under a deleted user's path aren't
    // reachable via their own client anymore, so remove them first.
    await userA.client.storage
      .from("avatars")
      .remove([`${userA.id}/photo.png`]);
    await deleteTestUser(userA.id);
    await deleteTestUser(userB.id);
  });

  it("denies anon direct storage access to a private-looking upload path", async () => {
    const anon = createClient<Database>(url, anonKey);
    const { error } = await anon.storage
      .from("avatars")
      .upload(`${userA.id}/photo.png`, pngBlob(), {
        contentType: "image/png",
      });

    expect(error).not.toBeNull();
  });

  it("lets an owner upload to their own {user_id}/ path", async () => {
    const { error } = await userA.client.storage
      .from("avatars")
      .upload(`${userA.id}/photo.png`, pngBlob(), {
        contentType: "image/png",
      });

    expect(error).toBeNull();
  });

  it("lets an owner overwrite (upsert) their own existing object", async () => {
    // Exercises the upsert-overwrite path specifically — this is the
    // documented rationale for avatar_select_own existing at all: without
    // it, Postgres rejects the whole upsert statement under RLS even
    // though the conflicting row belongs to the same user.
    const { error } = await userA.client.storage
      .from("avatars")
      .upload(`${userA.id}/photo.png`, pngBlob(), {
        upsert: true,
        contentType: "image/png",
      });

    expect(error).toBeNull();
  });

  it("denies uploading into another user's path", async () => {
    const { error } = await userB.client.storage
      .from("avatars")
      .upload(`${userA.id}/photo.png`, pngBlob(), {
        upsert: true,
        contentType: "image/png",
      });

    expect(error).not.toBeNull();
  });

  it("denies updating (non-upsert overwrite) another user's object", async () => {
    // A second upload without upsert against an existing path exercises
    // the UPDATE policy path rather than INSERT.
    const { error } = await userB.client.storage
      .from("avatars")
      .update(`${userA.id}/photo.png`, pngBlob(), {
        contentType: "image/png",
      });

    expect(error).not.toBeNull();
  });

  it("denies deleting another user's object", async () => {
    const { data, error } = await userB.client.storage
      .from("avatars")
      .remove([`${userA.id}/photo.png`]);

    // Storage's remove() on a row hidden by RLS reports success with an
    // empty result rather than an explicit error — assert on the emptiness
    // of `data`, then confirm below that the object is still actually there.
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: stillThere } = await userA.client.storage
      .from("avatars")
      .list(userA.id);
    expect(stillThere?.some((f) => f.name === "photo.png")).toBe(true);
  });

  it("lets an owner delete their own object", async () => {
    const { error } = await userA.client.storage
      .from("avatars")
      .remove([`${userA.id}/photo.png`]);

    expect(error).toBeNull();

    const { data: afterDelete } = await userA.client.storage
      .from("avatars")
      .list(userA.id);
    expect(afterDelete?.some((f) => f.name === "photo.png")).toBe(false);
  });

  it("rejects an upload exceeding the 5 MiB bucket limit", async () => {
    const { error } = await userA.client.storage
      .from("avatars")
      .upload(`${userA.id}/photo.png`, oversizedBlob(), {
        upsert: true,
        contentType: "image/png",
      });

    expect(error).not.toBeNull();
  });

  it("rejects an upload with a disallowed MIME type", async () => {
    const { error } = await userA.client.storage
      .from("avatars")
      .upload(`${userA.id}/photo.pdf`, disallowedMimeBlob(), {
        contentType: "application/pdf",
      });

    expect(error).not.toBeNull();
  });
});
