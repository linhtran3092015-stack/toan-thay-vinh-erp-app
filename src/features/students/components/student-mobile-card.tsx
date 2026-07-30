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
    <article className="rounded-xl border border-hairline bg-surface-1 p-4 shadow-card transition-all active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            className="block truncate font-display text-base font-bold text-primary hover:underline"
            href={getStudentDetailHref(student)}
          >
            {student.fullName}
          </Link>
          <p className="mt-0.5 font-mono text-xs font-semibold text-ink-muted">
            {student.publicCode}
          </p>
        </div>

        <StudentStatusBadge
          status={student.lifecycleStatus}
        />
      </div>

      <div className="mt-4 grid gap-2.5 rounded-lg bg-surface-2 p-3 text-xs">
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
              ? `${student.primaryGuardian.fullName} (${student.primaryGuardian.phone})`
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
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-hairline bg-surface-1 px-4 text-xs font-bold text-ink transition-colors hover:border-hairline-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 active:scale-[0.98]"
        href={getStudentDetailHref(student)}
      >
        Xem hồ sơ học viên ➔
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
