"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { controlClassName, Field } from "@/components/ui/field";
import type { CommentPhrases } from "@/features/ai-grading/comment";
import { COMMENT_MAX_CHARS } from "@/features/ai-grading/comment";
import { draftComment, initialVerdicts, previewReview } from "@/features/ai-grading/review-draft";
import type { Verdict } from "@/features/ai-grading/scoring";
import type { SessionGradingSubmission } from "@/features/grading-submissions/data";
import {
  approveGradingSubmissionAction,
  regradeGradingSubmissionAction,
  setPraiseBonusAction,
  skipGradingSubmissionAction,
  type ReviewActionResult,
} from "@/features/grading-submissions/review-approval-actions";
import type { RankBand } from "@/features/parent-messages/comment-template";
import type { AnswerKey } from "@/features/session-tests/answer-key";
import { formatDateTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export interface ReviewActions {
  approve: typeof approveGradingSubmissionAction;
  regrade: typeof regradeGradingSubmissionAction;
  setPraise: typeof setPraiseBonusAction;
  skip: typeof skipGradingSubmissionAction;
}

const DEFAULT_ACTIONS: ReviewActions = {
  approve: approveGradingSubmissionAction,
  regrade: regradeGradingSubmissionAction,
  setPraise: setPraiseBonusAction,
  skip: skipGradingSubmissionAction,
};

/** What the review panel needs from the session page (phase 3b). */
export interface ReviewContext {
  actions?: ReviewActions;
  bands: RankBand[];
  /** ai_grading.review */
  canReview: boolean;
  /** results.manage (needed to approve, since approving writes the session result). */
  canWriteResults: boolean;
  /** Session started (in progress or completed), not locked or cancelled. */
  editable: boolean;
  key: AnswerKey | null;
  keyVersion: number;
  phrases: CommentPhrases;
  sessionId: string;
}

const PRESENT = new Set(["present", "additional_study"]);

const verdictOptions: Array<{ label: string; value: Verdict }> = [
  { label: "Đúng", value: "correct" },
  { label: "Sai", value: "incorrect" },
  { label: "Bỏ trống", value: "missing" },
];

const messageStatusLabels: Record<string, string> = {
  failed: "Tin Zalo gửi lỗi",
  queued: "Tin Zalo đang chờ gửi",
  sending: "Tin Zalo đang gửi",
  sent: "Tin Zalo đã gửi",
  skipped: "Tin Zalo đã bỏ qua",
};

/**
 * Review of one counted submission: tick "Tích cực tương tác", correct the AI per question, check
 * the score and rank the database will write, edit the draft comment, then approve into the
 * session result (the notebook score stays). "Chấm lại" asks the AI again; "Bỏ qua" leaves the
 * paper for grading by hand.
 */
export function SubmissionReviewPanel({ context, submission }: { context: ReviewContext; submission: SessionGradingSubmission }) {
  const router = useRouter();
  const actions = context.actions ?? DEFAULT_ACTIONS;
  const review = submission.review;
  const ai = submission.ai;
  const key = context.key;
  const aiQuestions = useMemo(() => ai?.questions ?? [], [ai]);
  const [open, setOpen] = useState(false);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>(() =>
    key ? initialVerdicts(key, aiQuestions, review?.status === "approved" ? review.finalVerdicts : null) : {},
  );
  const [praise, setPraise] = useState(review?.praiseBonus ?? false);
  const seed = `${submission.studentId}:${context.sessionId}`;
  const draft = key ? draftComment({ aiQuestions, key, phrases: context.phrases, praise, seed, verdicts }) : "";
  const [comment, setComment] = useState<string | null>(review?.status === "approved" ? review.feedbackText : null);
  const [reason, setReason] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [skipping, setSkipping] = useState(false);
  const [feedback, setFeedback] = useState<ReviewActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (!review || !submission.countsForScore) return null;

  const preview = key ? previewReview({ bands: context.bands, key, praise, verdicts }) : null;
  const commentText = comment ?? draft;
  const attendanceOk = review.attendanceStatus !== null && PRESENT.has(review.attendanceStatus);
  const manualScore = review.result && !review.result.fromThisSubmission && review.result.testScore !== null ? review.result.testScore : null;
  const keyChanged = review.status === "approved" && review.keyVersion !== null && review.keyVersion !== context.keyVersion;
  const aiStale = ai !== undefined && ai.keyVersion !== null && ai.keyVersion !== context.keyVersion;
  const canAct = context.canReview && context.editable;
  const approveBlock = !context.canWriteResults
    ? "Cần quyền nhập kết quả buổi để duyệt."
    : !key
      ? "Đề của buổi chưa chốt đáp án."
      : !attendanceOk
        ? "Em chưa được điểm danh có mặt ở buổi này."
        : commentText.trim() === ""
          ? "Nhận xét không được để trống."
          : commentText.length > COMMENT_MAX_CHARS
            ? `Nhận xét tối đa ${COMMENT_MAX_CHARS.toLocaleString("vi-VN")} ký tự.`
            : manualScore !== null && reason.trim() === ""
              ? "Nhập lý do thay điểm nhập tay."
              : undefined;

  const run = (call: () => Promise<ReviewActionResult>, after?: () => void) => {
    setFeedback(null);
    startTransition(async () => {
      let result: ReviewActionResult;
      try {
        result = await call();
      } catch {
        result = { message: "Không kết nối được máy chủ. Vui lòng thử lại.", ok: false };
      }
      setFeedback(result);
      if (result.ok) {
        after?.();
        router.refresh();
      }
    });
  };

  const togglePraise = (next: boolean) => {
    setPraise(next);
    if (!open && review.status !== "approved") {
      run(() => actions.setPraise({ praise: next, sessionId: context.sessionId, submissionId: submission.id }));
    }
  };

  return (
    <div className="grid gap-2 rounded-md border border-border-subtle bg-surface-subtle p-2">
      <div className="flex flex-wrap items-center gap-2">
        {review.status === "approved" ? (
          <Badge tone="success">
            Đã duyệt: {review.finalScore} điểm{review.finalScore !== review.paperScore ? " (đã cộng 1)" : ""}
            {review.rankLabel ? ` · ${review.rankLabel}` : ""}
          </Badge>
        ) : null}
        {review.status === "skipped" ? <Badge tone="neutral">Đã bỏ qua · chấm tay</Badge> : null}
        {review.messageStatus && messageStatusLabels[review.messageStatus] ? (
          <Badge tone={review.messageStatus === "sent" ? "info" : "neutral"}>{messageStatusLabels[review.messageStatus]}</Badge>
        ) : null}
        {keyChanged ? <Badge tone="warning">Đáp án đã đổi sau khi duyệt</Badge> : null}
        {manualScore !== null && review.status !== "approved" ? <Badge tone="warning">Đã có điểm nhập tay {manualScore}</Badge> : null}
        {review.reviewedAt ? (
          <span className="text-caption text-text-muted">
            {review.reviewedByName ?? "Nhân sự"} · {formatDateTime(review.reviewedAt)}
            {review.note ? ` · ${review.note}` : ""}
          </span>
        ) : null}
      </div>

      {canAct ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-11 items-center gap-2 text-secondary text-text-strong md:min-h-8">
            <input
              checked={praise}
              className="h-4 w-4 shrink-0 accent-[var(--action-primary)]"
              disabled={pending}
              onChange={(event) => togglePraise(event.target.checked)}
              type="checkbox"
            />
            Tích cực tương tác (+1)
          </label>
          {key ? (
            <Button onClick={() => setOpen((value) => !value)} size="sm" variant={open ? "ghost" : "secondary"}>
              {open ? "Đóng" : review.status === "approved" ? "Duyệt lại" : "Xem và duyệt"}
            </Button>
          ) : null}
          {key ? (
            <Button
              disabled={pending || ai?.state === "grading"}
              onClick={() => run(() => actions.regrade({ sessionId: context.sessionId, submissionId: submission.id }))}
              size="sm"
              variant="ghost"
            >
              {aiStale ? "Chấm lại theo đáp án mới" : "Chấm lại AI"}
            </Button>
          ) : null}
          {review.status === "pending" ? (
            <Button disabled={pending} onClick={() => setSkipping((value) => !value)} size="sm" variant="ghost">
              Bỏ qua
            </Button>
          ) : null}
        </div>
      ) : null}

      {skipping && canAct ? (
        <div className="flex flex-wrap items-end gap-2">
          <Field className="min-w-60 flex-1" label="Lý do bỏ qua">
            {(props) => (
              <input
                className={controlClassName}
                maxLength={500}
                onChange={(event) => setSkipReason(event.target.value)}
                placeholder="Ví dụ: em làm trên giấy, chấm tay"
                value={skipReason}
                {...props}
              />
            )}
          </Field>
          <Button
            disabled={pending || skipReason.trim() === ""}
            onClick={() =>
              run(() => actions.skip({ reason: skipReason, sessionId: context.sessionId, submissionId: submission.id }), () => setSkipping(false))
            }
            size="sm"
            variant="secondary"
          >
            Xác nhận bỏ qua
          </Button>
        </div>
      ) : null}

      {open && key && preview ? (
        <div className="grid gap-3">
          <fieldset className="grid gap-2">
            <legend className="text-caption font-semibold text-text-muted">Kết quả từng câu</legend>
            {key.questions.map((question) => {
              const aiQuestion = aiQuestions.find((item) => item.label === question.label);
              return (
                <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={question.label}>
                  <div className="text-secondary">
                    <span className="font-semibold text-text-strong">Câu {question.label}</span>
                    <span className="text-text-muted"> · {String(question.maxPoints ?? 0).replace(".", ",")} điểm · đáp án {question.finalAnswer}</span>
                    {aiQuestion?.extractedFinalAnswer ? <span className="text-text-muted"> · em ghi “{aiQuestion.extractedFinalAnswer}”</span> : null}
                    {aiQuestion && aiQuestion.verdict !== verdicts[question.label] ? (
                      <span className="text-warning"> · AI chấm {verdictOptions.find((option) => option.value === aiQuestion.verdict)?.label}</span>
                    ) : null}
                  </div>
                  <div className="flex gap-1" role="radiogroup" aria-label={`Câu ${question.label}`}>
                    {verdictOptions.map((option) => (
                      <label
                        className={cn(
                          "flex min-h-9 cursor-pointer items-center rounded-sm border px-2 text-caption",
                          verdicts[question.label] === option.value
                            ? "border-[var(--action-primary)] bg-[var(--action-primary)] text-white"
                            : "border-border-subtle text-text-default",
                        )}
                        key={option.value}
                      >
                        <input
                          checked={verdicts[question.label] === option.value}
                          className="sr-only"
                          name={`verdict-${submission.id}-${question.label}`}
                          onChange={() => setVerdicts((current) => ({ ...current, [question.label]: option.value }))}
                          type="radio"
                          value={option.value}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </fieldset>

          <p className="text-secondary text-text-strong" role="status">
            Điểm bài làm {preview.paperScore}
            {preview.bonusApplied ? ` · cộng 1 → ${preview.finalScore}` : praise ? " · đã 10 điểm, chỉ khen tích cực" : ""} · {preview.rankLabel || "chưa có xếp hạng"}
          </p>

          <Field
            hint={`${commentText.length.toLocaleString("vi-VN")}/${COMMENT_MAX_CHARS.toLocaleString("vi-VN")} ký tự. Bản nháp tự soạn từ kết quả chấm và câu mẫu; sửa thoải mái trước khi duyệt.`}
            label="Nhận xét gửi phụ huynh"
          >
            {(props) => (
              <textarea
                className={cn(controlClassName, "py-2 text-secondary")}
                onChange={(event) => setComment(event.target.value)}
                rows={7}
                value={commentText}
                {...props}
              />
            )}
          </Field>
          {comment !== null ? (
            <div>
              <Button onClick={() => setComment(null)} size="sm" variant="ghost">
                Soạn lại theo kết quả chấm
              </Button>
            </div>
          ) : null}

          {manualScore !== null || review.status === "approved" ? (
            <Field hint="Ghi vào nhật ký kết quả buổi." label={manualScore !== null ? `Lý do thay điểm nhập tay ${manualScore}` : "Lý do duyệt lại (không bắt buộc)"}>
              {(props) => (
                <input className={controlClassName} maxLength={500} onChange={(event) => setReason(event.target.value)} value={reason} {...props} />
              )}
            </Field>
          ) : null}
          {review.messageStatus === "sent" ? (
            <ResultBanner title="Tin Zalo của em đã gửi: duyệt lại chỉ đổi kết quả trong ERP, không gửi lại tin." tone="warning" />
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending || approveBlock !== undefined}
              disabledReason={approveBlock}
              isLoading={pending}
              onClick={() =>
                run(
                  () =>
                    actions.approve({
                      expectedKeyVersion: context.keyVersion,
                      feedbackText: commentText,
                      praiseBonus: praise,
                      reason: reason.trim() || null,
                      sessionId: context.sessionId,
                      submissionId: submission.id,
                      verdicts,
                    }),
                  () => setOpen(false),
                )
              }
            >
              {review.status === "approved" ? "Duyệt lại" : "Duyệt và ghi điểm"}
            </Button>
          </div>
        </div>
      ) : null}

      {feedback ? <ResultBanner title={feedback.message} tone={feedback.ok ? "success" : "error"} /> : null}
    </div>
  );
}
