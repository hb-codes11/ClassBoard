begin;

grant insert, update on table public.student_attendance_progress to authenticated;

notify pgrst, 'reload schema';

commit;
