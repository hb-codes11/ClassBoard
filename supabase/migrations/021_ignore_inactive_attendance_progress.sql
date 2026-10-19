begin;

create or replace function public.guard_attendance_class_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  highest_attended integer;
begin
  select coalesce(max(p.attended_classes), 0) into highest_attended
  from public.student_attendance_progress p
  where p.class_id = new.class_id
    and p.subject_id = new.subject_id
    and p.kind = new.kind
    and p.batch = new.batch
    and exists (
      select 1
      from public.class_memberships m
      where m.user_id = p.user_id
        and m.class_id = p.class_id
        and m.role = 'student'::public.class_role
        and m.is_active
    );

  if new.classes_held < highest_attended then
    raise exception 'Classes held must be at least % to cover saved attendance from an active student',
      highest_attended;
  end if;

  return new;
end;
$$;

commit;
