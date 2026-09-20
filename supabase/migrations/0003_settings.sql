-- Simple key/value settings store, editable from the admin panel.
-- Public (anon) can read — these are meant to be shown on the public website
-- (contact email/phone, etc.), never anything sensitive. Only admins can write.

create table public.settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

create policy "settings: public can read" on public.settings
  for select using (true);

create policy "settings: admin can write" on public.settings
  for insert with check (public.is_admin());

create policy "settings: admin can update" on public.settings
  for update using (public.is_admin());

insert into public.settings (key, value) values
  ('contact_email', 'malviyadheerajkumar@gmail.com'),
  ('contact_phone', '');
