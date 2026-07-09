import { createClient } from "@/lib/supabase/server";

import { SignOutButton } from "../signout/sign-out-button";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts already redirects unauthenticated requests away from this
  // route; this only defends against a direct-render race, not the
  // primary access check.
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {profile ? profile.name : "Your Lafiya card"}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {user.email}
          </p>
        </div>
        <SignOutButton />
      </div>

      {profile ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          Card created. The field-by-field editor for updating it lands next.
        </p>
      ) : (
        <p className="text-zinc-600 dark:text-zinc-400">
          You don&apos;t have a card yet. The editor to create one lands next.
        </p>
      )}
    </div>
  );
}
