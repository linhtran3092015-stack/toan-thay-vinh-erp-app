"use client";

import type { FormEvent, ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { createPaymentRequestAction } from "@/features/finance/actions/finance-actions";
import type { FinanceActionResultState } from "@/features/finance/forms/finance-action-types";
import type { PaymentRequestStudentOption } from "@/features/finance/payment-request-create-data";

interface PaymentRequestCreateFormProps {
  isPaymentConfigured: boolean;
  students: PaymentRequestStudentOption[];
}

interface FormState {
  bonusSessions: string;
  expectedAmountVnd: string;
  notes: string;
  purchasedSessions: string;
  studentId: string;
  topupType: "new" | "renewal";
}

const initialFormState: FormState = {
  bonusSessions: "0",
  expectedAmountVnd: "1400000",
  notes: "",
  purchasedSessions: "10",
  studentId: "",
  topupType: "new",
};

export function PaymentRequestCreateForm({
  isPaymentConfigured,
  students,
}: PaymentRequestCreateFormProps) {
  const [form, setForm] = useState(initialFormState);
  const [actionState, setActionState] =
    useState<FinanceActionResultState | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === form.studentId) ?? null,
    [form.studentId, students],
  );
  const expectedAmountVnd = Number(form.expectedAmountVnd) || 0;
  const purchasedSessions = Number(form.purchasedSessions) || 0;
  const bonusSessions = Number(form.bonusSessions) || 0;
  const calculatedUnitPriceVnd = Math.round(
    expectedAmountVnd / Math.max(purchasedSessions, 1),
  );
  const fieldErrors =
    actionState?.status === "error" ? actionState.fieldErrors ?? {} : {};

  const updateField = <Key extends keyof FormState>(
    key: Key,
    value: FormState[Key],
  ) => {
    setActionState(null);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionState(null);

    startTransition(async () => {
      const result = await createPaymentRequestAction({
        bonusSessions,
        calculatedUnitPriceVnd,
        expectedAmountVnd,
        notes: form.notes,
        purchasedSessions,
        studentId: form.studentId,
        topupType: form.topupType,
      });
      setActionState(result);
    });
  };

  if (actionState?.status === "success" && actionState.paymentRequest) {
    return (
      <PaymentRequestSuccess
        onCreateAnother={() => {
          setForm(initialFormState);
          setActionState(null);
        }}
        paymentRequest={actionState.paymentRequest}
        student={selectedStudent}
      />
    );
  }

  return (
    <div className="grid min-w-0 gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-ink-muted">Tài chính</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">
            Tạo yêu cầu thanh toán
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Khởi tạo mã thanh toán riêng cho học viên và QR chuyển khoản SePay.
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-hairline bg-surface-1 px-4 text-sm font-semibold text-ink hover:bg-surface-2"
          href="/finance/payment-requests"
        >
          Quay lại danh sách
        </Link>
      </header>

      {!isPaymentConfigured ? (
        <section className="rounded-lg border border-warning-border bg-warning-bg p-4">
          <h2 className="font-semibold text-warning">Chưa cấu hình tài khoản VietQR</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink">
            Cần cấu hình mã ngân hàng và số tài khoản nhận tiền trên server trước khi tạo yêu cầu.
          </p>
        </section>
      ) : null}

      {actionState?.status === "error" ? (
        <section className="rounded-lg border border-danger-border bg-danger-bg p-4 text-sm text-danger">
          <p className="font-semibold">{actionState.message}</p>
        </section>
      ) : null}

      <form className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]" onSubmit={handleSubmit}>
        <section className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card md:p-5">
          <h2 className="font-display text-lg font-bold text-ink">Thông tin yêu cầu</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold text-ink sm:col-span-2">
              <span>Học viên</span>
              <select
                className={inputClassName}
                disabled={isPending}
                onChange={(event) => updateField("studentId", event.target.value)}
                value={form.studentId}
              >
                <option value="">Chọn học viên có phụ huynh chính</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({student.publicCode}) · {student.guardianName} · {student.guardianPhone}
                  </option>
                ))}
              </select>
              <FieldError messages={fieldErrors.studentId} />
            </label>

            <FormField label="Số tiền dự kiến (VND)" messages={fieldErrors.expectedAmountVnd}>
              <input
                className={inputClassName}
                disabled={isPending}
                inputMode="numeric"
                min={10000}
                onChange={(event) => updateField("expectedAmountVnd", event.target.value)}
                step={10000}
                type="number"
                value={form.expectedAmountVnd}
              />
            </FormField>

            <FormField label="Loại nạp" messages={fieldErrors.topupType}>
              <select
                className={inputClassName}
                disabled={isPending}
                onChange={(event) =>
                  updateField("topupType", event.target.value as FormState["topupType"])
                }
                value={form.topupType}
              >
                <option value="new">Tuyển mới</option>
                <option value="renewal">Tái phí</option>
              </select>
            </FormField>

            <FormField label="Số buổi mua" messages={fieldErrors.purchasedSessions}>
              <input
                className={inputClassName}
                disabled={isPending}
                inputMode="numeric"
                min={1}
                onChange={(event) => updateField("purchasedSessions", event.target.value)}
                type="number"
                value={form.purchasedSessions}
              />
            </FormField>

            <FormField label="Số buổi tặng" messages={fieldErrors.bonusSessions}>
              <input
                className={inputClassName}
                disabled={isPending}
                inputMode="numeric"
                min={0}
                onChange={(event) => updateField("bonusSessions", event.target.value)}
                type="number"
                value={form.bonusSessions}
              />
            </FormField>

            <label className="grid gap-1.5 text-sm font-semibold text-ink sm:col-span-2">
              <span>Ghi chú</span>
              <textarea
                className="min-h-24 min-w-0 resize-y rounded-md border border-hairline bg-white px-3 py-2.5 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20"
                disabled={isPending}
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Thông tin gói học hoặc lưu ý nội bộ..."
                value={form.notes}
              />
              <FieldError messages={fieldErrors.notes} />
            </label>
          </div>
        </section>

        <aside className="h-fit rounded-lg border border-hairline bg-surface-1 p-4 shadow-card md:p-5">
          <h2 className="font-display text-base font-bold text-ink">Xác nhận yêu cầu</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <SummaryRow label="Học viên" value={selectedStudent?.name ?? "Chưa chọn"} />
            <SummaryRow label="Phụ huynh" value={selectedStudent?.guardianName ?? "Chưa chọn"} />
            <SummaryRow label="Số tiền" value={formatCurrency(expectedAmountVnd)} />
            <SummaryRow
              label="Gói buổi học"
              value={`${purchasedSessions} mua${bonusSessions > 0 ? ` + ${bonusSessions} tặng` : ""}`}
            />
            <SummaryRow label="Đơn giá" value={`${formatCurrency(calculatedUnitPriceVnd)}/buổi`} />
          </dl>

          <Button
            className="mt-5 min-h-11 w-full"
            disabled={
              !isPaymentConfigured ||
              students.length === 0 ||
              !form.studentId ||
              expectedAmountVnd < 10000 ||
              purchasedSessions < 1
            }
            isLoading={isPending}
            size="lg"
            type="submit"
          >
            {isPending ? "Đang tạo yêu cầu..." : "Tạo yêu cầu và VietQR"}
          </Button>

          {students.length === 0 ? (
            <p className="mt-3 text-xs leading-relaxed text-warning">
              Chưa có học viên đang học với phụ huynh chính để tạo yêu cầu.
            </p>
          ) : null}
        </aside>
      </form>
    </div>
  );
}

