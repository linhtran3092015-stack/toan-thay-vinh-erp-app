import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

/** Presentation container. Features provide all filter values and behavior. */
export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <section
      aria-label="Bộ lọc"
      className={cn(
        "rounded-lg border border-border-subtle bg-surface-base p-4",
        className,
      )}
    >
      {children}
    </section>
  );
}
