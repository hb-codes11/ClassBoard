-- Allow class updates and reminders to be pinned to the top of Home preview for the entire class.
alter table public.updates
  add column if not exists is_pinned boolean not null default false;

alter table public.reminders
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

-- Allow CRs to update reminder rows (including toggling is_pinned) in their class
drop policy if exists reminders_cr_update on public.reminders;
create policy reminders_cr_update on public.reminders for update to authenticated
  using (public.has_class_role(class_id, 'cr'))
  with check (public.has_class_role(class_id, 'cr'));

-- Allow Admins to update reminder rows in their class
drop policy if exists reminders_admin_update on public.reminders;
create policy reminders_admin_update on public.reminders for update to authenticated
  using (public.has_class_role(class_id, 'admin'))
  with check (public.has_class_role(class_id, 'admin'));
