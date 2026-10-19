import { notFound } from "next/navigation";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getSessionBalanceImportBatchDetail } from "@/features/imports/session-balances/queries";
import { SessionBalanceBatchDetailPage } from "@/features/imports/session-balances/session-balance-batch-detail-page";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface SessionBalanceBatchDetailRouteProps {
  params: Promise<{
    batchId: string;
  }>;
}

export default async function SessionBalanceBatchDetailRoute({
  params,
}: SessionBalanceBatchDetailRouteProps) {
  const { batchId } = await params;

  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập đối soát số dư từ cơ sở dữ liệu."
        title="Không tải được quyền truy cập"
      />
    );
  }

  const hasViewPermission = permissionResult.permissions.includes(
    "imports.session_balances",
  );
  const canApprove = permissionResult.permissions.includes(
    "imports.session_balances.approve",
  );

  if (!hasViewPermission && !canApprove) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền xem chi tiết batch import số dư."
        title="Không có quyền truy cập"
      />
    );
  }

  const detail = await getSessionBalanceImportBatchDetail(batchId);

  if (!detail) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <SessionBalanceBatchDetailPage
      canApprove={canApprove}
      canReconcile={hasViewPermission}
      currentUserId={user?.id ?? null}
      detail={detail}
    />
  );
}
