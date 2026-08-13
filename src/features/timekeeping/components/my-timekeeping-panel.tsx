"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { TimekeepingEntryDialog } from "@/features/timekeeping/components/timekeeping-entry-dialog";
import { useAttendanceHeartbeat } from "@/features/timekeeping/hooks/use-attendance-heartbeat";
import {
  getClockOutReasonLabel,
  getEvidencePresenceLabel,
  getTimekeepingEntryStatusPresentation,
  getTimekeepingModeLabel,
} from "@/features/timekeeping/timekeeping-entry-presentation";
import type { TimekeepingMyEntry } from "@/features/timekeeping/types";

export {
  getClockOutReasonLabel,
  getEvidencePresenceLabel,
  getTimekeepingEntryStatusPresentation,
  getTimekeepingModeLabel,
} from "@/features/timekeeping/timekeeping-entry-presentation";

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

function formatScheduleTime(value: string | null): string {
  if (!value) return "Không áp dụng";
  return value.slice(0, 5);
}

function formatElapsedTime(checkInAt: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(checkInAt).getTime());
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function MyTimekeepingPanel({
  canCheck,
  entries,
}: MyTimekeepingPanelProps) {
  const openEntry = entries.find((entry) => entry.status === "open");
  const entry = openEntry ?? entries[0];
  const statusPresentation = entry
    ? getTimekeepingEntryStatusPresentation(entry.status)
    : null;

  const [elapsedText, setElapsedText] = useState<string>("");

  useEffect(() => {
    if (!openEntry) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedText(formatElapsedTime(openEntry.checkInAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [openEntry]);

  const displayElapsedText = openEntry
    ? elapsedText || formatElapsedTime(openEntry.checkInAt)
    : "";

  const { distanceM, serverMessage, statusLabel } = useAttendanceHeartbeat({
    activeSessionId: openEntry?.id ?? null,
    enabled: Boolean(openEntry),
  });

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
            {openEntry?.isUnscheduled ? (
              <Badge tone="warning">Không có ca được phân công hôm nay</Badge>
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

      {openEntry ? (
        <div className="rounded-md border border-border-subtle bg-surface-subtle p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-caption text-text-muted">Thời gian đã làm việc</span>
              <p className="font-mono text-xl font-bold text-text-strong">{displayElapsedText || "00:00:00"}</p>
            </div>
            <div>
              <span className="text-caption text-text-muted">Trạng thái định vị GPS</span>
              <p className="text-body font-medium text-text-default">
                {statusLabel}
                {distanceM !== null ? ` (khoảng ${distanceM}m từ Trung tâm)` : ""}
              </p>
            </div>
          </div>
          {serverMessage ? (
            <p className="mt-2 text-caption text-danger">{serverMessage}</p>
          ) : null}
          <p className="mt-3 rounded bg-surface-base p-2.5 text-caption text-text-muted border border-border-subtle">
            ℹ️ <strong>Hướng dẫn:</strong> Trong thời gian chấm công, vui lòng duy trì quyền truy cập vị trí và kết nối mạng. Nếu hệ thống không xác minh được vị trí trong thời gian quy định, phiên chấm công có thể tự động kết thúc.
          </p>
        </div>
      ) : null}

      {entry ? (
        <dl className="grid gap-x-6 gap-y-4 border-t border-border-subtle pt-4 sm:grid-cols-2 xl:grid-cols-3">
          <EntryField
            label="Ca làm"
            value={
              entry.workShiftCode && entry.workShiftName
                ? `${entry.workShiftCode} · ${entry.workShiftName}`
                : "Không ca (Tự do)"
            }
          />
          <EntryField
            label="Thời gian ca"
            value={
              entry.scheduledStartTime && entry.scheduledEndTime
                ? `${formatScheduleTime(entry.scheduledStartTime)} – ${formatScheduleTime(entry.scheduledEndTime)}`
                : "Không có ca ấn định"
            }
          />
          <EntryField
            label="Check-in"
            value={`${formatTime(entry.checkInAt)} · ${getTimekeepingModeLabel(entry.checkInMode)}`}
          />
          <EntryField
            label="Check-out"
            value={
              entry.checkOutAt && entry.checkOutMode
                ? `${formatTime(entry.checkOutAt)} · ${entry.checkOutMode === "auto_end" ? `Tự động (${getClockOutReasonLabel(entry.clockOutReason)})` : getTimekeepingModeLabel(entry.checkOutMode)}`
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
