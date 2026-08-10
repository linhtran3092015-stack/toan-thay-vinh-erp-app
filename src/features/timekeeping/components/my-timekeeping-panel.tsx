import { Badge } from "@/components/ui/badge";
import { TimekeepingEntryDialog } from "@/features/timekeeping/components/timekeeping-entry-dialog";
import type { TimeEntryStatus, TimekeepingMyEntry } from "@/features/timekeeping/types";

interface MyTimekeepingPanelProps {
  canCheck: boolean;
  entries: readonly TimekeepingMyEntry[];
}

type TimekeepingEntryTone = "info" | "neutral" | "success";

interface TimekeepingEntryStatusPresentation {
  label: string;
  tone: TimekeepingEntryTone;
}

const modeLabels = {
  offline: "Tại trung tâm",
  online: "Trực tuyến",
} as const;

/** Timekeeping-local state wording; status meaning remains server-owned. */
export function getTimekeepingEntryStatusPresentation(
  status: TimeEntryStatus,
): TimekeepingEntryStatusPresentation {
  switch (status) {
    case "open":
      return { label: "Đang trong ca", tone: "info" };
    case "checked_out":
      return { label: "Đã check-out", tone: "success" };
    case "auto_ended":
      return { label: "Tự động kết thúc", tone: "neutral" };
  }
}

export function getTimekeepingModeLabel(mode: "online" | "offline"): string {
  return modeLabels[mode];
}

export function getEvidencePresenceLabel(hasEvidence: boolean): string {
  return hasEvidence ? "Có dữ liệu" : "Không có dữ liệu";
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

/** Personal current-day presentation. It only displays the existing personal read model. */
export function MyTimekeepingPanel({
  canCheck,
  entries,
}: MyTimekeepingPanelProps) {
  const openEntry = entries.find((entry) => entry.status === "open");
  const entry = openEntry ?? entries[0];
  const statusPresentation = entry
    ? getTimekeepingEntryStatusPresentation(entry.status)
    : null;

  return (
    <section
      aria-labelledby="my-timekeeping-heading"
      className="grid min-w-0 gap-4 rounded-lg border border-border-subtle bg-surface-base p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-section-title font-semibold text-text-strong" id="my-timekeeping-heading">
              Chấm công của tôi
            </h2>
            {statusPresentation ? (
              <Badge tone={statusPresentation.tone}>{statusPresentation.label}</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-secondary text-text-muted">
            Dữ liệu chấm công cá nhân trong ngày theo giờ Việt Nam.
          </p>
        </div>

        {canCheck ? (
          openEntry ? (
            <TimekeepingEntryDialog operation="check-out" />
          ) : (
            <TimekeepingEntryDialog operation="check-in" />
          )
        ) : (
          <p className="text-secondary text-text-muted">
            Bạn chưa có quyền chấm công.
          </p>
        )}
      </div>

      {entry ? (
        <dl className="grid gap-x-6 gap-y-4 border-t border-border-subtle pt-4 sm:grid-cols-2 xl:grid-cols-3">
          <EntryField label="Ca làm" value={`${entry.workShiftCode} · ${entry.workShiftName}`} />
          <EntryField
            label="Thời gian ca"
            value={`${formatScheduleTime(entry.scheduledStartTime)} – ${formatScheduleTime(entry.scheduledEndTime)}`}
          />
          <EntryField
            label="Check-in"
            value={`${formatTime(entry.checkInAt)} · ${getTimekeepingModeLabel(entry.checkInMode)}`}
          />
          <EntryField
            label="Check-out"
            value={
              entry.checkOutAt && entry.checkOutMode
                ? `${formatTime(entry.checkOutAt)} · ${entry.checkOutMode === "auto_end" ? "Tự động" : getTimekeepingModeLabel(entry.checkOutMode)}`
                : "Chưa check-out"
            }
          />
          <EntryField
            label="Dữ liệu GPS khi vào"
            value={getEvidencePresenceLabel(entry.hasCheckInGpsEvidence)}
          />
          <EntryField
            label="Thông tin Wi-Fi khi vào"
            value={getEvidencePresenceLabel(entry.hasCheckInWifiEvidence)}
          />
          {entry.checkOutAt ? (
            <>
              <EntryField
                label="Dữ liệu GPS khi ra"
                value={getEvidencePresenceLabel(entry.hasCheckOutGpsEvidence)}
              />
              <EntryField
                label="Thông tin Wi-Fi khi ra"
                value={getEvidencePresenceLabel(entry.hasCheckOutWifiEvidence)}
              />
            </>
          ) : null}
        </dl>
      ) : (
        <p className="border-t border-border-subtle pt-4 text-body text-text-muted">
          Hôm nay chưa có lượt chấm công nào.
        </p>
      )}
    </section>
  );
}

function EntryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-label text-text-muted">{label}</dt>
      <dd className="mt-1 text-body font-medium text-text-default">{value}</dd>
    </div>
  );
}
