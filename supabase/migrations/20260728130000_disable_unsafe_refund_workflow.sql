-- The legacy direct refund RPC bypasses the required request, accounting,
-- owner approval, FIFO, bonus exclusion, and commission clawback workflow.
-- Keep the historical function definition immutable, but prevent application roles
-- from invoking it until the complete refund workflow is delivered.

begin;

revoke all on function public.process_student_refund(
  uuid,
  bigint,
  integer,
  text
) from public, anon, authenticated, service_role;

commit;
