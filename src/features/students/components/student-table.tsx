import type { ReactNode } from "react";
import Link from "next/link";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { getStudentDetailHref } from "@/features/students/detail/helpers";
import type { StudentDirectoryItem } from "@/features/students/read-models";

interface StudentTableProps {
  directoryQuery: string;
  students: StudentDirectoryItem[];
}

export function StudentTable({ directoryQuery, students }: StudentTableProps) {
  return (
    <DataTableFrame
      body={students.map((student) => {
        const classInfo = student.activeEnrollment?.classInfo;
        const registeredMode = student.activeEnrollment?.registeredMode ?? student.registeredMode;
        const learningLevel = classInfo?.level ?? student.learningLevel;
        const detailHref = getStudentDetailHref(student, directoryQuery);

        return (
          <tr className="transition-colors hover:bg-[var(--table-row-hover)]" key={student.id}>
            <TableCell className="w-[104px] tabular-nums text-secondary font-medium text-text-muted">
              {student.publicCode}
            </TableCell>
            <TableCell className="w-[220px]">
              <Link
                className="font-semibold text-action-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
                href={detailHref}
              >
                {student.fullName}
              </Link>
              {student.nickname ? <p className="mt-0.5 text-caption text-text-muted">Tên gọi: {student.nickname}</p> : null}
            </TableCell>
            <TableCell className="w-[88px] text-secondary text-text-default">
              Khối {student.currentGrade}{learningLevel ? ` · ${learningLevel}` : ""}
            </TableCell>
            <TableCell className="w-[172px] text-text-default">
              {classInfo?.name ?? "Chưa xếp lớp"}
            </TableCell>
            <TableCell className="w-[184px]">
              <p className="text-body font-medium text-text-default">{student.primaryGuardian?.fullName ?? "Chưa liên kết"}</p>
              <p className="mt-0.5 tabular-nums text-caption text-text-muted">{student.primaryGuardian?.phone ?? "—"}</p>
            </TableCell>
            <TableCell className="w-[88px] text-secondary text-text-muted">
              {registeredMode === "online" ? "Online" : registeredMode === "offline" ? "Offline" : "Chưa xác định"}
            </TableCell>
            <TableCell className="w-[144px]">
              <StudentStatusBadge status={student.lifecycleStatus} />
            </TableCell>
            <TableCell className="w-[96px] text-right">
              <Link
                aria-label={`Mở hồ sơ ${student.fullName}`}
                className="inline-flex h-8 items-center justify-center rounded-md px-2 text-control font-semibold text-action-link hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
                href={detailHref}
              >
                Mở hồ sơ
              </Link>
            </TableCell>
          </tr>
        );
      })}
      caption="Danh sách học viên"
      className="students-directory-table"
      header={
        <tr>
          <TableHeader>Mã học viên</TableHeader>
          <TableHeader>Học viên</TableHeader>
          <TableHeader>Khối / mức</TableHeader>
          <TableHeader>Lớp chính</TableHeader>
          <TableHeader>Phụ huynh</TableHeader>
          <TableHeader>Hình thức</TableHeader>
          <TableHeader>Trạng thái</TableHeader>
          <TableHeader className="text-right">Thao tác</TableHeader>
        </tr>
      }
      tableClassName="min-w-[1120px] table-fixed text-table-body text-text-default"
    />
  );
}

interface TablePartProps {
  children: ReactNode;
  className?: string;
}

function TableHeader({ children, className }: TablePartProps) {
  return (
    <th className={`h-10 border-b border-border-subtle px-3 text-left font-semibold ${className ?? ""}`} scope="col">
      {children}
    </th>
  );
}

function TableCell({ children, className }: TablePartProps) {
  return <td className={`h-14 px-3 align-middle text-table-body ${className ?? ""}`}>{children}</td>;
}
