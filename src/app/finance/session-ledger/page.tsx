import Link from "next/link";

import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCenterSessionLedgerEntries } from "@/features/finance/data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

export default async function CenterSessionLedgerPage() {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập Sổ cái số buổi."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("session_ledger.view")) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền session_ledger.view."
        title="Không có quyền xem Sổ cái số buổi"
      />
    );
  }

  const entries = await getCenterSessionLedgerEntries();

  return (
    <div className="grid min-w-0 gap-4">
      {/* Header */}
      <section className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card md:p-5">
        <nav className="mb-2 flex items-center gap-2 text-sm text-ink-muted">
          <Link className="font-semibold text-primary hover:underline" href="/finance">
            Tài chính
          </Link>
          <span>/</span>
          <span className="font-semibold text-ink">Sổ cái số buổi</span>
        </nav>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">Sổ cái Số buổi toàn Trung tâm</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Nhật ký biến động số buổi học (nạp học phí, thưởng, trừ buổi điểm danh, đảo trừ, hoàn phí) toàn trung tâm.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Nhật ký biến động Sổ cái ({entries.length} giao dịch gần nhất)</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-ink-muted">Chưa có giao dịch sổ cái nào được ghi nhận.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-hairline text-xs font-semibold uppercase text-ink-subtle">
                    <th className="py-3 px-4">Ngày hiệu lực</th>
                    <th className="py-3 px-4">Học viên</th>
                    <th className="py-3 px-4">Loại biến động</th>
                    <th className="py-3 px-4">Số buổi (+/-)</th>
                    <th className="py-3 px-4">Đơn giá VND</th>
                    <th className="py-3 px-4">Mã tham chiếu</th>
                    <th className="py-3 px-4">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {entries.map((e) => (
                    <tr className="hover:bg-canvas/50" key={e.id}>
                      <td className="py-3 px-4 text-xs font-medium text-ink-muted">
                        {formatDate(e.effectiveOn)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-ink">
                        <Link className="hover:underline hover:text-primary" href={`/students/${e.studentId}`}>
                          {e.studentFullName}
                        </Link>
                        <span className="ml-1 text-xs font-normal text-ink-muted">({e.studentPublicCode})</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge tone={getEntryTone(e.entryType)}>
                          {getEntryLabel(e.entryType)}
                        </Badge>
                      </td>
                      <td className={`py-3 px-4 font-bold ${e.deltaSessions > 0 ? "text-success" : "text-danger"}`}>
                        {e.deltaSessions > 0 ? `+${e.deltaSessions}` : e.deltaSessions} buổi
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-ink">
                        {e.unitPriceVnd > 0 ? `${e.unitPriceVnd.toLocaleString("vi-VN")} đ` : "-"}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-ink-muted">
                        {e.referenceCode ?? "-"}
                      </td>
                      <td className="py-3 px-4 text-xs text-ink max-w-xs truncate" title={e.note ?? ""}>
                        {e.note ?? "-"}
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

function getEntryTone(type: string): "danger" | "info" | "neutral" | "purple" | "success" | "warning" {
  switch (type) {
    case "payment_credit":
      return "success";
    case "bonus_credit":
      return "purple";
    case "session_charge":
      return "danger";
    case "session_reversal":
      return "info";
    case "refund_debit":
      return "warning";
    default:
      return "neutral";
  }
}

function getEntryLabel(type: string): string {
  switch (type) {
    case "payment_credit":
      return "Nạp học phí (+)";
    case "bonus_credit":
      return "Thưởng buổi (+)";
    case "session_charge":
      return "Trừ buổi (-)";
    case "session_reversal":
      return "Đảo trừ (+)";
    case "refund_debit":
      return "Hoàn phí (-)";
    case "manual_adjustment":
      return "Điều chỉnh thủ công";
    default:
      return type;
  }
}

function formatDate(value: string): string {
  if (!value) return "";
  const parts = value.split("T")[0].split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
