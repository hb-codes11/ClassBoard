-- Admin access is global until a separate founder role is introduced.
begin;

create or replace function public.sync_admin_section_memberships()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if pg_catalog.pg_trigger_depth() > 1 or new.role <> 'admin'::public.class_role then
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(73629041);
  if new.is_active then
    insert into public.class_memberships (user_id, class_id, role, roll_number, is_active)
    select new.user_id, c.id, 'admin'::public.class_role, null::smallint, true
    from public.classes c where c.is_active
    on conflict (user_id, class_id, role) do update set is_active = true
    where not public.class_memberships.is_active;
  elsif tg_op = 'UPDATE' and old.is_active then
    if not exists (select 1 from public.class_memberships m
      where m.role = 'admin'::public.class_role and m.is_active and m.user_id <> new.user_id) then
      raise exception 'Keep at least one active administrator';
    end if;
    update public.class_memberships set is_active = false
    where user_id = new.user_id and role = 'admin'::public.class_role and is_active;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_admin_section_memberships() from public, anon, authenticated;

-- Include existing admins in every currently active section.
insert into public.class_memberships (user_id, class_id, role, roll_number, is_active)
select distinct m.user_id, c.id, 'admin'::public.class_role, null::smallint, true
from public.class_memberships m cross join public.classes c
where m.role = 'admin'::public.class_role and m.is_active and c.is_active
on conflict (user_id, class_id, role) do update set is_active = true
where not public.class_memberships.is_active;


create trigger sync_admin_section_memberships
after insert or update of is_active on public.class_memberships
for each row execute function public.sync_admin_section_memberships();

create or replace function public.grant_admins_new_section()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_active then
    perform pg_catalog.pg_advisory_xact_lock(73629041);
    insert into public.class_memberships (user_id, class_id, role, roll_number, is_active)
    select distinct m.user_id, new.id, 'admin'::public.class_role, null::smallint, true
    from public.class_memberships m where m.role = 'admin'::public.class_role and m.is_active
    on conflict (user_id, class_id, role) do update set is_active = true;
  end if;
  return new;
end;
$$;
revoke all on function public.grant_admins_new_section() from public, anon, authenticated;

create trigger grant_admins_new_section
after insert or update of is_active on public.classes
for each row execute function public.grant_admins_new_section();


commit;
