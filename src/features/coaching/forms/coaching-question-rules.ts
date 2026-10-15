import type { CoachingQuestionType } from "./coaching-form-types";

/**
 * Client-side mirrors of the database rules in `coaching_validate_question`
 * and `submit_public_coaching_form` (migration 20260815100000). They only let
 * the screens explain a problem before a round trip; the server stays
 * authoritative and re-checks everything.
 */

export const COACHING_SCALE_BOUNDS = { max: 10, min: 0 } as const;
export const COACHING_MAX_OPTIONS = 50;
export const COACHING_MAX_OPTION_LENGTH = 500;
export const COACHING_MAX_QUESTIONS = 100;
/**
 * Text limits of the draft action's schema (draftSchema in
 * coaching-form-actions.ts): form name and title, question text, and 4000 for
 * instructions and question descriptions. The public form reuses 4000 for its
 * text answers as a client-side cap only: the submit action and the database
 * do not limit answer length.
 */
export const COACHING_MAX_NAME_LENGTH = 240;
export const COACHING_MAX_QUESTION_TITLE_LENGTH = 1000;
export const COACHING_MAX_TEXT_LENGTH = 4000;
/** revokeCoachingPublicLinkAction trims the reason and accepts 1–1000 characters. */
export const COACHING_MAX_REVOKE_REASON_LENGTH = 1000;
/** Scale end labels are free text in the configuration; kept short so they fit under the buttons. */
export const COACHING_MAX_SCALE_LABEL_LENGTH = 100;

export interface CoachingQuestionShape {
  configuration: Record<string, unknown>;
  required: boolean;
  title: string;
  type: CoachingQuestionType;
}

export function isChoiceQuestion(type: CoachingQuestionType): type is "multiple_choice" | "single_choice" {
  return type === "single_choice" || type === "multiple_choice";
}

/** The `options` array of a choice question, strings only, in order. */
export function getChoiceOptions(configuration: Record<string, unknown>): string[] {
  return Array.isArray(configuration.options)
    ? configuration.options.filter((option): option is string => typeof option === "string")
    : [];
}

