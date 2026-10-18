begin;

grant delete on table public.attendance_issues to authenticated;

create policy issues_staff_delete_reviewed on public.attendance_issues for delete to authenticated
  using (
    public.can_manage_attendance_issue(id)
    and state in ('referred', 'resolved')
  );

notify pgrst, 'reload schema';

commit;
