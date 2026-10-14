"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { GuardedActionPanel, type GuardedCondition } from "@/components/patterns/guarded-action-panel";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { lockTuitionPeriodAction, type TuitionActionResult } from "@/features/tuition/actions";
import type { TuitionPeriodListItem, TuitionPreviewRow, TuitionSystemBlocker } from "@/features/tuition/data";
import { getTuitionLockReadiness, type TuitionLockReadiness } from "@/features/tuition/readiness";
import { formatVnd } from "@/lib/format";

interface TuitionPeriodLockPanelProps {
  canLock: boolean;
  className?: string;
  period: Pick<TuitionPeriodListItem, "id" | "name">;
  preview: TuitionPreviewRow[];
  systemBlockers: TuitionSystemBlocker[];
  /** Where to fix the students (the period page); omitted on that page itself. */
  reviewHref?: string;
  /** Primary on the period page (its main action), secondary on the list (create is the primary there). */
  variant?: "primary" | "secondary";
  /**
   * Called after a successful lock. The action revalidates the route, so this
   * draft panel unmounts with the refresh: the caller shows the success. Only
   * errors stay inline under the panel.
   */
  onLocked: (result: TuitionActionResult) => void;
  /** Defaults to the real server action; the /dev preview passes an inert stub. */
  lockAction?: typeof lockTuitionPeriodAction;
}

const BLOCKED_REASON = "Xử lý hết điều kiện chưa đạt rồi mới khóa được kỳ.";

/** Readiness conditions in words; the same rule as before decides whether locking is allowed (`hasBlockers`). */
export function buildTuitionLockConditions(readiness: TuitionLockReadiness): GuardedCondition[] {
  const conditions: GuardedCondition[] = [];
  const hasRows = readiness.sessionCount > 0;

  if (readiness.previewUnavailable) {
    conditions.push({ label: "Chưa tải được buổi học trong kỳ", state: "unknown" });
  } else if (!hasRows) {
    conditions.push({ label: "Chưa có buổi học đủ điều kiện. Kiểm tra lịch học và thời gian ghi danh trong kỳ.", state: "unmet" });
  } else {
    conditions.push({ label: `${readiness.studentCount} học viên · ${readiness.sessionCount} lượt học dự kiến`, state: "met" });
  }

  if (hasRows) {
    conditions.push(
      readiness.missingRates > 0
        ? { label: `${readiness.missingRates} học viên thiếu đơn giá. Cần nhập mức phí có hiệu lực từ ngày học tương ứng.`, state: "unmet" }
        : { label: "Mọi học viên có đơn giá hiệu lực", state: "met" },
      readiness.missingSources > 0
        ? { label: `${readiness.missingSources} học viên chưa có nguồn.`, state: "unmet" }
        : { label: "Mọi học viên có nguồn", state: "met" },
      readiness.missingGuardians > 0
        ? { label: `${readiness.missingGuardians} học viên chưa có phụ huynh chính. Bổ sung phụ huynh để tạo nội dung chuyển khoản.`, state: "unmet" }
        : { label: "Mọi học viên có phụ huynh chính", state: "met" },
    );
    if (readiness.otherIssues > 0) {
      conditions.push({ label: `${readiness.otherIssues} học viên còn vướng mắc khác khi xem trước.`, state: "unmet" });
    }
  }

  const configBlockers = readiness.systemBlockers.filter((blocker) => blocker.code !== "PREVIEW_UNAVAILABLE");
  if (readiness.previewUnavailable) {
    const message = readiness.systemBlockers.find((blocker) => blocker.code === "PREVIEW_UNAVAILABLE")?.message;
    conditions.push({ label: message ?? "Không tải được đầy đủ dữ liệu kỳ thu.", state: "unknown" });
  }
  if (configBlockers.length > 0) {
    conditions.push(...configBlockers.map((blocker) => ({ label: blocker.message, state: "unmet" as const })));
  } else if (!readiness.previewUnavailable) {
    conditions.push({ label: "Có mẫu Phiếu học phí và một tài khoản nhận tái phí đang hiệu lực", state: "met" });
  }

  return conditions;
}

