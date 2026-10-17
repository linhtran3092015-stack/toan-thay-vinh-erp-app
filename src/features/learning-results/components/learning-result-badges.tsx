import { Badge, type BadgeTone } from "@/components/ui/badge";
import { formatLearningResultScore } from "@/features/learning-results/learning-result-models";
import type { LearningResultNotebookStatus } from "@/features/learning-results/read-models";
import { cn } from "@/lib/utils";

/** Score band shared by the badge and the table figure: < 5 low, ≥ 8 strong, else passed. */
function getScoreState(score: number | null) {
  if (score === null) return "missing" as const;
  if (score < 5) return "low" as const;
  return score >= 8 ? ("strong" as const) : ("passed" as const);
}

const scoreTones: Record<ReturnType<typeof getScoreState>, BadgeTone> = {
  low: "danger",
  missing: "neutral",
  passed: "info",
  strong: "success",
};

/** Phone-card score badge: the band word and the score ("Đạt 7/10"), or "Chưa có điểm". */
export function LearningResultScoreBadge({
  score,
}: {
  score: number | null;
}) {
  const state = getScoreState(score);
  const label =
    score === null
      ? "Chưa có điểm"
      : state === "low"
        ? `Dưới chuẩn ${formatLearningResultScore(score)}/10`
        : state === "strong"
          ? `Tốt ${formatLearningResultScore(score)}/10`
          : `Đạt ${formatLearningResultScore(score)}/10`;

  return <Badge tone={scoreTones[state]}>{label}</Badge>;
}

/**
 * Table figure for the numeric score columns: the number alone, right-aligned
 * by its cell. A score under 5 is danger-coloured and also announced as
 * "dưới chuẩn"; a missing test score is a muted dash named "Chưa có điểm" and a
 * missing notebook score a plain muted dash.
 */
export function LearningResultScoreValue({
  missing = "badge",
  score,
}: {
  missing?: "badge" | "dash";
  score: number | null;
}) {
  if (score === null) {
    // The column is too narrow for a badge; the dash is named for screen readers.
    return missing === "badge" ? (
      <span className="text-text-muted" title="Chưa có điểm">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Chưa có điểm</span>
      </span>
    ) : (
      <span className="text-text-muted">—</span>
    );
  }

  const isLow = getScoreState(score) === "low";

  return (
    <span
      className={cn(
        "tabular-nums",
        isLow ? "font-semibold text-danger" : "font-medium text-text-strong",
      )}
    >
      {formatLearningResultScore(score)}
      {isLow ? <span className="sr-only"> (dưới chuẩn)</span> : null}
    </span>
  );
}

/** Phone-card labels; the table column uses the compact set below. */
const notebookStatusLabels: Record<
  LearningResultNotebookStatus,
  string
> = {
  not_required: "Không yêu cầu vở",
  not_submitted: "Chưa nộp vở",
  pending: "Chờ chấm vở",
  submitted: "Đã nộp vở",
};

/** The table column is already titled "Vở", so it drops the repeated word. */
const compactNotebookStatusLabels: Record<
  LearningResultNotebookStatus,
  string
> = {
  not_required: "Không yêu cầu",
  not_submitted: "Chưa nộp",
  pending: "Chờ chấm",
  submitted: "Đã nộp",
};

const notebookTones: Record<LearningResultNotebookStatus, BadgeTone> = {
  not_required: "neutral",
  not_submitted: "danger",
  pending: "warning",
  submitted: "success",
};

export function NotebookStatusBadge({
  compact = false,
  status,
}: {
  compact?: boolean;
  status: LearningResultNotebookStatus;
}) {
  return (
    <Badge tone={notebookTones[status]}>
      {(compact ? compactNotebookStatusLabels : notebookStatusLabels)[status]}
    </Badge>
  );
}
