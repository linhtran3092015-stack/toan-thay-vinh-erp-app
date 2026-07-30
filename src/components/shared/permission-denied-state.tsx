interface PermissionDeniedStateProps {
  title?: string;
  description?: string;
}

export function PermissionDeniedState({
  title = "Bạn không có quyền truy cập",
  description = "Tài khoản hiện tại chưa có quyền xem màn hình này. Vui lòng liên hệ quản trị viên để kiểm tra phân quyền.",
}: PermissionDeniedStateProps) {
  return (
    <div className="rounded-xl border border-warning-border bg-warning-bg p-6 text-warning shadow-xs">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-warning/20 text-lg font-bold text-warning">
          🔒
        </div>
        <div>
          <h1 className="font-display text-lg font-bold tracking-tight text-warning">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
