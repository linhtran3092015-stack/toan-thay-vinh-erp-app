import { notFound } from "next/navigation";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { CoachingDetailPage } from "@/features/coaching/coaching-detail-page";
import {
  getCoachingRecordDetailResult,
  getCoachingRecordEventsResult,
} from "@/features/coaching/data";
import { getCoachingForms, getCoachingPublicLinks, getCoachingRecordResponses } from "@/features/coaching/coaching-form-data";
import { getSystemSettings } from "@/features/settings/system-settings-data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

import { permissionDeniedDescription } from "@/lib/permissions/labels";
interface CoachingDetailRouteProps {
  params: Promise<{ coachingId: string }>;
}

export default async function CoachingDetailRoute({
  params,
}: CoachingDetailRouteProps) {
  const { coachingId } = await params;
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập Coaching."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("coaching.view")) {
    return (
      <PermissionDeniedState
        description={permissionDeniedDescription("coaching.view")}
        title="Không có quyền xem Coaching"
      />
    );
  }

  const detailResult = await getCoachingRecordDetailResult(coachingId);

  if (!detailResult.ok) {
    return (
      <ErrorState
        description="Không tải được thông tin phiếu Coaching từ hệ thống."
        title="Không tải được phiếu Coaching"
      />
    );
  }

  if (!detailResult.data) {
    notFound();
  }

  const canManageLinks = permissionResult.permissions.includes("coaching_links.manage");
  const [eventsResult, forms, responses, links, systemSettings] = await Promise.all([
    getCoachingRecordEventsResult(coachingId),
    permissionResult.permissions.includes("coaching_forms.view") ? getCoachingForms() : Promise.resolve([]),
    permissionResult.permissions.includes("coaching_responses.view") ? getCoachingRecordResponses(coachingId) : Promise.resolve([]),
    canManageLinks ? getCoachingPublicLinks(coachingId) : Promise.resolve([]),
    canManageLinks && permissionResult.permissions.includes("settings.view") ? getSystemSettings() : Promise.resolve(null),
  ]);

  if (!eventsResult.ok) {
    return (
      <ErrorState
        description="Không tải được lịch sử của phiếu Coaching."
        title="Không tải được lịch sử Coaching"
      />
    );
  }

  return (
    <CoachingDetailPage
      canManage={permissionResult.permissions.includes("coaching.manage")}
      events={eventsResult.data}
      record={detailResult.data}
      forms={forms ?? []}
      responses={responses ?? []}
      links={links ?? []}
      canManageLinks={canManageLinks}
      defaultPublicLinkExpiryDays={systemSettings?.["coaching.default_public_link_expiry_days"]}
    />
  );
}
