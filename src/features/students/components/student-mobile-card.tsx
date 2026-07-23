import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { getStudentDetailHref } from "@/features/students/detail/helpers";
import type { StudentDirectoryItem } from "@/features/students/read-models";

interface StudentMobileCardProps {
  student: StudentDirectoryItem;
}

export function StudentMobileCard({
  student,
}: StudentMobileCardProps) {
  const classInfo = student.activeEnrollment?.classInfo;
  const registeredMode =
    student.activeEnrollment?.registeredMode ??
    student.registeredMode;

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

        <StudentStatusBadge
          status={student.lifecycleStatus}
        />
      </div>

      <div className="mt-4 grid gap-3 text-sm">
        <InfoLine
          label="Lớp"
          value={
            classInfo
              ? `Khối ${student.currentGrade} · ${classInfo.name}`
              : `Khối ${student.currentGrade} · Chưa xếp lớp`
          }
        />

        <InfoLine
          label="Phụ huynh"
          value={
            student.primaryGuardian
              ? `${student.primaryGuardian.fullName} · ${student.primaryGuardian.phone}`
              : "Chưa liên kết"
          }
        />

        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-muted">Hình thức</span>
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
            <span className="font-semibold text-ink">
              Chưa xác định
            </span>
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

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-semibold text-ink">
        {value}
      </span>
    </div>
  );
}
