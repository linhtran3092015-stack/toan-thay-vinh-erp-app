"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";

import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { gradingReviewServerActions, type GradingReviewActions } from "@/features/grading-submissions/components/review-actions";
import { SubmissionAnswer } from "@/features/grading-submissions/components/submission-answer";
import { SubmissionRestoreAction, SubmissionReviewActions } from "@/features/grading-submissions/components/submission-review-actions";
import type { IgnoredGradingSubmission, UnmatchedGradingSubmission } from "@/features/grading-submissions/data";
import { matchIssueLabel } from "@/features/grading-submissions/matching";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

/** Time to read the in-row confirmation before the refreshed list drops the row. */
const REFRESH_DELAY_MS = 900;

export type GradingSubmissionsStatus = "needs_review" | "ignored";

const filters: { label: string; value: GradingSubmissionsStatus }[] = [
  { label: "Chờ ghép", value: "needs_review" },
  { label: "Đã bỏ qua", value: "ignored" },
];

type UnmatchedSubmissionsPageProps = {
  actions?: GradingReviewActions;
  /** Where the filter links point; the dev preview passes its own path. */
  basePath?: string;
  limit: number;
} & (
  | { items: UnmatchedGradingSubmission[]; status?: "needs_review" }
  | { items: IgnoredGradingSubmission[]; status: "ignored" }
);

/**
 * "Bài nộp chưa ghép": form submissions the ERP could not tie to exactly one student and one
 * session. Staff match them by hand, mark junk, or re-run the matcher after adding a student or
 * a session (Giai đoạn 1b). The "Đã bỏ qua" filter lists junk with who/when/why and restores a
 * submission ignored by mistake.
 */
