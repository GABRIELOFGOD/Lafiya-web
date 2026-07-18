"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/supabase/types";
import { profileFormSchema } from "@/lib/validation/profile";

export interface ProfileFormState {
  error?: string;
  success?: boolean;
}

/** Reads a repeated text-list field, dropping blank rows left by the +/- UI. */
function getTagList(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .map((value) => value.toString().trim())
    .filter((value) => value.length > 0);
}

/**
 * Emergency contacts are submitted as one JSON hidden input (see
 * EmergencyContactsField) rather than indexed field names. Blank rows (all
 * three sub-fields empty) are dropped the same way tag-list rows are.
 */
function getEmergencyContacts(formData: FormData): unknown[] {
  const raw = formData.get("emergencyContactsJson");
  if (typeof raw !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (contact) =>
        contact &&
        typeof contact === "object" &&
        [contact.name, contact.phone, contact.relationship].some(
          (value) => typeof value === "string" && value.trim().length > 0,
        ),
    );
  } catch {
    return [];
  }
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
    photoUrl: existing?.photo_url ?? "",
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
    photoUrl: formData.get("photoUrl") || undefined,
    bloodGroup: formData.get("bloodGroup") || undefined,
    genotype: formData.get("genotype") || undefined,
    allergies: getTagList(formData, "allergies"),
    medications: getTagList(formData, "medications"),
    chronicConditions: getTagList(formData, "chronicConditions"),
    emergencyContacts: getEmergencyContacts(formData),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase.from("profiles").upsert({
    user_id: user.id,
    name: parsed.data.name,
    date_of_birth: parsed.data.dateOfBirth || null,
    language: parsed.data.language || null,
    photo_url: parsed.data.photoUrl || null,
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

export async function deleteAccount(
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

  const confirm = formData.get("confirm")?.toString().trim();
  if (confirm !== "DELETE") {
    return { error: "Type DELETE to confirm." };
  }

  const admin = createAdminClient();

  const { data: objects } = await admin.storage
    .from("avatars")
    .list(user.id, { limit: 100 });

  if (objects && objects.length > 0) {
    const paths = objects.map((o) => `${user.id}/${o.name}`);
    const { error: storageError } = await admin.storage
      .from("avatars")
      .remove(paths);

    if (storageError) {
      return { error: storageError.message };
    }
  }

  const { error: deleteError } =
    await admin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return { error: deleteError.message };
  }

  await supabase.auth.signOut();
  redirect("/");
}
