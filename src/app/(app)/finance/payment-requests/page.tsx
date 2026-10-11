import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getPaymentRequestsResult } from "@/features/finance/data";
import { PaymentRequestDirectory } from "@/features/finance/payment-request-directory";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
export default async function PaymentRequestsPage() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập yêu cầu thanh toán."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (
    !permissionResult.permissions.includes("payments.view") &&
    !permissionResult.permissions.includes("payments.manage")
  ) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("payments.view")}
        title="Không có quyền xem yêu cầu thanh toán"
      />
    );
  }

  const requestsResult = await getPaymentRequestsResult();
  if (!requestsResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được danh sách yêu cầu nạp học phí. Vui lòng thử lại sau."
        title="Không tải được yêu cầu thanh toán"
      />
    );
  }

  return (
    <PaymentRequestDirectory
      canCancelPaymentRequests={permissionResult.permissions.includes("payments.manage")}
      canCreatePaymentRequests={
        permissionResult.permissions.includes("payments.create_request") ||
        permissionResult.permissions.includes("payments.manage")
      }
      items={requestsResult.data}
    />
  );
}
