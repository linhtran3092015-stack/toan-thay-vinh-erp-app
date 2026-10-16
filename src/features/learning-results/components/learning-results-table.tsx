import Link from "next/link";
import type { ReactNode } from "react";

import {
  DataTableFrame,
  TableCell,
  TableHeaderCell,
  TableRow,
  type DataTableFrameStatus,
} from "@/components/patterns/data-table-frame";
import { Badge } from "@/components/ui/badge";
import {
  LearningResultScoreValue,
  NotebookStatusBadge,
} from "@/features/learning-results/components/learning-result-badges";
import type { LearningResultDirectoryItem } from "@/features/learning-results/read-models";
import { formatDateTime, formatIsoDate } from "@/lib/datetime";

interface LearningResultsTableProps {
  canViewSessions: boolean;
  canViewStudents: boolean;
  /** In-frame empty state, rendered when `status` is "empty". */
  empty: ReactNode;
  /** Pager row; the page omits it when there is nothing to page. */
  footer?: ReactNode;
  items: readonly LearningResultDirectoryItem[];
  status: Extract<DataTableFrameStatus, "ready" | "empty">;
}

const linkFocusClassName =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";

/**
 * Learning-results table (design 16a): identity columns left, scores right,
 * statuses as badges. Link colours are important because the unlayered global
 * `a { color: inherit }` otherwise beats the utility.
 */
export function LearningResultsTable({
  canViewSessions,
  canViewStudents,
  empty,
  footer,
  items,
  status,
}: LearningResultsTableProps) {
  return (
    <DataTableFrame
      body={items.map((item) => (
        <LearningResultRow
          canViewSessions={canViewSessions}
          canViewStudents={canViewStudents}
          item={item}
          key={item.resultId}
        />
      ))}
      caption="Danh sách kết quả học tập"
      className="learning-results-table"
      empty={empty}
      footer={footer}
      header={
        <tr>
          <TableHeaderCell className="w-[172px]">Học sinh</TableHeaderCell>
          <TableHeaderCell className="w-[150px]">Lớp</TableHeaderCell>
          <TableHeaderCell className="w-[100px]">Buổi</TableHeaderCell>
          <TableHeaderCell className="w-[84px]" numeric>Điểm KT</TableHeaderCell>
          <TableHeaderCell className="w-[128px]">Vở</TableHeaderCell>
          <TableHeaderCell className="w-[84px]" numeric>Điểm vở</TableHeaderCell>
          <TableHeaderCell>Nhận xét</TableHeaderCell>
          <TableHeaderCell className="w-[136px]">Chấm lúc</TableHeaderCell>
          <TableHeaderCell className="w-[96px]">Khóa</TableHeaderCell>
        </tr>
      }
      status={status}
      // Fixed widths: the comment column takes what is left and truncates.
      tableClassName="min-w-[1060px] table-fixed"
    />
  );
}

function LearningResultRow({
  canViewSessions,
  canViewStudents,
  item,
}: {
  canViewSessions: boolean;
  canViewStudents: boolean;
  item: LearningResultDirectoryItem;
}) {
  const sessionDate = formatIsoDate(item.sessionDate);

  return (
    // Student and class cells carry a second line, so every row is the 56px one.
    <TableRow tall>
      <TableCell>
        {canViewStudents ? (
          <Link
            className={`block max-w-full truncate font-semibold text-text-strong! hover:underline ${linkFocusClassName}`}
            href={`/students/${item.studentId}`}
            title={item.studentName}
          >
            {item.studentName}
          </Link>
        ) : (
          <span
            className="block max-w-full truncate font-semibold text-text-strong"
            title={item.studentName}
          >
            {item.studentName}
          </span>
        )}
        <span className="block text-caption tabular-nums text-text-muted">
          {item.studentCode}
        </span>
      </TableCell>
      <TableCell>
        <span
          className="block max-w-full truncate text-text-default"
          title={item.className}
        >
          {item.className}
        </span>
        <span className="block whitespace-nowrap text-caption tabular-nums text-text-muted">
          {item.classCode} · K{item.classGrade} · {item.classLevel}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {canViewSessions ? (
          // The date is the link: a 32px target, with the padding pulled back
          // out by the negative margin so the text stays on the column edge.
          <Link
            aria-label={`Mở buổi học ${sessionDate} lớp ${item.classCode} của ${item.studentName}`}
            className={`-mx-2 inline-flex h-8 items-center rounded-md px-2 font-medium tabular-nums text-action-link! hover:bg-interactive-hover ${linkFocusClassName}`}
            href={`/sessions/${item.classSessionId}`}
          >
            {sessionDate}
          </Link>
        ) : (
          <span className="tabular-nums text-text-default">{sessionDate}</span>
        )}
      </TableCell>
      <TableCell numeric>
        <LearningResultScoreValue score={item.testScore} />
      </TableCell>
      <TableCell>
        <NotebookStatusBadge compact status={item.notebookStatus} />
      </TableCell>
      <TableCell numeric>
        <LearningResultScoreValue missing="dash" score={item.notebookScore} />
      </TableCell>
      <TableCell>
        {item.resultComment ? (
          <span
            className="block max-w-full truncate text-secondary text-text-default"
            title={item.resultComment}
          >
            {item.resultComment}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </TableCell>
      <TableCell
        className={`whitespace-nowrap tabular-nums ${item.gradedAt ? "text-text-default" : "text-text-muted"}`}
      >
        {formatDateTime(item.gradedAt)}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {item.lockedAt ? (
          <Badge tone="neutral">Đã khóa</Badge>
        ) : (
          <span className="text-secondary text-text-muted">Chưa khóa</span>
        )}
      </TableCell>
    </TableRow>
  );
}
