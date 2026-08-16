import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getSystemSettings } from "@/features/settings/system-settings-data";
import { SystemSettingsForm } from "@/features/settings/system-settings-form";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function GeneralSettingsPage() {
  const permissions = await getCachedDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("settings.view")) return <PermissionDeniedState title="Không có quyền xem cài đặt" description="Yêu cầu quyền settings.view." />;
  const settings = await getSystemSettings();
  if (!permissions.permissions.includes("settings.manage")) return <div className="rounded-lg border border-hairline bg-surface-1 p-5"><h2 className="font-semibold">Thông tin trung tâm</h2><dl className="mt-4 grid gap-3 text-sm">{Object.entries(settings).map(([key, value]) => <div key={key}><dt className="text-ink-muted">{key}</dt><dd className="font-medium">{String(value) || "—"}</dd></div>)}</dl></div>;
  return <SystemSettingsForm initialValues={settings} />;
}
