import type { ReactNode } from "react";

import { DataTableFrame } from "@/components/patterns/data-table-frame";
import { ResponsiveRecordList } from "@/components/patterns/responsive-record-list";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  getEvidencePresenceLabel,
  getTimekeepingEntryStatusPresentation,
  getTimekeepingModeLabel,
} from "@/features/timekeeping/timekeeping-entry-presentation";
import type { TimekeepingDayEntry } from "@/features/timekeeping/types";

interface TimekeepingDayEntriesProps {
  entries: readonly TimekeepingDayEntry[];
}

function formatTime(value: string | null): string {
  if (!value) {
    return "Chưa check-out";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function getStaffLabel(entry: TimekeepingDayEntry): string {
  return entry.staffDisplayName?.trim() || entry.staffEmployeeCode || "Nhân sự trung tâm";
}

/** Read-only current-day audit presentation; raw evidence remains outside this read model. */
export function TimekeepingDayEntries({ entries }: TimekeepingDayEntriesProps) {
  return (
    <section
      aria-labelledby="timekeeping-day-audit-heading"
      className="timekeeping-day-audit-work-area grid min-w-0 gap-4"
    >
      <div>
        <h2 className="text-section-title font-semibold text-text-strong" id="timekeeping-day-audit-heading">
          Chấm công trong ngày
        </h2>
        <p className="mt-1 text-secondary text-text-muted">
          Các lượt chấm công ghi nhận trong ngày hôm nay theo giờ Việt Nam.
        </p>
      </div>

      <p aria-live="polite" className="text-secondary text-text-muted">
        Hiển thị {entries.length} lượt chấm công trong ngày.
      </p>

      {entries.length === 0 ? (
        <EmptyState
          description="Chưa có lượt chấm công nào được ghi nhận trong ngày hôm nay."
          title="Chưa có lượt chấm công"
        />
      ) : (
        <TimekeepingDayEntryList entries={entries} />
      )}
    </section>
  );
}

function TimekeepingDayEntryList({ entries }: TimekeepingDayEntriesProps) {
  return (
    <div className="timekeeping-day-audit-results-work-area">
      <DataTableFrame
        body={entries.map((entry) => <DayEntryTableRow entry={entry} key={entry.id} />)}
        caption="Danh sách lượt chấm công trong ngày"
        className="timekeeping-day-audit-table"
        header={(
          <tr>
            <TableHeader>Nhân sự</TableHeader>
            <TableHeader>Ca làm</TableHeader>
            <TableHeader>Check-in</TableHeader>
            <TableHeader>Check-out</TableHeader>
            <TableHeader>Bằng chứng</TableHeader>
            <TableHeader>Trạng thái</TableHeader>
          </tr>
        )}
        tableClassName="min-w-[980px] table-fixed text-table-body text-text-default"
      />

      <ResponsiveRecordList
        className="timekeeping-day-audit-record-list"
        label="Danh sách lượt chấm công trong ngày"
      >
        {entries.map((entry) => <DayEntryRecord entry={entry} key={entry.id} />)}
      </ResponsiveRecordList>
    </div>
  );
}

function DayEntryTableRow({ entry }: { entry: TimekeepingDayEntry }) {
  const status = getTimekeepingEntryStatusPresentation(entry.status);

  return (
    <tr className="hover:bg-[var(--table-row-hover)]">
      <TableCell className="w-[176px]"><StaffIdentity entry={entry} /></TableCell>
      <TableCell className="w-[156px]">
        {entry.workShiftName ? (
          <>
            <p className="font-medium text-text-default">{entry.workShiftName}</p>
            {entry.workShiftCode ? (
              <p className="mt-0.5 font-mono text-caption text-text-muted">{entry.workShiftCode}</p>
            ) : null}
          </>
        ) : (
          <p className="text-text-muted">Không có ca được phân công</p>
        )}
      </TableCell>
      <TableCell className="w-[134px] tabular-nums">
        <p>{formatTime(entry.checkInAt)}</p>
        <p className="mt-0.5 text-caption text-text-muted">{getTimekeepingModeLabel(entry.checkInMode)}</p>
      </TableCell>
      <TableCell className="w-[134px] tabular-nums">
        <p>{formatTime(entry.checkOutAt)}</p>
        {entry.checkOutMode ? (
          <p className="mt-0.5 text-caption text-text-muted">
            {entry.checkOutMode === "auto_end" ? "Tự động" : getTimekeepingModeLabel(entry.checkOutMode)}
          </p>
        ) : null}
      </TableCell>
      <TableCell className="w-[210px] text-secondary text-text-muted">
        <EvidencePresence entry={entry} />
      </TableCell>
      <TableCell className="w-[150px]"><Badge tone={status.tone}>{status.label}</Badge></TableCell>
    </tr>
  );
}

function DayEntryRecord({ entry }: { entry: TimekeepingDayEntry }) {
  const status = getTimekeepingEntryStatusPresentation(entry.status);

  return (
    <article className="rounded-lg border border-border-subtle bg-surface-base px-4 py-3" role="listitem">
      <div className="flex items-start justify-between gap-3">
        <StaffIdentity entry={entry} />
        <Badge className="shrink-0" tone={status.tone}>{status.label}</Badge>
      </div>
      <dl className="mt-3 grid gap-2.5 text-secondary text-text-muted">
        <RecordField label="Check-in" value={`${formatTime(entry.checkInAt)} · ${getTimekeepingModeLabel(entry.checkInMode)}`} />
        <RecordField
          label="Check-out"
          value={`${formatTime(entry.checkOutAt)}${entry.checkOutMode ? ` · ${entry.checkOutMode === "auto_end" ? "Tự động" : getTimekeepingModeLabel(entry.checkOutMode)}` : ""}`}
        />
        <RecordField
          label="Ca làm"
          value={entry.workShiftName
            ? `${entry.workShiftCode ? `${entry.workShiftCode} · ` : ""}${entry.workShiftName}`
            : "Không có ca được phân công"}
        />
        <div>
          <dt className="text-label text-text-muted">Bằng chứng</dt>
          <dd className="mt-1"><EvidencePresence entry={entry} /></dd>
        </div>
      </dl>
    </article>
  );
}

function StaffIdentity({ entry }: { entry: TimekeepingDayEntry }) {
  return (
    <div className="min-w-0">
      <p className="font-semibold text-text-strong">{getStaffLabel(entry)}</p>
      {entry.staffEmployeeCode ? (
        <p className="mt-0.5 font-mono text-caption text-text-muted">{entry.staffEmployeeCode}</p>
      ) : null}
    </div>
  );
}

function EvidencePresence({ entry }: { entry: TimekeepingDayEntry }) {
  return (
    <div className="grid gap-0.5">
      <p>Vào: GPS {getEvidencePresenceLabel(entry.hasCheckInGpsEvidence)} · Wi-Fi {getEvidencePresenceLabel(entry.hasCheckInWifiEvidence)}</p>
      <p>Ra: GPS {getEvidencePresenceLabel(entry.hasCheckOutGpsEvidence)} · Wi-Fi {getEvidencePresenceLabel(entry.hasCheckOutWifiEvidence)}</p>
    </div>
  );
}

function RecordField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-label text-text-muted">{label}</dt>
      <dd className="mt-0.5 text-text-default">{value}</dd>
    </div>
  );
}

function TableHeader({ children }: { children: ReactNode }) {
  return <th className="h-10 border-b border-border-subtle px-3 text-left font-semibold" scope="col">{children}</th>;
}

function TableCell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`min-h-14 px-3 py-3 align-top text-table-body ${className}`}>{children}</td>;
}
