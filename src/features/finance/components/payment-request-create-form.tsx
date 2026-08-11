"use client";

import { cloneElement, isValidElement, type FormEvent, type ReactElement, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Copy } from "lucide-react";

import { PageHeader } from "@/components/patterns/page-header";
import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { createPaymentRequestAction } from "@/features/finance/actions/finance-actions";
import type { FinanceActionResultState } from "@/features/finance/forms/finance-action-types";
import type { PaymentRequestStudentOption } from "@/features/finance/payment-request-create-data";
import { getPaymentRequestDirectoryQuery } from "@/features/finance/payment-request-url-state";

interface PaymentRequestCreateFormProps { isPaymentConfigured: boolean; students: PaymentRequestStudentOption[]; }
interface FormState { bonusSessions: string; expectedAmountVnd: string; notes: string; purchasedSessions: string; studentId: string; topupType: "new" | "renewal"; }
const initialFormState: FormState = { bonusSessions: "0", expectedAmountVnd: "1400000", notes: "", purchasedSessions: "10", studentId: "", topupType: "new" };

export function PaymentRequestCreateForm({ isPaymentConfigured, students }: PaymentRequestCreateFormProps) {
  const searchParams = useSearchParams();
  const [form, setForm] = useState(initialFormState);
  const [actionState, setActionState] = useState<FinanceActionResultState | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedStudent = useMemo(() => students.find((student) => student.id === form.studentId) ?? null, [form.studentId, students]);
  const expectedAmountVnd = Number(form.expectedAmountVnd) || 0;
  const purchasedSessions = Number(form.purchasedSessions) || 0;
  const bonusSessions = Number(form.bonusSessions) || 0;
  // Presentation-only preview. The payment-request RPC derives the persisted
  // unit price from the authoritative amount and purchased-session inputs.
  const unitPricePreviewVnd = Math.round(expectedAmountVnd / Math.max(purchasedSessions, 1));
  const fieldErrors = actionState?.status === "error" ? actionState.fieldErrors ?? {} : {};
  const returnQuery = getPaymentRequestDirectoryQuery(searchParams);
  const directoryHref = returnQuery ? `/finance/payment-requests?${returnQuery}` : "/finance/payment-requests";
  const updateField = <Key extends keyof FormState>(key: Key, value: FormState[Key]) => { setActionState(null); setForm((current) => ({ ...current, [key]: value })); };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionState(null);
    startTransition(async () => {
      const result = await createPaymentRequestAction({ bonusSessions, expectedAmountVnd, notes: form.notes, purchasedSessions, studentId: form.studentId, topupType: form.topupType });
      setActionState(result);
    });
  };

  if (actionState?.status === "success" && actionState.paymentRequest) {
    return <PaymentRequestSuccess directoryHref={directoryHref} onCreateAnother={() => { setForm(initialFormState); setActionState(null); }} paymentRequest={actionState.paymentRequest} student={selectedStudent} />;
  }

  return (
    <div className="grid min-w-0 gap-5">
      <PageHeader actions={<Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border-subtle px-4 text-control font-semibold text-action-link hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={directoryHref}><ArrowLeft aria-hidden="true" size={18} strokeWidth={2} />Quay lại danh sách</Link>} title="Tạo yêu cầu thanh toán">
        <p className="mt-1 text-secondary text-text-muted">Khởi tạo mã thanh toán riêng cho học viên và QR chuyển khoản hiện có.</p>
      </PageHeader>

      {!isPaymentConfigured ? <ResultBanner description="Cần cấu hình mã ngân hàng và số tài khoản nhận tiền trên server trước khi tạo yêu cầu." title="Chưa cấu hình tài khoản VietQR" tone="warning" /> : null}
      {actionState?.status === "error" ? <ResultBanner description={actionState.message} title="Không thể tạo yêu cầu" tone="error" /> : null}

      <form className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]" onSubmit={handleSubmit}>
        <section className="rounded-lg border border-border-subtle bg-surface-base p-4 md:p-5" aria-labelledby="payment-request-form-title">
          <h2 className="text-section-title text-text-strong" id="payment-request-form-title">Thông tin yêu cầu</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <ControlField id="payment-request-student" label="Học viên" messages={fieldErrors.studentId} className="sm:col-span-2">
              <select className={inputClassName} disabled={isPending} onChange={(event) => updateField("studentId", event.target.value)} value={form.studentId}>
                <option value="">Chọn học viên có phụ huynh chính</option>
                {students.map((student) => <option key={student.id} value={student.id}>{student.name} ({student.publicCode}) · {student.guardianName} · {student.guardianPhone}</option>)}
              </select>
            </ControlField>
            <ControlField id="payment-request-expected-amount" label="Số tiền dự kiến (VND)" messages={fieldErrors.expectedAmountVnd}>
              <input className={inputClassName} disabled={isPending} inputMode="numeric" min={10000} onChange={(event) => updateField("expectedAmountVnd", event.target.value)} step={10000} type="number" value={form.expectedAmountVnd} />
            </ControlField>
            <ControlField id="payment-request-topup-type" label="Loại nạp" messages={fieldErrors.topupType}>
              <select className={inputClassName} disabled={isPending} onChange={(event) => updateField("topupType", event.target.value as FormState["topupType"])} value={form.topupType}><option value="new">Tuyển mới</option><option value="renewal">Tái phí</option></select>
            </ControlField>
            <ControlField id="payment-request-purchased-sessions" label="Số buổi mua" messages={fieldErrors.purchasedSessions}>
              <input className={inputClassName} disabled={isPending} inputMode="numeric" min={1} onChange={(event) => updateField("purchasedSessions", event.target.value)} type="number" value={form.purchasedSessions} />
            </ControlField>
            <ControlField id="payment-request-bonus-sessions" label="Số buổi tặng" messages={fieldErrors.bonusSessions}>
              <input className={inputClassName} disabled={isPending} inputMode="numeric" min={0} onChange={(event) => updateField("bonusSessions", event.target.value)} type="number" value={form.bonusSessions} />
            </ControlField>
            <ControlField id="payment-request-notes" label="Ghi chú" messages={fieldErrors.notes} className="sm:col-span-2">
              <textarea className={`${inputClassName} min-h-24 h-auto resize-y py-2.5`} disabled={isPending} onChange={(event) => updateField("notes", event.target.value)} placeholder="Thông tin gói học hoặc lưu ý nội bộ..." value={form.notes} />
            </ControlField>
          </div>
        </section>

        <aside className="h-fit rounded-lg border border-border-subtle bg-surface-base p-4 md:p-5" aria-labelledby="payment-request-confirmation-title">
          <h2 className="text-section-title text-text-strong" id="payment-request-confirmation-title">Xác nhận yêu cầu</h2>
          <dl className="mt-4 grid gap-3 text-secondary">
            <SummaryRow label="Học viên" value={selectedStudent?.name ?? "Chưa chọn"} />
            <SummaryRow label="Phụ huynh" value={selectedStudent?.guardianName ?? "Chưa chọn"} />
            <SummaryRow label="Số tiền" value={formatCurrency(expectedAmountVnd)} />
            <SummaryRow label="Gói buổi học" value={`${purchasedSessions} mua${bonusSessions > 0 ? ` + ${bonusSessions} tặng` : ""}`} />
            <SummaryRow label="Đơn giá ước tính" value={`${formatCurrency(unitPricePreviewVnd)}/buổi`} />
          </dl>
          <Button className="mt-5 min-h-11 w-full" disabled={!isPaymentConfigured || students.length === 0 || !form.studentId || expectedAmountVnd < 10000 || purchasedSessions < 1} isLoading={isPending} size="lg" type="submit">
            {isPending ? "Đang tạo yêu cầu..." : "Tạo yêu cầu và VietQR"}
          </Button>
          {students.length === 0 ? <p className="mt-3 text-caption leading-relaxed text-warning">Chưa có học viên đang học với phụ huynh chính để tạo yêu cầu.</p> : null}
        </aside>
      </form>
    </div>
  );
}

