begin;

select plan(11);

select is(
  (select count(*) from pg_extension where extname = 'pg_cron'),
  1::bigint,
  'pg_cron is installed exactly once'
);

select is(
  to_regclass('cron.job')::text,
  'cron.job',
  'cron.job relation resolves'
);

select is(
  (
    select count(*)
    from cron.job
    where jobname = 'timekeeping-auto-end-teaching-assistants'
  ),
  1::bigint,
  'the Timekeeping auto-end job exists exactly once'
);

select is(
  (
    select schedule
    from cron.job
    where jobname = 'timekeeping-auto-end-teaching-assistants'
  ),
  '30 16 * * *',
  'the Timekeeping auto-end job uses the 16:30 UTC / Vietnam 23:30 schedule'
);

select is(
  (
    select active
    from cron.job
    where jobname = 'timekeeping-auto-end-teaching-assistants'
  ),
  true,
  'the Timekeeping auto-end job is active'
);

select is(
  (
    select database
    from cron.job
    where jobname = 'timekeeping-auto-end-teaching-assistants'
  ),
  'postgres',
  'the Timekeeping auto-end job targets the postgres database'
);

select is(
  (
    select username
    from cron.job
    where jobname = 'timekeeping-auto-end-teaching-assistants'
  ),
  'postgres',
  'the Timekeeping auto-end job runs as postgres'
);

select is(
  (
    select trim(regexp_replace(command, '\s+', ' ', 'g'))
    from cron.job
    where jobname = 'timekeeping-auto-end-teaching-assistants'
  ),
  'select public.auto_end_stale_teaching_assistant_time_entries();',
  'the Timekeeping auto-end job invokes the expected function'
);

select ok(
  to_regprocedure('public.auto_end_stale_teaching_assistant_time_entries()') is not null,
  'the Timekeeping auto-end target function resolves'
);

select is(
  (
    select count(*)
    from supabase_migrations.schema_migrations
    where version = '20260728155000'
  ),
  1::bigint,
  'the Timekeeping cron migration is present in migration history'
);

select is(
  (
    select count(*)
    from supabase_migrations.schema_migrations
    where version = '20260729085000'
  ),
  1::bigint,
  'the Timekeeping cron execution migration is present in migration history'
);

select * from finish();

rollback;
