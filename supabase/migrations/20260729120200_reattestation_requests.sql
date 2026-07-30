-- Minimal queue of "please re-verify my card" requests, raised by a patient
-- from the profile page when their profile has been edited since the last
-- successful on-chain attestation (see attestation-status-banner.tsx and
-- requestReattestation in app/(auth)/profile/actions.ts). This table is the
-- request queue only — actually re-attesting (a CHW/health-worker action
-- against the Soroban contract) is a separate, out-of-repo tool
-- (lafiya-verifier); this table is what that tool would poll/consume.
create table public.reattestation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- The record_hash that needs a fresh attestation (the hash computed from
  -- the patient's current profile data at request time).
  record_hash text not null,

  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'completed', 'dismissed'))
);

comment on table public.reattestation_requests is
  'Patient-raised queue of "profile changed, please re-verify" requests. Populated by the patient themselves (own row only); consumed/updated by a CHW-facing tool (out of scope here) or by the profile page itself marking a request completed once a matching attestation is observed on-chain.';

create index reattestation_requests_user_id_idx on public.reattestation_requests (user_id);

-- At most one pending request per (user, hash) — makes the "Request
-- re-verification" button idempotent without extra app-side bookkeeping.
create unique index reattestation_requests_pending_unique
  on public.reattestation_requests (user_id, record_hash)
  where status = 'pending';

alter table public.reattestation_requests enable row level security;

create policy "reattestation_requests_select_own"
on public.reattestation_requests for select
to authenticated
using (auth.uid() = user_id);

create policy "reattestation_requests_insert_own"
on public.reattestation_requests for insert
to authenticated
with check (auth.uid() = user_id);

-- No update/delete policy for authenticated: marking a request
-- completed/dismissed is done via the service-role admin client (the
-- profile page marks its own prior pending request completed once it
-- observes the new hash is attested), consistent with chw_payouts'
-- "owner can read, writes are service-role" convention elsewhere in this
-- migrations directory.
grant select, insert on public.reattestation_requests to authenticated;
