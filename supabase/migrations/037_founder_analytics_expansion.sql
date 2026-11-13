-- Migration 037: Founder Analytics Expansion & Public Landing Intelligence
-- Comprehensive student-usage analytics, privacy-safe landing visitor instrumentation,
-- retention metrics, and conservative revenue-potential modeling.
-- Access strictly founder-authorized via public.is_classboard_founder().

begin;

-- 1. Dedicated Public Landing Events Table (Privacy-Safe, Pre-Auth Telemetry)
create table if not exists public.landing_page_events (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,               -- anonymous persistent first-party UUID stored in localStorage
  session_id text not null,               -- anonymous browsing session UUID stored in sessionStorage
  referrer text,                          -- document.referrer or traffic source
  device_category text default 'Desktop', -- Mobile / Desktop / Tablet
  is_converted boolean not null default false,
  converted_user_id uuid references auth.users(id) on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_landing_events_created on public.landing_page_events(created_at desc);
create index if not exists idx_landing_events_visitor on public.landing_page_events(visitor_id);
create index if not exists idx_landing_events_session on public.landing_page_events(session_id);
create index if not exists idx_landing_events_converted on public.landing_page_events(is_converted);

alter table public.landing_page_events enable row level security;

-- Founders can inspect landing analytics
drop policy if exists "Founders read landing events" on public.landing_page_events;
create policy "Founders read landing events" on public.landing_page_events
  for select to authenticated
  using (public.is_classboard_founder());

-- 2. SECURITY DEFINER RPC: record_landing_page_view
-- Records a landing pageview with anonymous identifiers before authentication
create or replace function public.record_landing_page_view(
  p_visitor_id text,
  p_session_id text,
  p_referrer text default null,
  p_device_category text default 'Desktop'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clean_vid text := trim(coalesce(p_visitor_id, ''));
  v_clean_sid text := trim(coalesce(p_session_id, ''));
begin
  if v_clean_vid = '' then
    return;
  end if;

  if v_clean_sid = '' then
    v_clean_sid := v_clean_vid;
  end if;

  insert into public.landing_page_events (
    visitor_id,
    session_id,
    referrer,
    device_category,
    created_at
  )
  values (
    v_clean_vid,
    v_clean_sid,
    nullif(trim(p_referrer), ''),
    coalesce(nullif(trim(p_device_category), ''), 'Desktop'),
    clock_timestamp()
  );
end;
$$;

revoke all on function public.record_landing_page_view(text, text, text, text) from public;
grant execute on function public.record_landing_page_view(text, text, text, text) to anon, authenticated;

-- 3. SECURITY DEFINER RPC: record_landing_conversion
-- Links anonymous landing visitor/session to the authenticated login event
create or replace function public.record_landing_conversion(
  p_visitor_id text default null,
  p_session_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_vid text := trim(coalesce(p_visitor_id, ''));
  v_sid text := trim(coalesce(p_session_id, ''));
begin
  if v_uid is null then
    return;
  end if;

  if v_vid = '' and v_sid = '' then
    return;
  end if;

  update public.landing_page_events
  set is_converted = true,
      converted_user_id = v_uid,
      converted_at = clock_timestamp()
  where (
    (v_sid <> '' and session_id = v_sid)
    or (v_vid <> '' and visitor_id = v_vid)
  ) and is_converted = false;
end;
$$;

revoke all on function public.record_landing_conversion(text, text) from public;
grant execute on function public.record_landing_conversion(text, text) to authenticated;

-- 4. SECURITY DEFINER RPC: get_founder_analytics_dashboard
-- Computes the comprehensive analytics dataset for Founder Workspace
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

  -- Determine start time from filter
  if v_tf = 'today' then
    v_start_time := v_today_start;
  elsif v_tf = '30d' then
    v_start_time := v_30d_start;
  else
    v_tf := '7d';
    v_start_time := v_7d_start;
  end if;

  -- Create temporary table of excluded non-student accounts (Founders, Admins, Staff/CR, Testers, Bot/Demo accounts)
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
  -- Active students today & 7 days
  select count(distinct a.user_id)
  into v_active_students_today
  from public.user_activity a
  where a.created_at >= v_today_start
    and a.action <> 'heartbeat'
    and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id);

  select count(distinct a.user_id)
  into v_active_students_7d
  from public.user_activity a
  where a.created_at >= v_7d_start
    and a.action <> 'heartbeat'
    and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id);

  select count(distinct a.user_id)
  into v_active_students_period
  from public.user_activity a
  where a.created_at >= v_start_time
    and a.action <> 'heartbeat'
    and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id);

  -- Valid pageviews today & 7 days & period
  select count(*)
  into v_valid_pageviews_today
  from public.user_activity a
  where a.created_at >= v_today_start
    and a.action = 'page_view'
    and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id);

  select count(*)
  into v_valid_pageviews_7d
  from public.user_activity a
  where a.created_at >= v_7d_start
    and a.action = 'page_view'
    and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id);

  select count(*)
  into v_valid_pageviews_period
  from public.user_activity a
  where a.created_at >= v_start_time
    and a.action = 'page_view'
    and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id);

  -- Monetizable pageviews (Student Home, Resources, Attendance, Academics/Calendar, Classes, etc.)
  -- Excludes login, founder, admin, cr/staff, error screens
  select count(*)
  into v_monetizable_pageviews_7d
  from public.user_activity a
  where a.created_at >= v_7d_start
    and a.action = 'page_view'
    and lower(coalesce(a.page, 'home')) not in ('login', 'authgate', 'admin', 'founder', 'cr', 'tester')
    and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id);

  select count(*)
  into v_monetizable_pageviews_period
  from public.user_activity a
  where a.created_at >= v_start_time
    and a.action = 'page_view'
    and lower(coalesce(a.page, 'home')) not in ('login', 'authgate', 'admin', 'founder', 'cr', 'tester')
    and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id);

  -- Student Sessions (30-minute inactivity boundary rule)
  with student_events as (
    select a.user_id, a.created_at,
           lag(a.created_at) over (partition by a.user_id order by a.created_at) as prev_created_at
    from public.user_activity a
    where a.created_at >= v_start_time
      and a.action <> 'heartbeat'
      and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id)
  )
  select count(*)
  into v_student_sessions_period
  from student_events
  where prev_created_at is null or (created_at - prev_created_at) > interval '30 minutes';

  -- If no fine-grained student activity yet, fallback to logged-in sessions for student accounts
  if v_student_sessions_period = 0 then
    select count(*)
    into v_student_sessions_period
    from public.user_sessions s
    where s.signed_in_at >= v_start_time
      and not exists (select 1 from temp_excluded_users e where e.user_id = s.user_id);
  end if;

  -- Views per Session & Views per Active Student
  if v_student_sessions_period > 0 then
    v_views_per_session := round(v_valid_pageviews_period::numeric / v_student_sessions_period, 2);
  else
    v_views_per_session := 0;
  end if;

  if v_active_students_period > 0 then
    v_views_per_student := round(v_valid_pageviews_period::numeric / v_active_students_period, 2);
  else
    v_views_per_student := 0;
  end if;

  -- 7-Day Returning Students (active on >= 2 distinct calendar days in IST)
  with multi_day_students as (
    select a.user_id
    from public.user_activity a
    where a.created_at >= v_7d_start
      and a.action <> 'heartbeat'
      and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id)
    group by a.user_id
    having count(distinct (timezone('Asia/Kolkata', a.created_at)::date)) >= 2
  )
  select count(*) into v_returning_students_7d from multi_day_students;

  if v_active_students_7d > 0 then
    v_return_rate_7d := round((v_returning_students_7d::numeric / v_active_students_7d) * 100, 1);
  else
    v_return_rate_7d := 0;
  end if;

  -- Average Engagement Time per session in seconds
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

  -- Also count landing views from the last 7 days for revenue projections
  select count(*)
  into v_landing_monetizable_views_7d
  from public.landing_page_events
  where created_at >= v_7d_start;

  -- Fallback if landing_page_events is fresh: combine with platform_telemetry public views
  if v_landing_pageviews = 0 then
    select count(*)
    into v_landing_pageviews
    from public.platform_telemetry
    where created_at >= v_start_time and not is_authenticated;

    select count(*)
    into v_landing_monetizable_views_7d
    from public.platform_telemetry
    where created_at >= v_7d_start and not is_authenticated;

    v_landing_unique_visitors := v_landing_pageviews;
  end if;

  if v_landing_unique_visitors > 0 then
    v_landing_conversion_rate := round((v_landing_successful_logins::numeric / v_landing_unique_visitors) * 100, 1);
  else
    v_landing_conversion_rate := 0;
  end if;

  -- 3. Revenue Potential Calculations (Formulas matching requirements)
  -- totalMonetizableViewsLast7Days = landingMonetizableViewsLast7Days + authenticatedMonetizableViewsLast7Days
  v_total_monetizable_7d := v_landing_monetizable_views_7d + v_monetizable_pageviews_7d;

  -- projectedMonthlyMonetizableViews = (totalMonetizableViewsLast7Days / 7) * 30
  v_projected_monthly_views := round((v_total_monetizable_7d / 7.0) * 30.0);

  -- lowEstimate = (projectedMonthlyMonetizableViews / 1000) * 15
  v_revenue_low := round((v_projected_monthly_views / 1000.0) * c_rpm_low, 2);

  -- groundEstimate = (projectedMonthlyMonetizableViews / 1000) * 30
  v_revenue_ground := round((v_projected_monthly_views / 1000.0) * c_rpm_ground, 2);

  -- 4. Traffic & Retention 7-Day Daily Trend
  with daily_series as (
    select (timezone('Asia/Kolkata', v_now - (d || ' days')::interval)::date) as d_date
    from generate_series(6, 0, -1) as d
  ),
  daily_students as (
    select timezone('Asia/Kolkata', a.created_at)::date as d_date,
           count(distinct a.user_id) as active_students,
           count(*) filter (where a.action = 'page_view') as valid_views
    from public.user_activity a
    where a.created_at >= (v_now - interval '7 days')
      and a.action <> 'heartbeat'
      and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id)
    group by timezone('Asia/Kolkata', a.created_at)::date
  ),
  daily_sessions as (
    select timezone('Asia/Kolkata', s.signed_in_at)::date as d_date,
           count(*) as session_count
    from public.user_sessions s
    where s.signed_in_at >= (v_now - interval '7 days')
      and not exists (select 1 from temp_excluded_users e where e.user_id = s.user_id)
    group by timezone('Asia/Kolkata', s.signed_in_at)::date
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date', s.d_date,
      'day_name', to_char(s.d_date::timestamp, 'Dy'),
      'display_date', to_char(s.d_date::timestamp, 'Mon DD'),
      'active_students', coalesce(st.active_students, 0),
      'valid_pageviews', coalesce(st.valid_views, 0),
      'sessions', coalesce(se.session_count, 0)
    ) order by s.d_date asc
  ), '[]'::jsonb)
  into v_trend_json
  from daily_series s
  left join daily_students st on st.d_date = s.d_date
  left join daily_sessions se on se.d_date = s.d_date;

  -- 5. Top Pages (Ranked, with Public Landing vs Authenticated App distinction)
  with page_counts as (
    select
      coalesce(nullif(trim(a.page), ''), 'home') as page_key,
      count(*) as view_count
    from public.user_activity a
    where a.created_at >= v_start_time
      and a.action = 'page_view'
      and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id)
    group by coalesce(nullif(trim(a.page), ''), 'home')
  ),
  combined_pages as (
    select
      '/' as page_key,
      'Public Landing Page' as page_title,
      'public_landing' as page_type,
      v_landing_pageviews as view_count
    where v_landing_pageviews > 0
    union all
    select
      p.page_key,
      case lower(p.page_key)
        when 'home' then 'Student Dashboard (Home)'
        when 'resources' then 'Notes & Syllabus'
        when 'attendance' then 'Attendance Tracker & Health'
        when 'calendar' then 'Academic Calendar'
        when 'academics' then 'Academics Overview'
        when 'classes' then 'Class Schedule & Daily Log'
        when 'study' then 'Study Planner'
        when 'updates' then 'Class Announcements'
        else initcap(p.page_key)
      end as page_title,
      'authenticated_app' as page_type,
      p.view_count
    from page_counts p
  ),
  ranked_pages as (
    select
      c.page_key,
      c.page_title,
      c.page_type,
      c.view_count,
      row_number() over (order by c.view_count desc) as rank_num,
      sum(c.view_count) over () as total_views_sum
    from combined_pages c
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'rank', r.rank_num,
      'page_key', r.page_key,
      'page_title', r.page_title,
      'page_type', r.page_type,
      'view_count', r.view_count,
      'percentage', case when r.total_views_sum > 0 then round((r.view_count::numeric / r.total_views_sum) * 100, 1) else 0 end
    ) order by r.rank_num asc
  ), '[]'::jsonb)
  into v_top_pages_json
  from ranked_pages r
  limit 10;

  -- 6. Class / Section Usage Breakdown
  with section_stats as (
    select
      c.id as class_id,
      c.code as class_code,
      c.name as class_name,
      count(distinct m.user_id) filter (where m.role = 'student' and m.is_active) as total_enrolled_students,
      count(distinct a.user_id) filter (where a.created_at >= v_start_time and a.action <> 'heartbeat') as active_students,
      count(a.id) filter (where a.created_at >= v_start_time and a.action = 'page_view') as valid_pageviews
    from public.classes c
    left join public.class_memberships m on m.class_id = c.id
    left join public.user_activity a on a.user_id = m.user_id and not exists (select 1 from temp_excluded_users e where e.user_id = a.user_id)
    where c.is_active = true
    group by c.id, c.code, c.name
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'class_code', s.class_code,
      'class_name', s.class_name,
      'total_enrolled', s.total_enrolled_students,
      'active_students', s.active_students,
      'valid_pageviews', s.valid_pageviews,
      'views_per_student', case when s.active_students > 0 then round(s.valid_pageviews::numeric / s.active_students, 1) else 0 end
    ) order by s.class_code asc
  ), '[]'::jsonb)
  into v_class_usage_json
  from section_stats s;

  -- Construct final dashboard response
  select jsonb_build_object(
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
      'student_sessions', v_student_sessions_period,
      'views_per_session', v_views_per_session,
      'views_per_active_student', v_views_per_student,
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
    'revenue_potential', jsonb_build_object(
      'rpm_low', c_rpm_low,
      'rpm_ground', c_rpm_ground,
      'landing_monetizable_views_7d', v_landing_monetizable_views_7d,
      'authenticated_monetizable_views_7d', v_monetizable_pageviews_7d,
      'total_monetizable_views_7d', v_total_monetizable_7d,
      'projected_monthly_monetizable_views', v_projected_monthly_views,
      'low_estimate', v_revenue_low,
      'ground_estimate', v_revenue_ground,
      'disclaimer', 'Estimate only. Actual earnings depend on AdSense approval, ad fill, viewability, traffic quality and the real Page RPM reported by Google. Never display this estimate as guaranteed income or official AdSense eligibility.'
    ),
    'traffic_retention_trend', v_trend_json,
    'top_pages', v_top_pages_json,
    'class_usage', v_class_usage_json
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_founder_analytics_dashboard(text) from public, anon;
grant execute on function public.get_founder_analytics_dashboard(text) to authenticated;

notify pgrst, 'reload schema';

commit;

