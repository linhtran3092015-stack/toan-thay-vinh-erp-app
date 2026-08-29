import { BookOpen, CalendarCheck, CheckCheck, FileSpreadsheet, UserCheck } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { formatNumber } from "@/features/dashboard/format";
import type { DashboardSectionState, OperationalHighlightsSummary } from "@/features/dashboard/read-models";

interface DashboardOperationalHighlightsProps {
  section: DashboardSectionState<OperationalHighlightsSummary>;
}

export function DashboardOperationalHighlights({
  section,
}: DashboardOperationalHighlightsProps) {
  if (section.status === "hidden") {
    return null;
  }

  if (section.status === "error") {
    return null;
  }

  const data = section.data;

  return (
    <section aria-label="Hoạt động nổi bật trong tháng">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-ink-subtle">
          Hoạt động học vụ & vận hành nổi bật
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <HighlightItem
          helper="Lớp đang giảng dạy"
          icon={<BookOpen className="h-4 w-4 text-indigo-600" />}
          label="Lớp học đang mở"
          value={formatNumber(data.activeClassesCount)}
        />

        <HighlightItem
          helper="Đã hoàn tất điểm danh"
          icon={<CalendarCheck className="h-4 w-4 text-emerald-600" />}
          label="Buổi học đã diễn ra"
          value={formatNumber(data.completedSessionsCount)}
        />

        <HighlightItem
          helper="Tín chỉ chấm tự động"
          icon={<FileSpreadsheet className="h-4 w-4 text-violet-600" />}
          label="Tín chỉ chấm bài"
          value={formatNumber(data.gradingCreditUnits)}
        />

        <HighlightItem
          helper="Học sinh đã cải thiện"
          icon={<CheckCheck className="h-4 w-4 text-amber-600" />}
          label="Phiếu Coaching xong"
          value={formatNumber(data.closedCoachingCount)}
        />

        <HighlightItem
          helper="Giáo viên, trợ giảng, nhân viên"
          icon={<UserCheck className="h-4 w-4 text-primary" />}
          label="Nhân sự hoạt động"
          value={formatNumber(data.activeStaffCount)}
        />
      </div>
    </section>
  );
}

function HighlightItem({
  helper,
  icon,
  label,
  value,
}: {
  helper: string;
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface-1 p-3.5 shadow-xs transition hover:bg-surface-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-ink-muted truncate">
          {label}
        </p>
        <p className="font-display text-lg font-bold tabular-nums text-ink sm:text-xl">
          {value}
        </p>
        <p className="text-[10px] text-ink-subtle truncate">{helper}</p>
      </div>
    </Card>
  );
}
