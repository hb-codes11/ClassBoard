-- Allow class updates to carry a private PDF attachment.
alter table public.updates
  add column if not exists attachment_path text,
  add column if not exists attachment_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.updates'::regclass
      and conname = 'updates_attachment_pair_check'
  ) then
    alter table public.updates
      add constraint updates_attachment_pair_check
      check ((attachment_path is null) = (attachment_name is null));
  end if;
end;
$$;

-- Allow active class members to read update PDFs through signed URLs.
create or replace function public.can_read_resource_object(object_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.resources r
    where r.storage_path = object_name and r.published_at is not null and r.deleted_at is null
      and public.is_active_class_member(r.class_id)
  ) or exists (
    select 1 from public.updates u
    where u.attachment_path = object_name and u.published_at is not null
      and (u.expires_at is null or u.expires_at > now())
      and public.is_active_class_member(u.class_id)
  );
$$;

revoke all on function public.can_read_resource_object(text) from public;
grant execute on function public.can_read_resource_object(text) to authenticated;
