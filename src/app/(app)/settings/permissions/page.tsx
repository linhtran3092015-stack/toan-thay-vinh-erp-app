import { ErrorState } from "@/components/shared/error-state";
import { getSettingsPermissionMatrix } from "@/features/settings/data";
import { PermissionMatrixPage } from "@/features/settings/permission-matrix-page";

export default async function SettingsPermissionsRoute() {
  const matrixResult = await getSettingsPermissionMatrix();

  if (!matrixResult.ok) {
    return (
      <ErrorState
        description={matrixResult.error.message}
        title="Không tải được ma trận quyền"
      />
    );
  }

  return <PermissionMatrixPage matrix={matrixResult.data} />;
}
