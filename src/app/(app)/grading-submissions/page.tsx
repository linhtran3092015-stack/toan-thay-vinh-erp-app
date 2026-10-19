import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { UnmatchedSubmissionsPage } from "@/features/grading-submissions/components/unmatched-submissions-page";
import { getUnmatchedGradingSubmissions } from "@/features/grading-submissions/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

const LIMIT = 200;

export default async function GradingSubmissionsRoute() {
  const permissionResult = await getCachedDatabasePermissions();
  if (!permissionResult.ok) {
    return <ErrorState description="Hệ thống chưa tải được quyền truy cập." title="Không tải được quyền truy cập" />;
  }
  if (!permissionResult.permissions.includes("ai_grading.view")) {
    return <PermissionDeniedState description={permissionDeniedDescription("ai_grading.view")} title="Không có quyền xem bài nộp" />;
  }

  const result = await getUnmatchedGradingSubmissions(LIMIT);
  if (!result.ok) {
    return <ErrorState description={result.error} title="Không tải được bài nộp chưa ghép" />;
  }

  return <UnmatchedSubmissionsPage items={result.data} limit={LIMIT} />;
}
