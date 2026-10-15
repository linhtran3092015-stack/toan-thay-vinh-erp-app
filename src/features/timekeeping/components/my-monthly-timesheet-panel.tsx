"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Calendar,
  MapPin,
  Wifi,
} from "lucide-react";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchMyMonthlyTimesheetAction } from "@/features/timekeeping/timekeeping-admin-actions";
import { TimekeepingAdjustmentRequestDialog } from "@/features/timekeeping/components/timekeeping-adjustment-request-dialog";
import { formatVietnamDate } from "@/features/timekeeping/timekeeping-adjustment-utils";
import type { TimekeepingActionOverrides } from "@/features/timekeeping/timekeeping-action-overrides";
import { getTimekeepingEntryStatusPresentation } from "@/features/timekeeping/timekeeping-entry-presentation";
import {
  formatShortWorkDate,
  formatVietnamClockTime,
} from "@/features/timekeeping/timekeeping-staff-presentation";
import { cn } from "@/lib/utils";
import type {
  TimekeepingAdjustableEntry,
  TimekeepingMonthlyEntry,
} from "@/features/timekeeping/types";

interface MyMonthlyTimesheetPanelProps {
  /** Inert replacements for the /dev/timekeeping preview; real pages pass nothing. */
  actions?: TimekeepingActionOverrides;
  canCheck: boolean;
  initialEntries: readonly TimekeepingMonthlyEntry[];
  initialMonth?: number;
  initialYear?: number;
}

const weekdayNames: Record<number, string> = {
  0: "Chủ Nhật",
  1: "Thứ Hai",
  2: "Thứ Ba",
  3: "Thứ Tư",
  4: "Thứ Năm",
  5: "Thứ Sáu",
  6: "Thứ Bảy",
};

function formatWeekday(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return weekdayNames[date.getUTCDay()] ?? "";
}

