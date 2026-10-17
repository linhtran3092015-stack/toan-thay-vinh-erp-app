import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { FinanceOrdersPage } from "@/features/finance/components/finance-orders-page";
import { getFinanceOrdersDashboardResult } from "@/features/finance/data";
import { FINANCE_ORDERS_ACCESS } from "@/features/finance/finance-orders-models";
import { parseFinanceOrdersFilters } from "@/features/finance/finance-orders-url-state";
import { getVietnamToday } from "@/lib/datetime";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

interface FinanceOrdersRouteProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FinanceOrdersRoute({ searchParams }: FinanceOrdersRouteProps) {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return <ErrorState description="Hệ thống chưa tải được quyền truy cập Đơn hàng." title="Không tải được quyền truy cập" />;
  }

  if (!permissionResult.permissions.includes(FINANCE_ORDERS_ACCESS.permission)) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription(FINANCE_ORDERS_ACCESS.permission)}
        title={FINANCE_ORDERS_ACCESS.deniedTitle}
      />
    );
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

  // Extra props come from what the route already loaded (permission codes, the clock); no new read.
  return (
    <FinanceOrdersPage
      canReview={permissionResult.permissions.includes("payments.manage")}
      canViewStudents={permissionResult.permissions.includes("students.view")}
      dashboard={dashboardResult.data}
      filters={filters}
      today={getVietnamToday()}
    />
  );
}
