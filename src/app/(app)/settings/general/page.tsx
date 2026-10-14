import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getSystemSettings } from "@/features/settings/system-settings-data";
import { SystemSettingsForm, SystemSettingsReadOnly } from "@/features/settings/system-settings-form";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function GeneralSettingsPage() {
  const permissions = await getCachedDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("settings.view")) return <PermissionDeniedState title="Không có quyền xem cài đặt" description="Yêu cầu quyền settings.view." />;
  const settings = await getSystemSettings();
  if (!permissions.permissions.includes("settings.manage")) return <SystemSettingsReadOnly settings={settings} />;
  return <SystemSettingsForm initialValues={settings} />;
}
