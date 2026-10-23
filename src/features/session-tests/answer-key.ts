import { z } from "zod";

/**
 * Answer key of an end-of-session test (AI grading phase 2). Each question is all-or-nothing
 * (owner decision 17/10), so there are no partial-credit fields; a key can be confirmed only
 * when its points add up to exactly 10. The SQL twin is normalize_session_test_answer_key +
 * session_test_key_confirm_problem in 20261020090000_session_tests_answer_keys.sql; keep the
 * limits below in step with it.
 */

export const ANSWER_KEY_LIMITS = {
  equivalentLength: 200,
  equivalents: 20,
  finalAnswerLength: 500,
  labelLength: 20,
  markingGuideLength: 2000,
  methodsLength: 4000,
  promptLength: 4000,
  questions: 50,
  reasonLength: 500,
  stepLength: 2000,
  steps: 40,
  titleLength: 200,
} as const;

export const ANSWER_KEY_TOTAL_POINTS = 10;

export interface AnswerKeyQuestion {
  acceptedEquivalents: string[];
  finalAnswer: string;
  label: string;
  /** Null while a draft has no points yet. */
  maxPoints: number | null;
  promptText: string;
  solutionSteps: string[];
}

export interface AnswerKey {
  /**
   * "Phương pháp của thầy": the teacher's methods for this lesson, summarised by AI from the
   * lesson slides and confirmed with the key. Empty or absent when there were no slides.
   */
  methods?: string;
  questions: AnswerKeyQuestion[];
}

/** Stored jsonb shape (snake_case, as the database and the phase-0 eval script write it). */
const storedQuestionSchema = z.object({
  accepted_equivalents: z.array(z.string()).default([]),
  final_answer: z.string().default(""),
  label: z.string(),
  max_points: z.number().nullable().default(null),
  prompt_text: z.string().default(""),
  solution_steps: z.array(z.string()).default([]),
});

export const storedAnswerKeySchema = z.object({ methods: z.string().optional(), questions: z.array(storedQuestionSchema) });

export type StoredAnswerKey = z.input<typeof storedAnswerKeySchema>;

export function answerKeyFromStored(stored: z.output<typeof storedAnswerKeySchema>): AnswerKey {
  return {
    ...(stored.methods?.trim() ? { methods: stored.methods } : {}),
    questions: stored.questions.map((question) => ({
      acceptedEquivalents: question.accepted_equivalents,
      finalAnswer: question.final_answer,
      label: question.label,
      maxPoints: question.max_points,
      promptText: question.prompt_text,
      solutionSteps: question.solution_steps,
    })),
  };
}

/** Same shape normalize_session_test_answer_key returns: "methods" only when there is text. */
export function answerKeyToStored(key: AnswerKey): StoredAnswerKey {
  const methods = key.methods?.trim() ?? "";
  return {
    ...(methods ? { methods } : {}),
    questions: key.questions.map((question) => ({
      accepted_equivalents: question.acceptedEquivalents,
      final_answer: question.finalAnswer,
      label: question.label,
      max_points: question.maxPoints,
      prompt_text: question.promptText,
      solution_steps: question.solutionSteps,
    })),
  };
}

/** Points in quarter steps, summed as integers so 2,25 + 2,75 + 5 is exactly 10. */
export function answerKeyTotal(key: AnswerKey): number {
  const quarters = key.questions.reduce((sum, question) => sum + Math.round((question.maxPoints ?? 0) * 4), 0);
  return quarters / 4;
}

/** 2.5 → "2,5"; 10 → "10". */
export function formatPoints(points: number): string {
  return String(Math.round(points * 100) / 100).replace(".", ",");
}

export function isValidPoints(points: number): boolean {
  return Number.isFinite(points) && points > 0 && points <= ANSWER_KEY_TOTAL_POINTS && Number.isInteger(points * 4);
}

/** "2,5" / "2.5" / " 2 " → number; "" → null; anything else → NaN (shown as an error). */
export function parsePoints(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (!/^\d{1,2}([.,]\d{1,2})?$/.test(trimmed)) return Number.NaN;
  return Number(trimmed.replace(",", "."));
}

/**
 * Why the key cannot be confirmed yet, in the order the database checks: no question, a
 * question without points, a question without a final answer, a total other than 10.
 */
export function answerKeyConfirmProblems(key: AnswerKey): string[] {
  if (key.questions.length === 0) return ["Đáp án chưa có câu nào."];
  const problems: string[] = [];
  const withoutPoints = key.questions.filter((question) => question.maxPoints === null).map((question) => question.label);
  if (withoutPoints.length > 0) problems.push(`Câu ${withoutPoints.join(", ")} chưa có điểm.`);
  const withoutAnswer = key.questions.filter((question) => question.finalAnswer.trim() === "").map((question) => question.label);
  if (withoutAnswer.length > 0) problems.push(`Câu ${withoutAnswer.join(", ")} chưa có đáp án cuối.`);
  const total = answerKeyTotal(key);
  if (withoutPoints.length === 0 && total !== ANSWER_KEY_TOTAL_POINTS) {
    problems.push(
      total < ANSWER_KEY_TOTAL_POINTS
        ? `Tổng điểm đang là ${formatPoints(total)}, còn thiếu ${formatPoints(ANSWER_KEY_TOTAL_POINTS - total)} điểm để đủ 10.`
        : `Tổng điểm đang là ${formatPoints(total)}, thừa ${formatPoints(total - ANSWER_KEY_TOTAL_POINTS)} điểm so với 10.`,
    );
  }
  return problems;
}

