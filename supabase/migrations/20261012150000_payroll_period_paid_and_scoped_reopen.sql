-- Kỳ lương: ghi nhận "đã trả lương" và mở lại kỳ không tắt toàn bộ trigger.
--
-- 1. Kỳ đã duyệt có thể được ghi nhận đã trả (paid_on, paid_by, paid_at,
--    tham chiếu chuyển khoản, ghi chú) qua mark_payroll_period_paid. Trạng
--    thái vẫn là `approved` để mọi hàm lương/ước tính đang coi `approved` là
--    snapshot cuối không phải sửa; "đã trả" = approved + paid_at. Kỳ đã trả
--    là cuối cùng: không mở lại, không sửa.
-- 2. reopen_payroll_period / reopen_payroll_to_draft trước đây dùng
--    `set local session_replication_role = replica`, tắt MỌI trigger (kể cả
--    audit và FK) trong giao dịch và chỉ chạy được khi hàm thuộc superuser.
--    Nay trigger bảo vệ lịch sử cho phép đúng hai bước lùi khi GUC
--    app.payroll_reopen = 'on' (đặt trong phạm vi giao dịch của RPC); các
--    trigger khác vẫn chạy bình thường.

begin;

alter table public.payroll_periods
  add column paid_by uuid references public.profiles(id) on delete restrict,
  add column paid_at timestamptz,
  add column paid_on date,
  add column payment_reference text,
  add column payment_note text,
  add constraint payroll_periods_paid_fields_check
    check ((paid_at is null) = (paid_by is null) and (paid_at is null) = (paid_on is null)),
  add constraint payroll_periods_paid_requires_approved_check
    check (paid_at is null or status = 'approved'),
  add constraint payroll_periods_payment_reference_check
    check (payment_reference is null or (payment_reference = pg_catalog.btrim(payment_reference) and payment_reference <> '' and pg_catalog.length(payment_reference) <= 160)),
  add constraint payroll_periods_payment_note_check
    check (payment_note is null or pg_catalog.length(payment_note) <= 2000);

