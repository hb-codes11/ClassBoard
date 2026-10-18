# Classboard Supabase starter

This folder contains the first database migration for the Intel 1 pilot.

## Decisions encoded here

- A class membership stores one role. A person with multiple roles gets multiple membership rows. That supports the project owners' setup: one Admin-only user and one user with both Admin and CR.
- RLS protects all app tables. The frontend must never be the authority for a user's class, roll number, or role.
- Roll number is stored only on a Student membership. A1/A2 are derived from it (1–32 = A1, 33–66 = A2); timetable records use `all`, `A1`, or `A2`.
- Attendance planner values are not in this schema. The class log records sessions, not student attendance.
- PDFs live in a private `class-resources` bucket, with a maximum 10 MB PDF per object.
- The initial Admin accounts must be provisioned manually. After that, `admin-membership` can invite accounts and set their class roles; disabling accounts is a follow-up action, not yet implemented.

## Apply to a fresh Supabase project

1. Create the project and save its URL and publishable key. Do not put a service-role key in the frontend.
2. Apply `migrations/001_core_schema.sql` using the Supabase SQL Editor or `supabase db push` from a configured local project.
3. Apply `migrations/002_college_email_hook.sql` and configure it as the Supabase Before User Created hook. Apply `migrations/003_default_student_and_admin_access.sql` so new accounts receive Student access and admins can manage class roles.
4. Apply `migrations/004_student_onboarding_roll_and_batch.sql`. New students will be asked for their serial roll number and lab batch; the database checks that the batch matches the roll-number assignment rule.
5. Apply `migrations/005_expand_roll_numbers_to_66.sql` to update existing databases to the confirmed 1–32 = A1 and 33–66 = A2 rule.
6. Apply `migrations/006_admin_content_management.sql` so class admins can upload resources and both admins and CRs can delete shared notes, updates, reminders, and class-log entries.
7. Apply `migrations/007_persist_class_notifications.sql` to create durable per-member notifications when updates, reminders, resources, or class sessions are added.
8. In Supabase Auth, create/invite the two owner accounts. Then, from the SQL Editor, find their Auth user UUIDs and insert the initial roles:

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

9. Before connecting real student accounts or data, review college approval, account onboarding, data retention, and backups.

## Next implementation steps

1. Configure and deploy the `admin-membership` Edge Function. Set `ALLOWED_ORIGIN` to the exact Classboard origin and `INVITE_REDIRECT_URL` to an Auth-allowlisted callback URL. Supabase provides the project URL and service secrets to Edge Functions; never copy the service-role key to the frontend.
2. Use the function to invite students and set multiple class roles. The friend can receive both `admin` and `cr` roles; don't model this as a single selected role.
3. Connect Supabase Auth to the static frontend and replace its demo role switcher with membership-based routing.
4. Connect read pages, CR write forms, private storage downloads, and durable notifications; the static Classboard page currently has these notification flows connected to Supabase.
5. Add a reviewed account-disable action, then verify RLS with separate Student, CR-only, Admin-only, and Admin+CR accounts before using real class data.

This migration is a starter artifact; it has not been applied to a live Supabase project because no project credentials or configured Supabase CLI are present in this workspace.
