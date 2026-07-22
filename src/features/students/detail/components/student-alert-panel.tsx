import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { alertSeverityMeta } from "@/features/students/detail/helpers";
import type { StudentAlert } from "@/features/students/detail/types";

interface StudentAlertPanelProps {
  alerts: StudentAlert[];
  onMockAction: (label: string) => void;
}

export function StudentAlertPanel({
  alerts,
  onMockAction,
}: StudentAlertPanelProps) {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <section className="grid min-w-0 gap-3">
      {alerts.map((alert) => {
        const meta = alertSeverityMeta[alert.severity];

        return (
          <div
            className="min-w-0 rounded-lg border border-warning-border bg-warning-bg p-4"
            key={alert.id}
          >
            <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={meta.tone}>Mức độ: {meta.label}</Badge>
                  <h2 className="text-card-title font-semibold text-ink">
                    {alert.title}
                  </h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-ink">
                  {alert.description}
                </p>
              </div>
              <Button
                className="min-h-11 w-full md:w-auto"
                onClick={() => onMockAction(alert.actionLabel)}
                variant="outline"
              >
                {alert.actionLabel}
              </Button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
