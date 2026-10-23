-- Store CR/admin calendar overrides once per class and date so every member
-- sees the same edited schedule.
begin;

create table public.class_calendar_overrides (
  class_id uuid not null references public.classes(id) on delete cascade,
  calendar_date date not null,
  classes jsonb not null default '[]'::jsonb check (jsonb_typeof(classes) = 'array'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (class_id, calendar_date)
);

alter table public.class_calendar_overrides enable row level security;

create policy class_calendar_overrides_read_member on public.class_calendar_overrides for select to authenticated
  using (public.is_active_class_member(class_id));
create policy class_calendar_overrides_staff_insert on public.class_calendar_overrides for insert to authenticated
  with check (
    (public.has_class_role(class_id, 'cr') or public.has_class_role(class_id, 'admin'))
    and updated_by = (select auth.uid())
  );
create policy class_calendar_overrides_staff_update on public.class_calendar_overrides for update to authenticated
  using (public.has_class_role(class_id, 'cr') or public.has_class_role(class_id, 'admin'))
  with check (
    (public.has_class_role(class_id, 'cr') or public.has_class_role(class_id, 'admin'))
    and updated_by = (select auth.uid())
  );
create policy class_calendar_overrides_staff_delete on public.class_calendar_overrides for delete to authenticated
  using (public.has_class_role(class_id, 'cr') or public.has_class_role(class_id, 'admin'));

create trigger class_calendar_overrides_set_updated_at before update on public.class_calendar_overrides
  for each row execute function public.set_updated_at();

revoke all on public.class_calendar_overrides from anon, authenticated;
grant select, insert, update, delete on public.class_calendar_overrides to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'class_calendar_overrides'
    ) then
    alter publication supabase_realtime add table public.class_calendar_overrides;
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
