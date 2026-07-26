import Link from "next/link";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSepayTransactions } from "@/features/finance/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function SepayTransactionsPage() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập Giao dịch SePay."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("sepay.view")) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền sepay.view."
        title="Không có quyền xem Giao dịch SePay"
      />
    );
  }

  const transactions = await getSepayTransactions();

  return (
    <div className="grid min-w-0 gap-4">
      {/* Header */}
      <section className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card md:p-5">
        <nav className="mb-2 flex items-center gap-2 text-sm text-ink-muted">
          <Link className="font-semibold text-primary hover:underline" href="/finance">
            Tài chính
          </Link>
          <span>/</span>
          <span className="font-semibold text-ink">Giao dịch SePay</span>
        </nav>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">Lịch sử Giao dịch Ngân hàng SePay</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Nhật ký chuyển khoản ngân hàng được ghi nhận tự động qua SePay Webhook và kết quả khớp học viên.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách Giao dịch SePay ({transactions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-ink-muted">Chưa có giao dịch SePay nào được ghi nhận.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-hairline text-xs font-semibold uppercase text-ink-subtle">
                    <th className="py-3 px-4">Mã GD SePay</th>
                    <th className="py-3 px-4">Thời gian</th>
                    <th className="py-3 px-4">Ngân hàng & STK</th>
                    <th className="py-3 px-4">Số tiền</th>
                    <th className="py-3 px-4">Nội dung chuyển khoản</th>
                    <th className="py-3 px-4">Trạng thái Khớp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {transactions.map((t) => (
                    <tr className="hover:bg-canvas/50" key={t.id}>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-ink-muted">
                        {t.bankTransactionId}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-ink">
                        {formatDateTime(t.transactionAt)}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <p className="font-bold text-ink">{t.bankBrand}</p>
                        <p className="font-mono text-ink-muted">{t.accountNumber}</p>
                      </td>
                      <td className="py-3 px-4 font-bold text-success">
                        +{t.amountVnd.toLocaleString("vi-VN")} đ
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate font-mono text-xs text-ink" title={t.transferContent}>
                        {t.transferContent}
                      </td>
                      <td className="py-3 px-4">
                        <Badge tone={t.matchStatus === "auto_matched" ? "success" : t.matchStatus === "split_allocated" ? "purple" : "neutral"}>
                          {t.matchStatus === "auto_matched"
                            ? `Khớp tự động (${t.matchedPaymentRequestCode ?? ""})`
                            : t.matchStatus === "split_allocated"
                              ? "Phân bổ nhiều con"
                              : "Chưa khớp"}
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

function formatDateTime(value: string): string {
  try {
    const d = new Date(value);
    return `${d.toLocaleDateString("vi-VN")} ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return value;
  }
}
