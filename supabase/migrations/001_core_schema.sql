-- Classboard MVP: one Intel 1 class, Supabase Auth + Postgres RLS + private Storage.
-- Apply once to a new Supabase project using the SQL editor or Supabase CLI.
-- Admin and CR are independent class roles: one person can hold both rows.

begin;

create type public.class_role as enum ('student', 'cr', 'admin');
create type public.session_kind as enum ('lecture', 'lab');
create type public.session_batch as enum ('all', 'A1', 'A2');
create type public.session_state as enum ('scheduled', 'held', 'no_class', 'cancelled');
create type public.resource_kind as enum ('notes', 'syllabus', 'lab_manual', 'calendar');
create type public.attendance_issue_state as enum ('new', 'reviewing', 'referred', 'resolved');

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  semester smallint,
  timezone text not null default 'Asia/Kolkata',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) <= 100)
);

-- One row per role lets a user be Admin + CR in the same class.
create table public.class_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  role public.class_role not null,
  roll_number smallint,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, class_id, role),
  constraint membership_roll_matches_role check (
    (role = 'student' and roll_number between 1 and 66)
    or (role <> 'student' and roll_number is null)
  )
);
create unique index class_memberships_unique_student_roll
  on public.class_memberships(class_id, roll_number)
  where role = 'student' and is_active;
create index class_memberships_active_user on public.class_memberships(user_id, class_id) where is_active;

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  slug text not null,
  name text not null,
  short_name text,
  display_order smallint not null default 0,
  is_active boolean not null default true,
  unique (class_id, slug),
  unique (id, class_id)
);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null,
  class_number integer,
  kind public.session_kind not null,
  batch public.session_batch not null,
  state public.session_state not null default 'scheduled',
  starts_at timestamptz not null,
  ends_at timestamptz,
  room text,
  topic text,
  created_by uuid not null references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, class_id) references public.subjects(id, class_id),
  unique (id, class_id),
  constraint class_session_end_after_start check (ends_at is null or ends_at > starts_at),
  constraint lecture_all_students_lab_one_batch check (
    (kind = 'lecture' and batch = 'all') or (kind = 'lab' and batch in ('A1', 'A2'))
  ),
  constraint class_session_number_positive check (class_number is null or class_number > 0)
);
create unique index class_sessions_unique_number_per_batch
  on public.class_sessions(class_id, subject_id, class_number, batch)
  where class_number is not null;
create index class_sessions_schedule on public.class_sessions(class_id, starts_at);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid,
  title text not null,
  kind public.resource_kind not null,
  unit_label text,
  storage_path text unique,
  uploaded_by uuid not null references auth.users(id),
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, class_id) references public.subjects(id, class_id),
  constraint resource_title_length check (char_length(title) between 1 and 180),
  constraint resource_storage_path_shape check (
    storage_path is null or storage_path like class_id::text || '/' || id::text || '/%'
  )
);
create index resources_published on public.resources(class_id, published_at desc) where deleted_at is null;

create table public.updates (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'general',
  importance text not null default 'normal' check (importance in ('normal', 'important')),
  created_by uuid not null references auth.users(id),
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint update_title_length check (char_length(title) between 1 and 180),
  constraint update_expiry_after_publish check (expires_at is null or published_at is null or expires_at > published_at)
);
create index updates_published on public.updates(class_id, published_at desc) where published_at is not null;

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid,
  session_id uuid,
  title text not null,
  body text,
  due_at timestamptz not null,
  created_by uuid not null references auth.users(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, class_id) references public.subjects(id, class_id),
  foreign key (session_id, class_id) references public.class_sessions(id, class_id) on delete set null (session_id)
);
create index reminders_due on public.reminders(class_id, due_at) where is_active;

create table public.attendance_issues (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references auth.users(id),
  session_id uuid,
  message text not null,
  state public.attendance_issue_state not null default 'new',
  assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key (session_id, class_id) references public.class_sessions(id, class_id) on delete set null (session_id),
  constraint attendance_issue_message_length check (char_length(message) between 1 and 3000)
);
create index attendance_issues_inbox on public.attendance_issues(class_id, state, created_at desc);
create index attendance_issues_owner on public.attendance_issues(student_id, created_at desc);

