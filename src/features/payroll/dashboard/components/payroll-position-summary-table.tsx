"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";

import { formatPercent, formatVnd } from "@/features/payroll/dashboard/format";
import type { PayrollDashboardPositionSummary } from "@/features/payroll/dashboard/read-models";

type SortKey = "averagePayroll" | "employeeCount" | "highestPayroll" | "lowestPayroll" | "positionName" | "sharePercent" | "totalPayroll";

export function PayrollPositionSummaryTable({ items }: { items: readonly PayrollDashboardPositionSummary[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("totalPayroll");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const sortedItems = useMemo(() => [...items].sort((left, right) => {
    const leftValue = left[sortKey];
    const rightValue = right[sortKey];
    const comparison = typeof leftValue === "string"
      ? leftValue.localeCompare(String(rightValue), "vi")
      : leftValue - Number(rightValue);
    return direction === "asc" ? comparison : -comparison;
  }), [direction, items, sortKey]);

  const changeSort = (nextKey: SortKey) => {
    if (nextKey === sortKey) setDirection((current) => current === "asc" ? "desc" : "asc");
    else {
      setSortKey(nextKey);
      setDirection(nextKey === "positionName" ? "asc" : "desc");
    }
  };

  return (
    <section className="overflow-hidden rounded-lg border border-border-subtle bg-surface-base" aria-labelledby="position-summary-title">
      <div className="border-b border-border-subtle px-5 py-4">
        <h2 className="text-section-title font-semibold text-text-strong" id="position-summary-title">Tổng hợp theo vị trí</h2>
        <p className="mt-1 text-secondary text-text-muted">Chọn tiêu đề cột để sắp xếp.</p>
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="min-w-[900px] w-full text-table-body text-text-default">
          <caption className="sr-only">Tổng hợp chi phí lương theo vị trí</caption>
          <thead className="bg-surface-sunken text-table-header">
            <tr>
              <SortableHeader activeKey={sortKey} direction={direction} label="Vị trí" onSort={changeSort} sortKey="positionName" />
              <SortableHeader activeKey={sortKey} direction={direction} label="Nhân sự" onSort={changeSort} sortKey="employeeCount" align="right" />
              <SortableHeader activeKey={sortKey} direction={direction} label="Tổng lương" onSort={changeSort} sortKey="totalPayroll" align="right" />
              <SortableHeader activeKey={sortKey} direction={direction} label="TB/người" onSort={changeSort} sortKey="averagePayroll" align="right" />
              <SortableHeader activeKey={sortKey} direction={direction} label="Cao nhất" onSort={changeSort} sortKey="highestPayroll" align="right" />
              <SortableHeader activeKey={sortKey} direction={direction} label="Thấp nhất" onSort={changeSort} sortKey="lowestPayroll" align="right" />
              <SortableHeader activeKey={sortKey} direction={direction} label="% tổng" onSort={changeSort} sortKey="sharePercent" align="right" />
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item) => (
              <tr className="border-t border-border-subtle hover:bg-interactive-hover" key={item.positionCode}>
                <td className="h-14 px-4 font-semibold text-text-strong">{item.positionName}</td>
                <NumberCell>{item.employeeCount}</NumberCell>
                <NumberCell strong>{formatVnd(item.totalPayroll)}</NumberCell>
                <NumberCell>{formatVnd(Math.round(item.averagePayroll))}</NumberCell>
                <NumberCell>{formatVnd(item.highestPayroll)}</NumberCell>
                <NumberCell>{formatVnd(item.lowestPayroll)}</NumberCell>
                <NumberCell>{formatPercent(item.sharePercent)}</NumberCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 p-4 sm:hidden" role="list" aria-label="Tổng hợp chi phí lương theo vị trí trên thiết bị nhỏ">
        {sortedItems.map((item) => (
          <article className="rounded-md border border-border-subtle p-4" key={item.positionCode} role="listitem">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-text-strong">{item.positionName}</h3>
              <span className="tabular-nums text-secondary font-semibold text-text-strong">{formatPercent(item.sharePercent)}</span>
            </div>
            <p className="mt-2 tabular-nums text-body font-bold text-text-strong">{formatVnd(item.totalPayroll)}</p>
            <p className="mt-1 text-caption text-text-muted">{item.employeeCount} nhân sự · TB {formatVnd(Math.round(item.averagePayroll))}</p>
            <p className="mt-1 text-caption text-text-muted">Thấp nhất {formatVnd(item.lowestPayroll)} · Cao nhất {formatVnd(item.highestPayroll)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function NumberCell({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return <td className={`h-14 px-4 text-right tabular-nums ${strong ? "font-semibold text-text-strong" : ""}`}>{children}</td>;
}

function SortableHeader({
  activeKey,
  align = "left",
  direction,
  label,
  onSort,
  sortKey,
}: {
  activeKey: SortKey;
  align?: "left" | "right";
  direction: "asc" | "desc";
  label: string;
  onSort: (key: SortKey) => void;
  sortKey: SortKey;
}) {
  const active = activeKey === sortKey;
  const Icon = active ? (direction === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;
  return (
    <th className="h-10 px-2 font-semibold" scope="col">
      <button
        aria-label={`Sắp xếp theo ${label}`}
        className={`flex min-h-9 w-full items-center gap-1 rounded px-2 hover:bg-interactive-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring ${align === "right" ? "justify-end" : "justify-start"}`}
        onClick={() => onSort(sortKey)}
        type="button"
      >
        {label}<Icon aria-hidden="true" className={active ? "text-action-link" : "text-text-subtle"} size={14} />
      </button>
    </th>
  );
}
