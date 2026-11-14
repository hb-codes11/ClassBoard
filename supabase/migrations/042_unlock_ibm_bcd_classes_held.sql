-- Migration 042: Unlock Classes Held for IBM Advanced AI Sections B, C, and D
-- Allows active students/members of IBM B, C, D (IBM-2, IBM-3, IBM-4) to update classes held totals.

begin;

create or replace function public.is_self_held_attendance_class(p_class_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.classes
    where id = p_class_id
      and code in ('IBM-2', 'IBM-3', 'IBM-4')
  );
$$;

revoke all on function public.is_self_held_attendance_class(uuid) from public;
grant execute on function public.is_self_held_attendance_class(uuid) to authenticated;

drop policy if exists attendance_counts_staff_insert on public.attendance_class_counts;
create policy attendance_counts_staff_insert on public.attendance_class_counts for insert to authenticated
  with check (
    (
      public.has_class_role(class_id, 'cr')
      or public.has_class_role(class_id, 'admin')
      or (public.is_active_class_member(class_id) and public.is_self_held_attendance_class(class_id))
    )
    and updated_by = (select auth.uid())
  );

drop policy if exists attendance_counts_staff_update on public.attendance_class_counts;
create policy attendance_counts_staff_update on public.attendance_class_counts for update to authenticated
  using (
    public.has_class_role(class_id, 'cr')
    or public.has_class_role(class_id, 'admin')
    or (public.is_active_class_member(class_id) and public.is_self_held_attendance_class(class_id))
  )
  with check (
    (
      public.has_class_role(class_id, 'cr')
      or public.has_class_role(class_id, 'admin')
      or (public.is_active_class_member(class_id) and public.is_self_held_attendance_class(class_id))
    )
    and updated_by = (select auth.uid())
  );

commit;

