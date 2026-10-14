import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getTuitionPeriodReadiness, loadTuitionPeriods } from "@/features/tuition/data";
import { canReadTuitionPayments } from "@/features/tuition/period-summary";
import { getTuitionPeriodSummaries } from "@/features/tuition/period-summary-data";
import { TuitionPeriodDirectory } from "@/features/tuition/tuition-period-directory";
import { getVietnamToday } from "@/lib/datetime";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

export default async function TuitionPeriodsPage() {
  const permissionResult = await getCachedDatabasePermissions();
  if (!permissionResult.ok || !permissionResult.permissions.includes("tuition_periods.view")) return <PermissionDeniedState title="Không có quyền xem kỳ thu học phí" description={permissionDeniedDescription("tuition_periods.view")} />;
  const permissions = permissionResult.permissions;
  const loaded = await loadTuitionPeriods();
  const periods = loaded ?? [];
  const [readiness, summaries] = await Promise.all([
    Promise.all(periods.filter((period) => period.status === "draft").map(async (period) => ({ id: period.id, ...await getTuitionPeriodReadiness(period) }))),
    getTuitionPeriodSummaries(periods, { canViewPayments: canReadTuitionPayments(permissions), today: getVietnamToday() }),
  ]);
  return (
    <TuitionPeriodDirectory
      canLock={permissions.includes("tuition_periods.lock")}
      canManage={permissions.includes("tuition_periods.manage")}
      canManageTemplates={permissions.includes("settings.receipts.manage")}
      loadError={loaded === null}
      periods={periods}
      previewByPeriod={Object.fromEntries(readiness.map(item => [item.id, item.rows]))}
      summaries={summaries}
      systemBlockersByPeriod={Object.fromEntries(readiness.map(item => [item.id, item.systemBlockers]))}
    />
  );
}
