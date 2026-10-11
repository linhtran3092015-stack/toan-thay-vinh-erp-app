begin;

select plan(35);

select ok(
  exists (select 1 from public.tuition_receipt_template_versions where version_number = 1),
  'the default structured tuition notice template is seeded'
);

insert into public.sepay_receiving_account_versions (
  purpose, bank_code, account_number, account_display_name, effective_from
) values (
  'renewal', 'VCB', '1900123456', 'Renewal Account A', date '2026-08-01'
);

select is(
  (select account_number from public.sepay_receiving_account_versions where purpose = 'renewal'),
  '1900123456',
  'renewal account exposes only parent-visible destination metadata'
);

select throws_ok(
  $$insert into public.sepay_receiving_account_versions (purpose, bank_code, account_number, account_display_name, effective_from) values ('renewal','ACB','999999','Renewal Account B',date '2026-08-15')$$,
  '23P01',
  null,
  'overlapping active renewal receiving-account versions are rejected'
);

update public.sepay_receiving_account_versions
set effective_to = date '2026-08-31'
where purpose = 'renewal';

insert into public.sepay_receiving_account_versions (
  purpose, bank_code, account_number, account_display_name, effective_from
) values (
  'renewal', 'ACB', '999999', 'Renewal Account B', date '2026-09-01'
);

insert into public.sepay_receiving_account_versions (
  purpose, bank_code, account_number, account_display_name, effective_from, effective_to
) values (
  'new_enrollment', 'MB', '0100123456', 'New Enrollment Account', date '2026-08-01', date '2026-08-31'
);

select is(
  (select purpose from public.resolve_sepay_receiving_account('0100 123 456', timestamptz '2026-08-31 16:00:00+00')),
  'new_enrollment',
  'a signed new-enrollment account resolves from the canonical catalog'
);

select is(
  (select purpose from public.resolve_sepay_receiving_account('0999999999', timestamptz '2026-09-02 01:00:00+00')),
  'unknown',
  'an unknown signed account remains unknown and cannot be inferred from payment content'
);

select throws_ok(
  $$insert into public.sepay_receiving_account_versions (purpose, bank_code, account_number, account_display_name, effective_from) values ('new_enrollment','VCB','1900123456','Conflicting Account A',date '2026-08-15')$$,
  '23P01',
  null,
  'the same signed account identity cannot map to a conflicting purpose during an overlapping range'
);

select lives_ok(
  $$insert into public.sepay_receiving_account_versions (purpose, bank_code, account_number, account_display_name, effective_from) values ('new_enrollment','VCB','1900123456','Account A later purpose',date '2026-09-01')$$,
  'the same signed identity may be reused after its historical effective range ends'
);

select is(
  (select purpose from public.resolve_sepay_receiving_account('1900123456', timestamptz '2026-08-31 16:00:00+00')),
  'renewal',
  'Account A resolves as renewal using the Vietnam business date at the historical transaction time'
);

select is(
  (select purpose from public.resolve_sepay_receiving_account('999999', timestamptz '2026-09-01 00:01:00+07')),
  'renewal',
  'Account B resolves as renewal at its future effective transaction time'
);

select is(
  (select purpose from public.resolve_sepay_receiving_account('1900123456', timestamptz '2026-08-31 16:00:00+00')),
  'renewal',
  'a webhook retried after Account B is current retains Account A renewal classification when it passes the signed August transaction timestamp'
);

select is(
  (select account_number from public.sepay_receiving_account_versions where purpose = 'renewal' and effective_from = date '2026-08-01'),
  '1900123456',
  'closing Account A does not rewrite its historical public account record'
);

insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('71000000-0000-0000-0000-000000000001','authenticated','authenticated','tuition-wave@example.test','{"provider":"email"}','{"full_name":"Tuition Wave"}',now(),now());
insert into public.roles (id,code,name) values ('72000000-0000-0000-0000-000000000001','tuitionwaveowner','Tuition Wave test owner');
insert into public.role_permissions(role_id,permission_id)
select '72000000-0000-0000-0000-000000000001',id from public.permissions where code in ('tuition_periods.lock','tuition_periods.manage','tuition_periods.view','tuition_periods.adjust');
insert into public.user_role_assignments(user_id,role_id,assignment_reason) values ('71000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001','Tuition Wave test');
select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000001',true);

insert into public.tuition_collection_periods(id,name,starts_on,ends_on,status,created_by)
values ('7a000000-0000-0000-0000-000000000003','Kỳ chưa có tài khoản',date '2026-07-01',date '2026-07-31','draft','71000000-0000-0000-0000-000000000001');
select throws_ok($$select public.lock_tuition_collection_period('7a000000-0000-0000-0000-000000000003')$$,'P0001','RENEWAL_RECEIVING_ACCOUNT_BLOCKER','missing effective renewal account blocks lock without an ENV fallback');

