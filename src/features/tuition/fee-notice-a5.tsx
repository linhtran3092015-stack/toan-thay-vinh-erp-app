/* eslint-disable @next/next/no-img-element -- the locked VietQR URL (or a local placeholder) is printed as-is, never proxied or resized. */
/**
 * Phiếu học phí on A5 paper (design 15b, right column "Bố cục in · A5"):
 * presentational only, no hooks, safe in server and client trees. It renders
 * a FeeNoticeModel, so the notice page, bulk printing and the template
 * preview (buildSampleFeeNoticeModel) print the same sheet.
 *
 * Dropped from the design: the "Cơ sở · phone" header line (not snapshotted;
 * contact details belong in the template footer), the "HP-…" notice number
 * (none exists; the request's public code is shown instead), a second class
 * name (the snapshot holds one) and "hệ thống tự đối soát, không cần gửi ảnh"
 * (true only on exact matches).
 *
 * Print rules (named page `fee-notice`, one A5 page per notice) live with the
 * `.fee-notice-a5` class in globals.css; blocks marked `data-print-keep` (the
 * amount table, the QR box) are never split across pages. On phones the
 * header stacks, the label column narrows and the QR stacks above the
 * transfer details; `print:` variants pin the A5 layout whatever width the
 * print media query reports.
 */
import type { ReactNode } from "react";

