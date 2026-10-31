-- Allow class updates to be pinned to the top of Home preview for the entire class.
alter table public.updates
  add column if not exists is_pinned boolean not null default false;

-- Allow CRs to update update rows (including toggling is_pinned) in their class
drop policy if exists updates_cr_update on public.updates;
create policy updates_cr_update on public.updates for update to authenticated
  using (public.has_class_role(class_id, 'cr'))
  with check (public.has_class_role(class_id, 'cr'));

-- Allow Admins to update update rows in their class
drop policy if exists updates_admin_update on public.updates;
create policy updates_admin_update on public.updates for update to authenticated
  using (public.has_class_role(class_id, 'admin'))
  with check (public.has_class_role(class_id, 'admin'));

