import { notFound } from "next/navigation";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { loadFeeNotices } from "@/features/tuition/fee-notice-data";
import { isFeeNoticeItemId } from "@/features/tuition/fee-notice-model";
import { FeeNoticeDetailScreen } from "@/features/tuition/fee-notice-screens";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

interface FeeNoticePageProps {
  params: Promise<{ itemId: string; periodId: string }>;
}

/**
 * One Phiếu học phí (design 15b): staff header, the A5 sheet from the locked
 * snapshot, and the reissue form for `tuition_periods.adjust`. The form is
 * offered only while the notice has no replacement, but stays mounted for
 * adjusters so a reissue's result outlives the revalidated render.
 */
export default async function FeeNoticePage({ params }: FeeNoticePageProps) {
  const { itemId, periodId } = await params;
  const permissions = await getCachedDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("tuition_periods.view")) {
    return <PermissionDeniedState description={permissionDeniedDescription("tuition_periods.view")} title="Không có quyền xem Phiếu học phí" />;
  }
  if (!isFeeNoticeItemId(itemId)) notFound();

  const result = await loadFeeNotices([itemId.toLowerCase()]);
  if (result.status === "error") {
    return (
      <ErrorState
        description="Chưa tải được Phiếu học phí. Tải lại trang để thử lại; phiếu không bị thay đổi."
        title="Không tải được Phiếu học phí"
      />
    );
  }

  const notice = result.notices[0];
  if (!notice || notice.periodId !== periodId.toLowerCase()) notFound();

  return <FeeNoticeDetailScreen canAdjust={permissions.permissions.includes("tuition_periods.adjust")} notice={notice} />;
}
