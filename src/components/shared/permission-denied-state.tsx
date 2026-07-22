interface PermissionDeniedStateProps {
  title?: string;
  description?: string;
}

export function PermissionDeniedState({
  title = "Bạn không có quyền truy cập",
  description = "Tài khoản hiện tại chưa có quyền xem màn hình này. Vui lòng liên hệ quản trị viên để kiểm tra phân quyền.",
}: PermissionDeniedStateProps) {
  return (
    <div className="rounded-lg border border-warning-border bg-warning-bg p-5 text-warning">
      <h1 className="text-section font-semibold">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-ink">
        {description}
      </p>
    </div>
  );
}
