import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * One settings section (design 09a): 18/600 title and 13px help in a header
 * with a hairline under it, then the fields. Presentation only, built from the
 * ui/card primitives (16px side padding on phones, 20px from sm).
 */
export function SettingsCard({
  children,
  className,
  description,
  title,
}: {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  title: string;
}) {
  return (
    <Card className={cn("min-w-0 shadow-[var(--panel-shadow)]", className)}>
      <CardHeader className="max-sm:px-4">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {description ? <p className="mt-0.5 text-secondary text-text-muted">{description}</p> : null}
        </div>
      </CardHeader>
      <CardContent className="max-sm:p-4">{children}</CardContent>
    </Card>
  );
}
