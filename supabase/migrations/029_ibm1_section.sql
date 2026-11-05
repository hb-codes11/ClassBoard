-- IBM-1 has its own class-scoped subjects and does not inherit INTEL data.
-- Membership is granted separately; this migration does not create accounts.
begin;

insert into public.classes (code, name, semester)
values ('IBM-1', 'Advanced AI - A', 3)
on conflict (code) do update
set name = excluded.name, semester = excluded.semester, is_active = true;

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
where c.code = 'IBM-1'
on conflict (class_id, slug) do nothing;


alter table public.class_memberships drop constraint if exists membership_roll_matches_role;
alter table public.class_memberships add constraint membership_roll_matches_role check (
  (role = 'student' and (roll_number is null or roll_number between 1 and 67))
  or (role <> 'student' and roll_number is null)
);
create or replace function public.validate_ibm1_roll_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.roll_number = 67 and not exists (select 1 from public.classes where id = new.class_id and code = 'IBM-1') then
    raise exception 'Roll number 67 is only valid for IBM-1';
  end if;
  return new;
end; $$;
drop trigger if exists class_membership_roll_limit on public.class_memberships;
create trigger class_membership_roll_limit before insert or update of roll_number, class_id on public.class_memberships
for each row execute function public.validate_ibm1_roll_limit();

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
  if p_roll_number is not null and (p_roll_number < 1 or p_roll_number > case when exists (select 1 from public.classes where id = p_class_id and code = 'IBM-1') then 67 else 66 end) then
    raise exception 'Student roll number is outside the allowed range for this section';
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
  if p_roll_number is not null and (p_roll_number < 1 or p_roll_number > case when exists (select 1 from public.classes where id = p_class_id and code = 'IBM-1') then 67 else 66 end) then
    raise exception 'Student roll number is outside the allowed range for this section';
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
  if p_roll_number is null or (p_roll_number < 1 or p_roll_number > case when exists (select 1 from public.classes where id = p_class_id and code = 'IBM-1') then 67 else 66 end) then
    raise exception 'Enter a valid serial roll number for this section';
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



-- IBM-1 student roster is private: no direct client access.
create table if not exists public.ibm1_student_roster (
  roll_number smallint primary key check (roll_number between 1 and 67),
  email text not null unique,
  student_name text not null
);
alter table public.ibm1_student_roster enable row level security;
revoke all on public.ibm1_student_roster from public, anon, authenticated;

-- Populate the private roster separately after this migration is applied.


-- Grant only verified roster accounts. Do not reactivate an explicitly removed
-- membership or overwrite an existing roll. A collision needs admin review.
create or replace function public.bootstrap_ibm1_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  section_id uuid;
  roster_row public.ibm1_student_roster%rowtype;
begin
  if new.email_confirmed_at is null or new.email is null then
    return new;
  end if;
  select * into roster_row from public.ibm1_student_roster where email = lower(new.email);
  if not found then return new; end if;
  select id into section_id from public.classes where code = 'IBM-1' and is_active;
  if section_id is null then return new; end if;

  insert into public.profiles (user_id, display_name)
  values (new.id, roster_row.student_name)
  on conflict (user_id) do update set display_name = excluded.display_name
  where public.profiles.display_name = '' or lower(public.profiles.display_name) = split_part(lower(new.email), '@', 1);
  insert into public.class_member_contacts (user_id, class_id, email)
  values (new.id, section_id, lower(new.email))
  on conflict (user_id, class_id) do nothing;
  if not exists (
    select 1 from public.class_memberships
    where class_id = section_id and role = 'student' and is_active
      and roll_number = roster_row.roll_number and user_id <> new.id
  ) then
    insert into public.class_memberships (user_id, class_id, role, roll_number, is_active)
    values (new.id, section_id, 'student', roster_row.roll_number, true)
    on conflict (user_id, class_id, role) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.bootstrap_ibm1_user() from public, anon, authenticated;
drop trigger if exists auth_user_bootstrap_ibm1 on auth.users;
create trigger auth_user_bootstrap_ibm1
after insert or update of email_confirmed_at on auth.users
for each row execute function public.bootstrap_ibm1_user();

-- Existing verified accounts are added without changing existing memberships.
insert into public.profiles (user_id, display_name)
select u.id, r.student_name from auth.users u
join public.ibm1_student_roster r on r.email = lower(u.email)
where u.email_confirmed_at is not null
on conflict (user_id) do nothing;
update public.profiles p
set display_name = r.student_name
from auth.users u join public.ibm1_student_roster r on r.email = lower(u.email)
where p.user_id = u.id and u.email_confirmed_at is not null
  and (p.display_name = '' or lower(p.display_name) = split_part(lower(u.email), '@', 1));
insert into public.class_member_contacts (user_id, class_id, email)
select u.id, c.id, lower(u.email) from auth.users u
join public.ibm1_student_roster r on r.email = lower(u.email)
join public.classes c on c.code = 'IBM-1' and c.is_active
where u.email_confirmed_at is not null
on conflict (user_id, class_id) do nothing;
insert into public.class_memberships (user_id, class_id, role, roll_number, is_active)
select u.id, c.id, 'student'::public.class_role, r.roll_number, true
from auth.users u join public.ibm1_student_roster r on r.email = lower(u.email)
join public.classes c on c.code = 'IBM-1' and c.is_active
where u.email_confirmed_at is not null
and not exists (
  select 1 from public.class_memberships m where m.class_id = c.id
    and m.role = 'student' and m.is_active and m.roll_number = r.roll_number and m.user_id <> u.id
)
on conflict (user_id, class_id, role) do nothing;

commit;
