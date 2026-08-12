-- Migration: 20260813033000_refine_ta_role_detection_security.sql
-- Description: Enforce strict canonical role codes ('teaching_assistant', 'tro_giang') and revoke public execute on is_user_teaching_assistant.

-- 1. Update is_user_teaching_assistant helper to strict canonical codes
create or replace function public.is_user_teaching_assistant(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_role_assignments as assignment
    join public.roles as role
      on role.id = assignment.role_id
      and role.is_active
      and pg_catalog.lower(role.code) in ('teaching_assistant', 'tro_giang')
    where assignment.user_id = p_user_id
      and assignment.revoked_at is null
  );
$$;

-- 2. Revoke execute privileges from public/anon/authenticated to prevent external RPC execution
revoke all on function public.is_user_teaching_assistant(uuid) from public, anon, authenticated;
