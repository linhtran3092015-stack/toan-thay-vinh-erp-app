-- Synthetic data only. Execute actual migration functions and assert outcomes.
create function public.test_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'ASSERTION FAILED: %',message;end if;end;$$;
insert into profiles values('11111111-1111-4111-8111-111111111111','Owner');
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
set test.permissions='tuition_periods.view,tuition_periods.lock,tuition_periods.adjust,students.manage_tuition_rates,students.correct_acquisition_source,payments.create_request';
insert into students(id,full_name,public_code,birth_year,current_grade) values
 ('22222222-2222-4222-8222-222222222222','Nguyễn Đặng Ánh','HV1',2014,6),
 ('22222222-2222-4222-8222-222222222223','Trần Bình','HV2',2015,5);
insert into guardians(id,full_name,phone) values('33333333-3333-4333-8333-333333333333','Parent','0901234567');
insert into student_guardians select id,'33333333-3333-4333-8333-333333333333',true,null from students;
insert into crm_lead_sources(id,code,name) values('44444444-4444-4444-8444-444444444444','direct','Direct');
insert into classes(id,code,name,grade) values('55555555-5555-4555-8555-555555555555','C1','Class',6);
insert into student_enrollments(student_id,class_id,status,effective_from,registered_mode) select id,'55555555-5555-4555-8555-555555555555','active','2026-08-01','offline' from students;
insert into class_sessions(class_id,session_date,session_kind,status) values('55555555-5555-4555-8555-555555555555','2026-08-22','regular','scheduled'),('55555555-5555-4555-8555-555555555555','2026-09-01','regular','scheduled');
insert into tuition_collection_periods(id,name,starts_on,ends_on,created_by) values('66666666-6666-4666-8666-666666666666','Term','2026-08-22','2026-11-06',auth.uid());
do $$begin
 begin perform set_tuition_period_student_sources('66666666-6666-4666-8666-666666666666',array['22222222-2222-4222-8222-222222222222','99999999-9999-4999-8999-999999999999']::uuid[],'44444444-4444-4444-8444-444444444444','Confirmed source');raise exception 'should reject';
 exception when others then if sqlerrm<>'TUITION_SOURCE_SELECTION_STALE' then raise;end if;end;
end;$$;
select test_assert((select count(*)=0 from student_acquisition_source_assignments),'failed source batch is atomic');
set role authenticated;
select set_tuition_period_student_sources('66666666-6666-4666-8666-666666666666',array['22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222223']::uuid[],'44444444-4444-4444-8444-444444444444','Confirmed source');
reset role;
select test_assert((select count(*)=2 from student_acquisition_source_assignments where is_current),'valid source batch prepares both students');
insert into sepay_receiving_account_versions(purpose,bank_code,account_number,account_display_name,effective_from) values('renewal','VCB','123456','CENTER','2026-01-01');
select test_assert((select count(*)=4 from preview_tuition_collection_period('66666666-6666-4666-8666-666666666666') where blocker_code='MISSING_EFFECTIVE_TUITION_RATE'),'missing price reproduces block for every student/session');
select test_assert((select count(*)=0 from student_payment_requests),'draft creates no payment requests');
do $$begin
 begin perform public.lock_tuition_collection_period('66666666-6666-4666-8666-666666666666');raise exception 'should block';
 exception when others then if sqlerrm<>'TUITION_PERIOD_BLOCKERS' then raise;end if;end;
end;$$;
set role authenticated;
select set_tuition_period_student_rates('66666666-6666-4666-8666-666666666666',array['22222222-2222-4222-8222-222222222222']::uuid[],150000,'Confirmed term rate');
reset role;
select test_assert((select effective_from='2026-08-22' from student_tuition_rate_versions where student_id='22222222-2222-4222-8222-222222222222'),'backdates to first missing class, not today');
do $$begin
 begin perform set_tuition_period_student_rates('66666666-6666-4666-8666-666666666666',array['22222222-2222-4222-8222-222222222223','99999999-9999-4999-8999-999999999999']::uuid[],120000,'Invalid selection');raise exception 'should reject';
 exception when others then if sqlerrm<>'TUITION_RATE_SELECTION_STALE' then raise;end if;end;
end;$$;
select test_assert((select count(*)=1 from student_tuition_rate_versions),'failed batch does not leave earlier student changed');
select set_tuition_period_student_rates('66666666-6666-4666-8666-666666666666',array['22222222-2222-4222-8222-222222222223']::uuid[],120000,'Confirmed second rate');
select test_assert((select count(*)=0 from preview_tuition_collection_period('66666666-6666-4666-8666-666666666666') where blocker_code is not null),'rate preparation removes blockers');
update student_guardians set is_primary=false where student_id='22222222-2222-4222-8222-222222222223';
select test_assert((select count(*)=2 from preview_tuition_collection_period('66666666-6666-4666-8666-666666666666') where blocker_code='MISSING_PRIMARY_GUARDIAN'),'missing primary guardian is explained before lock');
update student_guardians set is_primary=true where student_id='22222222-2222-4222-8222-222222222223';
insert into tuition_collection_periods(id,name,starts_on,ends_on,created_by) values('66666666-6666-4666-8666-666666666667','Empty','2027-01-01','2027-01-31',auth.uid());
do $$begin
 begin perform lock_tuition_collection_period('66666666-6666-4666-8666-666666666667');raise exception 'should reject';
 exception when others then if sqlerrm<>'TUITION_PERIOD_EMPTY' then raise;end if;end;
