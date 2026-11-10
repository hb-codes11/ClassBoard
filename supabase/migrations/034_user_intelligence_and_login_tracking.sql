-- Migration 034: Founder Workspace - Accurate Login Tracking & Real-Time User Activity Intelligence
-- Implements production-ready tracking of user logins, sessions, presence, and activity history.

begin;

-- 1. Create user_sessions table
create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  signed_in_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  signed_out_at timestamptz,
  device_info jsonb not null default '{}'::jsonb,
  session_status text not null default 'active',
  created_at timestamptz not null default now()
);

create index if not exists idx_user_sessions_user_id on public.user_sessions(user_id);
create index if not exists idx_user_sessions_last_seen on public.user_sessions(last_seen_at desc);
create index if not exists idx_user_sessions_status on public.user_sessions(session_status);
create index if not exists idx_user_sessions_signed_in on public.user_sessions(signed_in_at desc);

-- 2. Create user_login_events table (Append-only historical login record)
create table if not exists public.user_login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  signed_in_at timestamptz not null default now(),
  auth_method text not null,
  session_id uuid references public.user_sessions(id) on delete set null,
  device_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_login_events_user_id on public.user_login_events(user_id);
create index if not exists idx_user_login_events_signed_in on public.user_login_events(signed_in_at desc);
create index if not exists idx_user_login_events_auth_method on public.user_login_events(auth_method);

-- 3. Create user_activity table (Audit trail of meaningful user actions)
create table if not exists public.user_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.user_sessions(id) on delete set null,
  action text not null,
  description text not null,
  page text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_activity_user_id on public.user_activity(user_id);
create index if not exists idx_user_activity_created_at on public.user_activity(created_at desc);
create index if not exists idx_user_activity_action on public.user_activity(action);
create index if not exists idx_user_activity_page on public.user_activity(page);

-- 4. Extend profiles table with intelligence summary columns
alter table public.profiles
  add column if not exists last_signed_in_at timestamptz,
  add column if not exists last_active_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists total_sessions integer not null default 0,
  add column if not exists total_logins integer not null default 0;

-- 5. Enable Row Level Security (RLS) on all tables
alter table public.user_sessions enable row level security;
alter table public.user_login_events enable row level security;
alter table public.user_activity enable row level security;

-- Drop existing policies if any to ensure clean idempotent run
drop policy if exists "Founders read all sessions" on public.user_sessions;
drop policy if exists "Users read own sessions" on public.user_sessions;
drop policy if exists "Founders read all login events" on public.user_login_events;
drop policy if exists "Users read own login events" on public.user_login_events;
drop policy if exists "Founders read all activity" on public.user_activity;
drop policy if exists "Users read own activity" on public.user_activity;

-- Policies for user_sessions
create policy "Founders read all sessions" on public.user_sessions
  for select to authenticated
  using (public.is_classboard_founder());

create policy "Users read own sessions" on public.user_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Policies for user_login_events
create policy "Founders read all login events" on public.user_login_events
  for select to authenticated
  using (public.is_classboard_founder());

create policy "Users read own login events" on public.user_login_events
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Policies for user_activity
create policy "Founders read all activity" on public.user_activity
  for select to authenticated
  using (public.is_classboard_founder());

create policy "Users read own activity" on public.user_activity
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Revoke direct insert/update/delete from non-admin roles to guarantee write security through definer RPCs
revoke insert, update, delete on public.user_sessions from anon, authenticated;
revoke insert, update, delete on public.user_login_events from anon, authenticated;
revoke insert, update, delete on public.user_activity from anon, authenticated;

