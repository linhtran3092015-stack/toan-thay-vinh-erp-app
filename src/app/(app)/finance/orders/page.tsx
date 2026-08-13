import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { FinanceOrdersPage } from "@/features/finance/components/finance-orders-page";
import { getFinanceOrdersDashboardResult } from "@/features/finance/data";
import { parseFinanceOrdersFilters } from "@/features/finance/finance-orders-url-state";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

interface FinanceOrdersRouteProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FinanceOrdersRoute({ searchParams }: FinanceOrdersRouteProps) {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return <ErrorState description="Hệ thống chưa tải được quyền truy cập Đơn hàng." title="Không tải được quyền truy cập" />;
  }

  if (!permissionResult.permissions.includes("finance.view")) {
    return <PermissionDeniedState description="Tài khoản hiện tại không có quyền finance.view." title="Không có quyền xem Đơn hàng" />;
  }

  const resolvedSearchParams = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const filters = parseFinanceOrdersFilters(params);
  const dashboardResult = await getFinanceOrdersDashboardResult(filters);

  if (!dashboardResult.ok) {
    return <ErrorState description="Hệ thống chưa tải được dữ liệu đơn hàng tài chính. Vui lòng thử lại sau." title="Không tải được Đơn hàng" />;
  }

  return (
    <FinanceOrdersPage
      canReview={permissionResult.permissions.includes("payments.manage")}
      dashboard={dashboardResult.data}
      filters={filters}
    />
  );
}
