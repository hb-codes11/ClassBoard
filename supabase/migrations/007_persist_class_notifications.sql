-- Create one durable notification per active class member when class content is published.
create or replace function public.notify_active_class_members()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_kind text := tg_argv[0];
  source_row jsonb := to_jsonb(new);
  actor_id uuid;
begin
  actor_id := coalesce(
    nullif(source_row ->> 'created_by', '')::uuid,
    nullif(source_row ->> 'uploaded_by', '')::uuid
  );

  insert into public.notifications (class_id, recipient_id, source_type, source_id)
  select new.class_id, members.user_id, source_kind, new.id
  from (
    select distinct cm.user_id
    from public.class_memberships cm
    where cm.class_id = new.class_id
      and cm.is_active
      and (actor_id is null or cm.user_id <> actor_id)
  ) members;

  return new;
end;
$$;

revoke all on function public.notify_active_class_members() from public, anon;
grant execute on function public.notify_active_class_members() to authenticated;

create trigger notifications_for_updates
  after insert on public.updates
  for each row when (new.published_at is not null)
  execute function public.notify_active_class_members('update');

create trigger notifications_for_reminders
  after insert on public.reminders
  for each row when (new.is_active)
  execute function public.notify_active_class_members('reminder');

create trigger notifications_for_resources
  after insert on public.resources
  for each row when (new.published_at is not null and new.deleted_at is null)
  execute function public.notify_active_class_members('resource');

create trigger notifications_for_class_sessions
  after insert on public.class_sessions
  for each row
  execute function public.notify_active_class_members('class_session');
