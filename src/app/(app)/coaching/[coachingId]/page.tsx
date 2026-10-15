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

  const permissions = permissionResult.permissions;
  const canManageLinks = permissions.includes("coaching_links.manage");
  const canViewResponses = permissions.includes("coaching_responses.view");
  const canViewForms = permissions.includes("coaching_forms.view");
  // Forms feed only the link panel's version picker.
  const canLoadForms = canManageLinks && canViewForms;
  // One round of reads: the record no longer waits for its own fetch before the rest start.
  const [detailResult, eventsResult, forms, responses, links, systemSettings] = await Promise.all([
    getCoachingRecordDetailResult(coachingId),
    getCoachingRecordEventsResult(coachingId),
    canLoadForms ? getCoachingForms() : Promise.resolve([]),
    canViewResponses ? getCoachingRecordResponses(coachingId) : Promise.resolve([]),
    canManageLinks ? getCoachingPublicLinks(coachingId) : Promise.resolve([]),
    canManageLinks && permissions.includes("settings.view") ? getSystemSettings() : Promise.resolve(null),
  ]);

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

  if (!eventsResult.ok) {
    return (
      <ErrorState
        description="Không tải được lịch sử của phiếu Coaching."
        title="Không tải được lịch sử Coaching"
      />
    );
  }

  // The form-data loaders return null on any error. Coerced to [] that would read as "empty": no link
  // yet (the create form opens, and issuing silently revokes the parent's real active link), no response,
  // or no published form (the panel would ask to publish one).
  return (
    <CoachingDetailPage
      canManage={permissions.includes("coaching.manage")}
      events={eventsResult.data}
      record={detailResult.data}
      forms={forms ?? []}
      formsUnavailable={forms === null}
      canViewForms={canViewForms}
      responses={responses ?? []}
      responsesUnavailable={responses === null}
      links={links ?? []}
      linksUnavailable={links === null}
      canManageLinks={canManageLinks}
      canViewResponses={canViewResponses}
      defaultPublicLinkExpiryDays={systemSettings?.["coaching.default_public_link_expiry_days"]}
    />
  );
}
