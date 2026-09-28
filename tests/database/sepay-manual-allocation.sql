-- Runs after tuition-readiness.sql in a disposable real PostgreSQL database.
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
set test.permissions='sepay.allocate,sepay.view';
insert into students(id,full_name,public_code,birth_year,current_grade) values
 ('22222222-2222-4222-8222-222222222224','Lê Minh','HV3',2014,6);
insert into guardians(id,full_name,phone) values('33333333-3333-4333-8333-333333333334','Another parent','0901234568');
insert into student_guardians values('22222222-2222-4222-8222-222222222224','33333333-3333-4333-8333-333333333334',true,null);
insert into sepay_transactions(id,bank_transaction_id,bank_brand,account_number,amount_vnd,transfer_content,transaction_at,transfer_type,account_purpose,match_status,ingestion_source)
select ('77777777-7777-4777-8777-'||lpad(n::text,12,'0'))::uuid,'manual-'||n,'VCB','123456',1000000,'Tuition transfer','2026-08-31 18:00+00','in','renewal','unmatched','webhook' from generate_series(1,10) n;
-- Search grants only narrow authorized lookups, including no-accent names and phone.
set role authenticated;
select test_assert((select count(*)=1 from search_sepay_allocation_students('Le Minh')),'name search works without accents');
select test_assert((select count(*)=1 from search_sepay_allocation_students('0901234568')),'parent phone search works');
select test_assert((select jsonb_array_length(pending_requests)=1 from search_sepay_allocation_students('HV1')),'lookup exposes current open requests for deliberate settlement');
reset role;

create function public.test_manual_reject(tx uuid,items jsonb,expected text) returns void language plpgsql as $$
begin
 begin perform public.allocate_sepay_tuition_manually(tx,items,'Verified with parent'); raise exception 'DID_NOT_REJECT';
 exception when others then if sqlerrm<>expected then raise exception 'Expected %, got %',expected,sqlerrm; end if; end;
end;$$;
-- Invalid last row rolls back the complete batch, never leaves earlier credits.
select test_manual_reject('77777777-7777-4777-8777-000000000001',
 '[{"student_id":"22222222-2222-4222-8222-222222222223","allocated_amount_vnd":500000,"allocated_sessions":5},
 {"student_id":"99999999-9999-4999-8999-999999999999","allocated_amount_vnd":500000,"allocated_sessions":5}]','STUDENT_NOT_FOUND');
select test_assert((select count(*)=0 from payment_split_allocations),'invalid batch leaves no allocations');
select test_manual_reject('77777777-7777-4777-8777-000000000001',
 '[{"student_id":"22222222-2222-4222-8222-222222222223","allocated_amount_vnd":1000001,"allocated_sessions":5}]','ALLOCATION_TOTAL_MUST_MATCH_TRANSACTION');
select test_manual_reject('77777777-7777-4777-8777-000000000001',
 '[{"student_id":"22222222-2222-4222-8222-222222222223","allocated_amount_vnd":500000,"allocated_sessions":5},
 {"student_id":"22222222-2222-4222-8222-222222222223","allocated_amount_vnd":500000,"allocated_sessions":5}]','DUPLICATE_ALLOCATION_STUDENT');
select test_manual_reject('77777777-7777-4777-8777-000000000001',
 '[{"student_id":"22222222-2222-4222-8222-222222222223","allocated_amount_vnd":1000000,"allocated_sessions":null}]','INVALID_ALLOCATION_ITEM');
select test_manual_reject('77777777-7777-4777-8777-000000000001',
 '[{"student_id":"22222222-2222-4222-8222-222222222222","allocated_amount_vnd":1000000,"allocated_sessions":5}]','STUDENT_HAS_OPEN_PAYMENT_REQUEST');
set test.permissions='sepay.view,sepay.sync_history.manage';
select test_manual_reject('77777777-7777-4777-8777-000000000001',
 '[{"student_id":"22222222-2222-4222-8222-222222222223","allocated_amount_vnd":1000000,"allocated_sessions":5}]','SEPAY_ALLOCATE_PERMISSION_DENIED');
set test.permissions='sepay.allocate,sepay.view';
set role authenticated;
select allocate_sepay_tuition_manually('77777777-7777-4777-8777-000000000001',
 '[{"student_id":"22222222-2222-4222-8222-222222222223","allocated_amount_vnd":600000,"allocated_sessions":6,"bonus_sessions":1},
 {"student_id":"22222222-2222-4222-8222-222222222224","allocated_amount_vnd":400000,"allocated_sessions":4}]','Confirmed two students with parents');
