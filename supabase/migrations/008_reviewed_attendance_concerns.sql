-- Add a distinct state for a CR/admin who has read and replied to a concern.
-- Run this migration in the Supabase SQL Editor before using the new status.

alter type public.attendance_issue_state
  add value if not exists 'reviewed';
