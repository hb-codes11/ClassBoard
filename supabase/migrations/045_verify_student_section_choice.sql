-- Migration 045: Real-time Section Selection Validation
-- Validates student section choice against locked rosters (INTEL-2, IBM-1).
-- If a student selects the wrong section, returns an explicit English error message.

begin;

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

  -- 2. Check INTEL-2 roster
  if exists (
    select 1 from public.intel2_student_roster
    where email = norm_email or upper(enrollment_no) = norm_enroll
  ) then
    select 'INTEL-2', 'AI & Analytics - B (Intel-2)', student_name
    into actual_code, actual_name, roster_name
    from public.intel2_student_roster
    where email = norm_email or upper(enrollment_no) = norm_enroll
    limit 1;

  -- 3. Check IBM-1 roster
  elsif exists (
    select 1 from public.ibm1_student_roster
    where email = norm_email or upper(enrollment_no) = norm_enroll
  ) then
    select 'IBM-1', 'IBM Advanced AI - A', student_name
    into actual_code, actual_name, roster_name
    from public.ibm1_student_roster
    where email = norm_email or upper(enrollment_no) = norm_enroll
    limit 1;

  -- 4. Check active membership in other sections (if user already has assigned section)
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

  return jsonb_build_object('allowed', true);
end;
$$;

revoke all on function public.verify_student_section_choice(text, text) from public;
grant execute on function public.verify_student_section_choice(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
