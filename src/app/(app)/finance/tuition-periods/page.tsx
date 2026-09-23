import { PageHeader } from "@/components/patterns/page-header";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getTuitionPeriodReadiness, getTuitionPeriods } from "@/features/tuition/data";
import { TuitionPeriodDirectory } from "@/features/tuition/tuition-period-directory";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function TuitionPeriodsPage() {
  const permissionResult = await getCachedDatabasePermissions();
  if (!permissionResult.ok || !permissionResult.permissions.includes("tuition_periods.view")) return <PermissionDeniedState title="Không có quyền xem kỳ thu học phí" description="Tài khoản hiện tại không có quyền tuition_periods.view." />;
  const periods = await getTuitionPeriods();
  const readiness = await Promise.all(periods.filter((period) => period.status === "draft").map(async (period) => ({ id: period.id, ...await getTuitionPeriodReadiness(period) })));
  return <div className="grid min-w-0 gap-5"><PageHeader title="Kỳ thu học phí"><p className="mt-1 text-secondary text-text-muted">Tạo kỳ, kiểm tra học phí từng học viên, rồi khóa kỳ để tạo hàng loạt phiếu và yêu cầu thanh toán.</p></PageHeader><TuitionPeriodDirectory canLock={permissionResult.permissions.includes("tuition_periods.lock")} canManage={permissionResult.permissions.includes("tuition_periods.manage")} periods={periods} previewByPeriod={Object.fromEntries(readiness.map(item => [item.id, item.rows]))} systemBlockersByPeriod={Object.fromEntries(readiness.map(item => [item.id, item.systemBlockers]))} /></div>;
}
