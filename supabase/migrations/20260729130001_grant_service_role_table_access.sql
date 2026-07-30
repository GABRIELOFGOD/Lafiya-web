-- Fixes a repo-wide, pre-existing bug: every prior migration's comments
-- assume the service_role Postgres role (used by createAdminClient() —
-- see lib/supabase/admin.ts) implicitly bypasses table-level GRANTs the
-- same way it bypasses RLS. It does not. On a freshly-initialized
-- `supabase start` instance, service_role only has TRUNCATE/REFERENCES/
-- TRIGGER on every public-schema table by default — no SELECT, INSERT,
-- UPDATE, or DELETE — exactly like anon/authenticated before their own
-- explicit grants. Confirmed directly against a clean instance:
--
--   select grantee, table_name, privilege_type
--   from information_schema.role_table_grants
--   where table_name in ('profiles','consent_logs') and grantee='service_role';
--   -- only TRIGGER, REFERENCES, TRUNCATE — no SELECT/INSERT/UPDATE/DELETE
--
-- This silently broke the signup flow: app/(auth)/signup/actions.ts's
-- signUp() writes to consent_logs via the admin client immediately after
-- auth.signUp() succeeds; that insert has always failed with "permission
-- denied for table consent_logs" against a real, freshly-provisioned
-- Supabase project (hosted or local), which the app treats as a consent
-- failure — it rolls back the just-created auth user and returns an error
-- instead of redirecting to /profile. It also breaks any integration test
-- that reads/writes these tables via the service-role admin client (e.g.
-- tests/integration/profiles-column-contract.test.ts's `adminClient
-- .from("profiles").select("*")`).
--
-- Fix: grant service_role explicit CRUD on every existing table the admin
-- client touches, and set default privileges so future tables in this
-- schema don't repeat this bug.
grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.consent_logs to service_role;
grant select, insert, update, delete on public.chw_payouts to service_role;
grant select, insert, update, delete on public.profile_secrets to service_role;
grant select, insert, update, delete on public.reattestation_requests to service_role;
grant select, insert, update, delete on public.rate_limits to service_role;
grant select, insert, update, delete on public.frequency_limits to service_role;

-- Both functions revoke PUBLIC execution in their defining migrations. Grant
-- only the server-side service role used by createAdminClient(); authenticated
-- and anon clients remain unable to invoke either state-changing RPC.
grant execute on function public.rate_limit_record_failure(text) to service_role;
grant execute on function public.frequency_limit_check_and_increment(text, integer, integer)
  to service_role;

-- Migrations in this project run as the `postgres` role, so this affects
-- objects `postgres` creates in `public` going forward — i.e. every future
-- migration's `create table` — without needing a repeated per-migration
-- grant.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant execute on functions to service_role;
