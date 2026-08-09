import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ResponsiveRecordListProps {
  children: ReactNode;
  className?: string;
  label: string;
}

/** Presentation-only compact list for data that cannot retain usable table columns. */
export function ResponsiveRecordList({
  children,
  className,
  label,
}: ResponsiveRecordListProps) {
  return (
    <div aria-label={label} className={cn("grid gap-3", className)} role="list">
      {children}
    </div>
  );
}
