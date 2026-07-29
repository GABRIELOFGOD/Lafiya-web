-- Per-patient HMAC pepper backing the record-commitment scheme (see
-- lib/attestation/recordHash.ts). record_hash = HMAC-SHA256(key = this
-- secret, msg = canonicalized emergency fields). Without this secret, an
-- adversary who has fully guessed a target patient's emergency fields still
-- cannot compute a matching record_hash — this is what makes the on-chain
-- commitment resistant to the low-entropy dictionary/correlation attack
-- described in issues/issue-03-record-hash-commitment-scheme.md.
--
-- RLS is enabled with NO policies at all, for ANY role, including the
-- owning patient. Nothing legitimate ever needs the raw secret outside a
-- server process: the only reader is lib/attestation/recordSecret.ts, which
-- uses the service-role admin client (bypasses RLS/grants entirely, per
-- this project's existing convention — see lib/supabase/admin.ts and every
-- other migration in this file's directory). Keeping this zero-policy
-- (rather than "owner can read their own secret") means there is no code
-- path, present or future, that could serve the raw pepper to a browser.
--
-- New rows are created application-side (crypto.randomBytes(32) in
-- app/(auth)/profile/actions.ts's upsertProfile, written via the admin
-- client immediately after the user's own profiles upsert succeeds) rather
-- than via a DB trigger — see that file for the reasoning. The one-time
-- backfill below exists only to cover profiles rows that already existed
-- before this migration lands.
create extension if not exists pgcrypto with schema extensions;

create table public.profile_secrets (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,

  -- Hex-encoded 32 random bytes (256 bits). Stored as text (not bytea) so
  -- it round-trips through PostgREST/supabase-js without bytea encoding
  -- ambiguity; the value is opaque hex either way.
  secret text not null,

  created_at timestamptz not null default now()
);

comment on table public.profile_secrets is
  'Per-patient HMAC pepper for lib/attestation/recordHash.ts. Zero RLS policies for any role — only the service-role admin client (via lib/attestation/recordSecret.ts) may ever read or write this table. Deleting the owning profiles row (which itself cascades from auth.users) cascades here too, which is the mechanism that makes account deletion destroy future preimage-search feasibility for that patient (see tests/integration/delete-account.test.ts).';

alter table public.profile_secrets enable row level security;

-- Deliberately no policies and no GRANTs to anon/authenticated — RLS
-- default-denies all access for those roles, and the service role bypasses
-- RLS/grants entirely, so no explicit grant is needed for it either (same
-- pattern relied on throughout this migrations directory).

-- One-time backfill: any profiles row that predates this migration needs a
-- secret too, or its record_hash becomes uncomputable. Going forward, only
-- upsertProfile's application-side generation populates this table.
insert into public.profile_secrets (user_id, secret)
select user_id, encode(gen_random_bytes(32), 'hex')
from public.profiles
on conflict (user_id) do nothing;
