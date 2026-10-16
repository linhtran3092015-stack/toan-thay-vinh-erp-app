import type { ReactNode } from "react";

import {
  RecordListItem,
  ResponsiveRecordList,
} from "@/components/patterns/responsive-record-list";
import {
  LearningResultScoreBadge,
  NotebookStatusBadge,
} from "@/features/learning-results/components/learning-result-badges";
import { formatLearningResultScore } from "@/features/learning-results/learning-result-models";
import type { LearningResultDirectoryItem } from "@/features/learning-results/read-models";
import { formatIsoDate } from "@/lib/datetime";

interface LearningResultRecordListProps {
  canViewSessions: boolean;
  canViewStudents: boolean;
  items: readonly LearningResultDirectoryItem[];
}

/**
 * Narrow-width cards (design 16a): student + test-score badge, then
 * class · date · notebook. The whole card links to the session when the
 * account has `sessions.view`, else to the student when it has
 * `students.view`, else it is a plain card.
 */
export function LearningResultRecordList({
  canViewSessions,
  canViewStudents,
  items,
}: LearningResultRecordListProps) {
  return (
    <ResponsiveRecordList
      className="learning-results-record-list"
      label="Danh sách kết quả học tập"
    >
      {items.map((item) => (
        <LearningResultRecord
          canViewSessions={canViewSessions}
          canViewStudents={canViewStudents}
          item={item}
          key={item.resultId}
        />
      ))}
    </ResponsiveRecordList>
  );
}

function LearningResultRecord({
  canViewSessions,
  canViewStudents,
  item,
}: {
  canViewSessions: boolean;
  canViewStudents: boolean;
  item: LearningResultDirectoryItem;
}) {
  const sessionDate = formatIsoDate(item.sessionDate);
  const badge = <LearningResultScoreBadge score={item.testScore} />;
  const meta = (
    <>
      {item.className} · {sessionDate}{" "}
      <span className="ml-1 inline-flex items-center gap-1 align-middle">
        <NotebookStatusBadge status={item.notebookStatus} />
        {item.notebookStatus === "submitted" && item.notebookScore !== null ? (
          <span className="font-medium text-text-default">
            {formatLearningResultScore(item.notebookScore)}/10
          </span>
        ) : null}
      </span>
    </>
  );

  if (canViewSessions) {
    return (
      <RecordListItem
        ariaLabel={`Mở buổi học ${sessionDate} lớp ${item.classCode} của ${item.studentName}`}
        badge={badge}
        href={`/sessions/${item.classSessionId}`}
        meta={meta}
        title={item.studentName}
      />
    );
  }

  if (canViewStudents) {
    return (
      <RecordListItem
        ariaLabel={`Mở hồ sơ học viên ${item.studentName}`}
        badge={badge}
        href={`/students/${item.studentId}`}
        meta={meta}
        title={item.studentName}
      />
    );
  }

  return (
    <StaticRecord badge={badge} meta={meta} title={item.studentName} />
  );
}

/** Same geometry as `RecordListItem` for a record the account cannot open. */
function StaticRecord({
  badge,
  meta,
  title,
}: {
  badge: ReactNode;
  meta: ReactNode;
  title: string;
}) {
  return (
    <article className="min-w-0" role="listitem">
      <div className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3 text-text-strong shadow-[var(--panel-shadow)]">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[15px] font-semibold leading-5">
            {title}
          </span>
          <span className="shrink-0">{badge}</span>
        </div>
        <div className="mt-0.5 text-secondary tabular-nums text-text-muted">
          {meta}
        </div>
      </div>
    </article>
  );
}
