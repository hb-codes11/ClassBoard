begin;

grant insert, update on table public.attendance_class_counts to authenticated;

notify pgrst, 'reload schema';

commit;
