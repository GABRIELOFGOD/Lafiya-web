-- Profile photo storage. Public bucket keyed by user_id (not
-- card_public_id): a photo alone, with no name or medical data
-- attached, is low sensitivity, and user_id has the same UUID entropy
-- as card_public_id — this avoids a Storage policy needing to
-- subquery back into public.profiles just to find the owner.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

-- Path convention: avatars/{user_id}/photo.<ext>
create policy "avatar_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatar_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatar_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- A SELECT policy is required even though public reads are served via the
-- bucket's public=true flag (a separate, non-RLS-gated route): uploading
-- with upsert (`INSERT ... ON CONFLICT DO UPDATE`, what the profile photo
-- re-upload flow uses) needs the executing role to be able to see whether a
-- conflicting row exists at all, and Postgres rejects the whole statement
-- under RLS without it — confirmed by reproducing "new row violates
-- row-level security policy" on a same-user, non-conflicting upsert with
-- this policy absent, and the failure disappearing once it's added.
create policy "avatar_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
