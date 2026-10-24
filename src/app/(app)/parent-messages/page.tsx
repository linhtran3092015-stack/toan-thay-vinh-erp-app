import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { ParentMessageQueue } from "@/features/parent-messages/components/parent-message-queue";
import { getParentMessageQueueResult, type ParentMessageStatus } from "@/features/parent-messages/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedDescription } from "@/lib/permissions/labels";
import { isZaloCrmConfigured } from "@/lib/zalo-crm";

// A long comment goes as up to 3 ZaloCRM calls 1,5 s apart (15 s timeout each).
export const maxDuration = 60;

const statuses = new Set<ParentMessageStatus | "all">(["queued", "sent", "failed", "skipped", "expired", "all"]);

export default async function ParentMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const permissionResult = await getCachedDatabasePermissions();
  if (!permissionResult.ok) {
    return <ErrorState description="Hệ thống chưa tải được quyền truy cập." title="Không tải được quyền truy cập" />;
  }
  const canView = permissionResult.permissions.includes("attendance.view") || permissionResult.permissions.includes("attendance.mark");
  if (!canView) {
    return <PermissionDeniedState description={permissionDeniedDescription("attendance.view")} title="Không có quyền xem tin nhắn phụ huynh" />;
  }

  const params = await searchParams;
  const requested = typeof params.status === "string" ? params.status : "queued";
  const status = statuses.has(requested as ParentMessageStatus | "all") ? (requested as ParentMessageStatus | "all") : "queued";
  const queue = await getParentMessageQueueResult(status);
  if (!queue.ok) {
    return <ErrorState description={queue.error} title="Không tải được hàng đợi" />;
  }

  return (
    <ParentMessageQueue
      canLinkGroups={permissionResult.permissions.includes("students.view") && permissionResult.permissions.includes("students.update")}
      canSend={permissionResult.permissions.includes("attendance.mark")}
      configured={isZaloCrmConfigured()}
      items={queue.data}
      status={status}
    />
  );
}
