import { Badge } from "@/components/ui/badge";
import { TimekeepingAdjustmentRequestDialog } from "@/features/timekeeping/components/timekeeping-adjustment-request-dialog";
import {
  formatVietnamDate,
  formatVietnamDateTime,
  getAdjustmentStatusLabel,
  getTimeEntryModeLabel,
} from "@/features/timekeeping/timekeeping-adjustment-utils";
import type {
  TimekeepingAdjustableEntry,
  TimekeepingAdjustmentRequest,
  TimekeepingAdjustmentStatus,
} from "@/features/timekeeping/types";

interface TimekeepingAdjustmentRequestsProps {
  canCheck: boolean;
  entries: readonly TimekeepingAdjustableEntry[];
  requests: readonly TimekeepingAdjustmentRequest[];
}

function getStatusTone(status: TimekeepingAdjustmentStatus): "danger" | "success" | "warning" {
  const tones: Record<TimekeepingAdjustmentStatus, "danger" | "success" | "warning"> = {
    approved: "success",
    pending: "warning",
    rejected: "danger",
  };

  return tones[status];
}

function EntryTimes({
  checkInAt,
  checkInMode,
  checkOutAt,
  checkOutMode,
}: {
  checkInAt: string;
  checkInMode: "online" | "offline";
  checkOutAt: string;
  checkOutMode: "auto_end" | "online" | "offline";
}) {
  return (
    <div className="grid gap-1.5 text-xs leading-5 text-ink-muted">
      <p>Vào: {formatVietnamDateTime(checkInAt)} · {getTimeEntryModeLabel(checkInMode)}</p>
      <p>Ra: {formatVietnamDateTime(checkOutAt)} · {getTimeEntryModeLabel(checkOutMode)}</p>
    </div>
  );
}

export function TimekeepingAdjustmentRequests({
  canCheck,
  entries,
  requests,
}: TimekeepingAdjustmentRequestsProps) {
  const hasEligibleEntry = entries.some(
    (entry) => entry.adjustmentStatus !== "pending" && entry.adjustmentStatus !== "approved",
  );

  return (
    <section className="overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-card">
      <div className="flex flex-col gap-4 border-b border-hairline px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-base font-bold text-ink">Điều chỉnh chấm công</h2>
          <p className="mt-0.5 max-w-2xl text-xs leading-5 text-ink-muted">
            Yêu cầu chỉ áp dụng cho lượt đã kết thúc; dữ liệu gốc luôn được lưu giữ để đối chiếu.
          </p>
        </div>
        {canCheck ? <TimekeepingAdjustmentRequestDialog entries={entries} /> : null}
      </div>

      {!canCheck ? (
        <p className="px-6 py-5 text-sm leading-6 text-ink-muted">
          Tài khoản hiện tại không có quyền timekeeping.check để gửi yêu cầu điều chỉnh.
        </p>
      ) : !hasEligibleEntry ? (
        <p className="px-6 py-5 text-sm leading-6 text-ink-muted">
          Chưa có lượt chấm công đã kết thúc có thể gửi yêu cầu điều chỉnh.
        </p>
      ) : null}

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-[1040px] border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wider text-ink-subtle">
            <tr>
              <th className="px-6 py-3.5 font-bold">Ngày công</th>
              <th className="px-6 py-3.5 font-bold">Dữ liệu gốc</th>
              <th className="px-6 py-3.5 font-bold">Đề xuất</th>
              <th className="px-6 py-3.5 font-bold">Lý do</th>
              <th className="px-6 py-3.5 font-bold">Trạng thái</th>
              <th className="px-6 py-3.5 font-bold">Kết quả xử lý</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {requests.length === 0 ? (
              <tr>
                <td className="px-6 py-10 text-center text-sm text-ink-muted" colSpan={6}>
                  Chưa có yêu cầu điều chỉnh công.
                </td>
              </tr>
            ) : (
              requests.map((request) => (
                <tr className="align-top transition-colors hover:bg-surface-2/70" key={request.id}>
                  <td className="px-6 py-4 font-medium text-ink">{formatVietnamDate(request.workDate)}</td>
                  <td className="px-6 py-4">
                    <EntryTimes
                      checkInAt={request.originalCheckInAt}
                      checkInMode={request.originalCheckInMode}
                      checkOutAt={request.originalCheckOutAt}
                      checkOutMode={request.originalCheckOutMode}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <EntryTimes
                      checkInAt={request.requestedCheckInAt}
                      checkInMode={request.requestedCheckInMode}
                      checkOutAt={request.requestedCheckOutAt}
                      checkOutMode={request.requestedCheckOutMode}
                    />
                  </td>
                  <td className="max-w-xs px-6 py-4 text-xs leading-5 text-ink-muted">{request.requestReason}</td>
                  <td className="px-6 py-4">
                    <Badge tone={getStatusTone(request.status)}>{getAdjustmentStatusLabel(request.status)}</Badge>
                  </td>
                  <td className="max-w-xs px-6 py-4 text-xs leading-5 text-ink-muted">
                    {request.reviewedAt ? (
                      <>
                        <p className="font-medium text-ink">{formatVietnamDateTime(request.reviewedAt)}</p>
                        <p className="mt-1">{request.reviewerDisplayName || "Người có thẩm quyền"}</p>
                        {request.decisionReason ? <p className="mt-1">{request.decisionReason}</p> : null}
                      </>
                    ) : (
                      "Chưa xử lý"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3.5 p-4 lg:hidden">
        {requests.length === 0 ? (
          <p className="rounded-lg border border-dashed border-hairline p-5 text-center text-sm leading-6 text-ink-muted">
            Chưa có yêu cầu điều chỉnh công.
          </p>
        ) : (
          requests.map((request) => (
            <article className="rounded-lg border border-hairline p-4" key={request.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Ngày công</p>
                  <h3 className="mt-1 font-display font-bold text-ink">{formatVietnamDate(request.workDate)}</h3>
                </div>
                <Badge tone={getStatusTone(request.status)}>{getAdjustmentStatusLabel(request.status)}</Badge>
              </div>
              <dl className="mt-4 grid gap-3 rounded-md bg-surface-2 p-3 text-xs">
                <MobileField
                  label="Dữ liệu gốc"
                  value={`${formatVietnamDateTime(request.originalCheckInAt)} - ${formatVietnamDateTime(request.originalCheckOutAt)}`}
                />
                <MobileField
                  label="Đề xuất"
                  value={`${formatVietnamDateTime(request.requestedCheckInAt)} - ${formatVietnamDateTime(request.requestedCheckOutAt)}`}
                />
                <MobileField label="Lý do" value={request.requestReason} />
                {request.decisionReason ? <MobileField label="Phản hồi" value={request.decisionReason} /> : null}
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
    <div className="grid gap-1.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-medium leading-5 text-ink">{value}</dd>
    </div>
  );
}
