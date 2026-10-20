import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { AiGradingSettingsPanel } from "@/features/ai-grading/components/ai-grading-settings";
import { getAiGradingOverview } from "@/features/ai-grading/overview-data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

// Saving (or "Chạy lại ngay") starts the worker in after(), which runs for this page's maxDuration.
export const maxDuration = 300;

export default async function AiGradingSettingsPage() {
  const permissions = await getCachedDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("settings.view")) {
    return <PermissionDeniedState description="Yêu cầu quyền settings.view." title="Không có quyền xem cài đặt" />;
  }
  const overview = await getAiGradingOverview();
  if (!overview.ok) return <ErrorState description={overview.error} title="Không tải được cài đặt chấm bài AI" />;
  return (
    <AiGradingSettingsPanel
      apiKeyConfigured={overview.apiKeyConfigured}
      canManage={permissions.permissions.includes("settings.manage")}
      cronConfigured={overview.cronConfigured}
      overview={overview.data}
    />
  );
}