end;$$;
select lock_tuition_collection_period('66666666-6666-4666-8666-666666666666');
select lock_tuition_collection_period('66666666-6666-4666-8666-666666666666');
select test_assert((select count(*)=2 from student_payment_requests),'lock creates exactly one request per due student and retry creates none');
select test_assert((select transfer_code like 'NGUYEN DANG ANH 2014 0901234567 PAY-%' from student_payment_requests where student_id='22222222-2222-4222-8222-222222222222'),'readable reference includes normalized name, birth year, phone and unique code');
select test_assert((select bool_and(payment_contract_snapshot->>'transfer_code'=request.transfer_code) from tuition_collection_items item join student_payment_requests request on request.id=item.payment_request_id),'QR snapshots use same readable transfer reference');
select test_assert((select count(*)=1 from find_sepay_payment_candidates('hoc phi Nguyễn Đặng Ánh 2014 0901234567','')),'three identity parts match one pending request');
select test_assert((select count(*)=0 from find_sepay_payment_candidates('hoc phi Nguyễn Đặng Ánh 0901234567','')),'name/phone without birth year cannot auto match');
select test_assert((select count(*)=0 from find_sepay_payment_candidates('hoc phi Nguyễn Đặng Ánh 2014 09012345678','')),'longer phone sharing prefix cannot auto match');
select test_assert((select count(*)=0 from find_sepay_payment_candidates('Tran Nguyen Dang Anh 2014 0901234567','')),'longer full name cannot settle a shorter-name student');
-- Second pending request for same student: identity-only must remain ambiguous.
select create_student_payment_request('22222222-2222-4222-8222-222222222222',600000,4,0,0,'renewal',null);
select test_assert((select count(*)=2 from find_sepay_payment_candidates('Nguyen Dang Anh 2014 0901234567','')),'multiple terms cannot auto-match demographic text');
select test_assert((select count(*)=1 from find_sepay_payment_candidates((select transfer_code from student_payment_requests where expected_amount_vnd=300000),'')),'explicit code uniquely identifies correct term');
select test_assert((process_sepay_webhook_transaction(101,'VCB','2026-09-23 12:00+07','123456','','Nguyen Dang Anh 2014 0901234567','in',300000,0,'renewal',null,'{}')->>'reason')='AMBIGUOUS_PAYMENT_REFERENCE','ambiguous transfer has no financial effects');
select test_assert((select count(*)=0 from finance_cashflow_records),'no cashflow for ambiguous identity');
select process_sepay_webhook_transaction(102,'VCB','2026-09-23 12:00+07','123456','',(select transfer_code from student_payment_requests where expected_amount_vnd=300000),'in',300000,0,'renewal',null,'{}');
select process_sepay_webhook_transaction(102,'VCB','2026-09-23 12:00+07','123456','',(select transfer_code from student_payment_requests where expected_amount_vnd=300000),'in',300000,0,'renewal',null,'{}');
select test_assert((select count(*)=1 from finance_cashflow_records),'webhook retry creates no duplicate receipt');
select test_assert((select sum(delta_sessions)=2 from student_session_ledger_entries),'webhook retry creates no duplicate sessions');
select test_assert((select count(*)=0 from find_sepay_payment_candidates((select transfer_code from student_payment_requests where expected_amount_vnd=300000),'')),'paid reference does not fall through to another pending term');
-- Preserve matching for pre-existing transfer codes distinct from public_code.
update student_payment_requests set transfer_code='LEGACY-TUITION-223' where student_id='22222222-2222-4222-8222-222222222223';
select test_assert((select count(*)=1 from find_sepay_payment_candidates('HOC PHI LEGACY-TUITION-223','')),'legacy transfer reference in bank content still matches');
update student_payment_requests set status='cancelled' where student_id='22222222-2222-4222-8222-222222222223';
select test_assert((select count(*)=0 from find_sepay_payment_candidates('HOC PHI LEGACY-TUITION-223','')),'cancelled legacy transfer reference never matches a pending request');
-- Permission enforcement is in the DB, not just the UI.
set test.permissions='tuition_periods.view';
set role authenticated;
do $$begin
 begin perform set_tuition_period_student_sources('66666666-6666-4666-8666-666666666666',array['22222222-2222-4222-8222-222222222223']::uuid[],'44444444-4444-4444-8444-444444444444','Unauthorized source');raise exception 'should reject';
 exception when others then if sqlerrm<>'STUDENT_SOURCE_PERMISSION_DENIED' then raise;end if;end;
 begin perform set_tuition_period_student_rates('66666666-6666-4666-8666-666666666666',array['22222222-2222-4222-8222-222222222223']::uuid[],1,'Unauthorized rate');raise exception 'should reject';
 exception when others then if sqlerrm<>'TUITION_RATE_PERMISSION_DENIED' then raise;end if;end;
