"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DataTableFrame, TableCell, TableHeaderCell, TableRow, TableState } from "@/components/patterns/data-table-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CLASS_SESSION_LIMIT, formatSessionOrdinal } from "@/features/classes/detail/class-detail-models";
import {
  formatAverageScore,
  formatScore,
  getResultColumnAverage,
  type ClassResultCell,
  type ClassResultMatrix,
} from "@/features/classes/detail/class-roster-models";
import { formatIsoDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";

/** Session columns shown at once; older ones page in from the left. */
const RESULT_COLUMNS_PER_PAGE = 8;

export interface ClassResultsTabProps {
  matrix: ClassResultMatrix;
  /** The sessions feed holds only the newest CLASS_SESSION_LIMIT sessions. */
  truncated?: boolean;
}

/**
 * Results tab (design 03, step 5b part 2): students × started sessions of test
 * scores with each student's average in the last column and each session's
 * average in the last row. A light-red cell is a present student at a finished,
 * unlocked session without a result yet (owner decision); "V" is an absence. The
 * newest sessions show first; older ones page in.
 */
export function ClassResultsTab({ matrix, truncated = false }: ClassResultsTabProps) {
  const pageCount = Math.max(1, Math.ceil(matrix.columns.length / RESULT_COLUMNS_PER_PAGE));
  // Page 0 = the newest sessions (rightmost columns).
  const [page, setPage] = useState(0);
  const currentPage = Math.min(page, pageCount - 1);
  const end = matrix.columns.length - currentPage * RESULT_COLUMNS_PER_PAGE;
  const start = Math.max(0, end - RESULT_COLUMNS_PER_PAGE);
  const columnIndexes = Array.from({ length: end - start }, (_, index) => start + index);

  if (matrix.columns.length === 0) {
    return (
      <p className="rounded-lg border border-border-subtle bg-surface-base px-4 py-6 text-center text-secondary text-text-muted">
        Lớp chưa có buổi nào diễn ra nên chưa có kết quả.
      </p>
    );
  }

  const rangeLabel = `Buổi ${describeColumn(matrix, start)} – ${describeColumn(matrix, end - 1)}`;

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-secondary text-text-default">
          {matrix.missingCount > 0 ? (
            <>
              <span className="font-semibold text-danger">{matrix.missingCount} ô chưa nhập điểm</span>
              <span className="text-text-muted"> · học sinh có mặt ở buổi đã kết thúc nhưng chưa có kết quả</span>
            </>
          ) : matrix.attendanceKnown ? (
            <span className="text-text-muted">Đã nhập đủ kết quả cho học sinh của lớp có mặt ở các buổi chưa khóa.</span>
          ) : null}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-secondary tabular-nums text-text-muted" aria-live="polite">
            {rangeLabel}
          </span>
          <Button
            aria-label="Xem các buổi cũ hơn"
            disabled={currentPage >= pageCount - 1}
            iconOnly
            onClick={() => setPage(currentPage + 1)}
            // 44px on touch layouts, like the shared Pagination.
            className="max-md:h-11 max-md:min-w-11"
            size="sm"
            type="button"
            variant="secondary"
          >
            <ChevronLeft aria-hidden="true" size={16} strokeWidth={1.8} />
          </Button>
          <Button
            aria-label="Xem các buổi mới hơn"
            disabled={currentPage === 0}
            iconOnly
            onClick={() => setPage(currentPage - 1)}
            // 44px on touch layouts, like the shared Pagination.
            className="max-md:h-11 max-md:min-w-11"
            size="sm"
            type="button"
            variant="secondary"
          >
            <ChevronRight aria-hidden="true" size={16} strokeWidth={1.8} />
          </Button>
        </div>
      </div>

      <p className="text-caption text-text-muted">
        Bảng gồm học sinh ghi danh ở lớp này; học sinh học thêm từ lớp khác không có trong bảng.
        {truncated ? ` Lớp có hơn ${CLASS_SESSION_LIMIT} buổi: bảng và điểm trung bình chỉ tính ${CLASS_SESSION_LIMIT} buổi mới nhất.` : ""}
      </p>

      {!matrix.attendanceKnown ? (
        <p className="text-secondary text-text-muted">
          Không đọc được điểm danh nên bảng không đánh dấu ô thiếu điểm hay buổi vắng; chỉ hiện điểm đã nhập.
        </p>
      ) : null}

      <DataTableFrame
        body={[
          ...matrix.rows.map((row) => (
          <TableRow key={row.student.id}>
            <th className="sticky left-0 z-10 min-w-36 bg-surface-base md:min-w-48 px-3 py-0 pl-4 text-left align-middle font-normal group-hover/row:bg-table-row-hover" scope="row">
              <Link className="font-semibold text-text-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus" href={`/students/${row.student.id}`}>
                {row.student.fullName}
              </Link>
              {row.enrollmentStatus ? (
                <span className="ml-2 align-middle">
                  <Badge tone={row.enrollmentStatus.tone}>{row.enrollmentStatus.label}</Badge>
                </span>
              ) : null}
            </th>
            {columnIndexes.map((index) => (
              <ResultCell cell={row.cells[index]} key={matrix.columns[index].id} />
            ))}
            <TableCell className="border-l border-border-row font-semibold text-text-strong" numeric>
              {row.average === null ? <span className="font-normal text-text-muted">—</span> : formatAverageScore(row.average)}
            </TableCell>
          </TableRow>
          )),
          <TableRow className="bg-table-header hover:bg-table-header" key="column-averages">
            <th className="sticky left-0 z-10 bg-table-header px-3 py-0 pl-4 text-left align-middle font-semibold text-text-muted" scope="row">
              Trung bình buổi
            </th>
            {columnIndexes.map((index) => {
              const average = getResultColumnAverage(matrix, index);
              return (
                <TableCell className="font-semibold text-text-strong" key={matrix.columns[index].id} numeric>
                  {average === null ? <span className="font-normal text-text-muted">—</span> : formatAverageScore(average)}
                </TableCell>
              );
            })}
            <TableCell className="border-l border-border-row" numeric>
              <span className="sr-only">Không áp dụng</span>
            </TableCell>
          </TableRow>,
        ]}
        caption="Kết quả kiểm tra của học sinh theo buổi"
        empty={<TableState>Lớp chưa có học sinh nào để hiện kết quả.</TableState>}
        footer={
          <>
            <span>Điểm trung bình mỗi buổi chỉ tính các bài đã có điểm kiểm tra.</span>
            <span className="flex flex-wrap items-center gap-3 text-caption">
              <span className="inline-flex items-center gap-1">
                <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-danger-border bg-danger-bg text-[10px] font-semibold text-danger">!</span> Chưa nhập
              </span>
              <span>Khóa = buổi đã khóa, không nhập thêm được</span>
              <span>V = vắng</span>
              <span>· = không học buổi này</span>
              <span>Vở = chỉ chấm vở</span>
            </span>
          </>
        }
        header={
          <>
            <tr>
              <TableHeaderCell className="sticky left-0 z-10 bg-table-header">Học sinh</TableHeaderCell>
              {columnIndexes.map((index) => {
                const column = matrix.columns[index];
                return (
                  <TableHeaderCell className="min-w-16" key={column.id} numeric>
                    <Link
                      className="block leading-tight hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                      href={`/sessions/${column.id}`}
                      title={`Mở buổi ${describeColumn(matrix, index)}`}
                    >
                      <span className="block text-text-strong">{column.ordinal === null ? "—" : formatSessionOrdinal(column.ordinal)}</span>
                      <span className="block text-caption font-normal">{formatIsoDate(column.sessionDate).slice(0, 5)}</span>
                    </Link>
                  </TableHeaderCell>
                );
              })}
              <TableHeaderCell className="border-l border-border-row" numeric>
                Trung bình
              </TableHeaderCell>
            </tr>
          </>
        }
        status={matrix.rows.length === 0 ? "empty" : "ready"}
      />

    </div>
  );
}