create table public.attendance_issue_replies (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.attendance_issues(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now(),
  constraint attendance_issue_reply_length check (char_length(body) between 1 and 3000)
);
create index attendance_issue_replies_issue on public.attendance_issue_replies(issue_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('update', 'reminder', 'resource', 'class_session')),
  source_id uuid not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_recipient on public.notifications(recipient_id, created_at desc);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_class_time on public.audit_events(class_id, created_at desc);

-- Seed only the class and six subject names already present in the supplied UI.
insert into public.classes (code, name, semester)
values ('INTEL-1', 'AI & Analytics - A', 3)
on conflict (code) do nothing;

insert into public.subjects (class_id, slug, name, short_name, display_order)
select c.id, s.slug, s.name, s.short_name, s.display_order
from public.classes c
cross join (values
  ('software-engineering', 'Software Engineering', 'SE', 1),
  ('statistical-analysis', 'Statistical Analysis', 'SA', 2),
  ('computer-organisation-microprocessors', 'Computer Organisation & Microprocessors', 'COM', 3),
  ('java-programming', 'Java Programming', 'Java', 4),
  ('soft-skills', 'Soft Skills', 'SS', 5),
  ('artificial-intelligence', 'Artificial Intelligence', 'AI', 6)
) as s(slug, name, short_name, display_order)
where c.code = 'INTEL-1'
on conflict (class_id, slug) do nothing;

-- SECURITY DEFINER membership helpers avoid RLS recursion on class_memberships.
create or replace function public.has_class_role(target_class uuid, wanted_role public.class_role)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.class_memberships m
    join public.classes c on c.id = m.class_id and c.is_active
    where m.class_id = target_class and m.user_id = (select auth.uid())
      and m.role = wanted_role and m.is_active
  );
$$;

create or replace function public.is_active_class_member(target_class uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.class_memberships m
    join public.classes c on c.id = m.class_id and c.is_active
    where m.class_id = target_class and m.user_id = (select auth.uid()) and m.is_active
  );
$$;

create or replace function public.can_access_attendance_issue(target_issue uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.attendance_issues i
    where i.id = target_issue
      and ((i.student_id = (select auth.uid())
            and public.has_class_role(i.class_id, 'student'::public.class_role))
        or (public.has_class_role(i.class_id, 'cr'::public.class_role)
          and (i.assigned_to is null or i.assigned_to = (select auth.uid())))
        or public.has_class_role(i.class_id, 'admin'::public.class_role))
  );
$$;

create or replace function public.can_manage_attendance_issue(target_issue uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.attendance_issues i
    where i.id = target_issue
      and (public.has_class_role(i.class_id, 'admin'::public.class_role)
        or (public.has_class_role(i.class_id, 'cr'::public.class_role)
          and (i.assigned_to is null or i.assigned_to = (select auth.uid()))))
  );
$$;

create or replace function public.can_read_resource_object(object_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.resources r
    where r.storage_path = object_name and r.published_at is not null and r.deleted_at is null
      and public.is_active_class_member(r.class_id)
  );
$$;

revoke all on function public.has_class_role(uuid, public.class_role) from public;
revoke all on function public.is_active_class_member(uuid) from public;
revoke all on function public.can_access_attendance_issue(uuid) from public;
revoke all on function public.can_manage_attendance_issue(uuid) from public;
revoke all on function public.can_read_resource_object(text) from public;
grant execute on function public.has_class_role(uuid, public.class_role) to authenticated;
grant execute on function public.is_active_class_member(uuid) to authenticated;
grant execute on function public.can_access_attendance_issue(uuid) to authenticated;
grant execute on function public.can_manage_attendance_issue(uuid) to authenticated;
grant execute on function public.can_read_resource_object(text) to authenticated;

-- Keep updated_at consistent without trusting client timestamps.
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger sessions_set_updated_at before update on public.class_sessions for each row execute function public.set_updated_at();
create trigger resources_set_updated_at before update on public.resources for each row execute function public.set_updated_at();
create trigger updates_set_updated_at before update on public.updates for each row execute function public.set_updated_at();
create trigger reminders_set_updated_at before update on public.reminders for each row execute function public.set_updated_at();
create trigger issues_set_updated_at before update on public.attendance_issues for each row execute function public.set_updated_at();