create or replace function public.protect_payroll_period_history()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  reopen_enabled boolean := pg_catalog.current_setting('app.payroll_reopen', true) = 'on';
begin
  -- A paid period is final: nothing moves it, not even a reopen.
  if tg_op = 'UPDATE' and old.paid_at is not null then
    raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_ALREADY_PAID';
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'draft'
    and new.status = 'draft'
    and new.period_month is not distinct from old.period_month
    and new.pay_date is not distinct from old.pay_date
    and new.generated_by is not distinct from old.generated_by
    and new.generated_at is not distinct from old.generated_at
    and new.reviewed_by is not distinct from old.reviewed_by
    and new.reviewed_at is not distinct from old.reviewed_at
    and new.approved_by is not distinct from old.approved_by
    and new.approved_at is not distinct from old.approved_at
    and new.paid_at is null
    and (
      (
        new.current_calculation_run_id is distinct from old.current_calculation_run_id
        and new.feedback_closed_at is null
        and new.feedback_closed_by is null
      )
      or (
        new.current_calculation_run_id is not distinct from old.current_calculation_run_id
        and new.feedback_opened_at is not distinct from old.feedback_opened_at
        and old.feedback_closed_at is null
        and old.feedback_closed_by is null
        and new.feedback_closed_at is not null
        and new.feedback_closed_by is not null
      )
    )
  then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'draft'
    and new.status = 'review'
    and new.period_month is not distinct from old.period_month
    and new.pay_date is not distinct from old.pay_date
    and new.generated_by is not distinct from old.generated_by
    and new.generated_at is not distinct from old.generated_at
    and new.approved_by is null
    and new.approved_at is null
    and new.paid_at is null
    and new.feedback_opened_at is not distinct from old.feedback_opened_at
    and new.feedback_closed_at is not distinct from old.feedback_closed_at
    and new.feedback_closed_by is not distinct from old.feedback_closed_by
    and new.current_calculation_run_id is not distinct from old.current_calculation_run_id
  then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'review'
    and new.status = 'approved'
    and new.period_month is not distinct from old.period_month
    and new.pay_date is not distinct from old.pay_date
    and new.generated_by is not distinct from old.generated_by
    and new.generated_at is not distinct from old.generated_at
    and new.reviewed_by is not distinct from old.reviewed_by
    and new.reviewed_at is not distinct from old.reviewed_at
    and new.paid_at is null
    and new.feedback_opened_at is not distinct from old.feedback_opened_at
    and new.feedback_closed_at is not distinct from old.feedback_closed_at
    and new.feedback_closed_by is not distinct from old.feedback_closed_by
    and new.current_calculation_run_id is not distinct from old.current_calculation_run_id
  then
    return new;
  end if;

  -- approved → approved + paid: only the payment fields may change.
  if tg_op = 'UPDATE'
    and old.status = 'approved'
    and new.status = 'approved'
    and old.paid_at is null
    and new.paid_at is not null and new.paid_by is not null and new.paid_on is not null
    and new.period_month is not distinct from old.period_month
    and new.pay_date is not distinct from old.pay_date
    and new.generated_by is not distinct from old.generated_by
    and new.generated_at is not distinct from old.generated_at
    and new.reviewed_by is not distinct from old.reviewed_by
    and new.reviewed_at is not distinct from old.reviewed_at
    and new.approved_by is not distinct from old.approved_by
    and new.approved_at is not distinct from old.approved_at
    and new.feedback_opened_at is not distinct from old.feedback_opened_at
    and new.feedback_closed_at is not distinct from old.feedback_closed_at
    and new.feedback_closed_by is not distinct from old.feedback_closed_by
    and new.current_calculation_run_id is not distinct from old.current_calculation_run_id
  then
    return new;
  end if;

  -- Scoped reopen paths, allowed only while a reopen RPC holds the flag.
  if reopen_enabled and tg_op = 'UPDATE'
    and old.status = 'approved'
    and new.status = 'review'
    and new.approved_by is null and new.approved_at is null and new.paid_at is null
    and new.period_month is not distinct from old.period_month
    and new.pay_date is not distinct from old.pay_date
    and new.generated_by is not distinct from old.generated_by
    and new.generated_at is not distinct from old.generated_at
    and new.reviewed_by is not distinct from old.reviewed_by
    and new.reviewed_at is not distinct from old.reviewed_at
    and new.feedback_opened_at is not distinct from old.feedback_opened_at
    and new.feedback_closed_at is not distinct from old.feedback_closed_at
    and new.feedback_closed_by is not distinct from old.feedback_closed_by
    and new.current_calculation_run_id is not distinct from old.current_calculation_run_id
  then
    return new;
  end if;

  if reopen_enabled and tg_op = 'UPDATE'
    and old.status = 'review'
    and new.status = 'draft'
    and new.reviewed_by is null and new.reviewed_at is null
    and new.approved_by is null and new.approved_at is null and new.paid_at is null
    and new.feedback_closed_at is null and new.feedback_closed_by is null
    and new.period_month is not distinct from old.period_month
    and new.pay_date is not distinct from old.pay_date
    and new.generated_by is not distinct from old.generated_by
    and new.generated_at is not distinct from old.generated_at
    and new.feedback_opened_at is not distinct from old.feedback_opened_at
    and new.current_calculation_run_id is not distinct from old.current_calculation_run_id
  then
    return new;
  end if;

  raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_HISTORY_IS_IMMUTABLE';
end;
$$;

-- The audit trigger used to be skipped by the replica bypass. It now sees the
-- reopen and payment updates; both RPCs write their own audit rows (with the
-- reason/reference), so the trigger steps aside for exactly those events.
create or replace function public.audit_payroll_period_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
  audit_metadata jsonb := pg_catalog.jsonb_build_object('source', 'payroll_workflow');
  previous_run_id uuid;
  new_revision integer;
