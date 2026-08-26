import { ErrorState } from "@/components/shared/error-state";
import {
  getCurrentOwnerStatus,
  getSettingsPermissionMatrix,
} from "@/features/settings/data";
import { PermissionMatrixPage } from "@/features/settings/permission-matrix-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function SettingsPermissionsRoute() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập cài đặt phân quyền."
        title="Không tải được quyền truy cập"
      />
    );
  }

  const [matrixResult, ownerStatus] = await Promise.all([
    getSettingsPermissionMatrix(),
    getCurrentOwnerStatus(),
  ]);

  if (!matrixResult.ok) {
    return (
      <ErrorState
        description={matrixResult.error.message}
        title="Không tải được ma trận quyền"
      />
    );
  }

  if (!ownerStatus.ok) {
    return (
      <ErrorState
        description={ownerStatus.error}
        title="Không xác minh được quyền Owner"
      />
    );
  }

  return (
    <PermissionMatrixPage
      canManage={ownerStatus.isOwner}
      matrix={matrixResult.data}
    />
  );
}