function formatMinutesToHours(minutes: number | null): string {
  if (minutes === null || minutes < 0) return "—";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} phút`;
  if (remainingMinutes === 0) return `${hours} giờ`;
  return `${hours}h ${remainingMinutes}m`;
}

function formatTimeOnly(isoString: string | null): string {
  if (!isoString) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(isoString));
}

export function MyMonthlyTimesheetPanel({
  actions,
  canCheck,
  initialEntries,
  initialMonth,
  initialYear,
}: MyMonthlyTimesheetPanelProps) {
  const today = new Date();
  const currentMonth = initialMonth ?? today.getMonth() + 1;
  const currentYear = initialYear ?? today.getFullYear();

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [entries, setEntries] = useState<readonly TimekeepingMonthlyEntry[]>(initialEntries);
  const [syncedInitialEntries, setSyncedInitialEntries] = useState(initialEntries);
  const [isPending, startTransition] = useTransition();
  const [, startBackgroundTransition] = useTransition();
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [staleMonthNotice, setStaleMonthNotice] = useState<string | null>(null);
  // Only the latest request may write the list, so a slow answer for a month
  // the person already left can never land under another month's label.
  const latestRequestRef = useRef(0);
  const backgroundMonthInFlightRef = useRef<string | null>(null);

  // After router.refresh() (e.g. a request was just sent) the server passes
  // a fresh snapshot of the initially loaded month; while that month is
  // selected it is the authoritative list (and replaces an earlier failed
  // re-fetch of the same month).
  if (initialEntries !== syncedInitialEntries) {
    setSyncedInitialEntries(initialEntries);
    if (selectedMonth === currentMonth && selectedYear === currentYear) {
      setEntries(initialEntries);
      setFetchError(null);
      setStaleMonthNotice(null);
    }
  }

  const fetchMonth = (month: number, year: number) =>
    (actions?.fetchMyMonthlyTimesheet ?? fetchMyMonthlyTimesheetAction)(month, year);

  /** A month the person picks replaces the list (empty, with an alert, on failure). */
  const loadMonth = (month: number, year: number): void => {
    const request = ++latestRequestRef.current;
    startTransition(async () => {
      try {
        const result = await fetchMonth(month, year);
        if (request !== latestRequestRef.current) return;
        if (result.ok) {
          setEntries(result.entries);
          setFetchError(null);
        } else {
          setEntries([]);
          setFetchError(result.error.message);
        }
      } catch {
        if (request !== latestRequestRef.current) return;
        setEntries([]);
        setFetchError("Không thể tải bảng công. Vui lòng chọn lại tháng để thử lại.");
      }
    });
  };

  /**
   * Refreshes the month already on screen without the loading overlay; a
   * failure keeps the rows and says they may be out of date. A refresh
   * already running for the same month is not repeated: one mutation sends
   * two server snapshots (revalidatePath, then router.refresh()), both after
   * the change, so the running fetch already sees it.
   */
  const refreshMonthInBackground = (month: number, year: number): void => {
    const key = `${year}-${month}`;
    if (backgroundMonthInFlightRef.current === key) {
      return;
    }
    backgroundMonthInFlightRef.current = key;
    const request = ++latestRequestRef.current;
    const notice = `Chưa cập nhật được bảng công Tháng ${month}/${year}; số liệu bên dưới có thể chưa mới nhất.`;
    startBackgroundTransition(async () => {
      try {
        const result = await fetchMonth(month, year);
        if (request !== latestRequestRef.current) return;
        if (result.ok) {
          setEntries(result.entries);
          setStaleMonthNotice(null);
        } else {
          setStaleMonthNotice(notice);
        }
      } catch {
        if (request === latestRequestRef.current) {
          setStaleMonthNotice(notice);
        }
      } finally {
        backgroundMonthInFlightRef.current = null;
      }
    });
  };

  const handleMonthChange = (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    setFetchError(null);
    setStaleMonthNotice(null);
    loadMonth(month, year);
  };

  // Every router.refresh() (an adjustment request from any panel, a
  // check-in/out, a review decision) brings a new server snapshot of the
  // initially loaded month only; when another month is selected, fetch that
  // month again so its cards show the change too.
  // Keyed on the prop's identity (not the synced state, which a pending
  // background transition can render with an older value).
  const handledSnapshotRef = useRef(initialEntries);
  useEffect(() => {
    if (handledSnapshotRef.current === initialEntries) {
      return;
    }
    handledSnapshotRef.current = initialEntries;
    if (selectedMonth !== currentMonth || selectedYear !== currentYear) {
      refreshMonthInBackground(selectedMonth, selectedYear);
    }
  });

  // KPI Calculations
  const distinctWorkDays = new Set(entries.map((e) => e.workDate)).size;
  const totalMinutes = entries.reduce((acc, curr) => acc + (curr.totalMinutes ?? 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const autoEndedCount = entries.filter((e) => e.status === "auto_ended").length;
  const adjustedCount = entries.filter((e) => e.adjustmentStatus === "approved").length;

  // Convert monthly entries to adjustable format for the adjustment dialog
  const adjustableEntries: TimekeepingAdjustableEntry[] = entries
    .filter((e) => e.status !== "open" && e.checkOutAt !== null)
    .map((e) => ({
      adjustmentStatus: e.adjustmentStatus === "none" ? null : e.adjustmentStatus,
      checkInAt: e.checkInAt,
      checkInMode: e.checkInMode,
      checkOutAt: e.checkOutAt as string,
      checkOutMode: (e.checkOutMode ?? "offline") as "online" | "offline" | "auto_end",
      id: e.id,
      status: e.status as "checked_out" | "auto_ended",
      workDate: e.workDate,
      workShiftCode: e.workShiftCode,
      workShiftName: e.workShiftName,
    }));

  return (
    <section
      aria-labelledby="my-monthly-timesheet-heading"
      className="grid min-w-0 gap-4 rounded-lg border border-border-subtle bg-surface-base p-4 shadow-[var(--panel-shadow)] max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:shadow-none md:p-5"
    >
      {/* Header with Month/Year Selection */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Calendar aria-hidden="true" className="shrink-0 text-text-muted" size={20} strokeWidth={1.8} />
            <h2
              className="text-section-title font-semibold text-text-strong"
              id="my-monthly-timesheet-heading"
            >
              Bảng công cá nhân theo tháng
            </h2>
          </div>
          <p className="mt-1 text-secondary text-text-muted">
            Theo dõi chi tiết các ngày, giờ đã chấm công và tình trạng phê duyệt công trong tháng.
          </p>
        </div>

        {/* Month / Year Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-md border border-border-strong bg-surface-base px-3 focus-within:border-border-focus focus-within:shadow-[0_0_0_3px_var(--focus-ring)]">
            <span className="text-label text-text-muted">Tháng:</span>
            <select
              aria-label="Chọn tháng"
              className="h-11 cursor-pointer bg-transparent text-control font-semibold text-text-strong outline-none md:h-[38px]"
              disabled={isPending}
              onChange={(e) => handleMonthChange(Number(e.target.value), selectedYear)}
              value={selectedMonth}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 rounded-md border border-border-strong bg-surface-base px-3 focus-within:border-border-focus focus-within:shadow-[0_0_0_3px_var(--focus-ring)]">
            <span className="text-label text-text-muted">Năm:</span>
            <select
              aria-label="Chọn năm"
              className="h-11 cursor-pointer bg-transparent text-control font-semibold text-text-strong outline-none md:h-[38px]"
              disabled={isPending}
              onChange={(e) => handleMonthChange(selectedMonth, Number(e.target.value))}
              value={selectedYear}
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </label>

          {canCheck && adjustableEntries.length > 0 ? (
            <TimekeepingAdjustmentRequestDialog
              actions={actions}
              entries={adjustableEntries}
              triggerVariant="secondary"
            />
          ) : null}
        </div>
      </div>

      {fetchError ? (
        <div className="rounded-md border border-danger-border bg-danger-bg p-4 text-body font-medium text-danger" role="alert">
          {fetchError}
        </div>
      ) : null}

      {/* One always-mounted, polite region for the month's loading state and
          a refresh that could not finish; empty (and out of the layout) at rest. */}
      <div className="empty:sr-only" role="status">
        {isPending ? <span className="sr-only">Đang cập nhật bảng công…</span> : null}
        {staleMonthNotice ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning-border bg-warning-bg px-4 py-3 text-label font-normal text-text-strong">
            <span className="min-w-0 flex-1">{staleMonthNotice}</span>
            <Button
              className="max-md:h-11"
              onClick={() => refreshMonthInBackground(selectedMonth, selectedYear)}
              size="sm"
              variant="secondary"
            >
              Tải lại
            </Button>
          </div>
        ) : null}
      </div>

      {/* Month summary (design 14a "Tháng n" card) */}
      <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-border-subtle bg-surface-base sm:grid-cols-4">
        <SummaryStat label="Số ngày đi làm" unit="ngày" value={distinctWorkDays} />
        <SummaryStat emphasis label="Tổng giờ làm việc" unit="giờ" value={totalHours} />
        <SummaryStat label="Ca tự động ngắt" tone={autoEndedCount > 0 ? "warning" : undefined} value={autoEndedCount} />
        <SummaryStat label="Ca đã điều chỉnh" value={adjustedCount} />
      </dl>

      {/* Timesheet Table & Mobile List */}
      <div className="relative">
        {isPending ? (
          <div aria-hidden="true" className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-surface-base/70">
            <span className="text-body font-semibold text-action-link">Đang cập nhật bảng công…</span>
          </div>
        ) : null}

        <div className="hidden md:block">
          <DataTableFrame
            caption={`Bảng công cá nhân Tháng ${selectedMonth}/${selectedYear}`}
            tableClassName="min-w-[1000px] text-sm"
            header={
              <tr>
                <th className="px-5 py-3 font-semibold">Ngày làm việc</th>
                <th className="px-5 py-3 font-semibold">Ca phân công</th>
                <th className="px-5 py-3 font-semibold">Giờ vào</th>
                <th className="px-5 py-3 font-semibold">Giờ ra</th>
                <th className="px-5 py-3 font-semibold">Thời lượng</th>
                <th className="px-5 py-3 font-semibold">Hình thức & Vị trí</th>
                <th className="px-5 py-3 font-semibold">Trạng thái công</th>
              </tr>
            }
            body={
              entries.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-center text-sm text-ink-muted" colSpan={7}>
                    Chưa có lượt chấm công nào trong Tháng {selectedMonth}/{selectedYear}.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <TimesheetRow entry={entry} key={entry.id} />
                ))
              )
            }
          />
        </div>

        {/* Mobile View (design 14c) */}
        <ResponsiveRecordList
          className="md:hidden"
          label={`Bảng công cá nhân Tháng ${selectedMonth}/${selectedYear}`}
        >
          {entries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-strong p-6 text-center text-body text-text-muted">
              Chưa có lượt chấm công nào trong Tháng {selectedMonth}/{selectedYear}.
            </p>
          ) : (
            entries.map((entry) => (
              <TimesheetMobileCard
                actions={actions}
                adjustableEntries={adjustableEntries}
                canCheck={canCheck}
                entry={entry}
                key={entry.id}
              />
            ))
          )}
        </ResponsiveRecordList>
      </div>
    </section>
  );
}

function SummaryStat({
  emphasis = false,
  label,
  tone,
  unit,
  value,
}: {
  emphasis?: boolean;
  label: string;
  tone?: "warning";
  unit?: string;
  value: number | string;
}) {
  return (
    <div className="border-border-row px-4 py-3 max-sm:nth-[n+3]:border-t sm:not-first:border-l max-sm:even:border-l">
      <dt className="text-label text-text-muted">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-[20px]/[28px] font-bold tabular-nums",
          tone === "warning" ? "text-warning" : emphasis ? "text-action-link" : "text-text-strong",
        )}
      >
        {value}
        {unit ? <> <span className="text-label font-normal text-text-muted">{unit}</span></> : null}
      </dd>
    </div>
  );
}

function TimesheetRow({ entry }: { entry: TimekeepingMonthlyEntry }) {
  const isApproved = entry.adjustmentStatus === "approved";
  const isPendingAdj = entry.adjustmentStatus === "pending";

  return (
    <tr className="align-top hover:bg-[var(--table-row-hover)]">
      {/* Ngày làm việc */}
      <td className="px-5 py-4">
        <p className="font-semibold text-ink">{formatVietnamDate(entry.workDate)}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{formatWeekday(entry.workDate)}</p>
      </td>

      {/* Ca phân công */}
      <td className="px-5 py-4">
        {entry.workShiftName ? (
          <div>
            <p className="font-semibold text-ink">{entry.workShiftName}</p>
            <p className="mt-0.5 font-mono text-xs text-ink-muted">{entry.workShiftCode}</p>
          </div>
        ) : (
          <span className="text-xs text-ink-muted">Ngoài ca phân công</span>
        )}
      </td>

      {/* Giờ vào */}
      <td className="px-5 py-4">
        {isApproved && entry.adjustedCheckInAt ? (
          <div>
            <p className="font-mono text-xs text-ink-subtle line-through">
              {formatTimeOnly(entry.checkInAt)}
            </p>
            <p className="font-mono font-bold text-emerald-600">
              {formatTimeOnly(entry.adjustedCheckInAt)}
            </p>
          </div>
        ) : (
          <p className="font-mono font-medium text-ink">{formatTimeOnly(entry.checkInAt)}</p>
        )}
      </td>

      {/* Giờ ra */}
      <td className="px-5 py-4">
        {entry.status === "open" ? (
          <Badge tone="warning">Đang diễn ra</Badge>
        ) : isApproved && entry.adjustedCheckOutAt ? (
          <div>
            <p className="font-mono text-xs text-ink-subtle line-through">
              {formatTimeOnly(entry.checkOutAt)}
            </p>
            <p className="font-mono font-bold text-emerald-600">
              {formatTimeOnly(entry.adjustedCheckOutAt)}
            </p>
          </div>
        ) : (
          <p className="font-mono font-medium text-ink">{formatTimeOnly(entry.checkOutAt)}</p>
        )}
      </td>

      {/* Thời lượng */}
      <td className="px-5 py-4 font-medium text-ink">
        {entry.status === "open" ? "—" : formatMinutesToHours(entry.totalMinutes)}
      </td>

      {/* Hình thức & Vị trí */}
      <td className="px-5 py-4">
        <div className="flex flex-col gap-1">
          <Badge tone={entry.checkInMode === "offline" ? "info" : "neutral"}>
            {entry.checkInMode === "offline" ? "Tại trung tâm" : "Trực tuyến"}
          </Badge>
          {entry.checkInMode === "offline" ? (
            <div className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span
                className={`inline-flex items-center gap-0.5 ${
                  entry.hasCheckInGpsEvidence ? "text-emerald-600" : "text-ink-subtle"
                }`}
                title={entry.hasCheckInGpsEvidence ? "Có GPS" : "Thiếu GPS"}
              >
                <MapPin size={13} /> GPS
              </span>
              {entry.hasCheckInWifiEvidence ? (
                <span
                  className="inline-flex items-center gap-0.5 text-emerald-600"
                  title="Có Wi-Fi"
                >
                  <Wifi size={13} /> Wi-Fi
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </td>

      {/* Trạng thái công */}
      <td className="px-5 py-4">
        <div className="flex flex-col gap-1">
          {entry.status === "open" ? (
            <Badge tone="warning">Chưa check-out</Badge>
          ) : entry.status === "auto_ended" ? (
            <div className="flex flex-col gap-0.5">
              <Badge tone="danger">Tự động ngắt</Badge>
              <span className="text-xs text-red-600 font-medium">
                {entry.clockOutReason === "left_geofence"
                  ? "Rời khỏi trung tâm"
                  : entry.clockOutReason === "location_lost"
                    ? "Mất tín hiệu GPS"
                    : "Hết ngày"}
              </span>
            </div>
          ) : (
            <Badge tone="success">Đã hoàn thành</Badge>
          )}

          {isPendingAdj ? (
            <span className="text-xs font-semibold text-amber-600">
              Đang chờ duyệt điều chỉnh
            </span>
          ) : isApproved ? (
            <span className="text-xs font-semibold text-emerald-600">
              Đã duyệt sửa giờ
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

// Card wording differs from the desktop table on purpose: each label in the
// table stays the single occurrence screen readers and tests look for.
function getAutoEndReasonText(reason: TimekeepingMonthlyEntry["clockOutReason"]): string {
  switch (reason) {
    case "left_geofence":
      return "rời khu vực Trung tâm";
    case "location_lost":
      return "mất tín hiệu vị trí";
    case "daily_cutoff":
      return "quên ra ca, tự đóng theo giờ chốt";
    default:
      return "hệ thống tự động";
  }
}

// Card durations follow the times the card shows (approved adjustment, else
// the recorded times): the RPC's total_minutes also counts the times of a
// pending or rejected request (TODOS), which would contradict the card.
// Whole minutes between the HH:MM the card prints (Vietnam is a whole-hour
// offset, so truncating instants to the minute matches the shown times).
function minutesBetween(start: string, end: string): number | null {
  const minutes = Math.floor(Date.parse(end) / 60_000) - Math.floor(Date.parse(start) / 60_000);
  return Number.isFinite(minutes) ? minutes : null;
}

function formatCardDuration(minutes: number | null): string {
  if (minutes === null || minutes < 0) return "—";
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} phút`;
  if (remainingMinutes === 0) return `${hours} giờ`;
  return `${hours} giờ ${String(remainingMinutes).padStart(2, "0")}`;
}

