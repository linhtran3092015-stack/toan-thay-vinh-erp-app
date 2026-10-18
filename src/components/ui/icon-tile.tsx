import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type IconTileTone = "danger" | "warning" | "info" | "success" | "neutral";

/**
 * 24px icon tile on the family's soft surface (HANDOFF §1c: radius 6, lucide
 * 14px, no circle, no gradient). Decorative: the row text carries the meaning,
 * so the tile is hidden from assistive technology.
 */
export function IconTile({ children, className, tone }: { children: ReactNode; className?: string; tone: IconTileTone }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid h-6 w-6 shrink-0 place-items-center rounded-sm [&>svg]:h-3.5 [&>svg]:w-3.5",
        tone === "danger"
          ? "bg-danger-bg text-danger"
          : tone === "warning"
            ? "bg-warning-bg text-warning"
            : tone === "info"
              ? "bg-info-bg text-info"
              : tone === "success"
                ? "bg-success-bg text-success"
                : "bg-neutral-bg text-neutral",
        className,
      )}
    >
      {children}
    </span>
  );
}