-- Issue ownership, class and reported session cannot be rewritten after submission.
create or replace function public.guard_attendance_issue_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.class_id <> old.class_id or new.student_id <> old.student_id
     or new.session_id is distinct from old.session_id or new.message <> old.message
     or new.created_at <> old.created_at then
    raise exception 'attendance issue identity and report are immutable';
  end if;
  if new.assigned_to is not null and not exists (
    select 1 from public.class_memberships m
    where m.user_id = new.assigned_to and m.class_id = new.class_id
      and m.is_active and m.role in ('cr'::public.class_role, 'admin'::public.class_role)
  ) then
    raise exception 'assignee must be an active CR or Admin in this class';
  end if;
  return new;
end;
$$;
create trigger attendance_issue_guard before update on public.attendance_issues
  for each row execute function public.guard_attendance_issue_update();

create or replace function public.validate_attendance_issue_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_to is not null and not exists (
    select 1 from public.class_memberships m
    where m.user_id = new.assigned_to and m.class_id = new.class_id
      and m.is_active and m.role in ('cr'::public.class_role, 'admin'::public.class_role)
  ) then
    raise exception 'assignee must be an active CR or Admin in this class';
  end if;
  return new;
end;
$$;
create trigger attendance_issue_assignment_guard before insert on public.attendance_issues
  for each row execute function public.validate_attendance_issue_insert();

alter table public.classes enable row level security;
alter table public.profiles enable row level security;
alter table public.class_memberships enable row level security;
alter table public.subjects enable row level security;
alter table public.class_sessions enable row level security;
alter table public.resources enable row level security;
alter table public.updates enable row level security;
alter table public.reminders enable row level security;
alter table public.attendance_issues enable row level security;
alter table public.attendance_issue_replies enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;

-- Profiles: users edit only their own display name; class peers can read names only.
create or replace function public.shares_active_class(other_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_memberships mine
    join public.class_memberships theirs on theirs.class_id = mine.class_id
    join public.classes c on c.id = mine.class_id and c.is_active
    where mine.user_id = (select auth.uid()) and mine.is_active
      and theirs.user_id = other_user and theirs.is_active
  );
$$;
revoke all on function public.shares_active_class(uuid) from public;
grant execute on function public.shares_active_class(uuid) to authenticated;
create policy profiles_read_self_or_classmate on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.shares_active_class(user_id));
create policy profiles_insert_self on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy classes_read_member on public.classes for select to authenticated
  using (is_active and public.is_active_class_member(id));
create policy memberships_read_self on public.class_memberships for select to authenticated
  using (user_id = (select auth.uid()));

create policy subjects_read_member on public.subjects for select to authenticated
  using (is_active and public.is_active_class_member(class_id));

create policy sessions_read_member on public.class_sessions for select to authenticated
  using (public.is_active_class_member(class_id));
create policy sessions_cr_insert on public.class_sessions for insert to authenticated
  with check (public.has_class_role(class_id, 'cr') and created_by = (select auth.uid()));
create policy sessions_cr_update on public.class_sessions for update to authenticated
  using (public.has_class_role(class_id, 'cr'))
  with check (public.has_class_role(class_id, 'cr') and updated_by = (select auth.uid()));
create policy sessions_cr_delete on public.class_sessions for delete to authenticated
  using (public.has_class_role(class_id, 'cr'));

create policy resources_read_published_member on public.resources for select to authenticated
  using (published_at is not null and deleted_at is null and public.is_active_class_member(class_id));
create policy resources_cr_insert on public.resources for insert to authenticated
  with check (public.has_class_role(class_id, 'cr') and uploaded_by = (select auth.uid()));
create policy resources_cr_update on public.resources for update to authenticated
  using (public.has_class_role(class_id, 'cr'))
  with check (public.has_class_role(class_id, 'cr') and uploaded_by = (select auth.uid()));
create policy resources_cr_delete on public.resources for delete to authenticated
  using (public.has_class_role(class_id, 'cr'));

