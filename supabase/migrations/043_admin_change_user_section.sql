-- Migration 043: Section Reassignment for Students
-- Allows ClassBoard Founders and Section Administrators to transfer/reassign a student who joined or logged into the wrong section.

begin;

create or replace function public.admin_change_user_section(
  p_target_user_id uuid,
  p_new_class_id uuid default null,
  p_new_class_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  is_founder boolean := false;
  target_class_id uuid;
  new_class_code text;
  new_class_name text;
  old_class_id uuid;
  old_class_code text;
  target_email text;
  target_name text;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- 1. Authorization: Caller must be a Founder or an active Admin
  is_founder := public.is_classboard_founder();
  if not is_founder then
    if not exists (
      select 1 from public.class_memberships
      where user_id = caller_id and role = 'admin' and is_active = true
    ) then
      raise exception 'Only administrators and founders can change a student section' using errcode = '42501';
    end if;
  end if;

  -- 2. Resolve target section
  if p_new_class_id is not null then
    select id, code, name into target_class_id, new_class_code, new_class_name
    from public.classes
    where id = p_new_class_id and is_active = true;
  elsif p_new_class_code is not null then
    select id, code, name into target_class_id, new_class_code, new_class_name
    from public.classes
    where upper(trim(code)) = upper(trim(p_new_class_code)) and is_active = true;
  else
    raise exception 'Target section ID or code must be provided' using errcode = '22023';
  end if;

  if target_class_id is null then
    raise exception 'Target section does not exist or is inactive' using errcode = 'P0002';
  end if;

  -- 3. Resolve target user info
  select email into target_email
  from auth.users
  where id = p_target_user_id;

  if target_email is null then
    select email into target_email
    from public.class_member_contacts
    where user_id = p_target_user_id
    limit 1;
  end if;

  select display_name into target_name
  from public.profiles
  where user_id = p_target_user_id;

  -- 4. Find current active student section
  select c.id, c.code into old_class_id, old_class_code
  from public.class_memberships m
  join public.classes c on c.id = m.class_id
  where m.user_id = p_target_user_id
    and m.role = 'student'
    and m.is_active = true
  order by m.created_at desc
  limit 1;

  if old_class_id = target_class_id then
    return jsonb_build_object(
      'success', true,
      'already_in_section', true,
      'section_code', new_class_code,
      'message', 'User is already registered in ' || new_class_code
    );
  end if;

  -- 5. Deactivate student and CR memberships in all other sections
  update public.class_memberships
  set is_active = false
  where user_id = p_target_user_id
    and class_id <> target_class_id
    and role in ('student', 'cr');

  -- 6. Activate or insert student membership in target section
  insert into public.class_memberships (user_id, class_id, role, roll_number, lab_batch, is_active)
  values (p_target_user_id, target_class_id, 'student'::public.class_role, null, null, true)
  on conflict (user_id, class_id, role) do update
  set is_active = true;

  -- 7. Ensure contact row in class_member_contacts for target section
  if target_email is not null then
    insert into public.class_member_contacts (user_id, class_id, email)
    values (p_target_user_id, target_class_id, lower(target_email))
    on conflict (user_id, class_id) do update
    set email = lower(target_email);
  end if;

  -- 8. Log the transfer action in user_activity if table exists
  begin
    insert into public.user_activity (user_id, class_id, action, description, page, metadata)
    values (
      p_target_user_id,
      target_class_id,
      'section_transfer',
      'Transferred from ' || coalesce(old_class_code, 'none') || ' to ' || new_class_code || ' by admin',
      'founder_dossier',
      jsonb_build_object(
        'transferred_by', caller_id,
        'from_section', old_class_code,
        'to_section', new_class_code,
        'timestamp', now()
      )
    );
  exception when others then
    -- Ignore logging errors gracefully
  end;

  return jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'user_email', target_email,
    'user_name', coalesce(target_name, split_part(target_email, '@', 1)),
    'old_section', old_class_code,
    'new_section', new_class_code,
    'new_section_name', new_class_name,
    'message', 'Successfully transferred ' || coalesce(target_name, target_email, 'student') || ' from ' || coalesce(old_class_code, 'previous section') || ' to ' || new_class_code
  );
end;
$$;

revoke all on function public.admin_change_user_section(uuid, uuid, text) from public, anon;
grant execute on function public.admin_change_user_section(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
