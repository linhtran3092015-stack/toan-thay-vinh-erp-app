import { Suspense } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { StudentZaloGroupCard } from "@/features/parent-messages/components/student-zalo-group-card";
import { getCareDashboard } from "@/features/student-care/data";
import { StudentCareDashboardCard } from "@/features/student-care/dashboard-card";
import { getStudentDetail } from "@/features/students/data";
import {
  getStudentAttendanceHistory,
  getStudentPaymentRequests,
  getStudentUpcomingSession,
} from "@/features/students/detail/student-activity-data";
import { StudentProfilePage } from "@/features/students/detail/student-profile-page";
import { getStudentEnrollmentUiModel } from "@/features/students/enrollment/student-enrollment-data";
import { getStudentLedgerSummary } from "@/features/students/ledger-data";
import { withStudentDirectoryQuery } from "@/features/students/student-directory-url-state";
import { getStudentTuitionProfile } from "@/features/students/tuition-profile-data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

interface StudentDetailRouteProps {
  params: Promise<{
    studentId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StudentDetailRoute({
  params,
  searchParams,
}: StudentDetailRouteProps) {
  const { studentId } = await params;
  const requestedSearchParams = await searchParams;
  const directoryParams = new URLSearchParams();

  Object.entries(requestedSearchParams).forEach(([key, value]) => {
    if (typeof value === "string" && key !== "tab") directoryParams.set(key, value);
  });

  const directoryHref = withStudentDirectoryQuery("/students", directoryParams);
  const editHref = withStudentDirectoryQuery(`/students/${studentId}/edit`, directoryParams);
  const requestedTab = typeof requestedSearchParams.tab === "string" ? requestedSearchParams.tab : undefined;
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền xem hồ sơ học viên."
        title="Không tải được quyền truy cập"
      />
    );
  }

  const permissions = permissionResult.permissions;
  const has = (code: (typeof permissions)[number]) => permissions.includes(code);

  if (!has("students.view")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("students.view")}
        title="Không có quyền xem hồ sơ học viên"
      />
    );
  }

  const canUpdateStudent = has("students.update");
  const canManageEnrollment = has("students.manage_status") || has("students.transfer_class") || has("students.reserve");
  const canViewClasses = has("classes.view");
  const canViewGuardians = has("guardians.view");
  const canViewLedger = has("session_ledger.view");
  const canViewAttendance = has("attendance.view");
  const canViewPayments = has("payments.view");
  const canViewSessions = has("sessions.view");
  const canViewCare = has("student_care.view");

  const detailResult = await getStudentDetail(studentId, {
    includeClasses: canViewClasses || canManageEnrollment,
    includeGuardians: canViewGuardians,
  });

  if (!detailResult.ok) {
    if (detailResult.error.code === "student_not_found") {
      return (
        <EmptyState
          description="Hồ sơ có thể đã bị xóa, đường dẫn không chính xác hoặc tài khoản không còn quyền truy cập."
          title="Không tìm thấy học viên"
        />
      );
    }

    return (
      <ErrorState
        description={detailResult.error.message}
        title="Không tải được hồ sơ học viên"
      />
    );
  }

  const detail = detailResult.detail;
  const activeClassId = detail.activeEnrollment?.classInfo?.id ?? null;

  const [enrollmentUiModel, ledgerSummary, tuitionProfile, attendance, payments, upcomingSession, careDashboard] =
    await Promise.all([
      getStudentEnrollmentUiModel(detail, permissions),
      canViewLedger ? getStudentLedgerSummary(studentId) : Promise.resolve(null),
      getStudentTuitionProfile(studentId),
      canViewAttendance ? getStudentAttendanceHistory(studentId) : Promise.resolve(undefined),
      canViewPayments ? getStudentPaymentRequests(studentId) : Promise.resolve(undefined),
      canViewSessions && activeClassId ? getStudentUpcomingSession(activeClassId) : Promise.resolve(null),
      canViewCare ? getCareDashboard({ student_id: studentId }) : Promise.resolve(null),
    ]);

  return (
    <StudentProfilePage
      attendance={attendance}
      canCorrectAcquisitionSource={has("students.correct_acquisition_source")}
      canCreatePaymentRequest={has("payments.create_request")}
      canManageTuitionRates={has("students.manage_tuition_rates")}
      canUpdateStudent={canUpdateStudent}
      canViewAttendance={canViewAttendance}
      canViewCare={canViewCare}
      canViewClasses={canViewClasses}
      canViewGuardians={canViewGuardians}
      canViewLedger={canViewLedger}
      canViewPayments={canViewPayments}
      canViewSessions={canViewSessions}
      careCard={
        canViewCare ? (
          <Suspense fallback={<p className="text-secondary text-text-muted">Đang tải chăm sóc học viên…</p>}>
            <StudentCareDashboardCard dashboard={careDashboard} studentId={studentId} />
          </Suspense>
        ) : null
      }
      careTaskCount={careDashboard?.total ?? null}
      detail={detail}
      directoryHref={directoryHref}
      editHref={editHref}
      enrollmentUiModel={enrollmentUiModel}
      initialTab={requestedTab}
      ledgerSummary={ledgerSummary}
      payments={payments}
      tuitionProfile={tuitionProfile}
      upcomingSession={upcomingSession}
      zaloGroupCard={<StudentZaloGroupCard canUpdate={canUpdateStudent} studentId={detail.id} studentName={detail.fullName} />}
    />
  );
}
