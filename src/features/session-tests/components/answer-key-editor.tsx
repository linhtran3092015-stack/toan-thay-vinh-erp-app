"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import {
  ANSWER_KEY_LIMITS,
  ANSWER_KEY_TOTAL_POINTS,
  answerKeyConfirmProblems,
  answerKeyFromDrafts,
  answerKeysEqual,
  answerKeyTotal,
  emptyQuestionDraft,
  formatPoints,
  hasDraftErrors,
  isValidPoints,
  nextQuestionLabel,
  questionDraftErrors,
  questionDraftFromQuestion,
  type AnswerKey,
  type QuestionDraft,
  type QuestionDraftField,
} from "@/features/session-tests/answer-key";
import type { SessionTestActions } from "@/features/session-tests/components/session-test-actions";
import { permissionDeniedMessage } from "@/lib/permissions/labels";
import { cn } from "@/lib/utils";

export type EditorOutcome = { message: string; ok: boolean };

/**
 * Manual answer-key editor. "draft" mode saves drafts and confirms the first version;
 * "revision" mode edits a confirmed key: a reason is required and saving creates the next
 * version straight away (grading never runs on an unconfirmed key). The live total must reach
 * exactly 10 before confirming; each question is all-or-nothing, so there is no partial credit.
 */
export function AnswerKeyEditor({
  actions,
  canConfirm,
  canSaveDraft,
  expectedVersion,
  initial,
  mode,
  onCancel,
  onSaved,
  sessionId,
  testId,
}: {
  actions: SessionTestActions;
  canConfirm: boolean;
  canSaveDraft: boolean;
  expectedVersion: number;
  initial: { answerKey: AnswerKey; markingGuide: string | null; title: string | null };
  mode: "draft" | "revision";
  onCancel?: () => void;
  /** Called after a successful save or confirmation (the card refreshes the page). */
  onSaved: (outcome: EditorOutcome & { confirmed: boolean }) => void;
  sessionId: string;
  testId: string | null;
}) {
  const [drafts, setDrafts] = useState<QuestionDraft[]>(() =>
    initial.answerKey.questions.length > 0
      ? initial.answerKey.questions.map((question, index) => questionDraftFromQuestion(question, `q-${index}`))
      : [emptyQuestionDraft("q-0", "1")],
  );
  // Ids for questions added later; only read in event handlers.
  const nextId = useRef(Math.max(initial.answerKey.questions.length, 1));
  const makeId = () => `q-${nextId.current++}`;
  // Questions loaded with a prompt or solution start with that part open; fixed per question so
  // clearing the text does not collapse it mid-edit.
  const [openDetails] = useState(
    () => new Set(drafts.filter((draft) => draft.promptText.trim() !== "" || draft.solutionSteps.trim() !== "").map((draft) => draft.id)),
  );
  const [title, setTitle] = useState(initial.title ?? "");
  const [markingGuide, setMarkingGuide] = useState(initial.markingGuide ?? "");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<EditorOutcome | null>(null);
  const [pending, startTransition] = useTransition();

  const fieldErrors = questionDraftErrors(drafts);
  const blocked = hasDraftErrors(fieldErrors);
  const key = answerKeyFromDrafts(drafts);
  const total = answerKeyTotal(key);
  const confirmProblems = answerKeyConfirmProblems(key);
  const unchanged =
    mode === "revision" &&
    answerKeysEqual(key, initial.answerKey) &&
    title.trim() === (initial.title ?? "") &&
    markingGuide.trim() === (initial.markingGuide ?? "");
  const titleTooLong = title.trim().length > ANSWER_KEY_LIMITS.titleLength;
  const guideTooLong = markingGuide.trim().length > ANSWER_KEY_LIMITS.markingGuideLength;
  const reasonTooLong = reason.trim().length > ANSWER_KEY_LIMITS.reasonLength;

  const confirmBlockedReason = !canConfirm
    ? permissionDeniedMessage("ai_grading.confirm_key")
    : blocked || titleTooLong || guideTooLong
      ? "Sửa các ô đang báo lỗi trước."
      : confirmProblems.length > 0
        ? confirmProblems[0]
        : unchanged
          ? "Đáp án chưa thay đổi so với bản đang dùng."
          : mode === "revision" && reason.trim() === ""
            ? "Nhập lý do sửa đáp án đã chốt."
            : reasonTooLong
              ? `Lý do tối đa ${ANSWER_KEY_LIMITS.reasonLength} ký tự.`
              : undefined;

  const update = (id: string, field: QuestionDraftField, value: string) => {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, [field]: value } : draft)));
  };

  const addQuestion = () => {
    setDrafts((current) => [...current, emptyQuestionDraft(makeId(), nextQuestionLabel(current))]);
  };

  const removeQuestion = (id: string) => setDrafts((current) => current.filter((draft) => draft.id !== id));

  const moveQuestion = (index: number, delta: -1 | 1) => {
    setDrafts((current) => {
      const next = [...current];
      const [draft] = next.splice(index, 1);
      next.splice(index + delta, 0, draft);
      return next;
    });
  };

  // "Chia đều": 5 questions → 2 points each; only offered when 10 splits into quarter steps.
  const evenShare = drafts.length > 0 ? ANSWER_KEY_TOTAL_POINTS / drafts.length : 0;
  const canSplitEvenly = drafts.length > 0 && isValidPoints(evenShare);
  const splitEvenly = () => setDrafts((current) => current.map((draft) => ({ ...draft, maxPoints: formatPoints(evenShare) })));

  const ensureTestId = async (): Promise<string | null> => {
    if (testId) return testId;
    const created = await actions.create({ sessionId });
    if (!created.ok) {
      setFeedback({ message: created.message, ok: false });
      return null;
    }
    return created.testId;
  };

  const saveDraft = () => {
    if (pending || blocked || titleTooLong || guideTooLong) return;
    setFeedback(null);
    startTransition(async () => {
      const id = await ensureTestId();
      if (!id) return;
      const result = await actions.saveDraft({ answerKey: key, markingGuide: markingGuide.trim() || null, testId: id, title: title.trim() || null });
      if (!result.ok) {
        setFeedback(result);
        return;
      }
      onSaved({ ...result, confirmed: false });
    });
  };

  const confirm = () => {
    if (pending || confirmBlockedReason) return;
    setFeedback(null);
    startTransition(async () => {
      const id = await ensureTestId();
      if (!id) return;
      const result = await actions.confirm({
        answerKey: key,
        expectedVersion,
        markingGuide: markingGuide.trim() || null,
        reason: mode === "revision" ? reason.trim() : null,
        testId: id,
        title: title.trim() || null,
      });
      if (!result.ok) {
        setFeedback(result);
        return;
      }
      onSaved({ confirmed: true, message: result.message, ok: true });
    });
  };

  const totalTone =
    total === ANSWER_KEY_TOTAL_POINTS ? "text-success" : total > ANSWER_KEY_TOTAL_POINTS ? "text-danger" : "text-text-default";
  const totalNote =
    total === ANSWER_KEY_TOTAL_POINTS
      ? "đủ 10 điểm"
      : total < ANSWER_KEY_TOTAL_POINTS
        ? `còn thiếu ${formatPoints(ANSWER_KEY_TOTAL_POINTS - total)} điểm`
        : `thừa ${formatPoints(total - ANSWER_KEY_TOTAL_POINTS)} điểm`;

  return (
    <form
      aria-label={mode === "revision" ? "Sửa đáp án đã chốt" : "Nhập đáp án"}
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        confirm();
      }}
    >
      <Field error={titleTooLong ? `Tối đa ${ANSWER_KEY_LIMITS.titleLength} ký tự.` : null} label="Tên đề (tùy chọn)">
        {(props) => (
          <Input {...props} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: Đề lớp 3 ngày 17/10" value={title} />
        )}
      </Field>

      <ol className="grid gap-3">
        {drafts.map((draft, index) => {
          const errors = fieldErrors[index];
          const label = draft.label.trim() || String(index + 1);
          return (
            <li key={draft.id}>
              <fieldset className="grid gap-3 rounded-lg border border-border-subtle p-3">
                <legend className="px-1 text-label font-semibold text-text-strong">Câu {label}</legend>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[6rem_6rem_minmax(0,1fr)]">
                  <Field error={errors.label} label="Câu số" required>
                    {(props) => <Input {...props} onChange={(event) => update(draft.id, "label", event.target.value)} value={draft.label} />}
                  </Field>
                  <Field error={errors.maxPoints} label="Điểm" required>
                    {(props) => (
                      <Input
                        {...props}
                        inputMode="decimal"
                        onChange={(event) => update(draft.id, "maxPoints", event.target.value)}
                        placeholder="2"
                        value={draft.maxPoints}
                      />
                    )}
                  </Field>
                  <Field className="col-span-2 sm:col-span-1" error={errors.finalAnswer} label="Đáp án cuối" required>
                    {(props) => (
                      <Input
                        {...props}
                        onChange={(event) => update(draft.id, "finalAnswer", event.target.value)}
                        placeholder="Ví dụ: 7 cm"
                        value={draft.finalAnswer}
                      />
                    )}
                  </Field>
                </div>
                <Field
                  error={errors.acceptedEquivalents}
                  hint="Mỗi dòng một cách viết cũng được tính đúng, ví dụ 1/2 và 0,5."
                  label="Cách viết khác được chấp nhận"
                >
                  {(props) => (
                    <Textarea
                      {...props}
                      className="min-h-16"
                      onChange={(event) => update(draft.id, "acceptedEquivalents", event.target.value)}
                      value={draft.acceptedEquivalents}
                    />
                  )}
                </Field>
                <details open={openDetails.has(draft.id) || undefined}>
                  <summary className="cursor-pointer text-secondary font-medium text-action-link">Đề bài và lời giải chi tiết (tùy chọn)</summary>
                  <div className="mt-3 grid gap-3">
                    <Field error={errors.promptText} label="Đề bài">
                      {(props) => (
                        <Textarea {...props} onChange={(event) => update(draft.id, "promptText", event.target.value)} value={draft.promptText} />
                      )}
                    </Field>
                    <Field
                      error={errors.solutionSteps}
                      hint="Mỗi dòng một bước. Lời giải cả đề gửi phụ huynh trong mục “Bài chữa chi tiết” của tin Zalo."
                      label="Lời giải chi tiết"
                    >
                      {(props) => (
                        <Textarea
                          {...props}
                          onChange={(event) => update(draft.id, "solutionSteps", event.target.value)}
                          value={draft.solutionSteps}
                        />
                      )}
                    </Field>
                  </div>
                </details>
                <div className="flex flex-wrap justify-end gap-1">
                  <Button
                    aria-label={`Đưa câu ${label} lên trước`}
                    disabled={pending || index === 0}
                    iconOnly
                    onClick={() => moveQuestion(index, -1)}
                    variant="ghost"
                  >
                    <ArrowUp aria-hidden="true" size={18} />
                  </Button>
                  <Button
                    aria-label={`Đưa câu ${label} xuống sau`}
                    disabled={pending || index === drafts.length - 1}
                    iconOnly
                    onClick={() => moveQuestion(index, 1)}
                    variant="ghost"
                  >
                    <ArrowDown aria-hidden="true" size={18} />
                  </Button>
                  <Button aria-label={`Xóa câu ${label}`} disabled={pending} iconOnly onClick={() => removeQuestion(draft.id)} variant="ghost">
                    <Trash2 aria-hidden="true" size={18} />
                  </Button>
                </div>
              </fieldset>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending || drafts.length >= ANSWER_KEY_LIMITS.questions}
          disabledReason={drafts.length >= ANSWER_KEY_LIMITS.questions ? `Mỗi đề tối đa ${ANSWER_KEY_LIMITS.questions} câu.` : undefined}
          onClick={addQuestion}
          variant="secondary"
        >
          <Plus aria-hidden="true" size={18} />
          Thêm câu
        </Button>
        {canSplitEvenly ? (
          <Button disabled={pending} onClick={splitEvenly} variant="ghost">
            Chia đều 10 điểm ({formatPoints(evenShare)} điểm/câu)
          </Button>
        ) : null}
      </div>

      <Field error={guideTooLong ? `Tối đa ${ANSWER_KEY_LIMITS.markingGuideLength} ký tự.` : null} hint="Ví dụ: thiếu đơn vị cm vẫn tính đúng." label="Ghi chú chấm (tùy chọn)">
        {(props) => <Textarea {...props} onChange={(event) => setMarkingGuide(event.target.value)} value={markingGuide} />}
      </Field>

      <div className="grid gap-2 rounded-lg border border-border-subtle bg-surface-sunken p-3">
        <p aria-live="polite" className="text-secondary text-text-default">
          Tổng điểm:{" "}
          <span className={cn("font-semibold", totalTone)}>
            {formatPoints(total)}/{ANSWER_KEY_TOTAL_POINTS}
          </span>{" "}
          · {totalNote} · {drafts.length} câu
        </p>
        <p className="text-caption text-text-muted">
          Mỗi câu đúng được trọn điểm, sai được 0. Đúng cách làm nhưng thiếu kết quả cuối vẫn tính đúng.
        </p>
        {mode === "revision" ? (
          <Field
            error={reasonTooLong ? `Tối đa ${ANSWER_KEY_LIMITS.reasonLength} ký tự.` : null}
            hint="Ghi vào nhật ký hệ thống cùng bản đáp án cũ."
            label="Lý do sửa đáp án đã chốt"
            required
          >
            {(props) => <Input {...props} onChange={(event) => setReason(event.target.value)} value={reason} />}
          </Field>
        ) : null}
        <p className="text-caption text-text-default">
          {mode === "revision"
            ? `Lưu sẽ tạo phiên bản ${expectedVersion + 1}. Bài đã duyệt theo bản cũ sẽ được báo để trợ giảng quyết định chấm lại.`
            : "Chốt xong, AI chấm mọi bài nộp của buổi này theo đáp án này. Sửa sau khi chốt sẽ tạo phiên bản mới."}
        </p>
        <div className="flex flex-wrap items-start gap-2">
          <Button disabledReason={confirmBlockedReason} disabled={pending || confirmBlockedReason !== undefined} isLoading={pending} type="submit">
            {mode === "revision" ? `Lưu phiên bản ${expectedVersion + 1}` : "Chốt đáp án"}
          </Button>
          {mode === "draft" && canSaveDraft ? (
            <Button disabled={pending || blocked || titleTooLong || guideTooLong} onClick={saveDraft} variant="secondary">
              Lưu nháp
            </Button>
          ) : null}
          {onCancel ? (
            <Button disabled={pending} onClick={onCancel} variant="ghost">
              Hủy sửa
            </Button>
          ) : null}
        </div>
        {feedback ? <ResultBanner title={feedback.message} tone={feedback.ok ? "success" : "error"} /> : null}
      </div>
    </form>
  );
}
