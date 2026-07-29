-- chw_payouts: off-chain mirror of on-chain USDC-on-Stellar CHW payout events (M2)
--
-- On-chain vs off-chain relationship
-- -----------------------------------
-- The Stellar ledger (via lafiya-contracts) is the source of truth for whether
-- a CHW was actually paid: it holds the USDC transfer itself. This table does
-- NOT replace that. It is a queryable, RLS-protected mirror, populated by a
-- listener process that observes attestation + payout events on-chain and
-- writes/updates rows here so a CHW can see their own earnings without
-- running a Stellar block explorer query themselves.
--
-- Each row represents one verification event (one attested record_hash) and
-- its payout lifecycle: pending (attested, payout not yet observed on-chain)
-- -> paid (payout_tx_hash observed on-chain for this record_hash).
--
-- This mirrors the documentation style of the profiles table migration:
-- schema + RLS + comments explaining intent, landed as its own additive
-- migration. No changes to profiles or any patient-facing table/flow.

create table if not exists public.chw_payouts (
  id uuid primary key default gen_random_uuid(),

    -- CHW identity: Stellar address is the durable identity (works even before
      -- a CHW has linked an app account). chw_id links to a Supabase auth user
        -- once/if the CHW authenticates through the app (coordinate with however
          -- lafiya-verifier ends up authenticating CHWs). RLS is scoped on chw_id,
            -- so rows are only visible to their owner once linked.
              stellar_address text not null,
                chw_id uuid references auth.users (id) on delete set null,

                  -- The verification event this payout is for. Matches the record_hash
                    -- produced by lib/attestation/recordHash.ts and used in the on-chain
                      -- Attestation struct (lafiya-contracts). One payout row per verification.
                        record_hash text not null,
                          attested_at timestamptz not null,

                            -- Payout tracking
                              amount_usdc numeric(20, 7) not null default 0 check (amount_usdc >= 0),
                                status text not null default 'pending' check (status in ('pending', 'paid')),
                                  payout_tx_hash text,
                                    paid_at timestamptz,

                                      created_at timestamptz not null default now(),
                                        updated_at timestamptz not null default now(),

                                          constraint chw_payouts_record_hash_unique unique (record_hash),
                                            constraint chw_payouts_paid_requires_tx
                                                check (status <> 'paid' or payout_tx_hash is not null)
                                                );

                                                comment on table public.chw_payouts is
                                                  'Off-chain mirror of on-chain CHW USDC payout events. Source of truth is '
                                                    'the Stellar ledger; this table is a queryable, RLS-scoped read view for '
                                                      'CHWs, populated by a listener service. See migration file header for '
                                                        'full on-chain/off-chain relationship notes.';

                                                        create index if not exists chw_payouts_chw_id_idx on public.chw_payouts (chw_id);
                                                        create index if not exists chw_payouts_stellar_address_idx on public.chw_payouts (stellar_address);
                                                        create index if not exists chw_payouts_status_idx on public.chw_payouts (status);

                                                        -- Keep updated_at current on any row change
                                                        create or replace function public.set_chw_payouts_updated_at()
                                                        returns trigger
                                                        language plpgsql
                                                        as $$
                                                        begin
                                                          new.updated_at = now();
                                                            return new;
                                                            end;
                                                            $$;

                                                            drop trigger if exists chw_payouts_set_updated_at on public.chw_payouts;
                                                            create trigger chw_payouts_set_updated_at
                                                              before update on public.chw_payouts
                                                                for each row
                                                                  execute function public.set_chw_payouts_updated_at();

                                                                  -- RLS: a CHW can only read their own rows, once chw_id is linked.
                                                                  -- Writes are intentionally left to the service role (the listener process
                                                                  -- that observes on-chain events) — no insert/update/delete policy is
                                                                  -- granted to authenticated users, so RLS default-denies those for them.
                                                                  alter table public.chw_payouts enable row level security;

                                                                  create policy "CHW can read own payouts"
                                                                    on public.chw_payouts
                                                                      for select
                                                                        to authenticated
                                                                          using (auth.uid() = chw_id);

                                                                          -- Table-level GRANT: RLS alone doesn't expose the table to the role, and a
                                                                          -- default-deny GRANT keeps anon/service tooling explicit (matches the
                                                                          -- profiles table convention noted in this repo's test suite).
                                                                          grant select on public.chw_payouts to authenticated;
                                                                          