function getEvidenceText(entry: TimekeepingMonthlyEntry): string | null {
  if (entry.checkInMode === "online") {
    return null;
  }

  if (!entry.hasCheckInGpsEvidence) {
    return "không kèm vị trí";
  }

  return entry.hasCheckInWifiEvidence ? "GPS + Wi-Fi" : "GPS";
}

function TimesheetMobileCard({
  actions,
  adjustableEntries,
  canCheck,
  entry,
}: {
  actions?: TimekeepingActionOverrides;
  adjustableEntries: readonly TimekeepingAdjustableEntry[];
  canCheck: boolean;
  entry: TimekeepingMonthlyEntry;
}) {
  const articleRef = useRef<HTMLElement>(null);
  // The adjustment status the card had when its own request was sent: the
  // card counts as "sent" only until the server reports a different status
  // (pending, then approved/rejected), so a rejected card offers a new request.
  const [sentFromStatus, setSentFromStatus] = useState<TimekeepingMonthlyEntry["adjustmentStatus"] | null>(null);
  // Once the server reports another status the marker has done its job; a
  // later return to the same status (a second rejection) must not revive it.
  if (sentFromStatus !== null && entry.adjustmentStatus !== sentFromStatus) {
    setSentFromStatus(null);
  }
  const requestSent = sentFromStatus !== null && sentFromStatus === entry.adjustmentStatus;

  // The card's own trigger goes away once its request is sent; keep focus
  // on the card instead of letting it fall back to the page.
  useEffect(() => {
    if (sentFromStatus !== null) {
      articleRef.current?.focus();
    }
  }, [sentFromStatus]);

  const isApproved = entry.adjustmentStatus === "approved";
  const isPendingAdj = entry.adjustmentStatus === "pending";
  const status = getTimekeepingEntryStatusPresentation(entry.status);
  const shownCheckIn = isApproved && entry.adjustedCheckInAt ? entry.adjustedCheckInAt : entry.checkInAt;
  const shownCheckOut = isApproved && entry.adjustedCheckOutAt ? entry.adjustedCheckOutAt : entry.checkOutAt;
  const evidenceText = getEvidenceText(entry);
  const shortDate = formatShortWorkDate(entry.workDate);
  // Client hint only: the server still decides whether a request is allowed.
  const canRequestFromCard = canCheck
    && !requestSent
    && entry.status === "auto_ended"
    && !isPendingAdj
    && !isApproved
    && adjustableEntries.some((candidate) => candidate.id === entry.id);

  return (
    <article
      className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-[var(--panel-shadow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      ref={articleRef}
      role="listitem"
      tabIndex={-1}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 text-body font-semibold text-text-strong">
          {shortDate} · {entry.workShiftName ?? "Ngoài lịch"}
        </h3>
        <span className="shrink-0 text-body font-semibold text-text-strong tabular-nums">
          {entry.status === "open" || !shownCheckOut ? "—" : formatCardDuration(minutesBetween(shownCheckIn, shownCheckOut))}
        </span>
      </div>

      <p className="mt-0.5 text-label font-normal text-text-muted tabular-nums">
        {formatVietnamClockTime(shownCheckIn)} → {entry.status === "open" || !shownCheckOut ? "đang làm" : formatVietnamClockTime(shownCheckOut)}
        {isApproved ? " (đã sửa)" : ""}
        {" · "}
        {entry.checkInMode === "offline" ? "Tại trung tâm" : "Trực tuyến"}
        {evidenceText ? ` · ${evidenceText}` : ""}
        {entry.status === "auto_ended" ? (
          <>
            {" · "}
            <strong className="font-semibold text-danger">
              tự kết thúc · {getAutoEndReasonText(entry.clockOutReason)}
            </strong>
          </>
        ) : null}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        {entry.isUnscheduled ? <Badge tone="neutral">Ca ngoài lịch</Badge> : null}
        {isPendingAdj ? (
          <>
            <Badge tone="info">Yêu cầu điều chỉnh · chờ duyệt</Badge>
            {entry.adjustedCheckInAt && entry.adjustedCheckOutAt ? (
              <span className="text-caption text-text-muted tabular-nums">
                đề nghị {formatVietnamClockTime(entry.adjustedCheckInAt)} → {formatVietnamClockTime(entry.adjustedCheckOutAt)}
              </span>
            ) : null}
          </>
        ) : isApproved ? (
          <Badge tone="success">Điều chỉnh · đã duyệt</Badge>
        ) : entry.adjustmentStatus === "rejected" ? (
          <Badge tone="danger">Điều chỉnh · bị từ chối</Badge>
        ) : null}
        {canRequestFromCard ? (
          <TimekeepingAdjustmentRequestDialog
            actions={actions}
            entries={adjustableEntries}
            initialEntryId={entry.id}
            onSubmitted={(timeEntryId) => {
              // The sheet's select can move to another shift; only the card
              // the request was actually sent for counts as sent.
              if (timeEntryId === entry.id) {
                setSentFromStatus(entry.adjustmentStatus);
              }
            }}
            triggerAriaLabel={`Yêu cầu điều chỉnh ca ${shortDate}`}
            triggerClassName="ml-auto"
            triggerVariant="secondary"
          />
        ) : null}
        <span aria-live="polite" className="text-caption text-text-muted empty:sr-only">
          {requestSent ? "Đã gửi yêu cầu điều chỉnh, chờ quản lý duyệt." : ""}
        </span>
      </div>
    </article>
  );
}
