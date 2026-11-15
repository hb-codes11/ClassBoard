-- Restore the Class Log behavior from before 047. Keep migration history and any stored rows.
begin;

revoke execute on function public.publish_timetable_sessions(uuid, jsonb) from authenticated;

drop policy if exists sessions_cr_update on public.class_sessions;
create policy sessions_cr_update on public.class_sessions for update to authenticated
  using (state <> 'scheduled' and public.has_class_role(class_id, 'cr'))
  with check (state <> 'scheduled' and public.has_class_role(class_id, 'cr') and updated_by = (select auth.uid()));

drop trigger if exists notifications_for_class_sessions on public.class_sessions;
create trigger notifications_for_class_sessions
  after insert on public.class_sessions
  for each row
  execute function public.notify_active_class_members('class_session');

commit;
