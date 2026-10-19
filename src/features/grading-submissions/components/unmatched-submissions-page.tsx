"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { gradingReviewServerActions, type GradingReviewActions } from "@/features/grading-submissions/components/review-actions";
import { SubmissionAnswer } from "@/features/grading-submissions/components/submission-answer";
import { SubmissionReviewActions } from "@/features/grading-submissions/components/submission-review-actions";
import type { UnmatchedGradingSubmission } from "@/features/grading-submissions/data";
import { matchIssueLabel } from "@/features/grading-submissions/matching";
import { formatDateTime } from "@/lib/datetime";

/** Time to read the in-row confirmation before the refreshed list drops the row. */
const REFRESH_DELAY_MS = 900;

/**
 * "Bài nộp chưa ghép": form submissions the ERP could not tie to exactly one student and one
 * session. Staff match them by hand, mark junk, or re-run the matcher after adding a student or
 * a session (Giai đoạn 1b).
 */
export function UnmatchedSubmissionsPage({
  actions = gradingReviewServerActions,
  items,
  limit,
}: {
  actions?: GradingReviewActions;
  items: UnmatchedGradingSubmission[];
  limit: number;
}) {
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
          items.length > 0 ? (
            <Button className="w-full md:w-auto" disabled={isRematching} isLoading={isRematching} onClick={rematch} type="button" variant="outline">
              Ghép lại tự động
            </Button>
          ) : null
        }
        title="Bài nộp chưa ghép"
      >
        <p className="mt-1 text-secondary text-text-muted">
          Bài học sinh nộp qua form mà ERP chưa ghép chắc chắn được với một học sinh và một buổi học (trùng tên, tên chưa có
          trong ERP, nộp ngoài giờ học hoặc có nhiều buổi phù hợp). Chọn học sinh và buổi bằng tay, bỏ qua bài rác, hoặc bấm
          Ghép lại tự động sau khi đã thêm học sinh hay xếp buổi còn thiếu.
        </p>
      </PageHeader>

      {notice ? <ResultBanner title={notice.message} tone={notice.ok ? "success" : "error"} /> : null}

      {items.length === 0 ? (
        <EmptyState description="Mọi bài nộp qua form đều đã được ghép vào học sinh và buổi học." title="Không có bài chưa ghép" />
      ) : (
        <>
          <p className="text-secondary text-text-muted">
            {items.length >= limit ? `${limit} bài gần nhất` : `${items.length} bài`}, mới nhất trước.
          </p>
          <ul className="grid gap-3">
            {items.map((item) => (
              <li className="grid gap-3 rounded-lg border border-border-subtle bg-surface-base p-4" key={item.id}>
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
                </dl>
                <SubmissionAnswer text={item.answerText} truncated={item.answerTruncated} />
                <SubmissionReviewActions actions={actions} item={item} onDone={handleDone} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function describeClassChoice(item: UnmatchedGradingSubmission): string {
  if (item.claimedSessionLabel) return `Buổi ${item.claimedSessionLabel}`;
  if (item.claimedClassOptionOther) return `${item.claimedClassOption ?? "Khác"}: ${item.claimedClassOptionOther}`;
  return item.claimedClassOption ?? "—";
}
