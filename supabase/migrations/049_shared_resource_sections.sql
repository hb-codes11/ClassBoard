-- Make the existing shared-resource rules usable without granting section membership.
begin;

create or replace function public.shared_resource_section_ids(p_class_id uuid)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select target.id
  from public.classes current_class
  join public.classes target on target.is_active and (
    target.id = current_class.id
    or (current_class.code in ('INTEL-1', 'INTEL-2') and target.code in ('INTEL-1', 'INTEL-2'))
    or (current_class.code in ('IBM-1', 'IBM-2', 'IBM-3', 'IBM-4') and target.code in ('IBM-1', 'IBM-2', 'IBM-3', 'IBM-4'))
  )
  where current_class.id = p_class_id and current_class.is_active
    and public.is_active_class_member(current_class.id);
$$;
revoke all on function public.shared_resource_section_ids(uuid) from public, anon;
grant execute on function public.shared_resource_section_ids(uuid) to authenticated;

-- Subject names are needed to label and filter resources shared across sections.
drop policy if exists subjects_read_shared_cohort on public.subjects;
create policy subjects_read_shared_cohort on public.subjects for select to authenticated
  using (is_active and (
    (public.is_intel_class(class_id) and public.is_active_intel_member())
    or (public.is_ibm_class(class_id) and public.is_active_ibm_member())
  ));

notify pgrst, 'reload schema';
commit;
