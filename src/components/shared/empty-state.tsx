import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
  /**
   * `success`: the empty list is the good outcome (e.g. nothing left to
   * reconcile). Only the icon tile changes; the title still says it in words.
   */
  tone?: "default" | "success";
  /** Extra content under the description, e.g. a secondary link. */
  children?: ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Inbox,
  tone = "default",
  children,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface-base px-6 py-12 text-center">
      <div
        className={cn(
          "mb-4 flex h-10 w-10 items-center justify-center rounded-md",
          tone === "success" ? "bg-success-bg text-success" : "bg-action-primary-soft text-action-primary",
        )}
      >
        <Icon aria-hidden="true" size={24} strokeWidth={1.8} />
      </div>
      <h2 className="text-section-title font-semibold text-text-strong">{title}</h2>
      <p className="mt-2 max-w-md text-body text-text-muted">
        {description}
      </p>
      {children ? <div className="mt-4">{children}</div> : null}
      {actionLabel ? (
        <Button className="mt-6" onClick={onAction} size="md" variant="primary">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
