begin;
select plan(24);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('2a000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'phase2a-manager@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('2a000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'phase2a-nobody@example.test', '{"provider":"email"}', '{}', now(), now());
insert into public.roles (id, code, name) values ('2a000000-0000-4000-8000-000000000003', 'phase2a_sessions', 'Phase 2a sessions test');
insert into public.role_permissions (role_id, permission_id)
select '2a000000-0000-4000-8000-000000000003', id from public.permissions
where code in ('attendance.mark', 'classes.create', 'sessions.lock', 'sessions.manage', 'sessions.view', 'settings.manage');
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
values ('2a000000-0000-4000-8000-000000000001', '2a000000-0000-4000-8000-000000000003', 'fixture');
select set_config('request.jwt.claim.sub', '2a000000-0000-4000-8000-000000000001', true);

insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('2a000000-0000-4000-8000-000000000010', '2021-2022', 'Năm học phase 2a', date '2024-08-01', date '2025-05-31', 'active', false);
insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count)
values ('2a000000-0000-4000-8000-000000000011', '2a000000-0000-4000-8000-000000000010', 'P2A-7A', 'Phase 2a 7A', 7, 'A', 'active', 1);
insert into public.class_schedule_templates (id, class_id, weekday, start_time, end_time, learning_mode, effective_from)
values ('2a000000-0000-4000-8000-000000000021', '2a000000-0000-4000-8000-000000000011', 1, time '18:00', time '19:30', 'offline', date '2024-08-01');
-- Two Monday sessions from the same template.
insert into public.class_sessions (id, class_id, schedule_template_id, session_date, session_kind, start_time, end_time, learning_mode, status) values
  ('2a000000-0000-4000-8000-000000000031', '2a000000-0000-4000-8000-000000000011', '2a000000-0000-4000-8000-000000000021', date '2024-08-05', 'regular', time '18:00', time '19:30', 'offline', 'scheduled'),
  ('2a000000-0000-4000-8000-000000000032', '2a000000-0000-4000-8000-000000000011', '2a000000-0000-4000-8000-000000000021', date '2024-08-12', 'regular', time '18:00', time '19:30', 'offline', 'scheduled');
insert into public.students (id, public_code, full_name, birth_year, current_grade, lifecycle_status) values
  ('2a000000-0000-4000-8000-000000000041', 'TV-2024-20041', 'Học sinh 2a Một', 2012, 7, 'active'),
  ('2a000000-0000-4000-8000-000000000042', 'TV-2024-20042', 'Học sinh 2a Hai', 2012, 7, 'active');
insert into public.student_enrollments (id, student_id, class_id, registered_mode, status, effective_from, effective_to) values
  ('2a000000-0000-4000-8000-000000000051', '2a000000-0000-4000-8000-000000000041', '2a000000-0000-4000-8000-000000000011', 'offline', 'active', date '2024-08-01', null),
  ('2a000000-0000-4000-8000-000000000052', '2a000000-0000-4000-8000-000000000042', '2a000000-0000-4000-8000-000000000011', 'offline', 'active', date '2024-08-01', null);

-- 1. Reschedule -------------------------------------------------------------
select throws_ok(
  $$update public.class_sessions set session_date = date '2024-08-07' where id = '2a000000-0000-4000-8000-000000000031'$$,
  '23514', 'CLASS_SESSION_IDENTITY_IS_IMMUTABLE', 'direct schedule edits stay blocked');

select lives_ok(
  $$select public.update_class_session('2a000000-0000-4000-8000-000000000031', date '2024-08-07', time '18:30', time '20:00', 'offline', 'Phòng 2', null, 'Dời vì thầy bận', 'Dời buổi theo yêu cầu phụ huynh')$$,
  'a scheduled regular session can move to another weekday');
select is(
  (select session_date::text || ' ' || start_time::text || ' ' || coalesce(previous_session_date::text, 'null') || ' ' || reschedule_count::text || ' ' || coalesce(room_name, '-')
   from public.class_sessions where id = '2a000000-0000-4000-8000-000000000031'),
  '2024-08-07 18:30:00 2024-08-05 1 Phòng 2', 'the row keeps the previous schedule and counts the move');
select is(
  (select rescheduled_by from public.class_sessions where id = '2a000000-0000-4000-8000-000000000031'),
  '2a000000-0000-4000-8000-000000000001'::uuid, 'the actor is recorded');

select throws_ok(
  $$select public.update_class_session('2a000000-0000-4000-8000-000000000031', date '2024-08-12', time '20:00', time '21:00', 'offline', null, null, null, 'trùng ngày')$$,
  '23505', 'CLASS_SESSION_DATE_CONFLICT', 'moving onto another date of the same template is refused');

insert into public.class_sessions (id, class_id, session_date, session_kind, start_time, end_time, learning_mode, status)
values ('2a000000-0000-4000-8000-000000000033', '2a000000-0000-4000-8000-000000000011', date '2024-08-07', 'additional', time '17:00', time '18:45', 'offline', 'scheduled');
select throws_ok(
  $$select public.update_class_session('2a000000-0000-4000-8000-000000000031', date '2024-08-07', time '18:30', time '20:00', 'offline', null, null, null, 'chồng giờ')$$,
  '23505', 'CLASS_SESSION_TIME_CONFLICT', 'overlapping times on the same day are refused');
select lives_ok(
  $$select public.update_class_session('2a000000-0000-4000-8000-000000000033', date '2024-08-07', time '16:00', time '17:30', 'online', null, 'https://meet.example.test/p2a', null, 'đổi giờ buổi bổ sung')$$,
  'an additional session can be moved earlier');

select throws_ok(
  $$select public.update_class_session('2a000000-0000-4000-8000-000000000031', date '2024-08-07', time '18:30', time '20:00', 'offline', null, null, null, 'x')$$,
  '22023', 'CLASS_SESSION_RESCHEDULE_REASON_REQUIRED', 'a reason is required');

-- Cancelled sessions no longer block re-creating the slot.
select lives_ok($$select public.cancel_class_session('2a000000-0000-4000-8000-000000000032', 'Nghỉ lễ')$$, 'cancel the second Monday');
select lives_ok(
  $$insert into public.class_sessions (class_id, schedule_template_id, session_date, session_kind, start_time, end_time, learning_mode, status)
    values ('2a000000-0000-4000-8000-000000000011', '2a000000-0000-4000-8000-000000000021', date '2024-08-12', 'regular', time '18:00', time '19:30', 'offline', 'scheduled')$$,
  'the same template date can be created again after a cancellation');
select throws_ok(
  $$select public.update_class_session('2a000000-0000-4000-8000-000000000032', date '2024-08-13', time '18:00', time '19:30', 'offline', null, null, null, 'đã hủy')$$,
  '23514', 'CLASS_SESSION_RESCHEDULE_STATUS_INVALID', 'a cancelled session cannot be rescheduled');

-- 2. Lock queue ----------------------------------------------------------------
select lives_ok($$select public.start_class_session('2a000000-0000-4000-8000-000000000031')$$, 'start the moved session');
select lives_ok($$select public.mark_session_attendance('2a000000-0000-4000-8000-000000000031', '2a000000-0000-4000-8000-000000000041', 'present', 'offline', null)$$, 'mark student one');
select lives_ok($$select public.complete_class_session('2a000000-0000-4000-8000-000000000031')$$, 'complete the session with one student still unmarked');

select is(
  (select missing_attendance_count || ':' || roster_count || ':' || coalesce(auto_lock_on::text, 'null')
   from public.get_unlocked_completed_sessions() where class_session_id = '2a000000-0000-4000-8000-000000000031'),
  '1:2:null', 'the queue reports the missing attendance and no auto-lock date while incomplete');

select set_config('request.jwt.claim.sub', '2a000000-0000-4000-8000-000000000002', true);
select throws_ok($$select * from public.get_unlocked_completed_sessions()$$, '42501', 'SESSION_VIEW_PERMISSION_DENIED', 'the queue needs sessions.view');
select set_config('request.jwt.claim.sub', '2a000000-0000-4000-8000-000000000001', true);

select lives_ok($$select public.mark_session_attendance('2a000000-0000-4000-8000-000000000031', '2a000000-0000-4000-8000-000000000042', 'excused_absence', 'offline', null)$$, 'mark student two after completion');
select is(
  (select auto_lock_on from public.get_unlocked_completed_sessions() where class_session_id = '2a000000-0000-4000-8000-000000000031'),
  ((now() at time zone 'Asia/Ho_Chi_Minh')::date + 3), 'with full attendance the auto-lock date is completion + 3 days by default');

-- Backdate the completion so the worker and reminders see an old session.
alter table public.class_sessions disable trigger class_sessions_protect_history;
alter table public.class_sessions disable trigger class_sessions_validate_business_rules;
update public.class_sessions set started_at = now() - interval '4 days 2 hours', completed_at = now() - interval '4 days' where id = '2a000000-0000-4000-8000-000000000031';
alter table public.class_sessions enable trigger class_sessions_protect_history;
alter table public.class_sessions enable trigger class_sessions_validate_business_rules;

-- Workers run from pg_cron without a JWT.
select set_config('request.jwt.claim.sub', '', true);
select is(public.run_class_session_lock_reminders() >= 1, true, 'reminders are created for an old unlocked session');
select is(
  (select count(*) from public.notifications where recipient_user_id = '2a000000-0000-4000-8000-000000000001' and dedupe_key = 'session.lock_reminder:2a000000-0000-4000-8000-000000000031'),
  1::bigint, 'the completer gets one reminder for the session');
select is(public.run_class_session_lock_reminders(), 0, 'running reminders again does not duplicate notifications');

select is(public.run_class_session_auto_lock_worker(), 1, 'the worker locks the session that is past the threshold');
select is(
  (select locked_by::text || ':' || (lock_reason like 'Tự động khóa%')::text from public.class_sessions where id = '2a000000-0000-4000-8000-000000000031'),
  '2a000000-0000-4000-8000-000000000001:true', 'auto-lock attributes the lock to the completer with an explicit reason');
select is(
  (select count(*) from public.student_session_ledger_entries where class_session_id = '2a000000-0000-4000-8000-000000000031' and entry_type = 'session_charge'),
  2::bigint, 'auto-lock charges every recorded student');
select set_config('request.jwt.claim.sub', '2a000000-0000-4000-8000-000000000001', true);

select * from finish();
rollback;
