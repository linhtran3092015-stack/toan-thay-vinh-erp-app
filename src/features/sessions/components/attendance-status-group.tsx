import {
  SESSION_ATTENDANCE_STATUSES,
  type SessionAttendanceStatus,
  type SessionNotebookStatus,
} from "@/features/sessions/detail-read-models";
import { cn } from "@/lib/utils";

export const attendanceStatusOrder: readonly SessionAttendanceStatus[] = SESSION_ATTENDANCE_STATUSES;

export const attendanceStatusLabels: Record<SessionAttendanceStatus, string> = {
  additional_study: "Học thêm",
  excused_absence: "Vắng có phép",
  present: "Có mặt",
  unexcused_absence: "Vắng không phép",
};

export const notebookStatusLabels: Record<SessionNotebookStatus, string> = {
  not_required: "Không yêu cầu",
  not_submitted: "Chưa nộp",
  submitted: "Đã nộp",
};

/** Scores are 0–10 stored as numeric(4,2) and entered in 0.01 steps, so keep two decimals. */
const scoreFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

/** Formats a 0–10 score; `emptyLabel` replaces a missing score (defaults to "—"). */
export function formatScore(value: number | null, emptyLabel = "—"): string {
  return value === null ? emptyLabel : scoreFormatter.format(value);
}

/** Compact labels for the 4-up mobile grid. */
const compactLabels: Record<SessionAttendanceStatus, string> = {
  additional_study: "Học thêm",
  excused_absence: "Vắng có phép",
  present: "Có mặt",
  unexcused_absence: "Vắng k. phép",
};

export const attendanceStatusTones: Record<SessionAttendanceStatus, "success" | "warning" | "info" | "danger"> = {
  additional_study: "warning",
  excused_absence: "info",
  present: "success",
  unexcused_absence: "danger",
};

const selectedClassName: Record<SessionAttendanceStatus, string> = {
  additional_study: "border-warning bg-warning-bg text-warning",
  excused_absence: "border-info bg-info-bg text-info",
  present: "border-success bg-success-bg text-success",
  unexcused_absence: "border-danger bg-danger-bg text-danger",
};

interface AttendanceStatusGroupProps {
  /** Accessible name for each button, built by the feature (e.g. "Ghi Có mặt cho học viên"). */
  buttonLabel: (status: SessionAttendanceStatus, label: string) => string;
  className?: string;
  disabled?: boolean;
  /** 32px joined segment (table) or 44px 4-up grid (touch). */
  layout?: "segment" | "grid";
  label: string;
  onSelect: (status: SessionAttendanceStatus) => void;
  value: SessionAttendanceStatus | null;
}

/**
 * Four attendance statuses from the code vocabulary, always with text; the
 * selected one takes its family's soft surface and strong border. Buttons
 * carry `aria-pressed` so the feature's per-tap save model stays intact.
 */
export function AttendanceStatusGroup({
  buttonLabel,
  className,
  disabled = false,
  layout = "segment",
  label,
  onSelect,
  value,
}: AttendanceStatusGroupProps) {
  const isGrid = layout === "grid";

  return (
    <div
      aria-label={label}
      className={cn(
        isGrid
          ? "grid grid-cols-4 gap-1.5"
          : "inline-flex overflow-hidden rounded-md border border-border-strong",
        className,
      )}
      role="group"
    >
      {attendanceStatusOrder.map((status) => {
        const isSelected = value === status;
        const text = isGrid ? compactLabels[status] : attendanceStatusLabels[status];

        return (
          <button
            aria-label={buttonLabel(status, attendanceStatusLabels[status])}
            aria-pressed={isSelected}
            className={cn(
              "focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus disabled:cursor-not-allowed",
              isGrid
                ? "h-11 min-w-0 whitespace-normal rounded-md border px-1 text-caption leading-[14px]"
                : "h-8 whitespace-nowrap border-r border-border-strong px-3 text-secondary last:border-r-0",
              isSelected
                ? cn("font-semibold", selectedClassName[status], !isGrid && "border-r-border-strong")
                : cn(
                    "bg-surface-base font-medium text-text-default hover:bg-interactive-hover",
                    isGrid && "border-border-strong",
                    disabled && "text-text-disabled",
                  ),
            )}
            disabled={disabled}
            key={status}
            onClick={() => onSelect(status)}
            type="button"
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}
