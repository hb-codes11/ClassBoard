/** @typedef {import('./study-plan-types').StudyTask} StudyTask */
/** @typedef {import('./study-plan-types').StudySession} StudySession */
/** @typedef {import('./study-plan-types').StudySummary} StudySummary */

/** @param {Date} [date] @param {string} [timezone] */
export function dateKey(date = new Date(), timezone = 'Asia/Kolkata') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (/** @type {string} */ key) => parts.find(p => p.type === key)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
/** @param {string} key @param {number} count */
export function addDays(key, count) { const date = new Date(`${key}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0, 10); }
/** @param {string} today */
export function weekStart(today) { const day = new Date(`${today}T12:00:00Z`).getUTCDay(); return addDays(today, -(day + 6) % 7); }
/** @param {StudySession | null} session @param {number} [now] */
export function elapsedSeconds(session, now = Date.now()) {
  if (!session) return 0;
  return Math.min(86400, session.duration_seconds + (session.status === 'running' && session.resumed_at ? Math.max(0, Math.floor((now - Date.parse(session.resumed_at)) / 1000)) : 0));
}
/** @param {StudyTask[]} tasks @param {string} today */
export function groupTasks(tasks, today) {
  /** @type {Record<'overdue'|'today'|'upcoming'|'completed', StudyTask[]>} */
  const groups = { overdue: [], today: [], upcoming: [], completed: [] };
  const rank = { high: 0, normal: 1, low: 2 };
  for (const task of tasks) {
    const group = task.completed_at ? 'completed' : task.planned_date < today || (task.due_date && task.due_date < today) ? 'overdue' : task.planned_date === today ? 'today' : 'upcoming';
    groups[group].push(task);
  }
  Object.values(groups).forEach(list => list.sort((a, b) => a.planned_date.localeCompare(b.planned_date) || rank[a.priority] - rank[b.priority] || a.created_at.localeCompare(b.created_at)));
  return groups;
}
/** @param {StudyTask[]} tasks @param {StudySession[]} sessions @param {string} today @param {string} [timezone] @returns {StudySummary} */
export function summarize(tasks, sessions, today, timezone = 'Asia/Kolkata') {
  const start = weekStart(today), end = addDays(start, 7);
  const planned = tasks.filter(t => t.planned_date >= start && t.planned_date < end);
  const completed = planned.filter(t => t.completed_at).length;
  /** @type {Record<string, number>} */ const secondsByDay = {};
  /** @type {Record<string, number>} */ const subjectSeconds = {};
  for (const session of sessions.filter(s => s.status === 'completed')) {
    const key = dateKey(new Date(session.started_at), timezone);
    secondsByDay[key] = (secondsByDay[key] || 0) + session.duration_seconds;
    if (key >= start && key < end && session.subject_id) subjectSeconds[session.subject_id] = (subjectSeconds[session.subject_id] || 0) + session.duration_seconds;
  }
  const days = Array.from({ length: 7 }, (_, i) => { const date = addDays(start, i); return { date, minutes: Math.floor((secondsByDay[date] || 0) / 60) }; });
  let cursor = secondsByDay[today] ? today : addDays(today, -1), streak = 0;
  while (secondsByDay[cursor] > 0) { streak++; cursor = addDays(cursor, -1); }
  return { weekStart: start, minutes: Math.floor(Object.entries(secondsByDay).filter(([date]) => date >= start && date < end).reduce((sum, [, seconds]) => sum + seconds, 0) / 60), completed, total: planned.length, completionRate: planned.length ? Math.round(completed / planned.length * 100) : 0, streak, days, subjectMinutes: Object.fromEntries(Object.entries(subjectSeconds).map(([id, seconds]) => [id, Math.floor(seconds / 60)])) };
}

/** Client captures a user/class pair; never reuses queries across class switches. */
export class StudyPlanClient {
  /** @param {import('./study-plan-types').SupabaseClient} client @param {import('./study-plan-types').StudyContext} context */
  constructor(client, context) { this.client = client; this.context = { ...context }; }
  /** @param {string} table */
  own(table) { return this.client.from(table).select('*').eq('user_id', this.context.userId).eq('class_id', this.context.classId); }
  /** All records are paginated so older activity still contributes to streaks and reports.
   * @param {string} table @returns {Promise<any[]>} */
  async rows(table) {
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const result = await this.own(table).order('id').range(offset, offset + 499);
      if (result.error) throw new Error(result.error.message);
      rows.push(...result.data);
      if (result.data.length < 500) break;
    }
    return rows;
  }
  /** @returns {Promise<import('./study-plan-types').StudySnapshot>} */
  async load() {
    const [tasks, sessions, goals] = await Promise.all(['study_tasks', 'study_sessions', 'study_subject_goals'].map(t => this.rows(t)));
    return { tasks, sessions, goals };
  }
  /** @param {any} query */
  async result(query) { const { data, error } = await query; if (error) throw new Error(error.message); return data; }
  /** @param {import('./study-plan-types').TaskInput} input @param {string | null} [id] */
  async saveTask(input, id = null) {
    if (!input.title.trim() || input.title.trim().length > 180 || !/^\d{4}-\d{2}-\d{2}$/.test(input.planned_date)) throw new Error('Enter a task title and planned date.');
    const payload = { ...input, title: input.title.trim() };
    return this.result(id ? this.client.from('study_tasks').update(payload).eq('id', id).eq('user_id', this.context.userId).eq('class_id', this.context.classId).select().single() : this.client.from('study_tasks').insert({ ...payload, user_id: this.context.userId, class_id: this.context.classId }).select().single());
  }
  /** @param {string} id @param {boolean} completed */
  completeTask(id, completed) { return this.result(this.client.from('study_tasks').update({ completed_at: completed ? new Date().toISOString() : null }).eq('id', id).eq('user_id', this.context.userId).eq('class_id', this.context.classId).select().single()); }
  /** @param {string} table @param {string} id */
  async remove(table, id) {
    if (!['study_tasks', 'study_sessions'].includes(table)) throw new Error('Invalid study record.');
    const data = await this.result(this.client.from(table).delete().eq('id', id).eq('user_id', this.context.userId).eq('class_id', this.context.classId).select('id'));
    if (!data?.length) throw new Error('This record is no longer available. Refresh Study Plan.');
  }
  /** @param {string} subjectId @param {number} minutes */
  saveGoal(subjectId, minutes) {
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 10080) throw new Error('Enter weekly minutes between 0 and 10080.');
    return this.result(this.client.from('study_subject_goals').upsert({ user_id: this.context.userId, class_id: this.context.classId, subject_id: subjectId, weekly_minutes: minutes }, { onConflict: 'user_id,class_id,subject_id' }).select().single());
  }
  /** @param {string} id @param {string|null} subjectId @param {string|null} taskId */
  editSession(id, subjectId, taskId) { return this.result(this.client.from('study_sessions').update({ subject_id: subjectId, task_id: taskId }).eq('id', id).eq('user_id', this.context.userId).eq('class_id', this.context.classId).eq('status', 'completed').select().single()); }
  /** @param {import('./study-plan-types').TimerAction} action @param {string | null} [sessionId] @param {string | null} [subjectId] @param {string | null} [taskId] @returns {Promise<StudySession | null>} */
  async timer(action, sessionId = null, subjectId = null, taskId = null) { const value = await this.result(this.client.rpc('study_timer', { p_class_id: this.context.classId, p_action: action, p_session_id: sessionId, p_subject_id: subjectId, p_task_id: taskId })); return Array.isArray(value) ? value[0] || null : value; }
  /** @param {string} start @param {number} minutes @param {string | null} subjectId @param {string | null} taskId */
  logSession(start, minutes, subjectId, taskId) {
    const started = Date.parse(start), ended = started + minutes * 60000;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440 || !Number.isFinite(started) || ended > Date.now()) throw new Error('Enter 1–1440 minutes with an end time in the past.');
    return this.result(this.client.from('study_sessions').insert({ user_id: this.context.userId, class_id: this.context.classId, subject_id: subjectId, task_id: taskId, source: 'manual', status: 'completed', started_at: new Date(started).toISOString(), ended_at: new Date(ended).toISOString(), duration_seconds: minutes * 60 }).select().single());
  }
}
