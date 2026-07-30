import { TimekeepingEntryDialog } from "@/features/timekeeping/components/timekeeping-entry-dialog";
import type { TimekeepingMyEntry } from "@/features/timekeeping/types";

interface MyTimekeepingPanelProps {
  canCheck: boolean;
  entries: readonly TimekeepingMyEntry[];
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function formatScheduleTime(value: string): string {
  return value.slice(0, 5);
}

function getStatusLabel(status: TimekeepingMyEntry["status"]): string {
  const labels: Record<TimekeepingMyEntry["status"], string> = {
    auto_ended: "Tự động kết thúc",
    checked_out: "Đã check-out",
    open: "Đang trong ca",
  };

  return labels[status];
}

function getStatusClassName(status: TimekeepingMyEntry["status"]): string {
  const classNames: Record<TimekeepingMyEntry["status"], string> = {
    auto_ended: "border-amber-200 bg-amber-50 text-amber-800",
    checked_out: "border-emerald-200 bg-emerald-50 text-emerald-700",
    open: "border-sky-200 bg-sky-50 text-sky-800",
  };

  return classNames[status];
}

function getEvidenceLabel(
  hasGps: boolean,
  hasWifi: boolean,
): string {
  const labels = [hasGps ? "GPS" : null, hasWifi ? "Wi-Fi" : null].filter(Boolean);

  return labels.length > 0 ? labels.join(" · ") : "Không kèm";
}

export function MyTimekeepingPanel({
  canCheck,
  entries,
}: MyTimekeepingPanelProps) {
  const openEntry = entries.find((entry) => entry.status === "open");
  const latestEntry = entries[0];

  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-surface-1 shadow-card">
      <div className="flex flex-col gap-4 border-b border-hairline px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-section font-semibold text-ink">Chấm công của tôi</h2>
          <p className="mt-1 text-sm text-ink-muted">Dữ liệu trong ngày theo giờ Việt Nam.</p>
        </div>
        {canCheck ? (
          openEntry ? (
            <TimekeepingEntryDialog operation="check-out" />
          ) : (
            <TimekeepingEntryDialog operation="check-in" />
          )
        ) : (
          <span className="rounded-pill border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
            Chưa có quyền chấm công
          </span>
        )}
      </div>

      {latestEntry ? (
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <EntryField label="Ca làm" value={`${latestEntry.workShiftCode} · ${latestEntry.workShiftName}`} />
          <EntryField
            label="Thời gian ca"
            value={`${formatScheduleTime(latestEntry.scheduledStartTime)} - ${formatScheduleTime(latestEntry.scheduledEndTime)}`}
          />
          <EntryField
            label="Check-in"
            value={`${formatTime(latestEntry.checkInAt)} · ${latestEntry.checkInMode === "online" ? "Trực tuyến" : "Tại trung tâm"}`}
          />
          <EntryField
            label="Check-out"
            value={
              latestEntry.checkOutAt
                ? `${formatTime(latestEntry.checkOutAt)} · ${latestEntry.checkOutMode === "auto_end" ? "Tự động" : latestEntry.checkOutMode === "online" ? "Trực tuyến" : "Tại trung tâm"}`
                : "Chưa check-out"
            }
          />
          <EntryField
            label="Bằng chứng vào"
            value={getEvidenceLabel(
              latestEntry.hasCheckInGpsEvidence,
              latestEntry.hasCheckInWifiEvidence,
            )}
          />
          <EntryField
            label="Bằng chứng ra"
            value={getEvidenceLabel(
              latestEntry.hasCheckOutGpsEvidence,
              latestEntry.hasCheckOutWifiEvidence,
            )}
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Trạng thái</p>
            <span className={`mt-2 inline-flex rounded-pill border px-2 py-1 text-xs font-semibold ${getStatusClassName(latestEntry.status)}`}>
              {getStatusLabel(latestEntry.status)}
            </span>
          </div>
        </div>
      ) : (
        <p className="p-5 text-sm leading-6 text-ink-muted">
          Hôm nay chưa có lượt chấm công nào.
        </p>
      )}
    </section>
  );
}

function EntryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">{label}</p>
      <p className="mt-2 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}
