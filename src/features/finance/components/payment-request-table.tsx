import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { PaymentRequestStatusBadge } from "@/features/finance/components/payment-request-status-badge";
import type { PaymentRequestReadModel } from "@/features/finance/read-models";

interface PaymentRequestTableProps {
  items: PaymentRequestReadModel[];
}

export function PaymentRequestTable({ items }: PaymentRequestTableProps) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-hairline bg-surface-1 shadow-card lg:block">
        <table className="min-w-[1180px] w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs font-semibold uppercase text-ink-subtle">
            <tr>
              <th className="px-4 py-3">Mã yêu cầu</th>
              <th className="px-4 py-3">Học viên</th>
              <th className="px-4 py-3">Phụ huynh</th>
              <th className="px-4 py-3">Gói buổi học</th>
              <th className="px-4 py-3 text-right">Dự kiến</th>
              <th className="px-4 py-3 text-right">Đã nhận</th>
              <th className="px-4 py-3">Nội dung CK</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Ngày tạo</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {items.map((item) => (
              <tr className="align-top hover:bg-canvas/60" key={item.id}>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-ink-muted">
                  {item.publicCode}
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">{item.studentFullName}</p>
                  <p className="mt-1 text-xs text-ink-muted">{item.studentPublicCode}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{item.guardianFullName ?? "Chưa cập nhật"}</p>
                  <p className="mt-1 text-xs text-ink-muted">{item.guardianPhone ?? "Chưa có SĐT"}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={item.topupType === "renewal" ? "purple" : "info"}>
                      {item.topupType === "renewal" ? "Tái phí" : "Tuyển mới"}
                    </Badge>
                    <span className="font-semibold text-ink">
                      {item.purchasedSessions} buổi
                    </span>
                  </div>
                  {item.bonusSessions > 0 ? (
                    <p className="mt-1 text-xs font-semibold text-success">
                      Tặng {item.bonusSessions} buổi
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-ink">
                  {formatCurrency(item.expectedAmountVnd)}
                </td>
                <td className="px-4 py-3 text-right">
                  <p className="font-semibold text-ink">{formatCurrency(item.paidAmountVnd)}</p>
                  {item.paidAmountVnd < item.expectedAmountVnd ? (
                    <p className="mt-1 text-xs text-ink-muted">
                      Còn {formatCurrency(item.expectedAmountVnd - item.paidAmountVnd)}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 font-mono text-xs font-bold text-primary">
                  {item.transferCode}
                </td>
                <td className="px-4 py-3">
                  <PaymentRequestStatusBadge status={item.status} />
                </td>
                <td className="px-4 py-3 text-ink-muted">{formatDate(item.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  {item.studentId ? (
                    <Link
                      className="inline-flex min-h-11 items-center rounded-md px-3 font-semibold text-primary hover:bg-primary-soft"
                      href={`/students/${item.studentId}`}
                    >
                      Hồ sơ
                    </Link>
                  ) : (
                    <span className="text-xs text-ink-subtle">Không có</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {items.map((item) => (
          <PaymentRequestMobileCard item={item} key={item.id} />
        ))}
      </div>
    </>
  );
}

function PaymentRequestMobileCard({ item }: { item: PaymentRequestReadModel }) {
  return (
    <article className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{item.studentFullName}</p>
          <p className="mt-1 font-mono text-xs text-ink-muted">
            {item.publicCode} · {item.studentPublicCode}
          </p>
        </div>
        <PaymentRequestStatusBadge status={item.status} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-xs font-semibold text-ink-muted">Dự kiến</dt>
          <dd className="mt-1 font-bold text-ink">{formatCurrency(item.expectedAmountVnd)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-ink-muted">Đã nhận</dt>
          <dd className="mt-1 font-bold text-ink">{formatCurrency(item.paidAmountVnd)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-ink-muted">Gói buổi học</dt>
          <dd className="mt-1 text-ink">
            {item.purchasedSessions} buổi
            {item.bonusSessions > 0 ? ` + ${item.bonusSessions} tặng` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-ink-muted">Ngày tạo</dt>
          <dd className="mt-1 text-ink">{formatDate(item.createdAt)}</dd>
        </div>
      </dl>

      <div className="mt-4 rounded-md bg-surface-2 px-3 py-2">
        <p className="text-xs font-semibold text-ink-muted">Nội dung chuyển khoản</p>
        <p className="mt-1 break-all font-mono text-sm font-bold text-primary">
          {item.transferCode}
        </p>
      </div>

      {item.studentId ? (
        <Link
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-hairline bg-surface-1 px-4 text-sm font-semibold text-ink hover:bg-surface-2"
          href={`/students/${item.studentId}`}
        >
          Xem hồ sơ học viên
        </Link>
      ) : null}
    </article>
  );
}

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  currency: "VND",
  maximumFractionDigits: 0,
  style: "currency",
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

