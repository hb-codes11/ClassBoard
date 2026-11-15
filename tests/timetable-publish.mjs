import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
process.on('uncaughtException', (e) => { console.error(e.code, e.message); process.exit(1); });
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
create type class_role as enum ('student','cr','admin');
create type session_kind as enum ('lecture','lab');
create type session_batch as enum ('all','A1','A2');
create table class_memberships(user_id uuid, class_id uuid, role class_role, is_active boolean default true);
create function has_class_role(target_class uuid, wanted_role class_role) returns boolean language sql stable as $$
select exists(select 1 from public.class_memberships where user_id=auth.uid() and class_id=target_class and is_active and (role=wanted_role or (wanted_role='cr' and role='admin')))
$$;
create table class_sessions(id uuid default gen_random_uuid(), class_id uuid, subject_id uuid, class_number int, kind session_kind, batch session_batch, state text, starts_at timestamptz, ends_at timestamptz, room text, created_by uuid, updated_by uuid);
create function notify_active_class_members() returns trigger language plpgsql as $$ begin return new; end $$;
insert into class_memberships values
 ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','cr',true),
 ('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','admin',true),
 ('00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','student',true);
`);
await db.exec(await readFile(new URL('../supabase/migrations/047_generate_timetable_class_log.sql',import.meta.url),'utf8'));
const classId='10000000-0000-0000-0000-000000000001';
const slots=[{subject_id:'20000000-0000-0000-0000-000000000001',kind:'lecture',batch:'all',starts_at:'2026-11-23T08:30:00+05:30',ends_at:'2026-11-23T09:20:00+05:30',room:'V306'}];
const asUser=async (id)=>db.query("select set_config('test.user',$1,false)",[id]);
const publish=async (rows=slots,section=classId)=>(await db.query('select publish_timetable_sessions($1,$2::jsonb) n',[section,JSON.stringify(rows)])).rows[0].n;
await asUser('00000000-0000-0000-0000-000000000001');
assert.equal(await publish(),1);
assert.equal(await publish(),0,'repeat skips existing');
await asUser('00000000-0000-0000-0000-000000000002');
assert.equal(await publish(slots.map(s=>({...s,kind:'lab',batch:'A1'}))),1,'section admin can publish');
assert.equal(await publish(slots.map(s=>({...s,kind:'lab',batch:'A2'}))),1,'batches remain separate');
await assert.rejects(publish(slots,'10000000-0000-0000-0000-000000000002'), e=>e.code==='42501');
await asUser('00000000-0000-0000-0000-000000000003');
await assert.rejects(publish(),e=>e.code==='42501');
await asUser('');
await assert.rejects(publish(),e=>e.code==='42501');
await asUser('00000000-0000-0000-0000-000000000001');
await assert.rejects(publish([]),e=>e.code==='22023');
await db.exec(`insert into class_sessions(class_id,subject_id,class_number,kind,batch,state,starts_at) values ('${classId}','${slots[0].subject_id}',1,'lecture','all','held','2026-11-24T08:30:00+05:30')`);
assert.equal(await publish(slots.map(s=>({...s,starts_at:'2026-11-24T09:20:00+05:30',ends_at:'2026-11-24T10:10:00+05:30'}))),0,'existing numbered log on same date preserved');
console.log('PASS: timetable duplicate skipping, lab batches, CR/admin access, student/anonymous/cross-section denial, input bounds and existing manual logs');
await db.close();
