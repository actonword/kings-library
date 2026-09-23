-- Record what was charged when access was granted, so the admin dashboard's revenue
-- reflects actual sales: later price changes no longer rewrite past revenue, and free
-- gifts (price_paid = 0) don't count as sales. Set by the grant-access Edge Function.
alter table public.access_grants add column if not exists price_paid numeric(10,2);

-- Existing grants predate this column: the item's current price is the best available
-- estimate of what was paid (it's what the dashboard assumed until now).
update public.access_grants g set price_paid = coalesce(b.price, 0)
from public.books b
where g.item_type = 'book' and g.item_id = b.id and g.price_paid is null;

update public.access_grants g set price_paid = coalesce(p.price, 0)
from public.podcasts p
where g.item_type = 'podcast' and g.item_id = p.id and g.price_paid is null;
