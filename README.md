# Classboard

**A private class portal for Medi-Caps University’s INTEL-1, with study resources, class updates, scheduling, and attendance concern follow-up, powered by Supabase.**

Classboard gives students and their class representatives one place to find class materials and updates. Students sign in with their college account, while class admins and CRs manage class information through role-based access.

## Features

- College-email sign-in with Google and email/password.
- Student onboarding with roll number and lab batch assignment.
- Class notes, syllabi, and lab manuals stored in Supabase Storage.
- Class updates, reminders, and a shared class log.
- Separate lecture and lab attendance planning (excluding Soft Skills labs), with shared classes-held totals managed by CRs/admins and private attended counts for each student; only CRs can edit saved class-log entries.
- Private attendance concern messages between students, CRs, and admins.
- Database access protected by Supabase Row Level Security (RLS).

## Project layout

- `classboard/` — static frontend and the academic calendar PDF.
- `supabase/migrations/` — database schema, RLS policies, and follow-up migrations.
- `supabase/functions/` — Supabase Edge Functions.

## Run locally

From this repository directory:

```sh
python3 -m http.server 4173 --directory classboard
```

Open `http://localhost:4173`. The app uses the Supabase URL and publishable key in `classboard/supabase-config.js`. The publishable key is intended for browser use; **never put a Supabase service-role or secret key in the frontend**. Keep RLS enabled and apply the migrations before connecting accounts.

## Deploy on Vercel

Import this repository into Vercel and set the project **Root Directory** to `classboard`. It is a static site, so no build command or output directory is needed. After deployment, add the Vercel domain to the Supabase Auth site URL and redirect URL allowlist, and configure the matching Google OAuth redirect URLs.

## Database setup

See [`supabase/README.md`](supabase/README.md) for Supabase setup and migration guidance. Apply migrations in numeric order, including the latest migration, before using the matching frontend features.
