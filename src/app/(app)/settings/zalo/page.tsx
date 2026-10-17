import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getCenterDisplayName, getGradingRankBands, getSystemSettings } from "@/features/settings/system-settings-data";
import { ZaloMessageSettings } from "@/features/settings/zalo-message-settings";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function ZaloMessageSettingsPage() {
  const permissions = await getCachedDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("settings.view")) return <PermissionDeniedState title="Không có quyền xem cài đặt" description="Yêu cầu quyền settings.view." />;
  const [settings, bands, centerName] = await Promise.all([getSystemSettings(), getGradingRankBands(), getCenterDisplayName()]);
  return (
    <ZaloMessageSettings
      bands={bands}
      canManage={permissions.permissions.includes("settings.manage")}
      centerName={centerName}
      initialFooter={settings["zalo.comment_footer"]}
      initialTemplate={settings["zalo.comment_template"]}
    />
  );
}
