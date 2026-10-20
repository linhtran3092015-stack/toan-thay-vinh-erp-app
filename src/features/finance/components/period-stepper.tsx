import { Stepper, type StepperStep, type StepperStepState } from "@/components/patterns/stepper";
import { formatDateTime } from "@/lib/datetime";

export type PeriodStepState = StepperStepState;

export type PeriodStep = StepperStep;

/**
 * Tuition period stepper (HANDOFF §2, design 07 frame 7b): the shared
 * `Stepper` (`components/patterns/stepper`) under the tuition label. A thin
 * wrapper kept so the tuition route, its preview and tests keep one import.
 */
export function PeriodStepper({ className, label = "Các bước của kỳ thu", steps }: { className?: string; label?: string; steps: readonly PeriodStep[] }) {
  return <Stepper className={className} label={label} steps={steps} />;
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