insert into public.academic_years(id,code,name,starts_on,ends_on,status,is_current)
values ('73000000-0000-0000-0000-000000000001','2026-2027','Năm học 2026-2027',date '2026-08-01',date '2027-05-31','active',true);
insert into public.classes(id,academic_year_id,code,name,grade,level,status)
values ('74000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','T2601','Lớp Wave A',6,'A','active');
insert into public.class_schedule_templates(id,class_id,weekday,start_time,end_time,learning_mode,effective_from)
values ('75000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000001',1,time '18:00',time '19:30','offline',date '2026-08-01');
insert into public.class_schedule_templates(id,class_id,weekday,start_time,end_time,learning_mode,effective_from)
values ('75000000-0000-0000-0000-000000000002','74000000-0000-0000-0000-000000000001',2,time '18:00',time '19:30','offline',date '2026-08-01');
insert into public.guardians(id,full_name,phone) values ('76000000-0000-0000-0000-000000000001','Phụ huynh Wave','0900000001');
insert into public.students(id,public_code,full_name,birth_year,current_grade,lifecycle_status)
values ('77000000-0000-0000-0000-000000000001','TV-2026-70001','Học viên Wave',2014,6,'active');
insert into public.student_guardians(student_id,guardian_id,relationship,is_primary)
values ('77000000-0000-0000-0000-000000000001','76000000-0000-0000-0000-000000000001','parent',true);
insert into public.student_enrollments(id,student_id,class_id,registered_mode,status,effective_from)
values ('78000000-0000-0000-0000-000000000001','77000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000001','offline','active',date '2026-08-01');
insert into public.student_acquisition_source_assignments(student_id,lead_source_id,reason,assigned_by)
select '77000000-0000-0000-0000-000000000001',id,'Nguồn fixture','71000000-0000-0000-0000-000000000001' from public.crm_lead_sources where code='direct_walkin';
insert into public.student_tuition_rate_versions(student_id,effective_from,unit_price_vnd,reason,created_by)
values ('77000000-0000-0000-0000-000000000001',date '2026-08-01',150000,'Giá tháng tám','71000000-0000-0000-0000-000000000001'),('77000000-0000-0000-0000-000000000001',date '2026-09-01',170000,'Giá tháng chín','71000000-0000-0000-0000-000000000001');
insert into public.class_sessions(id,class_id,schedule_template_id,session_date,session_kind,start_time,end_time,learning_mode,status)
values ('79000000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',date '2026-08-03','regular',time '18:00',time '19:30','offline','scheduled'),('79000000-0000-0000-0000-000000000002','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',date '2026-08-10','regular',time '18:00',time '19:30','offline','scheduled'),('79000000-0000-0000-0000-000000000003','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',date '2026-09-07','regular',time '18:00',time '19:30','offline','scheduled');
insert into public.class_sessions(id,class_id,schedule_template_id,session_date,session_kind,start_time,end_time,learning_mode,status)
values ('79000000-0000-0000-0000-000000000011','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000002',date '2026-08-04','regular',time '18:00',time '19:30','offline','scheduled'),('79000000-0000-0000-0000-000000000012','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000002',date '2026-08-11','regular',time '18:00',time '19:30','offline','scheduled');
insert into public.guardians(id,full_name,phone) values ('76000000-0000-0000-0000-000000000002','Phụ huynh Zero','0900000002');
insert into public.students(id,public_code,full_name,birth_year,current_grade,lifecycle_status)
values ('77000000-0000-0000-0000-000000000002','TV-2026-70002','Học viên Zero',2014,6,'active');
insert into public.student_guardians(student_id,guardian_id,relationship,is_primary)
values ('77000000-0000-0000-0000-000000000002','76000000-0000-0000-0000-000000000002','parent',true);
insert into public.student_enrollments(id,student_id,class_id,registered_mode,status,effective_from)
values ('78000000-0000-0000-0000-000000000002','77000000-0000-0000-0000-000000000002','74000000-0000-0000-0000-000000000001','offline','active',date '2026-09-01');
insert into public.student_acquisition_source_assignments(student_id,lead_source_id,reason,assigned_by)
select '77000000-0000-0000-0000-000000000002',id,'Nguồn fixture zero','71000000-0000-0000-0000-000000000001' from public.crm_lead_sources where code='direct_walkin';
insert into public.student_tuition_rate_versions(student_id,effective_from,unit_price_vnd,reason,created_by)
values ('77000000-0000-0000-0000-000000000002',date '2026-09-01',150000,'Giá zero','71000000-0000-0000-0000-000000000001');
insert into public.student_session_ledger_entries(student_id,entry_type,delta_sessions,effective_on,event_key,note,created_by)
values ('77000000-0000-0000-0000-000000000002','manual_adjustment',10,date '2026-09-01','tuition:zero-credit','Tín dụng mở đầu fixture','71000000-0000-0000-0000-000000000001');
insert into public.class_sessions(id,class_id,schedule_template_id,session_date,session_kind,start_time,end_time,learning_mode,status)
values ('79000000-0000-0000-0000-000000000004','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',date '2026-09-14','regular',time '18:00',time '19:30','offline','scheduled'),('79000000-0000-0000-0000-000000000005','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',date '2026-09-21','regular',time '18:00',time '19:30','offline','scheduled'),('79000000-0000-0000-0000-000000000006','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',date '2026-09-28','regular',time '18:00',time '19:30','offline','scheduled'),('79000000-0000-0000-0000-000000000007','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',date '2026-10-05','regular',time '18:00',time '19:30','offline','scheduled'),('79000000-0000-0000-0000-000000000008','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',date '2026-10-12','regular',time '18:00',time '19:30','offline','scheduled'),('79000000-0000-0000-0000-000000000009','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',date '2026-10-19','regular',time '18:00',time '19:30','offline','scheduled'),('79000000-0000-0000-0000-000000000010','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',date '2026-10-26','regular',time '18:00',time '19:30','offline','scheduled');
insert into public.tuition_collection_periods(id,name,starts_on,ends_on,status,created_by)
values ('7a000000-0000-0000-0000-000000000001','Học phí tháng 08',date '2026-08-01',date '2026-08-31','draft','71000000-0000-0000-0000-000000000001');

