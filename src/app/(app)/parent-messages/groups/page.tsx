import Link from "next/link";

import { PageHeader } from "@/components/patterns/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getButtonClassName } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ZaloConnectionStatusCard } from "@/features/parent-messages/components/zalo-connection-status";
import { ZaloGroupBulkLinker } from "@/features/parent-messages/components/zalo-group-bulk-linker";
import { getZaloGroupLinkWorkspace } from "@/features/parent-messages/zalo-group-link-data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedDescription } from "@/lib/permissions/labels";

// Reads every group of the center nick from ZaloCRM (100 per call, 15 s timeout each).
export const maxDuration = 60;

export default async function ZaloGroupLinkPage() {
  const permissionResult = await getCachedDatabasePermissions();
  if (!permissionResult.ok) {
    return <ErrorState description="Hệ thống chưa tải được quyền truy cập." title="Không tải được quyền truy cập" />;
  }
  for (const code of ["students.view", "students.update"] as const) {
    if (!permissionResult.permissions.includes(code)) {
      return <PermissionDeniedState description={permissionDeniedDescription(code)} title="Không có quyền liên kết nhóm Zalo" />;
    }
  }

  const canViewGuardians = permissionResult.permissions.includes("guardians.view");
  const workspace = await getZaloGroupLinkWorkspace({ includeGuardianDetails: canViewGuardians });
  if (!workspace.ok) {
    return <ErrorState description={workspace.error} title="Không tải được dữ liệu liên kết" />;
  }
  const { matches, status, students } = workspace.data;
  const groupsLoaded = status.groupsTotal !== null;

  return (
    <div className="grid min-w-0 gap-5">
      <PageHeader
        actions={
          <Link className={getButtonClassName({ size: "md", variant: "outline" })} href="/parent-messages">
            Hàng đợi tin nhắn
          </Link>
        }
        title="Liên kết nhóm Zalo sổ liên lạc"
      >
        <p className="mt-1 text-secondary text-text-muted">
          Mỗi học sinh đang học cần một nhóm Zalo sổ liên lạc trên nick trung tâm. ERP lưu mã nhóm (không đổi khi nhóm đổi tên) để gửi tin
          vắng mặt và nhận xét cuối buổi qua ZaloCRM.
        </p>
      </PageHeader>

      <ZaloConnectionStatusCard status={status} />

      {groupsLoaded ? (
        <ZaloGroupBulkLinker centerAccountId={status.centerAccountId} matches={matches} showGuardians={canViewGuardians} students={students} />
      ) : (
        <Card>
          <CardContent>
            <EmptyState
              description={`Bảng gợi ý nhóm cho ${students.length} học sinh chưa liên kết hiện ra khi các bước kết nối ở trên đã xong.`}
              title="Chưa có gợi ý nhóm"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
