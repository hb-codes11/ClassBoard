import { StudyPlanClient, dateKey, addDays, elapsedSeconds, groupTasks, summarize } from './study-plan-core.js';
/** @typedef {import('./study-plan-types').StudyTask} StudyTask */
/** @typedef {import('./study-plan-types').StudySession} StudySession */
/** @typedef {import('./study-plan-types').StudySubject} StudySubject */
/** @typedef {import('./study-plan-types').StudyResource} StudyResource */
/** @typedef {import('./study-plan-types').StudyExam} StudyExam */
/** @template {HTMLElement} T @param {string} id @returns {T} */
const el = id => /** @type {T} */ (document.getElementById(id));
const root = el('page-study');
const dialog = /** @type {HTMLDialogElement} */ (el('studyDialog'));
/** @type {StudyPlanClient | null} */ let api = null;
/** @type {import('./study-plan-types').StudySnapshot} */ let data = { tasks: [], sessions: [], goals: [] };
/** @type {StudySubject[]} */ let subjects = [];
/** @type {StudyResource[]} */ let resources = [];
let tab = 'today', filter = '', generation = 0, loadVersion = 0, busy = false, ready = false, loading = false;
/** @type {HTMLElement | null} */ let dialogOpener = null;
const escape = (/** @type {unknown} */ text) => String(text ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c] || c));
const today = () => dateKey(new Date(), api?.context.timezone);
const subjectName = (/** @type {string | null} */ id) => subjects.find(s => s.id === id)?.name || 'General study';
const activeTimer = () => data.sessions.find(s => s.status !== 'completed') || null;
const visible = () => root.classList.contains('active') && !document.hidden;
const dateLabel = (/** @type {string} */ date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const color = (/** @type {string} */ name) => /software engineering/i.test(name) ? 'se' : /statistical analysis/i.test(name) ? 'sa' : /artificial intelligence/i.test(name) ? 'ai' : /java/i.test(name) ? 'java' : /computer organi[sz]ation/i.test(name) ? 'com' : 'default';
const normalize = (/** @type {string} */ name) => name.toLowerCase().replace(/organisation/g, 'organization').replace(/[^a-z]/g, '');
/** Read the existing Academics schedule each render; never store another schedule. @returns {StudyExam[]} */
function exams() {
  return [...document.querySelectorAll('#academicsPanelMst [data-mst-exam]')].map(card => {
    const name = card.querySelector('.mst-exam-name')?.textContent || 'MST';
    const raw = /** @type {HTMLElement} */ (card).dataset.mstExam || '';
    // Academics dates without an offset are in the selected class's college timezone.
    const starts_at = raw && !/(Z|[+-]\d\d:\d\d)$/.test(raw) ? `${raw}+05:30` : raw;
    return { name, starts_at, detail: card.querySelector('.mst-exam-meta')?.textContent || '', subject_id: subjects.find(s => normalize(s.name) === normalize(name))?.id || null };
  }).filter(e => Number.isFinite(Date.parse(e.starts_at))).sort((a,b) => a.starts_at.localeCompare(b.starts_at));
}
function message(/** @type {string} */ text, error = false) {
  const status = el('studyStatus'); status.textContent = text; status.classList.toggle('study-error', error); status.hidden = !text;
}
/** @param {StudySubject[]} [items] @param {string|null} [selected] */
function subjectOptions(items = subjects, selected = null) {
  return `<option value="">General study</option>${items.map(s => `<option value="${escape(s.id)}" ${s.id === selected ? 'selected' : ''}>${escape(s.name)}</option>`).join('')}`;
}
/** @param {string|null} [subjectId] @param {string|null} [selected] */
function taskOptions(subjectId = null, selected = null) {
  return `<option value="">No linked task</option>${data.tasks.filter(t => (!subjectId || t.subject_id === subjectId) && (!t.completed_at || t.id === selected)).map(t => `<option value="${escape(t.id)}" ${t.id === selected ? 'selected' : ''}>${escape(t.title)}</option>`).join('')}`;
}
/** @param {StudyTask} task */
function resourceLink(task) {
  const resource = resources.find(r => r.id === task.resource_id);
  if (!resource?.storage_path) return task.resource_id ? '<span class="study-muted">Linked file is no longer available</span>' : '';
  return `<span class="study-resource" data-resource-path="${escape(resource.storage_path)}" data-resource-title="${escape(resource.title)}"><button type="button" data-preview-pdf="true">Preview: ${escape(resource.title)}</button><button type="button" data-download-pdf="true" aria-label="Download ${escape(resource.title)}">Download</button></span>`;
}
/** @param {StudyTask} task */
function taskRow(task) {
  return `<article class="study-task ${task.completed_at ? 'is-complete' : ''}" data-task-id="${escape(task.id)}">
    <input type="checkbox" data-complete="${escape(task.id)}" aria-label="Mark ${escape(task.title)} ${task.completed_at ? 'incomplete' : 'complete'}" ${task.completed_at ? 'checked' : ''}>
    <div class="study-task-copy"><strong>${escape(task.title)}</strong><div class="study-task-meta"><span>${escape(subjectName(task.subject_id))}</span><span class="study-priority" data-priority="${task.priority}">${task.priority} priority</span><span>Planned ${dateLabel(task.planned_date)}</span>${task.due_date ? `<span>Due ${dateLabel(task.due_date)}</span>` : ''}</div>${resourceLink(task)}</div>
    <button type="button" class="study-quiet" data-edit-task="${escape(task.id)}" aria-label="Edit ${escape(task.title)}">Edit</button>
  </article>`;
}
function render() {
  if (!api || !ready) return;
  el('studyClass').textContent = api.context.classCode;
  const summary = summarize(data.tasks, data.sessions, today(), api.context.timezone);
  const upcomingExam = exams().find(e => Date.parse(e.starts_at) >= Date.now());
  el('studyExam').innerHTML = `<h2>Next MST / exam</h2>${upcomingExam ? `<h3>${escape(upcomingExam.name)}</h3><p>${escape(new Date(upcomingExam.starts_at).toLocaleString('en-IN', { timeZone: api.context.timezone || 'Asia/Kolkata', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }))}</p><p class="study-muted">${escape(upcomingExam.detail)}</p>` : '<p>No upcoming exam in Academics.</p>'}<button type="button" class="text-link" data-study-action="academics">View Academics</button>`;
  const selectedTasks = filter ? data.tasks.filter(t => t.subject_id === filter) : data.tasks;
  const groups = groupTasks(selectedTasks, today());
  el('studyTaskGroups').innerHTML = Object.entries(groups).map(([name, rows]) => rows.length ? `<section class="study-task-group"><h3>${name === 'today' ? 'Today' : name[0].toUpperCase() + name.slice(1)} <span>${rows.length}</span></h3>${rows.map(taskRow).join('')}</section>` : '').join('') || `<div class="study-empty"><h3>${data.tasks.length ? 'No tasks for this subject' : 'A little space for your own plans'}</h3><p>${data.tasks.length ? 'Choose another subject or add a task.' : 'Your tasks and study sessions stay private. Your CRs and admins cannot see them.'}</p><button class="primary-button" type="button" data-study-action="add">${data.tasks.length ? 'Add task' : 'Add your first task'}</button></div>`;
  /** @type {HTMLSelectElement} */ (el('studySubjectFilter')).innerHTML = `<option value="">All subjects</option>${subjects.map(s => `<option value="${escape(s.id)}" ${s.id === filter ? 'selected' : ''}>${escape(s.name)}</option>`).join('')}`;
  el('studyWeekProgress').innerHTML = `<div><strong>${summary.completed} / ${summary.total}</strong><span>Tasks planned this week completed</span></div><div><strong>${summary.minutes} min</strong><span>Study logged this week</span></div>`;
  el('studySubjectProgress').innerHTML = subjects.length ? subjects.map(s => {
    const goal = data.goals.find(g => g.subject_id === s.id)?.weekly_minutes || 0, minutes = summary.subjectMinutes[s.id] || 0;
    return `<div class="study-progress-row" data-subject-color="${color(s.name)}"><div><span>${escape(s.short_name || s.name)}</span><span>${minutes}${goal ? ` / ${goal}` : ''} min</span></div><progress max="${goal || 1}" value="${goal ? Math.min(minutes, goal) : 0}" aria-label="${escape(s.name)} weekly study goal"></progress></div>`;
  }).join('') : '<p class="study-muted">No subjects are available for this class.</p>';
  const timer = activeTimer();
  const timerSubject = /** @type {HTMLSelectElement} */ (el('studyTimerSubject'));
  const timerTask = /** @type {HTMLSelectElement} */ (el('studyTimerTask'));
  const previousSubject = timerSubject.value, previousTask = timerTask.value;
  timerSubject.innerHTML = subjectOptions(subjects, timer ? timer.subject_id : previousSubject);
  timerTask.innerHTML = taskOptions(timer ? timer.subject_id : timerSubject.value, timer ? timer.task_id : previousTask);
  timerSubject.disabled = timerTask.disabled = !!timer;
  el('studyTimerButtons').innerHTML = timer ? `<button type="button" class="primary-button" data-timer-action="${timer.status === 'running' ? 'pause' : 'resume'}">${timer.status === 'running' ? 'Pause' : 'Resume'}</button><button type="button" class="secondary-button" data-timer-action="finish">Finish &amp; save</button><button type="button" class="study-quiet" data-timer-action="discard">Discard</button>` : '<button type="button" class="primary-button" data-timer-action="start">Start focus</button>';
  el('studyTimerHint').textContent = timer ? `Linked to ${subjectName(timer.subject_id)}${timer.task_id ? ` · ${data.tasks.find(t => t.id === timer.task_id)?.title || 'Task'}` : ''}. Your timer is saved across refreshes.` : 'Try 25 minutes of focus. Finish when you are ready.';
  el('studySubjects').innerHTML = subjects.map(s => {
    const pending = data.tasks.filter(t => t.subject_id === s.id && !t.completed_at).length;
    const goal = data.goals.find(g => g.subject_id === s.id)?.weekly_minutes || 0;
    const exam = exams().find(e => e.subject_id === s.id && Date.parse(e.starts_at) >= Date.now());
    const linked = resources.filter(r => r.subject_id === s.id);
    return `<article class="panel study-subject-card" data-subject-color="${color(s.name)}"><h2>${escape(s.name)}</h2><p>${pending} pending task${pending === 1 ? '' : 's'} · ${summary.subjectMinutes[s.id] || 0} min this week</p><form data-goal="${escape(s.id)}" class="study-goal-form"><label>Weekly goal (minutes)<input class="text-field" type="number" name="minutes" min="0" max="10080" step="1" required value="${goal}"></label><button type="submit" class="secondary-button">Save goal</button></form><p class="study-muted">${exam ? `Next MST: ${dateLabel(dateKey(new Date(exam.starts_at), api?.context.timezone))}` : 'No upcoming MST listed for this subject.'}</p><div class="study-subject-actions"><button type="button" class="text-link" data-subject-tasks="${escape(s.id)}">View tasks</button><button type="button" class="text-link" data-add-subject="${escape(s.id)}">Add task</button></div><details><summary>Notes &amp; resources (${linked.length})</summary>${linked.map(r => `<div class="study-resource" data-resource-path="${escape(r.storage_path)}" data-resource-title="${escape(r.title)}"><button type="button" data-preview-pdf="true">${escape(r.title)}</button><button type="button" data-download-pdf="true">Download</button></div>`).join('') || '<p class="study-muted">No published resources yet.</p>'}</details></article>`;
  }).join('') || '<p class="study-empty">Your class has no active subjects yet.</p>';
  el('studyInsights').innerHTML = `<div class="study-insight-stats"><article class="panel"><strong>${summary.minutes} min</strong><span>Focus this week</span></article><article class="panel"><strong>${summary.completionRate}%</strong><span>${summary.completed} of ${summary.total} weekly tasks completed</span></article><article class="panel"><strong>${summary.streak} day${summary.streak === 1 ? '' : 's'}</strong><span>Study streak</span></article></div><article class="panel study-insight-chart"><h2>Your week</h2><p class="study-muted">Completed sessions count toward the day they started, in class time. A streak continues if you studied today or yesterday.</p><div class="study-bars">${summary.days.map(d => `<div><span>${d.minutes}m</span><div style="height:${Math.max(3, d.minutes / Math.max(1, ...summary.days.map(x => x.minutes)) * 100)}px"></div><span>${new Date(`${d.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</span></div>`).join('')}</div></article><article class="panel study-activity"><h2>Recent study sessions</h2>${data.sessions.filter(s => s.status === 'completed').sort((a,b) => b.started_at.localeCompare(a.started_at)).slice(0,20).map(s => `<div class="study-session-row"><div><strong>${escape(subjectName(s.subject_id))}</strong><p>${escape(new Date(s.started_at).toLocaleString('en-IN', { timeZone: api?.context.timezone || 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }))} · ${s.source === 'timer' ? 'Focus timer' : 'Manual entry'} · ${s.duration_seconds < 60 ? `${s.duration_seconds} sec` : `${Math.floor(s.duration_seconds / 60)} min`}</p></div><div class="study-session-actions"><button class="study-quiet" type="button" data-edit-session="${escape(s.id)}">Edit</button><button class="study-quiet" type="button" data-delete-session="${escape(s.id)}">Delete</button></div></div>`).join('') || '<p class="study-muted">Finish a focus session or log study time to see your progress here.</p>'}</article>`;
  selectTab(tab); tick();
}
/** @param {string} name */
function selectTab(name) {
  tab = name;
  root.querySelectorAll('[data-study-tab]').forEach(button => { const selected = /** @type {HTMLElement} */(button).dataset.studyTab === name; button.setAttribute('aria-selected', String(selected)); /** @type {HTMLElement} */(button).tabIndex = selected ? 0 : -1; });
  root.querySelectorAll('[data-study-panel]').forEach(panel => { /** @type {HTMLElement} */(panel).hidden = /** @type {HTMLElement} */(panel).dataset.studyPanel !== name; });
}
function tick() {
  if (!api || !ready || !visible()) return;
  const timer = activeTimer(), seconds = elapsedSeconds(timer), remaining = Math.max(0, 1500 - seconds);
  el('studyClock').textContent = `${Math.floor(remaining / 60).toString().padStart(2,'0')}:${(remaining % 60).toString().padStart(2,'0')}`;
  el('studyClockState').textContent = timer ? `${timer.status === 'paused' ? 'Paused' : remaining ? 'Focusing' : '25-minute target reached'} · ${Math.floor(seconds / 60)}m ${seconds % 60}s recorded` : 'Ready when you are';
}
/** @param {boolean} [withContent] */
async function reload(withContent = false) {
  if (!api || loading) return false;
  const client = api, version = generation, request = ++loadVersion;
  loading = true;
  try {
    const [snapshot, content] = await Promise.all([client.load(), withContent ? loadContent(client) : Promise.resolve(null)]);
    if (generation !== version || api !== client || request !== loadVersion) return false;
    data = snapshot;
    if (content) { subjects = content.subjects; resources = content.resources; }
    ready = true; el('studyBody').hidden = false; el('studyAddTask').removeAttribute('disabled'); render();
    message('');
    return true;
  } catch (error) {
    if (generation !== version || request !== loadVersion) return false;
    const detail = error instanceof Error ? error.message : '';
    message(/schema cache|does not exist|permission denied/i.test(detail) ? 'Study Plan is not available yet. Ask Hasnaat or Harsh to check its setup, then refresh.' : 'Study Plan could not load. Check your connection and refresh to try again.', true);
    return false;
  } finally { if (generation === version && request === loadVersion) loading = false; }
}
/** @param {StudyPlanClient} client */
async function loadContent(client) {
  const result = await client.client.from('subjects').select('id,name,slug,short_name').eq('class_id', client.context.classId).eq('is_active', true).order('display_order');
  if (result.error) throw new Error(result.error.message);
  /** @type {StudyResource[]} */ const files = [];
  for (let from = 0; ; from += 500) {
    const page = await client.client.from('resources').select('id,subject_id,title,storage_path,kind').eq('class_id', client.context.classId).not('published_at','is',null).is('deleted_at',null).order('id').range(from,from+499);
    if (page.error) throw new Error(page.error.message);
    files.push(...page.data); if (page.data.length < 500) break;
  }
  return { subjects: /** @type {StudySubject[]} */(result.data), resources: files };
}
/** @param {() => Promise<unknown>} action @param {string} success */
async function mutate(action, success) {
  if (busy || !api) return;
  busy = true; const version = generation; loadVersion++; loading = false;
  root.setAttribute('aria-busy', 'true'); root.querySelectorAll('button,input,select').forEach(e => /** @type {HTMLButtonElement} */(e).disabled = true);
  try { await action(); if (generation !== version) return; if (await reload()) message(success); }
  catch (error) { if (generation === version) { render(); message(error instanceof Error ? error.message : 'Could not save. Try again.', true); } }
  finally { if (generation === version) { busy = false; root.removeAttribute('aria-busy'); root.querySelectorAll('button,input,select').forEach(e => /** @type {HTMLButtonElement} */(e).disabled = false); const timer = activeTimer(); /** @type {HTMLSelectElement} */(el('studyTimerSubject')).disabled = !!timer; /** @type {HTMLSelectElement} */(el('studyTimerTask')).disabled = !!timer; } }
}
/** @param {string} title @param {string} body @param {(values: FormData) => Promise<unknown>} save @param {string} [submit] */
function openDialog(title, body, save, submit = 'Save') {
  if (!api || busy || !ready) return;
  const client = api, version = generation;
  dialogOpener = /** @type {HTMLElement} */ (document.activeElement);
  dialog.innerHTML = `<form id="studyDialogForm"><div class="study-dialog-heading"><h2 id="studyDialogTitle">${escape(title)}</h2><button type="button" class="study-quiet" data-close-study aria-label="Close">×</button></div><div class="study-dialog-fields">${body}</div><p id="studyDialogError" class="study-error" role="alert" hidden></p><div class="study-dialog-actions"><button type="button" class="secondary-button" data-close-study>Cancel</button><button class="primary-button" type="submit">${escape(submit)}</button></div></form>`;
  dialog.querySelectorAll('[data-close-study]').forEach(b => b.addEventListener('click', () => dialog.close()));
  dialog.querySelector('form')?.addEventListener('submit', async event => {
    event.preventDefault(); const form = /** @type {HTMLFormElement} */ (event.currentTarget);
    if (generation !== version || api !== client || form.dataset.saving) return;
    form.dataset.saving = 'true'; loadVersion++; loading = false; const values = new FormData(form);
    form.querySelectorAll('button,input,select').forEach(e => /** @type {HTMLButtonElement} */(e).disabled = true);
    try { await save(values); if (version !== generation) return; dialog.close(); if (await reload()) message('Saved to your private Study Plan.'); }
    catch (error) { if (version === generation) { el('studyDialogError').textContent = error instanceof Error ? error.message : 'Could not save.'; el('studyDialogError').hidden = false; } }
    finally { delete form.dataset.saving; form.querySelectorAll('button,input,select').forEach(e => /** @type {HTMLButtonElement} */(e).disabled = false); }
  });
  dialog.showModal(); /** @type {HTMLElement | null} */(dialog.querySelector('input,select,button[type="submit"]'))?.focus();
}
/** @param {StudyTask|null} [task] @param {string|null} [subject] */
function taskDialog(task = null, subject = null) {
  const client = api; if (!client) return;
  openDialog(task ? 'Edit task' : 'Add task', `<label>What will you study?<input class="text-field" name="title" required maxlength="180" value="${escape(task?.title)}" placeholder="e.g. Revise Java inheritance"></label><label>Subject<select class="select-field" name="subject_id">${subjectOptions(subjects, task?.subject_id || subject)}</select></label><label>Link an existing resource (optional)<select class="select-field" name="resource_id"></select></label><div class="study-fields-pair"><label>Planned date<input class="text-field" type="date" name="planned_date" required value="${task?.planned_date || today()}"></label><label>Due date (optional)<input class="text-field" type="date" name="due_date" value="${task?.due_date || ''}"></label></div><label>Priority<select class="select-field" name="priority">${['low','normal','high'].map(p => `<option value="${p}" ${p === (task?.priority || 'normal') ? 'selected' : ''}>${p[0].toUpperCase()+p.slice(1)}</option>`).join('')}</select></label>${task ? '<button type="button" class="study-delete" id="studyDeleteTask">Delete task</button>' : ''}`, values => client.saveTask({ title: String(values.get('title') || ''), subject_id: String(values.get('subject_id') || '') || null, resource_id: String(values.get('resource_id') || '') || null, planned_date: String(values.get('planned_date')), due_date: String(values.get('due_date') || '') || null, priority: /** @type {'low'|'normal'|'high'} */(values.get('priority')) }, task?.id));
  const subjectSelect = /** @type {HTMLSelectElement} */(dialog.querySelector('[name="subject_id"]'));
  const resourceSelect = /** @type {HTMLSelectElement} */(dialog.querySelector('[name="resource_id"]'));
  const sync = (selected = '') => { resourceSelect.innerHTML = '<option value="">No linked resource</option>' + resources.filter(r => !subjectSelect.value || r.subject_id === subjectSelect.value).map(r => `<option value="${escape(r.id)}" ${r.id === selected ? 'selected' : ''}>${escape(r.title)}</option>`).join(''); };
  sync(task?.resource_id || ''); subjectSelect.addEventListener('change', () => sync());
  dialog.querySelector('#studyDeleteTask')?.addEventListener('click', () => { if (task && confirm('Delete this private task? Study sessions will be kept.')) { dialog.close(); void mutate(() => client.remove('study_tasks',task.id), 'Task deleted.'); } });
}
function manualDialog() {
  const client = api; if (!client) return;
  const now = new Date(Date.now() - 25 * 60000), local = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,16);
  openDialog('Log study time', `<label>Subject<select class="select-field" name="subject_id">${subjectOptions()}</select></label><label>Linked task (optional)<select class="select-field" name="task_id">${taskOptions()}</select></label><label>Started at (your local time)<input class="text-field" type="datetime-local" name="started_at" required value="${local}"></label><label>Minutes studied<input class="text-field" type="number" min="1" max="1440" step="1" name="minutes" value="25" required></label>`, values => client.logSession(String(values.get('started_at')), Number(values.get('minutes')), String(values.get('subject_id') || '') || data.tasks.find(t => t.id === values.get('task_id'))?.subject_id || null, String(values.get('task_id') || '') || null));
  dialog.querySelector('[name="subject_id"]')?.addEventListener('change', event => { /** @type {HTMLSelectElement} */(dialog.querySelector('[name="task_id"]')).innerHTML = taskOptions(/** @type {HTMLSelectElement} */(event.target).value); });
}
/** @param {StudySession} session */
function sessionDialog(session) {
  const client = api; if (!client) return;
  openDialog('Edit study session', `<p class="study-muted">Change the subject or linked task. Recorded focus time stays the same.</p><label>Subject<select class="select-field" name="subject_id">${subjectOptions(subjects, session.subject_id)}</select></label><label>Linked task (optional)<select class="select-field" name="task_id">${taskOptions(session.subject_id, session.task_id)}</select></label>`, values => client.editSession(session.id, String(values.get('subject_id') || '') || data.tasks.find(t => t.id === values.get('task_id'))?.subject_id || null, String(values.get('task_id') || '') || null));
  dialog.querySelector('[name="subject_id"]')?.addEventListener('change', event => { /** @type {HTMLSelectElement} */(dialog.querySelector('[name="task_id"]')).innerHTML = taskOptions(/** @type {HTMLSelectElement} */(event.target).value); });
}
root.addEventListener('click', event => {
  const button = /** @type {HTMLElement} */(event.target).closest('button'); if (!button || busy) return;
  const b = button.dataset;
  if (b.studyTab) selectTab(b.studyTab);
  if (b.studyAction === 'add') taskDialog();
  if (b.studyAction === 'manual') manualDialog();
  if (b.studyAction === 'retry') void reload(true);
  if (b.studyAction === 'academics') window.openClassboardAcademicsTab?.('mst');
  if (b.editSession) { const session = data.sessions.find(s => s.id === b.editSession); if (session) sessionDialog(session); }
  if (b.editTask) taskDialog(data.tasks.find(t => t.id === b.editTask));
  if (b.addSubject) taskDialog(null, b.addSubject);
  if (b.subjectTasks) { filter = b.subjectTasks; tab = 'today'; render(); }
  if (b.timerAction && api) {
    const client = api, timer = activeTimer(), action = /** @type {import('./study-plan-types').TimerAction} */(b.timerAction);
    if (action === 'discard' && !confirm('Discard this focus session? It will not count toward your study time.')) return;
    const taskId = /** @type {HTMLSelectElement} */(el('studyTimerTask')).value || null;
    const subjectId = /** @type {HTMLSelectElement} */(el('studyTimerSubject')).value || data.tasks.find(t => t.id === taskId)?.subject_id || null;
    void mutate(() => client.timer(action, timer?.id, subjectId, taskId), action === 'finish' ? 'Focus session saved.' : action === 'discard' ? 'Focus session discarded.' : 'Timer saved.');
  }
  if (b.deleteSession && api && confirm('Delete this study session?')) { const client = api; void mutate(() => client.remove('study_sessions', b.deleteSession || ''), 'Study session deleted.'); }
});
root.addEventListener('change', event => {
  const input = /** @type {HTMLInputElement} */(event.target);
  if (busy) return;
  if (input.dataset.complete && api) { const client = api, checked = input.checked; void mutate(() => client.completeTask(input.dataset.complete || '', checked), checked ? 'Task completed.' : 'Task reopened.'); }
  if (input.id === 'studySubjectFilter') { filter = input.value; render(); }
  if (input.id === 'studyTimerSubject') /** @type {HTMLSelectElement} */(el('studyTimerTask')).innerHTML = taskOptions(input.value);
});
root.addEventListener('submit', event => {
  const form = /** @type {HTMLFormElement} */(event.target); if (!form.dataset.goal || !api) return;
  event.preventDefault(); const client = api, values = new FormData(form); void mutate(() => client.saveGoal(form.dataset.goal || '', Number(values.get('minutes'))), 'Weekly goal saved.');
});
root.querySelector('[role="tablist"]')?.addEventListener('keydown', event => {
  const key = /** @type {KeyboardEvent} */(event).key; if (!['ArrowLeft','ArrowRight','Home','End'].includes(key)) return;
  event.preventDefault(); const tabs = [...root.querySelectorAll('[data-study-tab]')]; const index = tabs.indexOf(/** @type {HTMLElement} */(document.activeElement));
  const next = key === 'Home' ? 0 : key === 'End' ? tabs.length - 1 : (index + (key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  const button = /** @type {HTMLButtonElement} */(tabs[next]); selectTab(button.dataset.studyTab || 'today'); button.focus();
});
dialog.addEventListener('cancel', event => { if (dialog.querySelector('[data-saving]')) event.preventDefault(); });
dialog.addEventListener('close', () => { if (dialogOpener?.isConnected) dialogOpener.focus(); });
function contextChanged() {
  generation++; loadVersion++; api = null; data = {tasks:[],sessions:[],goals:[]}; subjects = []; resources = []; ready = false; loading = false; busy = false; filter = ''; tab = 'today';
  if (dialog.open) dialog.close(); dialog.innerHTML = ''; root.removeAttribute('aria-busy');
  el('studyBody').hidden = true; el('studyAddTask').setAttribute('disabled','');
  // Clear private markup as well as state on logout or class changes.
  ['studyTaskGroups','studySubjects','studyInsights','studySubjectProgress','studyWeekProgress','studyTimerButtons','studyExam','studyClockState','studyTimerHint'].forEach(id => el(id).replaceChildren());
  /** @type {HTMLSelectElement} */(el('studyTimerSubject')).replaceChildren(); /** @type {HTMLSelectElement} */(el('studyTimerTask')).replaceChildren();
  el('studyClock').textContent = '25:00'; el('studyClass').textContent = '';
  const context = window.classboardContext;
  if (context && window.classboardSupabase) { api = new StudyPlanClient(window.classboardSupabase, context); message('Open Study Plan to load your private workspace.'); if (visible()) void reload(true); }
  else message('Sign in to use your private Study Plan.');
}
window.addEventListener('classboard:study-context', contextChanged);
new MutationObserver(() => { if (visible() && api) { void reload(true); } }).observe(root,{attributes:true,attributeFilter:['class']});
setInterval(() => { if (visible() && api && !busy && !dialog.open && !root.querySelector('form:focus-within')) void reload(!ready); }, 30000);
setInterval(tick,1000);
const refreshVisible = () => { if (visible() && !dialog.open && !busy && !root.querySelector('form:focus-within')) void reload(!ready); };
window.addEventListener('focus',refreshVisible); document.addEventListener('visibilitychange',refreshVisible);
contextChanged();
