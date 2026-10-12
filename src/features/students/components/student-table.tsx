import Link from "next/link";
import type { ReactNode, RefObject } from "react";

import {
  DataTableFrame,
  TableCell,
  TableHeaderCell,
  TableRow,
  type DataTableFrameStatus,
} from "@/components/patterns/data-table-frame";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { getStudentDetailHref } from "@/features/students/detail/helpers";
import type { StudentDirectoryItem } from "@/features/students/read-models";
import { formatLearningMode } from "@/lib/format";

interface StudentTableProps {
  directoryQuery: string;
  students: StudentDirectoryItem[];
  /** Row selection for bulk actions; off by default. */
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggleStudent?: (id: string) => void;
  onToggleAll?: (ids: string[], checked: boolean) => void;
  footer?: ReactNode;
  status?: DataTableFrameStatus;
  empty?: ReactNode;
  loading?: ReactNode;
  /** Header "select all" checkbox, e.g. to return focus after clearing a selection. */
  selectAllRef?: RefObject<HTMLInputElement | null>;
}

const checkboxClassName =
  "h-4 w-4 cursor-pointer rounded-sm border-border-strong accent-[var(--action-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";

export function StudentTable({
  directoryQuery,
  students,
  selectable = false,
  selectedIds,
  onToggleStudent,
  onToggleAll,
  footer,
  status = "ready",
  empty,
  loading,
  selectAllRef,
}: StudentTableProps) {
  const pageIds = students.map((student) => student.id);
  const selectedOnPage = pageIds.filter((id) => selectedIds?.has(id)).length;
  const allSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;

  return (
    <DataTableFrame
      body={students.map((student) => {
        const classInfo = student.activeEnrollment?.classInfo;
        const registeredMode = student.activeEnrollment?.registeredMode ?? student.registeredMode;
        const learningLevel = classInfo?.level ?? student.learningLevel;
        const detailHref = getStudentDetailHref(student, directoryQuery);
        const isSelected = selectedIds?.has(student.id) ?? false;

        return (
          <TableRow key={student.id} selected={isSelected}>
            {selectable ? (
              <TableCell className="w-12">
                <input
                  aria-label={`Chọn ${student.fullName}`}
                  checked={isSelected}
                  className={checkboxClassName}
                  onChange={() => onToggleStudent?.(student.id)}
                  type="checkbox"
                />
              </TableCell>
            ) : null}
            <TableCell>
              <Link
                className="font-semibold text-text-strong hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                href={detailHref}
              >
                {student.fullName}
              </Link>
              <span className="ml-2 text-secondary tabular-nums text-text-muted">{student.publicCode}</span>
              {student.nickname ? <span className="ml-2 text-caption text-text-muted">· {student.nickname}</span> : null}
            </TableCell>
            <TableCell className="w-[200px]">
              {student.primaryGuardian ? (
                <>
                  <span className="block truncate text-text-default">{student.primaryGuardian.fullName}</span>
                  <span className="block text-caption leading-[14px] tabular-nums text-text-muted">{student.primaryGuardian.phone}</span>
                </>
              ) : (
                <span className="text-text-muted">Chưa liên kết</span>
              )}
            </TableCell>
            <TableCell className="w-[180px] text-text-default">
              {classInfo?.name ?? <span className="text-text-muted">Chưa xếp lớp</span>}
            </TableCell>
            <TableCell className="w-[112px] text-secondary text-text-default">
              Khối {student.currentGrade}{learningLevel ? ` · ${learningLevel}` : ""}
            </TableCell>
            <TableCell className="w-[96px] text-secondary text-text-muted">
              {registeredMode ? formatLearningMode(registeredMode) : "—"}
            </TableCell>
            <TableCell className="w-[150px]">
              <StudentStatusBadge status={student.lifecycleStatus} />
            </TableCell>
            <TableCell className="w-[80px] text-right">
              <Link
                aria-label={`Mở hồ sơ ${student.fullName}`}
                className="inline-flex h-8 items-center rounded-md px-2 text-secondary font-semibold text-action-link hover:bg-interactive-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                href={detailHref}
              >
                Mở
              </Link>
            </TableCell>
          </TableRow>
        );
      })}
      caption="Danh sách học sinh"
      className="students-directory-table"
      empty={empty}
      footer={footer}
      header={
        <tr>
          {selectable ? (
            <TableHeaderCell className="w-12">
              <input
                aria-label="Chọn tất cả trên trang"
                checked={allSelected}
                className={checkboxClassName}
                onChange={(event) => onToggleAll?.(pageIds, event.target.checked)}
                ref={(node) => {
                  if (node) node.indeterminate = selectedOnPage > 0 && !allSelected;
                  if (selectAllRef) selectAllRef.current = node;
                }}
                type="checkbox"
              />
            </TableHeaderCell>
          ) : null}
          <TableHeaderCell>Học sinh</TableHeaderCell>
          <TableHeaderCell>Phụ huynh</TableHeaderCell>
          <TableHeaderCell>Lớp</TableHeaderCell>
          <TableHeaderCell>Khối · mức</TableHeaderCell>
          <TableHeaderCell>Hình thức</TableHeaderCell>
          <TableHeaderCell>Trạng thái</TableHeaderCell>
          <TableHeaderCell numeric>Thao tác</TableHeaderCell>
        </tr>
      }
      loading={loading}
      status={status}
      tableClassName="min-w-[1040px]"
    />
  );
}
