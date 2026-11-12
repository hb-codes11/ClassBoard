-- Migration 036: Platform Route & Telemetry Streaming
-- Enterprise-grade telemetry instrumentation for system latency, edge traffic, and platform routing.
-- Access strictly founder-authorized.

begin;

create table if not exists public.platform_telemetry (
  id uuid primary key default gen_random_uuid(),
  route_path text not null default '/',
  referrer text,
  client_agent text,
  is_authenticated boolean not null default false,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_telemetry_created_at on public.platform_telemetry(created_at desc);
create index if not exists idx_platform_telemetry_path on public.platform_telemetry(route_path);

alter table public.platform_telemetry enable row level security;

-- Founders can read telemetry
drop policy if exists "Founders read telemetry" on public.platform_telemetry;
create policy "Founders read telemetry" on public.platform_telemetry
  for select to authenticated
  using (public.is_classboard_founder());

-- SECURITY DEFINER RPC callable by system clients (anonymous & authenticated)
create or replace function public.record_route_telemetry(
  p_route text default '/',
  p_referrer text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ua text := null;
begin
  begin
    v_ua := current_setting('request.headers', true)::jsonb->>'user-agent';
  exception when others then
    v_ua := null;
  end;

  insert into public.platform_telemetry (
    route_path,
    referrer,
    client_agent,
    is_authenticated,
    user_id,
    created_at
  )
  values (
    coalesce(nullif(trim(p_route), ''), '/'),
    nullif(trim(p_referrer), ''),
    v_ua,
    (v_uid is not null),
    v_uid,
    clock_timestamp()
  );
end;
$$;

revoke all on function public.record_route_telemetry(text, text) from public;
grant execute on function public.record_route_telemetry(text, text) to anon, authenticated;

-- Founder RPC to fetch telemetry metrics
create or replace function public.get_platform_telemetry_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_today_start timestamptz := (timezone('Asia/Kolkata', v_now)::date::timestamp at time zone 'Asia/Kolkata');
  v_result jsonb;
begin
  if not public.is_classboard_founder() then
    raise exception 'Access denied: Founder authorization required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_views', (
      (select count(*) from public.platform_telemetry) +
      (select count(*) from public.user_activity where action = 'page_view')
    ),
    'views_today', (
      (select count(*) from public.platform_telemetry where created_at >= v_today_start) +
      (select count(*) from public.user_activity where action = 'page_view' and created_at >= v_today_start)
    ),
    'unique_routes_today', (
      select count(distinct route_path) from public.platform_telemetry
      where created_at >= v_today_start
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_platform_telemetry_summary() from public;
grant execute on function public.get_platform_telemetry_summary() to authenticated;

notify pgrst, 'reload schema';

commit;

