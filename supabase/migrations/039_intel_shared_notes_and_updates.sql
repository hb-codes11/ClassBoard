-- Migration 039: Share Notes and Updates across INTEL-1 and INTEL-2 (Deadlines & Reminders stay separate)
begin;

create or replace function public.is_intel_class(p_class_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.classes
    where id = p_class_id and code in ('INTEL-1', 'INTEL-2')
  );
$$;

create or replace function public.is_active_intel_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_memberships m
    join public.classes c on c.id = m.class_id
    where m.user_id = (select auth.uid())
      and m.is_active
      and c.code in ('INTEL-1', 'INTEL-2')
  );
$$;

-- Allow members of any Intel section to read published notes (resources)
drop policy if exists resources_read_published_member on public.resources;
create policy resources_read_published_member on public.resources for select to authenticated
  using (
    published_at is not null
    and deleted_at is null
    and (
      public.is_active_class_member(class_id)
      or (public.is_ibm_class(class_id) and public.is_active_ibm_member())
      or (public.is_intel_class(class_id) and public.is_active_intel_member())
    )
  );

-- Allow members of any Intel section to read published updates
drop policy if exists updates_read_published_member on public.updates;
create policy updates_read_published_member on public.updates for select to authenticated
  using (
    published_at is not null
    and (expires_at is null or expires_at > now())
    and (
      public.is_active_class_member(class_id)
      or (public.is_ibm_class(class_id) and public.is_active_ibm_member())
      or (public.is_intel_class(class_id) and public.is_active_intel_member())
    )
  );

-- Allow reading storage objects for both resources and update attachments
create or replace function public.can_read_resource_object(object_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.resources r
    where r.storage_path = object_name and r.published_at is not null and r.deleted_at is null
      and (
        public.is_active_class_member(r.class_id)
        or (public.is_ibm_class(r.class_id) and public.is_active_ibm_member())
        or (public.is_intel_class(r.class_id) and public.is_active_intel_member())
      )
  ) or exists (
    select 1 from public.updates u
    where u.attachment_path = object_name and u.published_at is not null
      and (u.expires_at is null or u.expires_at > now())
      and (
        public.is_active_class_member(u.class_id)
        or (public.is_ibm_class(u.class_id) and public.is_active_ibm_member())
        or (public.is_intel_class(u.class_id) and public.is_active_intel_member())
      )
  );
$$;

revoke all on function public.can_read_resource_object(text) from public;
grant execute on function public.can_read_resource_object(text) to authenticated;

-- Allow INTEL-2 students to select their lab batch (B1 or B2) freely without automated division
alter table public.class_memberships add column if not exists lab_batch text;

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
  approved_count integer;
  is_pending boolean := false;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in before saving your student details' using errcode = '42501';
  end if;

  select c.code into target_code from public.classes c where c.id = p_class_id and c.is_active;
  if target_code is null then
    raise exception 'The selected class is not active' using errcode = '42501';
  end if;

  -- Validation per section without leaking capacity limits
  if target_code = 'IBM-1' then
    if p_roll_number is null or p_roll_number < 1 or p_roll_number > 67 then
      raise exception 'Enter a valid serial number for this section';
    end if;
  elsif target_code in ('INTEL-1', 'INTEL-2') then
    if p_roll_number is null or p_roll_number < 1 or p_roll_number > 66 then
      raise exception 'Enter a valid serial number for this section';
    end if;
  elsif target_code in ('IBM-2', 'IBM-3', 'IBM-4') then
    if p_roll_number is null or p_roll_number < 1 or p_roll_number > 80 then
      raise exception 'Enter a valid serial number for this section';
    end if;
  end if;

  -- Determine expected lab batch based on section architecture
  if target_code in ('INTEL-2', 'IBM-2', 'IBM-3', 'IBM-4') then
    -- Free selection for INTEL-2, IBM-2, IBM-3, IBM-4 (no automated division enforced)
    if target_code in ('INTEL-2', 'IBM-2') and p_lab_batch not in ('B1', 'B2') then
      raise exception 'Please select a valid lab batch for this section';
    elsif target_code = 'IBM-3' and p_lab_batch not in ('C1', 'C2') then
      raise exception 'Please select a valid lab batch for this section';
    elsif target_code = 'IBM-4' and p_lab_batch not in ('D1', 'D2') then
      raise exception 'Please select a valid lab batch for this section';
    end if;
  else
    expected_batch := case
      when p_roll_number <= 32 then 'A1'
      else 'A2'
    end;

    if p_lab_batch is distinct from expected_batch then
      raise exception 'That serial number belongs to batch %', expected_batch;
    end if;
  end if;

  -- Check hidden internal capacity of 80 approved students for B, C, D
  if target_code in ('IBM-2', 'IBM-3', 'IBM-4') then
    select count(*) into approved_count
    from public.class_memberships
    where class_id = p_class_id
      and role = 'student'
      and is_active = true
      and user_id <> (select auth.uid());

    if approved_count >= 80 then
      is_pending := true;
    end if;
  end if;

  -- One section per student account rule
  update public.class_memberships
  set is_active = false
  where user_id = (select auth.uid())
    and class_id <> p_class_id
    and role = 'student';

  -- Upsert student membership for target section
  insert into public.class_memberships (user_id, class_id, role, roll_number, lab_batch, is_active)
  values (
    (select auth.uid()),
    p_class_id,
    'student'::public.class_role,
    p_roll_number,
    p_lab_batch,
    not is_pending
  )
  on conflict (user_id, class_id, role) do update
  set roll_number = p_roll_number,
      lab_batch = p_lab_batch,
      is_active = not is_pending;

  if is_pending then
    raise notice 'Your section registration is pending administrator verification.';
  end if;
exception
  when unique_violation then
    raise exception 'That serial number is already assigned in this section.' using errcode = '23505';
end;
$$;

revoke all on function public.set_own_student_setup(uuid, smallint, text) from public, anon;
grant execute on function public.set_own_student_setup(uuid, smallint, text) to authenticated;

commit;

