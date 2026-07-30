import type { TimeEntryStatus, TimekeepingDayEntry } from "@/features/timekeeping/types";

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

function getStatusLabel(status: TimeEntryStatus): string {
  const labels: Record<TimeEntryStatus, string> = {
    auto_ended: "Tự động kết thúc",
    checked_out: "Đã check-out",
    open: "Đang trong ca",
  };

  return labels[status];
}

function getStatusClassName(status: TimeEntryStatus): string {
  const classNames: Record<TimeEntryStatus, string> = {
    auto_ended: "border-amber-200 bg-amber-50 text-amber-800",
    checked_out: "border-emerald-200 bg-emerald-50 text-emerald-700",
    open: "border-sky-200 bg-sky-50 text-sky-800",
  };

  return classNames[status];
}

function getEvidenceLabel(hasGps: boolean, hasWifi: boolean): string {
  const labels = [hasGps ? "GPS" : null, hasWifi ? "Wi-Fi" : null].filter(Boolean);

  return labels.length > 0 ? labels.join(" · ") : "Không kèm";
}

function getStaffLabel(entry: TimekeepingDayEntry): string {
  return entry.staffDisplayName?.trim() || entry.staffEmployeeCode || "Nhân sự trung tâm";
}

export function TimekeepingDayEntries({ entries }: TimekeepingDayEntriesProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-surface-1 shadow-card">
      <div className="border-b border-hairline px-5 py-4">
        <h2 className="text-section font-semibold text-ink">Chấm công trong ngày</h2>
        <p className="mt-1 text-sm text-ink-muted">{entries.length} lượt đã ghi nhận hôm nay</p>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-canvas text-xs uppercase tracking-[0.04em] text-ink-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Nhân sự</th>
              <th className="px-5 py-3 font-semibold">Ca làm</th>
              <th className="px-5 py-3 font-semibold">Check-in</th>
              <th className="px-5 py-3 font-semibold">Check-out</th>
              <th className="px-5 py-3 font-semibold">Bằng chứng</th>
              <th className="px-5 py-3 font-semibold">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {entries.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-sm text-ink-muted" colSpan={6}>
                  Chưa có lượt chấm công nào hôm nay.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr className="align-top hover:bg-canvas/70" key={entry.id}>
                  <td className="px-5 py-4">
                    <p className="font-medium text-ink">{getStaffLabel(entry)}</p>
                    {entry.staffEmployeeCode ? (
                      <p className="mt-1 text-xs text-ink-muted">{entry.staffEmployeeCode}</p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-ink">{entry.workShiftName}</p>
                    <p className="mt-1 text-xs text-ink-muted">{entry.workShiftCode}</p>
                  </td>
                  <td className="px-5 py-4 text-ink-muted">
                    <p>{formatTime(entry.checkInAt)}</p>
                    <p className="mt-1 text-xs">{entry.checkInMode === "online" ? "Trực tuyến" : "Tại trung tâm"}</p>
                  </td>
                  <td className="px-5 py-4 text-ink-muted">
                    <p>{formatTime(entry.checkOutAt)}</p>
                    {entry.checkOutMode ? (
                      <p className="mt-1 text-xs">
                        {entry.checkOutMode === "auto_end"
                          ? "Tự động"
                          : entry.checkOutMode === "online"
                            ? "Trực tuyến"
                            : "Tại trung tâm"}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-xs leading-5 text-ink-muted">
                    <p>Vào: {getEvidenceLabel(entry.hasCheckInGpsEvidence, entry.hasCheckInWifiEvidence)}</p>
                    <p className="mt-1">Ra: {getEvidenceLabel(entry.hasCheckOutGpsEvidence, entry.hasCheckOutWifiEvidence)}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-pill border px-2 py-1 text-xs font-semibold ${getStatusClassName(entry.status)}`}>
                      {getStatusLabel(entry.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-4 lg:hidden">
        {entries.length === 0 ? (
          <p className="rounded-md border border-dashed border-hairline p-4 text-sm leading-6 text-ink-muted">
            Chưa có lượt chấm công nào hôm nay.
          </p>
        ) : (
          entries.map((entry) => (
            <article className="rounded-lg border border-hairline bg-white p-4" key={entry.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-ink">{getStaffLabel(entry)}</h3>
                  {entry.staffEmployeeCode ? (
                    <p className="mt-1 text-xs text-ink-muted">{entry.staffEmployeeCode}</p>
                  ) : null}
                </div>
                <span className={`rounded-pill border px-2 py-1 text-xs font-semibold ${getStatusClassName(entry.status)}`}>
                  {getStatusLabel(entry.status)}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm">
                <MobileField label="Ca làm" value={`${entry.workShiftCode} · ${entry.workShiftName}`} />
                <MobileField
                  label="Check-in"
                  value={`${formatTime(entry.checkInAt)} · ${entry.checkInMode === "online" ? "Trực tuyến" : "Tại trung tâm"}`}
                />
                <MobileField
                  label="Check-out"
                  value={`${formatTime(entry.checkOutAt)}${entry.checkOutMode ? ` · ${entry.checkOutMode === "auto_end" ? "Tự động" : entry.checkOutMode === "online" ? "Trực tuyến" : "Tại trung tâm"}` : ""}`}
                />
                <MobileField
                  label="Bằng chứng"
                  value={`Vào: ${getEvidenceLabel(entry.hasCheckInGpsEvidence, entry.hasCheckInWifiEvidence)}; Ra: ${getEvidenceLabel(entry.hasCheckOutGpsEvidence, entry.hasCheckOutWifiEvidence)}`}
                />
              </dl>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function MobileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">{label}</dt>
      <dd className="mt-1 text-ink">{value}</dd>
    </div>
  );
}
