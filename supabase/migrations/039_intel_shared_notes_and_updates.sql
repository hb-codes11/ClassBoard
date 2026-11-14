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

commit;
