"use client";

import { useState, useTransition } from "react";
import {
  Calendar,
  MapPin,
  Wifi,
} from "lucide-react";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { Badge } from "@/components/ui/badge";
import { fetchMyMonthlyTimesheetAction } from "@/features/timekeeping/timekeeping-admin-actions";
import { TimekeepingAdjustmentRequestDialog } from "@/features/timekeeping/components/timekeeping-adjustment-request-dialog";
import { formatVietnamDate } from "@/features/timekeeping/timekeeping-adjustment-utils";
import type {
  TimekeepingAdjustableEntry,
  TimekeepingMonthlyEntry,
} from "@/features/timekeeping/types";

interface MyMonthlyTimesheetPanelProps {
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
  const date = new Date(`${dateStr}T00:00:00+07:00`);
  return weekdayNames[date.getDay()] ?? "";
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
  const [isPending, startTransition] = useTransition();
  const [fetchError, setFetchError] = useState<string | null>(null);

  const handleMonthChange = (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    setFetchError(null);

    startTransition(async () => {
      const result = await fetchMyMonthlyTimesheetAction(month, year);
      if (result.ok) {
        setEntries(result.entries);
      } else {
        setFetchError(result.error.message);
      }
    });
  };

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
      className="grid min-w-0 gap-5 rounded-2xl border border-hairline bg-surface-1 p-5 shadow-xs sm:p-6"
    >
      {/* Header with Month/Year Selection */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="text-primary" size={22} />
            <h2
              className="font-display text-xl font-bold tracking-tight text-ink"
              id="my-monthly-timesheet-heading"
            >
              Bảng công cá nhân theo tháng
            </h2>
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            Theo dõi chi tiết các ngày, giờ đã chấm công và tình trạng phê duyệt công trong tháng.
          </p>
        </div>

        {/* Month / Year Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 shadow-2xs">
            <span className="text-xs font-semibold text-ink-muted">Tháng:</span>
            <select
              aria-label="Chọn tháng"
              className="cursor-pointer bg-transparent text-sm font-bold text-ink outline-none"
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
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 shadow-2xs">
            <span className="text-xs font-semibold text-ink-muted">Năm:</span>
            <select
              aria-label="Chọn năm"
              className="cursor-pointer bg-transparent text-sm font-bold text-ink outline-none"
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
          </div>

          {canCheck && adjustableEntries.length > 0 ? (
            <TimekeepingAdjustmentRequestDialog entries={adjustableEntries} />
          ) : null}
        </div>
      </div>

      {fetchError ? (
        <div className="rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm font-medium text-danger">
          {fetchError}
        </div>
      ) : null}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-hairline bg-surface-2 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
            Số ngày đi làm
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-ink">
            {distinctWorkDays} <span className="text-sm font-normal text-ink-muted">ngày</span>
          </p>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-2 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
            Tổng giờ làm việc
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-primary">
            {totalHours} <span className="text-sm font-normal text-ink-muted">giờ</span>
          </p>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-2 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
            Ca tự động ngắt
          </p>
          <p
            className={`mt-1 font-display text-2xl font-bold ${
              autoEndedCount > 0 ? "text-amber-600" : "text-ink"
            }`}
          >
            {autoEndedCount}
          </p>
        </div>

        <div className="rounded-xl border border-hairline bg-surface-2 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
            Ca đã điều chỉnh
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-emerald-600">
            {adjustedCount}
          </p>
        </div>
      </div>

      {/* Timesheet Table & Mobile List */}
      <div className="relative">
        {isPending ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-surface-1/60 backdrop-blur-xs">
            <span className="text-sm font-semibold text-primary">Đang cập nhật bảng công…</span>
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

        {/* Mobile View */}
        <ResponsiveRecordList
          className="md:hidden"
          label={`Bảng công cá nhân Tháng ${selectedMonth}/${selectedYear}`}
        >
          {entries.length === 0 ? (
            <p className="rounded-xl border border-dashed border-hairline p-6 text-center text-sm text-ink-muted">
              Chưa có lượt chấm công nào trong Tháng {selectedMonth}/{selectedYear}.
            </p>
          ) : (
            entries.map((entry) => (
              <TimesheetMobileCard entry={entry} key={entry.id} />
            ))
          )}
        </ResponsiveRecordList>
      </div>
    </section>
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

function TimesheetMobileCard({ entry }: { entry: TimekeepingMonthlyEntry }) {
  const isApproved = entry.adjustmentStatus === "approved";

  return (
    <article className="rounded-xl border border-hairline bg-surface-2 p-4 shadow-2xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display font-bold text-ink">{formatVietnamDate(entry.workDate)}</p>
          <p className="text-xs text-ink-muted">
            {formatWeekday(entry.workDate)} · {entry.workShiftName ?? "Ngoài ca"}
          </p>
        </div>
        <Badge
          tone={
            entry.status === "open"
              ? "warning"
              : entry.status === "auto_ended"
                ? "danger"
                : "success"
          }
        >
          {entry.status === "open"
            ? "Đang làm"
            : entry.status === "auto_ended"
              ? "Tự ngắt"
              : "Hoàn tất"}
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-y border-hairline py-2.5 text-xs">
        <div>
          <span className="text-ink-muted">Giờ vào:</span>{" "}
          <span className="font-mono font-semibold text-ink">
            {isApproved && entry.adjustedCheckInAt
              ? `${formatTimeOnly(entry.adjustedCheckInAt)} (Đã sửa)`
              : formatTimeOnly(entry.checkInAt)}
          </span>
        </div>
        <div>
          <span className="text-ink-muted">Giờ ra:</span>{" "}
          <span className="font-mono font-semibold text-ink">
            {entry.status === "open"
              ? "—"
              : isApproved && entry.adjustedCheckOutAt
                ? `${formatTimeOnly(entry.adjustedCheckOutAt)} (Đã sửa)`
                : formatTimeOnly(entry.checkOutAt)}
          </span>
        </div>
        <div>
          <span className="text-ink-muted">Thời lượng:</span>{" "}
          <span className="font-semibold text-primary">
            {entry.status === "open" ? "—" : formatMinutesToHours(entry.totalMinutes)}
          </span>
        </div>
        <div>
          <span className="text-ink-muted">Hình thức:</span>{" "}
          <span className="font-medium text-ink">
            {entry.checkInMode === "offline" ? "Tại trung tâm" : "Trực tuyến"}
          </span>
        </div>
      </div>

      {entry.clockOutReason === "left_geofence" ? (
        <p className="mt-2 text-xs font-medium text-danger">
          Tự động kết thúc do rời khỏi khu vực trung tâm.
        </p>
      ) : null}
      {isApproved ? (
        <p className="mt-2 text-xs font-medium text-emerald-600">
          Lượt chấm công đã được quản lý điều chỉnh giờ hợp lệ.
        </p>
      ) : null}
    </article>
  );
}
