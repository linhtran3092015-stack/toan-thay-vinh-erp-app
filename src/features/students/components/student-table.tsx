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
    <div className="hidden max-w-full overflow-x-auto rounded-xl border border-hairline bg-surface-1 shadow-card lg:block">
      <table className="min-w-[1120px] border-separate border-spacing-0 text-left text-sm">
        <thead className="bg-surface-2 text-xs uppercase tracking-wider text-ink-subtle">
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

        <tbody className="divide-y divide-hairline">
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
                className="group border-t border-hairline transition-colors hover:bg-surface-2/70"
                key={student.id}
              >
                <TableCell>
                  <span className="font-mono text-xs font-bold text-ink-muted">
                    {student.publicCode}
                  </span>
                </TableCell>

                <TableCell>
                  <Link
                    className="block w-fit font-display text-sm font-bold text-primary hover:underline"
                    href={getStudentDetailHref(student)}
                  >
                    {student.fullName}
                  </Link>
                  <div className="mt-0.5 text-xs text-ink-subtle">
                    {student.nickname ? `Tên gọi: ${student.nickname}` : ""}
                  </div>
                </TableCell>

                <TableCell className="font-medium">{student.birthYear}</TableCell>

                <TableCell className="font-medium">
                  {student.primaryGuardian?.fullName ?? "—"}
                </TableCell>

                <TableCell>
                  <span className="font-mono text-xs font-semibold tabular-nums text-ink">
                    {student.primaryGuardian?.phone ?? "—"}
                  </span>
                </TableCell>

                <TableCell className="font-medium">
                  Khối {student.currentGrade}
                </TableCell>

                <TableCell className="font-medium text-ink">
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
                    <span className="text-xs text-ink-muted">
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
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-hairline bg-surface-1 px-3 text-xs font-bold text-ink-muted transition-colors hover:border-hairline-strong hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    href={getStudentDetailHref(student)}
                  >
                    Xem chi tiết
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
      className={`whitespace-nowrap border-b border-hairline px-4 py-3.5 font-bold ${className ?? ""}`}
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
      className={`px-4 py-3.5 align-middle text-ink ${className ?? ""}`}
    >
      {children}
    </td>
  );
}
