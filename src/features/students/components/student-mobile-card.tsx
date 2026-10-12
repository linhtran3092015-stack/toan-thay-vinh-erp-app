import { RecordListItem } from "@/components/patterns/responsive-record-list";
import { StudentMetricValue } from "@/features/students/components/student-directory-metric";
import { StudentStatusBadge } from "@/features/students/components/student-status-badge";
import { getStudentDetailHref } from "@/features/students/detail/helpers";
import type { StudentDirectoryItem } from "@/features/students/read-models";
import {
  getStudentDirectoryMetricCell,
  STUDENT_ATTENDANCE_WINDOW_DAYS,
  type StudentDirectoryMetrics,
} from "@/features/students/student-directory-metrics";

interface StudentMobileCardProps {
  directoryQuery: string;
  metrics: StudentDirectoryMetrics;
  student: StudentDirectoryItem;
}

/** Narrow record (design 06c): name + status, code · guardian · phone, then class, attendance, balance, debt. */
export function StudentMobileCard({ directoryQuery, metrics, student }: StudentMobileCardProps) {
  const classInfo = student.activeEnrollment?.classInfo;
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
          <span className="basis-full truncate">
            Lớp{" "}
            {classInfo?.name ? (
              <strong className="font-semibold">{classInfo.name}</strong>
            ) : (
              <span className="text-text-muted">Chưa xếp lớp</span>
            )}
          </span>
          <span>
            Chuyên cần {STUDENT_ATTENDANCE_WINDOW_DAYS} ngày{" "}
            <StudentMetricValue
              cell={getStudentDirectoryMetricCell(metrics, "attendanceRate", student.id)}
              format="attendance"
              strong
            />
          </span>
          <span>
            Số dư{" "}
            <StudentMetricValue
              cell={getStudentDirectoryMetricCell(metrics, "balanceSessions", student.id)}
              format="sessions"
              strong
            />
          </span>
          <span className="ml-auto">
            <DebtLabel cell={getStudentDirectoryMetricCell(metrics, "outstandingVnd", student.id)} />
          </span>
        </>
      }
      title={student.fullName}
    />
  );
}

/** "Nợ 2.400.000 ₫", "Không nợ", or "Nợ —" with the reason when debt is unavailable. */
function DebtLabel({ cell }: { cell: ReturnType<typeof getStudentDirectoryMetricCell> }) {
  if (cell.kind === "value" && cell.value === 0) {
    return <span className="text-text-muted">Không nợ</span>;
  }

  return (
    <>
      Nợ <StudentMetricValue cell={cell} format="vnd" strong />
    </>
  );
}
