import type { ReactNode } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { getStudentDetailHref } from "@/features/students/detail/helpers";
import type { StudentDirectoryItem } from "@/features/students/read-models";

interface StudentTableProps {
  students: StudentDirectoryItem[];
}

export function StudentTable({
  students,
}: StudentTableProps) {
  return (
    <div className="hidden max-w-full overflow-x-auto rounded-lg border border-hairline bg-surface-1 shadow-card lg:block">
      <table className="min-w-[1120px] border-separate border-spacing-0 text-left text-sm">
        <thead className="bg-canvas text-xs uppercase tracking-[0.08em] text-ink-subtle">
          <tr>
            <TableHeader>Mã học viên</TableHeader>
            <TableHeader>Họ tên</TableHeader>
            <TableHeader>Năm sinh</TableHeader>
            <TableHeader>Phụ huynh</TableHeader>
            <TableHeader>SĐT</TableHeader>
            <TableHeader>Khối</TableHeader>
            <TableHeader>Lớp chính</TableHeader>
            <TableHeader>Hình thức</TableHeader>
            <TableHeader>Mức</TableHeader>
            <TableHeader>Trạng thái</TableHeader>
            <TableHeader className="text-right">
              Thao tác
            </TableHeader>
          </tr>
        </thead>

        <tbody>
          {students.map((student) => {
            const classInfo =
              student.activeEnrollment?.classInfo;
            const registeredMode =
              student.activeEnrollment?.registeredMode ??
              student.registeredMode;
            const learningLevel =
              classInfo?.level ?? student.learningLevel;

            return (
              <tr
                className="group border-t border-hairline transition hover:bg-[#F8FAFF]"
                key={student.id}
              >
                <TableCell>
                  <span className="font-mono text-xs font-semibold text-ink-muted">
                    {student.publicCode}
                  </span>
                </TableCell>

                <TableCell>
                  <Link
                    className="block w-fit font-semibold leading-5 text-primary hover:underline"
                    href={getStudentDetailHref(student)}
                  >
                    {student.fullName}
                  </Link>
                  <div className="mt-0.5 text-xs text-ink-muted">
                    Tên thường gọi:{" "}
                    {student.nickname ?? "Chưa có"}
                  </div>
                </TableCell>

                <TableCell>{student.birthYear}</TableCell>

                <TableCell>
                  {student.primaryGuardian?.fullName ??
                    "Chưa liên kết"}
                </TableCell>

                <TableCell>
                  <span className="font-medium tabular-nums">
                    {student.primaryGuardian?.phone ?? "—"}
                  </span>
                </TableCell>

                <TableCell>
                  Khối {student.currentGrade}
                </TableCell>

                <TableCell>
                  {classInfo?.name ?? "Chưa xếp lớp"}
                </TableCell>

                <TableCell>
                  {registeredMode ? (
                    <Badge
                      tone={
                        registeredMode === "online"
                          ? "purple"
                          : "info"
                      }
                    >
                      {registeredMode === "online"
                        ? "Online"
                        : "Offline"}
                    </Badge>
                  ) : (
                    <span className="text-ink-muted">
                      Chưa xác định
                    </span>
                  )}
                </TableCell>

                <TableCell>
                  {learningLevel ? (
                    <Badge
                      tone={
                        learningLevel === "CLC"
                          ? "purple"
                          : "neutral"
                      }
                    >
                      {learningLevel}
                    </Badge>
                  ) : (
                    <span className="text-ink-muted">—</span>
                  )}
                </TableCell>

                <TableCell>
                  <StudentStatusBadge
                    status={student.lifecycleStatus}
                  />
                </TableCell>

                <TableCell className="text-right">
                  <Link
                    className="inline-flex h-8 items-center justify-center rounded-md border border-transparent px-3 text-xs font-semibold text-ink-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-secondary/25"
                    href={getStudentDetailHref(student)}
                  >
                    Xem
                  </Link>
                </TableCell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface TablePartProps {
  children: ReactNode;
  className?: string;
}

function TableHeader({
  children,
  className,
}: TablePartProps) {
  return (
    <th
      className={`whitespace-nowrap border-b border-hairline px-4 py-3 font-semibold ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  className,
}: TablePartProps) {
  return (
    <td
      className={`border-b border-hairline px-4 py-3 align-middle text-ink ${className ?? ""}`}
    >
      {children}
    </td>
  );
}
