import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getCurrentAuthUser } from "@/features/auth/current-user";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

interface AuthenticatedAppShellProps {
  children: ReactNode;
}

export async function AuthenticatedAppShell({
  children,
}: AuthenticatedAppShellProps) {
  await connection();

  const authResult = await getCurrentAuthUser();

  if (!authResult.ok) {
    redirect(`/login?error=${authResult.error}`);
  }

  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    if (permissionResult.error.code === "not_authenticated") {
      redirect("/login?error=session_expired");
    }

    return (
      <PermissionDeniedState
        description="Hệ thống chưa tải được quyền truy cập từ cơ sở dữ liệu. Vui lòng tải lại trang hoặc liên hệ quản trị viên."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("app.access")) {
    return (
      <PermissionDeniedState
        description="Tài khoản đã đăng nhập nhưng chưa được cấp quyền app.access."
        title="Tài khoản chưa được phép truy cập hệ thống"
      />
    );
  }

  return (
    <AppShell
      authUser={authResult.user}
      permissions={permissionResult.permissions}
    >
      {children}
    </AppShell>
  );
}
