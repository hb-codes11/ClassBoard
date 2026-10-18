-- Allow assigned class admins to manage shared class content alongside CRs.
-- CR policies remain in place; these additive policies extend the same actions to admins.

create policy sessions_admin_delete on public.class_sessions for delete to authenticated
  using (public.has_class_role(class_id, 'admin'));

create policy resources_admin_insert on public.resources for insert to authenticated
  with check (public.has_class_role(class_id, 'admin') and uploaded_by = (select auth.uid()));
create policy resources_admin_delete on public.resources for delete to authenticated
  using (public.has_class_role(class_id, 'admin'));

create policy updates_admin_delete on public.updates for delete to authenticated
  using (public.has_class_role(class_id, 'admin'));

create policy reminders_admin_delete on public.reminders for delete to authenticated
  using (public.has_class_role(class_id, 'admin'));

create policy class_resource_upload_admin on storage.objects for insert to authenticated
  with check (
    bucket_id = 'class-resources'
    and public.has_class_role((storage.foldername(name))[1]::uuid, 'admin')
  );
create policy class_resource_delete_admin on storage.objects for delete to authenticated
  using (
    bucket_id = 'class-resources'
    and public.has_class_role((storage.foldername(name))[1]::uuid, 'admin')
  );
