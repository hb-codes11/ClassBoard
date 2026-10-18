-- ClassBoard: allow new Auth users only when their email ends in
-- @medicaps.ac.in. Configure this function as Supabase's
-- Authentication > Hooks > Before User Created hook after running this SQL.
--
-- The hook applies during new account creation (including first Google sign-in
-- and email sign-up). It does not sign out or remove users that already exist.

create or replace function public.only_medicaps_email(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  email_address text;
begin
  email_address := lower(coalesce(event->'user'->>'email', ''));

  -- Supabase validates general email syntax. This enforces the exact college
  -- domain and rejects subdomains, trailing text, spaces, and missing local parts.
  if email_address ~ '^[^@[:space:]]+@medicaps[.]ac[.]in$' then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Use your @medicaps.ac.in college email address.'
    )
  );
end;
$function$;

-- Supabase Auth calls the hook using this dedicated database role.
revoke all on function public.only_medicaps_email(jsonb) from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.only_medicaps_email(jsonb) to supabase_auth_admin;
