-- Track what format a book was originally uploaded in (EPUB / Word / PDF / manual),
-- so the admin panel can display it later when editing a book's content.
alter table public.books add column if not exists source_format text;