function toInteger(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

export interface CoachingScaleRange {
  max: number;
  maxLabel: string;
  min: number;
  minLabel: string;
  valid: boolean;
}

/**
 * The scale's whole-number range and end labels. `valid` is false unless
 * 0 ≤ min < max ≤ 10 (the database rule), so a typo such as max = 1000 never
 * renders a thousand buttons.
 */
export function getScaleRange(configuration: Record<string, unknown>): CoachingScaleRange {
  const min = toInteger(configuration.min ?? 1);
  const max = toInteger(configuration.max ?? 5);
  const minLabel = typeof configuration.minLabel === "string" ? configuration.minLabel : "";
  const maxLabel = typeof configuration.maxLabel === "string" ? configuration.maxLabel : "";
  const valid =
    min !== null &&
    max !== null &&
    min >= COACHING_SCALE_BOUNDS.min &&
    max <= COACHING_SCALE_BOUNDS.max &&
    min < max;
  return { max: valid ? max : 0, maxLabel, min: valid ? min : 0, minLabel, valid };
}

export function getScaleValues(range: CoachingScaleRange): number[] {
  return range.valid ? Array.from({ length: range.max - range.min + 1 }, (_, index) => range.min + index) : [];
}

/**
 * The builder's stricter check: Từ and Đến must both be set. getScaleRange
 * falls back to 1–5 for a missing bound so the public form can still show a
 * legacy configuration, but a draft without a bound must not pass as valid.
 */
export function isScaleConfigurationValid(configuration: Record<string, unknown>): boolean {
  return (
    toInteger(configuration.min) !== null && toInteger(configuration.max) !== null && getScaleRange(configuration).valid
  );
}

/** Numeric bounds of a number question, when the configuration sets them. */
export function getNumberBounds(configuration: Record<string, unknown>): { max: number | null; min: number | null } {
  // The database casts the bounds to numeric, so a numeric string counts too.
  const read = (value: unknown) => {
    const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
  };
  return { max: read(configuration.max), min: read(configuration.min) };
}

/** Problems with one builder question, in the order the editor shows its fields. */
export function getQuestionConfigIssues(question: CoachingQuestionShape): string[] {
  const issues: string[] = [];
  if (!question.title.trim()) issues.push("Cần nhập nội dung câu hỏi.");
  if (isChoiceQuestion(question.type)) {
    const options = getChoiceOptions(question.configuration).map((option) => option.trim());
    if (options.length === 0) issues.push("Cần ít nhất một lựa chọn.");
    if (options.length > COACHING_MAX_OPTIONS) issues.push(`Tối đa ${COACHING_MAX_OPTIONS} lựa chọn.`);
    if (options.some((option) => option === "")) issues.push("Lựa chọn không được để trống.");
    if (new Set(options.filter(Boolean)).size !== options.filter(Boolean).length) {
      issues.push("Các lựa chọn phải khác nhau.");
    }
  }
  if (question.type === "scale" && !isScaleConfigurationValid(question.configuration)) {
    issues.push("Thang điểm cần Từ và Đến là số nguyên từ 0 đến 10, Từ nhỏ hơn Đến.");
  }
  return issues;
}

/**
 * The configuration the server expects: text questions carry exactly `{}`,
 * choice options are trimmed, scale bounds are numbers. Other keys pass
 * through untouched.
 */
export function normalizeQuestionConfiguration(question: CoachingQuestionShape): Record<string, unknown> {
  if (question.type === "short_text" || question.type === "long_text") return {};
  if (isChoiceQuestion(question.type)) {
    return { ...question.configuration, options: getChoiceOptions(question.configuration).map((option) => option.trim()) };
  }
  if (question.type === "scale") {
    const min = toInteger(question.configuration.min);
    const max = toInteger(question.configuration.max);
    return {
      ...question.configuration,
      max: max ?? question.configuration.max,
      min: min ?? question.configuration.min,
    };
  }
  return question.configuration;
}

export const COACHING_REQUIRED_ANSWER_MESSAGE = "Câu này bắt buộc. Vui lòng trả lời.";
export const COACHING_UNKNOWN_CHOICE_MESSAGE = "Vui lòng chọn một lựa chọn trong danh sách.";
/** Names the usual cause too: "1,5" is not a number to a `type=number` box, "1.5" is. */
export const COACHING_NOT_A_NUMBER_MESSAGE = "Vui lòng nhập một số (dùng dấu chấm, ví dụ 1.5).";

/**
 * Stored answer of a number question whose typed text the browser cannot
 * parse (`validity.badInput`, e.g. "1,5" where the locale wants "1.5"). A
 * `type=number` input then reports the value "", which would read as blank
 * and silently drop an optional answer; the marker keeps it visible as "not a
 * number" instead. It is never sent: validatePublicAnswers always rejects it.
 */
export const COACHING_INVALID_NUMBER = "__invalid_number__";

function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Checks a public form before it is sent: required questions must be
 * answered and answers must fit the question. Empty optional answers are left
 * out of the payload (the server rejects an empty string or an empty list,
 * but accepts a missing optional key).
 */
export function validatePublicAnswers(
  questions: readonly (CoachingQuestionShape & { id: string })[],
  answers: Record<string, unknown>,
): { errors: Record<string, string>; payload: Record<string, unknown> } {
  const errors: Record<string, string> = {};
  const payload: Record<string, unknown> = {};

  for (const question of questions) {
    const value = answers[question.id];
    if (isBlank(value)) {
      if (question.required) errors[question.id] = COACHING_REQUIRED_ANSWER_MESSAGE;
      continue;
    }

    if (question.type === "number") {
      const parsed = Number(value);
      const { max, min } = getNumberBounds(question.configuration);
      // The marker is text the browser could not read as a number: not blank, never sent.
      if (value === COACHING_INVALID_NUMBER || !Number.isFinite(parsed)) {
        errors[question.id] = COACHING_NOT_A_NUMBER_MESSAGE;
        continue;
      }
      if ((min !== null && parsed < min) || (max !== null && parsed > max)) {
        errors[question.id] = `Vui lòng nhập số từ ${min ?? "…"} đến ${max ?? "…"}.`;
        continue;
      }
    }

    if (question.type === "single_choice" && !getChoiceOptions(question.configuration).includes(String(value))) {
      errors[question.id] = COACHING_UNKNOWN_CHOICE_MESSAGE;
      continue;
    }

    payload[question.id] = value;
  }

  return { errors, payload };
}
