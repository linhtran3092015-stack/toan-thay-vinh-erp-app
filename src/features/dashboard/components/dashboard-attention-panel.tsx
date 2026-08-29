import { AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, Info } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { AttentionItem, DashboardSectionState } from "@/features/dashboard/read-models";

interface DashboardAttentionPanelProps {
  section: DashboardSectionState<AttentionItem[]>;
}

export function DashboardAttentionPanel({ section }: DashboardAttentionPanelProps) {
  if (section.status === "hidden") {
    return null;
  }

  if (section.status === "error") {
    return (
      <div className="rounded-2xl border border-warning-border bg-warning-bg p-4 text-warning">
        <p className="text-xs font-bold">Không thể tải danh sách cảnh báo cần chú ý</p>
      </div>
    );
  }

  const items = section.data;

  return (
    <Card className="overflow-hidden rounded-2xl border border-hairline bg-surface-1 p-5 shadow-xs sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:bg-amber-500/20">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-ink sm:text-lg">
              Trung tâm cần chú ý
            </h2>
            <p className="text-xs text-ink-muted">
              Các đầu việc quan trọng và cảnh báo cần Chủ trung tâm ưu tiên xử lý
            </p>
          </div>
        </div>

        {items.length > 0 ? (
          <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
            {items.length} việc cần xử lý
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Tất cả ổn định
          </span>
        )}
      </div>

      <div className="mt-4">
        {items.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-sm font-semibold">
                Không có vấn đề quan trọng cần xử lý
              </p>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                Toàn bộ bảng lương, yêu cầu chấm công, công nợ và lớp học đang vận hành đúng tiến độ.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <AttentionCard item={item} key={item.id} />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function AttentionCard({ item }: { item: AttentionItem }) {
  const isDanger = item.severity === "danger";
  const isWarning = item.severity === "warning";

  return (
    <Link
      className={`group flex items-start justify-between gap-3 rounded-xl border p-3.5 transition hover:shadow-xs active:scale-[0.99] ${
        isDanger
          ? "border-rose-200 bg-rose-50/40 hover:bg-rose-50/80 dark:border-rose-900/40 dark:bg-rose-950/20"
          : isWarning
            ? "border-amber-200 bg-amber-50/40 hover:bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20"
            : "border-blue-200 bg-blue-50/40 hover:bg-blue-50/80 dark:border-blue-900/40 dark:bg-blue-950/20"
      }`}
      href={item.href}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`mt-0.5 shrink-0 ${
            isDanger
              ? "text-rose-600 dark:text-rose-400"
              : isWarning
                ? "text-amber-600 dark:text-amber-400"
                : "text-blue-600 dark:text-blue-400"
          }`}
        >
          {isDanger ? (
            <AlertCircle className="h-4 w-4" />
          ) : isWarning ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Info className="h-4 w-4" />
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
              {item.module}
            </span>
          </div>
          <p className="mt-0.5 text-xs font-bold text-ink group-hover:text-primary sm:text-sm">
            {item.title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted line-clamp-2">
            {item.description}
          </p>
        </div>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
