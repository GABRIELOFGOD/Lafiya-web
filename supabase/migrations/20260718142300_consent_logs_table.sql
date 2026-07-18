-- Migration to create the consent_logs table for compliance with NDPA (2023).
create table public.consent_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  policy_version text not null,
  accepted_at timestamptz not null default now(),
  constraint consent_logs_user_version_key unique (user_id, policy_version)
);

comment on table public.consent_logs is
  'Record of explicit consent captured from users for data processing under NDPA 2023.';

-- Enable Row Level Security
alter table public.consent_logs enable row level security;

-- Authenticated users can read their own consent logs
create policy "consent_logs_select_own"
on public.consent_logs for select
to authenticated
using (auth.uid() = user_id);

-- PostgREST grants (Supabase Data API needs this to expose the table to authenticated role)
grant select on public.consent_logs to authenticated;