export function UnmatchedSubmissionsPage(props: UnmatchedSubmissionsPageProps) {
  const { actions = gradingReviewServerActions, basePath = "/grading-submissions", limit } = props;
  const status = props.status ?? "needs_review";
  const count = props.items.length;
  const router = useRouter();
  const [notice, setNotice] = useState<{ message: string; ok: boolean } | null>(null);
  const [isRematching, startRematch] = useTransition();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    },
    [],
  );

  const handleDone = (message: string) => {
    setNotice({ message, ok: true });
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), REFRESH_DELAY_MS);
  };

  const rematch = () => {
    if (isRematching) return;
    setNotice(null);
    startRematch(async () => {
      const result = await actions.rematch();
      setNotice({ message: result.message, ok: result.ok });
      if (result.ok) router.refresh();
    });
  };

  return (
    <div className="grid min-w-0 gap-5">
      <PageHeader
        actions={
          status === "needs_review" && count > 0 ? (
            <Button className="w-full md:w-auto" disabled={isRematching} isLoading={isRematching} onClick={rematch} type="button" variant="outline">
              Ghép lại tự động
            </Button>
          ) : null
        }
        title="Bài nộp chưa ghép"
      >
        {status === "ignored" ? (
          <p className="mt-1 text-secondary text-text-muted">
            Bài đã đánh dấu bài rác: không được tính điểm và không được ghép lại tự động. Bỏ qua nhầm thì bấm Khôi phục, bài
            quay lại mục Chờ ghép như trước khi bị bỏ qua.
          </p>
        ) : (
          <p className="mt-1 text-secondary text-text-muted">
            Bài học sinh nộp qua form mà ERP chưa ghép chắc chắn được với một học sinh và một buổi học (trùng tên, tên chưa có
            trong ERP, nộp ngoài giờ học hoặc có nhiều buổi phù hợp). Chọn học sinh và buổi bằng tay, bỏ qua bài rác, hoặc bấm
            Ghép lại tự động sau khi đã thêm học sinh hay xếp buổi còn thiếu.
          </p>
        )}
      </PageHeader>

      <nav aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Link
            aria-current={status === filter.value ? "page" : undefined}
            // Soft active chip as on /finance/sepay. Text colours are important because the
            // unlayered global `a { color: inherit }` beats utilities on links.
            className={cn(
              "inline-flex min-h-11 items-center rounded-md border px-3 text-control font-semibold transition-colors sm:h-9 sm:min-h-9",
              status === filter.value
                ? "border-action-primary bg-action-primary-soft text-action-primary!"
                : "border-border-subtle bg-surface-base text-text-muted! hover:bg-interactive-hover hover:text-text-strong!",
            )}
            href={filter.value === "needs_review" ? basePath : `${basePath}?status=${filter.value}`}
            key={filter.value}
          >
            {filter.label}
            {status === filter.value && count > 0 ? ` (${count >= limit ? `${limit}+` : count})` : ""}
          </Link>
        ))}
      </nav>

      {notice ? <ResultBanner title={notice.message} tone={notice.ok ? "success" : "error"} /> : null}

      {count === 0 ? (
        status === "ignored" ? (
          <EmptyState description="Bài đánh dấu Bỏ qua (bài rác) sẽ nằm ở đây để xem lại hoặc khôi phục." title="Chưa có bài bị bỏ qua" />
        ) : (
          <EmptyState description="Mọi bài nộp qua form đều đã được ghép vào học sinh và buổi học." title="Không có bài chưa ghép" />
        )
      ) : (
        <>
          <p className="text-secondary text-text-muted">
            {status === "ignored"
              ? `${count >= limit ? `${limit} bài bỏ qua gần nhất` : `${count} bài`}, bỏ qua gần nhất trước.`
              : `${count >= limit ? `${limit} bài gần nhất` : `${count} bài`}, mới nhất trước.`}
          </p>
          <ul className="grid gap-3">
            {props.status === "ignored"
              ? props.items.map((item) => (
                  <SubmissionCard details={<IgnoredDetails item={item} />} item={item} key={item.id}>
                    <SubmissionRestoreAction actions={actions} item={item} onDone={handleDone} />
                  </SubmissionCard>
                ))
              : props.items.map((item) => (
                  <SubmissionCard item={item} key={item.id}>
                    <SubmissionReviewActions actions={actions} item={item} onDone={handleDone} />
                  </SubmissionCard>
                ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SubmissionCard({
  children,
  details,
  item,
}: {
  children: ReactNode;
  /** Extra rows at the end of the details list. */
  details?: ReactNode;
  item: UnmatchedGradingSubmission;
}) {
  return (
    <li className="grid gap-3 rounded-lg border border-border-subtle bg-surface-base p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-text-strong">{item.claimedFullName}</span>
        <span className="text-caption text-text-muted">sinh {item.claimedBirthYear}</span>
        {item.claimedStudentCode ? <span className="text-caption text-text-muted">{item.claimedStudentCode}</span> : null}
        {item.issues.map((issue) => (
          <Badge key={issue} tone="warning">
            {matchIssueLabel(issue)}
          </Badge>
        ))}
      </div>
      <dl className="grid gap-1 text-secondary text-text-default sm:grid-cols-[max-content_minmax(0,1fr)] sm:gap-x-4">
        <dt className="text-text-muted">Nộp lúc</dt>
        <dd>{formatDateTime(item.submittedAt)}</dd>
        <dt className="text-text-muted">Lớp trên form</dt>
        <dd>{describeClassChoice(item)}</dd>
        {item.student ? (
          <>
            <dt className="text-text-muted">Học sinh đã nhận ra</dt>
            <dd>
              <Link className="text-action-link hover:underline" href={`/students/${item.student.id}`}>
                {item.student.fullName}
              </Link>{" "}
              <span className="text-caption text-text-muted">{item.student.publicCode}</span>
            </dd>
          </>
        ) : null}
        {details}
      </dl>
      <SubmissionAnswer text={item.answerText} truncated={item.answerTruncated} />
      {children}
    </li>
  );
}

/** Who ignored the submission, when and why (from the latest ignore audit row). */
function IgnoredDetails({ item }: { item: IgnoredGradingSubmission }) {
  if (!item.ignored) {
    return (
      <>
        <dt className="text-text-muted">Bỏ qua</dt>
        <dd className="text-text-muted">Không có trong lịch sử thao tác</dd>
      </>
    );
  }
  return (
    <>
      <dt className="text-text-muted">Bỏ qua lúc</dt>
      <dd>
        {formatDateTime(item.ignored.at)}
        {item.ignored.byName ? ` · ${item.ignored.byName}` : ""}
      </dd>
      <dt className="text-text-muted">Lý do bỏ qua</dt>
      <dd className="break-words">{item.ignored.reason ?? "—"}</dd>
    </>
  );
}

function describeClassChoice(item: UnmatchedGradingSubmission): string {
  if (item.claimedSessionLabel) return `Buổi ${item.claimedSessionLabel}`;
  if (item.claimedClassOptionOther) return `${item.claimedClassOption ?? "Khác"}: ${item.claimedClassOptionOther}`;
  return item.claimedClassOption ?? "—";
}
