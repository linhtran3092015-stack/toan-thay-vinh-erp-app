import { Target } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { formatNumber, formatPercent } from "@/features/dashboard/format";
import type { AdmissionsFunnelSummary, DashboardSectionState } from "@/features/dashboard/read-models";

interface DashboardAdmissionsFunnelProps {
  section: DashboardSectionState<AdmissionsFunnelSummary>;
}

export function DashboardAdmissionsFunnel({
  section,
}: DashboardAdmissionsFunnelProps) {
  if (section.status === "hidden") {
    return null;
  }

  if (section.status === "error") {
    return (
      <Card className="flex h-80 items-center justify-center rounded-2xl border border-warning-border bg-warning-bg p-6 text-center text-warning">
        <div>
          <p className="font-bold">Không thể tải phễu tuyển sinh</p>
          <p className="mt-1 text-xs text-ink-muted">Vui lòng thử lại sau.</p>
        </div>
      </Card>
    );
  }

  const data = section.data;

  return (
    <Card className="overflow-hidden rounded-2xl border border-hairline bg-surface-1 p-5 shadow-xs sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-bold text-ink sm:text-lg">
            Tình hình tuyển sinh & Phễu chuyển đổi
          </h2>
          <p className="text-xs text-ink-muted">
            Theo dõi tiến trình từ tiếp cận nguồn lead đến nhập học chính thức
          </p>
        </div>

        <Link
          className="text-xs font-semibold text-primary transition hover:underline"
          href="/crm"
        >
          Mở CRM →
        </Link>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_auto]">
        {/* Funnel Steps */}
        <div className="space-y-2.5">
          {data.steps.map((step, index) => {
            const barWidth = Math.max(12, step.percentage);
            return (
              <div className="group grid gap-1 text-xs" key={step.key}>
                <div className="flex items-center justify-between font-medium text-ink">
                  <span className="flex items-center gap-1.5">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-surface-2 text-[10px] font-bold text-ink-subtle">
                      {index + 1}
                    </span>
                    {step.label}
                  </span>
                  <div className="flex items-center gap-2 tabular-nums">
                    <strong className="text-ink sm:text-sm">
                      {formatNumber(step.count)}
                    </strong>
                    <span className="w-12 text-right text-ink-muted">
                      ({formatPercent(step.percentage)})
                    </span>
                  </div>
                </div>

                <div className="h-3 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full transition-all group-hover:brightness-105"
                    style={{
                      backgroundColor:
                        index === 0
                          ? "#315FCC"
                          : index === 1
                            ? "#4F46E5"
                            : index === 2
                              ? "#8B5FBF"
                              : index === 3
                                ? "#0284C7"
                                : "#16794C",
                      width: `${barWidth}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Card / Conversion Rate */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:min-w-[190px]">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
              <Target className="h-4 w-4" />
              Tỷ lệ chuyển đổi
            </div>
            <p className="mt-2 font-display text-3xl font-bold tracking-tight text-primary sm:text-4xl">
              {formatPercent(data.conversionRatePercent)}
            </p>
            <p className="mt-1 text-[11px] text-ink-muted">
              Từ {formatNumber(data.totalLeads)} tiềm năng đến nhập học
            </p>
          </div>

          {data.topSources.length > 0 ? (
            <div className="border-t border-primary/10 pt-3">
              <p className="text-[11px] font-semibold text-ink-muted">
                Nguồn chính:
              </p>
              <div className="mt-1.5 space-y-1">
                {data.topSources.slice(0, 3).map((s) => (
                  <div
                    className="flex items-center justify-between text-xs font-medium text-ink"
                    key={s.name}
                  >
                    <span className="truncate text-ink-muted" title={s.name}>
                      {s.name}
                    </span>
                    <span className="font-bold tabular-nums">
                      {formatNumber(s.count)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
