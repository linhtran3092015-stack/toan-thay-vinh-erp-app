import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { ClassDetailPage } from "@/features/classes/class-detail-page";
import { getClassDirectoryQuery } from "@/features/classes/class-directory-url-state";
import { getClassDetail } from "@/features/classes/data";
import { getClassDetailWorkspace, getClassEnrollmentCandidates } from "@/features/classes/detail/class-detail-data";
import { getClassTuitionPeriods, getClassTuitionView } from "@/features/classes/detail/class-tuition-data";
import { CLASS_TUITION_PERMISSIONS, pickDefaultTuitionPeriod } from "@/features/classes/detail/class-tuition-models";
import type { ClassDetailTuition } from "@/features/classes/class-detail-page";
import { getTransferClassOptions } from "@/features/students/enrollment/student-enrollment-data";
import { getVietnamTime, getVietnamToday } from "@/lib/datetime";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
interface ClassDetailRouteProps {
  params: Promise<{
    classId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function ClassDetailRoute({
  params,
  searchParams,
}: ClassDetailRouteProps) {
  const { classId } = await params;
  const resolvedSearchParams = await searchParams;
  const directoryQuery = getClassDirectoryQuery(new URLSearchParams(
    Object.entries(resolvedSearchParams).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : []),
  ));
  const permissionResult =
    await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập lớp học."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (
    !permissionResult.permissions.includes(
      "classes.view",
    )
  ) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("classes.view")}
        title="Không có quyền xem lớp học"
      />
    );
  }

  if (!UUID_PATTERN.test(classId)) {
    return (
      <EmptyState
        description="Mã lớp trên đường dẫn không hợp lệ."
        title="Không tìm thấy lớp học"
      />
    );
  }

  const permissions = permissionResult.permissions;
  const canViewStudentCount = permissions.includes("students.view");

  const canEditClass = permissions.includes("classes.create");
  const canManageSchedule = permissions.includes("classes.manage_schedule");
  const canManageSessions = permissions.includes("sessions.manage");
  // Owner decision: bulk cancel needs both; teaching assistants hold only sessions.manage.
  const canBulkCancelSessions = canManageSessions && canManageSchedule;

  const canViewSessions = permissions.includes("sessions.view");
  const canEnrollStudents =
    canViewStudentCount && permissions.includes("students.manage_status");

  // The workspace does not depend on the class record: start it alongside.
  const canViewPayments = permissions.includes("payments.view");
  const workspacePromise = getClassDetailWorkspace(classId, {
    canViewAttendance: canViewSessions && permissions.includes("attendance.view"),
    canViewLedger: permissions.includes("session_ledger.view"),
    canViewPayments,
    canViewResults: canViewSessions && permissions.includes("results.view"),
    canViewSessions,
    canViewStudents: canViewStudentCount,
  });
  const canTransferStudents = canViewStudentCount && permissions.includes("students.transfer_class");
  const canReserveStudents = canViewStudentCount && permissions.includes("students.reserve");
  const canViewTuition = CLASS_TUITION_PERMISSIONS.every((permission) => permissions.includes(permission));
  // The tuition tab ships its default period; other periods load through an action.
  const tuitionPromise: Promise<ClassDetailTuition | null | undefined> = canViewTuition
    ? getClassTuitionPeriods().then(async (periods) => {
        if (!periods) return null;
        const period = pickDefaultTuitionPeriod(periods, getVietnamToday());
        if (!period) return { initialPeriodId: "", initialView: null, periods };
        return { initialPeriodId: period.id, initialView: await getClassTuitionView(classId, period, { canViewPayments }), periods };
      })
    : Promise.resolve(undefined);

  const detailResult = await getClassDetail(classId, {
    includeStudentCounts: canViewStudentCount,
  });

  if (!detailResult.ok) {
    if (
      detailResult.error.code === "class_not_found"
    ) {
      return (
        <EmptyState
          description="Lớp học có thể không tồn tại hoặc đường dẫn không còn hợp lệ."
          title="Không tìm thấy lớp học"
        />
      );
    }

    return (
      <ErrorState
        description={detailResult.error.message}
        title="Không tải được thông tin lớp học"
      />
    );
  }

  const isActiveClass = detailResult.detail.status === "active";
  const [workspace, enrollmentCandidates, tuition, transferClassOptions] = await Promise.all([
    workspacePromise,
    canEnrollStudents && isActiveClass
      ? getClassEnrollmentCandidates()
      : Promise.resolve(undefined),
    tuitionPromise,
    canTransferStudents && isActiveClass
      ? getTransferClassOptions(classId).catch(() => null)
      : Promise.resolve(undefined),
  ]);
  const initialTab = typeof resolvedSearchParams.tab === "string" ? resolvedSearchParams.tab : undefined;

  return (
    <ClassDetailPage
      canBulkCancelSessions={canBulkCancelSessions}
      canEditClass={canEditClass}
      canEnrollStudents={canEnrollStudents}
      canLockSessions={permissions.includes("sessions.lock")}
      canReserveStudents={canReserveStudents}
      canTransferStudents={canTransferStudents}
      canManageSchedule={canManageSchedule}
      canManageSessions={canManageSessions}
      canViewCare={permissions.includes("student_care.view")}
      canViewStudentCount={canViewStudentCount}
      directoryQuery={directoryQuery}
      detail={detailResult.detail}
      enrollmentCandidates={enrollmentCandidates}
      initialTab={initialTab}
      nowTime={getVietnamTime()}
      today={getVietnamToday()}
      transferClassOptions={transferClassOptions}
      tuition={tuition}
      workspace={workspace}
    />
  );
}
