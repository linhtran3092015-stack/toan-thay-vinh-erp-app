import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SessionBalanceBadge } from "@/features/students/components/session-balance-badge";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { getStudentDetailHref } from "@/features/students/detail/helpers";
import type { Student } from "@/features/students/types";

interface StudentMobileCardProps {
  student: Student;
}

export function StudentMobileCard({ student }: StudentMobileCardProps) {
  return (
    <article className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            className="block truncate text-base font-semibold text-primary hover:underline"
            href={getStudentDetailHref(student)}
          >
            {student.fullName}
          </Link>
          <p className="mt-1 text-xs font-medium text-ink-muted">
            {student.publicCode}
          </p>
        </div>
        <StudentStatusBadge status={student.lifecycleStatus} />
      </div>

      <div className="mt-4 grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-muted">Lớp</span>
          <span className="font-semibold text-ink">
            Khối {student.currentGrade} · {student.mainClassName}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-muted">Số dư buổi</span>
          <SessionBalanceBadge balance={student.sessionBalance} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-muted">Cảnh báo</span>
          {student.alertCount > 0 ? (
            <Badge tone="danger">{student.alertCount} cảnh báo</Badge>
          ) : (
            <Badge tone="neutral">Không có</Badge>
          )}
        </div>
      </div>

      <Link
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-hairline bg-white px-4 text-sm font-semibold text-ink transition-colors hover:border-secondary hover:bg-canvas focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-secondary/25"
        href={getStudentDetailHref(student)}
      >
        Xem hồ sơ
      </Link>
    </article>
  );
}
