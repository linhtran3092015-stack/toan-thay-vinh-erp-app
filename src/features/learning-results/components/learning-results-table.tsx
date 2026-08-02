import Link from "next/link";
import type { ReactNode } from "react";

import {
  LearningResultScoreBadge,
  NotebookStatusBadge,
} from "@/features/learning-results/components/learning-result-badges";
import {
  formatDate,
  LearningResultMobileCard,
} from "@/features/learning-results/components/learning-result-mobile-card";
import type { LearningResultDirectoryItem } from "@/features/learning-results/read-models";

interface LearningResultsTableProps {
  canViewSessions: boolean;
  canViewStudents: boolean;
  items: readonly LearningResultDirectoryItem[];
}

export function LearningResultsTable({
  canViewSessions,
  canViewStudents,
  items,
}: LearningResultsTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-hairline bg-surface-1 shadow-card md:block">
        <table className="min-w-[1120px] w-full border-collapse text-left">
          <thead className="bg-surface-2 text-xs font-semibold uppercase text-ink-muted">
            <tr>
              <TableHeader>Ngày học</TableHeader>
              <TableHeader>Học viên</TableHeader>
              <TableHeader>Lớp</TableHeader>
              <TableHeader>Điểm kiểm tra</TableHeader>
              <TableHeader>Kết quả vở</TableHeader>
              <TableHeader>Nhận xét</TableHeader>
              <TableHeader>Thao tác</TableHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {items.map((item) => (
              <tr className="align-top hover:bg-surface-2/60" key={item.resultId}>
                <TableCell>
                  <p className="font-semibold text-ink">
                    {formatDate(item.sessionDate)}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {item.lockedAt ? "Buổi đã khóa" : "Buổi chưa khóa"}
                  </p>
                </TableCell>
                <TableCell>
                  {canViewStudents ? (
                    <Link
                      className="font-semibold text-primary hover:underline"
                      href={`/students/${item.studentId}`}
                    >
                      {item.studentName}
                    </Link>
                  ) : (
                    <p className="font-semibold text-ink">{item.studentName}</p>
                  )}
                  <p className="mt-1 text-xs text-ink-muted">
                    {item.studentCode} · Khối {item.currentGrade}
                  </p>
                </TableCell>
                <TableCell>
                  <p className="font-semibold text-ink">{item.className}</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {item.classCode} · Khối {item.classGrade} · Mức {item.classLevel}
                  </p>
                </TableCell>
                <TableCell>
                  <LearningResultScoreBadge score={item.testScore} />
                </TableCell>
                <TableCell>
                  <div className="flex max-w-[180px] flex-wrap gap-2">
                    <NotebookStatusBadge status={item.notebookStatus} />
                    {item.notebookStatus === "submitted" ? (
                      <LearningResultScoreBadge score={item.notebookScore} />
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <p className="max-w-[240px] text-sm leading-6 text-ink-muted">
                    {item.resultComment ?? "Chưa có nhận xét"}
                  </p>
                </TableCell>
                <TableCell>
                  {canViewSessions ? (
                    <Link
                      className="inline-flex min-h-11 items-center font-semibold text-primary hover:underline"
                      href={`/sessions/${item.classSessionId}`}
                    >
                      Mở buổi học
                    </Link>
                  ) : (
                    <span className="text-sm text-ink-muted">Chỉ xem</span>
                  )}
                </TableCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {items.map((item) => (
          <LearningResultMobileCard
            canViewSessions={canViewSessions}
            canViewStudents={canViewStudents}
            item={item}
            key={item.resultId}
          />
        ))}
      </div>
    </>
  );
}

function TableHeader({ children }: { children: ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function TableCell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-4 text-sm">{children}</td>;
}