reset role;
select test_assert((select count(*)=2 and sum(allocated_amount_vnd)=1000000 from payment_split_allocations),'full transfer allocated across different guardians');
select test_assert((select count(*)=2 and sum(amount_vnd)=1000000 from finance_cashflow_records where sepay_transaction_id='77777777-7777-4777-8777-000000000001'),'one canonical order receipt per student, exact total');
select test_assert((select sum(delta_sessions)=11 and min(effective_on)='2026-09-01' and max(effective_on)='2026-09-01' from student_session_ledger_entries where metadata->>'sepay_transaction_id'='77777777-7777-4777-8777-000000000001'),'credits plus bonuses use Vietnam bank date');
select test_assert((select count(*)=2 from get_sepay_allocation_details('77777777-7777-4777-8777-000000000001')),'allocation details readable');
select test_assert((select reason='Confirmed two students with parents' and actor_user_id=auth.uid() from audit_logs where action='sepay_tuition_manually_allocated' and entity_id='77777777-7777-4777-8777-000000000001'),'audit records actor and actual reason');
select test_manual_reject('77777777-7777-4777-8777-000000000001',
 '[{"student_id":"22222222-2222-4222-8222-222222222223","allocated_amount_vnd":1000000,"allocated_sessions":5}]','TRANSACTION_ALREADY_RECONCILED');
-- Explicit request allocation closes the existing obligation using its immutable price/sessions.
update sepay_transactions set amount_vnd=600000,match_status='amount_mismatch' where bank_transaction_id='manual-2';
select test_manual_reject('77777777-7777-4777-8777-000000000002',
 (select jsonb_build_array(jsonb_build_object('student_id',student_id,'payment_request_id',id,'allocated_amount_vnd',600000,'allocated_sessions',99,'bonus_sessions',0)) from student_payment_requests where status='pending' and expected_amount_vnd=600000),'PAYMENT_REQUEST_ALLOCATION_MISMATCH');
select allocate_sepay_tuition_manually('77777777-7777-4777-8777-000000000002',
 (select jsonb_build_array(jsonb_build_object('student_id',student_id,'payment_request_id',id,'allocated_amount_vnd',600000,'allocated_sessions',4,'bonus_sessions',0)) from student_payment_requests where status='pending' and expected_amount_vnd=600000),'Confirmed pending request');
reset role;
select test_assert((select status='paid' and paid_amount_vnd=600000 from student_payment_requests where expected_amount_vnd=600000),'request settled, not left as duplicate debt');
select test_assert((select count(*)=1 from student_credit_lots where sepay_transaction_id='77777777-7777-4777-8777-000000000002' and payment_request_id is not null),'credit links original request');
-- Requests read in SQL above need broad fixture select privilege only within fixture.
update sepay_transactions set match_status='identity_conflict' where bank_transaction_id='manual-3';
update sepay_transactions set transfer_type='out' where bank_transaction_id='manual-4';
update sepay_transactions set account_purpose='unknown' where bank_transaction_id='manual-5';
select test_manual_reject('77777777-7777-4777-8777-000000000003','[]','INVALID_ALLOCATIONS');
select test_manual_reject('77777777-7777-4777-8777-000000000003','[{"student_id":"22222222-2222-4222-8222-222222222223","allocated_amount_vnd":1000000,"allocated_sessions":5}]','TRANSACTION_ALREADY_RECONCILED');
select test_manual_reject('77777777-7777-4777-8777-000000000004','[{"student_id":"22222222-2222-4222-8222-222222222223","allocated_amount_vnd":1000000,"allocated_sessions":5}]','TRANSACTION_NOT_INBOUND');
select test_manual_reject('77777777-7777-4777-8777-000000000005','[{"student_id":"22222222-2222-4222-8222-222222222223","allocated_amount_vnd":1000000,"allocated_sessions":5}]','SEPAY_ACCOUNT_PURPOSE_UNRESOLVED');
select test_assert(not has_function_privilege('anon','public.allocate_sepay_tuition_manually(uuid,jsonb,text)','execute'),'anonymous cannot allocate');
-- Exact request matching now also accepts webhook-only records, including mismatch status.
update student_payment_requests set status='pending',expected_amount_vnd=1000000,purchased_sessions=10 where student_id='22222222-2222-4222-8222-222222222223';
select test_assert((select count(*)=1 from search_sepay_reconciliation_candidates('77777777-7777-4777-8777-000000000006','HV2',50)),'webhook candidates discoverable');
select match_sepay_historical_transaction_to_payment_request('77777777-7777-4777-8777-000000000006',
 (select id from student_payment_requests where student_id='22222222-2222-4222-8222-222222222223'),'Verified webhook manual match');
select test_assert((select match_status='manual_matched' from sepay_transactions where bank_transaction_id='manual-6'),'webhook exact match records manual settlement');
