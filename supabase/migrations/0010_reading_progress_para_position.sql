-- Remember the exact spot inside a chapter (the paragraph the reader's page starts with),
-- not just the chapter, so a book reopens on the page the reader left. Stored as a
-- paragraph index rather than a page number because page numbers change with screen
-- size and text size.
alter table public.reading_progress add column if not exists para_position int not null default 0;
