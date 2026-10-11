import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getGradingCreditsDashboardResult } from "@/features/grading-credits/data";
import { GradingCreditListPage } from "@/features/grading-credits/grading-credit-list-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
export default async function GradingCreditsRoute() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập tín chỉ chấm bài."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("grading_credits.view")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("grading_credits.view")}
        title="Không có quyền xem tín chỉ chấm bài"
      />
    );
  }

  const gradingCreditsResult = await getGradingCreditsDashboardResult();

  if (!gradingCreditsResult.ok) {
    return (
      <ErrorState
        description="Không tải được dữ liệu tín chỉ chấm bài từ hệ thống."
        title="Không tải được tín chỉ chấm bài"
      />
    );
  }

  const canViewAll = permissionResult.permissions.includes(
    "grading_credits.view_all",
  );

  if (gradingCreditsResult.data.length === 0) {
    return (
      <EmptyState
        description="Tín chỉ sẽ được ghi nhận tự động khi một buổi học hoàn thành được khóa và có kết quả đã chấm."
        title="Chưa có tín chỉ chấm bài"
      />
    );
  }

  return (
    <GradingCreditListPage
      canViewAll={canViewAll}
      entries={gradingCreditsResult.data}
    />
  );
}
