-- Support chatbot: counts replies per person per day so the support-chat Edge Function
-- can enforce a daily limit (and a site-wide safety cap). Only the Edge Function
-- (service role) reads or writes it — RLS is on with no policies, so the public API
-- can't touch it.
create table if not exists public.chat_usage (
  usage_key text not null,          -- 'reader:<uuid>', 'ip:<address>', or 'all' for the site-wide total
  day date not null default current_date,
  count int not null default 0,
  primary key (usage_key, day)
);
alter table public.chat_usage enable row level security;

-- Atomically add one reply to a counter and return the new total.
create or replace function public.bump_chat_usage(p_key text)
returns int
language sql
security definer
set search_path = public
as $$
  insert into public.chat_usage (usage_key, day, count) values (p_key, current_date, 1)
  on conflict (usage_key, day) do update set count = public.chat_usage.count + 1
  returning count;
$$;
revoke all on function public.bump_chat_usage(text) from public, anon, authenticated;
