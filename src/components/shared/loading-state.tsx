import { cn } from "@/lib/utils";

interface LoadingStateProps {
  title?: string;
  rows?: number;
  className?: string;
}

export function LoadingState({
  title = "Đang tải dữ liệu",
  rows = 4,
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-hairline bg-surface-1 p-5 shadow-card",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="mb-5 h-5 w-48 animate-pulse rounded bg-neutral-bg" />
      <span className="sr-only">{title}</span>
      <div className="grid gap-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            className="grid grid-cols-[44px_1fr_120px] items-center gap-3"
            key={index}
          >
            <div className="h-10 w-10 animate-pulse rounded-pill bg-neutral-bg" />
            <div className="space-y-2">
              <div className="h-3 w-3/5 animate-pulse rounded bg-neutral-bg" />
              <div className="h-3 w-2/5 animate-pulse rounded bg-neutral-bg" />
            </div>
            <div className="h-7 animate-pulse rounded-md bg-neutral-bg" />
          </div>
        ))}
      </div>
    </div>
  );
}
