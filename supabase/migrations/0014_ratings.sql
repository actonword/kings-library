-- Ratings & reviews. Only people who own a book/podcast can rate it (1–5 stars), once
-- per item (they can change it). An optional written review shows publicly only after the
-- admin approves it; readers can never approve their own, and editing a review sends it
-- back for approval. The public (website) reads only star averages and approved reviews,
-- through the two security-definer functions below — never emails or unapproved text.
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  reader_id uuid not null references public.profiles(id) on delete cascade,
  item_type public.item_type not null,
  item_id uuid not null,
  stars int not null check (stars between 1 and 5),
  review text check (review is null or char_length(review) <= 1000),
  reviewer_name text check (reviewer_name is null or char_length(reviewer_name) <= 40),
  review_status text not null default 'none' check (review_status in ('none', 'pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reader_id, item_type, item_id)
);
create index if not exists ratings_item_idx on public.ratings (item_type, item_id);
alter table public.ratings enable row level security;

-- Readers see and manage only their own ratings, and only for items they own.
create policy "ratings: owner or admin can read" on public.ratings
  for select using (reader_id = auth.uid() or public.is_admin());
create policy "ratings: owners can rate what they own" on public.ratings
  for insert with check (
    reader_id = auth.uid()
    and exists (select 1 from public.access_grants g
                where g.reader_id = auth.uid() and g.item_type = ratings.item_type and g.item_id = ratings.item_id)
  );
create policy "ratings: owner or admin can update" on public.ratings
  for update using (reader_id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (reader_id = auth.uid()
        and exists (select 1 from public.access_grants g
                    where g.reader_id = auth.uid() and g.item_type = ratings.item_type and g.item_id = ratings.item_id))
  );
create policy "ratings: owner or admin can delete" on public.ratings
  for delete using (reader_id = auth.uid() or public.is_admin());

-- Readers can't set the review status themselves: a new or changed review is 'pending',
-- no review is 'none'. The admin (review page) is the only one who approves or rejects.
create or replace function public.ratings_before_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  if public.is_admin() then
    return new;
  end if;
  new.review := nullif(btrim(coalesce(new.review, '')), '');
  new.reviewer_name := nullif(btrim(coalesce(new.reviewer_name, '')), '');
  if tg_op = 'INSERT' or new.review is distinct from old.review then
    new.review_status := case when new.review is null then 'none' else 'pending' end;
  else
    new.review_status := old.review_status;
  end if;
  return new;
end;
$$;
drop trigger if exists ratings_before_write on public.ratings;
create trigger ratings_before_write before insert or update on public.ratings
  for each row execute function public.ratings_before_write();

-- Public: average stars and number of ratings per item (for website and app cards).
create or replace function public.rating_summaries()
returns table (item_type public.item_type, item_id uuid, average numeric, rating_count int)
language sql
stable
security definer
set search_path = public
as $$
  select r.item_type, r.item_id, round(avg(r.stars)::numeric, 1), count(*)::int
  from public.ratings r
  group by r.item_type, r.item_id;
$$;

-- Public: approved reviews for one item, newest first — name (or "A reader"), stars, text.
create or replace function public.approved_reviews(p_item_type public.item_type, p_item_id uuid)
returns table (reviewer_name text, stars int, review text, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(r.reviewer_name, 'A reader'), r.stars, r.review, r.updated_at
  from public.ratings r
  where r.item_type = p_item_type and r.item_id = p_item_id and r.review_status = 'approved'
  order by r.updated_at desc
  limit 50;
$$;

grant execute on function public.rating_summaries() to anon, authenticated;
grant execute on function public.approved_reviews(public.item_type, uuid) to anon, authenticated;