end;$$;
reset role;
select test_assert(not has_function_privilege('authenticated','public.student_payment_transfer_identity(uuid,uuid)','execute'),'identity helper is not a public data lookup');
-- Phase 1b (20261012130000 / 20261012130100): cutoff balance, overlap guard, atomic reissue.
begin;
set test.permissions='tuition_periods.view,tuition_periods.lock,tuition_periods.adjust,tuition_periods.manage';
-- Opening balance is taken at the period start: entries dated inside the period do not move it.
insert into class_sessions(class_id,session_date,session_kind,status) values('55555555-5555-4555-8555-555555555555','2026-11-15','regular','scheduled'),('55555555-5555-4555-8555-555555555555','2026-11-22','regular','scheduled'),('55555555-5555-4555-8555-555555555555','2026-11-29','regular','scheduled');
insert into tuition_collection_periods(id,name,starts_on,ends_on,created_by) values('66666666-6666-4666-8666-666666666668','Next','2026-11-07','2026-12-31',auth.uid());
insert into student_session_ledger_entries(student_id,entry_type,delta_sessions,effective_on,event_key) values
 ('22222222-2222-4222-8222-222222222223','payment_credit',2,'2026-11-01','cutoff-before'),
 ('22222222-2222-4222-8222-222222222223','session_charge',-3,'2026-11-10','cutoff-after');
select test_assert((select min(opening_balance_sessions)=2 from preview_tuition_collection_period('66666666-6666-4666-8666-666666666668') where student_id='22222222-2222-4222-8222-222222222223'),'opening balance ignores entries dated inside the period');
-- A new period cannot overlap a locked one.
do $$begin
 begin perform create_tuition_collection_period('Overlap','2026-10-01','2026-11-30',null,null);raise exception 'should reject';
 exception when others then if sqlerrm<>'TUITION_PERIOD_OVERLAPS' then raise;end if;end;
end;$$;
insert into tuition_collection_periods(id,name,starts_on,ends_on,created_by) values('66666666-6666-4666-8666-666666666669','Overlapping draft','2026-11-01','2026-11-30',auth.uid());
do $$begin
 begin perform lock_tuition_collection_period('66666666-6666-4666-8666-666666666669');raise exception 'should reject';
 exception when others then if sqlerrm<>'TUITION_PERIOD_OVERLAPS' then raise;end if;end;
end;$$;
-- Reissue replaces the original request instead of leaving two pending ones.
select lock_tuition_collection_period('66666666-6666-4666-8666-666666666668');
select test_assert((select count(*)=1 from student_payment_requests r join tuition_collection_items i on i.payment_request_id=r.id where i.period_id='66666666-6666-4666-8666-666666666668' and i.student_id='22222222-2222-4222-8222-222222222222' and r.status='pending'),'next period bills the student once');
select reissue_tuition_collection_item((select id from tuition_collection_items where period_id='66666666-6666-4666-8666-666666666668' and student_id='22222222-2222-4222-8222-222222222222'),100000,'Giảm học phí theo thỏa thuận');
select test_assert((select count(*)=1 from student_payment_requests r join tuition_collection_items i on i.payment_request_id=r.id where i.period_id='66666666-6666-4666-8666-666666666668' and i.student_id='22222222-2222-4222-8222-222222222222' and r.status='pending'),'after reissue exactly one request stays pending');
select test_assert((select r.status='cancelled' and r.superseded_by_request_id is not null and r.cancelled_at is not null from tuition_collection_items i join student_payment_requests r on r.id=i.payment_request_id where i.period_id='66666666-6666-4666-8666-666666666668' and i.student_id='22222222-2222-4222-8222-222222222222' and i.reissued_from_item_id is null),'original request is cancelled and points at its replacement');
select test_assert((select count(*)=0 from find_sepay_payment_candidates((select r.transfer_code from tuition_collection_items i join student_payment_requests r on r.id=i.payment_request_id where i.period_id='66666666-6666-4666-8666-666666666668' and i.student_id='22222222-2222-4222-8222-222222222222' and i.reissued_from_item_id is null),'')),'the superseded transfer code no longer auto-matches');
-- A paid item cannot be reissued.
do $$begin
 begin perform reissue_tuition_collection_item((select id from tuition_collection_items where period_id='66666666-6666-4666-8666-666666666666' and student_id='22222222-2222-4222-8222-222222222222'),0,'Thu thử');raise exception 'should reject';
 exception when others then if sqlerrm<>'TUITION_ITEM_ALREADY_PAID' then raise;end if;end;
end;$$;
rollback;
