-- Migration 046: Lock INTEL-1 Roster and Enforce Strict Whitelist
-- Adds INTEL-1 student roster (including the 16 newly provided enrollments)
-- Ensures INTEL-1 students can ONLY enter INTEL-1, and prevents unauthorized users from enrolling in INTEL-1.

begin;

-- 1. Create INTEL-1 student roster table
create table if not exists public.intel1_student_roster (
  enrollment_no text not null unique,
  email text not null unique
);

alter table public.intel1_student_roster enable row level security;
revoke all on public.intel1_student_roster from public, anon, authenticated;

-- 2. Populate INTEL-1 student roster with the 16 verified students
insert into public.intel1_student_roster (enrollment_no, email)
values
  ('EN25CS3070056', 'en25cs3070056@medicaps.ac.in'),
  ('EN25CS3070054', 'en25cs3070054@medicaps.ac.in'),
  ('EN25CS3070079', 'en25cs3070079@medicaps.ac.in'),
  ('EN25CS3070030', 'en25cs3070030@medicaps.ac.in'),
  ('EN25CS3070073', 'en25cs3070073@medicaps.ac.in'),
  ('EN25CS3070069', 'en25cs3070069@medicaps.ac.in'),
  ('EN25CS3070005', 'en25cs3070005@medicaps.ac.in'),
  ('EN25CS3070038', 'en25cs3070038@medicaps.ac.in'),
  ('EN25CS3070126', 'en25cs3070126@medicaps.ac.in'),
  ('EN25CS3070004', 'en25cs3070004@medicaps.ac.in'),
  ('EN25CS3070080', 'en25cs3070080@medicaps.ac.in'),
  ('EN25CS3070062', 'en25cs3070062@medicaps.ac.in'),
  ('EN25CS3070036', 'en25cs3070036@medicaps.ac.in'),
  ('EN25CS3070109', 'en25cs3070109@medicaps.ac.in'),
  ('EN25CS3070132', 'en25cs3070132@medicaps.ac.in'),
  ('EN25CS3070136', 'en25cs3070136@medicaps.ac.in')
on conflict (email) do update
set enrollment_no = excluded.enrollment_no;

-- Also seed existing active INTEL-1 students from current membership contacts
insert into public.intel1_student_roster (enrollment_no, email)
select
  upper(split_part(c.email, '@', 1)),
  lower(c.email)
from public.class_member_contacts c
join public.classes cls on cls.id = c.class_id
join public.class_memberships m on m.user_id = c.user_id and m.class_id = c.class_id
where cls.code = 'INTEL-1'
  and m.role = 'student'
  and m.is_active = true
  and not exists (select 1 from public.intel2_student_roster r2 where r2.email = lower(c.email))
  and not exists (select 1 from public.ibm1_student_roster r_ibm where r_ibm.email = lower(c.email))
on conflict (email) do nothing;

-- 3. Update verify_student_section_choice function with INTEL-1 roster
create or replace function public.verify_student_section_choice(
  p_email_or_enrollment text,
  p_selected_section_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  raw_input text := lower(trim(coalesce(p_email_or_enrollment, '')));
  norm_email text;
  norm_enroll text;
  norm_code text := upper(trim(coalesce(p_selected_section_code, '')));
  actual_code text := null;
  actual_name text := null;
  roster_name text := null;
begin
  if raw_input = '' then
    return jsonb_build_object('allowed', true);
  end if;

  if position('@' in raw_input) > 0 then
    norm_email := raw_input;
    norm_enroll := upper(split_part(raw_input, '@', 1));
  else
    norm_email := raw_input || '@medicaps.ac.in';
    norm_enroll := upper(raw_input);
  end if;

  -- 1. Exclude founders (founders have universal access to all sections)
  if exists (
    select 1 from public.classboard_founders f
    join auth.users u on u.id = f.user_id
    where lower(u.email) = norm_email
  ) or norm_email in ('en25cs3070059@medicaps.ac.in', 'hasnaatmalik29@gmail.com') then
    return jsonb_build_object('allowed', true, 'is_founder', true);
  end if;

  -- 2. Check INTEL-1 roster
  if exists (
    select 1 from public.intel1_student_roster
    where email = norm_email or upper(enrollment_no) = norm_enroll
  ) then
    actual_code := 'INTEL-1';
    actual_name := 'AI & Analytics - A (Intel-1)';

  -- 3. Check INTEL-2 roster
  elsif exists (
    select 1 from public.intel2_student_roster
    where email = norm_email or upper(enrollment_no) = norm_enroll
  ) then
    select 'INTEL-2', 'AI & Analytics - B (Intel-2)', student_name
    into actual_code, actual_name, roster_name
    from public.intel2_student_roster
    where email = norm_email or upper(enrollment_no) = norm_enroll
    limit 1;

  -- 4. Check IBM-1 roster
  elsif exists (
    select 1 from public.ibm1_student_roster
    where email = norm_email or upper(enrollment_no) = norm_enroll
  ) then
    select 'IBM-1', 'IBM Advanced AI - A', student_name
    into actual_code, actual_name, roster_name
    from public.ibm1_student_roster
    where email = norm_email or upper(enrollment_no) = norm_enroll
    limit 1;

  -- 5. Check active membership in other sections (if user already has assigned section)
  else
    select c.code, c.name into actual_code, actual_name
    from public.class_memberships m
    join public.classes c on c.id = m.class_id
    join auth.users u on u.id = m.user_id
    where lower(u.email) = norm_email and m.role = 'student' and m.is_active = true
    order by m.created_at desc limit 1;
  end if;

  -- If student belongs to a specific section
  if actual_code is not null then
    if norm_code <> '' and norm_code <> actual_code then
      return jsonb_build_object(
        'allowed', false,
        'assigned_section_code', actual_code,
        'assigned_section_name', actual_name,
        'student_name', roster_name,
        'message', 'You have selected the wrong section. According to official records, your account belongs to ' || actual_name || '. Please select ' || actual_name || ' in the section dropdown to continue.'
      );
    end if;

    return jsonb_build_object(
      'allowed', true,
      'assigned_section_code', actual_code,
      'assigned_section_name', actual_name
    );
  end if;

  -- If user tries to select INTEL-1 but is not on the INTEL-1 roster
  if norm_code = 'INTEL-1' then
    return jsonb_build_object(
      'allowed', false,
      'assigned_section_code', null,
      'message', 'You have selected the wrong section. This account is not registered in AI & Analytics - A (Intel-1). Please select your assigned section in the dropdown to continue.'
    );
  end if;

  return jsonb_build_object('allowed', true);
end;
$$;

revoke all on function public.verify_student_section_choice(text, text) from public;
grant execute on function public.verify_student_section_choice(text, text) to anon, authenticated;

-- 4. Update bootstrap_intel1_user to only allow confirmed INTEL-1 students
create or replace function public.bootstrap_intel1_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_class uuid;
begin
  -- ONLY bootstrap students verified on the INTEL-1 roster
  if not exists (
    select 1 from public.intel1_student_roster
    where email = lower(new.email)
  ) then
    return new;
  end if;

  -- Ensure not in INTEL-2 or IBM rosters
  if exists (
    select 1 from public.intel2_student_roster where email = lower(new.email)
  ) or exists (
    select 1 from public.ibm1_student_roster where email = lower(new.email)
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
