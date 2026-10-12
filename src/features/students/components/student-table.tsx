import Link from "next/link";
import type { ReactNode, RefObject } from "react";

import {
  DataTableFrame,
  TableCell,
  TableHeaderCell,
  TableRow,
  type DataTableFrameStatus,
} from "@/components/patterns/data-table-frame";
import { AttendanceRateBar, StudentMetricValue } from "@/features/students/components/student-directory-metric";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { getStudentDetailHref } from "@/features/students/detail/helpers";
import type { StudentDirectoryItem } from "@/features/students/read-models";
import {
  getStudentDirectoryMetricCell,
  STUDENT_ATTENDANCE_WINDOW_DAYS,
  type StudentDirectoryMetrics,
} from "@/features/students/student-directory-metrics";
import { formatLearningMode } from "@/lib/format";

interface StudentTableProps {
  directoryQuery: string;
  /** Attendance, balance and debt columns; blank with a reason when unavailable. */
  metrics: StudentDirectoryMetrics;
  students: StudentDirectoryItem[];
  /** Row selection for bulk actions; off by default. */
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggleStudent?: (id: string) => void;
  onToggleAll?: (ids: string[], checked: boolean) => void;
  footer?: ReactNode;
  status?: DataTableFrameStatus;
  empty?: ReactNode;
  /** Header "select all" checkbox, e.g. to return focus after clearing a selection. */
  selectAllRef?: RefObject<HTMLInputElement | null>;
}

const checkboxClassName =
  "h-4 w-4 cursor-pointer rounded-sm border-border-strong accent-[var(--action-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";

export function StudentTable({
  directoryQuery,
  metrics,
  students,
  selectable = false,
  selectedIds,
  onToggleStudent,
  onToggleAll,
  footer,
  status = "ready",
  empty,
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
              <span className="block text-caption leading-[14px] tabular-nums text-text-muted">
                {student.publicCode}
                {student.nickname ? ` · ${student.nickname}` : ""}
              </span>
            </TableCell>
            <TableCell className="w-[150px] max-w-[150px]">
              {student.primaryGuardian ? (
                <>
                  <span className="block truncate text-text-default" title={student.primaryGuardian.fullName}>
                    {student.primaryGuardian.fullName}
                  </span>
                  <span className="block text-caption leading-[14px] tabular-nums text-text-muted">{student.primaryGuardian.phone}</span>
                </>
              ) : (
                <span className="text-text-muted">Chưa liên kết</span>
              )}
            </TableCell>
            <TableCell className="w-[150px] max-w-[150px]">
              <span className="block truncate text-text-default" title={classInfo?.name}>
                {classInfo?.name ?? <span className="text-text-muted">Chưa xếp lớp</span>}
              </span>
              <span className="block truncate text-caption leading-[14px] text-text-muted">
                Khối {student.currentGrade}{learningLevel ? ` · ${learningLevel}` : ""}
                {registeredMode ? ` · ${formatLearningMode(registeredMode)}` : ""}
              </span>
            </TableCell>
            <TableCell className="w-[128px]">
              <AttendanceRateBar cell={getStudentDirectoryMetricCell(metrics, "attendanceRate", student.id)} />
            </TableCell>
            <TableCell className="w-[88px]" numeric>
              <StudentMetricValue
                cell={getStudentDirectoryMetricCell(metrics, "balanceSessions", student.id)}
                format="sessions"
              />
            </TableCell>
            <TableCell className="w-[116px]" numeric>
              <StudentMetricValue
                cell={getStudentDirectoryMetricCell(metrics, "outstandingVnd", student.id)}
                format="vnd"
              />
            </TableCell>
            <TableCell className="w-[136px]">
              <StudentStatusBadge status={student.lifecycleStatus} />
            </TableCell>
            <TableCell className="w-[64px] text-right">
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
          <TableHeaderCell className="leading-4" title="Có mặt trên buổi chính khóa; không tính Học thêm">
            Chuyên cần{" "}
            <span className="block font-normal">{STUDENT_ATTENDANCE_WINDOW_DAYS} ngày</span>
          </TableHeaderCell>
          <TableHeaderCell numeric>Số dư buổi</TableHeaderCell>
          <TableHeaderCell numeric>Công nợ</TableHeaderCell>
          <TableHeaderCell>Trạng thái</TableHeaderCell>
          <TableHeaderCell numeric>Thao tác</TableHeaderCell>
        </tr>
      }
      status={status}
      tableClassName="min-w-[1030px]"
    />
  );
}
