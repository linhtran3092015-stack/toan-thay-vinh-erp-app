import { Badge } from "@/components/ui/badge";
import { TimekeepingAdjustmentDecisionDialog } from "@/features/timekeeping/components/timekeeping-adjustment-decision-dialog";
import {
  formatVietnamDate,
  formatVietnamDateTime,
  getTimeEntryModeLabel,
} from "@/features/timekeeping/timekeeping-adjustment-utils";
import type { TimekeepingAdjustmentApprovalQueueEntry } from "@/features/timekeeping/types";

interface TimekeepingAdjustmentApprovalQueueProps {
  requests: readonly TimekeepingAdjustmentApprovalQueueEntry[];
}

function getRequesterLabel(request: TimekeepingAdjustmentApprovalQueueEntry): string {
  return request.requesterDisplayName || request.requesterEmployeeCode || "Nhân sự";
}

function ChangeSummary({
  original,
  requested,
}: {
  original: TimekeepingAdjustmentApprovalQueueEntry;
  requested: TimekeepingAdjustmentApprovalQueueEntry;
}) {
  return (
    <div className="grid gap-1.5 text-xs leading-5 text-ink-muted">
      <p>
        Vào: {formatVietnamDateTime(original.originalCheckInAt)} · {getTimeEntryModeLabel(original.originalCheckInMode)}
      </p>
      <p>
        Ra: {formatVietnamDateTime(original.originalCheckOutAt)} · {getTimeEntryModeLabel(original.originalCheckOutMode)}
      </p>
      <p className="border-t border-hairline pt-1.5 text-ink">
        Đề xuất: {formatVietnamDateTime(requested.requestedCheckInAt)} - {formatVietnamDateTime(requested.requestedCheckOutAt)}
      </p>
    </div>
  );
}

export function TimekeepingAdjustmentApprovalQueue({
  requests,
}: TimekeepingAdjustmentApprovalQueueProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-hairline bg-surface-1 shadow-card">
      <div className="flex flex-col gap-2 border-b border-hairline px-6 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-base font-bold text-ink">Hàng chờ duyệt điều chỉnh</h2>
          <p className="mt-0.5 text-xs leading-5 text-ink-muted">
            Người duyệt không thể tự xử lý yêu cầu do chính mình gửi.
          </p>
        </div>
        <Badge tone="warning">{requests.length} chờ duyệt</Badge>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-[1080px] border-separate border-spacing-0 text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wider text-ink-subtle">
            <tr>
              <th className="px-6 py-3.5 font-bold">Nhân sự</th>
              <th className="px-6 py-3.5 font-bold">Ngày công</th>
              <th className="px-6 py-3.5 font-bold">Thay đổi đề xuất</th>
              <th className="px-6 py-3.5 font-bold">Lý do</th>
              <th className="px-6 py-3.5 font-bold">Gửi lúc</th>
              <th className="px-6 py-3.5 font-bold">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {requests.length === 0 ? (
              <tr>
                <td className="px-6 py-10 text-center text-sm text-ink-muted" colSpan={6}>
                  Không có yêu cầu điều chỉnh nào chờ duyệt.
                </td>
              </tr>
            ) : (
              requests.map((request) => (
                <tr className="align-top transition-colors hover:bg-surface-2/70" key={request.id}>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-ink">{getRequesterLabel(request)}</p>
                    {request.requesterEmployeeCode ? (
                      <p className="mt-0.5 font-mono text-xs text-ink-muted">{request.requesterEmployeeCode}</p>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 font-medium text-ink">{formatVietnamDate(request.workDate)}</td>
                  <td className="px-6 py-4"><ChangeSummary original={request} requested={request} /></td>
                  <td className="max-w-xs px-6 py-4 text-xs leading-5 text-ink-muted">{request.requestReason}</td>
                  <td className="px-6 py-4 text-xs text-ink-muted">{formatVietnamDateTime(request.createdAt)}</td>
                  <td className="px-6 py-4"><TimekeepingAdjustmentDecisionDialog request={request} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3.5 p-4 lg:hidden">
        {requests.length === 0 ? (
          <p className="rounded-lg border border-dashed border-hairline p-5 text-center text-sm leading-6 text-ink-muted">
            Không có yêu cầu điều chỉnh nào chờ duyệt.
          </p>
        ) : (
          requests.map((request) => (
            <article className="rounded-lg border border-hairline p-4" key={request.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-muted">Nhân sự</p>
                  <h3 className="mt-1 font-display font-bold text-ink">{getRequesterLabel(request)}</h3>
                  <p className="mt-1 text-xs text-ink-muted">{formatVietnamDate(request.workDate)}</p>
                </div>
                <Badge tone="warning">Chờ duyệt</Badge>
              </div>
              <div className="mt-4 rounded-md bg-surface-2 p-3">
                <ChangeSummary original={request} requested={request} />
              </div>
              <p className="mt-3 text-sm leading-6 text-ink-muted">{request.requestReason}</p>
              <div className="mt-4 border-t border-hairline pt-3">
                <TimekeepingAdjustmentDecisionDialog request={request} />
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
