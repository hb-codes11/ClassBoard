import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { dateKey, addDays, weekStart, groupTasks, elapsedSeconds, summarize, StudyPlanClient } from '../classboard/study-plan-core.js';
const A='00000000-0000-0000-0000-000000000001',B='00000000-0000-0000-0000-000000000002',CR='00000000-0000-0000-0000-000000000003',ADMIN='00000000-0000-0000-0000-000000000004';
const C1='10000000-0000-0000-0000-000000000001', C2='10000000-0000-0000-0000-000000000002';
const S1='20000000-0000-0000-0000-000000000001', S2='20000000-0000-0000-0000-000000000002';
const R1='30000000-0000-0000-0000-000000000001', R2='30000000-0000-0000-0000-000000000002';
const task = (id,planned_date,extra={}) => ({id,title:id,planned_date,due_date:null,priority:'normal',completed_at:null,created_at:'2026-11-01',...extra});
test('class dates, Monday weeks, grouping, DST-independent date arithmetic',()=>{
 assert.equal(dateKey(new Date('2026-11-03T20:00:00Z')),'2026-11-04');
 assert.equal(weekStart('2026-11-08'),'2026-11-02'); assert.equal(addDays('2026-12-31',1),'2027-01-01');
 const groups=groupTasks([task('past','2026-11-03'),task('due','2026-11-08',{due_date:'2026-11-03'}),task('now','2026-11-04'),task('future','2026-11-05'),task('done','2026-11-02',{completed_at:'2026-11-03'})],'2026-11-04');
 assert.deepEqual(Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.map(t=>t.id)])),{overdue:['past','due'],today:['now'],upcoming:['future'],completed:['done']});
});
test('timer resumes from timestamp and excludes paused time',()=>{
 const timer={status:'running',resumed_at:'2026-11-04T10:00:00Z',duration_seconds:50};
 assert.equal(elapsedSeconds(timer,Date.parse('2026-11-04T10:02:00Z')),170);
 assert.equal(elapsedSeconds({...timer,status:'paused'},Date.parse('2026-11-04T11:00:00Z')),50);
});
test('weekly completion, private focus minutes and streak use completed sessions only',()=>{
 const sessions=[{started_at:'2026-11-03T10:00:00Z',duration_seconds:1200,status:'completed',subject_id:S1},{started_at:'2026-11-04T10:00:00Z',duration_seconds:1800,status:'completed',subject_id:S1},{started_at:'2026-11-04T10:00:00Z',duration_seconds:400,status:'paused',subject_id:S1}];
 const sum=summarize([task('one','2026-11-04',{completed_at:'2026-11-04'}),task('two','2026-11-05')],sessions,'2026-11-04');
 assert.equal(sum.minutes,50); assert.equal(sum.completionRate,50);assert.equal(sum.streak,2);assert.equal(sum.subjectMinutes[S1],50);
 assert.equal(summarize([],sessions,'2026-11-05').streak,2); assert.equal(summarize([],sessions,'2026-11-06').streak,0);
});
test('database migration, RLS, associations and timer lifecycle',async t=>{
 const db=await PGlite.create();
 t.after(()=>db.close());
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
 create table classes(id uuid primary key,is_active boolean default true);
 create table class_memberships(user_id uuid,class_id uuid,role text,is_active boolean default true);
 create table subjects(id uuid primary key,class_id uuid,name text,unique(id,class_id));
 create table resources(id uuid primary key,class_id uuid,subject_id uuid,published_at timestamptz,deleted_at timestamptz);
 create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end;$$;
 create function public.is_active_class_member(target_class uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.class_memberships m join public.classes c on c.id=m.class_id and c.is_active where m.user_id=auth.uid() and m.class_id=target_class and m.is_active)$$;
 grant select on resources,subjects to authenticated;
 insert into auth.users values('${A}'),('${B}'),('${CR}'),('${ADMIN}');
 insert into classes(id) values('${C1}'),('${C2}');
 insert into class_memberships(user_id,class_id,role) values('${A}','${C1}','student'),('${A}','${C2}','student'),('${B}','${C1}','student'),('${CR}','${C1}','cr'),('${ADMIN}','${C1}','admin');
 insert into subjects values('${S1}','${C1}','Java'),('${S2}','${C2}','Java');
 insert into resources values('${R1}','${C1}','${S1}',now(),null),('${R2}','${C2}','${S2}',now(),null);`);
 await db.exec(await readFile(new URL('../supabase/migrations/028_private_study_plan.sql',import.meta.url),'utf8'));
 const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 const count=async table=>(await db.query(`select count(*)::int n from ${table}`)).rows[0].n;
 const insertTask=async(c=C1,s=S1,r=R1)=> (await db.query('insert into study_tasks(class_id,subject_id,resource_id,title,planned_date) values($1,$2,$3,$4,current_date) returning *',[c,s,r,'Revise Java'])).rows[0];
 await as(A); const own=await insertTask(); await insertTask(C2,S2,R2);
 await db.query('insert into study_subject_goals(class_id,subject_id,weekly_minutes) values($1,$2,60)',[C1,S1]);
 await db.query("insert into study_sessions(class_id,subject_id,task_id,source,status,started_at,ended_at,duration_seconds) values($1,$2,$3,'manual','completed',now()-interval '30 minutes',now(),1800)",[C1,S1,own.id]);
 await t.test('other students and staff cannot read/change personal data',async()=>{
  for(const user of [B,CR,ADMIN]){await as(user);for(const table of ['study_tasks','study_sessions','study_subject_goals']){assert.equal(await count(table),0);assert.equal((await db.query(`delete from ${table} returning id`)).rows.length,0);}
   await assert.rejects(db.query('insert into study_tasks(user_id,class_id,title,planned_date) values($1,$2,$3,current_date)',[A,C1,'Forged']),/row-level security/);
   assert.equal((await db.query('update study_tasks set title=$1 where id=$2 returning id',['Changed',own.id])).rows.length,0);
  }
  // Staff retain personal planner access.
  const staffTask=await insertTask();assert.equal(staffTask.user_id,ADMIN);await as(A);assert.equal(await count('study_tasks'),2);
 });
 await t.test('class isolation, inactive membership, cross-class and foreign-owner links',async()=>{
  assert.equal((await db.query('select * from study_tasks where class_id=$1',[C1])).rows.length,1);
  await assert.rejects(insertTask(C1,S2,null),/foreign key/);
  await assert.rejects(insertTask(C1,S1,R2),/Choose a published resource/);
  await as(B);
  await assert.rejects(db.query("insert into study_sessions(class_id,task_id,source,status,started_at,ended_at,duration_seconds) values($1,$2,'manual','completed',now()-interval '1 minute',now(),60)",[C1,own.id]),/foreign key/);
  await assert.rejects(insertTask(C2,S2,R2),/row-level security/);
  await db.exec('reset role');await db.query('update class_memberships set is_active=false where user_id=$1',[A]);await as(A);
  assert.equal(await count('study_tasks'),0); assert.equal(await count('study_sessions'),0);assert.equal(await count('study_subject_goals'),0);
  await assert.rejects(db.query("select (study_timer($1,'start')).*",[C1]),/Active class membership/);
  await db.exec('reset role');await db.query('update class_memberships set is_active=true where user_id=$1',[A]);await as(A);
 });
 await t.test('server timer start is idempotent, private and per-class',async()=>{
  const start=async(c=C1)=>(await db.query("select * from study_timer($1,'start',null,$2,$3)",[c,c===C1?S1:S2,c===C1?own.id:null])).rows[0];
  const first=await start();assert.equal((await start()).id,first.id); const second=await start(C2);assert.notEqual(first.id,second.id);
  await as(B);await assert.rejects(db.query("select * from study_timer($1,'finish',$2)",[C1,first.id]),/Timer changed/);
  await as(A);await assert.rejects(db.query("insert into study_sessions(class_id,source,status,resumed_at) values($1,'timer','running',now())",[C1]),/row-level security/);
  await assert.rejects(db.query('update study_sessions set duration_seconds=100000 where id=$1',[first.id]),/permission denied/);
  await db.exec('reset role');await db.query("update study_sessions set resumed_at=clock_timestamp()-interval '65 seconds' where id=$1",[first.id]);await as(A);
  const paused=(await db.query("select * from study_timer($1,'pause',$2)",[C1,first.id])).rows[0];assert.equal(paused.status,'paused');assert.ok(paused.duration_seconds>=65);
  const resumed=(await db.query("select * from study_timer($1,'resume',$2)",[C1,first.id])).rows[0];assert.equal(resumed.status,'running');assert.equal(resumed.duration_seconds,paused.duration_seconds);
  const finished=(await db.query("select * from study_timer($1,'finish',$2)",[C1,first.id])).rows[0];assert.equal(finished.status,'completed');assert.ok(finished.duration_seconds>=65);assert.equal(finished.resumed_at,null);
  await db.query("select * from study_timer($1,'discard',$2)",[C2,second.id]);assert.equal((await db.query("select * from study_sessions where status<>'completed'")).rows.length,0);
 });
 await t.test('deleting task preserves sessions; no shared content writes or triggers',async()=>{
  await db.query('delete from study_tasks where id=$1',[own.id]); const rows=(await db.query('select task_id from study_sessions')).rows;assert.ok(rows.length);assert.ok(rows.every(s=>s.task_id===null));
  const triggers=(await db.query("select event_object_table from information_schema.triggers where event_object_table like 'study_%'")).rows;assert.deepEqual([...new Set(triggers.map(t=>t.event_object_table))].sort(),['study_sessions','study_subject_goals','study_tasks']);
  await db.exec('reset role');assert.equal(await count('resources'),2);
 });
});
test('typed client captures class context and paginates beyond PostgREST row limits', async()=>{
 const calls=[]; const makeQuery=()=>{
  const q={select(){return q;},eq(k,v){calls.push([k,v]);return q;},order(){return q;},range(a,b){calls.push(['range',a,b]);return Promise.resolve({data:Array.from({length:a===0?500:2},(_,i)=>({id:a+i})),error:null});}};return q;
 };
 const context={userId:A,classId:C1,classCode:'INTEL-1',className:'A'};
 const client=new StudyPlanClient({from:table=>{assert.equal(table,'study_tasks');return makeQuery();}},context);
 context.classId=C2;
 const rows=await client.rows('study_tasks');assert.equal(rows.length,502);
 assert.ok(calls.filter(([k])=>k==='class_id').every(([,id])=>id===C1));assert.ok(calls.some(([k,v])=>k==='user_id'&&v===A));
});
test('private client mutations remain scoped and fail visibly on missing rows',async()=>{
 const calls=[];const q={update(p){calls.push(['payload',p]);return q;},eq(k,v){calls.push([k,v]);return q;},select(){return q;},single(){return Promise.resolve({error:{message:'Record not found'}});}};
 const client=new StudyPlanClient({from:table=>{calls.push(['table',table]);return q;}},{userId:A,classId:C1,classCode:'INTEL-1',className:'A'});
 await assert.rejects(client.completeTask('task',true),/Record not found/);assert.ok(calls.some(([k,v])=>k==='user_id'&&v===A));assert.ok(calls.some(([k,v])=>k==='class_id'&&v===C1));
 await assert.rejects(client.remove('updates','id'),/Invalid study record/);
 assert.throws(()=>client.logSession(new Date().toISOString(),10,null,null),/end time in the past/);
});
