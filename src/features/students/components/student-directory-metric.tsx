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
          className={cn("progress-grow block h-full rounded-full", tone === "success" ? "bg-success" : "bg-warning")}
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
  prefix,
  strong = false,
}: {
  cell: StudentDirectoryMetricCell;
  format: "attendance" | "sessions" | "vnd";
  /** Label rendered inside the toned value (mobile "Nợ"), so label and amount share one colour. */
  prefix?: string;
  /** The mobile metric row bolds every value (design 06c); table cells stay regular. */
  strong?: boolean;
}) {
  if (cell.kind !== "value") {
    return <MetricBlank reason={cell.reason} />;
  }

  const { value } = cell;

  if (format === "attendance") {
    return (
      <span className={cn("tabular-nums", strong && "font-semibold", attendanceTone(value) === "warning" && "font-semibold text-warning")}>
        {value}%
      </span>
    );
  }

  if (format === "sessions") {
    return (
      <span className={cn("tabular-nums", strong && "font-semibold", value < 0 && "font-semibold text-danger")}>
        {formatSignedSessions(value)}
      </span>
    );
  }

  // Design 06: overdue debt is danger, other open debt warning, zero muted (text-muted,
  // not text-subtle, to keep AA contrast) so the rows that owe stand out. "Quá hạn" is
  // spelled out so colour never carries it alone.
  const overdue = value > 0 && cell.overdue === true;

  return (
    <span
      className={cn(
        "tabular-nums",
        strong && "font-semibold",
        value === 0 && "text-text-muted",
        value > 0 && (overdue ? "font-semibold text-danger" : "font-semibold text-warning"),
      )}
    >
      {prefix ? `${prefix} ` : null}
      {formatVnd(value)}
      {overdue ? (
        strong ? (
          <>
            {" "}
            <span className="font-normal">· quá hạn</span>
          </>
        ) : (
          <span className="block text-caption font-normal leading-[14px]">Quá hạn</span>
        )
      ) : null}
    </span>
  );
}
