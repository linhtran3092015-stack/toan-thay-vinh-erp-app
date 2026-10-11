begin;
select plan(27);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('2c000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'phase2c-leader@example.test', '{"provider":"email"}', '{}', now(), now()),
  ('2c000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'phase2c-sale@example.test', '{"provider":"email"}', '{}', now(), now());
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '2c000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'admissions_leader';
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '2c000000-0000-4000-8000-000000000002', id, 'fixture' from public.roles where code = 'admissions_specialist';
-- The leader also needs accounting rights for the conversion checklist item 8
-- and payment rights for the pre-conversion request.
insert into public.user_role_assignments (user_id, role_id, assignment_reason)
select '2c000000-0000-4000-8000-000000000001', id, 'fixture' from public.roles where code = 'accountant';
select set_config('request.jwt.claim.sub', '2c000000-0000-4000-8000-000000000001', true);

insert into public.crm_lead_sources (id, code, name, group_code, is_active)
values ('2c000000-0000-4000-8000-000000000010', 'phase2c_mma', 'Phase 2c MMA', 'mma', true);

insert into public.academic_years (id, code, name, starts_on, ends_on, status, is_current)
values ('2c000000-0000-4000-8000-000000000011', '2019-2020', 'Năm học phase 2c', date '2019-08-01', date '2020-05-31', 'active', false);
insert into public.classes (id, academic_year_id, code, name, grade, level, status, weekly_session_count)
values ('2c000000-0000-4000-8000-000000000012', '2c000000-0000-4000-8000-000000000011', 'P2C-6A', 'Phase 2c 6A', 6, 'A', 'active', 1);

create temp table fx (key text primary key, id uuid);
insert into fx select 'case', (public.create_crm_case('Lead Phase 2c', 2014, 6, '0933333333', 'Phụ huynh 2c', 'phase2c_mma', '2c000000-0000-4000-8000-000000000002', 'A', 'offline', 1400000, null, 'Hà Nội', 'Quan tâm lớp 6')).id;

-- Assigning a lead to a sale notifies them.
select is(
  (select count(*) from public.notifications where recipient_user_id = '2c000000-0000-4000-8000-000000000002' and event_code = 'crm.lead_assigned' and entity_id = (select id::text from fx where key = 'case')),
  1::bigint, 'the assigned sale gets a lead notification');

-- 1. Trial result -------------------------------------------------------------
insert into fx select 'booking', (public.book_crm_trial_session((select id from fx where key = 'case'), date '2019-09-02', 'offline', null, 'Thử buổi thứ 2')).id;
select is((select status from public.crm_cases where id = (select id from fx where key = 'case')), 'trial_booked', 'booking moves the case to trial_booked');

select throws_ok(
  $$select public.record_crm_trial_result((select id from fx where key = 'booking'), 'maybe', null, null)$$,
  '22023', 'CRM_TRIAL_RESULT_INVALID', 'trial result must be attended / no_show / cancelled');
select lives_ok(
  $$select public.record_crm_trial_result((select id from fx where key = 'booking'), 'no_show', null, 'Phụ huynh báo bận')$$,
  'a no-show can be recorded');
select is((select status from public.crm_cases where id = (select id from fx where key = 'case')), 'interested', 'a no-show with no other booking returns the case to interested');
select throws_ok(
  $$select public.record_crm_trial_result((select id from fx where key = 'booking'), 'attended', null, null)$$,
  '23514', 'CRM_TRIAL_RESULT_ALREADY_RECORDED', 'a result cannot be recorded twice');

insert into fx select 'booking2', (public.book_crm_trial_session((select id from fx where key = 'case'), date '2019-09-09', 'offline', null, 'Thử lại')).id;
select lives_ok(
  $$select public.record_crm_trial_result((select id from fx where key = 'booking2'), 'attended', 'Tiếp thu tốt, nên vào lớp 6A', null)$$,
  'attendance can be recorded with teacher feedback');
select is((select status from public.crm_cases where id = (select id from fx where key = 'case')), 'trial_completed', 'attending the trial moves the case to trial_completed');
select is(
  (select teacher_feedback || ':' || (result_recorded_by is not null)::text from public.crm_trial_bookings where id = (select id from fx where key = 'booking2')),
  'Tiếp thu tốt, nên vào lớp 6A:true', 'the booking stores the feedback and recorder');

-- 2. Notes & follow-ups -------------------------------------------------------
select throws_ok(
  $$select public.add_crm_case_note((select id from fx where key = 'case'), '   ', null)$$,
  '22023', 'CRM_NOTE_REQUIRED', 'empty notes are refused');
insert into fx select 'note', (public.add_crm_case_note((select id from fx where key = 'case'), 'Gọi lại phụ huynh chốt lịch học', (now() at time zone 'Asia/Ho_Chi_Minh')::date - 1)).id;
select is(public.run_crm_follow_up_reminders() >= 1, true, 'an overdue follow-up creates reminders');
select is(
  (select count(*) from public.notifications where event_code = 'crm.follow_up_due' and recipient_user_id = '2c000000-0000-4000-8000-000000000002' and entity_id = (select id::text from fx where key = 'case')),
  1::bigint, 'the sale owner is reminded about the overdue follow-up');
select is(public.run_crm_follow_up_reminders(), 0, 'reminders are not duplicated within the same day');
select lives_ok($$select public.complete_crm_follow_up((select id from fx where key = 'note'))$$, 'a follow-up can be completed');
select is(
  (select follow_up_done_at is not null from public.crm_case_notes where id = (select id from fx where key = 'note')),
  true, 'the note records completion');
select is(
  (select count(*) from public.get_crm_case_notes((select id from fx where key = 'case'))),
  1::bigint, 'notes are readable through the RPC');

-- 3. Pending confirmation creates a provisional student for payment requests --
select throws_ok(
  $$select public.advance_crm_case_status((select id from fx where key = 'case'), 'converted', null)$$,
  '22023', 'CRM_TARGET_STATUS_INVALID', 'conversion is not a manual status change');
select lives_ok(
  $$select public.advance_crm_case_status((select id from fx where key = 'case'), 'pending_enrollment_confirmation', null)$$,
  'a trialled lead can move to pending confirmation');
insert into fx select 'student', student_id from public.crm_cases where id = (select id from fx where key = 'case');
select is(
  (select lifecycle_status from public.students where id = (select id from fx where key = 'student')),
  'pending_enrollment_confirmation', 'a provisional student record is created');
select is(
  (select count(*) from public.student_guardians where student_id = (select id from fx where key = 'student') and is_primary),
  1::bigint, 'the guardian is linked as primary');

insert into fx select 'request', (public.create_student_payment_request((select id from fx where key = 'student'), 1400000, 10, 0, 140000, 'new', null)->>'id')::uuid;
select is(
  (select crm_case_id from public.student_payment_requests where id = (select id from fx where key = 'request')),
  (select id from fx where key = 'case'), 'the payment request is linked to the CRM case');

-- 4. Drop and reopen ----------------------------------------------------------
select throws_ok(
  $$select public.advance_crm_case_status((select id from fx where key = 'case'), 'dropped', '')$$,
  '22023', 'CRM_STATUS_REASON_REQUIRED', 'dropping needs a reason');
select lives_ok(
  $$select public.advance_crm_case_status((select id from fx where key = 'case'), 'dropped', 'Phụ huynh chọn trung tâm khác')$$,
  'a lead can be dropped with a reason');
select is(
  (select status || ':' || drop_reason from public.crm_cases where id = (select id from fx where key = 'case')),
  'dropped:Phụ huynh chọn trung tâm khác', 'the drop reason is stored');
select lives_ok(
  $$select public.advance_crm_case_status((select id from fx where key = 'case'), 'interested', 'Phụ huynh liên hệ lại')$$,
  'a dropped lead can be reopened');

-- 5. Conversion reuses the provisional student and recognises the paid request --
select lives_ok($$select public.advance_crm_case_status((select id from fx where key = 'case'), 'pending_enrollment_confirmation', null)$$, 'back to pending confirmation');
update public.student_payment_requests set status = 'paid', paid_amount_vnd = 1400000, paid_at = now() where id = (select id from fx where key = 'request');
select is(
  (select id from public.convert_crm_case_to_official_student(
    (select id from fx where key = 'case'), '2c000000-0000-4000-8000-000000000012', date '2019-09-16', 'offline',
    '{"item_2_source_confirmed":true,"item_3_sale_confirmed":true,"item_4_class_selected":true,"item_5_mode_confirmed":true,"item_6_fee_confirmed":true,"item_7_assistant_sessions_confirmed":true,"item_8_accountant_transaction_confirmed":true,"item_9_official_start_date_entered":true,"item_10_communication_group_ready":true}'::jsonb
  )),
  (select id from fx where key = 'student'), 'conversion reuses the provisional student and item 1 comes from the paid request');

select * from finish();
rollback;
