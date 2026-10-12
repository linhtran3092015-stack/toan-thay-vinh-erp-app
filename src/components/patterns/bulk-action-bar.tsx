import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BulkActionBarProps {
  /** Rendered only while something is selected. */
  selectedCount: number;
  /** Noun after the count, e.g. "học sinh". */
  subject: string;
  /** 32px action buttons; use `variant="danger-outline"` for destructive ones. */
  children?: ReactNode;
  className?: string;
  onClear: () => void;
}

/**
 * Selection bar (design 06): soft primary surface, "Đã chọn n", feature
 * actions, "Bỏ chọn" as ghost. The bar never decides which actions exist.
 */
export function BulkActionBar({
  children,
  className,
  onClear,
  selectedCount,
  subject,
}: BulkActionBarProps) {
  if (selectedCount <= 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-lg border border-action-primary-soft-border bg-action-primary-soft py-2 pl-4 pr-2",
        className,
      )}
      role="region"
      aria-label={`Đã chọn ${selectedCount} ${subject}`}
    >
      <span className="text-body font-semibold text-action-primary">
        Đã chọn {selectedCount} {subject}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2 [&>button]:h-8 [&>button]:text-[13px]/[18px]">
        {children}
        <Button onClick={onClear} size="sm" variant="ghost">
          Bỏ chọn
        </Button>
      </div>
    </div>
  );
}