function describeColumn(matrix: ClassResultMatrix, index: number): string {
  const column = matrix.columns[index];
  if (!column) return "";
  return column.ordinal === null ? formatIsoDate(column.sessionDate) : formatSessionOrdinal(column.ordinal);
}

function ResultCell({ cell }: { cell: ClassResultCell | null }) {
  if (!cell) {
    return (
      <TableCell className="text-text-muted" numeric>
        <span aria-hidden="true">·</span>
        <span className="sr-only">Không có</span>
      </TableCell>
    );
  }

  switch (cell.kind) {
    case "score":
      return (
        <TableCell className="text-text-strong" numeric>
          {formatScore(cell.score)}
        </TableCell>
      );
    case "graded":
      return (
        <TableCell className="text-text-muted" numeric title="Có kết quả nhưng không có điểm kiểm tra">
          Vở
        </TableCell>
      );
    case "unrecorded":
      return (
        <TableCell className="text-caption text-text-muted" numeric title="Có mặt, chưa có kết quả; buổi đã khóa nên không nhập thêm được">
          <span aria-hidden="true">Khóa</span>
          <span className="sr-only">Không nhập</span>
        </TableCell>
      );
    case "absent":
      return (
        <TableCell className="text-text-muted" numeric title="Vắng">
          <span aria-hidden="true">V</span>
          <span className="sr-only">Vắng</span>
        </TableCell>
      );
    case "missing":
      return (
        <TableCell className={cn("bg-danger-bg font-semibold text-danger")} numeric title="Có mặt nhưng chưa nhập kết quả">
          {/* A visible mark too: the tint alone would carry the meaning by colour. */}
          <span aria-hidden="true">!</span>
          <span className="sr-only">Chưa nhập</span>
        </TableCell>
      );
  }
}
