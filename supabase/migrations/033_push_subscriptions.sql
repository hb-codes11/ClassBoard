begin;

-- Create table to store Web Push Subscriptions per user device
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_user_endpoint_key unique (user_id, endpoint)
);

create index if not exists idx_push_subscriptions_class on public.push_subscriptions(class_id);
create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- Students manage only their own device subscriptions
drop policy if exists push_subs_own_select on public.push_subscriptions;
create policy push_subs_own_select on public.push_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists push_subs_own_insert on public.push_subscriptions;
create policy push_subs_own_insert on public.push_subscriptions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists push_subs_own_update on public.push_subscriptions;
create policy push_subs_own_update on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists push_subs_own_delete on public.push_subscriptions;
create policy push_subs_own_delete on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.push_subscriptions to authenticated;

notify pgrst, 'reload schema';

commit;

