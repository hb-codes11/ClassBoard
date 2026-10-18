-- Give every new INTEL-1 auth user a default Student membership, including Google sign-ins.
-- Let class admins manage memberships through a guarded RPC instead of direct table writes.

begin;

alter table public.class_memberships drop constraint if exists membership_roll_matches_role;
alter table public.class_memberships add constraint membership_roll_matches_role check (
  (role = 'student' and (roll_number is null or roll_number between 1 and 66))
  or (role <> 'student' and roll_number is null)
);

insert into public.profiles (user_id, display_name)
select u.id,
       coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1))
from auth.users u
on conflict (user_id) do update
set display_name = case when public.profiles.display_name = '' then excluded.display_name else public.profiles.display_name end;

create table if not exists public.class_member_contacts (
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  email text not null,
  primary key (user_id, class_id)
);
alter table public.class_member_contacts enable row level security;
drop policy if exists member_contacts_admin_read on public.class_member_contacts;
create policy member_contacts_admin_read on public.class_member_contacts for select to authenticated
  using (public.has_class_role(class_id, 'admin'));
revoke all on public.class_member_contacts from anon;
grant select on public.class_member_contacts to authenticated;

insert into public.class_member_contacts (user_id, class_id, email)
select distinct m.user_id, m.class_id, lower(u.email)
from public.class_memberships m
join auth.users u on u.id = m.user_id
where m.is_active and u.email is not null
on conflict (user_id, class_id) do update set email = excluded.email;

create or replace function public.bootstrap_intel1_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_class uuid;
begin
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
drop trigger if exists auth_user_bootstrap_intel1 on auth.users;
create trigger auth_user_bootstrap_intel1
  after insert on auth.users
  for each row execute function public.bootstrap_intel1_user();

drop policy if exists memberships_read_self on public.class_memberships;
create policy memberships_read_self_or_admin on public.class_memberships for select to authenticated
  using (user_id = (select auth.uid()) or public.has_class_role(class_id, 'admin'));

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

revoke all on function public.set_class_member_roles(uuid, uuid, public.class_role[], smallint) from public, anon;
grant execute on function public.set_class_member_roles(uuid, uuid, public.class_role[], smallint) to authenticated;

commit;
