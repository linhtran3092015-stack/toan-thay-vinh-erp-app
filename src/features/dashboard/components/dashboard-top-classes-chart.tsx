import { GraduationCap } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { formatCompactVnd, formatNumber, formatVnd } from "@/features/dashboard/format";
import type { DashboardSectionState, TopGradeOrClassItem } from "@/features/dashboard/read-models";

interface DashboardTopClassesChartProps {
  section: DashboardSectionState<TopGradeOrClassItem[]>;
}

export function DashboardTopClassesChart({
  section,
}: DashboardTopClassesChartProps) {
  if (section.status === "hidden") {
    return null;
  }

  if (section.status === "error") {
    return (
      <Card className="flex h-80 items-center justify-center rounded-2xl border border-warning-border bg-warning-bg p-6 text-center text-warning">
        <div>
          <p className="font-bold">Không thể tải danh sách top khối/lớp</p>
          <p className="mt-1 text-xs text-ink-muted">Vui lòng thử lại sau.</p>
        </div>
      </Card>
    );
  }

  const items = section.data;
  const maxStudents = Math.max(1, ...items.map((i) => i.studentCount));

  return (
    <Card className="overflow-hidden rounded-2xl border border-hairline bg-surface-1 p-5 shadow-xs sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-bold text-ink sm:text-lg">
            Top 5 Lớp & Khối học tiêu biểu
          </h2>
          <p className="text-xs text-ink-muted">
            Xếp hạng theo số học viên đang học
          </p>
        </div>

        <Link
          className="text-xs font-semibold text-primary transition hover:underline"
          href="/classes"
        >
          Xem tất cả →
        </Link>
      </div>

      <div className="mt-6 grid gap-4">
        {items.length === 0 ? (
          <p className="text-xs text-ink-muted">Chưa có dữ liệu lớp học.</p>
        ) : (
          items.map((item) => {
            const widthPercent = Math.max(
              4,
              (item.studentCount / maxStudents) * 100,
            );
            return (
              <div
                className="group grid gap-1.5 rounded-xl p-2 transition hover:bg-surface-2"
                key={item.id}
                title={
                  item.revenueVnd === null
                    ? `${item.name}: ${item.studentCount} học viên`
                    : `${item.name}: ${item.studentCount} học viên · ${formatVnd(item.revenueVnd)}`
                }
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 font-bold text-ink-muted group-hover:bg-primary group-hover:text-white">
                      {item.rank}
                    </span>
                    <span className="truncate font-semibold text-ink" title={item.name}>
                      {item.name}
                    </span>
                    <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-ink-subtle">
                      {item.code}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-3 tabular-nums">
                    <span className="flex items-center gap-1 font-medium text-ink-muted">
                      <GraduationCap className="h-3.5 w-3.5 text-ink-subtle" />
                      {formatNumber(item.studentCount)} HS
                    </span>
                    {item.revenueVnd === null ? null : (
                      <span className="font-bold text-ink sm:text-sm">
                        {formatCompactVnd(item.revenueVnd)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Horizontal Progress Bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500 transition-all group-hover:brightness-110"
                    style={{ width: `${widthPercent}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
