import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getLearningResultsDirectory } from "@/features/learning-results/data";
import { LearningResultsPage } from "@/features/learning-results/learning-results-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
export default async function LearningResultsRoute() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền xem kết quả học tập."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("results.view")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("results.view")}
        title="Không có quyền xem kết quả học tập"
      />
    );
  }

  const directoryResult = await getLearningResultsDirectory();

  if (!directoryResult.ok) {
    return (
      <ErrorState
        description={directoryResult.error.message}
        title="Không tải được kết quả học tập"
      />
    );
  }

  return (
    <LearningResultsPage
      canViewSessions={permissionResult.permissions.includes("sessions.view")}
      canViewStudents={permissionResult.permissions.includes("students.view")}
      items={directoryResult.data}
    />
  );
}
