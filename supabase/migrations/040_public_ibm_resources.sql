-- Migration 040: Public IBM Resources & Analytics
-- Implements tightly-scoped public IBM Resources for Sections A, B, C, D
-- Preserves Intel-1 and Intel-2 as completely login-protected and unchanged.
-- Strict scope: shared IBM notes remain single source of truth with server-controlled visibility.

begin;

-- 1. Server-controlled visibility for resources ('public', 'authenticated', 'private')
alter table public.resources
add column if not exists visibility text not null default 'authenticated'
check (visibility in ('public', 'authenticated', 'private'));

create index if not exists idx_resources_visibility
on public.resources(visibility, published_at desc)
where deleted_at is null;

-- 2. Grants for anonymous visitors
grant usage on schema public to anon;
grant select on public.resources to anon;
grant select on public.classes to anon;
grant select on public.subjects to anon;

-- 3. Row-Level Security for public IBM resources
-- Anonymous users can ONLY read approved public resources from IBM classes
drop policy if exists resources_read_public on public.resources;
create policy resources_read_public on public.resources
  for select to anon
  using (
    published_at is not null
    and deleted_at is null
    and visibility = 'public'
    and public.is_ibm_class(class_id)
  );

-- Authenticated users can also read public IBM resources
drop policy if exists resources_read_public_auth on public.resources;
create policy resources_read_public_auth on public.resources
  for select to authenticated
  using (
    published_at is not null
    and deleted_at is null
    and visibility = 'public'
    and public.is_ibm_class(class_id)
  );

-- Allow CRs and admins to update resource visibility and unpublish
drop policy if exists resources_update_cr_admin on public.resources;
create policy resources_update_cr_admin on public.resources
  for update to authenticated
  using (
    public.has_class_role(class_id, 'cr')
    or public.has_class_role(class_id, 'admin')
    or public.is_classboard_founder()
  )
  with check (
    public.has_class_role(class_id, 'cr')
    or public.has_class_role(class_id, 'admin')
    or public.is_classboard_founder()
  );

-- Anonymous users can read IBM classes metadata (code, name, semester)
drop policy if exists classes_read_public_ibm on public.classes;
create policy classes_read_public_ibm on public.classes
  for select to anon
  using (
    is_active and code in ('IBM-1', 'IBM-2', 'IBM-3', 'IBM-4')
  );

-- Anonymous users can read subjects belonging to IBM classes
drop policy if exists subjects_read_public_ibm on public.subjects;
create policy subjects_read_public_ibm on public.subjects
  for select to anon
  using (
    is_active and public.is_ibm_class(class_id)
  );

-- 4. Storage Access Control: update can_read_resource_object
-- Permits anonymous download/preview ONLY for approved public IBM resources
create or replace function public.can_read_resource_object(object_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.resources r
    where r.storage_path = object_name
      and r.published_at is not null
      and r.deleted_at is null
      and (
        -- Public IBM resources are readable without login
        (r.visibility = 'public' and public.is_ibm_class(r.class_id))
        -- Authenticated member access (section or shared cohort)
        or (
          (auth.uid() is not null) and (
            public.is_active_class_member(r.class_id)
            or (public.is_ibm_class(r.class_id) and public.is_active_ibm_member())
            or (public.is_intel_class(r.class_id) and public.is_active_intel_member())
          )
        )
      )
  ) or exists (
    select 1 from public.updates u
    where u.attachment_path = object_name
      and u.published_at is not null
      and (u.expires_at is null or u.expires_at > now())
      and (auth.uid() is not null)
      and (
        public.is_active_class_member(u.class_id)
        or (public.is_ibm_class(u.class_id) and public.is_active_ibm_member())
        or (public.is_intel_class(u.class_id) and public.is_active_intel_member())
      )
  );
$$;

revoke all on function public.can_read_resource_object(text) from public;
grant execute on function public.can_read_resource_object(text) to anon, authenticated;

