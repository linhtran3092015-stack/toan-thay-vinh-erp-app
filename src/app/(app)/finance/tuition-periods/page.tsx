import { PageHeader } from "@/components/patterns/page-header";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getTuitionPeriodPreview, getTuitionPeriodSystemBlockers, getTuitionPeriods } from "@/features/tuition/data";
import { TuitionPeriodDirectory } from "@/features/tuition/tuition-period-directory";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function TuitionPeriodsPage() {
  const permissionResult = await getCachedDatabasePermissions();
  if (!permissionResult.ok || !permissionResult.permissions.includes("tuition_periods.view")) return <PermissionDeniedState title="Không có quyền xem kỳ thu học phí" description="Tài khoản hiện tại không có quyền tuition_periods.view." />;
  const periods = await getTuitionPeriods();
  const previews = await Promise.all(periods.filter((period) => period.status === "draft").map(async (period) => [period.id, await getTuitionPeriodPreview(period.id)] as const));
  const systemBlockers = await Promise.all(periods.filter((period) => period.status === "draft").map(async (period) => [period.id, await getTuitionPeriodSystemBlockers(period)] as const));
  return <div className="grid min-w-0 gap-5"><PageHeader title="Kỳ thu học phí"><p className="mt-1 text-secondary text-text-muted">Tạo kỳ, xem dữ liệu materialized, xử lý blocker rồi khóa thành Phiếu học phí bất biến.</p></PageHeader><TuitionPeriodDirectory canLock={permissionResult.permissions.includes("tuition_periods.lock")} canManage={permissionResult.permissions.includes("tuition_periods.manage")} periods={periods} previewByPeriod={Object.fromEntries(previews)} systemBlockersByPeriod={Object.fromEntries(systemBlockers)} /></div>;
}
