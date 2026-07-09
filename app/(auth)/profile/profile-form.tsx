"use client";

import { useActionState } from "react";

import { BLOOD_GROUPS, GENOTYPES } from "@/lib/validation/profile";
import type { ProfileRow } from "@/lib/supabase/types";

import { upsertProfile } from "./actions";

export function ProfileForm({ profile }: { profile: ProfileRow | null }) {
  const [state, formAction, isPending] = useActionState(
    upsertProfile,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={profile?.name ?? ""}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      <div>
        <label
          htmlFor="dateOfBirth"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Date of birth
        </label>
        <input
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          defaultValue={profile?.date_of_birth ?? ""}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      <div>
        <label
          htmlFor="language"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Language spoken
        </label>
        <input
          id="language"
          name="language"
          type="text"
          placeholder="e.g. Hausa"
          defaultValue={profile?.language ?? ""}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="bloodGroup"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Blood group
          </label>
          <select
            id="bloodGroup"
            name="bloodGroup"
            defaultValue={profile?.blood_group ?? "unknown"}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            {BLOOD_GROUPS.map((value) => (
              <option key={value} value={value}>
                {value === "unknown" ? "Unknown" : value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="genotype"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Genotype
          </label>
          <select
            id="genotype"
            name="genotype"
            defaultValue={profile?.genotype ?? "unknown"}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            {GENOTYPES.map((value) => (
              <option key={value} value={value}>
                {value === "unknown" ? "Unknown" : value}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state?.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}
      {state?.success ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="flex h-11 items-center justify-center rounded-full bg-zinc-950 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
