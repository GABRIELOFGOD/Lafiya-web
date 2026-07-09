-- Bound what can land in the avatars bucket: 5 MiB cap, image types only.
-- Enforced by Storage itself on upload, in addition to any client-side
-- validation (which a malicious client can simply skip).
update storage.buckets
set
  file_size_limit = 5242880, -- 5 MiB
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'avatars';
