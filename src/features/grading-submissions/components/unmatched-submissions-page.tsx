import Link from "next/link";

import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { SubmissionAnswer } from "@/features/grading-submissions/components/submission-answer";
import type { UnmatchedGradingSubmission } from "@/features/grading-submissions/data";
import { matchIssueLabel } from "@/features/grading-submissions/matching";
import { formatDateTime } from "@/lib/datetime";

/**
 * "Bài nộp chưa ghép" (Giai đoạn 1, read-only): form submissions the ERP could not tie to
 * exactly one student and one session. Matching by hand comes in a later phase.
 */
export function UnmatchedSubmissionsPage({ items, limit }: { items: UnmatchedGradingSubmission[]; limit: number }) {
  return (
    <div className="grid min-w-0 gap-5">
      <PageHeader title="Bài nộp chưa ghép">
        <p className="mt-1 text-secondary text-text-muted">
          Bài học sinh nộp qua form mà ERP chưa ghép chắc chắn được với một học sinh và một buổi học (trùng tên, tên chưa có
          trong ERP, nộp ngoài giờ học hoặc có nhiều buổi phù hợp). Trang này chỉ để xem; chọn học sinh và buổi bằng tay sẽ có
          ở bước sau.
        </p>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState description="Mọi bài nộp qua form đều đã được ghép vào học sinh và buổi học." title="Không có bài chưa ghép" />
      ) : (
        <>
          <p className="text-secondary text-text-muted">
            {items.length >= limit ? `${limit} bài gần nhất` : `${items.length} bài`}, mới nhất trước.
          </p>
          <ul className="grid gap-3">
            {items.map((item) => (
              <li className="grid gap-2 rounded-lg border border-border-subtle bg-surface-base p-4" key={item.id}>
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
