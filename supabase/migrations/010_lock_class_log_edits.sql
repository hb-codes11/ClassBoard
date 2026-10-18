-- Class sessions feed the class-history view and attendance planning.
-- Keep each CR entry stable after creation; corrections use the existing
-- CR/Admin delete permission followed by a fresh insert.
begin;

drop policy if exists sessions_cr_update on public.class_sessions;
revoke update on public.class_sessions from authenticated;

commit;
