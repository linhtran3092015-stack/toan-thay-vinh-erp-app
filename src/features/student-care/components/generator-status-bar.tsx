import { CircleCheck, CirclePause, CircleX, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

import { careIsStale, type CareDashboard } from "../models";
import { formatCareClock, formatCareRelative } from "../student-care-presentation";

export type CareGeneratorTone = "neutral" | "warning" | "danger";

export interface CareGeneratorState {
  headline: string;
  /** True when the queue may not reflect the latest data (paused, stale, or work still queued). */
  unhealthy: boolean;
  /** Announced as an alert: running but late or behind (the pre-redesign rule). */
  alert: boolean;
  tone: CareGeneratorTone;
}

type GeneratorInput = Pick<CareDashboard, "queue"> & {
  settings: Pick<CareDashboard["settings"], "enabled" | "last_success_at"> & Partial<CareDashboard["settings"]>;
};

/**
 * Headline keeps the pre-redesign priority (paused → late → failed → queued)
 * so the most actionable fact leads. Tone: danger when paused or some
 * students failed evaluation, warning when late (>5 min) or work is queued,
 * neutral when healthy.
 */
export function getCareGeneratorState(data: GeneratorInput, now: number): CareGeneratorState {
  const { enabled } = data.settings;
  const stale = careIsStale(data.settings.last_success_at, now);
  const { failed, pending } = data.queue;
  const headline = !enabled
    ? "Bộ tự sinh đang tạm dừng"
    : stale
      ? "Bộ tự sinh chưa cập nhật đúng hạn"
      : failed > 0
        ? "Một số học sinh đang chờ kiểm tra lại"
        : pending > 0
          ? "Đang cập nhật trạng thái học sinh"
          : "Bộ tự sinh đang bật";
  const tone: CareGeneratorTone = !enabled || failed > 0 ? "danger" : stale || pending > 0 ? "warning" : "neutral";
  return {
    alert: enabled && (stale || failed > 0 || pending > 0),
    headline,
    tone,
    unhealthy: !enabled || stale || failed > 0 || pending > 0,
  };
}

/** Shown wherever a quiet list could be misread as "every student is fine". */
export const CARE_NOT_ALL_CLEAR = "Danh sách có thể chưa phản ánh dữ liệu mới nhất. Không có cảnh báo chưa có nghĩa tất cả học sinh đều ổn.";

const toneClassName: Record<CareGeneratorTone, string> = {
  danger: "border-danger-border bg-danger-bg text-danger-ink",
  neutral: "border-border-subtle bg-surface-base text-text-default",
  warning: "border-warning-border bg-warning-bg text-warning-ink",
};

function currentTime() {
  return Date.now();
}

/**
 * The evaluation queue in words. get_student_care_dashboard counts
 * `queue.pending` as every queued student and `queue.failed` as those with
 * attempts > 0, so failed is a subset of pending: "hàng đợi 4 (2 đang thử
 * lại)", never "4 chờ, 2 lỗi".
 */
export function getCareQueueText(queue: CareDashboard["queue"]): string {
  return queue.failed > 0 ? `hàng đợi ${queue.pending} (${queue.failed} đang thử lại)` : `hàng đợi ${queue.pending}`;
}

/**
 * One compact strip (design 13a) with the auto-generator's health: on/off,
 * last successful run with its age, the evaluation queue, last reconcile and
 * the last error. Text always carries the meaning; colour only repeats it.
 */
export function GeneratorStatusBar({ data, now = currentTime() }: { data: GeneratorInput; now?: number }) {
  const state = getCareGeneratorState(data, now);
  const { settings, queue } = data;
  const relative = formatCareRelative(settings.last_success_at, now);
  const Icon = !settings.enabled ? CirclePause : state.tone === "danger" ? CircleX : state.tone === "warning" ? TriangleAlert : CircleCheck;
  // The age ("3 phút trước") changes on every 60s refresh: it is hidden from
  // the live region so the alert is not announced again each minute; the
  // clock time before it carries the same fact.
  const lastRun = settings.last_success_at ? (
    <>
      chạy thành công {formatCareClock(settings.last_success_at, now)}
      {relative ? <span aria-hidden="true"> ({relative})</span> : null}
    </>
  ) : (
    "chưa có lần chạy thành công"
  );
  const otherFacts = [getCareQueueText(queue), `đối soát gần nhất ${formatCareClock(settings.last_reconcile_at ?? null, now)}`];

  return (
    <div
      className={cn("flex items-start gap-3 rounded-lg border px-4 py-2.5 text-secondary shadow-[var(--panel-shadow)]", toneClassName[state.tone])}
      data-tone={state.tone}
      role={state.alert ? "alert" : "status"}
    >
      <Icon aria-hidden="true" className={cn("mt-0.5 shrink-0", state.tone === "neutral" && "text-success")} size={16} strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <p>
          <strong className="font-semibold">{state.headline}</strong>
          <span className="tabular-nums">
            {" · "}
            {lastRun}
            {` · ${otherFacts.join(" · ")}`}
          </span>
        </p>
        {settings.last_error ? <p className="mt-0.5 break-words">Lỗi gần nhất: {settings.last_error}</p> : null}
        {state.unhealthy ? <p className="mt-0.5">{CARE_NOT_ALL_CLEAR}</p> : null}
      </div>
    </div>
  );
}