/** Badge text beside a draft period: ready, or how many conditions are still unmet. */
export function getTuitionReadinessLabel(readiness: TuitionLockReadiness): { label: string; tone: "success" | "warning" } {
  return readiness.hasBlockers
    ? { label: `Còn ${Math.max(readiness.unmetCount, 1)} điều kiện`, tone: "warning" }
    : { label: "Sẵn sàng khóa", tone: "success" };
}

/**
 * Lock a draft period (lock_tuition_collection_period through
 * lockTuitionPeriodAction, tuition_periods.lock): conditions from the readiness
 * preview, the consequence in words, an error inline under the panel (the
 * caller shows a success through `onLocked`).
 */
export function TuitionPeriodLockPanel({ canLock, className, lockAction = lockTuitionPeriodAction, onLocked, period, preview, reviewHref, systemBlockers, variant = "primary" }: TuitionPeriodLockPanelProps) {
  const titleId = useId();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const readiness = getTuitionLockReadiness(preview, systemBlockers);
  const status = getTuitionReadinessLabel(readiness);

  function lock(): void {
    setError(null);
    startTransition(async () => {
      let next: TuitionActionResult;
      try {
        next = await lockAction(period.id);
      } catch {
        // The request may have reached the server: do not claim either outcome,
        // and reload the page so a lock that did happen shows up.
        setError("Không rõ kỳ thu đã được khóa chưa; tải lại trang để kiểm tra trước khi thử lại.");
        router.refresh();
        return;
      }
      if (next.status === "success") onLocked(next);
      else setError(next.message);
    });
  }

  return (
    <GuardedActionPanel
      action={
        canLock ? (
          <Button
            className="max-md:h-11"
            disabled={isPending || readiness.hasBlockers}
            disabledReason={readiness.hasBlockers ? BLOCKED_REASON : undefined}
            isLoading={isPending}
            onClick={lock}
            variant={variant}
          >
            Khóa kỳ và tạo yêu cầu thanh toán
          </Button>
        ) : undefined
      }
      badge={<Badge tone={status.tone}>{status.label}</Badge>}
      className={className}
      conditions={buildTuitionLockConditions(readiness)}
      consequence={
        <>
          Khóa kỳ là <strong>vĩnh viễn</strong>: chốt số buổi tính phí, tạo Phiếu học phí và yêu cầu thanh toán kèm QR cho từng học sinh trong một lần.
          Lỗi ở bất kỳ học sinh nào thì không khóa phần nào. Sau khi khóa, phiếu chỉ điều chỉnh bằng phát hành lại.
        </>
      }
      result={error ? <ResultBanner title={error} tone="error" /> : undefined}
      title={`Khóa kỳ thu · ${period.name}`}
      titleId={titleId}
    >
      <div className="mt-4 grid gap-1 text-secondary text-text-muted">
        <p>Yêu cầu thanh toán chỉ được tạo sau khi khóa kỳ thành công; tạo bản nháp chưa phát sinh khoản phải thu.</p>
        <p>
          Giá trị lịch học trước bù trừ:{" "}
          <strong className="font-semibold tabular-nums text-text-strong">
            {readiness.estimatedTotalVnd === null || readiness.sessionCount === 0 ? "Chưa đủ dữ liệu để tính" : formatVnd(readiness.estimatedTotalVnd)}
          </strong>
        </p>
        {!canLock ? <p>Tài khoản này không có quyền khóa kỳ thu; người có quyền khóa kỳ sẽ thực hiện bước này.</p> : null}
        {readiness.hasBlockers && reviewHref ? (
          <p>
            <Link
              className="inline-flex min-h-11 items-center font-semibold text-action-link! underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus md:min-h-0"
              href={reviewHref}
            >
              Xem học viên cần bổ sung
            </Link>
          </p>
        ) : null}
      </div>
    </GuardedActionPanel>
  );
}

/**
 * Period page variant: after a successful lock, reload the same period with
 * `?locked=1` so the locked page can confirm it (this draft panel is gone by then).
 */
export function TuitionPeriodPageLockPanel(props: Omit<TuitionPeriodLockPanelProps, "onLocked">) {
  const router = useRouter();
  return <TuitionPeriodLockPanel {...props} onLocked={() => router.replace(`/finance/tuition-periods/${props.period.id}?locked=1`)} />;
}
