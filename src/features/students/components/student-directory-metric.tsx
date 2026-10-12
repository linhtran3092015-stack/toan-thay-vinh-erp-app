import type { StudentDirectoryMetricCell } from "@/features/students/student-directory-metrics";
import { formatNumber, formatVnd } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "—" with its reason: shown on hover, read by screen readers instead of the dash. */
function MetricBlank({ reason }: { reason: string }) {
  return (
    <span className="text-text-muted" title={reason}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{reason}</span>
    </span>
  );
}

/** Below 80% needs a look (design 06 shows 71% in warning). */
function attendanceTone(rate: number) {
  return rate >= 80 ? "success" : "warning";
}

export function formatSignedSessions(value: number): string {
  return value < 0 ? `−${formatNumber(Math.abs(value))}` : formatNumber(value);
}

/** Table cell: thin bar + percent. */
export function AttendanceRateBar({ cell }: { cell: StudentDirectoryMetricCell }) {
  if (cell.kind !== "value") {
    return <MetricBlank reason={cell.reason} />;
  }

  const tone = attendanceTone(cell.value);

  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-border-row">
        <span
          className={cn("block h-full rounded-full", tone === "success" ? "bg-success" : "bg-warning")}
          style={{ width: `${cell.value}%` }}
        />
      </span>
      <span className={cn("w-10 text-right text-secondary tabular-nums", tone === "warning" && "font-semibold text-warning")}>
        {cell.value}%
      </span>
    </span>
  );
}

/** Plain value for the table's numeric columns and the mobile metric row. */
export function StudentMetricValue({
  cell,
  format,
}: {
  cell: StudentDirectoryMetricCell;
  format: "attendance" | "sessions" | "vnd";
}) {
  if (cell.kind !== "value") {
    return <MetricBlank reason={cell.reason} />;
  }

  const { value } = cell;

  if (format === "attendance") {
    return (
      <span className={cn("tabular-nums", attendanceTone(value) === "warning" && "font-semibold text-warning")}>
        {value}%
      </span>
    );
  }

  const alarming = format === "sessions" ? value < 0 : value > 0;

  return (
    <span className={cn("tabular-nums", alarming && "font-semibold text-danger")}>
      {format === "sessions" ? formatSignedSessions(value) : formatVnd(value)}
    </span>
  );
}
