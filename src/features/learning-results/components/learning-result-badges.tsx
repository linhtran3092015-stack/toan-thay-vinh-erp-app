import type { LearningResultNotebookStatus } from "@/features/learning-results/read-models";
import { cn } from "@/lib/utils";

function formatScore(score: number): string {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 2,
  }).format(score);
}

export function LearningResultScoreBadge({
  score,
}: {
  score: number | null;
}) {
  const state =
    score === null
      ? "missing"
      : score < 5
        ? "low"
        : score >= 8
          ? "strong"
          : "passed";

  const label =
    score === null
      ? "Chưa có điểm"
      : state === "low"
        ? `Dưới chuẩn ${formatScore(score)}/10`
        : state === "strong"
          ? `Tốt ${formatScore(score)}/10`
          : `Đạt ${formatScore(score)}/10`;

  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        state === "missing" &&
          "border-hairline bg-surface-2 text-ink-muted",
        state === "low" &&
          "border-danger-border bg-danger-bg text-danger",
        state === "passed" &&
          "border-warning-border bg-warning-bg text-warning",
        state === "strong" &&
          "border-success-border bg-success-bg text-success",
      )}
    >
      {label}
    </span>
  );
}

const notebookStatusLabels: Record<
  LearningResultNotebookStatus,
  string
> = {
  not_required: "Không yêu cầu vở",
  not_submitted: "Chưa nộp vở",
  submitted: "Đã nộp vở",
};

export function NotebookStatusBadge({
  status,
}: {
  status: LearningResultNotebookStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        status === "submitted" &&
          "border-success-border bg-success-bg text-success",
        status === "not_submitted" &&
          "border-danger-border bg-danger-bg text-danger",
        status === "not_required" &&
          "border-hairline bg-surface-2 text-ink-muted",
      )}
    >
      {notebookStatusLabels[status]}
    </span>
  );
}