import { formatFeeNoticeBalance, formatFeeNoticeCharge, type FeeNoticeModel } from "@/features/tuition/fee-notice-model";
import { formatIsoDate } from "@/lib/datetime";
import { formatNumber, formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";

// Printed paper, not themed UI: the sheet keeps the design's fixed ink and
// greys (#111 text, #444/#555/#666 secondary, #bbb/#ddd rules) on white in
// light and dark mode alike, so the screen shows exactly what prints. These
// are the only raw colours in the tuition feature; keep them here.
const paper = {
  sheet: "border-[#E1DCD3] bg-white text-[#111] shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
  center: "text-[#444]",
  label: "text-[#555]",
  meta: "text-[#666]",
  rule: "border-[#ddd]",
  dashed: "border-[#bbb]",
  frame: "border-[#111]",
} as const;

export interface FeeNoticeA5Props {
  model: FeeNoticeModel;
  /** Accessible name of the sheet; defaults to "Phiếu học phí của {học sinh}". */
  ariaLabel?: string;
  className?: string;
  /** false: no print class (e.g. an on-screen preview that must not become an A5 page). */
  printable?: boolean;
  /** Level of the sheet title; 3 when the sheet sits under a page's own h2. */
  headingLevel?: 2 | 3;
}

function Row({ children, className, label, valueClassName }: { children: ReactNode; className?: string; label: string; valueClassName?: string }) {
  return (
    <tr className={className}>
      <th className={cn("w-[104px] py-[5px] pr-3 text-left align-top font-normal sm:w-[140px] print:w-[140px]", paper.label)} scope="row">
        {label}
      </th>
      <td className={cn("py-[5px] align-top", valueClassName)}>{children}</td>
    </tr>
  );
}

export function FeeNoticeA5({ ariaLabel, className, headingLevel = 2, model, printable = true }: FeeNoticeA5Props) {
  const { edition, payment, student } = model;
  const noPayment = payment.kind === "no_payment";
  const studentLine = [student.fullName, student.publicCode].filter(Boolean).join(" · ");
  const Title = headingLevel === 3 ? "h3" : "h2";
  // A superseded sheet never shows its cancelled request's code to parents.
  const requestCode = payment.kind === "superseded" ? null : model.requestCode;

  return (
    <article
      aria-label={ariaLabel ?? `Phiếu học phí của ${student.fullName}`}
      className={cn(
        printable && "fee-notice-a5",
        "flex w-full max-w-[520px] flex-col gap-3.5 border px-6 py-7 text-[13px] leading-[18px] sm:px-10 sm:py-9",
        paper.sheet,
        className,
      )}
    >
      <header className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4 print:flex-row print:items-start print:justify-between print:gap-4">
        <p className={cn("min-w-0 text-[12px] uppercase tracking-[0.04em]", paper.center)}>{model.centerName}</p>
        <p className={cn("text-left text-[11px] leading-4 sm:text-right print:text-right", paper.meta)}>
          {model.periodName ? <span className="block">{model.periodName}</span> : null}
          {requestCode ? <span className="block">Mã yêu cầu {requestCode}</span> : null}
        </p>
      </header>

      <Title className={cn("border-y py-1.5 text-center text-[22px] font-bold leading-7 tracking-[0.02em]", paper.rule)}>{model.title}</Title>

      {edition.replacement && !edition.superseded ? (
        <p className="text-center text-[11px] font-bold leading-4 tracking-[0.06em]">BẢN THAY THẾ HIỆN HÀNH</p>
      ) : null}

      {!noPayment && model.announcement ? <p className="whitespace-pre-line">{model.announcement}</p> : null}
      {!noPayment && model.dueOn ? (
        <p>
          Hạn thanh toán: <strong>{formatIsoDate(model.dueOn)}</strong>
        </p>
      ) : null}

      <table className="w-full border-collapse text-[13px]" data-print-keep="">
        <tbody>
          <Row label="Học viên" valueClassName="font-bold">{studentLine}</Row>
          {student.className ? <Row label="Lớp">{student.className}</Row> : null}
          {noPayment ? null : (
            <>
              <Row label="Số buổi tính phí" valueClassName="tabular-nums">{formatFeeNoticeCharge(model.charge)}</Row>
              <Row label="Số dư đầu kỳ" valueClassName="tabular-nums">{formatFeeNoticeBalance(model.openingBalanceSessions)}</Row>
              <tr className={cn("border-t", paper.rule)}>
                <th className={cn("py-2 pr-3 text-left align-middle font-semibold", paper.label)} scope="row">
                  Số tiền phải nộp
                </th>
                <td className="py-2 text-[20px] font-bold leading-7 tabular-nums">{formatVnd(model.payableAmountVnd)}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      {payment.kind === "qr" ? (
        <div
          className={cn(
            "grid items-center gap-4 rounded-[6px] border border-dashed p-3 sm:grid-cols-[150px_minmax(0,1fr)] print:grid-cols-[150px_minmax(0,1fr)]",
            paper.dashed,
          )}
          data-print-keep=""
        >
          <img
            alt="Mã QR thanh toán tái phí"
            className="h-[150px] w-[150px] justify-self-center sm:justify-self-start print:justify-self-start"
            height={150}
            src={payment.imageUrl}
            width={150}
          />
          <div className="min-w-0 text-[12px] leading-[18px]">
            <p className={paper.label}>Chuyển khoản tới</p>
            <p className="font-bold">
              {payment.bankCode} · {payment.accountNumber}
            </p>
            {payment.accountHolder ? <p>{payment.accountHolder}</p> : null}
            <p className={cn("mt-1.5", paper.label)}>Nội dung chuyển khoản (bắt buộc)</p>
            {/* Breaks at the code's spaces first, inside a word only when one does not fit. */}
            <p className="font-mono text-[14px] font-bold leading-5 tracking-[0.04em] [overflow-wrap:anywhere]">{payment.transferCode}</p>
            <p className={cn("mt-1.5", paper.label)}>Số tiền</p>
            <p className="font-bold tabular-nums">{formatVnd(payment.amountVnd)}</p>
          </div>
        </div>
      ) : null}

      {payment.kind === "no_payment" ? (
        <>
          {payment.reason === "balance" ? (
            <p className="tabular-nums">
              {formatNumber(payment.scheduledSessions)} buổi kỳ này · số dư đầu kỳ{" "}
              <strong>{formatNumber(payment.openingBalanceSessions)} buổi</strong> · còn lại sau kỳ{" "}
              <strong>{formatNumber(payment.remainingSessions)} buổi</strong>
            </p>
          ) : null}
          <p className={cn("rounded-[6px] border p-3 text-center text-[16px] font-bold leading-6", paper.frame)}>KHÔNG CẦN THANH TOÁN</p>
          <p className={cn("text-[11px] leading-4", paper.meta)}>
            {payment.reason === "balance" ? "Phiếu không có mã QR vì số dư buổi đã đủ cho kỳ này." : "Phiếu thay thế không cần thanh toán."}
          </p>
        </>
      ) : null}

      {payment.kind === "superseded" ? (
        <p className={cn("rounded-[6px] border p-3 font-semibold", paper.frame)}>
          Phiếu này đã được thay thế. Vui lòng thanh toán theo bản thay thế hiện hành; mã chuyển khoản cũ không còn hiệu lực.
        </p>
      ) : null}

      {payment.kind === "unavailable" ? (
        <div className={cn("grid gap-1.5 rounded-[6px] border border-dashed p-3", paper.dashed)}>
          {/* What parents read on paper; the staff diagnosis below stays on screen. */}
          <p className="font-semibold">Thiếu thông tin chuyển khoản trên phiếu này. Vui lòng liên hệ trung tâm để được hướng dẫn thanh toán.</p>
          <p className={cn("text-[11px] leading-4 print:hidden", paper.meta)}>Hợp đồng thanh toán snapshot không đầy đủ; không hiển thị QR thay thế.</p>
        </div>
      ) : null}

      <div className={cn("grid gap-1 text-[11px] leading-4", paper.meta)}>
        {payment.kind === "qr" ? (
          <p>Quét QR sẽ điền sẵn số tiền và nội dung chuyển khoản. Vui lòng kiểm tra lại trước khi xác nhận.</p>
        ) : null}
        <p className="whitespace-pre-line">{model.footer}</p>
      </div>
    </article>
  );
}
