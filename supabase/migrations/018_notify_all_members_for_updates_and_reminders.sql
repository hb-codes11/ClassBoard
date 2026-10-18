begin;

create or replace function public.notify_active_class_members()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_kind text := tg_argv[0];
begin
  insert into public.notifications (class_id, recipient_id, source_type, source_id)
  select new.class_id, members.user_id, source_kind, new.id
  from (
    select distinct cm.user_id
    from public.class_memberships cm
    where cm.class_id = new.class_id
      and cm.is_active
  ) members;

  return new;
end;
$$;

revoke all on function public.notify_active_class_members() from public, anon;
grant execute on function public.notify_active_class_members() to authenticated;

drop trigger if exists notifications_for_updates on public.updates;
create trigger notifications_for_updates
  after insert on public.updates
  for each row when (new.published_at is not null)
  execute function public.notify_active_class_members('update');

drop trigger if exists notifications_for_reminders on public.reminders;
create trigger notifications_for_reminders
  after insert on public.reminders
  for each row when (new.is_active)
  execute function public.notify_active_class_members('reminder');

drop trigger if exists notifications_for_resources on public.resources;
create trigger notifications_for_resources
  after insert on public.resources
  for each row when (new.published_at is not null and new.deleted_at is null)
  execute function public.notify_active_class_members('resource');

drop trigger if exists notifications_for_class_sessions on public.class_sessions;
create trigger notifications_for_class_sessions
  after insert on public.class_sessions
  for each row
  execute function public.notify_active_class_members('class_session');

insert into public.notifications (class_id, recipient_id, source_type, source_id)
select content.class_id, members.user_id, content.source_type, content.id
from (
  select u.id, u.class_id, 'update'::text as source_type
  from public.updates u
  where u.published_at is not null
  union all
  select r.id, r.class_id, 'reminder'::text as source_type
  from public.reminders r
  where r.is_active and r.due_at >= now()
) content
join public.class_memberships members
  on members.class_id = content.class_id and members.is_active
where not exists (
  select 1
  from public.notifications existing
  where existing.class_id = content.class_id
    and existing.recipient_id = members.user_id
    and existing.source_type = content.source_type
    and existing.source_id = content.id
);

commit;
