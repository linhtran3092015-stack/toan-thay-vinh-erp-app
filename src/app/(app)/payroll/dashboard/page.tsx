import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getOwnerPayrollDashboardResult } from "@/features/payroll/dashboard/data";
import { OwnerPayrollDashboardPage } from "@/features/payroll/dashboard/payroll-dashboard-page";
import { parsePayrollDashboardMonth, parsePayrollDashboardPosition } from "@/features/payroll/dashboard/url-state";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

interface OwnerPayrollDashboardRouteProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OwnerPayrollDashboardRoute({ searchParams }: OwnerPayrollDashboardRouteProps) {
  const permissionResult = await getCachedDatabasePermissions();
  if (!permissionResult.ok) {
    return <ErrorState description="Hệ thống chưa tải được quyền truy cập Dashboard lương." title="Không tải được quyền truy cập" />;
  }
  if (!permissionResult.permissions.includes("payroll.dashboard.view")) {
    return <PermissionDeniedState description="Dashboard tổng quan quỹ lương chỉ dành cho Chủ trung tâm." title="Không có quyền xem Dashboard lương" />;
  }

  const params = await searchParams;
  const selectedMonth = parsePayrollDashboardMonth(params.month);
  const positionCode = parsePayrollDashboardPosition(params.position);
  const dashboardResult = await getOwnerPayrollDashboardResult({ positionCode, selectedMonth });
  if (!dashboardResult.ok) {
    return <ErrorState description="Không thể tải dữ liệu lương. Vui lòng thử lại." title="Không tải được Dashboard lương" />;
  }

  return <OwnerPayrollDashboardPage dashboard={dashboardResult.data} />;
}
