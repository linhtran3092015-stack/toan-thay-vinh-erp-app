import Link from "next/link";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentRequestStatusBadge } from "@/features/finance/components/payment-request-status-badge";
import { getFinanceOverviewResult } from "@/features/finance/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function FinanceOverviewPage() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập Tài chính."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("finance.view")) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền finance.view."
        title="Không có quyền xem Tổng quan Tài chính"
      />
    );
  }

  const canCreatePaymentRequests =
    permissionResult.permissions.includes("payments.create_request") ||
    permissionResult.permissions.includes("payments.manage");
  const canViewPaymentRequests =
    permissionResult.permissions.includes("payments.view") ||
    permissionResult.permissions.includes("payments.manage");

  const overviewResult = await getFinanceOverviewResult();
  if (!overviewResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được dữ liệu học phí và công nợ. Vui lòng thử lại sau."
        title="Không tải được dữ liệu tài chính"
      />
    );
  }

  const overview = overviewResult.data;

  return (
    <div className="grid min-w-0 gap-4">
      {/* Header */}
      <section className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink md:text-3xl">Học phí & Tài chính</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Quản lý Yêu cầu nạp học phí, Khớp giao dịch SePay, Phân bổ cho nhiều con và Báo cáo Thu/Chi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canCreatePaymentRequests ? (
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-primary bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-strong"
                href="/finance/payment-requests/new"
              >
                Tạo yêu cầu thanh toán
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-ink-subtle">
              Tổng Thu Học phí (Thực tế)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">
              {overview.cashflowSummary.receiptVnd.toLocaleString("vi-VN")} đ
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-ink-subtle">
              Tổng Chi Hoàn phí
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-warning">
              {overview.cashflowSummary.refundVnd.toLocaleString("vi-VN")} đ
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wider text-ink-subtle">
              Số Yêu cầu Nạp tiền
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-ink">{overview.totalPaymentRequestsCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Payment Requests Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Yêu cầu Nạp học phí gần đây (VietQR)</CardTitle>
          {canViewPaymentRequests ? (
            <Link
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-primary hover:bg-primary-soft"
              href="/finance/payment-requests"
            >
              Xem tất cả
            </Link>
          ) : null}
        </CardHeader>
        <CardContent>
          {overview.recentPaymentRequests.length === 0 ? (
            <p className="text-sm text-ink-muted">Chưa có yêu cầu nạp tiền nào được khởi tạo.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-hairline text-xs font-semibold uppercase text-ink-subtle">
                    <th className="py-3 px-4">Mã yêu cầu</th>
                    <th className="py-3 px-4">Học viên</th>
                    <th className="py-3 px-4">Cú pháp SePay</th>
                    <th className="py-3 px-4">Số tiền dự kiến</th>
                    <th className="py-3 px-4">Số buổi mua/tặng</th>
                    <th className="py-3 px-4">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {overview.recentPaymentRequests.map((r) => (
                    <tr className="hover:bg-canvas/50" key={r.id}>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-ink-muted">
                        {r.publicCode}
                      </td>
                      <td className="py-3 px-4 font-semibold text-ink">
                        <Link className="hover:underline hover:text-primary" href={`/students/${r.studentId}`}>
                          {r.studentFullName}
                        </Link>
                        <span className="ml-1 text-xs font-normal text-ink-muted">({r.studentPublicCode})</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-bold text-primary">
                        {r.transferCode}
                      </td>
                      <td className="py-3 px-4 font-semibold text-ink">
                        {r.expectedAmountVnd.toLocaleString("vi-VN")} đ
                      </td>
                      <td className="py-3 px-4 text-ink">
                        <span className="font-bold">{r.purchasedSessions} buổi</span>
                        {r.bonusSessions > 0 ? (
                          <span className="ml-1 text-xs text-success">(+{r.bonusSessions} tặng)</span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4">
                        <PaymentRequestStatusBadge status={r.status} />
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
