export interface StudyContext { userId: string; classId: string; classCode: string; className: string; timezone?: string; }
export interface StudySubject { id: string; name: string; slug?: string; short_name?: string; }
export interface StudyResource { id: string; subject_id: string | null; title: string; storage_path: string | null; kind: string; }
export interface StudyExam { name: string; starts_at: string; detail: string; subject_id: string | null; }
export interface StudyTask {
  id: string; user_id: string; class_id: string; title: string; subject_id: string | null; resource_id: string | null;
  planned_date: string; due_date: string | null; priority: 'low' | 'normal' | 'high'; completed_at: string | null;
  created_at: string; updated_at: string;
}
export type TaskInput = Pick<StudyTask, 'title' | 'subject_id' | 'resource_id' | 'planned_date' | 'due_date' | 'priority'>;
export interface StudySession {
  id: string; user_id: string; class_id: string; subject_id: string | null; task_id: string | null;
  source: 'timer' | 'manual'; status: 'running' | 'paused' | 'completed'; started_at: string;
  resumed_at: string | null; ended_at: string | null; duration_seconds: number;
}
export interface StudyGoal { id: string; user_id: string; class_id: string; subject_id: string; weekly_minutes: number; }
export interface StudySnapshot { tasks: StudyTask[]; sessions: StudySession[]; goals: StudyGoal[]; }
export interface StudyContent { subjects: StudySubject[]; resources: StudyResource[]; exams: StudyExam[]; }
export interface StudySummary {
  weekStart: string; minutes: number; completed: number; total: number; completionRate: number; streak: number;
  days: { date: string; minutes: number }[]; subjectMinutes: Record<string, number>;
}
export type TimerAction = 'start' | 'pause' | 'resume' | 'finish' | 'discard';
// The existing CDN Supabase client is intentionally kept outside the typed domain model.
export type SupabaseClient = { from(table: string): any; rpc(name: string, args: Record<string, unknown>): PromiseLike<{data: any; error: any}> };
declare global {
  interface Window {
    classboardContext?: StudyContext;
    classboardSupabase?: SupabaseClient;
    classboardSubjects?: StudySubject[];
    openClassboardAcademicsTab?: (tab: string) => void;
  }
}
