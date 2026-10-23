begin;

alter table public.notifications
  drop constraint if exists notifications_source_type_check;

alter table public.notifications
  add constraint notifications_source_type_check
  check (source_type in ('update', 'reminder', 'resource', 'class_session', 'attendance_issue'));

create or replace function public.notify_student_attendance_issue_reviewed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (class_id, recipient_id, source_type, source_id)
  values (new.class_id, new.student_id, 'attendance_issue', new.id);

  return new;
end;
$$;

revoke all on function public.notify_student_attendance_issue_reviewed() from public, anon;
grant execute on function public.notify_student_attendance_issue_reviewed() to authenticated;

create trigger attendance_issue_review_notification
  after update of state on public.attendance_issues
  for each row
  when (new.state = 'reviewed' and old.state is distinct from new.state)
  execute function public.notify_student_attendance_issue_reviewed();

notify pgrst, 'reload schema';

commit;
