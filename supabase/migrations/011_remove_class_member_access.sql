-- Let active class admins remove a person from this Classboard class without
-- deleting their Google/Supabase Auth account or class history.
begin;

create or replace function public.remove_class_member_access(
  p_user_id uuid,
  p_class_id uuid
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
    raise exception 'Only an active class admin can remove class access' using errcode = '42501';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot remove your own class access here';
  end if;

  if exists (
    select 1 from public.class_memberships m
    where m.user_id = p_user_id and m.class_id = p_class_id
      and m.role = 'admin'::public.class_role and m.is_active
  ) then
    select count(*) into remaining_admins
    from public.class_memberships m
    where m.class_id = p_class_id and m.role = 'admin'::public.class_role
      and m.is_active and m.user_id <> p_user_id;
    if remaining_admins = 0 then
      raise exception 'Keep at least one active class admin';
    end if;
  end if;

  update public.class_memberships
  set is_active = false
  where user_id = p_user_id and class_id = p_class_id and is_active;

  if not found then
    raise exception 'This account has no active access to this class';
  end if;
end;
$$;

revoke all on function public.remove_class_member_access(uuid, uuid) from public, anon;
grant execute on function public.remove_class_member_access(uuid, uuid) to authenticated;

commit;
