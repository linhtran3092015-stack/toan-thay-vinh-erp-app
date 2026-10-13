import type { ReactNode, RefObject } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BulkActionBarProps {
  /** Rendered only while something is selected. */
  selectedCount: number;
  /** Noun after the count, e.g. "học sinh". */
  subject: string;
  /** 32px action buttons (44px touch targets below md); use `variant="danger-outline"` for destructive ones. */
  children?: ReactNode;
  className?: string;
  /**
   * Height classes for the action buttons. Default: 44px touch targets below md,
   * 32px from md. A page whose layout switches by container width passes
   * container variants so the bar matches the list or table it controls.
   */
  actionSizeClassName?: string;
  onClear: () => void;
  /**
   * Candidates for focus when "Bỏ chọn" removes the bar, so keyboard users keep their place.
   * The first one that is rendered wins (layouts hide some controls with CSS).
   */
  returnFocusRefs?: ReadonlyArray<RefObject<HTMLElement | null>>;
}

/**
 * Selection bar (design 06): soft primary surface, "Đã chọn n", feature
 * actions, "Bỏ chọn" as ghost. The bar never decides which actions exist.
 */
export function BulkActionBar({
  actionSizeClassName = "max-md:[&>button]:h-11 md:[&>button]:h-8",
  children,
  className,
  onClear,
  returnFocusRefs,
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
      <div className={cn("ml-auto flex flex-wrap items-center gap-2 [&>button]:text-[13px]/[18px]", actionSizeClassName)}>
        {children}
        <Button
          onClick={() => {
            const candidates = (returnFocusRefs ?? [])
              .map((ref) => ref.current)
              .filter((element): element is HTMLElement => element !== null && element.isConnected && (element.checkVisibility?.() ?? true));
            // focus() on a node hidden by CSS does nothing, so move on until one takes
            // focus (covers browsers without checkVisibility, e.g. Safari before 17.4).
            for (const element of candidates) {
              element.focus();
              if (document.activeElement === element) break;
            }
            onClear();
          }}
          size="sm"
          variant="ghost"
        >
          Bỏ chọn
        </Button>
      </div>
    </div>
  );
}
