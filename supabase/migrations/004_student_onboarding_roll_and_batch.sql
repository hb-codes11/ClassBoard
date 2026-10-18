-- Let a signed-in student set their own serial roll number during first join.
-- Lab batch is confirmed by the student and checked against the current
-- 1-32 = A1, 33-66 = A2 assignment rule before saving.

begin;

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
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before saving your student details' using errcode = '42501';
  end if;

  if p_roll_number is null or p_roll_number not between 1 and 66 then
    raise exception 'Enter a serial roll number from 1 to 66';
  end if;

  expected_batch := case when p_roll_number <= 32 then 'A1' else 'A2' end;
  if p_lab_batch not in ('A1', 'A2') or p_lab_batch is distinct from expected_batch then
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
