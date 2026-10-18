-- Shared classes-held totals are managed by CRs/admins; students save only
-- their own attended-class count for each subject and lab batch.
begin;

create table public.attendance_class_counts (
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null,
  kind public.session_kind not null,
  batch public.session_batch not null,
  classes_held integer not null default 0 check (classes_held between 0 and 1000),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (class_id, subject_id, kind, batch),
  foreign key (subject_id, class_id) references public.subjects(id, class_id) on delete cascade,
  constraint attendance_count_batch_matches_kind check (
    (kind = 'lecture' and batch = 'all') or (kind = 'lab' and batch in ('A1', 'A2'))
  )
);

create table public.student_attendance_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid not null,
  kind public.session_kind not null,
  batch public.session_batch not null,
  attended_classes integer not null default 0 check (attended_classes between 0 and 1000),
  updated_at timestamptz not null default now(),
  primary key (user_id, class_id, subject_id, kind, batch),
  foreign key (subject_id, class_id) references public.subjects(id, class_id) on delete cascade,
  constraint student_attendance_batch_matches_kind check (
    (kind = 'lecture' and batch = 'all') or (kind = 'lab' and batch in ('A1', 'A2'))
  )
);

alter table public.attendance_class_counts enable row level security;
alter table public.student_attendance_progress enable row level security;

create policy attendance_counts_read_member on public.attendance_class_counts for select to authenticated
  using (public.is_active_class_member(class_id));
create policy attendance_counts_staff_insert on public.attendance_class_counts for insert to authenticated
  with check (
    (public.has_class_role(class_id, 'cr') or public.has_class_role(class_id, 'admin'))
    and updated_by = (select auth.uid())
  );
create policy attendance_counts_staff_update on public.attendance_class_counts for update to authenticated
  using (public.has_class_role(class_id, 'cr') or public.has_class_role(class_id, 'admin'))
  with check (
    (public.has_class_role(class_id, 'cr') or public.has_class_role(class_id, 'admin'))
    and updated_by = (select auth.uid())
  );

create policy student_attendance_progress_read_own on public.student_attendance_progress for select to authenticated
  using (user_id = (select auth.uid()) and public.has_class_role(class_id, 'student'));
create policy student_attendance_progress_insert_own on public.student_attendance_progress for insert to authenticated
  with check (user_id = (select auth.uid()) and public.has_class_role(class_id, 'student'));
create policy student_attendance_progress_update_own on public.student_attendance_progress for update to authenticated
  using (user_id = (select auth.uid()) and public.has_class_role(class_id, 'student'))
  with check (user_id = (select auth.uid()) and public.has_class_role(class_id, 'student'));

create or replace function public.guard_attendance_class_count()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  highest_attended integer;
begin
  select coalesce(max(p.attended_classes), 0) into highest_attended
  from public.student_attendance_progress p
  where p.class_id = new.class_id and p.subject_id = new.subject_id
    and p.kind = new.kind and p.batch = new.batch;
  if new.classes_held < highest_attended then
    raise exception 'Classes held cannot be lower than a student's saved attended count';
  end if;
  return new;
end;
$$;

create or replace function public.guard_student_attendance_progress()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  shared_classes_held integer;
begin
  select c.classes_held into shared_classes_held
  from public.attendance_class_counts c
  where c.class_id = new.class_id and c.subject_id = new.subject_id
    and c.kind = new.kind and c.batch = new.batch;
  if new.attended_classes > coalesce(shared_classes_held, 0) then
    raise exception 'Attended classes cannot exceed the shared classes-held total';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_attendance_class_count() from public;
revoke all on function public.guard_student_attendance_progress() from public;

create trigger attendance_class_counts_set_updated_at before update on public.attendance_class_counts
  for each row execute function public.set_updated_at();
create trigger student_attendance_progress_set_updated_at before update on public.student_attendance_progress
  for each row execute function public.set_updated_at();
create trigger attendance_class_counts_guard before insert or update on public.attendance_class_counts
  for each row execute function public.guard_attendance_class_count();
create trigger student_attendance_progress_guard before insert or update on public.student_attendance_progress
  for each row execute function public.guard_student_attendance_progress();

revoke all on public.attendance_class_counts, public.student_attendance_progress from anon, authenticated;
grant select on public.attendance_class_counts, public.student_attendance_progress to authenticated;
grant insert (class_id, subject_id, kind, batch, classes_held, updated_by)
  on public.attendance_class_counts to authenticated;
grant update (classes_held, updated_by) on public.attendance_class_counts to authenticated;
grant insert (user_id, class_id, subject_id, kind, batch, attended_classes)
  on public.student_attendance_progress to authenticated;
grant update (attended_classes) on public.student_attendance_progress to authenticated;

commit;