-- Storage objects policy for anonymous reading
drop policy if exists class_resource_download_public on storage.objects;
create policy class_resource_download_public on storage.objects
  for select to anon
  using (bucket_id = 'class-resources' and public.can_read_resource_object(name));

-- 5. Public IBM Resource Events Table (Founder Dashboard Analytics)
create table if not exists public.ibm_resource_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,               -- anonymous persistent visitor UUID
  session_id text not null,               -- anonymous browsing session UUID
  event_type text not null check (event_type in ('pageview', 'detail_view', 'preview', 'download', 'cta_login_click')),
  resource_id uuid references public.resources(id) on delete set null,
  resource_title text,
  metadata jsonb not null default '{}'::jsonb,
  is_monetizable boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_ibm_events_created on public.ibm_resource_events(created_at desc);
create index if not exists idx_ibm_events_type on public.ibm_resource_events(event_type);
create index if not exists idx_ibm_events_resource on public.ibm_resource_events(resource_id);
create index if not exists idx_ibm_events_visitor on public.ibm_resource_events(visitor_id);
create index if not exists idx_ibm_events_session on public.ibm_resource_events(session_id);

alter table public.ibm_resource_events enable row level security;

-- Founders can view IBM analytics
drop policy if exists "Founders read ibm resource events" on public.ibm_resource_events;
create policy "Founders read ibm resource events" on public.ibm_resource_events
  for select to authenticated
  using (public.is_classboard_founder());

