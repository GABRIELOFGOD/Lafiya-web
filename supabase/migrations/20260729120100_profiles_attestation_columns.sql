-- Tracks the record_hash (and when) as of the last time this profile was
-- confirmed attested on-chain, so an edit after attestation can be detected
-- as "stale" instead of silently reverting to "not verified" with no
-- explanation (see issues/issue-03-record-hash-commitment-scheme.md).
--
-- Both columns are intentionally private: they are never exposed via the
-- public get_emergency_card() RPC (see tests/integration/
-- profiles-column-contract.test.ts, updated alongside this migration), and
-- are only read/written from the authenticated /profile page.
alter table public.profiles
  add column last_attested_hash text,
  add column last_verified_at timestamptz;

comment on column public.profiles.last_attested_hash is
  'record_hash (hex) as of the last time this profile was observed to have a valid on-chain attestation. Compared against the live-computed hash to detect "edited since last verification". Never exposed via get_emergency_card().';

comment on column public.profiles.last_verified_at is
  'Timestamp last_attested_hash was recorded. Never exposed via get_emergency_card().';
