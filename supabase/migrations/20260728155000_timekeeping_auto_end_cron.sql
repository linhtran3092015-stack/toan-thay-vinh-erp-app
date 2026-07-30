begin;

-- Supabase Cron schedules in UTC. 16:30 UTC is 23:30 in Asia/Ho_Chi_Minh,
-- which has no daylight-saving-time adjustment.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_extension
    where extname = 'pg_cron'
  ) then
    raise exception using
      errcode = '55000',
      message = 'PG_CRON_EXTENSION_REQUIRED_FOR_TIMEKEEPING_AUTO_END';
  end if;
end;
$$;

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'timekeeping-auto-end-teaching-assistants'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'timekeeping-auto-end-teaching-assistants',
    '30 16 * * *',
    'select public.auto_end_stale_teaching_assistant_time_entries();'
  );
end;
$$;

commit;
