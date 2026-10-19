-- Shared classes-held totals are authoritative for CRs and admins.
-- Student progress is intentionally not allowed to block staff corrections.
begin;

drop trigger if exists attendance_class_counts_guard on public.attendance_class_counts;
drop function if exists public.guard_attendance_class_count();

commit;
