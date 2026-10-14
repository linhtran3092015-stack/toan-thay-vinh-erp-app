import { Check } from "lucide-react";
import Link from "next/link";

import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export type PeriodStepState = "done" | "current" | "upcoming";

export interface PeriodStep {
  title: string;
  description: string;
  state: PeriodStepState;
  /** Optional follow-up link under the description (e.g. the SePay review queue). */
  link?: { href: string; label: string };
}

const stateLabels: Record<PeriodStepState, string> = {
  current: "Đang ở bước này",
  done: "Đã xong",
  upcoming: "Chưa tới",
};

/**
 * Tuition period stepper (HANDOFF §2, design 07 frame 7b): a 4-cell grid
 * `<ol>`; a finished step shows a success check, the current one the primary
 * number on a soft surface with `aria-current="step"`. Every state is also
 * written as text (screen-reader prefix), never colour alone.
 */
export function PeriodStepper({ className, label = "Các bước của kỳ thu", steps }: { className?: string; label?: string; steps: readonly PeriodStep[] }) {
  return (
    <ol
      aria-label={label}
      className={cn(
        "m-0 grid list-none grid-cols-[minmax(0,1fr)] overflow-hidden rounded-lg border border-border-subtle bg-surface-base p-0 shadow-[var(--panel-shadow)] sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {steps.map((step, index) => {
        const isCurrent = step.state === "current";
        const isDone = step.state === "done";

        return (
          <li
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "flex items-start gap-3 border-border-row px-4 py-3 [&:not(:first-child)]:border-t sm:[&:nth-child(2)]:border-t-0 sm:[&:nth-child(odd)]:border-r xl:[&:not(:first-child)]:border-t-0 xl:[&:not(:last-child)]:border-r",
              isCurrent && "bg-action-primary-soft",
            )}
            data-state={step.state}
            key={step.title}
          >
            <span
              aria-hidden="true"
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full text-caption font-bold",
                isDone && "bg-success text-text-on-primary",
                isCurrent && "bg-action-primary text-text-on-primary",
                step.state === "upcoming" && "border border-border-strong bg-surface-base text-text-muted",
              )}
            >
              {isDone ? <Check size={14} strokeWidth={2.5} /> : index + 1}
            </span>
            <span className="min-w-0">
              <span className={cn("block text-body font-semibold", isCurrent ? "text-action-primary" : "text-text-strong")}>
                <span className="sr-only">{stateLabels[step.state]}: </span>
                {index + 1}. {step.title}
              </span>
              <span className={cn("block text-caption", isCurrent ? "text-action-primary-hover" : "text-text-muted")}>{step.description}</span>
              {step.link ? (
                <Link
                  className="mt-1 inline-flex min-h-11 items-center text-secondary font-semibold text-action-link! hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus md:min-h-0"
                  href={step.link.href}
                >
                  {step.link.label}
                </Link>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export interface TuitionPeriodStepInput {
  status: "draft" | "locked";
  lockedAt?: string | null;
  /** Current items (each student once); null when the item read failed. */
  itemCount: number | null;
  /** Payment requests created at lock: current items with a payable amount (cancelled/expired included); null when the item read failed. */
  requestCount: number | null;
  /** Null when the viewer cannot read payment requests. */
  counts: { paid: number; partial: number; unpaid: number; unknown?: number } | null;
  /** Collected amount (capped per request); with counts.paid, tells a finished collection from voided requests. */
  collectedVnd?: number;
  /** /finance/sepay?queue=review when the viewer has sepay.view. */
  reviewHref?: string | null;
}

/**
 * Step mapping: draft → 1; locked → 4 until the collection is complete, using
 * the same rule as getTuitionPeriodProgress ("Hoàn tất"): nothing owed AND
 * something collected (a paid request or a collected amount). Locked with
 * requests still owed, unreadable payments, or every request cancelled/expired
 * stays on 4. The SePay review link follows the header's primary: shown on a
 * current step 4 unless nothing is owed (voided). A failed item read says so
 * instead of showing zeros. Locking creates the payment requests in the same
 * transaction, so there is no separate "create requests" step.
 */
export function buildTuitionPeriodSteps(input: TuitionPeriodStepInput): PeriodStep[] {
  const locked = input.status === "locked";
  // Unreadable requests may still be owed: they keep step 4 open like owed ones.
  const owed = input.counts ? input.counts.partial + input.counts.unpaid + (input.counts.unknown ?? 0) : null;
  const collectedSomething = Boolean(input.counts && (input.counts.paid > 0 || (input.collectedVnd ?? 0) > 0));
  const voided = locked && owed === 0 && !collectedSomething;
  const collectionState: PeriodStepState = !locked ? "upcoming" : owed === 0 && collectedSomething ? "done" : "current";
  const lockedAt = input.lockedAt ? ` · ${formatDateTime(input.lockedAt)}` : "";
  const readFailed = input.itemCount === null || input.requestCount === null;

  return [
    {
      description: locked ? "Đã đủ đơn giá, nguồn và phụ huynh chính khi khóa" : "Xem trước từ buổi học; bổ sung đơn giá, nguồn, phụ huynh chính",
      state: locked ? "done" : "current",
      title: "Nháp · chuẩn bị",
    },
    {
      description: locked
        ? input.requestCount === null
          ? `Chưa tải được số yêu cầu${lockedAt}`
          : `Đã tạo ${input.requestCount} yêu cầu thanh toán + QR${lockedAt}`
        : "Khóa một lần, tạo yêu cầu thanh toán + QR cho từng học sinh",
      state: locked ? "done" : "upcoming",
      title: "Khóa kỳ · tạo yêu cầu thanh toán",
    },
    {
      description: !locked
        ? "In theo khối hoặc đã chọn; phát hành lại khi cần"
        : input.itemCount === null
          ? "Chưa tải được số phiếu"
          : `${input.itemCount} phiếu · in theo khối hoặc đã chọn; phát hành lại khi cần`,
      state: locked ? "done" : "upcoming",
      title: "Phiếu học phí",
    },
    {
      description: !locked
        ? "Theo dõi đã thanh toán, thanh toán một phần, chờ thanh toán"
        : readFailed
          ? "Chưa tải được số đã thu"
          : voided
          ? "Không còn yêu cầu hiệu lực"
          : input.counts
          ? `${input.counts.paid} đã thanh toán · ${input.counts.partial} thanh toán một phần · ${input.counts.unpaid} chờ thanh toán${input.counts.unknown ? ` · ${input.counts.unknown} chưa rõ` : ""}`
          : "Cần quyền xem thanh toán để theo dõi số đã thu",
      link: locked && collectionState === "current" && !voided && input.reviewHref ? { href: input.reviewHref, label: "Mở hàng đợi đối soát SePay" } : undefined,
      state: collectionState,
      title: "Thu & đối soát",
    },
  ];
}
