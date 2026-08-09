import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Inbox,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface-base px-6 py-12 text-center">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-action-primary-soft text-action-primary">
        <Icon aria-hidden="true" size={24} strokeWidth={1.8} />
      </div>
      <h2 className="text-section-title font-semibold text-text-strong">{title}</h2>
      <p className="mt-2 max-w-md text-body text-text-muted">
        {description}
      </p>
      {actionLabel ? (
        <Button className="mt-6" onClick={onAction} size="md" variant="primary">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
