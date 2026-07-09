-- Emergency-subset profile data (see README.md > Data Model (Emergency Subset)).
-- Owner-only access: every policy on this table checks auth.uid() = user_id,
-- and there is deliberately no policy granting the anon role any access at
-- all. Public reads go through the get_emergency_card() SECURITY DEFINER
-- RPC added in the next migration, never through this table directly.

create type public.blood_group_enum as enum (
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'
);

create type public.genotype_enum as enum (
  'AA', 'AS', 'SS', 'SC', 'AC', 'unknown'
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  card_public_id uuid not null unique default gen_random_uuid(),

  name text not null,
  date_of_birth date,
  photo_url text,
  language text,

  blood_group public.blood_group_enum not null default 'unknown',
  genotype public.genotype_enum not null default 'unknown',

  allergies text[] not null default '{}',
  medications text[] not null default '{}',
  chronic_conditions text[] not null default '{}',

  -- Array of {name, phone, relationship}. Validated against a zod schema at
  -- the application layer; the check here only bounds shape and size.
  emergency_contacts jsonb not null default '[]',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint emergency_contacts_is_bounded_array check (
    jsonb_typeof(emergency_contacts) = 'array'
    and jsonb_array_length(emergency_contacts) <= 3
  )
);

comment on table public.profiles is
  'One row per patient, keyed by auth user. card_public_id is the unguessable identifier encoded in the QR code and looked up by the public get_emergency_card() RPC — never expose user_id or auth.users data through that path.';

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = user_id);

create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = user_id);

create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "profiles_delete_own"
on public.profiles for delete
using (auth.uid() = user_id);
