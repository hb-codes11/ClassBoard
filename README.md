# 🎓 ClassBoard

<p align="center">
  <strong>A private class portal for Medi-Caps University sections INTEL-1 and INTEL-2</strong><br>
  Study resources, class updates, schedules, and attendance planning — all in one place.
</p>

<p align="center">
  <a href="https://classboard-omega.vercel.app"><img alt="Live on Vercel" src="https://img.shields.io/badge/Live%20site-Classboard-2563EB?style=for-the-badge&logo=vercel&logoColor=white"></a>
  <img alt="Supabase" src="https://img.shields.io/badge/Powered%20by-Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white">
  <img alt="Built for Medi-Caps INTEL-1 and INTEL-2" src="https://img.shields.io/badge/For-Medi--Caps%20INTEL--1%20%7C%20INTEL--2-7C3AED?style=for-the-badge">
</p>

ClassBoard gives students and their class representatives one shared place to find class materials and stay up to date. College accounts choose an assigned section at sign-in, while each section's CRs and admins manage their own class information.

---

## ✨ What you can do

| 📚 Learn | 📣 Stay informed | 🗓️ Plan |
| --- | --- | --- |
| Browse notes, syllabus, lab manuals, and exam resources | Read class updates and reminders, with in-app notification slides | View the class timetable and preview the timetable image |
| Preview shared files before downloading | Check the shared class log | Plan lecture and lab attendance separately |

### 📖 Study resources
- Share class notes, syllabus, lab manuals, and exam materials.
- Store PDFs, Word documents, and PowerPoint files in Supabase Storage.
- Preview supported files in the portal before choosing to download them.

### 🔔 Class updates and schedule
- Publish class updates, reminders, timetable entries, and class-log records.
- See new activity through unread counts and responsive in-app notification slides.
- Open the class timetable preview from the attendance page.

### 📊 Attendance planner
- Plan lecture attendance separately from lab attendance; Soft Skills has no lab planner.
- Keep shared classes-held totals consistent for the class. CRs and admins maintain those totals.
- Let each student update their own attended-class count and upcoming attendance plan.
- Send private attendance concerns to CRs and admins for follow-up.

> The attendance planner is for personal planning and class coordination; it does not change official college attendance records.

### 🛡️ Roles and access
- Every active class account has Student access.
- Admins manage account roles and shared content.
- CRs publish class updates and manage class information, including class-log entries.
- Supabase Row Level Security (RLS) enforces access in the database.

---

## 🧰 Built with

![HTML](https://img.shields.io/badge/HTML-111827?style=flat-square&logo=html5&logoColor=E34F26)
![CSS](https://img.shields.io/badge/CSS-111827?style=flat-square&logo=css3&logoColor=1572B6)
![JavaScript](https://img.shields.io/badge/JavaScript-111827?style=flat-square&logo=javascript&logoColor=F7DF1E)
![Supabase](https://img.shields.io/badge/Supabase-111827?style=flat-square&logo=supabase&logoColor=3FCF8E)
![Vercel](https://img.shields.io/badge/Vercel-111827?style=flat-square&logo=vercel&logoColor=white)

Classboard is a static frontend backed by Supabase Auth, Postgres, Storage, Row Level Security, and Edge Functions.

## 📁 Project layout

```text
classboard/             Static frontend and academic calendar PDF
supabase/
  functions/            Supabase Edge Functions
  migrations/           Database schema, RLS policies, and follow-up changes
  README.md             Supabase setup and migration guide
```

## 🚀 Run locally

From the repository directory:

```sh
python3 -m http.server 4173 --directory classboard
```

Then open [http://localhost:4173](http://localhost:4173).

The frontend reads the Supabase project URL and publishable key from `classboard/supabase-config.js`. A publishable key is meant for browser use. **Never put a Supabase service-role or secret key in frontend code.** Keep RLS enabled.

## ☁️ Deploy on Vercel

1. Import this repository into Vercel.
2. Set **Root Directory** to `classboard`.
3. Deploy as a static site; no build command or output directory is needed.
4. Add the deployed domain to Supabase Auth’s site URL and redirect URL allowlist.
5. Add the matching OAuth redirect URL in Google Cloud Console.

## 🗄️ Supabase setup

Follow [`supabase/README.md`](supabase/README.md) for project setup, Auth configuration, role setup, and migrations. Apply the migrations in order to the Supabase project used by the deployed site before using the features they enable.

Keep the Supabase service-role key private. The browser should only receive the project URL and publishable key.

---

<p align="center">
  <strong>Made for the INTEL-1 and INTEL-2 class communities 💙</strong><br>
  <sub>Built to keep class resources, updates, schedules, and coordination together.</sub>
</p>