-- 6. SECURITY DEFINER RPC: record_user_login
-- Handles reliable login event recording with anti-duplication protection
create or replace function public.record_user_login(
  p_auth_method text,
  p_device_info jsonb default '{}'::jsonb,
  p_is_explicit_login boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_session_id uuid;
  v_recent_login record;
  v_recent_session record;
  v_now timestamptz := clock_timestamp();
  v_method text := coalesce(nullif(trim(p_auth_method), ''), 'email');
  v_dev jsonb := coalesce(p_device_info, '{}'::jsonb);
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- If not an explicit fresh login (i.e. session restoration / new tab in existing authenticated state):
  if not p_is_explicit_login then
    -- Check if an active session exists from the last 2 hours
    select id into v_recent_session
    from public.user_sessions
    where user_id = v_uid
      and session_status = 'active'
      and last_seen_at >= (v_now - interval '2 hours')
    order by last_seen_at desc
    limit 1;

    if v_recent_session.id is not null then
      update public.user_sessions
      set last_seen_at = v_now, device_info = v_dev
      where id = v_recent_session.id;

      update public.profiles
      set last_seen_at = v_now
      where user_id = v_uid;

      return jsonb_build_object(
        'session_id', v_recent_session.id,
        'is_new_login', false,
        'user_id', v_uid
      );
    end if;

    -- Otherwise create a restored session record without creating a login event
    insert into public.user_sessions (
      user_id, signed_in_at, last_seen_at, device_info, session_status
    ) values (
      v_uid, v_now, v_now, v_dev, 'active'
    ) returning id into v_session_id;

    update public.profiles
    set
      last_seen_at = v_now,
      total_sessions = coalesce(total_sessions, 0) + 1,
      updated_at = v_now
    where user_id = v_uid;

    return jsonb_build_object(
      'session_id', v_session_id,
      'is_new_login', false,
      'user_id', v_uid
    );
  end if;

  -- Explicit fresh login:
  -- Deduplication check: prevent multiple login events within 30 seconds for same user and method
  select id, session_id into v_recent_login
  from public.user_login_events
  where user_id = v_uid
    and signed_in_at >= (v_now - interval '30 seconds')
    and auth_method = v_method
  order by signed_in_at desc
  limit 1;

  if v_recent_login.id is not null then
    -- Return existing session without creating a duplicate login event or incrementing totals
    return jsonb_build_object(
      'session_id', v_recent_login.session_id,
      'is_new_login', false,
      'user_id', v_uid
    );
  end if;

  -- Close stale active sessions for this user older than 12 hours
  update public.user_sessions
  set session_status = 'expired'
  where user_id = v_uid
    and session_status = 'active'
    and last_seen_at < (v_now - interval '12 hours');

  -- Create new user session
  insert into public.user_sessions (
    user_id,
    signed_in_at,
    last_seen_at,
    device_info,
    session_status
  ) values (
    v_uid,
    v_now,
    v_now,
    v_dev,
    'active'
  ) returning id into v_session_id;

  -- Create append-only login event record
  insert into public.user_login_events (
    user_id,
    signed_in_at,
    auth_method,
    session_id,
    device_info
  ) values (
    v_uid,
    v_now,
    v_method,
    v_session_id,
    v_dev
  );

  -- Record initial activity
  insert into public.user_activity (
    user_id,
    session_id,
    action,
    description,
    page,
    metadata
  ) values (
    v_uid,
    v_session_id,
    'login',
    'Signed into ClassBoard via ' || v_method,
    'auth',
    jsonb_build_object('method', v_method, 'device', v_dev)
  );

  -- Update profiles summary fields
  update public.profiles
  set
    last_signed_in_at = v_now,
    last_seen_at = v_now,
    last_active_at = v_now,
    total_sessions = coalesce(total_sessions, 0) + 1,
    total_logins = coalesce(total_logins, 0) + 1,
    updated_at = v_now
  where user_id = v_uid;

  return jsonb_build_object(
    'session_id', v_session_id,
    'is_new_login', true,
    'user_id', v_uid
  );
end;
$$;

revoke all on function public.record_user_login(text, jsonb, boolean) from public, anon;
grant execute on function public.record_user_login(text, jsonb, boolean) to authenticated;

-- 7. SECURITY DEFINER RPC: user_heartbeat
-- Updates last_seen_at for session and profile
create or replace function public.user_heartbeat(
  p_session_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_now timestamptz := clock_timestamp();
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    return false;
  end if;

  if p_session_id is not null then
    update public.user_sessions
    set last_seen_at = v_now
    where id = p_session_id and user_id = v_uid and session_status = 'active';
  end if;

  update public.profiles
  set last_seen_at = v_now
  where user_id = v_uid;

  return true;
end;
$$;

revoke all on function public.user_heartbeat(uuid) from public, anon;
grant execute on function public.user_heartbeat(uuid) to authenticated;

-- 8. SECURITY DEFINER RPC: record_user_activity
-- Logs user actions (page views, note clicks, downloads, posts) and touches activity timestamps
create or replace function public.record_user_activity(
  p_action text,
  p_description text,
  p_page text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_session_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_act_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.user_activity (
    user_id,
    session_id,
    action,
    description,
    page,
    metadata,
    created_at
  ) values (
    v_uid,
    p_session_id,
    coalesce(nullif(trim(p_action), ''), 'action'),
    coalesce(nullif(trim(p_description), ''), 'User action'),
    p_page,
    coalesce(p_metadata, '{}'::jsonb),
    v_now
  ) returning id into v_act_id;

  update public.profiles
  set
    last_active_at = v_now,
    last_seen_at = v_now,
    updated_at = v_now
  where user_id = v_uid;

  if p_session_id is not null then
    update public.user_sessions
    set last_seen_at = v_now
    where id = p_session_id and user_id = v_uid;
  end if;

  return v_act_id;
end;
$$;

revoke all on function public.record_user_activity(text, text, text, jsonb, uuid) from public, anon;
grant execute on function public.record_user_activity(text, text, text, jsonb, uuid) to authenticated;

-- 9. SECURITY DEFINER RPC: record_user_logout
create or replace function public.record_user_logout(
  p_session_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_now timestamptz := clock_timestamp();
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    return false;
  end if;

  if p_session_id is not null then
    update public.user_sessions
    set
      session_status = 'closed',
      signed_out_at = v_now,
      last_seen_at = v_now
    where id = p_session_id and user_id = v_uid;
  end if;

  insert into public.user_activity (
    user_id,
    session_id,
    action,
    description,
    page,
    metadata,
    created_at
  ) values (
    v_uid,
    p_session_id,
    'logout',
    'Signed out of ClassBoard',
    'auth',
    '{}'::jsonb,
    v_now
  );

  return true;
end;
$$;

revoke all on function public.record_user_logout(uuid) from public, anon;
grant execute on function public.record_user_logout(uuid) to authenticated;

-- 10. SECURITY DEFINER RPC: get_founder_user_intelligence_metrics
-- Computes the 8 core KPIs strictly from live database records
create or replace function public.get_founder_user_intelligence_metrics()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_today_start timestamptz := (timezone('Asia/Kolkata', v_now)::date::timestamp at time zone 'Asia/Kolkata');
  v_metrics jsonb;
begin
  if not public.is_classboard_founder() then
    raise exception 'Access denied: Founder authorization required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_registered_users', (select count(*) from auth.users),
    'currently_online_users', (
      select count(distinct user_id)
      from public.user_sessions
      where last_seen_at >= (v_now - interval '3 minutes')
        and session_status = 'active'
    ),
    'active_users_today', (
      select count(distinct user_id)
      from public.user_activity
      where created_at >= v_today_start
    ),
    'new_registrations_today', (
      select count(*)
      from auth.users
      where created_at >= v_today_start
    ),
    'successful_logins_today', (
      select count(*)
      from public.user_login_events
      where signed_in_at >= v_today_start
    ),
    'total_sessions_today', (
      select count(*)
      from public.user_sessions
      where signed_in_at >= v_today_start
    ),
    'returning_users', (
      select count(*)
      from public.profiles
      where total_logins > 1
    ),
    'inactive_7_days', (
      select count(*)
      from public.profiles
      where coalesce(last_active_at, last_signed_in_at, created_at) < (v_now - interval '7 days')
    )
  ) into v_metrics;

  return v_metrics;
end;
$$;

revoke all on function public.get_founder_user_intelligence_metrics() from public, anon;
grant execute on function public.get_founder_user_intelligence_metrics() to authenticated;

-- 11. SECURITY DEFINER RPC: get_founder_user_intelligence_users
-- Paginated user list with full activity intelligence and presence state
create or replace function public.get_founder_user_intelligence_users(
  p_search text default null,
  p_status_filter text default 'all',
  p_sort_by text default 'last_active',
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_search text := lower(trim(coalesce(p_search, '')));
  v_total int;
  v_rows jsonb;
begin
  if not public.is_classboard_founder() then
    raise exception 'Access denied: Founder authorization required' using errcode = '42501';
  end if;

  select count(*) into v_total
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where
    (v_search = '' or (
      lower(u.email) like '%' || v_search || '%'
      or lower(coalesce(p.display_name, '')) like '%' || v_search || '%'
    ))
    and (
      p_status_filter = 'all'
      or (p_status_filter = 'online' and p.last_seen_at >= (v_now - interval '3 minutes'))
      or (p_status_filter = 'recently_active' and p.last_seen_at >= (v_now - interval '15 minutes') and p.last_seen_at < (v_now - interval '3 minutes'))
      or (p_status_filter = 'offline' and (p.last_seen_at is null or p.last_seen_at < (v_now - interval '15 minutes')))
    );

  with raw_users as (
    select
      u.id as user_id,
      u.email,
      u.created_at as registered_at,
      p.display_name,
      p.last_signed_in_at,
      p.last_active_at,
      p.last_seen_at,
      coalesce(p.total_sessions, 0) as total_sessions,
      coalesce(p.total_logins, 0) as total_logins,
      case
        when p.last_seen_at >= (v_now - interval '3 minutes') then 'online'
        when p.last_seen_at >= (v_now - interval '15 minutes') then 'recently_active'
        else 'offline'
      end as presence_status,
      (
        select cm.roll_number
        from public.class_memberships cm
        where cm.user_id = u.id and cm.is_active and cm.role = 'student'
        order by cm.created_at asc limit 1
      ) as roll_number,
      (
        select c.code
        from public.class_memberships cm
        join public.classes c on c.id = cm.class_id
        where cm.user_id = u.id and cm.is_active
        order by cm.created_at asc limit 1
      ) as class_code,
      (
        select coalesce(jsonb_agg(distinct cm.role), '[]'::jsonb)
        from public.class_memberships cm
        where cm.user_id = u.id and cm.is_active
      ) as roles,
      (
        select le.auth_method
        from public.user_login_events le
        where le.user_id = u.id
        order by le.signed_in_at desc limit 1
      ) as last_auth_method,
      (
        select a.description
        from public.user_activity a
        where a.user_id = u.id
        order by a.created_at desc limit 1
      ) as latest_activity_desc,
      (
        select s.device_info
        from public.user_sessions s
        where s.user_id = u.id
        order by s.signed_in_at desc limit 1
      ) as latest_device_info
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    where
      (v_search = '' or (
        lower(u.email) like '%' || v_search || '%'
        or lower(coalesce(p.display_name, '')) like '%' || v_search || '%'
      ))
      and (
        p_status_filter = 'all'
        or (p_status_filter = 'online' and p.last_seen_at >= (v_now - interval '3 minutes'))
        or (p_status_filter = 'recently_active' and p.last_seen_at >= (v_now - interval '15 minutes') and p.last_seen_at < (v_now - interval '3 minutes'))
        or (p_status_filter = 'offline' and (p.last_seen_at is null or p.last_seen_at < (v_now - interval '15 minutes')))
      )
    order by
      case when p_sort_by = 'last_active' then p.last_active_at end desc nulls last,
      case when p_sort_by = 'last_login' then p.last_signed_in_at end desc nulls last,
      case when p_sort_by = 'sessions' then coalesce(p.total_sessions, 0) end desc,
      case when p_sort_by = 'name' then p.display_name end asc,
      u.created_at desc
    limit greatest(1, least(p_limit, 200))
    offset greatest(0, p_offset)
  )
  select coalesce(jsonb_agg(to_jsonb(raw_users)), '[]'::jsonb)
  into v_rows
  from raw_users;

  return jsonb_build_object(
    'total', v_total,
    'users', v_rows,
    'limit', p_limit,
    'offset', p_offset
  );
end;
$$;

revoke all on function public.get_founder_user_intelligence_users(text, text, text, int, int) from public, anon;
grant execute on function public.get_founder_user_intelligence_users(text, text, text, int, int) to authenticated;

-- 12. SECURITY DEFINER RPC: get_founder_user_detail
-- Detailed single-user dossier
create or replace function public.get_founder_user_detail(
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_detail jsonb;
begin
  if not public.is_classboard_founder() then
    raise exception 'Access denied: Founder authorization required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'user_id', u.id,
    'email', u.email,
    'display_name', p.display_name,
    'created_at', u.created_at,
    'last_signed_in_at', p.last_signed_in_at,
    'last_active_at', p.last_active_at,
    'last_seen_at', p.last_seen_at,
    'total_sessions', coalesce(p.total_sessions, 0),
    'total_logins', coalesce(p.total_logins, 0),
    'presence_status', (
      case
        when p.last_seen_at >= (v_now - interval '3 minutes') then 'online'
        when p.last_seen_at >= (v_now - interval '15 minutes') then 'recently_active'
        else 'offline'
      end
    ),
    'first_login_at', (
      select le.signed_in_at
      from public.user_login_events le
      where le.user_id = u.id
      order by le.signed_in_at asc limit 1
    ),
    'latest_auth_method', (
      select le.auth_method
      from public.user_login_events le
      where le.user_id = u.id
      order by le.signed_in_at desc limit 1
    ),
    'total_actions', (
      select count(*)
      from public.user_activity a
      where a.user_id = u.id
    ),
    'resources_accessed_count', (
      select count(*)
      from public.user_activity a
      where a.user_id = u.id and a.action in ('resource_view', 'resource_download')
    ),
    'top_pages', (
      select coalesce(jsonb_agg(jsonb_build_object('page', sub.page, 'views', sub.cnt)), '[]'::jsonb)
      from (
        select page, count(*) as cnt
        from public.user_activity
        where user_id = u.id and page is not null and page <> ''
        group by page
        order by count(*) desc
        limit 5
      ) sub
    ),
    'recent_sessions', (
      select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
      from (
        select id, signed_in_at, last_seen_at, signed_out_at, device_info, session_status
        from public.user_sessions
        where user_id = u.id
        order by signed_in_at desc
        limit 8
      ) s
    ),
    'roles', (
      select coalesce(jsonb_agg(distinct cm.role), '[]'::jsonb)
      from public.class_memberships cm
      where cm.user_id = u.id and cm.is_active
    ),
    'roll_number', (
      select cm.roll_number
      from public.class_memberships cm
      where cm.user_id = u.id and cm.is_active and cm.role = 'student'
      limit 1
    ),
    'class_code', (
      select c.code
      from public.class_memberships cm
      join public.classes c on c.id = cm.class_id
      where cm.user_id = u.id and cm.is_active
      limit 1
    )
  ) into v_detail
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where u.id = p_target_user_id;

  return v_detail;
end;
$$;

revoke all on function public.get_founder_user_detail(uuid) from public, anon;
grant execute on function public.get_founder_user_detail(uuid) to authenticated;

-- 13. SECURITY DEFINER RPC: get_founder_user_timeline
-- Chronological activity timeline
create or replace function public.get_founder_user_timeline(
  p_target_user_id uuid,
  p_action_filter text default 'all',
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_events jsonb;
  v_total int;
begin
  if not public.is_classboard_founder() then
    raise exception 'Access denied: Founder authorization required' using errcode = '42501';
  end if;

  select count(*) into v_total
  from public.user_activity
  where user_id = p_target_user_id
    and (
      p_action_filter = 'all'
      or (p_action_filter = 'login' and action in ('login', 'logout'))
      or (p_action_filter = 'page_view' and action = 'page_view')
      or (p_action_filter = 'resource' and action in ('resource_view', 'resource_download'))
      or (p_action_filter = 'posts' and action in ('update_create', 'reminder_create', 'class_logged'))
    );

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  into v_events
  from (
    select id, action, description, page, metadata, created_at
    from public.user_activity
    where user_id = p_target_user_id
      and (
        p_action_filter = 'all'
        or (p_action_filter = 'login' and action in ('login', 'logout'))
        or (p_action_filter = 'page_view' and action = 'page_view')
        or (p_action_filter = 'resource' and action in ('resource_view', 'resource_download'))
        or (p_action_filter = 'posts' and action in ('update_create', 'reminder_create', 'class_logged'))
      )
    order by created_at desc
    limit greatest(1, least(p_limit, 100))
    offset greatest(0, p_offset)
  ) t;

  return jsonb_build_object(
    'total', v_total,
    'events', v_events
  );
end;
$$;

revoke all on function public.get_founder_user_timeline(uuid, text, int, int) from public, anon;
grant execute on function public.get_founder_user_timeline(uuid, text, int, int) to authenticated;

-- 14. Add monitoring tables to realtime publication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.user_login_events;
    alter publication supabase_realtime add table public.user_sessions;
    alter publication supabase_realtime add table public.user_activity;
  end if;
exception when others then
  -- publication add table can safely ignore if already added
  null;
end;
$$;

notify pgrst, 'reload schema';

commit;