function PaymentRequestSuccess({ directoryHref, onCreateAnother, paymentRequest, student }: { directoryHref: string; onCreateAnother: () => void; paymentRequest: NonNullable<Extract<FinanceActionResultState, { status: "success" }>["paymentRequest"]>; student: PaymentRequestStudentOption | null; }) {
  const [copiedField, setCopiedField] = useState<"account" | "description" | null>(null);
  const copyText = async (field: "account" | "description", value: string) => { try { await navigator.clipboard.writeText(value); setCopiedField(field); window.setTimeout(() => setCopiedField(null), 1600); } catch { setCopiedField(null); } };
  return (
    <div className="grid min-w-0 gap-5">
      <PageHeader title="Yêu cầu thanh toán đã sẵn sàng"><p className="mt-1 text-secondary text-text-muted">Gửi mã QR hoặc thông tin chuyển khoản bên dưới cho phụ huynh.</p></PageHeader>
      <ResultBanner description="Yêu cầu và thông tin VietQR đã được khởi tạo." title="Đã khởi tạo yêu cầu thanh toán" tone="success" />
      <div className="grid gap-5 lg:grid-cols-[minmax(320px,520px)_minmax(0,1fr)]">
        <section className="rounded-lg border border-border-subtle bg-surface-base p-4"><Image alt={`Mã VietQR cho yêu cầu ${paymentRequest.publicCode}`} className="mx-auto h-auto w-full max-w-[480px]" height={520} priority src={paymentRequest.qrImageUrl} unoptimized width={520} /></section>
        <section className="rounded-lg border border-border-subtle bg-surface-base p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4"><div><p className="text-label text-text-muted">Mã yêu cầu</p><p className="mt-1 font-mono text-body font-bold text-action-link">{paymentRequest.publicCode}</p></div><p className="tabular-nums text-kpi text-text-strong">{formatCurrency(paymentRequest.expectedAmountVnd)}</p></div>
          <dl className="mt-4 grid gap-4 text-secondary">
            <TransferDetail label="Học viên" value={student?.name ?? "Học viên"} />
            <TransferDetail label="Ngân hàng" value={paymentRequest.bankCode} />
            {paymentRequest.accountHolder ? <TransferDetail label="Chủ tài khoản" value={paymentRequest.accountHolder} /> : null}
            <TransferDetail actionLabel={copiedField === "account" ? "Đã sao chép" : "Sao chép"} label="Số tài khoản" onAction={() => copyText("account", paymentRequest.accountNumber)} value={paymentRequest.accountNumber} />
            <TransferDetail actionLabel={copiedField === "description" ? "Đã sao chép" : "Sao chép"} label="Nội dung chuyển khoản" onAction={() => copyText("description", paymentRequest.transferDescription)} value={paymentRequest.transferDescription} />
          </dl>
          <p className="mt-5 rounded-md border border-status-warning-border bg-status-warning-soft p-3 text-secondary leading-relaxed text-text-default">Phụ huynh cần chuyển đúng số tiền và giữ nguyên nội dung để SePay tự động đối soát.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2"><Button className="min-h-11" onClick={onCreateAnother} variant="outline">Tạo yêu cầu khác</Button><Link className="inline-flex min-h-11 items-center justify-center rounded-md bg-action-primary px-4 text-control font-semibold text-text-on-primary hover:bg-action-primary-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring" href={directoryHref}>Xem danh sách</Link></div>
        </section>
      </div>
    </div>
  );
}

