import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SessionBalanceBadge } from "@/features/students/components/session-balance-badge";

import { formatDeltaSessions } from "@/features/students/detail/helpers";
import {
  formatLedgerEntryType,
  type StudentLedgerReadModel,
} from "@/features/students/ledger-data";

interface StudentSessionLedgerCardProps {
  summary: StudentLedgerReadModel | null;
}

export function StudentSessionLedgerCard({
  summary,
}: StudentSessionLedgerCardProps) {
  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sổ cái số buổi học</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-muted">
            Không tải được dữ liệu sổ cái số buổi.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Alert Banners */}
      {summary.alerts.map((alert, index) => (
        <div
          className={`flex items-start gap-3 rounded-lg border p-4 ${
            alert.severity === "danger"
              ? "border-danger/30 bg-danger/5 text-danger-dark"
              : "border-warning/30 bg-warning/5 text-warning-dark"
          }`}
          key={index}
        >
          <Badge tone={alert.severity === "danger" ? "danger" : "warning"}>
            {alert.title}
          </Badge>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{alert.title}</p>
            <p className="mt-0.5 text-xs opacity-90">{alert.description}</p>
          </div>
        </div>
      ))}

      {/* Main Ledger Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Sổ cái số buổi học</CardTitle>
          <SessionBalanceBadge balance={summary.balanceSessions} />
        </CardHeader>

        <CardContent className="grid gap-4">
          {/* Summary Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-hairline bg-canvas p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Số dư hiện tại
              </p>
              <p className="mt-1 text-lg font-bold text-ink">
                {summary.balanceSessions} buổi
              </p>
            </div>

            <div className="rounded-md border border-hairline bg-canvas p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Tổng đã cộng
              </p>
              <p className="mt-1 text-lg font-bold text-success">
                +{summary.totalCreditSessions} buổi
              </p>
            </div>

            <div className="col-span-2 rounded-md border border-hairline bg-canvas p-3 sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Tổng đã trừ
              </p>
              <p className="mt-1 text-lg font-bold text-danger">
                -{summary.totalDebitSessions} buổi
              </p>
            </div>
          </div>

          {/* Ledger Table */}
          {summary.entries.length === 0 ? (
            <div className="rounded-md border border-dashed border-hairline bg-canvas p-4 text-center text-sm text-ink-muted">
              Học viên chưa có lịch sử phát sinh số buổi.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-hairline text-xs font-semibold uppercase text-ink-subtle">
                    <th className="py-2.5 pr-3">Ngày</th>
                    <th className="py-2.5 pr-3">Loại phát sinh</th>
                    <th className="py-2.5 pr-3 text-right">Số buổi</th>
                    <th className="py-2.5 pr-3 text-right">Số dư sau</th>
                    <th className="py-2.5 pr-3">Tham chiếu</th>
                    <th className="py-2.5">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {summary.entries.map((entry) => (
                    <tr className="hover:bg-canvas/50" key={entry.id}>
                      <td className="py-2.5 pr-3 font-medium whitespace-nowrap text-ink">
                        {formatDate(entry.effectiveOn)}
                      </td>
                      <td className="py-2.5 pr-3 text-ink">
                        <Badge tone="neutral">
                          {formatLedgerEntryType(entry.entryType)}
                        </Badge>
                      </td>
                      <td
                        className={`py-2.5 pr-3 text-right font-bold whitespace-nowrap ${
                          entry.deltaSessions > 0
                            ? "text-success"
                            : "text-danger"
                        }`}
                      >
                        {formatDeltaSessions(entry.deltaSessions)}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-semibold text-ink">
                        {entry.balanceAfter}
                      </td>
                      <td className="py-2.5 pr-3 text-xs font-mono text-ink-muted">
                        {entry.referenceCode ?? "—"}
                      </td>
                      <td className="py-2.5 text-xs text-ink-muted max-w-[200px] truncate">
                        {entry.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: string): string {
  if (!value) return "Chưa cập nhật";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
