"use client";

import Link from "next/link";
import { useState } from "react";

import {
  DataTableFrame,
  TableCell,
  TableHeaderCell,
  TableRow,
  TableState,
} from "@/components/patterns/data-table-frame";
import { QuickFilterChips } from "@/components/patterns/quick-filter-chips";
import { Badge } from "@/components/ui/badge";
import {
  attendanceStatusLabels,
  attendanceStatusOrder,
  attendanceStatusTones,
  formatScore,
  notebookStatusLabels,
} from "@/features/sessions/components/attendance-status-group";
import type { StudentAttendanceHistory } from "@/features/students/detail/student-activity-models";
import { formatIsoDate } from "@/lib/datetime";

interface StudentAttendanceTabProps {
  canViewAttendance: boolean;
  /** `null` means the feed failed to load. */
  history: StudentAttendanceHistory | null;
  /** Rows shown before the footer notes the rest. */
  limit?: number;
}

/** Notebook status arrives as free text from the feed; unknown codes render as-is. */
const notebookLabels: Record<string, string> = notebookStatusLabels;

/** Tab "Điểm danh" (design 05b): class chips, status totals, recent sessions. */
export function StudentAttendanceTab({ canViewAttendance, history, limit = 30 }: StudentAttendanceTabProps) {
  const [classFilter, setClassFilter] = useState<string>("all");

  const header = (
    <tr>
      <TableHeaderCell className="w-[110px]">Ngày</TableHeaderCell>
      <TableHeaderCell className="min-w-[220px]">Buổi</TableHeaderCell>
      <TableHeaderCell className="w-[150px]">Trạng thái</TableHeaderCell>
      <TableHeaderCell className="w-[90px]" numeric>
        Điểm KT
      </TableHeaderCell>
      <TableHeaderCell className="w-[120px]">Vở</TableHeaderCell>
      <TableHeaderCell className="w-[72px]">
        <span className="sr-only">Mở buổi</span>
      </TableHeaderCell>
    </tr>
  );

  if (!canViewAttendance) {
    return (
      <DataTableFrame
        caption="Điểm danh của học sinh"
        forbidden={<TableState>Không có quyền xem điểm danh (attendance.view).</TableState>}
        header={header}
        body={null}
        status="forbidden"
      />
    );
  }

  if (!history) {
    return (
      <DataTableFrame
        caption="Điểm danh của học sinh"
        error={<TableState>Chưa tải được điểm danh; chưa thể kết luận học sinh có vắng hay không.</TableState>}
        header={header}
        body={null}
        status="error"
      />
    );
  }

  const filtered = classFilter === "all" ? history.items : history.items.filter((item) => item.classId === classFilter);
  const visible = filtered.slice(0, limit);
  const chips = [
    { count: history.total, label: "Tất cả lớp", value: "all" },
    ...history.classes.map((klass) => ({ count: klass.count, label: klass.className, value: klass.classId })),
  ];

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <QuickFilterChips chips={chips} label="Lọc điểm danh theo lớp" onChange={setClassFilter} value={classFilter} />
        <p className="text-secondary text-text-muted">
          {attendanceStatusOrder.map((status, index) => (
            <span key={status}>
              {index > 0 ? " · " : ""}
              {attendanceStatusLabels[status]} <span className="tabular-nums">{history.counts[status]}</span>
            </span>
          ))}
        </p>
      </div>

      <DataTableFrame
        body={visible.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="whitespace-nowrap text-text-muted">{formatIsoDate(item.sessionDate)}</TableCell>
            <TableCell>
              <span className="font-medium text-text-strong">{item.className}</span>
              {item.componentCode ? <span className="text-text-muted"> · {item.componentCode}</span> : null}
              {item.isLateUpdate ? <span className="text-text-muted"> · cập nhật muộn</span> : null}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Badge tone={attendanceStatusTones[item.status]}>{attendanceStatusLabels[item.status]}</Badge>
            </TableCell>
            <TableCell numeric>{formatScore(item.testScore)}</TableCell>
            <TableCell className="whitespace-nowrap text-text-muted">
              {item.notebookStatus ? notebookLabels[item.notebookStatus] ?? item.notebookStatus : "—"}
            </TableCell>
            <TableCell>
              <Link
                className="text-secondary font-semibold text-action-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                href={`/sessions/${item.sessionId}`}
              >
                Mở
              </Link>
            </TableCell>
          </TableRow>
        ))}
        caption="Điểm danh của học sinh"
        empty={
          <TableState>
            {history.total === 0 ? "Chưa có buổi nào được điểm danh." : "Không có buổi nào ở lớp đang lọc."}
          </TableState>
        }
        footer={
          <span>
            Hiển thị {visible.length}/{filtered.length} buổi gần nhất
            {history.items.some((item) => item.sessionLockedAt === null) ? " · buổi chưa khóa có thể còn thay đổi" : ""}
          </span>
        }
        header={header}
        status={visible.length === 0 ? "empty" : "ready"}
      />
    </div>
  );
}
