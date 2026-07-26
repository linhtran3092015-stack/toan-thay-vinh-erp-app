import Link from "next/link";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreatePaymentRequestDialog } from "@/features/finance/components/create-payment-request-dialog";
import { ProcessRefundDialog } from "@/features/finance/components/process-refund-dialog";
import { getFinanceOverview } from "@/features/finance/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const canManagePayments = permissionResult.permissions.includes("payments.manage");
  const canManageRefunds = permissionResult.permissions.includes("refunds.manage");

  const overview = await getFinanceOverview();

  // Fetch student options for payment request dialog
  const supabase = await createSupabaseServerClient();
  const { data: studentRows } = await supabase
    .from("students")
    .select("id, full_name, public_code")
    .eq("lifecycle_status", "active")
    .order("full_name")
    .limit(100);

  const activeStudents = (studentRows ?? []).map((s) => ({
    id: s.id,
    name: s.full_name,
    publicCode: s.public_code,
  }));

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
            {canManageRefunds ? <ProcessRefundDialog students={activeStudents} /> : null}
            {canManagePayments ? <CreatePaymentRequestDialog students={activeStudents} /> : null}
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
                        <Badge tone={r.status === "paid" ? "success" : "warning"}>
                          {r.status === "paid" ? "Đã nạp" : "Chờ chuyển khoản"}
                        </Badge>
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
