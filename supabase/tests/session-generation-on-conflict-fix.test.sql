begin;
select plan(8);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('2f000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'onconflict-manager@example.test', '{"provider":"email"}', '{}', now(), now());
insert into public.roles (id, code, name) values ('2f000000-0000-4000-8000-000000000003', 'onconflict_sessions', 'On-conflict fix test');
insert into public.role_permissions (role_id, permission_id)
select '2f000000-0000-4000-8000-000000000003', id from public.permissions
where code in ('sessions.manage', 'sessions.view');
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
values ('2f000000-0000-4000-8000-000000000001', '2f000000-0000-4000-8000-000000000003', 'fixture');
select set_config('request.jwt.claim.sub', '2f000000-0000-4000-8000-000000000001', true);

insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('2f000000-0000-4000-8000-000000000010', '2020-2021', 'Năm học on-conflict', date '2024-08-01', date '2025-05-31', 'active', false);
insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count)
values ('2f000000-0000-4000-8000-000000000011', '2f000000-0000-4000-8000-000000000010', 'OC-7A', 'On-conflict 7A', 7, 'A', 'active', 1);
insert into public.class_schedule_templates (id, class_id, weekday, start_time, end_time, learning_mode, effective_from)
values ('2f000000-0000-4000-8000-000000000021', '2f000000-0000-4000-8000-000000000011', 1, time '18:00', time '19:30', 'hybrid', date '2024-08-01');

-- 1. Batch creation from a template works again (was 42P10 after Đợt 2a).
select lives_ok(
  $$select public.create_batch_class_sessions(
      '2f000000-0000-4000-8000-000000000011',
      '[{"session_date":"2024-08-05","start_time":"18:00","end_time":"19:30","schedule_template_id":"2f000000-0000-4000-8000-000000000021","learning_mode":"hybrid"},
        {"session_date":"2024-08-12","start_time":"18:00","end_time":"19:30","schedule_template_id":"2f000000-0000-4000-8000-000000000021","learning_mode":"hybrid"}]'::jsonb,
      'test')$$,
  'batch creation from a schedule template succeeds');
select is(
  (select count(*)::int from public.class_sessions where schedule_template_id = '2f000000-0000-4000-8000-000000000021'),
  2, 'two regular sessions were created');

-- 2. Re-running the same batch is idempotent (duplicates skipped, not an error).
select is(
  (select (public.create_batch_class_sessions(
      '2f000000-0000-4000-8000-000000000011',
      '[{"session_date":"2024-08-05","start_time":"18:00","end_time":"19:30","schedule_template_id":"2f000000-0000-4000-8000-000000000021","learning_mode":"hybrid"}]'::jsonb,
      'test')->>'created_count')::int),
  0, 'an existing template date is skipped');

-- 3. After cancelling a session the slot can be filled again by the batch.
select lives_ok($$select public.cancel_class_session((select id from public.class_sessions where schedule_template_id = '2f000000-0000-4000-8000-000000000021' and session_date = date '2024-08-12'), 'Nghỉ lễ')$$, 'cancel one session');
select is(
  (select (public.create_batch_class_sessions(
      '2f000000-0000-4000-8000-000000000011',
      '[{"session_date":"2024-08-12","start_time":"18:00","end_time":"19:30","schedule_template_id":"2f000000-0000-4000-8000-000000000021","learning_mode":"hybrid"}]'::jsonb,
      'test')->>'created_count')::int),
  1, 'the cancelled slot is re-created');
select is(
  (select count(*)::int from public.class_sessions where schedule_template_id = '2f000000-0000-4000-8000-000000000021' and status <> 'cancelled'),
  2, 'two live sessions remain');

-- 4. Year-wide materialisation uses the same predicate and also works.
select lives_ok(
  $$select public.materialize_class_sessions('2f000000-0000-4000-8000-000000000010', date '2024-08-19', date '2024-08-26', true, 'test')$$,
  'materialize_class_sessions succeeds with backfill');
select is(
  (select count(*)::int from public.class_sessions where schedule_template_id = '2f000000-0000-4000-8000-000000000021' and status <> 'cancelled'),
  4, 'two more Mondays were materialised');

select * from finish();
rollback;