select is((public.lock_tuition_collection_period('7a000000-0000-0000-0000-000000000001')->>'status'),'locked','lock succeeds with one effective renewal destination');
select is((select payment_contract_snapshot->>'account_number' from public.tuition_collection_items where period_id='7a000000-0000-0000-0000-000000000001'),'1900123456','lock snapshots Account A, rather than a later account');
select is((select (payment_contract_snapshot->>'amount_vnd')::bigint from public.tuition_collection_items where period_id='7a000000-0000-0000-0000-000000000001'),600000::bigint,'lock snapshots exact locked tuition amount');
select matches((select payment_contract_snapshot->>'transfer_code' from public.tuition_collection_items where period_id='7a000000-0000-0000-0000-000000000001'),'^HOC VIEN WAVE 2014 0900000001 PAY-.*$','lock snapshots the student identity and unique transfer reference');
select is((select purpose from public.resolve_sepay_receiving_account((select payment_contract_snapshot->>'account_number' from public.tuition_collection_items where period_id='7a000000-0000-0000-0000-000000000001'),timestamptz '2026-08-31 16:00:00+00')),'renewal','the locked QR account identity resolves to the same renewal purpose in webhook classification');
select is((public.lock_tuition_collection_period('7a000000-0000-0000-0000-000000000001')->>'idempotent'),'true','lock retry is idempotent');
select is((select count(*) from public.student_payment_requests where notes like 'Tuition collection item%'),1::bigint,'retry creates exactly one renewal payment request');

