-- Allow active CRs to correct saved class-log entries.
-- Admin-only accounts keep read and delete access, but cannot edit these rows.
begin;

drop policy if exists sessions_cr_update on public.class_sessions;
create policy sessions_cr_update on public.class_sessions for update to authenticated
  using (state <> 'scheduled' and public.has_class_role(class_id, 'cr'))
  with check (state <> 'scheduled' and public.has_class_role(class_id, 'cr') and updated_by = (select auth.uid()));

revoke update on public.class_sessions from authenticated;
grant update (subject_id, class_number, kind, batch, state, starts_at, topic, updated_by)
  on public.class_sessions to authenticated;

commit;
