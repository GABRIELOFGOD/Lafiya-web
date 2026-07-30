import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

const AVATAR_DELETE_BATCH_SIZE = 100;

/**
 * Removes account data that is not covered by database cascades, then deletes
 * the auth user that owns the remaining relational data.
 *
 * Supabase Storage objects do not cascade when an auth user is deleted.
 */
export async function deleteAccountAndData(
  admin: AdminClient,
  userId: string,
): Promise<void> {
  while (true) {
    const { data: objects, error: listError } = await admin.storage
      .from("avatars")
      .list(userId, { limit: AVATAR_DELETE_BATCH_SIZE, offset: 0 });

    if (listError) {
      throw new Error(`Failed to list account avatars: ${listError.message}`, {
        cause: listError,
      });
    }

    if (!objects || objects.length === 0) {
      break;
    }

    const paths = objects.map((object) => `${userId}/${object.name}`);
    const { error: removeError } = await admin.storage
      .from("avatars")
      .remove(paths);

    if (removeError) {
      throw new Error(
        `Failed to remove account avatars: ${removeError.message}`,
        { cause: removeError },
      );
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

  if (deleteError) {
    throw new Error(`Failed to delete account: ${deleteError.message}`, {
      cause: deleteError,
    });
  }
}