function PaymentRequestSuccess({
  onCreateAnother,
  paymentRequest,
  student,
}: {
  onCreateAnother: () => void;
  paymentRequest: NonNullable<Extract<FinanceActionResultState, { status: "success" }>["paymentRequest"]>;
  student: PaymentRequestStudentOption | null;
}) {
  const [copiedField, setCopiedField] = useState<"account" | "description" | null>(null);

  const copyText = async (field: "account" | "description", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(null), 1600);
    } catch {
      setCopiedField(null);
    }
  };

  return (
    <div className="grid min-w-0 gap-5">
      <header>
        <p className="text-xs font-semibold uppercase text-success">Đã khởi tạo</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">
          Yêu cầu thanh toán đã sẵn sàng
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Gửi mã QR hoặc thông tin chuyển khoản bên dưới cho phụ huynh.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(320px,520px)_minmax(0,1fr)]">
        <section className="rounded-lg border border-hairline bg-white p-4 shadow-card">
          <Image
            alt={`Mã VietQR cho yêu cầu ${paymentRequest.publicCode}`}
            className="mx-auto h-auto w-full max-w-[480px]"
            height={520}
            priority
            src={paymentRequest.qrImageUrl}
            unoptimized
            width={520}
          />
        </section>

        <section className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
            <div>
              <p className="text-xs font-semibold text-ink-muted">Mã yêu cầu</p>
              <p className="mt-1 font-mono text-base font-bold text-primary">
                {paymentRequest.publicCode}
              </p>
            </div>
            <p className="text-xl font-bold text-ink">
              {formatCurrency(paymentRequest.expectedAmountVnd)}
            </p>
          </div>

          <dl className="mt-4 grid gap-4 text-sm">
            <TransferDetail label="Học viên" value={student?.name ?? "Học viên"} />
            <TransferDetail label="Ngân hàng" value={paymentRequest.bankCode} />
            {paymentRequest.accountHolder ? (
              <TransferDetail label="Chủ tài khoản" value={paymentRequest.accountHolder} />
            ) : null}
            <TransferDetail
              actionLabel={copiedField === "account" ? "Đã sao chép" : "Sao chép"}
              label="Số tài khoản"
              onAction={() => copyText("account", paymentRequest.accountNumber)}
              value={paymentRequest.accountNumber}
            />
            <TransferDetail
              actionLabel={copiedField === "description" ? "Đã sao chép" : "Sao chép"}
              label="Nội dung chuyển khoản"
              onAction={() => copyText("description", paymentRequest.transferDescription)}
              value={paymentRequest.transferDescription}
            />
          </dl>

          <p className="mt-5 rounded-md border border-warning-border bg-warning-bg p-3 text-sm leading-relaxed text-ink">
            Phụ huynh cần chuyển đúng số tiền và giữ nguyên nội dung để SePay tự động đối soát.
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <Button className="min-h-11" onClick={onCreateAnother} variant="outline">
              Tạo yêu cầu khác
            </Button>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-primary bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-strong"
              href="/finance/payment-requests"
            >
              Xem danh sách
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function FormField({
  children,
  label,
  messages,
}: {
  children: ReactNode;
  label: string;
  messages?: string[];
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-ink">
      <span>{label}</span>
      {children}
      <FieldError messages={messages} />
    </label>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  return messages?.[0] ? (
    <span className="text-xs font-medium text-danger">{messages[0]}</span>
  ) : null;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-hairline pb-3 last:border-0 last:pb-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

function TransferDetail({
  actionLabel,
  label,
  onAction,
  value,
}: {
  actionLabel?: string;
  label: string;
  onAction?: () => void;
  value: string;
}) {
  return (
    <div className="rounded-md bg-surface-2 p-3">
      <dt className="text-xs font-semibold text-ink-muted">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <span className="break-all font-mono font-bold text-ink">{value}</span>
        {onAction && actionLabel ? (
          <Button className="min-h-11" onClick={onAction} size="sm" variant="ghost">
            {actionLabel}
          </Button>
        ) : null}
      </dd>
    </div>
  );
}

const inputClassName =
  "h-11 min-w-0 rounded-md border border-hairline bg-white px-3 text-sm font-normal text-ink outline-none transition focus:border-secondary focus:ring-[3px] focus:ring-secondary/20 disabled:bg-surface-2 disabled:text-ink-muted";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}
