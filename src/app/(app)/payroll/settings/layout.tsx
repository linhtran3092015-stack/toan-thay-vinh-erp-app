import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, LayoutTemplate } from "lucide-react";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function PayrollSettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập cài đặt bảng lương."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("payroll.template.manage")) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền payroll.template.manage để quản lý mẫu phiếu lương."
        title="Không có quyền truy cập"
      />
    );
  }

  return (
    <div className="grid min-w-0 gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-hairline pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-ink-muted">
            <Link
              className="inline-flex items-center gap-1 hover:text-primary transition-colors"
              href="/payroll"
            >
              <ArrowLeft className="size-3.5" />
              Bảng lương
            </Link>
            <span>/</span>
            <span>Cấu hình</span>
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">
            Cấu hình Mẫu Phiếu Lương
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-muted">
            Tùy biến giao diện, bố cục, màu sắc và các thành phần hiển thị trên phiếu lương nhân sự mà không cần lập trình.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-base px-3 py-2 text-xs font-medium text-ink hover:bg-surface-subtle transition-colors"
            href="/payroll"
          >
            <FileSpreadsheet className="size-3.5 text-ink-muted" />
            Về bảng lương
          </Link>
          <Link
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-hover transition-colors shadow-sm"
            href="/payroll/settings/payslip-templates"
          >
            <LayoutTemplate className="size-3.5" />
            Danh sách mẫu
          </Link>
        </div>
      </header>

      {children}
    </div>
  );
}
