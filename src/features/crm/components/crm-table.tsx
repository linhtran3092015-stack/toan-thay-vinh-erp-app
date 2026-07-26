import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { CrmStatusBadge } from "@/features/crm/components/crm-status-badge";
import type { CrmLeadItemReadModel } from "@/features/crm/read-models";

interface CrmTableProps {
  items: CrmLeadItemReadModel[];
}

export function CrmTable({ items }: CrmTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-hairline bg-surface-1 p-8 text-center text-sm text-ink-muted">
        Không tìm thấy lead / học viên tiềm năng nào phù hợp.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Desktop Table View */}
      <div className="hidden overflow-x-auto rounded-lg border border-hairline bg-surface-1 shadow-card md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-hairline text-xs font-semibold uppercase text-ink-subtle">
              <th className="py-3 px-4">Mã Lead</th>
              <th className="py-3 px-4">Họ và tên học viên</th>
              <th className="py-3 px-4">Khối / Mức</th>
              <th className="py-3 px-4">Phụ huynh & SĐT</th>
              <th className="py-3 px-4">Nguồn Lead</th>
              <th className="py-3 px-4">Sale phụ trách</th>
              <th className="py-3 px-4">Trạng thái</th>
              <th className="py-3 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {items.map((item) => (
              <tr className="hover:bg-canvas/50" key={item.id}>
                <td className="py-3 px-4 font-mono text-xs font-semibold text-ink-muted">
                  {item.publicCode}
                </td>
                <td className="py-3 px-4 font-semibold text-ink">
                  <Link className="hover:underline hover:text-primary" href={`/crm/${item.id}`}>
                    {item.fullName}
                  </Link>
                  {item.birthYear ? (
                    <span className="ml-2 text-xs font-normal text-ink-muted">({item.birthYear})</span>
                  ) : null}
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    <Badge tone="info">Khối {item.expectedGrade}</Badge>
                    {item.expectedLevel ? <Badge tone="purple">Mức {item.expectedLevel}</Badge> : null}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <p className="font-medium text-ink">{item.guardianFullName}</p>
                  <p className="text-xs font-mono text-ink-muted">{item.guardianPhone}</p>
                </td>
                <td className="py-3 px-4 text-xs font-medium text-ink-muted">
                  {item.leadSourceName}
                </td>
                <td className="py-3 px-4 font-medium text-ink">
                  {item.saleOwnerName ?? "Chưa phân công"}
                </td>
                <td className="py-3 px-4">
                  <CrmStatusBadge status={item.status} />
                </td>
                <td className="py-3 px-4 text-right">
                  <Link
                    className="inline-flex min-h-8 items-center justify-center rounded-md border border-hairline bg-white px-3 text-xs font-semibold text-ink transition-colors hover:border-secondary hover:bg-canvas"
                    href={`/crm/${item.id}`}
                  >
                    Chi tiết
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View */}
      <div className="grid gap-3 md:hidden">
        {items.map((item) => (
          <div className="rounded-lg border border-hairline bg-surface-1 p-4 shadow-card" key={item.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-xs font-semibold text-ink-muted">{item.publicCode}</span>
                <h3 className="mt-0.5 text-base font-bold text-ink">
                  <Link href={`/crm/${item.id}`}>{item.fullName}</Link>
                </h3>
              </div>
              <CrmStatusBadge status={item.status} />
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <Badge tone="info">Khối {item.expectedGrade}</Badge>
              {item.expectedLevel ? <Badge tone="purple">Mức {item.expectedLevel}</Badge> : null}
              {item.expectedMode ? <Badge tone="neutral">{item.expectedMode}</Badge> : null}
            </div>

            <div className="mt-3 grid gap-1 border-t border-hairline pt-3 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-muted">Phụ huynh:</span>
                <span className="font-medium text-ink">{item.guardianFullName} ({item.guardianPhone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Nguồn:</span>
                <span className="text-ink">{item.leadSourceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Sale:</span>
                <span className="font-semibold text-ink">{item.saleOwnerName ?? "Chưa phân công"}</span>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <Link
                className="inline-flex min-h-8 w-full items-center justify-center rounded-md border border-hairline bg-white px-3 text-xs font-semibold text-ink transition-colors hover:border-secondary"
                href={`/crm/${item.id}`}
              >
                Xem hồ sơ CRM
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
