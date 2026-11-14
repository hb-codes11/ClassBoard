-- Migration 038: Tightly Scoped Rollout of IBM Advanced AI Sections B, C, and D
-- 1. Insert Sections B, C, D with clean names
-- 2. Add lab batches C1, C2, D1, D2
-- 3. Configure shared notes & updates across IBM A, B, C, D (single source of truth)
-- 4. Separate section-specific data (attendance, timetable, membership)
-- 5. Hidden capacity of 80 approved students for B, C, D only (overflow -> verification pending)
-- 6. Strictly preserve Section A and Intel-1 behavior unchanged

begin;

-- Step 1: Add batches C1, C2, D1, D2 to session_batch enum
alter type public.session_batch add value if not exists 'C1';
alter type public.session_batch add value if not exists 'C2';
alter type public.session_batch add value if not exists 'D1';
alter type public.session_batch add value if not exists 'D2';

commit;

begin;

-- Step 2: Update check constraints on session batch
alter table public.class_sessions drop constraint if exists lecture_all_students_lab_one_batch;
alter table public.class_sessions add constraint lecture_all_students_lab_one_batch check (
  (kind = 'lecture' and batch = 'all') or (kind = 'lab' and batch in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'))
);

alter table public.attendance_class_counts drop constraint if exists attendance_count_batch_matches_kind;
alter table public.attendance_class_counts add constraint attendance_count_batch_matches_kind check (
  (kind = 'lecture' and batch = 'all') or (kind = 'lab' and batch in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'))
);

alter table public.student_attendance_progress drop constraint if exists student_attendance_batch_matches_kind;
alter table public.student_attendance_progress add constraint student_attendance_batch_matches_kind check (
  (kind = 'lecture' and batch = 'all') or (kind = 'lab' and batch in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'))
);

-- Step 3: Insert IBM Advanced AI Sections B, C, D
insert into public.classes (code, name, semester, is_active)
values
  ('IBM-2', 'Advanced AI - B', 3, true),
  ('IBM-3', 'Advanced AI - C', 3, true),
  ('IBM-4', 'Advanced AI - D', 3, true)
on conflict (code) do update
set name = excluded.name,
    semester = excluded.semester,
    is_active = true;

-- Step 4: Populate subjects for Sections B, C, D matching IBM-1
insert into public.subjects (class_id, slug, name, short_name, display_order, is_active)
select c.id, s.slug, s.name, s.short_name, s.display_order, true
from public.classes c
cross join (values
  ('software-engineering', 'Software Engineering', 'SE', 1),
  ('statistical-analysis', 'Statistical Analysis', 'SA', 2),
  ('data-structures-cpp', 'Data Structures using C++', 'DSC++', 3),
  ('java-programming', 'Object Oriented Programming using Java', 'JAVA', 4),
  ('machine-learning', 'Machine Learning', 'ML', 5),
  ('soft-skills', 'Soft Skills-I', 'SS-I', 6),
  ('mentoring', 'Mentoring-III', 'MEN', 7)
) as s(slug, name, short_name, display_order)
where c.code in ('IBM-2', 'IBM-3', 'IBM-4')
on conflict (class_id, slug) do nothing;

-- Step 5: Update membership constraints for roll numbers (allowing up to 80 for IBM B, C, D)
alter table public.class_memberships drop constraint if exists membership_roll_matches_role;
alter table public.class_memberships add constraint membership_roll_matches_role check (
  (role = 'student' and (roll_number is null or (roll_number >= 1 and roll_number <= 80)))
  or (role <> 'student' and roll_number is null)
);

create or replace function public.validate_ibm1_roll_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  target_code text;
begin
  if new.roll_number is null or new.role <> 'student' then
    return new;
  end if;

  select code into target_code from public.classes where id = new.class_id;

  if target_code = 'IBM-1' and new.roll_number > 67 then
    raise exception 'Invalid serial number for Section A';
  elsif target_code in ('INTEL-1', 'INTEL-2') and new.roll_number > 66 then
    raise exception 'Invalid serial number for this section';
  elsif target_code in ('IBM-2', 'IBM-3', 'IBM-4') and new.roll_number > 80 then
    raise exception 'Invalid serial number for this section';
  end if;

  return new;
end; $$;

drop trigger if exists class_membership_roll_limit on public.class_memberships;
create trigger class_membership_roll_limit before insert or update of roll_number, class_id on public.class_memberships
for each row execute function public.validate_ibm1_roll_limit();

-- Step 6: Single Source of Truth for IBM Notes and Updates across A, B, C, D
create or replace function public.is_ibm_class(p_class_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.classes
    where id = p_class_id and code in ('IBM-1', 'IBM-2', 'IBM-3', 'IBM-4')
  );
$$;

create or replace function public.is_active_ibm_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_memberships m
    join public.classes c on c.id = m.class_id
    where m.user_id = (select auth.uid())
      and m.is_active
      and c.code in ('IBM-1', 'IBM-2', 'IBM-3', 'IBM-4')
  );
$$;

-- Allow members of any IBM section to read published notes (resources) from the single source of truth
drop policy if exists resources_read_published_member on public.resources;
create policy resources_read_published_member on public.resources for select to authenticated
  using (
    published_at is not null
    and deleted_at is null
    and (
      public.is_active_class_member(class_id)
      or (public.is_ibm_class(class_id) and public.is_active_ibm_member())
    )
  );

-- Allow members of any IBM section to read published updates from the single source of truth
drop policy if exists updates_read_published_member on public.updates;
create policy updates_read_published_member on public.updates for select to authenticated
  using (
    published_at is not null
    and (expires_at is null or expires_at > now())
    and (
      public.is_active_class_member(class_id)
      or (public.is_ibm_class(class_id) and public.is_active_ibm_member())
    )
  );

-- Step 7: Registration & Onboarding for B, C, D with Hidden Capacity of 80
-- If section capacity reached -> is_active = false ("verification pending"), not rejection
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
  approved_count integer;
  is_pending boolean := false;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before saving your student details' using errcode = '42501';
  end if;

  select c.code into target_code from public.classes c where c.id = p_class_id and c.is_active;
  if target_code is null then
    raise exception 'The selected class is not active' using errcode = '42501';
  end if;

  -- Validation per section without leaking capacity limits
  if target_code = 'IBM-1' then
    if p_roll_number is null or p_roll_number < 1 or p_roll_number > 67 then
      raise exception 'Enter a valid serial number for this section';
    end if;
  elsif target_code in ('INTEL-1', 'INTEL-2') then
    if p_roll_number is null or p_roll_number < 1 or p_roll_number > 66 then
      raise exception 'Enter a valid serial number for this section';
    end if;
  elsif target_code in ('IBM-2', 'IBM-3', 'IBM-4') then
    if p_roll_number is null or p_roll_number < 1 or p_roll_number > 80 then
      raise exception 'Enter a valid serial number for this section';
    end if;
  end if;

  -- Determine expected lab batch based on section architecture
  expected_batch := case
    when target_code = 'INTEL-2' and p_roll_number <= 32 then 'B1'
    when target_code = 'INTEL-2' then 'B2'
    when target_code = 'IBM-2' and p_roll_number <= 40 then 'B1'
    when target_code = 'IBM-2' then 'B2'
    when target_code = 'IBM-3' and p_roll_number <= 40 then 'C1'
    when target_code = 'IBM-3' then 'C2'
    when target_code = 'IBM-4' and p_roll_number <= 40 then 'D1'
    when target_code = 'IBM-4' then 'D2'
    when p_roll_number <= 32 then 'A1'
    else 'A2'
  end;

  if p_lab_batch is distinct from expected_batch then
    raise exception 'That serial number belongs to batch %', expected_batch;
  end if;

  -- Check hidden internal capacity of 80 approved students for B, C, D
  if target_code in ('IBM-2', 'IBM-3', 'IBM-4') then
    select count(*) into approved_count
    from public.class_memberships
    where class_id = p_class_id
      and role = 'student'
      and is_active = true
      and user_id <> (select auth.uid());

    if approved_count >= 80 then
      is_pending := true;
    end if;
  end if;

  -- One section per student account rule
  update public.class_memberships
  set is_active = false
  where user_id = (select auth.uid())
    and class_id <> p_class_id
    and role = 'student';

  -- Upsert student membership for target section
  insert into public.class_memberships (user_id, class_id, role, roll_number, is_active)
  values (
    (select auth.uid()),
    p_class_id,
    'student'::public.class_role,
    p_roll_number,
    not is_pending
  )
  on conflict (user_id, class_id, role) do update
  set roll_number = p_roll_number,
      is_active = not is_pending;

  if is_pending then
    raise notice 'Your section registration is pending administrator verification.';
  end if;
exception
  when unique_violation then
    raise exception 'That serial number is already assigned in this section.' using errcode = '23505';
end;
$$;

revoke all on function public.set_own_student_setup(uuid, smallint, text) from public, anon;
grant execute on function public.set_own_student_setup(uuid, smallint, text) to authenticated;

-- Step 8: Update bootstrap_intel1_user to prevent auto-enrolling IBM B, C, D students into INTEL-1
create or replace function public.bootstrap_intel1_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_class uuid;
begin
  if exists (
    select 1 from public.ibm1_student_roster
    where email = lower(new.email)
  ) or exists (
    select 1 from public.class_memberships m
    join public.classes c on c.id = m.class_id
    where m.user_id = new.id and c.code in ('IBM-1', 'IBM-2', 'IBM-3', 'IBM-4')
  ) then
    return new;
  end if;

  select c.id into target_class
  from public.classes c
  where c.code = 'INTEL-1' and c.is_active
  limit 1;

  if target_class is not null then
    insert into public.profiles (user_id, display_name)
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1))
    )
    on conflict (user_id) do update
      set display_name = case when public.profiles.display_name = '' then excluded.display_name else public.profiles.display_name end;

    insert into public.class_member_contacts (user_id, class_id, email)
    values (new.id, target_class, lower(new.email))
    on conflict (user_id, class_id) do update set email = excluded.email;

    insert into public.class_memberships (user_id, class_id, role, roll_number)
    values (new.id, target_class, 'student', null)
    on conflict (user_id, class_id, role) do update set is_active = true;
  end if;
  return new;
end;
$$;

revoke all on function public.bootstrap_intel1_user() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
