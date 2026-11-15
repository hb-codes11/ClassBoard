begin;

alter table public.class_sessions add column if not exists timetable_slot_key text;
create unique index if not exists class_sessions_timetable_slot
  on public.class_sessions (class_id, timetable_slot_key);

-- Allow staff to record the outcome of generated sessions with the existing class-log editor.
drop policy if exists sessions_cr_update on public.class_sessions;
create policy sessions_cr_update on public.class_sessions for update to authenticated
  using ((state <> 'scheduled' or timetable_slot_key is not null) and public.has_class_role(class_id, 'cr'))
  with check (state <> 'scheduled' and public.has_class_role(class_id, 'cr') and updated_by = (select auth.uid()));

-- Weekly imports can contain dozens of sessions. Individual manual entries keep their notifications.
drop trigger if exists notifications_for_class_sessions on public.class_sessions;
create trigger notifications_for_class_sessions
  after insert on public.class_sessions
  for each row when (new.timetable_slot_key is null)
  execute function public.notify_active_class_members('class_session');

create or replace function public.publish_timetable_sessions(p_class_id uuid, p_sessions jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  inserted_count integer;
begin
  if actor is null or not public.has_class_role(p_class_id, 'cr') then
    raise exception 'Only section staff can publish timetable entries' using errcode = '42501';
  end if;
  if p_sessions is null or jsonb_typeof(p_sessions) <> 'array' then
    raise exception 'Expected an array of timetable entries' using errcode = '22023';
  end if;
  if jsonb_array_length(p_sessions) not between 1 and 100 then
    raise exception 'Publish between 1 and 100 entries at a time' using errcode = '22023';
  end if;

  insert into public.class_sessions (
    class_id, subject_id, kind, batch, state, starts_at, ends_at, room,
    created_by, updated_by, timetable_slot_key
  )
  select p_class_id, slot.subject_id, slot.kind, slot.batch, 'scheduled',
    slot.starts_at, slot.ends_at, slot.room, actor, actor,
    to_char(slot.starts_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI')
      || ':' || slot.kind::text || ':' || slot.batch::text
  from jsonb_to_recordset(p_sessions) as slot(
    subject_id uuid, kind public.session_kind, batch public.session_batch,
    starts_at timestamptz, ends_at timestamptz, room text
  )
  where not exists (
    select 1 from public.class_sessions existing
    where existing.class_id = p_class_id
      and existing.kind = slot.kind
      and (existing.batch = slot.batch or existing.batch = 'all')
      and (
        existing.starts_at = slot.starts_at
        or (existing.class_number is not null and existing.subject_id = slot.subject_id
          and (existing.starts_at at time zone 'Asia/Kolkata')::date
            = (slot.starts_at at time zone 'Asia/Kolkata')::date)
      )
  )
  on conflict (class_id, timetable_slot_key) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.publish_timetable_sessions(uuid, jsonb) from public, anon;
grant execute on function public.publish_timetable_sessions(uuid, jsonb) to authenticated;

commit;
