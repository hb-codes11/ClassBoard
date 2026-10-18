-- Expand the deployed roll-number limit to 66 without rewriting migrations
-- that may already have been applied. Batch mapping: 1-32 = A1, 33-66 = A2.

begin;

alter table public.class_memberships drop constraint if exists membership_roll_matches_role;
alter table public.class_memberships add constraint membership_roll_matches_role check (
  (role = 'student' and (roll_number is null or roll_number between 1 and 66))
  or (role <> 'student' and roll_number is null)
);

create or replace function public.set_class_member_roles(
  p_user_id uuid,
  p_class_id uuid,
  p_roles public.class_role[],
  p_roll_number smallint default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  remaining_admins integer;
begin
  if (select auth.uid()) is null or not public.has_class_role(p_class_id, 'admin') then
    raise exception 'Only an active class admin can change class roles' using errcode = '42501';
  end if;
  if p_roles is null then
    raise exception 'Choose at least one role';
  end if;
  if 'student' = any(p_roles) and p_roll_number is not null and p_roll_number not between 1 and 66 then
    raise exception 'Student roll number must be between 1 and 66';
  end if;
  if not ('student' = any(p_roles)) and p_roll_number is not null then
    raise exception 'A roll number can only be assigned to a student';
  end if;

  if exists (
    select 1 from public.class_memberships m
    where m.user_id = p_user_id and m.class_id = p_class_id and m.role = 'admin' and m.is_active
  ) and not ('admin' = any(p_roles)) then
    select count(*) into remaining_admins from public.class_memberships m
    where m.class_id = p_class_id and m.role = 'admin' and m.is_active and m.user_id <> p_user_id;
    if remaining_admins = 0 then
      raise exception 'Keep at least one active class admin';
    end if;
  end if;

  update public.class_memberships m
  set is_active = false
  where m.user_id = p_user_id and m.class_id = p_class_id and m.is_active
    and not (m.role = any(p_roles));

  insert into public.class_memberships (user_id, class_id, role, roll_number, is_active)
  select p_user_id, p_class_id, wanted.role,
         case when wanted.role = 'student' then p_roll_number else null end,
         true
  from unnest(p_roles) as wanted(role)
  on conflict (user_id, class_id, role) do update
    set is_active = true,
        roll_number = case
          when excluded.role = 'student' then coalesce(p_roll_number, public.class_memberships.roll_number)
          else null
        end;
end;
$$;

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

revoke all on function public.set_class_member_roles(uuid, uuid, public.class_role[], smallint) from public, anon;
grant execute on function public.set_class_member_roles(uuid, uuid, public.class_role[], smallint) to authenticated;
revoke all on function public.set_own_student_setup(uuid, smallint, text) from public, anon;
grant execute on function public.set_own_student_setup(uuid, smallint, text) to authenticated;

commit;
