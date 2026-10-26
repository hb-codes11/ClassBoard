-- Add a second, independently scoped ClassBoard class. Each table continues to
-- use its own class_id, so resources, updates, attendance, and schedules stay
-- separate between INTEL-1 and INTEL-2.

begin;

alter type public.session_batch add value if not exists 'B1';
alter type public.session_batch add value if not exists 'B2';

commit;
begin;

alter table public.class_sessions drop constraint if exists lecture_all_students_lab_one_batch;
alter table public.class_sessions add constraint lecture_all_students_lab_one_batch check (
  (kind = 'lecture' and batch = 'all') or (kind = 'lab' and batch in ('A1', 'A2', 'B1', 'B2'))
);
alter table public.attendance_class_counts drop constraint if exists attendance_count_batch_matches_kind;
alter table public.attendance_class_counts add constraint attendance_count_batch_matches_kind check (
  (kind = 'lecture' and batch = 'all') or (kind = 'lab' and batch in ('A1', 'A2', 'B1', 'B2'))
);
alter table public.student_attendance_progress drop constraint if exists student_attendance_batch_matches_kind;
alter table public.student_attendance_progress add constraint student_attendance_batch_matches_kind check (
  (kind = 'lecture' and batch = 'all') or (kind = 'lab' and batch in ('A1', 'A2', 'B1', 'B2'))
);

insert into public.classes (code, name, semester)
values ('INTEL-2', 'AI & Analytics - B', 3)
on conflict (code) do update
set name = excluded.name,
    semester = excluded.semester,
    is_active = true;

insert into public.subjects (class_id, slug, name, short_name, display_order, is_active)
select intel2.id, source.slug, source.name, source.short_name, source.display_order, source.is_active
from public.classes intel1
join public.subjects source on source.class_id = intel1.id
join public.classes intel2 on intel2.code = 'INTEL-2'
where intel1.code = 'INTEL-1'
on conflict (class_id, slug) do nothing;

create or replace function public.grant_class_student_by_email(
  p_class_id uuid,
  p_email text,
  p_roll_number smallint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user uuid;
  target_email text;
  target_name text;
begin
  if (select auth.uid()) is null or not public.has_class_role(p_class_id, 'admin') then
    raise exception 'Only an active admin of this class can grant section access' using errcode = '42501';
  end if;

  target_email := lower(trim(coalesce(p_email, '')));
  if target_email !~ '^[^@[:space:]]+@medicaps[.]ac[.]in$' then
    raise exception 'Enter a college email ending in @medicaps.ac.in';
  end if;
  if p_roll_number is not null and p_roll_number not between 1 and 66 then
    raise exception 'Student roll number must be between 1 and 66';
  end if;

  select u.id,
         coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), split_part(target_email, '@', 1))
    into target_user, target_name
  from auth.users u
  where lower(u.email) = target_email
  limit 1;
  if target_user is null then
    raise exception 'No ClassBoard account exists for this email yet. Ask the student to create an account, then grant access.';
  end if;

  if p_roll_number is not null and exists (
    select 1 from public.class_memberships m
    where m.class_id = p_class_id and m.role = 'student' and m.roll_number = p_roll_number
      and m.is_active and m.user_id <> target_user
  ) then
    raise exception 'That roll number is already assigned in this section';
  end if;

  insert into public.profiles (user_id, display_name)
  values (target_user, target_name)
  on conflict (user_id) do nothing;

  insert into public.class_member_contacts (user_id, class_id, email)
  values (target_user, p_class_id, target_email)
  on conflict (user_id, class_id) do update set email = excluded.email;

  insert into public.class_memberships (user_id, class_id, role, roll_number, is_active)
  values (target_user, p_class_id, 'student', p_roll_number, true)
  on conflict (user_id, class_id, role) do update
    set is_active = true,
        roll_number = coalesce(excluded.roll_number, public.class_memberships.roll_number);

  insert into public.audit_events (actor_id, class_id, action, target_type, target_id, metadata)
  values ((select auth.uid()), p_class_id, 'class_student_access_granted', 'user', target_user::text,
          jsonb_build_object('email', target_email, 'roll_number', p_roll_number));

  return target_user;
exception
  when unique_violation then
    raise exception 'That roll number is already assigned in this section' using errcode = '23505';
end;
$$;

revoke all on function public.grant_class_student_by_email(uuid, text, smallint) from public, anon;
grant execute on function public.grant_class_student_by_email(uuid, text, smallint) to authenticated;

create or replace function public.set_own_student_setup(
  p_class_id uuid,
  p_roll_number smallint,
  p_lab_batch text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_batch text;
  target_code text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before saving your student details' using errcode = '42501';
  end if;
  if p_roll_number is null or p_roll_number not between 1 and 66 then
    raise exception 'Enter a serial roll number from 1 to 66';
  end if;

  select c.code into target_code from public.classes c where c.id = p_class_id and c.is_active;
  if target_code is null then
    raise exception 'The selected class is not active' using errcode = '42501';
  end if;
  expected_batch := case
    when target_code = 'INTEL-2' and p_roll_number <= 32 then 'B1'
    when target_code = 'INTEL-2' then 'B2'
    when p_roll_number <= 32 then 'A1'
    else 'A2'
  end;
  if p_lab_batch is distinct from expected_batch then
    raise exception 'That roll number belongs to batch %', expected_batch;
  end if;

  update public.class_memberships
  set roll_number = p_roll_number
  where user_id = (select auth.uid())
    and class_id = p_class_id
    and role = 'student'
    and is_active;
  if not found then
    raise exception 'No active student membership was found for this class' using errcode = '42501';
  end if;
exception
  when unique_violation then
    raise exception 'That serial roll number is already assigned. Check the number with your class representative.' using errcode = '23505';
end;
$$;

revoke all on function public.set_own_student_setup(uuid, smallint, text) from public, anon;
grant execute on function public.set_own_student_setup(uuid, smallint, text) to authenticated;

commit;
