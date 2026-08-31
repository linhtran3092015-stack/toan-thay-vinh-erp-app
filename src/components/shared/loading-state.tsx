import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

interface LoadingStateProps {
  title?: string;
  description?: string;
  rows?: number;
  className?: string;
}

export function LoadingNotice({
  title = "Đang tải dữ liệu",
  description = "Dữ liệu sẽ tự động hiển thị khi tải xong.",
  className,
}: Omit<LoadingStateProps, "rows">) {
  return (
    <div aria-atomic="true" aria-live="polite" className={cn("flex items-center gap-3", className)} role="status">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-action-primary-soft text-action-primary">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 motion-safe:animate-spin" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-strong">{title}</p>
        <p className="mt-1 text-xs leading-5 text-text-muted">{description}</p>
      </div>
    </div>
  );
}

export function LoadingState({
  title = "Đang tải dữ liệu",
  description,
  rows = 4,
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-base p-4 sm:p-5",
        className,
      )}
    >
      <LoadingNotice description={description} title={title} />
      <div aria-hidden="true" className="mt-6 space-y-4 motion-safe:animate-pulse">
        <div className="flex items-center justify-between gap-4 border-b border-border-subtle pb-4">
          <div className="h-9 w-full max-w-72 rounded-md bg-surface-sunken" />
          <div className="h-9 w-20 shrink-0 rounded-md bg-surface-sunken sm:w-28" />
        </div>
        <div className="grid gap-4">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              className="grid grid-cols-[36px_minmax(0,1fr)_64px] items-center gap-3 sm:grid-cols-[40px_minmax(0,1fr)_100px] sm:gap-4"
              key={index}
            >
              <div className="h-9 w-9 rounded-md bg-surface-sunken sm:h-10 sm:w-10" />
              <div className="space-y-2">
                <div className={cn("h-3 rounded bg-surface-sunken", index % 2 === 0 ? "w-3/5" : "w-4/5")} />
                <div className="h-2.5 w-2/5 rounded bg-surface-sunken" />
              </div>
              <div className="h-6 rounded-full bg-surface-sunken" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
