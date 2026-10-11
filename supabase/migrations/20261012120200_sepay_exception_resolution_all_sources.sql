-- Đóng giao dịch SePay ngoại lệ cho mọi nguồn (webhook, API lịch sử, đối soát).
--
-- resolve_sepay_historical_transaction chỉ nhận giao dịch nhập từ API lịch
-- sử (source_payloads ? 'api_v2'), nên tiền không phải học phí hoặc đã hạch
-- toán cách khác mà về qua webhook không bao giờ đóng được, kẹt mãi ở hàng
-- đợi "chưa khớp". Nay mọi giao dịch tiền vào chưa phát sinh hiệu lực tài
-- chính đều có thể đánh dấu "đã hạch toán trước đây" hoặc "bỏ qua" kèm lý do;
-- bao gồm cả trạng thái lệch số tiền / lệch tài khoản. Audit và quyền giữ
-- nguyên.

begin;

create or replace function public.resolve_sepay_historical_transaction(
  p_sepay_transaction_id uuid,
  p_resolution text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_tx public.sepay_transactions;
  v_status text;
begin
  if v_actor is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if not (
    public.has_permission('sepay.sync_history.manage')
    or public.has_permission('sepay.allocate')
    or public.has_permission('payments.manage')
  ) then
    raise exception 'SEPAY_RECONCILIATION_PERMISSION_DENIED';
  end if;
  if p_resolution not in ('already_accounted', 'ignored')
    or nullif(pg_catalog.btrim(p_reason), '') is null
  then
    raise exception 'SEPAY_RECONCILIATION_INPUT_INVALID';
  end if;

  select * into v_tx
  from public.sepay_transactions
  where id = p_sepay_transaction_id
  for update;

  if not found then
    raise exception 'TRANSACTION_NOT_FOUND';
  end if;
  if v_tx.transfer_type is distinct from 'in' then
    raise exception 'TRANSACTION_NOT_INBOUND';
  end if;
  if v_tx.match_status = 'identity_conflict'
    and not public.has_permission('sepay.sync_history.manage')
  then
    raise exception 'TRANSACTION_IDENTITY_CONFLICT_OWNER_REQUIRED';
  end if;
  if v_tx.match_status not in ('unmatched', 'identity_conflict', 'amount_mismatch', 'account_purpose_mismatch') then
    raise exception 'TRANSACTION_ALREADY_RECONCILED';
  end if;
  if exists (
    select 1 from public.finance_cashflow_records
    where sepay_transaction_id = p_sepay_transaction_id
  ) or exists (
    select 1 from public.student_credit_lots
    where sepay_transaction_id = p_sepay_transaction_id
  ) or exists (
    select 1 from public.payment_split_allocations
    where sepay_transaction_id = p_sepay_transaction_id
  ) then
    raise exception 'TRANSACTION_HAS_FINANCIAL_EFFECTS';
  end if;

  v_status := case p_resolution
    when 'already_accounted' then 'historical_accounted'
    else 'ignored'
  end;

  update public.sepay_transactions
  set
    match_status = v_status,
    matched_by = v_actor,
    matched_at = pg_catalog.now()
  where id = p_sepay_transaction_id;

  if v_tx.sepay_webhook_id is not null then
    update public.sepay_webhooks
    set
      processing_status = 'processed',
      error_message = null,
      processed_at = pg_catalog.now()
    where id = v_tx.sepay_webhook_id;
  end if;

  insert into public.audit_logs (
    actor_user_id,
    module,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    reason,
    metadata
  )
  values (
    v_actor,
    'finance',
    -- Action name kept from the history-only version so existing audit
    -- filters and tests keep matching.
    'sepay_historical_transaction_' || p_resolution,
    'sepay_transaction',
    p_sepay_transaction_id::text,
    pg_catalog.jsonb_build_object('match_status', v_tx.match_status, 'amount_vnd', v_tx.amount_vnd),
    pg_catalog.jsonb_build_object('match_status', v_status),
    pg_catalog.btrim(p_reason),
    pg_catalog.jsonb_build_object('ingestion_source', v_tx.ingestion_source)
  );

  return pg_catalog.jsonb_build_object(
    'status', 'success',
    'match_status', v_status,
    'transaction_id', p_sepay_transaction_id
  );
end;
$$;
revoke all on function public.resolve_sepay_historical_transaction(uuid, text, text)
from public, anon;
grant execute on function public.resolve_sepay_historical_transaction(uuid, text, text)
to authenticated;

commit;
