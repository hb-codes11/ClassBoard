# ClassBoard Supabase setup

This folder contains the database schema and follow-up migrations for the ClassBoard portal, with separate class records for INTEL-1 and INTEL-2.

## Decisions encoded here

- A class membership stores one role. Student, CR, and Admin memberships are granted separately for each class; new accounts are automatically enrolled only in INTEL-1 until a class admin grants access elsewhere.
- RLS protects all app tables. The frontend must never be the authority for a user's class, roll number, or role.
- INTEL-1 and INTEL-2 are separate rows in `classes`. Content, subjects, timetable entries, attendance, and permissions are scoped to the selected class ID.
- Roll number is stored only on a Student membership. Batch labels are section-specific: INTEL-1 uses A1/A2 and INTEL-2 uses B1/B2; in each section, rolls 1–32 are the first batch and 33–66 the second. Timetable records use `all` for lectures and the section's batch code for labs.
- Shared lecture and lab classes-held totals are maintained by CRs/admins. Each student can save only their own attended-class count; these planner figures do not change official college attendance.
- Class calendar overrides are shared by class. CRs/admins can edit a date, while every active class member can read the live schedule.
- PDFs, DOCX documents, and PPTX presentations live in a private `class-resources` bucket, with a maximum 10 MB per object.
- New college accounts and existing Medicaps auth accounts are enrolled as Students. Admins assign only the additional CR and Admin permissions from the portal. Account disabling is not available in the portal yet.

## Apply to a fresh Supabase project

1. Create the project and save its URL and publishable key. Do not put a service-role key in the frontend.
2. Apply `migrations/001_core_schema.sql` using the Supabase SQL Editor or `supabase db push` from a configured local project.
3. Apply `migrations/002_college_email_hook.sql` and configure it as the Supabase Before User Created hook. Apply `migrations/003_default_student_and_admin_access.sql` so new accounts receive Student access and admins can manage class roles.
4. Apply `migrations/004_student_onboarding_roll_and_batch.sql`. New students will be asked for their serial roll number and lab batch; the database checks that the batch matches the roll-number assignment rule.
5. Apply `migrations/005_expand_roll_numbers_to_66.sql` to update existing databases to the confirmed 1–32 = A1 and 33–66 = A2 rule.
6. Apply `migrations/006_admin_content_management.sql` so class admins can upload resources and both admins and CRs can delete shared notes, updates, reminders, and class-log entries.
7. Apply `migrations/007_persist_class_notifications.sql` to create durable per-member notifications when updates, reminders, resources, or class sessions are added.
8. Apply `migrations/008_reviewed_attendance_concerns.sql` to support reviewed and resolved attendance concerns.
9. Apply `migrations/009_student_access_is_default.sql` to enroll existing Medicaps auth accounts in INTEL-1, give every account Student access, and make Student access impossible to remove while assigning CR/Admin roles.
10. Apply `migrations/010_lock_class_log_edits.sql` to remove the original class-log edit policy.
11. Apply `migrations/011_remove_class_member_access.sql` to enable the admin-only Remove access button in Admin workspace. It deactivates a person's Classboard memberships without deleting their Google/Supabase Auth account or class history, and prevents removing the last admin.
12. Apply `migrations/012_cr_class_log_edit_access.sql` to allow CRs to correct saved class-log entries. Admin-only accounts cannot edit class-log details. CRs and admins can still delete an incorrect entry.
13. Apply `migrations/013_shared_attendance_planner.sql` to store shared classes-held totals and private per-student attended counts. Only CRs/admins can change the shared total; each student can change only their own attended count.
14. Apply `migrations/014_allow_office_resource_uploads.sql` to allow PDF, DOCX, and PPTX files in the private class-resources bucket.
15. Apply `migrations/015_restore_attendance_count_write_grants.sql` to restore the column-level write grants for shared attendance totals.
16. Apply `migrations/016_grant_attendance_upsert_access.sql` to allow PostgREST upserts for shared totals. Row-level policies still restrict writes to CRs and admins.
17. Apply `migrations/017_remove_reviewed_attendance_concerns.sql` to let CRs/admins remove referred or resolved attendance concerns. Replies are removed with the concern.
18. Apply `migrations/019_add_mst_pyq_resource_type.sql` to add the MST / PYQs resource type to the existing `resource_kind` enum.
19. Apply `migrations/020_grant_student_attendance_upsert_access.sql` to allow each Student to save their own attended-class count through PostgREST upsert. Row-level policies still restrict access to the account's own progress.
20. Apply `migrations/021_ignore_inactive_attendance_progress.sql` so deactivated accounts' old test attendance cannot block shared class totals. The guard still protects every active student's saved count.
21. Apply `migrations/022_allow_staff_to_correct_class_totals.sql` to let CRs/admins set the authoritative shared classes-held total without a student's saved planner count blocking the correction. Students still cannot save an attended count above the current shared total; if a total is lowered below an existing personal count, that student must correct their own count.
22. Apply `migrations/023_class_update_pdf_attachments.sql` to allow class updates to include private PDF attachments. CRs upload and publish the PDF with the update; active class members can preview it, and deleting the update removes its PDF.
23. Apply `migrations/027_add_class_update_pinning.sql` to add `is_pinned` support so CRs and admins can pin updates to the top of the Home preview for the whole class.
24. In Supabase Auth, create the owner accounts. Then, from the SQL Editor, find their Auth user UUIDs and grant the initial elevated roles. Student access is already assigned automatically:

