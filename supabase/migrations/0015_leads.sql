-- Contacts ("leads") collected on the website: from friends who open a referral link and
-- from visitors who tap "Buy Now". Name, email, phone and explicit consent to be contacted
-- (required — India's DPDP Act). Anyone may submit the form; only the admin can read,
-- export or delete the list.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  email text not null check (char_length(email) <= 200 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  phone text not null check (phone ~ '^\+?[0-9 ()-]{7,20}$'),
  source text not null check (source in ('referral', 'buy')),
  item_type public.item_type,
  item_id uuid,
  referred_by uuid references public.profiles(id) on delete set null,  -- the reader who shared the link, if known
  consent boolean not null check (consent),
  created_at timestamptz not null default now()
);
create index if not exists leads_created_idx on public.leads (created_at desc);
alter table public.leads enable row level security;

create policy "leads: anyone can submit" on public.leads
  for insert to anon, authenticated with check (consent);
create policy "leads: admin can read" on public.leads
  for select using (public.is_admin());
create policy "leads: admin can delete" on public.leads
  for delete using (public.is_admin());

-- Tell people in the Privacy Policy (only added once; editable afterwards in the admin panel).
update public.settings
set value = value || E'\n\n<strong>Contact details you give us.</strong> When you open a book or podcast that someone recommended to you, or tap "Buy Now" on the website, we ask for your name, email address and phone number. We use them to handle your purchase and, with your consent, to contact you by email, phone or WhatsApp about King''s Library books and podcasts. You can ask us to stop contacting you, or to delete these details, at any time using the contact details on this site.'
where key = 'privacy_text' and value not like '%Contact details you give us%';
