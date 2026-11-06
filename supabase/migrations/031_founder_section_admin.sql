begin;

-- Founder identities are auth user IDs, never mutable email claims.
create table public.classboard_founders (
  user_id uuid primary key references auth.users(id) on delete restrict
);
alter table public.classboard_founders enable row level security;
revoke all on public.classboard_founders from public, anon, authenticated;

-- Add confirmed existing accounts only; production bootstrap is checked separately.
insert into public.classboard_founders (user_id)
select id from auth.users
where id in ('c532b4e0-9bdc-4f84-915e-f19a001ae702'::uuid, 'f121727e-fe27-46d6-88d4-98599ef4da18'::uuid)
  and email_confirmed_at is not null
on conflict do nothing;

create or replace function public.is_classboard_founder()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.classboard_founders where user_id = (select auth.uid()));
$$;
revoke all on function public.is_classboard_founder() from public, anon;
grant execute on function public.is_classboard_founder() to authenticated;

-- Restore section-scoped administration; retain existing memberships rather than
-- guessing which memberships were originally granted before the temporary rule.
drop trigger if exists sync_admin_section_memberships on public.class_memberships;
drop trigger if exists grant_admins_new_section on public.classes;

-- Admins may perform CR actions in their own sections. Student permissions remain distinct.
create or replace function public.has_class_role(target_class uuid, wanted_role public.class_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_memberships m join public.classes c on c.id = m.class_id and c.is_active
    where m.class_id = target_class and m.user_id = (select auth.uid()) and m.is_active
      and (m.role = wanted_role or (wanted_role = 'cr'::public.class_role and m.role = 'admin'::public.class_role))
  );
$$;

-- Admin role changes are founder-only, including through existing management RPCs.
create function public.protect_section_admin_roles()
returns trigger language plpgsql security definer set search_path = '' as $$
declare old_active boolean := false; new_active boolean := false; target uuid;
begin
  if tg_op <> 'INSERT' then old_active := old.role = 'admin'::public.class_role and old.is_active; target := old.user_id; end if;
  if tg_op <> 'DELETE' then new_active := new.role = 'admin'::public.class_role and new.is_active; target := new.user_id; end if;
  if tg_op = 'INSERT' and new_active then
    select exists (select 1 from public.class_memberships m where m.user_id = new.user_id and m.class_id = new.class_id and m.role = 'admin'::public.class_role and m.is_active) into old_active;
  end if;
  if tg_op = 'UPDATE' and (old_active or new_active) and
     (old.user_id is distinct from new.user_id or old.class_id is distinct from new.class_id or old.role is distinct from new.role) then
    raise exception 'Admin memberships cannot be moved; remove and grant access instead' using errcode = '42501';
  end if;
  if old_active is distinct from new_active and (select auth.uid()) is not null then
    if not public.is_classboard_founder() then raise exception 'Only founders can grant or remove administrator access' using errcode = '42501'; end if;
    if old_active and exists (select 1 from public.classboard_founders where user_id = target) then raise exception 'Founder access cannot be removed here' using errcode = '42501'; end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.protect_section_admin_roles() from public, anon, authenticated;
create trigger protect_section_admin_roles before insert or update or delete on public.class_memberships
for each row execute function public.protect_section_admin_roles();

-- Every active section gets founders, including sections created later.
create function public.grant_founders_section_access()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_active then
    insert into public.class_memberships(user_id, class_id, role, roll_number, is_active)
    select f.user_id, new.id, 'admin'::public.class_role, null::smallint, true from public.classboard_founders f
    on conflict (user_id, class_id, role) do update set is_active = true;
  end if;
  return new;
end;
$$;
revoke all on function public.grant_founders_section_access() from public, anon, authenticated;
create trigger grant_founders_section_access after insert or update of is_active on public.classes
for each row execute function public.grant_founders_section_access();

insert into public.class_memberships(user_id, class_id, role, roll_number, is_active)
select f.user_id, c.id, 'admin'::public.class_role, null::smallint, true
from public.classboard_founders f cross join public.classes c where c.is_active
on conflict (user_id, class_id, role) do update set is_active = true;

notify pgrst, 'reload schema';
commit;
