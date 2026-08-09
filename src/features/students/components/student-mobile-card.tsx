import Link from "next/link";

import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { getStudentDetailHref } from "@/features/students/detail/helpers";
import type { StudentDirectoryItem } from "@/features/students/read-models";

interface StudentMobileCardProps {
  directoryQuery: string;
  student: StudentDirectoryItem;
}

export function StudentMobileCard({ directoryQuery, student }: StudentMobileCardProps) {
  const classInfo = student.activeEnrollment?.classInfo;
  const registeredMode = student.activeEnrollment?.registeredMode ?? student.registeredMode;
  const learningLevel = classInfo?.level ?? student.learningLevel;
  const detailHref = getStudentDetailHref(student, directoryQuery);

  return (
    <article className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3" role="listitem">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            className="block text-body font-semibold text-action-link hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
            href={detailHref}
          >
            {student.fullName}
          </Link>
          <p className="mt-0.5 tabular-nums text-caption text-text-muted">{student.publicCode}</p>
        </div>
        <StudentStatusBadge status={student.lifecycleStatus} />
      </div>

      <div className="mt-3 grid gap-1.5 text-secondary text-text-muted">
        <p>Khối {student.currentGrade}{learningLevel ? ` · Mức ${learningLevel}` : ""}{registeredMode ? ` · ${registeredMode === "online" ? "Online" : "Offline"}` : ""}</p>
        <p><span className="font-medium text-text-default">Lớp:</span> {classInfo?.name ?? "Chưa xếp lớp"}</p>
        <p><span className="font-medium text-text-default">Phụ huynh:</span> {student.primaryGuardian ? `${student.primaryGuardian.fullName} · ${student.primaryGuardian.phone}` : "Chưa liên kết"}</p>
      </div>

      <Link
        aria-label={`Mở hồ sơ học viên ${student.fullName}`}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border-subtle px-4 text-control font-semibold text-action-link hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring"
        href={detailHref}
      >
        Mở hồ sơ học viên
      </Link>
    </article>
  );
}
