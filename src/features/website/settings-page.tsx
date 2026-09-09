import { ErrorState } from "@/components/shared/error-state";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { readWebsiteEditor } from "./data";
import { WebsiteEditor } from "./editor";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";

export async function WebsiteSettingsPage({ mode }: { mode: "branding" | "website" }) {
  const permissions = await getCachedDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("settings.view")) return <PermissionDeniedState title="Không có quyền xem cài đặt" description="Tài khoản cần quyền xem cài đặt hệ thống." />;
  const result = await readWebsiteEditor().catch(() => ({ ok: false as const }));
  if (!result.ok) return <ErrorState title="Chưa tải được cài đặt website" description="Hãy tải lại trang hoặc liên hệ quản trị trung tâm nếu lỗi tiếp tục." />;
  return <WebsiteEditor initialSite={result.site} initialVersion={result.version} initiallyPublished={result.published} canManage={permissions.permissions.includes("settings.manage")} mode={mode} />;
}
