begin;

grant insert (class_id, subject_id, kind, batch, classes_held, updated_by)
  on public.attendance_class_counts to authenticated;
grant update (classes_held, updated_by)
  on public.attendance_class_counts to authenticated;

commit;
