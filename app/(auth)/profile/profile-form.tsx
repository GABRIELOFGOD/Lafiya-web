"use client";

import { useActionState } from "react";

import { BLOOD_GROUPS, GENOTYPES } from "@/lib/validation/profile";
import type { ProfileRow } from "@/lib/supabase/types";

import { upsertProfile } from "./actions";
import { EmergencyContactsField } from "./emergency-contacts-field";
import { PhotoUploadField } from "./photo-upload-field";
import { TagListField } from "./tag-list-field";

export function ProfileForm({
  profile,
  userId,
}: {
  profile: ProfileRow | null;
  userId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    upsertProfile,
    undefined,
  );

  // Helper to get field error for a given key
  const getFieldError = (key: string) => state?.fieldErrors?.[key];

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <PhotoUploadField
        userId={userId}
        initialUrl={profile?.photo_url ?? null}
        serverError={state?.error}
      />

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
          aria-invalid={!!getFieldError("name")}
          aria-describedby={getFieldError("name") ? "name-error" : undefined}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {getFieldError("name") && (
          <p id="name-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError("name")}</p>
        )}
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
          aria-invalid={!!getFieldError("dateOfBirth")}
          aria-describedby={getFieldError("dateOfBirth") ? "dateOfBirth-error" : undefined}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {getFieldError("dateOfBirth") && (
          <p id="dateOfBirth-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError("dateOfBirth")}</p>
        )}
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
          aria-invalid={!!getFieldError("language")}
          aria-describedby={getFieldError("language") ? "language-error" : undefined}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {getFieldError("language") && (
          <p id="language-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError("language")}</p>
        )}
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
            aria-invalid={!!getFieldError("bloodGroup")}
            aria-describedby={getFieldError("bloodGroup") ? "bloodGroup-error" : undefined}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            {BLOOD_GROUPS.map((value) => (
              <option key={value} value={value}>
                {value === "unknown" ? "Unknown" : value}
              </option>
            ))}
          </select>
          {getFieldError("bloodGroup") && (
            <p id="bloodGroup-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError("bloodGroup")}</p>
          )}
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
            aria-invalid={!!getFieldError("genotype")}
            aria-describedby={getFieldError("genotype") ? "genotype-error" : undefined}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            {GENOTYPES.map((value) => (
              <option key={value} value={value}>
                {value === "unknown" ? "Unknown" : value}
              </option>
            ))}
          </select>
          {getFieldError("genotype") && (
            <p id="genotype-error" className="mt-1 text-sm text-red-600 dark:text-red-400">{getFieldError("genotype")}</p>
          )}
        </div>
      </div>

      <TagListField
        name="allergies"
        label="Allergies"
        placeholder="e.g. Penicillin"
        initialValues={profile?.allergies ?? []}
        fieldErrors={state?.fieldErrors}
      />

      <TagListField
        name="medications"
        label="Current medications"
        placeholder="e.g. Insulin"
        initialValues={profile?.medications ?? []}
        fieldErrors={state?.fieldErrors}
      />

      <TagListField
        name="chronicConditions"
        label="Chronic conditions / implants"
        placeholder="e.g. Asthma"
        initialValues={profile?.chronic_conditions ?? []}
        fieldErrors={state?.fieldErrors}
      />

      <EmergencyContactsField
        initialValues={profile?.emergency_contacts ?? []}
        fieldErrors={state?.fieldErrors}
      />

      {state?.error && !state?.fieldErrors && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</p>
      )}

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
