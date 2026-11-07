-- ClassBoard Migration 028: Tester Space & Grade Planner Access Control
--
-- 1. Creates a durable `app_testers` table for managing Tester Space access.
-- 2. Automatically grants access to founders:
--    - en25cs3070059@medicaps.ac.in
--    - en25cs3070130@medicaps.ac.in
-- 3. Grants initial access to approved beta testers:
--    - en25cs3070077@medicaps.ac.in
--    - en25cs3070117@medicaps.ac.in
--    - en25cs3090193@medicaps.ac.in
--    - en25cs3070103@medicaps.ac.in
--    - en25cs3070096@medicaps.ac.in
--    - en25cs3070100@medicaps.ac.in
-- 4. Provides secure RPCs:
--    - is_classboard_founder(): checks if caller is a founder
--    - is_classboard_tester(): checks if caller has tester access
--    - list_classboard_testers(): founders-only list of active tester emails
--    - set_tester_access(email, is_tester): founders-only role management

begin;

-- Re-assert / create is_classboard_founder()
create or replace function public.is_classboard_founder()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_email text;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  select lower(coalesce(u.email, (select auth.jwt()->>'email'), ''))
  into caller_email
  from auth.users u
  where u.id = (select auth.uid())
  limit 1;

  if caller_email is null or caller_email = '' then
    caller_email := lower(coalesce((select auth.jwt()->>'email'), ''));
  end if;

  return caller_email in (
    'en25cs3070059@medicaps.ac.in',
    'en25cs3070130@medicaps.ac.in'
  );
end;
$$;

revoke all on function public.is_classboard_founder() from public, anon;
grant execute on function public.is_classboard_founder() to authenticated;

-- Create app_testers table
create table if not exists public.app_testers (
  email text primary key,
  user_id uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  granted_by uuid references auth.users(id),
  notes text default 'Tester Space Access',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_testers enable row level security;

-- Row Level Security for app_testers:
-- Founders can view all; individual users can only view their own record.
drop policy if exists app_testers_read_policy on public.app_testers;
create policy app_testers_read_policy on public.app_testers
  for select to authenticated
  using (
    public.is_classboard_founder()
    or lower(email) = lower(coalesce((select auth.jwt()->>'email'), ''))
    or (user_id is not null and user_id = (select auth.uid()))
  );

-- Only founders can insert, update, or delete tester records
drop policy if exists app_testers_write_policy on public.app_testers;
create policy app_testers_write_policy on public.app_testers
  for all to authenticated
  using (public.is_classboard_founder())
  with check (public.is_classboard_founder());

-- Seed initial founders and approved testers
insert into public.app_testers (email, is_active, notes)
values
  ('en25cs3070059@medicaps.ac.in', true, 'Founder'),
  ('en25cs3070130@medicaps.ac.in', true, 'Founder'),
  ('en25cs3070077@medicaps.ac.in', true, 'Initial Beta Tester'),
  ('en25cs3070117@medicaps.ac.in', true, 'Initial Beta Tester'),
  ('en25cs3090193@medicaps.ac.in', true, 'Initial Beta Tester'),
  ('en25cs3070103@medicaps.ac.in', true, 'Initial Beta Tester'),
  ('en25cs3070096@medicaps.ac.in', true, 'Initial Beta Tester'),
  ('en25cs3070100@medicaps.ac.in', true, 'Initial Beta Tester')
on conflict (email) do update
set is_active = true,
    updated_at = now();

-- Update user_id links for any users that already exist in auth.users
update public.app_testers t
set user_id = u.id
from auth.users u
where lower(u.email) = lower(t.email)
  and (t.user_id is null or t.user_id <> u.id);

-- RPC: Check if current authenticated user is a tester or founder
create or replace function public.is_classboard_tester()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_email text;
  is_tester boolean := false;
begin
  if (select auth.uid()) is null then
    return false;
  end if;

  if public.is_classboard_founder() then
    return true;
  end if;

  select lower(coalesce(u.email, (select auth.jwt()->>'email'), ''))
  into caller_email
  from auth.users u
  where u.id = (select auth.uid())
  limit 1;

  if caller_email is null or caller_email = '' then
    caller_email := lower(coalesce((select auth.jwt()->>'email'), ''));
  end if;

  select t.is_active into is_tester
  from public.app_testers t
  where lower(t.email) = caller_email
     or (t.user_id is not null and t.user_id = (select auth.uid()))
  limit 1;

  return coalesce(is_tester, false);
end;
$$;

revoke all on function public.is_classboard_tester() from public, anon;
grant execute on function public.is_classboard_tester() to authenticated;

-- RPC: List all active testers (founders only)
create or replace function public.list_classboard_testers()
returns table (
  email text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_classboard_founder() then
    raise exception 'Only founders can inspect tester accounts' using errcode = '42501';
  end if;

  return query
  select t.email, t.is_active, t.created_at, t.updated_at
  from public.app_testers t
  order by t.created_at asc;
end;
$$;

revoke all on function public.list_classboard_testers() from public, anon;
grant execute on function public.list_classboard_testers() to authenticated;

-- RPC: Grant or revoke tester access (founders only)
create or replace function public.set_tester_access(
  p_email text,
  p_is_tester boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_email text;
  linked_user uuid;
begin
  if not public.is_classboard_founder() then
    raise exception 'Only founders can grant or remove tester access' using errcode = '42501';
  end if;

  target_email := lower(trim(coalesce(p_email, '')));
  if target_email !~ '^[^@[:space:]]+@medicaps[.]ac[.]in$' then
    raise exception 'Enter a valid college email ending in @medicaps.ac.in';
  end if;

  -- Prevent removing founder tester access
  if target_email in ('en25cs3070059@medicaps.ac.in', 'en25cs3070130@medicaps.ac.in') and not p_is_tester then
    raise exception 'Founders cannot have tester access removed';
  end if;

  select id into linked_user
  from auth.users
  where lower(email) = target_email
  limit 1;

  insert into public.app_testers (email, user_id, is_active, granted_by, updated_at)
  values (target_email, linked_user, p_is_tester, (select auth.uid()), now())
  on conflict (email) do update
    set is_active = excluded.is_active,
        user_id = coalesce(excluded.user_id, public.app_testers.user_id),
        granted_by = (select auth.uid()),
        updated_at = now();
end;
$$;

revoke all on function public.set_tester_access(text, boolean) from public, anon;
grant execute on function public.set_tester_access(text, boolean) to authenticated;

commit;

