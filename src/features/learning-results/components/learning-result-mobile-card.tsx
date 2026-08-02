import Link from "next/link";
import type { ReactNode } from "react";

import {
  LearningResultScoreBadge,
  NotebookStatusBadge,
} from "@/features/learning-results/components/learning-result-badges";
import type { LearningResultDirectoryItem } from "@/features/learning-results/read-models";

interface LearningResultMobileCardProps {
  canViewSessions: boolean;
  canViewStudents: boolean;
  item: LearningResultDirectoryItem;
}

export function LearningResultMobileCard({
  canViewSessions,
  canViewStudents,
  item,
}: LearningResultMobileCardProps) {
  return (
    <article className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {canViewStudents ? (
            <Link
              className="block truncate text-base font-bold text-primary hover:underline"
              href={`/students/${item.studentId}`}
            >
              {item.studentName}
            </Link>
          ) : (
            <h2 className="truncate text-base font-bold text-ink">
              {item.studentName}
            </h2>
          )}
          <p className="mt-1 text-xs font-semibold text-ink-muted">
            {item.studentCode} · Khối {item.currentGrade}
          </p>
        </div>
        <time className="flex-none text-xs font-semibold text-ink-muted">
          {formatDate(item.sessionDate)}
        </time>
      </div>

      <div className="mt-4 border-y border-hairline py-3">
        <p className="text-sm font-semibold text-ink">
          {item.className}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          {item.classCode} · Mức {item.classLevel}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ResultField label="Điểm kiểm tra">
          <LearningResultScoreBadge score={item.testScore} />
        </ResultField>
        <ResultField label="Điểm vở">
          <div className="flex flex-wrap gap-2">
            <NotebookStatusBadge status={item.notebookStatus} />
            {item.notebookStatus === "submitted" ? (
              <LearningResultScoreBadge score={item.notebookScore} />
            ) : null}
          </div>
        </ResultField>
      </div>

      {item.resultComment ? (
        <p className="mt-4 rounded-md bg-surface-2 px-3 py-2 text-sm leading-6 text-ink-muted">
          {item.resultComment}
        </p>
      ) : null}

      {canViewSessions ? (
        <Link
          className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
          href={`/sessions/${item.classSessionId}`}
        >
          Mở buổi học
        </Link>
      ) : null}
    </article>
  );
}

function ResultField({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase text-ink-muted">
        {label}
      </p>
      {children}
    </div>
  );
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
