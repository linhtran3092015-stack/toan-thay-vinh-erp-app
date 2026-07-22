"use client";

import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onReset?: () => void;
}

export function ErrorState({
  title = "Không tải được dữ liệu",
  description = "Hệ thống gặp lỗi khi hiển thị màn hình này. Vui lòng thử lại hoặc báo quản trị viên nếu lỗi lặp lại.",
  actionLabel = "Thử lại",
  onReset,
}: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-danger-border bg-danger-bg p-5 text-danger">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-section font-semibold">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink">
            {description}
          </p>
        </div>
        {onReset ? (
          <Button onClick={onReset} size="sm" variant="secondary">
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