-- SECURITY DEFINER RPC: record_ibm_resource_event
create or replace function public.record_ibm_resource_event(
  p_visitor_id text,
  p_session_id text,
  p_event_type text,
  p_resource_id uuid default null,
  p_resource_title text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clean_vid text := trim(coalesce(p_visitor_id, ''));
  v_clean_sid text := trim(coalesce(p_session_id, ''));
  v_type text := lower(trim(coalesce(p_event_type, '')));
  v_is_monetizable boolean := false;
begin
  if v_clean_vid = '' or v_type not in ('pageview', 'detail_view', 'preview', 'download', 'cta_login_click') then
    return;
  end if;

  if v_clean_sid = '' then
    v_clean_sid := v_clean_vid;
  end if;

  -- Eligible IBM Resources listing & resource-detail views count as monetizable ad inventory
  if v_type in ('pageview', 'detail_view') then
    v_is_monetizable := true;
  end if;

  insert into public.ibm_resource_events (
    visitor_id,
    session_id,
    event_type,
    resource_id,
    resource_title,
    metadata,
    is_monetizable,
    created_at
  )
  values (
    v_clean_vid,
    v_clean_sid,
    v_type,
    p_resource_id,
    nullif(trim(p_resource_title), ''),
    coalesce(p_metadata, '{}'::jsonb),
    v_is_monetizable,
    clock_timestamp()
  );
end;
$$;

revoke all on function public.record_ibm_resource_event(text, text, text, uuid, text, jsonb) from public;
grant execute on function public.record_ibm_resource_event(text, text, text, uuid, text, jsonb) to anon, authenticated;

-- 6. Update Founder Analytics Dashboard RPC to include IBM Resources Analytics
create or replace function public.get_founder_analytics_dashboard(
  p_timeframe text default '7d'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_today_start timestamptz := (timezone('Asia/Kolkata', v_now)::date::timestamp at time zone 'Asia/Kolkata');
  v_7d_start timestamptz := v_now - interval '7 days';
  v_30d_start timestamptz := v_now - interval '30 days';
  v_start_time timestamptz;
  v_tf text := lower(trim(coalesce(p_timeframe, '7d')));

  -- Student Metrics
  v_active_students_today int := 0;
  v_active_students_7d int := 0;
  v_active_students_period int := 0;
  v_valid_pageviews_today int := 0;
  v_valid_pageviews_7d int := 0;
  v_valid_pageviews_period int := 0;
  v_monetizable_pageviews_7d int := 0;
  v_monetizable_pageviews_period int := 0;
  v_student_sessions_period int := 0;
  v_views_per_session numeric := 0;
  v_views_per_student numeric := 0;
  v_returning_students_7d int := 0;
  v_return_rate_7d numeric := 0;
  v_avg_engagement_seconds int := 0;

  -- Public Landing Metrics
  v_landing_pageviews int := 0;
  v_landing_unique_visitors int := 0;
  v_landing_successful_logins int := 0;
  v_landing_conversion_rate numeric := 0;
  v_landing_monetizable_views_7d int := 0;

  -- Public IBM Resources Metrics
  v_ibm_pageviews int := 0;
  v_ibm_unique_visitors int := 0;
  v_ibm_detail_views int := 0;
  v_ibm_previews int := 0;
  v_ibm_downloads int := 0;
  v_ibm_cta_clicks int := 0;
  v_ibm_monetizable_views int := 0;
  v_ibm_monetizable_views_7d int := 0;
  v_ibm_top_resources jsonb := '[]'::jsonb;

  -- Revenue Potential (Constants ₹15 & ₹30 RPM)
  c_rpm_low constant numeric := 15.0;
  c_rpm_ground constant numeric := 30.0;
  v_total_monetizable_7d numeric := 0;
  v_projected_monthly_views numeric := 0;
  v_revenue_low numeric := 0;
  v_revenue_ground numeric := 0;

  -- Trend & Breakdown Data
  v_trend_json jsonb := '[]'::jsonb;
  v_top_pages_json jsonb := '[]'::jsonb;
  v_class_usage_json jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  -- Founder authorization check
  if not public.is_classboard_founder() then
    raise exception 'Access denied: Founder authorization required' using errcode = '42501';
  end if;

  if v_tf = 'today' then
    v_start_time := v_today_start;
  elsif v_tf = '30d' then
    v_start_time := v_30d_start;
  else
    v_tf := '7d';
    v_start_time := v_7d_start;
  end if;

  -- Temp table of excluded non-student accounts
  drop table if exists pg_temp.temp_excluded_users;
  create temporary table temp_excluded_users (user_id uuid primary key) on commit drop;

  insert into temp_excluded_users (user_id)
  select user_id from public.classboard_founders
  union
  select id from auth.users
  where lower(email) in ('en25cs3070059@medicaps.ac.in', 'en25cs3070130@medicaps.ac.in')
     or lower(email) like '%test%' or lower(email) like '%demo%'
  union
  select user_id from public.class_memberships
  where role in ('admin', 'cr') and is_active and user_id is not null
  union
  select user_id from public.app_testers
  where is_active and user_id is not null
  on conflict do nothing;

  -- 1. Student Usage Calculations
  select count(distinct a.user_id) into v_active_students_today
  from public.user_activity a
  where a.created_at >= v_today_start and a.action <> 'heartbeat'
    and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id);

  select count(distinct a.user_id) into v_active_students_7d
  from public.user_activity a
  where a.created_at >= v_7d_start and a.action <> 'heartbeat'
    and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id);

  select count(distinct a.user_id) into v_active_students_period
  from public.user_activity a
  where a.created_at >= v_start_time and a.action <> 'heartbeat'
    and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id);

  select count(*) into v_valid_pageviews_today
  from public.user_activity a
  where a.created_at >= v_today_start and a.action = 'page_view'
    and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id);

  select count(*) into v_valid_pageviews_7d
  from public.user_activity a
  where a.created_at >= v_7d_start and a.action = 'page_view'
    and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id);

  select count(*) into v_valid_pageviews_period
  from public.user_activity a
  where a.created_at >= v_start_time and a.action = 'page_view'
    and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id);

  select count(*) into v_monetizable_pageviews_7d
  from public.user_activity a
  where a.created_at >= v_7d_start and a.action = 'page_view'
    and lower(coalesce(a.page, 'home')) not in ('login', 'authgate', 'admin', 'founder', 'cr', 'tester')
    and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id);

  select count(*) into v_monetizable_pageviews_period
  from public.user_activity a
  where a.created_at >= v_start_time and a.action = 'page_view'
    and lower(coalesce(a.page, 'home')) not in ('login', 'authgate', 'admin', 'founder', 'cr', 'tester')
    and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id);

  with student_events as (
    select a.user_id, a.created_at,
           lag(a.created_at) over (partition by a.user_id order by a.created_at) as prev_created_at
    from public.user_activity a
    where a.created_at >= v_start_time and a.action <> 'heartbeat'
      and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id)
  )
  select count(*) into v_student_sessions_period
  from student_events
  where prev_created_at is null or (created_at - prev_created_at) > interval '30 minutes';

  if v_student_sessions_period = 0 then
    select count(*) into v_student_sessions_period
    from public.user_sessions s
    where s.signed_in_at >= v_start_time
      and not exists (select 1 from temp_excluded_users e where e.user_id = s.user_id);
  end if;

  if v_student_sessions_period > 0 then
    v_views_per_session := round(v_valid_pageviews_period::numeric / v_student_sessions_period, 2);
  end if;

  if v_active_students_period > 0 then
    v_views_per_student := round(v_valid_pageviews_period::numeric / v_active_students_period, 2);
  end if;

  with multi_day_students as (
    select a.user_id
    from public.user_activity a
    where a.created_at >= v_7d_start and a.action <> 'heartbeat'
      and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id)
    group by a.user_id
    having count(distinct (timezone('Asia/Kolkata', a.created_at)::date)) >= 2
  )
  select count(*) into v_returning_students_7d from multi_day_students;

  if v_active_students_7d > 0 then
    v_return_rate_7d := round((v_returning_students_7d::numeric / v_active_students_7d) * 100, 1);
  end if;

  with session_spans as (
    select s.user_id,
           extract(epoch from (coalesce(s.last_seen_at, s.signed_in_at) - s.signed_in_at)) as duration_sec
    from public.user_sessions s
    where s.signed_in_at >= v_start_time
      and not exists (select 1 from temp_excluded_users e where e.user_id = s.user_id)
  )
  select coalesce(round(avg(greatest(duration_sec, 30)))::int, 0)
  into v_avg_engagement_seconds
  from session_spans;

  -- 2. Public Landing Analytics
  select
    count(*),
    count(distinct visitor_id),
    count(distinct visitor_id) filter (where is_converted = true)
  into
    v_landing_pageviews,
    v_landing_unique_visitors,
    v_landing_successful_logins
  from public.landing_page_events
  where created_at >= v_start_time;

  select count(*) into v_landing_monetizable_views_7d
  from public.landing_page_events
  where created_at >= v_7d_start;

  if v_landing_pageviews = 0 then
    select count(*) into v_landing_pageviews
    from public.platform_telemetry
    where created_at >= v_start_time and not is_authenticated;

    select count(*) into v_landing_monetizable_views_7d
    from public.platform_telemetry
    where created_at >= v_7d_start and not is_authenticated;

    v_landing_unique_visitors := v_landing_pageviews;
  end if;

  if v_landing_unique_visitors > 0 then
    v_landing_conversion_rate := round((v_landing_successful_logins::numeric / v_landing_unique_visitors) * 100, 1);
  end if;

  -- 3. Public IBM Resources Analytics
  select
    coalesce(count(*) filter (where event_type = 'pageview'), 0),
    coalesce(count(distinct visitor_id), 0),
    coalesce(count(*) filter (where event_type = 'detail_view'), 0),
    coalesce(count(*) filter (where event_type = 'preview'), 0),
    coalesce(count(*) filter (where event_type = 'download'), 0),
    coalesce(count(*) filter (where event_type = 'cta_login_click'), 0),
    coalesce(count(*) filter (where is_monetizable = true), 0)
  into
    v_ibm_pageviews,
    v_ibm_unique_visitors,
    v_ibm_detail_views,
    v_ibm_previews,
    v_ibm_downloads,
    v_ibm_cta_clicks,
    v_ibm_monetizable_views
  from public.ibm_resource_events
  where created_at >= v_start_time;

  select coalesce(count(*) filter (where is_monetizable = true), 0)
  into v_ibm_monetizable_views_7d
  from public.ibm_resource_events
  where created_at >= v_7d_start;

  -- Top Public IBM Resources
  select coalesce(jsonb_agg(sub), '[]'::jsonb)
  into v_ibm_top_resources
  from (
    select
      coalesce(resource_title, 'Untitled Resource') as title,
      count(*) filter (where event_type in ('pageview', 'detail_view')) as views,
      count(*) filter (where event_type = 'preview') as previews,
      count(*) filter (where event_type = 'download') as downloads
    from public.ibm_resource_events
    where created_at >= v_start_time and resource_title is not null
    group by resource_title
    order by views desc, downloads desc
    limit 5
  ) sub;

  -- 4. Revenue Potential Calculations
  -- totalMonetizableViewsLast7Days = landingMonetizableViewsLast7Days + ibmMonetizableViewsLast7Days + authenticatedMonetizableViewsLast7Days
  v_total_monetizable_7d := v_landing_monetizable_views_7d + v_ibm_monetizable_views_7d + v_monetizable_pageviews_7d;

  -- projectedMonthlyMonetizableViews = (totalMonetizableViewsLast7Days / 7) * 30
  v_projected_monthly_views := round((v_total_monetizable_7d / 7.0) * 30.0);

  -- lowEstimate = (projectedMonthlyMonetizableViews / 1000) * 15
  v_revenue_low := round((v_projected_monthly_views / 1000.0) * c_rpm_low, 2);

  -- groundEstimate = (projectedMonthlyMonetizableViews / 1000) * 30
  v_revenue_ground := round((v_projected_monthly_views / 1000.0) * c_rpm_ground, 2);

  -- 5. Multi-line Trend (Daily breakdown)
  with daily_series as (
    select generate_series(
      (timezone('Asia/Kolkata', v_start_time)::date),
      (timezone('Asia/Kolkata', v_now)::date),
      '1 day'::interval
    )::date as day_date
  ),
  daily_students as (
    select timezone('Asia/Kolkata', a.created_at)::date as day_date,
           count(distinct a.user_id) as active_count,
           count(*) filter (where a.action = 'page_view') as views_count
    from public.user_activity a
    where a.created_at >= v_start_time and a.action <> 'heartbeat'
      and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id)
    group by 1
  ),
  daily_landing as (
    select timezone('Asia/Kolkata', l.created_at)::date as day_date,
           count(*) as landing_count
    from public.landing_page_events l
    where l.created_at >= v_start_time
    group by 1
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date', to_char(s.day_date, 'YYYY-MM-DD'),
      'day_label', to_char(s.day_date, 'Dy'),
      'active_students', coalesce(ds.active_count, 0),
      'pageviews', coalesce(ds.views_count, 0),
      'landing_visitors', coalesce(dl.landing_count, 0)
    ) order by s.day_date
  ), '[]'::jsonb)
  into v_trend_json
  from daily_series s
  left join daily_students ds on ds.day_date = s.day_date
  left join daily_landing dl on dl.day_date = s.day_date;

  -- 6. Top Pages Breakdown
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'page', sub.page_name,
      'views', sub.view_count
    )
  ), '[]'::jsonb)
  into v_top_pages_json
  from (
    select
      case
        when lower(coalesce(a.page, 'home')) in ('home', '') then 'Student Dashboard (Home)'
        when lower(a.page) = 'resources' then 'Notes & Syllabus'
        when lower(a.page) = 'updates' then 'Class Announcements'
        when lower(a.page) = 'academics' then 'Academics & Timetable'
        when lower(a.page) = 'classlog' then 'Class Log & Sessions'
        when lower(a.page) = 'attendance' then 'Attendance Tracker & Health'
        when lower(a.page) = 'calculator' then 'Target & Margin Calculator'
        when lower(a.page) = 'admin' then 'Admin'
        when lower(a.page) = 'profile' then 'Profile'
        else initcap(a.page)
      end as page_name,
      count(*) as view_count
    from public.user_activity a
    where a.created_at >= v_start_time and a.action = 'page_view'
      and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id)
    group by 1
    order by view_count desc
    limit 6
  ) sub;

  -- 7. Section / Cohort Breakdown
  with user_cohorts as (
    select m.user_id, c.code as cohort_name
    from public.class_memberships m
    join public.classes c on c.id = m.class_id
    where m.is_active and m.role = 'student'
  ),
  cohort_activity as (
    select coalesce(uc.cohort_name, 'Other') as cohort, count(distinct a.user_id) as active_count
    from public.user_activity a
    left join user_cohorts uc on uc.user_id = a.user_id
    where a.created_at >= v_start_time and a.action <> 'heartbeat'
      and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id)
    group by 1
  ),
  total_active as (
    select nullif(sum(active_count), 0) as total from cohort_activity
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'cohort', ca.cohort,
      'active_users', ca.active_count,
      'percentage', round((ca.active_count::numeric / coalesce(t.total, 1)) * 100, 1)
    ) order by ca.active_count desc
  ), '[]'::jsonb)
  into v_class_usage_json
  from cohort_activity ca
  cross join total_active t;

  -- Assemble Final Dashboard Object
  v_result := jsonb_build_object(
    'timeframe', v_tf,
    'generated_at', v_now,
    'student_usage', jsonb_build_object(
      'active_students_today', v_active_students_today,
      'active_students_7d', v_active_students_7d,
      'active_students_period', v_active_students_period,
      'valid_pageviews_today', v_valid_pageviews_today,
      'valid_pageviews_7d', v_valid_pageviews_7d,
      'valid_pageviews_period', v_valid_pageviews_period,
      'monetizable_pageviews', v_monetizable_pageviews_period,
      'monetizable_pageviews_7d', v_monetizable_pageviews_7d,
      'student_sessions', v_student_sessions_period,
      'views_per_session', v_views_per_session,
      'views_per_student', v_views_per_student,
      'returning_students_7d', v_returning_students_7d,
      'return_rate_7d', v_return_rate_7d,
      'avg_engagement_seconds', v_avg_engagement_seconds
    ),
    'public_landing', jsonb_build_object(
      'landing_pageviews', v_landing_pageviews,
      'unique_landing_visitors', v_landing_unique_visitors,
      'successful_logins', v_landing_successful_logins,
      'conversion_rate', v_landing_conversion_rate
    ),
    'ibm_resources_analytics', jsonb_build_object(
      'pageviews', v_ibm_pageviews,
      'unique_visitors', v_ibm_unique_visitors,
      'detail_views', v_ibm_detail_views,
      'previews', v_ibm_previews,
      'downloads', v_ibm_downloads,
      'cta_login_clicks', v_ibm_cta_clicks,
      'monetizable_pageviews', v_ibm_monetizable_views,
      'top_resources', v_ibm_top_resources
    ),
    'revenue_potential', jsonb_build_object(
      'rpm_low', c_rpm_low,
      'rpm_ground', c_rpm_ground,
      'total_monetizable_views_last_7_days', v_total_monetizable_7d,
      'projected_monthly_monetizable_views', v_projected_monthly_views,
      'low_estimate', v_revenue_low,
      'ground_estimate', v_revenue_ground
    ),
    'traffic_retention_trend', v_trend_json,
    'top_pages', v_top_pages_json,
    'class_usage', v_class_usage_json
  );

  return v_result;
end;
$$;

revoke all on function public.get_founder_analytics_dashboard(text) from public;
grant execute on function public.get_founder_analytics_dashboard(text) to authenticated;

commit;
