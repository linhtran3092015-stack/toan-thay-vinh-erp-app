import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SessionBalanceBadge } from "@/features/students/components/session-balance-badge";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { getStudentDetailHref } from "@/features/students/detail/helpers";
import type { Student } from "@/features/students/types";

interface StudentTableProps {
  students: Student[];
}

export function StudentTable({ students }: StudentTableProps) {
  return (
    <div className="hidden max-w-full overflow-x-auto rounded-lg border border-hairline bg-surface-1 shadow-card lg:block">
      <table className="min-w-[1500px] border-separate border-spacing-0 text-left text-sm">
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
            <TableHeader>Số dư buổi</TableHeader>
            <TableHeader>Nguồn</TableHeader>
            <TableHeader>Sale</TableHeader>
            <TableHeader>Trạng thái</TableHeader>
            <TableHeader>Cảnh báo</TableHeader>
            <TableHeader className="text-right">Action</TableHeader>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
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
                <div className="min-w-0">
                  <Link
                    className="block w-fit font-semibold leading-5 text-primary hover:underline"
                    href={getStudentDetailHref(student)}
                  >
                    {student.fullName}
                  </Link>
                  <div className="mt-0.5 text-xs text-ink-muted">
                    Biệt danh: {student.nickname}
                  </div>
                </div>
              </TableCell>
              <TableCell>{student.birthYear}</TableCell>
              <TableCell>{student.guardianName}</TableCell>
              <TableCell>
                <span className="font-medium tabular-nums">
                  {student.guardianPhone}
                </span>
              </TableCell>
              <TableCell>Khối {student.currentGrade}</TableCell>
              <TableCell>{student.mainClassName}</TableCell>
              <TableCell>
                <Badge tone={student.registeredMode === "online" ? "purple" : "info"}>
                  {student.registeredMode === "online" ? "Online" : "Offline"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge tone={student.learningLevel === "CLC" ? "purple" : "neutral"}>
                  {student.learningLevel}
                </Badge>
              </TableCell>
              <TableCell>
                <SessionBalanceBadge balance={student.sessionBalance} />
              </TableCell>
              <TableCell>{student.leadSourceName}</TableCell>
              <TableCell>{student.saleOwnerName}</TableCell>
              <TableCell>
                <StudentStatusBadge status={student.lifecycleStatus} />
              </TableCell>
              <TableCell>
                {student.alertCount > 0 ? (
                  <Badge tone="danger">{student.alertCount} cảnh báo</Badge>
                ) : (
                  <Badge tone="neutral">Không có</Badge>
                )}
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface TablePartProps {
  children: ReactNode;
  className?: string;
}

function TableHeader({ children, className }: TablePartProps) {
  return (
    <th className={`whitespace-nowrap border-b border-hairline px-4 py-3 font-semibold ${className ?? ""}`}>
      {children}
    </th>
  );
}

function TableCell({ children, className }: TablePartProps) {
  return (
    <td className={`border-b border-hairline px-4 py-3 align-middle text-ink ${className ?? ""}`}>
      {children}
    </td>
  );
}
