import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface DataTableFrameProps {
  body: ReactNode;
  caption: string;
  className?: string;
  header: ReactNode;
  tableClassName?: string;
}

/** Presentation-only table framing. Columns and row actions remain feature-owned. */
export function DataTableFrame({
  body,
  caption,
  className,
  header,
  tableClassName,
}: DataTableFrameProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border-subtle bg-surface-base",
        className,
      )}
    >
      <table className={cn("w-full border-separate border-spacing-0 text-left", tableClassName)}>
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-[var(--table-header)] text-table-header text-text-muted">
          {header}
        </thead>
        <tbody className="divide-y divide-border-subtle">{body}</tbody>
      </table>
    </div>
  );
}
