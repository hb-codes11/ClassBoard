/* Test-only in-memory Supabase double. Real RLS is tested separately in PGlite. */
(() => {
const context={userId:'test-student',classId:'intel-1',classCode:'INTEL-1',className:'AI & Analytics - A',timezone:'Asia/Kolkata'};
const key=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const nextDate=n=>{let d=new Date(key+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const subjects=[{id:'java',class_id:'intel-1',name:'Java Programming',short_name:'JAVA',is_active:true},{id:'se',class_id:'intel-1',name:'Software Engineering',short_name:'SE',is_active:true},{id:'sa',class_id:'intel-1',name:'Statistical Analysis',short_name:'SA',is_active:true}];
const resource={id:'notes',class_id:'intel-1',subject_id:'java',title:'Unit 3 · Java inheritance',kind:'notes',storage_path:'intel-1/java/notes.pdf',published_at:'2026-10-01',deleted_at:null};
const defaultData={subjects,resources:[resource],study_tasks:[{id:'task-one',user_id:context.userId,class_id:context.classId,subject_id:'java',resource_id:'notes',title:'Revise inheritance and interfaces',planned_date:key,due_date:nextDate(2),priority:'high',completed_at:null,created_at:new Date().toISOString()},{id:'task-two',user_id:context.userId,class_id:context.classId,subject_id:'se',resource_id:null,title:'Write unit 3 revision notes',planned_date:nextDate(-1),due_date:null,priority:'normal',completed_at:null,created_at:new Date().toISOString()}],study_sessions:[],study_subject_goals:[]};
const data=JSON.parse(sessionStorage.getItem('study-fixture')||'null')||defaultData;
const persist=()=>sessionStorage.setItem('study-fixture',JSON.stringify(data));
class Query {
 constructor(table){this.table=table;this.filters=[];this.payload=null;this.operation='select';}
 select(){return this;}eq(k,v){this.filters.push(r=>r[k]===v);return this;}not(k,op,v){this.filters.push(r=>r[k]!==v);return this;}is(k,v){return this.eq(k,v);}order(){return this;}range(a,b){this.slice=[a,b+1];return this;}single(){this.one=true;return this;}
 insert(payload){this.operation='insert';this.payload=payload;return this;}update(payload){this.operation='update';this.payload=payload;return this;}delete(){this.operation='delete';return this;}upsert(payload){this.operation='upsert';this.payload=payload;return this;}
 then(resolve,reject){return Promise.resolve().then(()=>{
 let rows=data[this.table]||[];let matches=rows.filter(r=>this.filters.every(f=>f(r)));
 if(this.operation==='insert'||this.operation==='upsert'){
 let row=this.operation==='upsert'?rows.find(r=>r.user_id===this.payload.user_id&&r.class_id===this.payload.class_id&&r.subject_id===this.payload.subject_id):null;
 if(row){Object.assign(row,this.payload);}else {row={id:crypto.randomUUID(),created_at:new Date().toISOString(),completed_at:null,...this.payload};rows.push(row);}matches=[row];
 }else if(this.operation==='update'){matches.forEach(r=>Object.assign(r,this.payload));}else if(this.operation==='delete'){data[this.table]=rows.filter(r=>!matches.includes(r));}
 if(this.slice)matches=matches.slice(...this.slice);persist();return {data:this.one?matches[0]:matches,error:null};
 }).then(resolve,reject);}
}
window.classboardSupabase={from:t=>new Query(t),rpc:async(name,p)=>{
 const rows=data.study_sessions;let row=rows.find(r=>r.user_id===context.userId&&r.class_id===p.p_class_id&&r.status!=='completed');
 if(p.p_action==='start'&&!row){row={id:crypto.randomUUID(),user_id:context.userId,class_id:p.p_class_id,subject_id:p.p_subject_id,task_id:p.p_task_id,status:'running',source:'timer',started_at:new Date().toISOString(),resumed_at:new Date().toISOString(),duration_seconds:0,ended_at:null};rows.push(row);}
 else if(row){if(['pause','finish'].includes(p.p_action)&&row.status==='running')row.duration_seconds+=Math.floor((Date.now()-Date.parse(row.resumed_at))/1000);if(p.p_action==='discard'){rows.splice(rows.indexOf(row),1);row=null;}else if(p.p_action==='finish'){if(!row.duration_seconds)return {error:{message:'Study for at least one second before finishing'}};row.status='completed';row.resumed_at=null;row.ended_at=new Date().toISOString();}else if(p.p_action==='pause'){row.status='paused';row.resumed_at=null;}else if(p.p_action==='resume'){row.status='running';row.resumed_at=new Date().toISOString();}}
 persist();return {data:row,error:null};
}};
document.getElementById('roleSwitcher').hidden=true; document.body.dataset.hasRoleSwitcher='false';
window.classboardContext=context; window.classboardSubjects=subjects;
document.querySelector('.app').hidden=false;document.getElementById('authGate').hidden=true;
const banner=document.createElement('p');banner.textContent='Local Study Plan test data — no live account or database connection';banner.style='margin:0;padding:6px;text-align:center;background:#e5f1ff;color:#17283d;font-size:11px';document.querySelector('main').prepend(banner);
const controls=document.createElement('div');controls.style='display:flex;justify-content:center;gap:12px;flex-wrap:wrap;font-size:11px;background:#e5f1ff;padding:4px';
const switchButton=document.createElement('button');switchButton.textContent='Switch test class';switchButton.onclick=()=>{context.classId=context.classId==='intel-1'?'intel-2':'intel-1';context.classCode=context.classId==='intel-1'?'INTEL-1':'INTEL-2';window.dispatchEvent(new Event('classboard:study-context'));};
const logout=document.createElement('button');logout.textContent='Simulate sign out';logout.onclick=()=>{window.classboardContext=null;window.dispatchEvent(new Event('classboard:study-context'));};
controls.append(switchButton,logout);banner.after(controls);
window.openClassboardPage('study');
})();
