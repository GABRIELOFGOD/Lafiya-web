-- Durable state and atomic reconciliation primitives for the CHW payout indexer.
-- All tables and functions in this migration are service-role only.

create table public.stellar_indexer_cursors (
  stream text primary key check (stream in ('attestations', 'payments')),
  cursor text not null,
  updated_at timestamptz not null default now()
);

create table public.chw_payout_observations (
  record_hash text primary key,
  stellar_address text not null,
  amount_usdc numeric(20, 7) not null check (amount_usdc >= 0),
  payout_tx_hash text not null unique,
  paid_at timestamptz not null,
  paging_token text not null,
  created_at timestamptz not null default now()
);

alter table public.stellar_indexer_cursors enable row level security;
alter table public.chw_payout_observations enable row level security;

revoke all on public.stellar_indexer_cursors from anon, authenticated;
revoke all on public.chw_payout_observations from anon, authenticated;
grant select, insert, update, delete on public.stellar_indexer_cursors to service_role;
grant select, insert, update, delete on public.chw_payout_observations to service_role;

create unique index chw_payouts_payout_tx_hash_unique
  on public.chw_payouts (payout_tx_hash)
  where payout_tx_hash is not null;

create or replace function public.apply_chw_attestation(
  p_record_hash text,
  p_stellar_address text,
  p_attested_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  observation public.chw_payout_observations%rowtype;
  decision text := 'pending';
begin
  insert into public.chw_payouts (record_hash, stellar_address, attested_at)
  values (p_record_hash, p_stellar_address, p_attested_at)
  on conflict (record_hash) do update
    set stellar_address = excluded.stellar_address,
        attested_at = excluded.attested_at;

  select * into observation
    from public.chw_payout_observations
    where record_hash = p_record_hash
      and stellar_address = p_stellar_address;

  if found then
    update public.chw_payouts
      set amount_usdc = observation.amount_usdc,
          status = 'paid',
          payout_tx_hash = observation.payout_tx_hash,
          paid_at = observation.paid_at
      where record_hash = p_record_hash;
    delete from public.chw_payout_observations
      where record_hash = p_record_hash;
    decision := 'paid_from_observation';
  end if;

  return decision;
end;
$$;

create or replace function public.apply_chw_payout(
  p_record_hash text,
  p_stellar_address text,
  p_amount_usdc numeric,
  p_payout_tx_hash text,
  p_paid_at timestamptz,
  p_paging_token text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  payout_address text;
  payout_exists boolean;
begin
  select stellar_address into payout_address
    from public.chw_payouts
    where record_hash = p_record_hash;
  payout_exists := found;

  if payout_exists and payout_address = p_stellar_address then
    update public.chw_payouts
      set amount_usdc = p_amount_usdc,
          status = 'paid',
          payout_tx_hash = p_payout_tx_hash,
          paid_at = p_paid_at
      where record_hash = p_record_hash;
    return 'paid';
  end if;

  insert into public.chw_payout_observations (
    record_hash, stellar_address, amount_usdc, payout_tx_hash, paid_at, paging_token
  )
  values (
    p_record_hash, p_stellar_address, p_amount_usdc, p_payout_tx_hash, p_paid_at, p_paging_token
  )
  on conflict (record_hash) do update
    set stellar_address = excluded.stellar_address,
        amount_usdc = excluded.amount_usdc,
        payout_tx_hash = excluded.payout_tx_hash,
        paid_at = excluded.paid_at,
        paging_token = excluded.paging_token;

  return case when payout_exists then 'address_mismatch_observed' else 'awaiting_attestation' end;
end;
$$;

revoke all on function public.apply_chw_attestation(text, text, timestamptz) from public;
revoke all on function public.apply_chw_payout(text, text, numeric, text, timestamptz, text) from public;
grant execute on function public.apply_chw_attestation(text, text, timestamptz) to service_role;
grant execute on function public.apply_chw_payout(text, text, numeric, text, timestamptz, text) to service_role;
