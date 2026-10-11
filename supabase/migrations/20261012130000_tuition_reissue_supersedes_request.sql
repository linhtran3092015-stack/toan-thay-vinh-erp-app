-- Tái phát hành phiếu học phí phải thay thế phiếu thu gốc.
--
-- reissue_tuition_collection_item tạo phiếu thu mới nhưng để phiếu gốc ở
-- trạng thái `pending`: QR cũ vẫn hiện, phụ huynh trả được theo phiếu cũ,
-- công nợ bị đếm đôi và khớp tự động theo danh tính bị "mơ hồ" vì có hai
-- phiếu chờ. Nay:
--   - không tái phát hành khi phiếu gốc đã thu tiền (toàn bộ hoặc một phần);
--   - phiếu gốc đang chờ bị hủy và trỏ sang phiếu thay thế
--     (student_payment_requests.superseded_by_request_id);
--   - audit ghi cả hai mã phiếu.
-- Tiền về theo mã chuyển khoản cũ sẽ không khớp tự động nữa mà vào hàng đợi
-- đối soát, như mọi giao dịch không có phiếu chờ.

begin;

alter table public.student_payment_requests
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references public.profiles(id) on delete restrict,
  add column cancellation_reason text,
  add column superseded_by_request_id uuid references public.student_payment_requests(id) on delete restrict,
  add constraint student_payment_requests_cancellation_check check (
    (status <> 'cancelled' and cancelled_at is null)
    or (status = 'cancelled')
  );

create index student_payment_requests_superseded_by_idx
  on public.student_payment_requests (superseded_by_request_id)
  where superseded_by_request_id is not null;

create or replace function public.reissue_tuition_collection_item(p_original_item_id uuid, p_payable_amount_vnd bigint, p_reason text)
returns public.tuition_collection_items language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_original public.tuition_collection_items; v_new public.tuition_collection_items; v_period public.tuition_collection_periods; v_account public.sepay_receiving_account_versions; v_original_request public.student_payment_requests; v_guardian uuid; v_request uuid; v_public text; v_transfer text; v_new_id uuid:=gen_random_uuid(); v_contract jsonb:='{}'::jsonb;
begin
 if v_actor is null then raise exception 'AUTHENTICATION_REQUIRED'; end if;
 if not public.has_permission('tuition_periods.adjust') then raise exception 'TUITION_PERIOD_ADJUST_PERMISSION_DENIED'; end if;
 if p_payable_amount_vnd is null or p_payable_amount_vnd<0 or nullif(trim(p_reason),'') is null then raise exception 'TUITION_REISSUE_INPUT_INVALID'; end if;
 select * into v_original from public.tuition_collection_items where id=p_original_item_id for update;
 if not found then raise exception 'TUITION_ITEM_NOT_FOUND'; end if;
 if exists (select 1 from public.tuition_collection_item_adjustments where original_item_id=v_original.id) then raise exception 'TUITION_ITEM_ALREADY_REISSUED'; end if;
 if v_original.payment_request_id is not null then
   select * into v_original_request from public.student_payment_requests where id=v_original.payment_request_id for update;
   if v_original_request.status in ('paid','partially_paid') then raise exception 'TUITION_ITEM_ALREADY_PAID'; end if;
 end if;
 if p_payable_amount_vnd>0 then
   select * into v_period from public.tuition_collection_periods where id=v_original.period_id;
   select * into v_account from public.sepay_receiving_account_versions where purpose='renewal' and status='active' and effective_from<=current_date and coalesce(effective_to,current_date)>=current_date order by effective_from desc limit 1;
   if v_account.id is null then raise exception 'RENEWAL_RECEIVING_ACCOUNT_BLOCKER'; end if;
   select guardian_id into v_guardian from public.student_guardians where student_id=v_original.student_id and is_primary and ended_at is null limit 1;
   if v_guardian is null then raise exception 'STUDENT_PRIMARY_GUARDIAN_NOT_FOUND'; end if;
   v_public:='PAY-'||to_char(now(),'YYMMDD')||'-'||upper(substr(md5(random()::text),1,12)); v_transfer:=public.format_student_payment_transfer_code(v_original.student_id,v_guardian,v_public);
   insert into public.student_payment_requests(public_code,student_id,guardian_id,expected_amount_vnd,purchased_sessions,bonus_sessions,calculated_unit_price_vnd,topup_type,transfer_code,notes,created_by) values(v_public,v_original.student_id,v_guardian,p_payable_amount_vnd,greatest(v_original.payable_sessions,1),0,round(p_payable_amount_vnd::numeric/greatest(v_original.payable_sessions,1))::bigint,'renewal',v_transfer,'Tuition reissue '||v_new_id::text,v_actor) returning id into v_request;
   v_contract:=jsonb_build_object('version',1,'receiving_account_version_id',v_account.id,'purpose','renewal','bank_code',v_account.bank_code,'account_number',v_account.account_number,'account_display_name',v_account.account_display_name,'amount_vnd',p_payable_amount_vnd,'payment_request_id',v_request,'public_code',v_public,'transfer_code',v_transfer,'qr_format','vietqr.app');
 end if;
 -- The original obligation is replaced, never duplicated: a still-pending
 -- original request is cancelled and points at its replacement.
 if v_original_request.id is not null and v_original_request.status='pending' then
   update public.student_payment_requests
   set status='cancelled', cancelled_at=now(), cancelled_by=v_actor,
       cancellation_reason='Tái phát hành phiếu học phí: '||trim(p_reason),
       superseded_by_request_id=v_request
   where id=v_original_request.id;
 end if;
 insert into public.tuition_collection_items(id,period_id,student_id,enrollment_id,class_id,acquisition_source_id,student_snapshot,source_snapshot,opening_balance_sessions,scheduled_chargeable_sessions,credit_offset_sessions,debit_carry_sessions,payable_sessions,payable_amount_vnd,status,receipt_template_snapshot,receipt_template_version_id,payment_request_id,payment_contract_snapshot,reissued_from_item_id,created_by)
 values(v_new_id,v_original.period_id,v_original.student_id,v_original.enrollment_id,v_original.class_id,v_original.acquisition_source_id,v_original.student_snapshot,v_original.source_snapshot,v_original.opening_balance_sessions,v_original.scheduled_chargeable_sessions,v_original.credit_offset_sessions,v_original.debit_carry_sessions,case when p_payable_amount_vnd=0 then 0 else v_original.payable_sessions end,p_payable_amount_vnd,case when p_payable_amount_vnd=0 then 'no_payment' else 'pending_payment' end,v_original.receipt_template_snapshot,v_original.receipt_template_version_id,v_request,v_contract,v_original.id,v_actor) returning * into v_new;
 insert into public.tuition_collection_item_adjustments(original_item_id,replacement_item_id,reason,created_by) values(v_original.id,v_new.id,trim(p_reason),v_actor);
 insert into public.audit_logs(actor_user_id,module,action,entity_type,entity_id,old_data,new_data,reason) values(v_actor,'finance','tuition_item_reissued','tuition_collection_item',v_new.id::text,jsonb_build_object('original_item_id',v_original.id,'original_request_id',v_original_request.id,'original_request_status',v_original_request.status),to_jsonb(v_new)||jsonb_build_object('replacement_request_id',v_request),trim(p_reason));
 return v_new;
end; $$;

commit;
