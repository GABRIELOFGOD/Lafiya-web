/**
 * Hand-authored types mirroring supabase/migrations/*.sql. There is no
 * `supabase gen types` step in this project (no network dependency on a
 * hosted project); keep this file in sync with the migrations by hand.
 */

export type BloodGroup =
  "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "unknown";

export type Genotype = "AA" | "AS" | "SS" | "SC" | "AC" | "unknown";

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

/** Row shape of public.profiles. */
export interface ProfileRow {
  user_id: string;
  card_public_id: string;
  name: string;
  date_of_birth: string | null;
  photo_url: string | null;
  language: string | null;
  blood_group: BloodGroup;
  genotype: Genotype;
  allergies: string[];
  medications: string[];
  chronic_conditions: string[];
  emergency_contacts: EmergencyContact[];
  created_at: string;
  updated_at: string;
}

/** Return row shape of public.get_emergency_card(p_card_id uuid). */
export interface EmergencyCardRow {
  name: string;
  age: number | null;
  photo_url: string | null;
  blood_group: BloodGroup;
  genotype: Genotype;
  allergies: string[];
  medications: string[];
  chronic_conditions: string[];
  emergency_contacts: EmergencyContact[];
  language: string | null;
}

/**
 * Matches the shape @supabase/supabase-js's `createClient<Database>()`
 * generic expects, so `.from("profiles")` and `.rpc("get_emergency_card")`
 * are typed without a code-generation step.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> &
          Pick<ProfileRow, "user_id" | "name"> & {
            emergency_contacts?: EmergencyContact[];
          };
        Update: Partial<Omit<ProfileRow, "user_id">>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_emergency_card: {
        Args: { p_card_id: string };
        Returns: EmergencyCardRow[];
      };
    };
    Enums: {
      blood_group_enum: BloodGroup;
      genotype_enum: Genotype;
    };
  };
}
