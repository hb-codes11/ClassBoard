process.on('uncaughtException', (e) => { console.error(e.code, e.message, e.detail || ''); process.exit(1); });
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const migration = async (name) => db.exec(await readFile(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8'));
await db.exec(`
create role anon; create role authenticated;
create schema auth;
create table auth.users(id uuid primary key default gen_random_uuid(), email text unique, email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}');
create type public.class_role as enum ('student','cr','admin');
create table public.classes(id uuid primary key default gen_random_uuid(), code text unique, name text, is_active boolean default true);
create table public.profiles(user_id uuid primary key references auth.users, display_name text default '');
create table public.class_member_contacts(user_id uuid references auth.users, class_id uuid references public.classes, email text, primary key(user_id,class_id));
create table public.class_memberships(user_id uuid references auth.users, class_id uuid references public.classes, role public.class_role, roll_number smallint, is_active boolean default true, created_at timestamptz default now(), primary key(user_id,class_id,role));
create unique index class_memberships_unique_student_roll on public.class_memberships(class_id,roll_number) where role='student' and is_active;
create table public.classboard_founders(user_id uuid primary key references auth.users);
create table public.ibm1_student_roster(roll_number smallint primary key, email text unique, student_name text);
insert into public.classes(code,name) values ('INTEL-1','Intel A'),('INTEL-2','Intel B'),('IBM-1','IBM A');
insert into auth.users(email,email_confirmed_at) values
 ('en25cs3070104@medicaps.ac.in',now()), -- desired roll 44; occupied
 ('en25cs3070101@medicaps.ac.in',now()), -- desired roll 42; occupied
 ('en25cs3090230@medicaps.ac.in',now()), -- desired roll 42; occupied
 ('en25cs3070003@medicaps.ac.in',now()), -- free roll 1
 ('en25cs3070007@medicaps.ac.in',null), -- unconfirmed must not gain access
 ('en25cs3070008@medicaps.ac.in',now()), -- founder remains untouched
 ('occupant@medicaps.ac.in',now());
insert into public.classboard_founders select id from auth.users where email='en25cs3070008@medicaps.ac.in';
insert into public.profiles select id, 'Existing name' from auth.users;
insert into public.class_memberships select u.id,c.id,'student',42,true from auth.users u cross join public.classes c where email='occupant@medicaps.ac.in' and c.code in ('INTEL-2','IBM-1');
insert into public.class_memberships select u.id,c.id,'student',44,true from auth.users u cross join public.classes c where email='en25cs3070101@medicaps.ac.in' and c.code='INTEL-2';
insert into public.class_memberships select u.id,c.id,'student',null,true from auth.users u cross join public.classes c where email='en25cs3070003@medicaps.ac.in' and c.code='INTEL-1';
insert into public.class_memberships select u.id,c.id,r.role::public.class_role,null,true from auth.users u cross join public.classes c cross join (values ('cr'),('admin')) r(role) where email='en25cs3070003@medicaps.ac.in' and c.code='INTEL-1';
`);
await migration('044_lock_intel2_and_ibm1_rosters.sql');
const rows = async (sql) => (await db.query(sql)).rows;
assert.equal((await rows(`select count(*)::int n from class_memberships where roll_number=42 and is_active`))[0].n, 2, 'occupied rolls preserved');
assert.equal((await rows(`select count(*)::int n from class_memberships m join auth.users u on u.id=m.user_id where u.email='en25cs3070007@medicaps.ac.in'`))[0].n, 0, 'unconfirmed account not enrolled');
assert.equal((await rows(`select count(*)::int n from class_memberships m join auth.users u on u.id=m.user_id join classes c on c.id=m.class_id where u.email='en25cs3070003@medicaps.ac.in' and c.code='INTEL-1' and m.role in ('cr','admin') and m.is_active`))[0].n, 2, 'staff access preserved');
assert.equal((await rows(`select count(*)::int n from class_memberships m join auth.users u on u.id=m.user_id join classes c on c.id=m.class_id where u.email='en25cs3070003@medicaps.ac.in' and c.code='INTEL-2' and roll_number=1 and m.is_active`))[0].n, 1, 'non-conflicting student enrolled');
assert.equal((await rows(`select count(*)::int n from class_memberships m join classboard_founders f on f.user_id=m.user_id`))[0].n, 0, 'founder untouched');
const before = await rows('select * from class_memberships order by user_id,class_id,role');
await migration('044_lock_intel2_and_ibm1_rosters.sql');
assert.deepEqual(await rows('select * from class_memberships order by user_id,class_id,role'), before, 'rerun does not change memberships');
const conflicts = await rows(await readFile(new URL('../supabase/diagnostics/roster-roll-conflicts.sql', import.meta.url), 'utf8'));
assert.equal(conflicts.length, 3, 'all skipped conflicts are visible for founder review');
await migration('045_verify_student_section_choice.sql');
await migration('046_lock_intel1_roster.sql');
const check = await rows(`select verify_student_section_choice('en25cs3070003@medicaps.ac.in','IBM-1') result`);
assert.equal(check[0].result.allowed, false);
assert.equal(check[0].result.assigned_section_code, 'INTEL-2');
await db.exec(await readFile(new URL('../supabase/manual/044_to_046_all_in_one_run.sql', import.meta.url), 'utf8'));
assert.deepEqual(await rows('select * from class_memberships order by user_id,class_id,role'), before, 'manual helper preserves the same memberships');
console.log('PASS: roll conflicts, existing memberships, staff/founder preservation, confirmed-email guard, rerun, and section validation');
await db.close();