create policy updates_read_published_member on public.updates for select to authenticated
  using (published_at is not null and (expires_at is null or expires_at > now()) and public.is_active_class_member(class_id));
create policy updates_cr_insert on public.updates for insert to authenticated
  with check (public.has_class_role(class_id, 'cr') and created_by = (select auth.uid()));
create policy updates_cr_update on public.updates for update to authenticated
  using (public.has_class_role(class_id, 'cr'))
  with check (public.has_class_role(class_id, 'cr') and created_by = (select auth.uid()));
create policy updates_cr_delete on public.updates for delete to authenticated
  using (public.has_class_role(class_id, 'cr'));

create policy reminders_read_member on public.reminders for select to authenticated
  using (is_active and public.is_active_class_member(class_id));
create policy reminders_cr_insert on public.reminders for insert to authenticated
  with check (public.has_class_role(class_id, 'cr') and created_by = (select auth.uid()));
create policy reminders_cr_update on public.reminders for update to authenticated
  using (public.has_class_role(class_id, 'cr'))
  with check (public.has_class_role(class_id, 'cr') and created_by = (select auth.uid()));
create policy reminders_cr_delete on public.reminders for delete to authenticated
  using (public.has_class_role(class_id, 'cr'));

create policy issues_read_owner_or_staff on public.attendance_issues for select to authenticated
  using ((student_id = (select auth.uid()) and public.has_class_role(class_id, 'student'))
    or public.can_manage_attendance_issue(id));
create policy issues_student_create_own on public.attendance_issues for insert to authenticated
  with check (student_id = (select auth.uid()) and public.has_class_role(class_id, 'student')
    and state = 'new' and assigned_to is null and resolved_at is null);
create policy issues_staff_update on public.attendance_issues for update to authenticated
  using (public.can_manage_attendance_issue(id))
  with check (public.can_manage_attendance_issue(id));

create policy issue_replies_read_thread_participants on public.attendance_issue_replies for select to authenticated
  using (public.can_access_attendance_issue(issue_id));
create policy issue_replies_insert_thread_participants on public.attendance_issue_replies for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_access_attendance_issue(issue_id));

create policy notifications_read_own on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()) and public.is_active_class_member(class_id));
create policy notifications_mark_own_read on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create policy audit_events_admin_read on public.audit_events for select to authenticated
  using (class_id is not null and public.has_class_role(class_id, 'admin'));
-- No client insert/update/delete policy for audit_events. Trusted Edge Functions use service role.

-- SQL privileges are the outer gate; RLS above decides which rows/actions are allowed.
revoke all on public.classes, public.profiles, public.class_memberships, public.subjects,
  public.class_sessions, public.resources, public.updates, public.reminders,
  public.attendance_issues, public.attendance_issue_replies, public.notifications,
  public.audit_events from anon;
grant usage on schema public to authenticated;
grant select on public.classes, public.class_memberships, public.subjects to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.class_sessions, public.resources,
  public.updates, public.reminders to authenticated;
grant select, insert, update on public.attendance_issues to authenticated;
grant select, insert on public.attendance_issue_replies to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.audit_events to authenticated;

-- Private resource bucket. Object path format: <class-uuid>/<resource-uuid>/<filename>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('class-resources', 'class-resources', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

create policy class_resource_download_published on storage.objects for select to authenticated
  using (bucket_id = 'class-resources' and public.can_read_resource_object(name));
create policy class_resource_upload_cr on storage.objects for insert to authenticated
  with check (
    bucket_id = 'class-resources'
    and public.has_class_role((storage.foldername(name))[1]::uuid, 'cr')
    and (storage.foldername(name))[2] is not null
  );
create policy class_resource_update_cr on storage.objects for update to authenticated
  using (bucket_id = 'class-resources' and public.has_class_role((storage.foldername(name))[1]::uuid, 'cr'))
  with check (bucket_id = 'class-resources' and public.has_class_role((storage.foldername(name))[1]::uuid, 'cr'));
create policy class_resource_delete_cr on storage.objects for delete to authenticated
  using (bucket_id = 'class-resources' and public.has_class_role((storage.foldername(name))[1]::uuid, 'cr'));

commit;
