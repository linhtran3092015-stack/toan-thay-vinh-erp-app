begin;
select plan(16);

-- Fixtures: an owner, a class session with a test, and AI grading switched on by the owner.
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('3e300000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'ai-cron-owner@example.test', '{"provider":"email"}', '{}', now(), now());
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '3e300000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'owner';
select set_config('request.jwt.claim.sub', '3e300000-0000-4000-8000-000000000001', true);

insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('3e300000-0000-4000-8000-000000000010', '2013-2014', 'Năm học lịch AI', date '2013-08-01', date '2014-05-31', 'active', false);
insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count)
values ('3e300000-0000-4000-8000-000000000011', '3e300000-0000-4000-8000-000000000010', 'AC-6A', 'Cron 6A', 6, 'A', 'active', 1);
insert into public.class_sessions (id, class_id, session_date, session_kind, start_time, end_time, learning_mode, status)
values ('3e300000-0000-4000-8000-000000000031', '3e300000-0000-4000-8000-000000000011', date '2013-10-22', 'additional', time '18:00', time '19:30', 'offline', 'scheduled');
create temporary table ids (name text primary key, id uuid) on commit drop;
insert into ids select 'test', public.create_session_test('3e300000-0000-4000-8000-000000000031');

-- 1. Setup -------------------------------------------------------------------------------
select ok(exists (select 1 from pg_extension where extname = 'pg_net'), 'pg_net is installed');
select is((select schedule from cron.job where jobname = 'ai-grading-worker-kick'), '*/5 * * * *', 'the database calls the worker every 5 minutes');
select is((select command from cron.job where jobname = 'ai-grading-worker-kick'), 'select public.kick_ai_grading_worker();', 'the job runs the kick');
select ok(
  not has_function_privilege('authenticated', 'public.kick_ai_grading_worker()', 'execute')
  and not has_function_privilege('anon', 'public.kick_ai_grading_worker()', 'execute')
  and not has_function_privilege('service_role', 'public.kick_ai_grading_worker()', 'execute'),
  'only the database itself runs the kick');

-- 2. When it stays quiet -----------------------------------------------------------------
select public.update_system_settings('{"ai_grading.enabled": "off"}'::jsonb);
select is(public.kick_ai_grading_worker(), 'disabled', 'nothing is sent while AI grading is off');
select public.update_system_settings('{"ai_grading.enabled": "on"}'::jsonb);
select is(public.kick_ai_grading_worker(), 'not_configured', 'nothing is sent before the Vault secrets exist');
select vault.create_secret('https://erp.example.test/api/internal/ai-grading/worker', 'ai_grading_worker_url');
select vault.create_secret('cron-secret-for-tests', 'ai_grading_cron_secret');
select is(public.kick_ai_grading_worker(), 'idle', 'nothing is sent while no run waits');
update public.ai_grading_worker_state set paused_until = now() + interval '1 hour', pause_reason = 'billing' where id;
insert into public.grading_runs (run_type, test_id, model, prompt_version, effort)
values ('extract_key', (select id from ids where name = 'test'), 'claude-opus-5-5', 'key-v1', 'high');
select is(public.kick_ai_grading_worker(), 'paused', 'nothing is sent while the queue is paused');
update public.ai_grading_worker_state set paused_until = null, pause_reason = null where id;

-- 3. A run waits: one HTTP call with the secret -----------------------------------------
select is(public.kick_ai_grading_worker(), 'kicked', 'a waiting run makes the database call the worker');
select is(
  (select array[method::text, url, headers ->> 'Authorization', timeout_milliseconds::text] from net.http_request_queue
   where id = (select last_kick_request_id from public.ai_grading_worker_state where id)),
  array['POST', 'https://erp.example.test/api/internal/ai-grading/worker', 'Bearer cron-secret-for-tests', '300000'],
  'the call is a POST to the worker with the Bearer secret and a timeout longer than the worker');
select ok((select last_kick_at is not null from public.ai_grading_worker_state where id), 'the kick time is recorded');

-- A run another worker holds is not a reason to call again; one whose worker died is.
update public.grading_runs set status = 'running', locked_until = now() + interval '5 minutes' where test_id = (select id from ids where name = 'test');
select is(public.kick_ai_grading_worker(), 'idle', 'a run still held by a worker does not trigger a call');
update public.grading_runs set locked_until = now() - interval '1 minute' where test_id = (select id from ids where name = 'test');
select is(public.kick_ai_grading_worker(), 'kicked', 'a run whose worker stopped triggers a call');

-- 4. A refused call is reported ---------------------------------------------------------
insert into net._http_response (id, status_code, content, timed_out, created)
values ((select last_kick_request_id from public.ai_grading_worker_state where id), 401, '{"ok":false}', false, now());
select is(public.kick_ai_grading_worker(), 'kicked', 'the queue is still kicked');
select is(
  (select message from public.notifications
   where event_code = 'ops.ai_grading_kick_failed' and recipient_user_id = '3e300000-0000-4000-8000-000000000001'),
  'Lần gọi worker gần nhất từ cơ sở dữ liệu trả về HTTP 401. Kiểm tra CRON_SECRET trên Vercel và secret ai_grading_cron_secret trong Supabase Vault có giống nhau không.',
  'the owner hears that the last call was refused');
insert into net._http_response (id, status_code, content, timed_out, created)
values ((select last_kick_request_id from public.ai_grading_worker_state where id), 401, '{"ok":false}', false, now());
select public.kick_ai_grading_worker();
select is(
  (select count(*)::integer from public.notifications where event_code = 'ops.ai_grading_kick_failed'
     and recipient_user_id = '3e300000-0000-4000-8000-000000000001'),
  1, 'a second refused call in the same hour does not repeat the alert');

select * from finish();
rollback;
