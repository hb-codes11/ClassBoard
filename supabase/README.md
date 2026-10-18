# Classboard Supabase setup

This folder contains the database schema and follow-up migrations for the INTEL-1 Classboard portal.

## Decisions encoded here

- A class membership stores one role. Every active class account has Student access by default; CR and Admin are additional permissions stored in separate membership rows.
- RLS protects all app tables. The frontend must never be the authority for a user's class, roll number, or role.
- Roll number is stored only on a Student membership. A1/A2 are derived from it (1–32 = A1, 33–66 = A2); timetable records use `all`, `A1`, or `A2`.
- Attendance planner values are not in this schema. The class log records sessions, not student attendance.
- PDFs live in a private `class-resources` bucket, with a maximum 10 MB PDF per object.
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
10. Apply `migrations/010_lock_class_log_edits.sql` so saved class sessions cannot be edited after they are posted. CRs and admins can still delete an incorrect entry and add a corrected one.
11. Apply `migrations/011_remove_class_member_access.sql` to enable the admin-only Remove access button in Admin workspace. It deactivates a person's Classboard memberships without deleting their Google/Supabase Auth account or class history, and prevents removing the last admin.
12. In Supabase Auth, create the owner accounts. Then, from the SQL Editor, find their Auth user UUIDs and grant the initial elevated roles. Student access is already assigned automatically:

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

13. Confirm the two owners can sign in and that each new college account appears as a Student. Assign CR/Admin access from Admin workspace; only a CR can publish class updates, class logs, timetables, and reminders. Admins manage roles, review attendance concerns, and can upload or remove shared content.

## Before sharing with the class

- Apply all migrations through `011_remove_class_member_access.sql` to the Supabase project used by the deployed site.
- Keep the Supabase service-role key out of frontend code and Vercel's public variables. The browser only needs the project URL and publishable key.
- Keep the college email allowlist, Google OAuth redirect URLs, and Supabase site/redirect URLs pointed at the deployed Classboard domain.
- Review college approval, account onboarding, data retention, backups, and who should receive CR/Admin permissions before sharing the sign-in link broadly.

The SQL migrations must be applied in the Supabase project before the matching role behavior is active in production.
