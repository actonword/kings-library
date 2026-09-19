-- King's Library — initial schema
-- Run this once in the Supabase SQL Editor (or via `supabase db push` once the CLI is linked).

create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================
create type public.user_role as enum ('reader', 'admin');
create type public.item_type as enum ('book', 'podcast');
create type public.notification_target as enum ('all', 'book_owners', 'reader');
create type public.content_status as enum ('draft', 'published');

-- ============================================================================
-- PROFILES — one row per auth.users row
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role public.user_role not null default 'reader',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================================
-- BOOKS + CHAPTERS
-- ============================================================================
create table public.books (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text not null,
  author text not null,
  lang text not null,
  price numeric(10,2),
  currency text not null default 'INR',
  cover_color text,
  cover_image_url text,
  sample_text text,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  position int not null,
  label text,
  title text,
  content text not null,
  created_at timestamptz not null default now(),
  unique (book_id, position)
);

-- ============================================================================
-- PODCASTS
-- ============================================================================
create table public.podcasts (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  title text not null,
  host text not null,
  lang text not null,
  price numeric(10,2),
  currency text not null default 'INR',
  cover_color text,
  cover_image_url text,
  audio_path text,
  duration_sec int,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- ACCESS GRANTS — the "who owns what" table (admin's Grant Access button)
-- ============================================================================
create table public.access_grants (
  id uuid primary key default gen_random_uuid(),
  reader_id uuid not null references public.profiles(id) on delete cascade,
  item_type public.item_type not null,
  item_id uuid not null,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  unique (reader_id, item_type, item_id)
);

-- ============================================================================
-- PROGRESS
-- ============================================================================
create table public.reading_progress (
  reader_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  chapter_position int not null default 0,
  percent int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (reader_id, book_id)
);

create table public.podcast_progress (
  reader_id uuid not null references public.profiles(id) on delete cascade,
  podcast_id uuid not null references public.podcasts(id) on delete cascade,
  position_sec int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (reader_id, podcast_id)
);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  book_id uuid references public.books(id),
  target public.notification_target not null default 'all',
  target_reader_id uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.notification_reads (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  reader_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, reader_id)
);

-- ============================================================================
-- UI LANGUAGES
-- ============================================================================
create table public.ui_languages (
  code text primary key,
  label text not null,
  enabled boolean not null default true
);

create table public.ui_language_requests (
  id uuid primary key default gen_random_uuid(),
  language_name text not null,
  requested_by_email text,
  created_at timestamptz not null default now()
);

insert into public.ui_languages (code, label, enabled) values
  ('en', 'English', true),
  ('hi', 'Hindi', true),
  ('pa', 'Punjabi', true);

-- ============================================================================
-- ACTIVITY LOG — powers the admin dashboard "Recent Activity" feed
-- ============================================================================
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.chapters enable row level security;
alter table public.podcasts enable row level security;
alter table public.access_grants enable row level security;
alter table public.reading_progress enable row level security;
alter table public.podcast_progress enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
alter table public.ui_languages enable row level security;
alter table public.ui_language_requests enable row level security;
alter table public.activity_log enable row level security;

-- profiles
create policy "profiles: self or admin can select" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles: admin can update" on public.profiles
  for update using (public.is_admin());

-- books (metadata + sample text: published books are public; admin sees/edits everything)
create policy "books: public can read published" on public.books
  for select using (status = 'published' or public.is_admin());
create policy "books: admin can write" on public.books
  for insert with check (public.is_admin());
create policy "books: admin can update" on public.books
  for update using (public.is_admin());
create policy "books: admin can delete" on public.books
  for delete using (public.is_admin());

-- chapters (real content: locked to owners + admin, never public)
create policy "chapters: owner or admin can read" on public.chapters
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.access_grants g
      where g.reader_id = auth.uid()
        and g.item_type = 'book'
        and g.item_id = chapters.book_id
    )
  );
create policy "chapters: admin can write" on public.chapters
  for insert with check (public.is_admin());
create policy "chapters: admin can update" on public.chapters
  for update using (public.is_admin());
create policy "chapters: admin can delete" on public.chapters
  for delete using (public.is_admin());

-- podcasts (metadata public when published; audio_path is just a storage key, not the file itself)
create policy "podcasts: public can read published" on public.podcasts
  for select using (status = 'published' or public.is_admin());
create policy "podcasts: admin can write" on public.podcasts
  for insert with check (public.is_admin());
create policy "podcasts: admin can update" on public.podcasts
  for update using (public.is_admin());
create policy "podcasts: admin can delete" on public.podcasts
  for delete using (public.is_admin());

-- access_grants (readers see their own; only admin/service-role writes)
create policy "grants: reader can read own" on public.access_grants
  for select using (reader_id = auth.uid() or public.is_admin());
create policy "grants: admin can write" on public.access_grants
  for insert with check (public.is_admin());
create policy "grants: admin can delete" on public.access_grants
  for delete using (public.is_admin());

-- reading_progress / podcast_progress (reader owns their own row)
create policy "reading_progress: owner can manage" on public.reading_progress
  for all using (reader_id = auth.uid() or public.is_admin())
  with check (reader_id = auth.uid());
create policy "podcast_progress: owner can manage" on public.podcast_progress
  for all using (reader_id = auth.uid() or public.is_admin())
  with check (reader_id = auth.uid());

-- notifications
create policy "notifications: recipients can read" on public.notifications
  for select using (
    public.is_admin()
    or target = 'all'
    or (target = 'reader' and target_reader_id = auth.uid())
    or (target = 'book_owners' and exists (
      select 1 from public.access_grants g
      where g.reader_id = auth.uid() and g.item_type = 'book' and g.item_id = notifications.book_id
    ))
  );
create policy "notifications: admin can write" on public.notifications
  for insert with check (public.is_admin());

-- notification_reads
create policy "notification_reads: owner can manage" on public.notification_reads
  for all using (reader_id = auth.uid() or public.is_admin())
  with check (reader_id = auth.uid());

-- ui_languages (enabled ones are public; admin manages)
create policy "ui_languages: public can read enabled" on public.ui_languages
  for select using (enabled or public.is_admin());
create policy "ui_languages: admin can write" on public.ui_languages
  for insert with check (public.is_admin());
create policy "ui_languages: admin can update" on public.ui_languages
  for update using (public.is_admin());

-- ui_language_requests (anyone can submit, only admin can read the list)
create policy "ui_language_requests: anyone can insert" on public.ui_language_requests
  for insert with check (true);
create policy "ui_language_requests: admin can read" on public.ui_language_requests
  for select using (public.is_admin());

-- activity_log (admin only)
create policy "activity_log: admin can read" on public.activity_log
  for select using (public.is_admin());
create policy "activity_log: admin can insert" on public.activity_log
  for insert with check (public.is_admin());
