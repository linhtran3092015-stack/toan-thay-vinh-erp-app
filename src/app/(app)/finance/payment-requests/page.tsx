import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getPaymentRequestsResult } from "@/features/finance/data";
import { PaymentRequestDirectory } from "@/features/finance/payment-request-directory";
import { PAYMENT_REQUESTS_DENIED_TITLE } from "@/features/finance/payment-request-directory-models";
import { getVietnamToday } from "@/lib/datetime";
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

  const permissions = permissionResult.permissions;

  if (!permissions.includes("payments.view") && !permissions.includes("payments.manage")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("payments.view")}
        title={PAYMENT_REQUESTS_DENIED_TITLE}
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

  const canViewStudents = permissions.includes("students.view");

  return (
    <PaymentRequestDirectory
      canCancelPaymentRequests={permissions.includes("payments.manage")}
      // The create page also refuses without students.view, so the button follows it.
      canCreatePaymentRequests={
        (permissions.includes("payments.create_request") || permissions.includes("payments.manage")) && canViewStudents
      }
      canViewStudents={canViewStudents}
      items={requestsResult.data}
      now={new Date().toISOString()}
      today={getVietnamToday()}
    />
  );
}
