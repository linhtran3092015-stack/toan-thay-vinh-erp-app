"use client";

import { Calendar, Download, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatDateTime, formatMonthYear } from "@/features/dashboard/format";

interface DashboardHeaderProps {
  availableMonths: readonly string[];
  centerDisplayName?: string;
  displayName?: string | null;
  lastUpdatedAt: string;
  selectedMonth: string;
}

export function DashboardHeader({
  availableMonths,
  centerDisplayName = "Trung tâm",
  displayName = "Chủ trung tâm",
  lastUpdatedAt,
  selectedMonth,
}: DashboardHeaderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = e.target.value;
    startTransition(() => {
      router.push(`/?month=${newMonth}`);
    });
  };

  // Printing is the browser's own dialog; no fake progress.
  const handleExport = () => {
    setIsExporting(true);
    window.print();
    setIsExporting(false);
  };

  return (
    <header className="rounded-2xl border border-hairline bg-surface-1 p-5 shadow-xs sm:p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
              {centerDisplayName} · Tổng quan điều hành
            </p>
          </div>

          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Chào mừng, {displayName || "Chủ trung tâm"} 👋
          </h1>

          <p className="mt-1.5 text-xs text-ink-muted sm:text-sm">
            Tổng quan hoạt động, tình hình tài chính, tuyển sinh và cảnh báo ưu tiên xử lý.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-hairline bg-surface-2 px-3 py-2 text-xs text-ink-muted">
            <RefreshCw className={`h-3.5 w-3.5 text-ink-subtle ${isPending ? "animate-spin text-primary" : ""}`} />
            <span>Cập nhật: {formatDateTime(lastUpdatedAt)}</span>
          </div>

          <div className="relative inline-flex items-center">
            <div className="pointer-events-none absolute left-3 flex items-center text-ink-subtle">
              <Calendar className="h-4 w-4" />
            </div>
            <select
              aria-label="Chọn kỳ xem báo cáo"
              className="appearance-none rounded-xl border border-hairline bg-surface-1 py-2 pl-9 pr-8 text-xs font-semibold text-ink shadow-xs transition hover:border-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
              disabled={isPending}
              onChange={handleMonthChange}
              value={selectedMonth}
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthYear(m)}
                </option>
              ))}
            </select>
          </div>

          <button
            className="inline-flex items-center gap-2 rounded-xl border border-hairline bg-surface-1 px-3.5 py-2 text-xs font-semibold text-ink shadow-xs transition hover:bg-surface-2 focus:outline-none active:scale-[0.98] sm:text-sm"
            disabled={isExporting}
            onClick={handleExport}
            type="button"
          >
            <Download className="h-4 w-4 text-ink-subtle" />
            <span>{isExporting ? "Đang tạo..." : "Xuất báo cáo"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