/** Same comparison the database makes before accepting an edit of a confirmed key. */
export function answerKeysEqual(left: AnswerKey, right: AnswerKey): boolean {
  return JSON.stringify(answerKeyToStored(left)) === JSON.stringify(answerKeyToStored(right));
}

// ---------------------------------------------------------------------------
// Editor drafts: every field is the raw text of its control.
// ---------------------------------------------------------------------------

export interface QuestionDraft {
  /** One accepted alternative per line. */
  acceptedEquivalents: string;
  finalAnswer: string;
  /** Client-only key for React lists and focus. */
  id: string;
  label: string;
  maxPoints: string;
  promptText: string;
  /** One solution step per line. */
  solutionSteps: string;
}

export type QuestionDraftField = Exclude<keyof QuestionDraft, "id">;

export type QuestionDraftErrors = Partial<Record<QuestionDraftField, string>>;

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

export function questionDraftFromQuestion(question: AnswerKeyQuestion, id: string): QuestionDraft {
  return {
    acceptedEquivalents: question.acceptedEquivalents.join("\n"),
    finalAnswer: question.finalAnswer,
    id,
    label: question.label,
    maxPoints: question.maxPoints === null ? "" : formatPoints(question.maxPoints),
    promptText: question.promptText,
    solutionSteps: question.solutionSteps.join("\n"),
  };
}

/** The next label after the last numeric one ("13" → "14"), else the position. */
export function nextQuestionLabel(drafts: QuestionDraft[]): string {
  const last = drafts.at(-1)?.label.trim() ?? "";
  if (/^\d{1,4}$/.test(last)) return String(Number(last) + 1);
  return String(drafts.length + 1);
}

export function emptyQuestionDraft(id: string, label: string, maxPoints = ""): QuestionDraft {
  return { acceptedEquivalents: "", finalAnswer: "", id, label, maxPoints, promptText: "", solutionSteps: "" };
}

/**
 * Field errors that block even a draft save (the database refuses these shapes): missing or
 * duplicate labels, points that are not a quarter step between 0,25 and 10, text over the limits.
 */
export function questionDraftErrors(drafts: QuestionDraft[]): QuestionDraftErrors[] {
  const seen = new Map<string, number>();
  drafts.forEach((draft, index) => {
    const label = draft.label.trim().toLowerCase();
    if (label !== "" && !seen.has(label)) seen.set(label, index);
  });

  return drafts.map((draft, index) => {
    const errors: QuestionDraftErrors = {};
    const label = draft.label.trim();
    if (label === "") errors.label = "Nhập số câu.";
    else if (label.length > ANSWER_KEY_LIMITS.labelLength) errors.label = `Tối đa ${ANSWER_KEY_LIMITS.labelLength} ký tự.`;
    else if (seen.get(label.toLowerCase()) !== index) errors.label = "Số câu bị trùng với câu khác.";

    const points = parsePoints(draft.maxPoints);
    if (points !== null && !isValidPoints(points)) errors.maxPoints = "Từ 0,25 đến 10, theo bước 0,25.";

    if (draft.finalAnswer.trim().length > ANSWER_KEY_LIMITS.finalAnswerLength) {
      errors.finalAnswer = `Tối đa ${ANSWER_KEY_LIMITS.finalAnswerLength} ký tự.`;
    }
    if (draft.promptText.trim().length > ANSWER_KEY_LIMITS.promptLength) {
      errors.promptText = `Tối đa ${ANSWER_KEY_LIMITS.promptLength} ký tự.`;
    }
    const equivalents = lines(draft.acceptedEquivalents);
    if (equivalents.length > ANSWER_KEY_LIMITS.equivalents) {
      errors.acceptedEquivalents = `Tối đa ${ANSWER_KEY_LIMITS.equivalents} cách viết.`;
    } else if (equivalents.some((line) => line.length > ANSWER_KEY_LIMITS.equivalentLength)) {
      errors.acceptedEquivalents = `Mỗi cách viết tối đa ${ANSWER_KEY_LIMITS.equivalentLength} ký tự.`;
    }
    const steps = lines(draft.solutionSteps);
    if (steps.length > ANSWER_KEY_LIMITS.steps) {
      errors.solutionSteps = `Tối đa ${ANSWER_KEY_LIMITS.steps} bước.`;
    } else if (steps.some((line) => line.length > ANSWER_KEY_LIMITS.stepLength)) {
      errors.solutionSteps = `Mỗi bước tối đa ${ANSWER_KEY_LIMITS.stepLength} ký tự.`;
    }
    return errors;
  });
}

export function hasDraftErrors(errors: QuestionDraftErrors[]): boolean {
  return errors.some((entry) => Object.keys(entry).length > 0);
}

/**
 * The key the drafts describe, normalised like the database does (trimmed, empty lines
 * dropped). Points that do not parse become null; callers block on questionDraftErrors first.
 */
export function answerKeyFromDrafts(drafts: QuestionDraft[]): AnswerKey {
  return {
    questions: drafts.map((draft) => {
      const points = parsePoints(draft.maxPoints);
      return {
        acceptedEquivalents: lines(draft.acceptedEquivalents),
        finalAnswer: draft.finalAnswer.trim(),
        label: draft.label.trim(),
        maxPoints: points === null || Number.isNaN(points) ? null : points,
        promptText: draft.promptText.trim(),
        solutionSteps: lines(draft.solutionSteps),
      };
    }),
  };
}
