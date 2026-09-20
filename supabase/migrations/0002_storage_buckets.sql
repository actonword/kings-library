-- Storage buckets + access policies.
-- `covers` is public (cover images are meant to be freely visible on the site).
-- `podcast-audio` is private — nobody reads it directly; readers only ever get a
-- short-lived signed URL from the get-podcast-audio-url Edge Function.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('covers', 'covers', true, 5242880, array['image/png','image/jpeg','image/webp']),
  ('podcast-audio', 'podcast-audio', false, 209715200, array['audio/mpeg','audio/wav','audio/mp4','audio/x-m4a'])
on conflict (id) do nothing;

-- covers: anyone can view, only admins can manage
create policy "covers: public can view" on storage.objects
  for select using (bucket_id = 'covers');
create policy "covers: admin can upload" on storage.objects
  for insert with check (bucket_id = 'covers' and public.is_admin());
create policy "covers: admin can update" on storage.objects
  for update using (bucket_id = 'covers' and public.is_admin());
create policy "covers: admin can delete" on storage.objects
  for delete using (bucket_id = 'covers' and public.is_admin());

-- podcast-audio: admin manages it directly; readers never get a direct policy here —
-- they only reach the files through the Edge Function's signed URL (service role).
create policy "podcast-audio: admin can view" on storage.objects
  for select using (bucket_id = 'podcast-audio' and public.is_admin());
create policy "podcast-audio: admin can upload" on storage.objects
  for insert with check (bucket_id = 'podcast-audio' and public.is_admin());
create policy "podcast-audio: admin can update" on storage.objects
  for update using (bucket_id = 'podcast-audio' and public.is_admin());
create policy "podcast-audio: admin can delete" on storage.objects
  for delete using (bucket_id = 'podcast-audio' and public.is_admin());
