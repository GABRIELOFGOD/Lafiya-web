"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/supabase/types";
import { profileFormSchema } from "@/lib/validation/profile";

export interface ProfileFormState {
  error?: string;
  success?: boolean;
}

/**
 * Fills in defaults for fields the UI doesn't expose yet (grown field group
 * by field group across several commits) from the existing row, so a save
 * never silently wipes data the current form doesn't render a control for.
 */
function toFormDefaults(existing: ProfileRow | null) {
  return {
    name: existing?.name ?? "",
    dateOfBirth: existing?.date_of_birth ?? "",
    language: existing?.language ?? "",
    bloodGroup: existing?.blood_group ?? ("unknown" as const),
    genotype: existing?.genotype ?? ("unknown" as const),
    allergies: existing?.allergies ?? [],
    medications: existing?.medications ?? [],
    chronicConditions: existing?.chronic_conditions ?? [],
    emergencyContacts: existing?.emergency_contacts ?? [],
  };
}

export async function upsertProfile(
  _prevState: ProfileFormState | undefined,
  formData: FormData,
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const defaults = toFormDefaults(existing);

  const parsed = profileFormSchema.safeParse({
    ...defaults,
    name: formData.get("name"),
    dateOfBirth: formData.get("dateOfBirth") || undefined,
    language: formData.get("language") || undefined,
    bloodGroup: formData.get("bloodGroup") || undefined,
    genotype: formData.get("genotype") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase.from("profiles").upsert({
    user_id: user.id,
    name: parsed.data.name,
    date_of_birth: parsed.data.dateOfBirth || null,
    language: parsed.data.language || null,
    blood_group: parsed.data.bloodGroup,
    genotype: parsed.data.genotype,
    allergies: parsed.data.allergies,
    medications: parsed.data.medications,
    chronic_conditions: parsed.data.chronicConditions,
    emergency_contacts: parsed.data.emergencyContacts,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  return { success: true };
}
