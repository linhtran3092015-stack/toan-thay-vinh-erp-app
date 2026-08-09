import { LockKeyhole } from "lucide-react";

interface PermissionDeniedStateProps {
  title?: string;
  description?: string;
}

export function PermissionDeniedState({
  title = "Bạn không có quyền truy cập",
  description = "Tài khoản hiện tại chưa có quyền xem màn hình này. Vui lòng liên hệ quản trị viên để kiểm tra phân quyền.",
}: PermissionDeniedStateProps) {
  return (
    <div className="rounded-lg border border-warning-border bg-warning-bg p-6 text-warning">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-warning/20 text-warning">
          <LockKeyhole aria-hidden="true" size={20} strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-section-title font-semibold text-warning">{title}</h1>
          <p className="mt-1 max-w-3xl text-body text-text-strong">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