```sql
-- Replace both UUID placeholders with the two Auth user IDs.
with target_class as (
  select id from public.classes where code = 'INTEL-1'
)
insert into public.class_memberships (user_id, class_id, role)
select 'ADMIN_USER_UUID'::uuid, id, 'admin'::public.class_role from target_class
union all
select 'FRIEND_USER_UUID'::uuid, id, 'admin'::public.class_role from target_class
union all
select 'FRIEND_USER_UUID'::uuid, id, 'cr'::public.class_role from target_class;
```

24. Confirm the two owners can sign in and that each new college account appears as a Student. Assign CR/Admin access from Admin workspace; only a CR can publish class updates, class logs, timetables, and reminders. Admins manage roles, review attendance concerns, and can upload or remove shared content.
25. Apply `migrations/025_shared_class_calendar.sql` to publish calendar edits class-wide with real-time updates. Existing browser-local calendar overrides are copied into the shared calendar on the first successful staff load.
26. Apply `migrations/026_add_intel2_section.sql` to create INTEL-2, copy the subject list, enable B1/B2 batch records, and update student batch setup for that section. The INTEL-2 weekly timetable is loaded from its own section-specific defaults in the app. Dated class-log entries, calendar overrides, notes, updates, attendance records, and memberships remain separate by `class_id` and start empty.

## Start INTEL-2 access

After applying migration 026, create the first INTEL-2 admin membership in the SQL Editor. Replace the placeholder with the admin's Auth user UUID:

```sql
insert into public.class_memberships (user_id, class_id, role)
select 'INTEL2_ADMIN_USER_UUID'::uuid, id, role
from public.classes
cross join (values ('student'::public.class_role), ('admin'::public.class_role)) as roles(role)
where code = 'INTEL-2'
on conflict (user_id, class_id, role) do update set is_active = true;
```

That admin can then use INTEL-2 Admin Workspace to add other section accounts and assign their INTEL-2 roles. An account can have access to one section or both; each section's role is assigned independently.

## Before sharing with the class

- Apply all migrations through `026_add_intel2_section.sql` to the Supabase project used by the deployed site.
- Keep the Supabase service-role key out of frontend code and Vercel's public variables. The browser only needs the project URL and publishable key.
- Keep the college email allowlist, Google OAuth redirect URLs, and Supabase site/redirect URLs pointed at the deployed Classboard domain.
- Review college approval, account onboarding, data retention, backups, and who should receive CR/Admin permissions before sharing the sign-in link broadly.

The SQL migrations must be applied in the Supabase project before the matching role behavior is active in production.