begin
  if tg_op = 'UPDATE' and pg_catalog.current_setting('app.payroll_reopen', true) = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.paid_at is null and new.paid_at is not null then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'draft'
    and new.status = 'draft'
    and old.current_calculation_run_id is not null
    and new.current_calculation_run_id is null
  then
    return new;
  end if;

  if tg_op = 'INSERT' then
    audit_action := 'payroll_draft_created';
  elsif old.status = 'draft' and new.status = 'review' then
    audit_action := 'payroll_submitted_for_review';
  elsif old.status = 'review' and new.status = 'approved' then
    audit_action := 'payroll_approved';
  elsif old.status = 'draft'
    and new.status = 'draft'
    and old.current_calculation_run_id is null
    and new.current_calculation_run_id is not null
  then
    select run.revision into new_revision
    from public.payroll_calculation_runs as run
    where run.id = new.current_calculation_run_id;

    if new_revision > 1 then
      audit_action := 'payroll_draft_reset';
      select run.id into previous_run_id
      from public.payroll_calculation_runs as run
      where run.payroll_period_id = new.id
        and run.status = 'superseded'
        and run.id <> new.current_calculation_run_id
      order by run.revision desc
      limit 1;
      audit_metadata := audit_metadata || pg_catalog.jsonb_build_object(
        'previous_calculation_run_id', previous_run_id,
        'new_calculation_run_id', new.current_calculation_run_id
      );
    else
      audit_action := 'payroll_calculation_revised';
    end if;
  elsif old.status = 'draft'
    and new.status = 'draft'
    and new.current_calculation_run_id is distinct from old.current_calculation_run_id
  then
    audit_action := 'payroll_calculation_revised';
  elsif old.status = 'draft'
    and new.status = 'draft'
    and new.feedback_closed_at is distinct from old.feedback_closed_at
  then
    audit_action := 'payroll_feedback_closed';
  else
    raise exception using errcode = 'P0001', message = 'UNSUPPORTED_PAYROLL_PERIOD_AUDIT_EVENT';
  end if;

  insert into public.audit_logs (
    actor_user_id, module, action, entity_type, entity_id, old_data, new_data, metadata
  ) values (
    coalesce(auth.uid(), new.generated_by),
    'payroll',
    audit_action,
    'payroll_period',
    new.id::text,
    case when tg_op = 'UPDATE' then pg_catalog.to_jsonb(old) else null end,
    pg_catalog.to_jsonb(new),
    audit_metadata
  );

  return new;
end;
$$;
revoke all on function public.audit_payroll_period_change() from public, anon, authenticated;

create or replace function public.reopen_payroll_period(
  p_payroll_period_id uuid,
  p_reason text
)
returns public.payroll_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target public.payroll_periods%rowtype;
  updated_period public.payroll_periods%rowtype;
  normalized_reason text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('payroll.owner_approve') then
    raise exception using errcode = '42501', message = 'PAYROLL_OWNER_APPROVE_PERMISSION_REQUIRED';
  end if;

  normalized_reason := pg_catalog.btrim(p_reason);
  if normalized_reason is null or pg_catalog.length(normalized_reason) < 5 then
    raise exception using errcode = '22023', message = 'PAYROLL_REOPEN_REASON_REQUIRED';
  end if;

  select * into target from public.payroll_periods where id = p_payroll_period_id for update;
  if target.paid_at is not null then
    raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_ALREADY_PAID';
  end if;

  -- Scoped bypass: only the history trigger reads this flag, and only for
  -- the approved → review step. Every other trigger keeps running.
  perform pg_catalog.set_config('app.payroll_reopen', 'on', true);
  update public.payroll_periods
  set
    status      = 'review',
    approved_by = null,
    approved_at = null
  where id = p_payroll_period_id
    and status = 'approved'
  returning * into updated_period;
  perform pg_catalog.set_config('app.payroll_reopen', 'off', true);

  if not found then
    raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_NOT_APPROVED';
  end if;

  insert into public.audit_logs (
    module,
    action,
    entity_type,
    entity_id,
    actor_user_id,
    metadata
  ) values (
    'payroll',
    'payroll_period_reopened',
    'payroll_period',
    p_payroll_period_id,
    actor_id,
    jsonb_build_object(
      'reason',           normalized_reason,
      'period_month',     updated_period.period_month,
      'previous_status',  'approved'
    )
  );

  return updated_period;
end;
$$;