insert into public.tuition_collection_periods(id,name,starts_on,ends_on,status,created_by)
values ('7a000000-0000-0000-0000-000000000002','Học phí tháng 09-10',date '2026-09-01',date '2026-10-31','draft','71000000-0000-0000-0000-000000000001');
select is((public.lock_tuition_collection_period('7a000000-0000-0000-0000-000000000002')->>'status'),'locked','a later period locks independently');
select is((select payment_contract_snapshot->>'account_number' from public.tuition_collection_items where period_id='7a000000-0000-0000-0000-000000000002' and student_id='77000000-0000-0000-0000-000000000001'),'999999','later locked period uses effective Account B');
select is((select payment_contract_snapshot->>'account_number' from public.tuition_collection_items where period_id='7a000000-0000-0000-0000-000000000001'),'1900123456','old locked item remains Account A after Account B is active');
select is((select scheduled_chargeable_sessions from public.tuition_collection_items where period_id='7a000000-0000-0000-0000-000000000002' and student_id='77000000-0000-0000-0000-000000000002'),8,'zero-due student retains all eight scheduled chargeable sessions');
select is((select payable_sessions from public.tuition_collection_items where period_id='7a000000-0000-0000-0000-000000000002' and student_id='77000000-0000-0000-0000-000000000002'),0,'ten-session opening credit reduces payable sessions to zero');
select is((select payable_amount_vnd from public.tuition_collection_items where period_id='7a000000-0000-0000-0000-000000000002' and student_id='77000000-0000-0000-0000-000000000002'),0::bigint,'zero-due item has zero VND amount');
select is((select payment_request_id from public.tuition_collection_items where period_id='7a000000-0000-0000-0000-000000000002' and student_id='77000000-0000-0000-0000-000000000002'),null::uuid,'zero-due item has no payment request');
select is((select payment_contract_snapshot::text from public.tuition_collection_items where period_id='7a000000-0000-0000-0000-000000000002' and student_id='77000000-0000-0000-0000-000000000002'),'{}','zero-due item has no payable payment contract or QR inputs');
-- Since 20261012130100 a period cannot overlap a locked one, so the multi-rate
-- scenario runs on Nov–Dec with a third rate taking effect on 1 December.
insert into public.student_tuition_rate_versions(student_id,effective_from,unit_price_vnd,reason,created_by)
values ('77000000-0000-0000-0000-000000000001',date '2026-12-01',190000,'Giá tháng mười hai','71000000-0000-0000-0000-000000000001');
insert into public.class_sessions(id,class_id,schedule_template_id,session_date,session_kind,start_time,end_time,learning_mode,status)
values ('79000000-0000-0000-0000-000000000021','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',date '2026-11-02','regular',time '18:00',time '19:30','offline','scheduled'),('79000000-0000-0000-0000-000000000022','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',date '2026-11-09','regular',time '18:00',time '19:30','offline','scheduled'),('79000000-0000-0000-0000-000000000023','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',date '2026-11-16','regular',time '18:00',time '19:30','offline','scheduled'),('79000000-0000-0000-0000-000000000024','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',date '2026-11-23','regular',time '18:00',time '19:30','offline','scheduled'),('79000000-0000-0000-0000-000000000025','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',date '2026-12-07','regular',time '18:00',time '19:30','offline','scheduled'),('79000000-0000-0000-0000-000000000026','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',date '2026-12-14','regular',time '18:00',time '19:30','offline','scheduled'),('79000000-0000-0000-0000-000000000027','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',date '2026-12-21','regular',time '18:00',time '19:30','offline','scheduled'),('79000000-0000-0000-0000-000000000028','74000000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001',date '2026-12-28','regular',time '18:00',time '19:30','offline','scheduled');
insert into public.tuition_collection_periods(id,name,starts_on,ends_on,status,created_by)
values ('7a000000-0000-0000-0000-000000000004','Kỳ đa đơn giá',date '2026-11-01',date '2026-12-31','draft','71000000-0000-0000-0000-000000000001');
select is((public.lock_tuition_collection_period('7a000000-0000-0000-0000-000000000004')->>'status'),'locked','multi-rate period locks from session-effective rates');
select is((select payable_amount_vnd from public.tuition_collection_items where period_id='7a000000-0000-0000-0000-000000000004' and student_id='77000000-0000-0000-0000-000000000001'),1440000::bigint,'four 170k sessions plus four 190k sessions total exactly 1,440,000 VND');
select is((select string_agg(unit_price_vnd::text || ':' || payable_session_count::text,',' order by unit_price_vnd) from public.tuition_collection_item_lines where item_id=(select id from public.tuition_collection_items where period_id='7a000000-0000-0000-0000-000000000004' and student_id='77000000-0000-0000-0000-000000000001')),'170000:1,170000:1,170000:1,170000:1,190000:1,190000:1,190000:1,190000:1','locked lines preserve the eight rate segments for receipt breakdown');
select is((select (payment_contract_snapshot->>'amount_vnd')::bigint from public.tuition_collection_items where period_id='7a000000-0000-0000-0000-000000000004' and student_id='77000000-0000-0000-0000-000000000001'),1440000::bigint,'multi-rate QR contract snapshots exactly 1,440,000 VND');
select is((select payment_contract_snapshot->>'amount_vnd' from public.reissue_tuition_collection_item((select id from public.tuition_collection_items where period_id='7a000000-0000-0000-0000-000000000001'),100000,'Sai số buổi fixture')),'100000','reissue creates a new immutable payment contract in its insert transaction');
select is((select count(*) from public.tuition_collection_item_adjustments),1::bigint,'reissue preserves an auditable original-to-replacement link');
select is((select payment_request_id from public.reissue_tuition_collection_item((select id from public.tuition_collection_items where period_id='7a000000-0000-0000-0000-000000000002' and student_id='77000000-0000-0000-0000-000000000002'),0,'Không cần thu fixture')),null::uuid,'zero-amount reissue creates no payment request or QR contract');
select is((select count(*) from public.tuition_collection_item_adjustments),2::bigint,'zero-amount reissue remains linked and audited');

select * from finish();

rollback;
