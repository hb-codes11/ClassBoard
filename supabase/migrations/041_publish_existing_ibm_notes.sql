-- Migration 041: Publish Existing IBM Notes & Remove Mentoring from Subject Filters
-- 1. Updates all existing published IBM notes to 'public' visibility so they immediately appear on the public page
-- 2. Broadens anon RLS policy so published IBM notes are accessible publicly unless explicitly marked private
-- 3. Deactivates Mentoring from subjects so it does not appear in any filter

begin;

-- Step 1: Set existing approved IBM notes to 'public' visibility
update public.resources
set visibility = 'public'
where public.is_ibm_class(class_id)
  and published_at is not null
  and deleted_at is null;

-- Step 2: Broaden anon RLS policy on public.resources
drop policy if exists resources_read_public on public.resources;
create policy resources_read_public on public.resources
  for select to anon
  using (
    published_at is not null
    and deleted_at is null
    and coalesce(visibility, 'public') <> 'private'
    and public.is_ibm_class(class_id)
  );

-- Step 3: Ensure storage policy allows anon to preview/download public IBM resources (unless marked private)
create or replace function public.can_read_resource_object(object_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.resources r
    where r.storage_path = object_name
      and r.published_at is not null
      and r.deleted_at is null
      and (
        -- Public IBM resources readable without login (unless private)
        (coalesce(r.visibility, 'public') <> 'private' and public.is_ibm_class(r.class_id))
        -- Authenticated member access (section or shared cohort)
        or (
          (auth.uid() is not null) and (
            public.is_active_class_member(r.class_id)
            or (public.is_ibm_class(r.class_id) and public.is_active_ibm_member())
            or (public.is_intel_class(r.class_id) and public.is_active_intel_member())
          )
        )
      )
  ) or exists (
    select 1 from public.updates u
    where u.attachment_path = object_name
      and u.published_at is not null
      and (u.expires_at is null or u.expires_at > now())
      and (auth.uid() is not null)
      and (
        public.is_active_class_member(u.class_id)
        or (public.is_ibm_class(u.class_id) and public.is_active_ibm_member())
        or (public.is_intel_class(u.class_id) and public.is_active_intel_member())
      )
  );
$$;

revoke all on function public.can_read_resource_object(text) from public;
grant execute on function public.can_read_resource_object(text) to anon, authenticated;

-- Step 4: Deactivate Mentoring from subjects everywhere so it is omitted from all filters
update public.subjects
set is_active = false
where slug = 'mentoring' or lower(name) like '%mentor%';

commit;

