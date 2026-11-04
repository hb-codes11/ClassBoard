# Private Study Plan

Study Plan is a dedicated Workspace page for every signed-in active class member, including CRs and admins. It does not depend on the selected workspace role. Each account's INTEL-1 and INTEL-2 plans are separate.

## Rollout

1. Apply `supabase/migrations/028_private_study_plan.sql` in the Supabase SQL editor, after migrations 001–027, before deploying the frontend. The migration runs in a transaction. If it fails, fix the reported error before retrying. It is a new migration, not a replacement for any attendance migration.
2. Deploy the matching `classboard/` directory. This remains a static website; no production build or new environment variables are required.
3. Refresh the deployed website. Open **Study Plan** in the desktop sidebar or **More → Study Plan** on mobile.
4. Smoke-test with two disposable accounts in the deployed environment: create a task, link a published resource, save a goal, finish a focus session, refresh, then check the other account cannot see the first account's plan. Check both sections with an account that belongs to both.

No live database migrations or production writes were run during implementation. Apply the migration before using the live feature. A service-role key must never be used by the browser; the tests do not require one.

## Student experience

- **Today:** overdue/today/upcoming/completed tasks, optional subject filter, next exam from the current Academics page, study timer, weekly progress.
- **Subjects:** the selected class's active subjects, published resource links, weekly minute goals, pending task counts, and relevant MST date.
- **Insights:** completed study minutes this week, completion rate for tasks planned this week, daily minutes, recent sessions, and study streak.
- Task dates use the selected class's timezone (currently Asia/Kolkata). Manual entries explicitly use the user's local time, then convert to UTC for storage.
- Completed sessions contribute to the date they started in class time. Streaks include today or continue through yesterday. Partial minutes are retained as seconds; displayed minute totals are rounded down.
- The focus clock counts down toward 25 minutes, then records elapsed time until the user finishes, up to 24 hours. It never sends an alert. Paused time is excluded. Manual sessions accept 1–1440 minutes and cannot end in the future.
- Historical session subjects and task links can be edited; server-recorded timer duration cannot be overwritten from the browser.
- Deleting a task retains its study sessions and clears their task link. Deleting an existing class resource clears the task's resource link.

## Privacy and timer integrity

`study_tasks`, `study_sessions`, and `study_subject_goals` each require the matching `auth.uid()` and active class membership. Staff have no policy that reads another member's records. The normal privileged Supabase database/service role still has administrative access, as it does for other application data.

Subject references are class-scoped foreign keys. Session-to-task references include owner and class. Task-to-resource validation accepts only published, non-deleted files in the same class and matching subject. A linked session inherits its task's subject, and conflicting subjects are rejected.

The `study_timer` RPC uses the authenticated identity, checks active membership, locks the user's class timer, and calculates elapsed time on the database server. A partial unique index enforces one running/paused timer per user/class. Start returns an existing timer rather than creating a duplicate. Later actions must match its session ID. Direct timer creation and clock editing by authenticated clients are denied.

The browser stores no private planner records in localStorage. It clears planner state and markup on account/class changes, discards stale responses, and refreshes visible data every 30 seconds and on focus. It does not replace active edit forms during polling. All private queries also filter by owner/class as defense in depth; RLS is authoritative.

The planner writes only to its three private tables and timer RPC. It creates no notification rows, push/browser notifications, class updates, timetable edits, attendance changes, or dashboard activity. Save/error feedback stays inside Study Plan.

## Development checks

```sh
npm ci
npm run typecheck
npm test
```

The test suite uses PGlite (embedded PostgreSQL) with disposable auth/membership fixtures to execute the actual migration and exercise RLS, ownership, membership revocation, class isolation, cross-class references, timer lifecycle and grants. It also tests grouping, calendar boundaries, weekly calculations, streaks, pagination and scoped client mutations. It does not replace a production Supabase smoke test.

To inspect the actual UI without touching a live account:

```sh
node tests/preview-server.mjs
```

Open `http://127.0.0.1:4186/preview`. This test-only server serves the real HTML/CSS/module with a disposable Supabase double. Test data stays in that tab's sessionStorage. It is outside `classboard/` and is not included in the production deployment. It does not validate Supabase networking or signed PDF URLs; resource buttons use the production preview/download attributes and event flow, which are unchanged.

For the real app use `python3 -m http.server 4173 --directory classboard` and sign in normally after applying migration 028.