create or replace function public.reopen_payroll_to_draft(
  p_payroll_period_id uuid,
  p_reason text
)
returns public.payroll_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target public.payroll_periods%rowtype;
  updated_period public.payroll_periods%rowtype;
  normalized_reason text;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;

  if not public.has_permission('payroll.accountant_reconcile') then
    raise exception using errcode = '42501', message = 'PAYROLL_ACCOUNTANT_RECONCILE_PERMISSION_REQUIRED';
  end if;

  normalized_reason := pg_catalog.btrim(p_reason);
  if normalized_reason is null or pg_catalog.length(normalized_reason) < 5 then
    raise exception using errcode = '22023', message = 'PAYROLL_REOPEN_REASON_REQUIRED';
  end if;

  select * into target from public.payroll_periods where id = p_payroll_period_id for update;
  if target.paid_at is not null then
    raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_ALREADY_PAID';
  end if;

  perform pg_catalog.set_config('app.payroll_reopen', 'on', true);
  update public.payroll_periods
  set
    status             = 'draft',
    reviewed_by        = null,
    reviewed_at        = null,
    feedback_closed_at = null,
    feedback_closed_by = null
  where id = p_payroll_period_id
    and status = 'review'
  returning * into updated_period;
  perform pg_catalog.set_config('app.payroll_reopen', 'off', true);

  if not found then
    raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_NOT_IN_REVIEW';
  end if;

  insert into public.audit_logs (
    module,
    action,
    entity_type,
    entity_id,
    actor_user_id,
    metadata
  ) values (
    'payroll',
    'payroll_period_reopened_to_draft',
    'payroll_period',
    p_payroll_period_id::text,
    actor_id,
    jsonb_build_object(
      'reason',          normalized_reason,
      'period_month',    updated_period.period_month,
      'previous_status', 'review'
    )
  );

  return updated_period;
end;
$$;

create or replace function public.mark_payroll_period_paid(
  p_payroll_period_id uuid,
  p_paid_on date,
  p_payment_reference text default null,
  p_note text default null
)
returns public.payroll_periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  business_today date := (pg_catalog.now() at time zone 'Asia/Ho_Chi_Minh')::date;
  normalized_reference text := nullif(pg_catalog.btrim(coalesce(p_payment_reference, '')), '');
  normalized_note text := nullif(pg_catalog.btrim(coalesce(p_note, '')), '');
  target public.payroll_periods%rowtype;
  updated_period public.payroll_periods%rowtype;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'AUTHENTICATED_USER_REQUIRED';
  end if;
  if not (public.has_permission('payroll.owner_approve') or public.has_permission('payroll.accountant_reconcile')) then
    raise exception using errcode = '42501', message = 'PAYROLL_PAYMENT_PERMISSION_REQUIRED';
  end if;
  if p_paid_on is null or p_paid_on > business_today then
    raise exception using errcode = '22023', message = 'PAYROLL_PAID_ON_INVALID';
  end if;
  if normalized_reference is not null and pg_catalog.length(normalized_reference) > 160 then
    raise exception using errcode = '22023', message = 'PAYROLL_PAYMENT_REFERENCE_INVALID';
  end if;
  if normalized_note is not null and pg_catalog.length(normalized_note) > 2000 then
    raise exception using errcode = '22023', message = 'PAYROLL_PAYMENT_NOTE_INVALID';
  end if;

  select * into target from public.payroll_periods where id = p_payroll_period_id for update;
  if not found or target.status <> 'approved' then
    raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_NOT_APPROVED';
  end if;
  if target.paid_at is not null then
    raise exception using errcode = '23514', message = 'PAYROLL_PERIOD_ALREADY_PAID';
  end if;

  update public.payroll_periods
  set paid_by = actor_id, paid_at = pg_catalog.now(), paid_on = p_paid_on,
      payment_reference = normalized_reference, payment_note = normalized_note
  where id = p_payroll_period_id
  returning * into updated_period;

  insert into public.audit_logs (
    module, action, entity_type, entity_id, actor_user_id, new_data, reason, metadata
  ) values (
    'payroll', 'payroll_period_paid', 'payroll_period', p_payroll_period_id::text, actor_id,
    jsonb_build_object('paid_on', p_paid_on, 'payment_reference', normalized_reference),
    normalized_note,
    jsonb_build_object('period_month', updated_period.period_month)
  );

  return updated_period;
end;
$$;

revoke all on function public.mark_payroll_period_paid(uuid, date, text, text) from public, anon;
grant execute on function public.mark_payroll_period_paid(uuid, date, text, text) to authenticated;
revoke all on function public.reopen_payroll_period(uuid, text) from public, anon;
grant execute on function public.reopen_payroll_period(uuid, text) to authenticated;
revoke all on function public.reopen_payroll_to_draft(uuid, text) from public, anon;
grant execute on function public.reopen_payroll_to_draft(uuid, text) to authenticated;

commit;
