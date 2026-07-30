import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-hairline-strong bg-surface-1 px-6 py-12 text-center shadow-xs">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary-soft text-xl font-bold text-primary shadow-xs">
        📂
      </div>
      <h2 className="font-display text-lg font-bold tracking-tight text-ink">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
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
