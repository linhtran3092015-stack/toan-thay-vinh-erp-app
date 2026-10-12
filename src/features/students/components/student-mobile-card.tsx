import { RecordListItem } from "@/components/patterns/responsive-record-list";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { getStudentDetailHref } from "@/features/students/detail/helpers";
import type { StudentDirectoryItem } from "@/features/students/read-models";
import { formatLearningMode } from "@/lib/format";

interface StudentMobileCardProps {
  directoryQuery: string;
  student: StudentDirectoryItem;
}

/** Narrow record (design 06c): name + status, code · guardian · phone, then class/grade/mode. */
export function StudentMobileCard({ directoryQuery, student }: StudentMobileCardProps) {
  const classInfo = student.activeEnrollment?.classInfo;
  const registeredMode = student.activeEnrollment?.registeredMode ?? student.registeredMode;
  const learningLevel = classInfo?.level ?? student.learningLevel;
  const detailHref = getStudentDetailHref(student, directoryQuery);

  return (
    <RecordListItem
      ariaLabel={`Mở hồ sơ học viên ${student.fullName}`}
      badge={<StudentStatusBadge status={student.lifecycleStatus} />}
      href={detailHref}
      meta={
        student.primaryGuardian
          ? `${student.publicCode} · PH ${student.primaryGuardian.fullName} · ${student.primaryGuardian.phone}`
          : `${student.publicCode} · Chưa liên kết phụ huynh`
      }
      metrics={
        <>
          <span>
            Lớp <strong className="font-semibold">{classInfo?.name ?? "Chưa xếp"}</strong>
          </span>
          <span>
            Khối <strong className="font-semibold">{student.currentGrade}{learningLevel ? ` · ${learningLevel}` : ""}</strong>
          </span>
          {registeredMode ? (
            <span className="ml-auto text-text-muted">{formatLearningMode(registeredMode)}</span>
          ) : null}
        </>
      }
      title={student.fullName}
    />
  );
}
