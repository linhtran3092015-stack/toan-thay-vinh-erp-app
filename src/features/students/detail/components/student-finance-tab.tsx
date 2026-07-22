import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionBalanceBadge } from "@/features/students/components/session-balance-badge";
import {
  formatCurrency,
  formatDeltaSessions,
  ledgerTypeMeta,
  topupStatusMeta,
  topupTypeMeta,
} from "@/features/students/detail/helpers";
import type { StudentDetail } from "@/features/students/detail/types";

interface StudentFinanceTabProps {
  detail: StudentDetail;
}

export function StudentFinanceTab({ detail }: StudentFinanceTabProps) {
  const { student, summary } = detail;
  const estimatedDebt =
    student.sessionBalance < 0
      ? Math.abs(student.sessionBalance) * summary.currentUnitPrice
      : 0;

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <FinanceMetric label="Số dư hiện tại">
          <SessionBalanceBadge balance={student.sessionBalance} />
        </FinanceMetric>
        <FinanceMetric label="Đơn giá hiện tại">
          {formatCurrency(summary.currentUnitPrice)}
        </FinanceMetric>
        <FinanceMetric label="Tổng buổi đã mua">
          {summary.totalPurchasedSessions}
        </FinanceMetric>
        <FinanceMetric label="Tổng buổi tặng">
          {summary.totalBonusSessions}
        </FinanceMetric>
        <FinanceMetric label="Tổng buổi đã dùng">
          {summary.totalUsedSessions}
        </FinanceMetric>
        <FinanceMetric label="Công nợ tạm tính">
          {estimatedDebt > 0 ? formatCurrency(estimatedDebt) : "0đ"}
        </FinanceMetric>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Lịch sử nạp tiền</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden max-w-full overflow-x-auto lg:block">
            <table className="min-w-[920px] border-separate border-spacing-0 text-left text-sm">
              <thead className="bg-canvas text-xs uppercase tracking-[0.08em] text-ink-subtle">
                <tr>
                  <TableHeader>Ngày</TableHeader>
                  <TableHeader>Số tiền</TableHeader>
                  <TableHeader>Số buổi trả phí</TableHeader>
                  <TableHeader>Số buổi tặng</TableHeader>
                  <TableHeader>Đơn giá thực tế</TableHeader>
                  <TableHeader>Loại</TableHeader>
                  <TableHeader>Trạng thái</TableHeader>
                </tr>
              </thead>
              <tbody>
                {detail.topups.map((topup) => {
                  const status = topupStatusMeta[topup.status];

                  return (
                    <tr className="hover:bg-[#F8FAFF]" key={topup.id}>
                      <TableCell>{topup.date}</TableCell>
                      <TableCell>{formatCurrency(topup.amount)}</TableCell>
                      <TableCell>{topup.paidSessions}</TableCell>
                      <TableCell>{topup.bonusSessions}</TableCell>
                      <TableCell>{formatCurrency(topup.effectiveUnitPrice)}</TableCell>
                      <TableCell>{topupTypeMeta[topup.type]}</TableCell>
                      <TableCell>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </TableCell>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 p-4 lg:hidden">
            {detail.topups.map((topup) => {
              const status = topupStatusMeta[topup.status];

              return (
                <article className="rounded-md border border-hairline bg-canvas p-3" key={topup.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-ink">{topup.date}</h3>
                      <p className="mt-1 text-sm text-ink-muted">
                        {formatCurrency(topup.amount)}
                      </p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <Info label="Trả phí" value={`${topup.paidSessions} buổi`} />
                    <Info label="Tặng" value={`${topup.bonusSessions} buổi`} />
                    <Info label="Đơn giá" value={formatCurrency(topup.effectiveUnitPrice)} />
                    <Info label="Loại" value={topupTypeMeta[topup.type]} />
                  </div>
                </article>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sổ cái số buổi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden max-w-full overflow-x-auto lg:block">
            <table className="min-w-[1060px] border-separate border-spacing-0 text-left text-sm">
              <thead className="bg-canvas text-xs uppercase tracking-[0.08em] text-ink-subtle">
                <tr>
                  <TableHeader>Ngày</TableHeader>
                  <TableHeader>Loại phát sinh</TableHeader>
                  <TableHeader>Số buổi tăng/giảm</TableHeader>
                  <TableHeader>Số dư sau</TableHeader>
                  <TableHeader>Tham chiếu</TableHeader>
                  <TableHeader>Người thực hiện</TableHeader>
                  <TableHeader>Ghi chú</TableHeader>
                </tr>
              </thead>
              <tbody>
                {detail.ledger.map((entry) => (
                  <tr className="hover:bg-[#F8FAFF]" key={entry.id}>
                    <TableCell>{entry.date}</TableCell>
                    <TableCell>{ledgerTypeMeta[entry.type]}</TableCell>
                    <TableCell>
                      <span
                        className={
                          entry.delta >= 0
                            ? "font-semibold text-success"
                            : "font-semibold text-danger"
                        }
                      >
                        {formatDeltaSessions(entry.delta)}
                      </span>
                    </TableCell>
                    <TableCell>{entry.balanceAfter}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-ink-muted">
                        {entry.reference}
                      </span>
                    </TableCell>
                    <TableCell>{entry.actorName}</TableCell>
                    <TableCell>{entry.note}</TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 p-4 lg:hidden">
            {detail.ledger.map((entry) => (
              <article className="rounded-md border border-hairline bg-canvas p-3" key={entry.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink">{entry.date}</h3>
                    <p className="mt-1 text-sm text-ink-muted">
                      {ledgerTypeMeta[entry.type]}
                    </p>
                  </div>
                  <span
                    className={
                      entry.delta >= 0
                        ? "font-bold text-success"
                        : "font-bold text-danger"
                    }
                  >
                    {formatDeltaSessions(entry.delta)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <Info label="Số dư sau" value={String(entry.balanceAfter)} />
                  <Info label="Người thực hiện" value={entry.actorName} />
                  <Info label="Tham chiếu" value={entry.reference} />
                  <Info label="Ghi chú" value={entry.note} />
                </div>
              </article>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FinanceMetric({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <div className="min-h-8 text-lg font-bold text-ink tabular-nums">
        {children}
      </div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-subtle">
        {label}
      </p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}

function TableHeader({ children }: { children: ReactNode }) {
  return (
    <th className="whitespace-nowrap border-b border-hairline px-4 py-3 font-semibold">
      {children}
    </th>
  );
}

function TableCell({ children }: { children: ReactNode }) {
  return (
    <td className="border-b border-hairline px-4 py-3 align-middle text-ink">
      {children}
    </td>
  );
}
