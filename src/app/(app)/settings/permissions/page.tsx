import { ErrorState } from "@/components/shared/error-state";
import {
  getCurrentOwnerStatus,
  getSettingsPermissionMatrix,
} from "@/features/settings/data";
import { PermissionMatrixPage } from "@/features/settings/permission-matrix-page";

export default async function SettingsPermissionsRoute() {
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
