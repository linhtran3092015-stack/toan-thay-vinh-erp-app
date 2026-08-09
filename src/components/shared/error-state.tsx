"use client";

import { TriangleAlert } from "lucide-react";

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
    <div className="rounded-lg border border-danger-border bg-danger-bg p-6 text-danger" role="alert">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-md bg-danger/15 text-danger">
            <TriangleAlert aria-hidden="true" size={20} strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="text-section-title font-semibold text-danger">{title}</h2>
            <p className="mt-1 max-w-3xl text-body text-text-strong">
              {description}
            </p>
          </div>
        </div>
        {onReset ? (
          <Button onClick={onReset} size="sm" variant="danger">
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
