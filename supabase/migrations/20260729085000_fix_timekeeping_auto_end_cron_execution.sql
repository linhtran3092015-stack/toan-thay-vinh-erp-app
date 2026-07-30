begin;

-- The pg_cron job has no authenticated JWT. This function remains protected
-- because it has no public execute grant and is only invoked by trusted
-- SECURITY DEFINER workflows or the scheduler.
create or replace function public.auto_end_stale_teaching_assistant_time_entries()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  business_date date := (
    pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh'
  )::date;
  business_time time without time zone := (
    pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh'
  )::time;
  closed_count integer := 0;
begin
  update public.time_entries as entry
  set
    check_out_at = (
      entry.work_date::timestamp
      + time '23:30'
    ) at time zone 'Asia/Ho_Chi_Minh',
    check_out_mode = 'auto_end',
    status = 'auto_ended',
    auto_ended_at = (
      entry.work_date::timestamp
      + time '23:30'
    ) at time zone 'Asia/Ho_Chi_Minh',
    updated_at = pg_catalog.now()
  where entry.status = 'open'
    and exists (
      select 1
      from public.user_role_assignments as assignment
      join public.roles as role
        on role.id = assignment.role_id
        and role.code = 'teaching_assistant'
        and role.is_active
      where assignment.user_id = entry.staff_id
        and assignment.revoked_at is null
    )
    and (
      entry.work_date < business_date
      or (
        entry.work_date = business_date
        and business_time >= time '23:30'
      )
    );

  get diagnostics closed_count = row_count;

  return closed_count;
end;
$$;

revoke all on function public.auto_end_stale_teaching_assistant_time_entries()
from public, anon, authenticated;

commit;
