import type { BadgeTone } from "@/components/ui/badge";
import type { GradingRunStatus, SessionTestDetail } from "@/features/session-tests/types";

/** Shown on the disabled "AI đọc đề" button while ANTHROPIC_API_KEY is not set. */
export const AI_KEY_MISSING_MESSAGE = "Chưa cấu hình khóa AI — nhập đáp án tay";

export type SessionTestStage = "none" | "pending" | "confirmed";

/**
 * The status line of the "Bài kiểm tra" card: chưa có (no test, or an empty draft without
 * photos), chờ chốt (photos or questions waiting for confirmation), đã chốt.
 */
export function sessionTestStage(test: SessionTestDetail | null): SessionTestStage {
  if (!test) return "none";
  if (test.status === "key_confirmed") return "confirmed";
  if (test.assets.length === 0 && test.answerKey.questions.length === 0) return "none";
  return "pending";
}

export const sessionTestStageLabels: Record<SessionTestStage, { label: string; tone: BadgeTone }> = {
  confirmed: { label: "Đã chốt đáp án", tone: "success" },
  none: { label: "Chưa có đề", tone: "neutral" },
  pending: { label: "Chờ chốt đáp án", tone: "warning" },
};

export const extractionStatusLabels: Record<GradingRunStatus, string> = {
  cancelled: "Đã hủy",
  failed: "AI đọc đề lỗi",
  queued: "Đang chờ AI đọc đề",
  running: "AI đang đọc đề",
  succeeded: "AI đã đọc xong",
};
