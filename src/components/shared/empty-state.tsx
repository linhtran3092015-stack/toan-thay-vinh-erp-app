import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-hairline bg-surface-1 px-6 py-10 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-pill bg-primary-soft text-sm font-bold text-primary">
        TV
      </div>
      <h2 className="text-section font-semibold text-ink">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-ink-muted">
        {description}
      </p>
      {actionLabel ? (
        <Button className="mt-5" size="sm" variant="secondary">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
