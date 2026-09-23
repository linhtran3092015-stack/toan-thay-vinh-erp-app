"use client";

import { useState, useTransition } from "react";

import { createTuitionPeriodAction, lockTuitionPeriodAction } from "@/features/tuition/actions";
import Link from "next/link";
import type { TuitionPeriodListItem, TuitionPreviewRow, TuitionSystemBlocker } from "@/features/tuition/data";
import { summarizeTuitionPreview } from "@/features/tuition/readiness";

interface TuitionPeriodDirectoryProps {
  canLock: boolean;
  canManage: boolean;
  periods: TuitionPeriodListItem[];
  previewByPeriod: Record<string, TuitionPreviewRow[]>;
  systemBlockersByPeriod: Record<string, TuitionSystemBlocker[]>;
}

export function TuitionPeriodDirectory({ canLock, canManage, periods, previewByPeriod, systemBlockersByPeriod }: TuitionPeriodDirectoryProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function createPeriod(formData: FormData): void {
    startTransition(async () => {
      const result = await createTuitionPeriodAction({ dueOn: String(formData.get("dueOn") || ""), endsOn: String(formData.get("endsOn") || ""), name: String(formData.get("name") || ""), startsOn: String(formData.get("startsOn") || "") });
      setMessage(result.message);
    });
  }

  function lock(periodId: string): void {
    startTransition(async () => setMessage((await lockTuitionPeriodAction(periodId)).message));
  }

  return <div className="grid min-w-0 gap-5">
    {canManage ? <form action={createPeriod} className="grid gap-3 rounded-lg border border-border-subtle bg-surface-base p-4 md:grid-cols-4" aria-label="Tạo kỳ thu học phí">
      <label className="grid gap-1 text-label text-text-muted md:col-span-2">Tên kỳ<input className="h-10 rounded-md border border-border-subtle bg-surface-base px-3 text-text-strong" name="name" placeholder="Học phí tháng 08/2026" required /></label>
      <label className="grid gap-1 text-label text-text-muted">Từ ngày<input className="h-10 rounded-md border border-border-subtle bg-surface-base px-3 text-text-strong" name="startsOn" type="date" required /></label>
      <label className="grid gap-1 text-label text-text-muted">Đến ngày<input className="h-10 rounded-md border border-border-subtle bg-surface-base px-3 text-text-strong" name="endsOn" type="date" required /></label>
      <label className="grid gap-1 text-label text-text-muted">Hạn thanh toán (tuỳ chọn)<input className="h-10 rounded-md border border-border-subtle bg-surface-base px-3 text-text-strong" name="dueOn" type="date" /></label>
      <div className="flex items-end"><button className="inline-flex h-10 items-center rounded-md bg-action-primary px-4 font-semibold text-text-on-primary disabled:opacity-50" disabled={isPending} type="submit">Tạo kỳ thu</button></div>
    </form> : null}
    {message ? <p className="rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-secondary text-text-default" role="status">{message}</p> : null}
    <div className="grid gap-3">
      {periods.map((period) => {
        const preview = previewByPeriod[period.id] ?? [];
        const blockers = preview.filter((row) => row.blockerCode);
        const systemBlockers = systemBlockersByPeriod[period.id] ?? [];
        const students = summarizeTuitionPreview(preview);
        const missingRates = students.filter(student => student.issues.includes("MISSING_EFFECTIVE_TUITION_RATE")).length;
        const missingSources = students.filter(student => student.issues.includes("MISSING_ACQUISITION_SOURCE")).length;
        const hasBlockers = students.some(student => student.issues.length > 0) || systemBlockers.length > 0 || preview.length === 0;
        const total = preview.reduce((sum, row) => sum + (row.unitPriceVnd ?? 0), 0);
        return <article className="rounded-lg border border-border-subtle bg-surface-base p-4" key={period.id}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-text-strong"><Link href={`/finance/tuition-periods/${period.id}`}>{period.name}</Link></h2><p className="mt-1 text-secondary text-text-muted">{period.startsOn} → {period.endsOn}{period.dueOn ? ` · Hạn: ${period.dueOn}` : ""}</p></div><span className="rounded-full border border-border-subtle px-2 py-1 text-caption font-semibold text-text-default">{period.status === "locked" ? "Đã khóa" : "Nháp"}</span></div>
          {period.status === "draft" ? <>
            <dl className="mt-4 grid gap-2 text-secondary text-text-muted sm:grid-cols-3"><div><dt>Học viên · Lượt học dự kiến</dt><dd className="mt-1 font-semibold text-text-strong">{students.length} học viên · {preview.length} lượt</dd></div><div><dt>Lượt học cần bổ sung dữ liệu</dt><dd className="mt-1 font-semibold text-text-strong">{blockers.length}</dd></div><div><dt>Giá trị lịch học trước bù trừ</dt><dd className="mt-1 font-semibold text-text-strong">{systemBlockers.some(b => b.code === "PREVIEW_UNAVAILABLE") || missingRates > 0 ? "Chưa đủ dữ liệu để tính" : formatVnd(total)}</dd></div></dl>
            <p className="mt-3 text-secondary text-text-muted">Yêu cầu thanh toán chỉ được tạo sau khi khóa kỳ thành công; tạo bản nháp chưa phát sinh khoản phải thu.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">{hasBlockers ? <div className="grid gap-1 text-secondary text-danger">
              {missingRates > 0 ? <p>{missingRates} học viên thiếu đơn giá. Cần nhập mức phí có hiệu lực từ ngày học tương ứng.</p> : null}
              {missingSources > 0 ? <p>{missingSources} học viên chưa có nguồn.</p> : null}
              {students.some(student => student.issues.includes("MISSING_PRIMARY_GUARDIAN")) ? <p>Có học viên chưa có phụ huynh chính. Bổ sung phụ huynh để tạo nội dung chuyển khoản.</p> : null}
              {preview.length === 0 && systemBlockers.length === 0 ? <p>Chưa có buổi học đủ điều kiện. Kiểm tra lịch học và thời gian ghi danh trong kỳ.</p> : null}
              {systemBlockers.map((blocker) => <p key={blocker.code}>{blocker.message}</p>)}
              <Link className="font-semibold underline" href={`/finance/tuition-periods/${period.id}`}>Xem học viên cần bổ sung</Link>
            </div> : <p className="text-secondary text-text-muted">Dữ liệu đã sẵn sàng để tính bù trừ và tạo phiếu cho từng học viên.</p>}{canLock ? <button className="inline-flex min-h-11 items-center rounded-md border border-border-strong px-3 font-semibold text-text-strong disabled:opacity-50" disabled={isPending || hasBlockers} onClick={() => lock(period.id)} type="button">Khóa kỳ và tạo yêu cầu thanh toán</button> : null}</div>
          </> : <div className="mt-4 flex flex-wrap gap-4 text-secondary"><Link className="font-semibold text-action-link underline" href={`/finance/tuition-periods/${period.id}`}>Xem phiếu học phí</Link><Link className="font-semibold text-action-link underline" href="/finance/payment-requests">Xem yêu cầu thanh toán</Link></div>}
        </article>;
      })}
      {periods.length === 0 ? <p className="rounded-lg border border-border-subtle bg-surface-base p-5 text-secondary text-text-muted">Chưa có kỳ thu học phí.</p> : null}
    </div>
  </div>;
}

function formatVnd(value: number): string { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value); }
