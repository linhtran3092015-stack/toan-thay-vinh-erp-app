import { PageHeader } from "@/components/patterns/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { loadTuitionTemplatePageData } from "@/features/tuition/receipt-template-data";
import { TuitionTemplateManagement } from "@/features/tuition/template-management";
import { summarizeTemplateUsage, toTuitionTemplateVersions } from "@/features/tuition/receipt-template-models";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

/**
 * Mẫu Phiếu học phí (design 15b): versions newest first (the lock snapshots
 * the latest one), the publisher's name where RLS shows it, and which periods
 * use the current version. Periods are read only with `tuition_periods.view`;
 * without it, or when that read fails, the usage line is left out.
 */
export default async function TuitionTemplatesPage() {
  const permissions = await getCachedDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("settings.receipts.manage")) {
    return <PermissionDeniedState description="Yêu cầu quyền settings.receipts.manage." title="Không có quyền quản lý mẫu" />;
  }

  const { periods, versions } = await loadTuitionTemplatePageData({
    canReadPeriods: permissions.permissions.includes("tuition_periods.view"),
  });
  if (!versions) {
    return (
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
        <PageHeader title="Mẫu Phiếu học phí" />
        <ErrorState
          description="Chưa tải được các phiên bản mẫu. Tải lại trang để thử lại; mẫu đang dùng không bị thay đổi."
          title="Không tải được mẫu Phiếu học phí"
        />
      </div>
    );
  }

  const models = toTuitionTemplateVersions(versions);
  return (
    <TuitionTemplateManagement
      usage={periods ? summarizeTemplateUsage(periods, models[0]?.id ?? null) : null}
      versions={models}
    />
  );
}
