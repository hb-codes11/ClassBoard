-- Read-only. Run after 044 to review assignments deliberately skipped on collision.
-- Resolve each account with the founders; do not bulk clear or reassign rolls.
with roster as (
  select 'INTEL-2' as code, email, roll_number from public.intel2_student_roster
  union all
  select 'IBM-1', email, roll_number from public.ibm1_student_roster
)
select c.code as section, r.roll_number as requested_roll,
       u.id as candidate_user_id, u.email as candidate_email,
       existing.user_id as current_holder_id, holder.email as current_holder_email
from roster r
join public.classes c on c.code = r.code
join auth.users u on lower(u.email) = r.email
join public.class_memberships existing on existing.class_id = c.id
  and existing.role = 'student' and existing.is_active
  and existing.roll_number = r.roll_number and existing.user_id <> u.id
join auth.users holder on holder.id = existing.user_id
where u.email_confirmed_at is not null
  and not exists (select 1 from public.classboard_founders f where f.user_id = u.id)
order by c.code, r.roll_number;
