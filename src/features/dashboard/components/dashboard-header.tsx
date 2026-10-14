"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { getButtonClassName } from "@/components/ui/button";
import { formatDateTime, formatMonthYear } from "@/features/dashboard/format";

interface DashboardHeaderProps {
  availableMonths: readonly string[];
  /** Route the month picker navigates on; may already carry a query (dev preview). */
  hrefBase?: string;
  lastUpdatedAt: string;
  selectedMonth: string;
}

/**
 * Header of the "Phân tích" section under the home dashboard: section title,
 * data timestamp, the real month picker and the browser print export.
 */
export function DashboardHeader({ availableMonths, hrefBase = "/", lastUpdatedAt, selectedMonth }: DashboardHeaderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  const handleMonthChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const month = event.target.value;
    startTransition(() => {
      router.push(`${hrefBase}${hrefBase.includes("?") ? "&" : "?"}month=${month}`);
    });
  };

  // Printing is the browser's own dialog; no fake progress.
  const handleExport = () => {
    setIsExporting(true);
    window.print();
    setIsExporting(false);
  };

  return (
    <header className="flex flex-col gap-3 border-t border-border-subtle pt-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h2 className="text-section-title font-semibold tracking-[-0.01em] text-text-strong" id="dashboard-analytics-title">
          Phân tích
        </h2>
        <p className="mt-0.5 text-secondary text-text-muted">
          Số liệu {formatMonthYear(selectedMonth).toLowerCase()} · cập nhật {formatDateTime(lastUpdatedAt)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isPending ? (
          <span className="text-secondary text-text-muted" role="status">
            Đang tải số liệu tháng…
          </span>
        ) : null}
        <select
          aria-label="Chọn kỳ xem báo cáo"
          className="h-10 rounded-md border border-border-strong bg-surface-base px-3 text-control text-text-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:bg-disabled-bg max-md:h-11"
          disabled={isPending}
          onChange={handleMonthChange}
          value={selectedMonth}
        >
          {availableMonths.map((month) => (
            <option key={month} value={month}>
              {formatMonthYear(month)}
            </option>
          ))}
        </select>

        <button
          className={getButtonClassName({ className: "max-md:h-11", variant: "secondary" })}
          disabled={isExporting}
          onClick={handleExport}
          type="button"
        >
          <Download aria-hidden="true" className="h-4 w-4" />
          <span>{isExporting ? "Đang tạo..." : "Xuất báo cáo"}</span>
        </button>
      </div>
    </header>
  );
}
