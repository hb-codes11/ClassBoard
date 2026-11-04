-- Private study workspace. Staff can access only their own plan.
begin;

create table public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid,
  resource_id uuid references public.resources(id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  planned_date date not null,
  due_date date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id, class_id),
  foreign key (subject_id, class_id) references public.subjects(id, class_id)
);
create index study_tasks_planned on public.study_tasks(user_id, class_id, planned_date);
create index study_tasks_due on public.study_tasks(user_id, class_id, due_date) where completed_at is null;

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid,
  task_id uuid,
  source text not null check (source in ('timer', 'manual')),
  status text not null check (status in ('running', 'paused', 'completed')),
  started_at timestamptz not null default now(),
  resumed_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds between 0 and 86400),
  created_at timestamptz not null default now(),
  foreign key (subject_id, class_id) references public.subjects(id, class_id),
  foreign key (task_id, user_id, class_id) references public.study_tasks(id, user_id, class_id) on delete set null (task_id),
  check ((status = 'running' and resumed_at is not null and ended_at is null)
    or (status = 'paused' and resumed_at is null and ended_at is null)
    or (status = 'completed' and resumed_at is null and ended_at is not null and ended_at >= started_at and duration_seconds > 0)),
  check (source <> 'manual' or status = 'completed')
);
create index study_sessions_started on public.study_sessions(user_id, class_id, started_at desc);
create unique index study_sessions_one_active on public.study_sessions(user_id, class_id) where status in ('running', 'paused');

create table public.study_subject_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null,
  weekly_minutes integer not null default 0 check (weekly_minutes between 0 and 10080),
  updated_at timestamptz not null default now(),
  unique (user_id, class_id, subject_id),
  foreign key (subject_id, class_id) references public.subjects(id, class_id)
);

-- The resource FK alone cannot prevent links to another class or unpublished files.
create function public.validate_study_task_resource() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.resource_id is not null and not exists (
    select 1 from public.resources r where r.id = new.resource_id and r.class_id = new.class_id
      and r.published_at is not null and r.deleted_at is null
      and (new.subject_id is null or r.subject_id = new.subject_id)
  ) then raise exception 'Choose a published resource from this class and subject'; end if;
  return new;
end;
$$;
create function public.validate_study_session_task() returns trigger
language plpgsql set search_path = '' as $$
declare v_subject uuid;
begin
  if new.task_id is not null then
    select subject_id into v_subject from public.study_tasks
      where id = new.task_id and user_id = new.user_id and class_id = new.class_id;
    if v_subject is not null then
      if new.subject_id is not null and new.subject_id <> v_subject then
        raise exception 'Choose a task from the selected subject';
      end if;
      new.subject_id := v_subject;
    end if;
  end if;
  return new;
end;
$$;
create trigger study_sessions_task before insert or update of task_id, subject_id on public.study_sessions
  for each row execute function public.validate_study_session_task();
create trigger study_tasks_resource before insert or update of resource_id, subject_id, class_id on public.study_tasks
  for each row execute function public.validate_study_task_resource();
create trigger study_tasks_updated before update on public.study_tasks for each row execute function public.set_updated_at();
create trigger study_goals_updated before update on public.study_subject_goals for each row execute function public.set_updated_at();

alter table public.study_tasks enable row level security;
alter table public.study_sessions enable row level security;
alter table public.study_subject_goals enable row level security;
create policy study_tasks_owner on public.study_tasks for all to authenticated
  using (user_id = (select auth.uid()) and public.is_active_class_member(class_id))
  with check (user_id = (select auth.uid()) and public.is_active_class_member(class_id));
create policy study_goals_owner on public.study_subject_goals for all to authenticated
  using (user_id = (select auth.uid()) and public.is_active_class_member(class_id))
  with check (user_id = (select auth.uid()) and public.is_active_class_member(class_id));
create policy study_sessions_read on public.study_sessions for select to authenticated
  using (user_id = (select auth.uid()) and public.is_active_class_member(class_id));
create policy study_sessions_insert_manual on public.study_sessions for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_class_member(class_id)
    and source = 'manual' and status = 'completed' and ended_at <= now()
    and duration_seconds <= extract(epoch from ended_at - started_at));
create policy study_sessions_update_completed on public.study_sessions for update to authenticated
  using (user_id = (select auth.uid()) and public.is_active_class_member(class_id) and status = 'completed')
  with check (user_id = (select auth.uid()) and public.is_active_class_member(class_id) and status = 'completed');
create policy study_sessions_delete on public.study_sessions for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_active_class_member(class_id));
revoke all on public.study_tasks, public.study_sessions, public.study_subject_goals from anon, authenticated;
grant select, insert, update, delete on public.study_tasks, public.study_subject_goals to authenticated;
grant select, insert, delete on public.study_sessions to authenticated;
-- Historical session associations are editable; the timer clock is server managed.
grant update (subject_id, task_id) on public.study_sessions to authenticated;

-- Atomically manage the clock, including simultaneous tabs/devices. No notifications.
create function public.study_timer(p_class_id uuid, p_action text, p_session_id uuid default null,
  p_subject_id uuid default null, p_task_id uuid default null)
returns public.study_sessions language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_session public.study_sessions;
  v_now timestamptz := clock_timestamp();
begin
  if v_user is null or not public.is_active_class_member(p_class_id) then
    raise exception 'Active class membership required' using errcode = '42501';
  end if;
  if p_action not in ('start', 'pause', 'resume', 'finish', 'discard') or p_action is null then
    raise exception 'Invalid timer action';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || p_class_id::text, 0));
  v_now := clock_timestamp();
  select * into v_session from public.study_sessions
    where user_id = v_user and class_id = p_class_id and status in ('running', 'paused') for update;
  if p_action = 'start' then
    if v_session.id is not null then return v_session; end if;
    insert into public.study_sessions(user_id, class_id, subject_id, task_id, source, status, started_at, resumed_at)
      values (v_user, p_class_id, p_subject_id, p_task_id, 'timer', 'running', v_now, v_now) returning * into v_session;
    return v_session;
  end if;
  if v_session.id is null or v_session.id is distinct from p_session_id then
    raise exception 'Timer changed in another tab. Refresh Study Plan.';
  end if;
  if p_action = 'discard' then
    delete from public.study_sessions where id = v_session.id;
    return null;
  end if;
  if p_action in ('pause', 'finish') and v_session.status = 'running' then
    v_session.duration_seconds := least(86400, v_session.duration_seconds + greatest(0, floor(extract(epoch from v_now - v_session.resumed_at)))::integer);
  end if;
  if p_action = 'finish' and v_session.duration_seconds < 1 then raise exception 'Study for at least one second before finishing'; end if;
  update public.study_sessions set
    duration_seconds = v_session.duration_seconds,
    status = case when p_action = 'finish' then 'completed' when p_action = 'pause' then 'paused' else 'running' end,
    resumed_at = case when p_action = 'resume' then coalesce(v_session.resumed_at, v_now) else null end,
    ended_at = case when p_action = 'finish' then v_now else null end
    where id = v_session.id returning * into v_session;
  return v_session;
end;
$$;
revoke all on function public.study_timer(uuid, text, uuid, uuid, uuid) from public, anon;
grant execute on function public.study_timer(uuid, text, uuid, uuid, uuid) to authenticated;
revoke all on function public.validate_study_task_resource(), public.validate_study_session_task() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
