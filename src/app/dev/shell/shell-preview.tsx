"use client";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/patterns/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DATABASE_PERMISSION_CODES, type PermissionCode } from "@/lib/permissions/types";

const taPermissions: readonly PermissionCode[] = [
  "app.access",
  "dashboard.view",
  "classes.view",
  "sessions.view",
  "results.view",
  "timekeeping.view",
  "timekeeping.check",
  "payroll.view",
  "notifications.view",
];

/** Owner sees every group; the teaching assistant sees only permitted items. */
export function ShellPreview({ path, role }: { path: string; role: "owner" | "ta" }) {
  const isOwner = role === "owner";
  // Preview only: the real shell receives database permissions.
  const permissions = isOwner
    ? DATABASE_PERMISSION_CODES.filter((code) => code !== "student_care.view")
    : taPermissions;

  return (
    <AppShell
      authUser={{
        displayName: isOwner ? "Nguyễn Văn Vinh" : "Lê Bích Ngọc",
        email: isOwner ? "vinh@example.com" : "ngoc@example.com",
        id: "dev-user",
        initials: isOwner ? "NV" : "LN",
      }}
      canCheckTimekeeping={!isOwner}
      centerDisplayName="Toán Thầy Vinh"
      permissions={permissions}
      previewPathname={path}
      unreadNotificationCount={isOwner ? 4 : 2}
    >
      <div className="flex flex-col gap-6">
        <PageHeader
          actions={
            <>
              <Button variant="secondary">Mẫu thông báo</Button>
              <Button>Tạo kỳ thu tháng 11</Button>
            </>
          }
          context={<Badge tone="info">Đang thu · 74%</Badge>}
          title="Kỳ thu học phí"
        >
          <p className="mt-1 text-secondary text-text-muted">
            Năm học 2026–2027 · 1 kỳ đang thu · 3 giao dịch chờ khớp
          </p>
        </PageHeader>
        <div className="grid h-[480px] place-items-center rounded-lg border border-dashed border-border-strong text-secondary text-text-subtle">
          Vùng làm việc của trang (xem 07 Tài chính)
        </div>
      </div>
    </AppShell>
  );
}
