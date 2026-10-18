-- Student access is the baseline for every active INTEL-1 class account.
-- CR and Admin are additional permissions, managed by class admins.

begin;

-- Older auth users may predate the automatic membership trigger. The app's
-- college-domain gate limits this Classboard project to Medicaps accounts.
insert into public.class_member_contacts (user_id, class_id, email)
select u.id, c.id, lower(u.email)
from auth.users u
join public.classes c on c.code = 'INTEL-1' and c.is_active
where lower(u.email) like '%@medicaps.ac.in'
on conflict (user_id, class_id) do update
  set email = excluded.email;

insert into public.class_memberships (user_id, class_id, role, roll_number, is_active)
select u.id, c.id, 'student'::public.class_role, null::smallint, true
from auth.users u
join public.classes c on c.code = 'INTEL-1' and c.is_active
where lower(u.email) like '%@medicaps.ac.in'
  and not exists (
    select 1
    from public.class_memberships student
    where student.user_id = u.id
      and student.class_id = c.id
      and student.role = 'student'::public.class_role
      and student.is_active
  )
on conflict (user_id, class_id, role) do update
  set is_active = true,
      roll_number = null;

-- Give existing active class accounts the default Student membership.
-- Reset a previously inactive student roll to NULL on reactivation so a stale
-- roll cannot collide with a currently assigned student.
insert into public.class_memberships (user_id, class_id, role, roll_number, is_active)
select distinct member.user_id, member.class_id, 'student'::public.class_role, null::smallint, true
from public.class_memberships member
where member.is_active
  and not exists (
    select 1
    from public.class_memberships student
    where student.user_id = member.user_id
      and student.class_id = member.class_id
      and student.role = 'student'::public.class_role
      and student.is_active
  )
on conflict (user_id, class_id, role) do update
  set is_active = true,
      roll_number = null;

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
  effective_roles public.class_role[];
begin
  if (select auth.uid()) is null or not public.has_class_role(p_class_id, 'admin') then
    raise exception 'Only an active class admin can change class roles' using errcode = '42501';
  end if;
  if p_roles is null then
    raise exception 'Choose CR or Admin access to save';
  end if;
  if p_roll_number is not null and p_roll_number not between 1 and 66 then
    raise exception 'Student roll number must be between 1 and 66';
  end if;

  -- Student access cannot be removed. The submitted list only controls the
  -- additional CR and Admin permissions.
  select array_agg(distinct wanted.role)
  into effective_roles
  from unnest(p_roles || array['student'::public.class_role]) as wanted(role);

  if exists (
    select 1 from public.class_memberships m
    where m.user_id = p_user_id and m.class_id = p_class_id
      and m.role = 'admin'::public.class_role and m.is_active
  ) and not ('admin'::public.class_role = any(effective_roles)) then
    select count(*) into remaining_admins from public.class_memberships m
    where m.class_id = p_class_id and m.role = 'admin'::public.class_role
      and m.is_active and m.user_id <> p_user_id;
    if remaining_admins = 0 then
      raise exception 'Keep at least one active class admin';
    end if;
  end if;

  update public.class_memberships m
  set is_active = false
  where m.user_id = p_user_id and m.class_id = p_class_id and m.is_active
    and not (m.role = any(effective_roles));

  insert into public.class_memberships (user_id, class_id, role, roll_number, is_active)
  select p_user_id, p_class_id, wanted.role,
         case when wanted.role = 'student'::public.class_role then p_roll_number else null end,
         true
  from unnest(effective_roles) as wanted(role)
  on conflict (user_id, class_id, role) do update
    set is_active = true,
        roll_number = case
          when excluded.role = 'student'::public.class_role then coalesce(p_roll_number, public.class_memberships.roll_number)
          else null
        end;
end;
$$;

revoke all on function public.set_class_member_roles(uuid, uuid, public.class_role[], smallint) from public, anon;
grant execute on function public.set_class_member_roles(uuid, uuid, public.class_role[], smallint) to authenticated;

commit;
