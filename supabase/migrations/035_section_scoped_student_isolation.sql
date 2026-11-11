-- Migration 035: Strict Section Scoping & Student Isolation
-- Prevents cross-section leakage: IBM-1 students remain exclusively in IBM-1,
-- and section admins can only see, manage, and access accounts from their own section.

begin;

-- 1. Update bootstrap_intel1_user to prevent auto-enrolling IBM-1 students into INTEL-1
create or replace function public.bootstrap_intel1_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_class uuid;
begin
  -- If student belongs to the IBM-1 roster, do NOT enroll them in INTEL-1
  if exists (
    select 1 from public.ibm1_student_roster
    where email = lower(new.email)
  ) then
    return new;
  end if;

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

-- 2. Cleanup: Remove IBM-1 students from INTEL-1 (founders remain in all sections)
delete from public.class_memberships
where class_id = (select id from public.classes where code = 'INTEL-1')
  and user_id in (
    select u.id from auth.users u
    join public.ibm1_student_roster r on r.email = lower(u.email)
    where not exists (select 1 from public.classboard_founders f where f.user_id = u.id)
  );

delete from public.class_member_contacts
where class_id = (select id from public.classes where code = 'INTEL-1')
  and user_id in (
    select u.id from auth.users u
    join public.ibm1_student_roster r on r.email = lower(u.email)
    where not exists (select 1 from public.classboard_founders f where f.user_id = u.id)
  );

-- 3. Ensure section admins can ONLY read memberships and contacts for their administered class
drop policy if exists memberships_read_self_or_admin on public.class_memberships;
create policy memberships_read_self_or_admin on public.class_memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_class_role(class_id, 'admin')
    or public.is_classboard_founder()
  );

drop policy if exists member_contacts_admin_read on public.class_member_contacts;
create policy member_contacts_admin_read on public.class_member_contacts for select to authenticated
  using (
    public.has_class_role(class_id, 'admin')
    or public.is_classboard_founder()
  );

notify pgrst, 'reload schema';

commit;
