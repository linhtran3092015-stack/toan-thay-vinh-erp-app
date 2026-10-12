import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  context?: ReactNode;
  title: ReactNode;
}

/** Presentation-only page orientation and action region. */
export function PageHeader({
  actions,
  children,
  className,
  context,
  title,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-start md:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-page-title font-semibold tracking-[-0.01em] text-text-strong">{title}</h1>
          {context}
        </div>
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