function ControlField({ children, className, id, label, messages }: { children: ReactElement<{ "aria-describedby"?: string; "aria-invalid"?: boolean; id?: string }>; className?: string; id: string; label: string; messages?: string[]; }) {
  const errorId = `${id}-error`;
  const error = messages?.[0];
  return <div className={`grid gap-1.5 ${className ?? ""}`}><label className="text-label text-text-default" htmlFor={id}>{label}</label>{isValidElement(children) ? cloneElement(children, { "aria-describedby": error ? errorId : undefined, "aria-invalid": Boolean(error), id }) : children}{error ? <p className="text-caption font-medium text-status-danger" id={errorId}>{error}</p> : null}</div>;
}

function SummaryRow({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-3 last:border-0 last:pb-0"><dt className="text-text-muted">{label}</dt><dd className="text-right font-semibold text-text-strong">{value}</dd></div>; }
function TransferDetail({ actionLabel, label, onAction, value }: { actionLabel?: string; label: string; onAction?: () => void; value: string }) { return <div className="rounded-md bg-surface-raised p-3"><dt className="text-label text-text-muted">{label}</dt><dd className="mt-1 flex flex-wrap items-center justify-between gap-2"><span className="break-all font-mono font-bold text-text-strong">{value}</span>{onAction && actionLabel ? <Button className="min-h-11" onClick={onAction} size="sm" variant="ghost">{actionLabel === "Đã sao chép" ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}{actionLabel}</Button> : null}</dd></div>; }
const inputClassName = "h-11 min-w-0 rounded-md border border-border-subtle bg-surface-base px-3 text-control text-text-default outline-none transition focus-visible:border-focus-ring focus-visible:ring-[3px] focus-visible:ring-focus-ring disabled:bg-disabled-bg disabled:text-text-muted";
const currencyFormatter = new Intl.NumberFormat("vi-VN", { currency: "VND", maximumFractionDigits: 0, style: "currency" });
function formatCurrency(value: number): string { return currencyFormatter.format(value); }
