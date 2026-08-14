import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { PaymentRequestCreateForm } from "@/features/finance/components/payment-request-create-form";
import { getPaymentRequestCreationOptions } from "@/features/finance/payment-request-create-data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function NewPaymentRequestPage() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền tạo yêu cầu thanh toán."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (
    !permissionResult.permissions.includes("payments.create_request") &&
    !permissionResult.permissions.includes("payments.manage")
  ) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền payments.create_request."
        title="Không có quyền tạo yêu cầu thanh toán"
      />
    );
  }

  if (!permissionResult.permissions.includes("students.view")) {
    return (
      <PermissionDeniedState
        description="Tài khoản cần quyền students.view để chọn học viên và phụ huynh chính."
        title="Không có quyền xem học viên"
      />
    );
  }

  const optionsResult = await getPaymentRequestCreationOptions();
  if (!optionsResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được học viên đủ điều kiện tạo yêu cầu thanh toán."
        title="Không tải được danh sách học viên"
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const accountChecks = await Promise.all([
    supabase.rpc("get_effective_sepay_receiving_account", { p_purpose: "new_enrollment" }),
    supabase.rpc("get_effective_sepay_receiving_account", { p_purpose: "renewal" }),
  ]);
  const isPaymentConfigured = accountChecks.every(
    ({ data, error }) => !error && Array.isArray(data) && data.length === 1,
  );

  return (
    <PaymentRequestCreateForm
      isPaymentConfigured={isPaymentConfigured}
      students={optionsResult.data}
    />
  );
}
