import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import type { PublicCoachingQuestion } from "@/features/coaching/forms/coaching-form-types";
import {
  COACHING_INVALID_NUMBER,
  COACHING_MAX_TEXT_LENGTH,
  getChoiceOptions,
  getNumberBounds,
  getScaleRange,
  getScaleValues,
} from "@/features/coaching/forms/coaching-question-rules";
import { cn } from "@/lib/utils";

/** One question as the parent sees it: the public form's own type (the builder preview maps its drafts onto it). */
export type CoachingRendererQuestion = PublicCoachingQuestion;

export type CoachingQuestionRendererMode = "interactive" | "preview";

interface CoachingQuestionRendererProps {
  answers?: Record<string, unknown>;
  errors?: Record<string, string>;
  /** Unique per rendered form, so the preview and a real form never share radio names or ids. */
  idPrefix: string;
  /**
   * "interactive": the public form; controls report answers through
   * `onAnswer`. "preview": the builder's view of the same markup with every
   * control disabled; nothing is stored or sent.
   */
  mode: CoachingQuestionRendererMode;
  onAnswer?: (questionId: string, value: unknown) => void;
  questions: readonly CoachingRendererQuestion[];
}

/** id of the first control of a question; the public form focuses it when the answer is missing. */
export function getQuestionControlId(idPrefix: string, questionId: string): string {
  return `${idPrefix}-${questionId}-control`;
}

/**
 * A number box's answer as the browser holds it: the invalid-number marker
 * when its text cannot be read as a number (`validity.badInput`; `value` is
 * then ""), else its value. React skips onChange while `value` stays "", so
 * unreadable text typed into an empty box, or unreadable text deleted, is
 * never reported there; the box is re-read on blur, and the public form
 * re-reads every number box before it checks the answers.
 */
export function readNumberControl(input: HTMLInputElement): string {
  return input.validity?.badInput ? COACHING_INVALID_NUMBER : input.value;
}

// Inputs use 16px text on phones so mobile Safari does not zoom in on focus.
const textControlClassName =
  "w-full rounded-md border border-border-strong bg-surface-base px-3 text-base text-text-strong outline-hidden transition-colors placeholder:text-text-subtle hover:border-border-strong-hover focus-visible:border-border-focus focus-visible:ring-[3px] focus-visible:ring-focus-ring aria-[invalid=true]:border-danger disabled:cursor-default disabled:hover:border-border-strong sm:text-body";

const markFocusClassName =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:cursor-default";

/**
 * The public Coaching form's questions, shared by /coaching/form/[token] and
 * the builder's "Phụ huynh sẽ thấy" preview so the two cannot drift. Each
 * question is a numbered fieldset; a required one shows "*" (decorative) and
 * says "bắt buộc" to assistive tech. Scale answers are 44px buttons named by
 * their number with the end labels under the row; choices are 44px rows with
 * real radio/checkbox inputs. One-line boxes label the keyboard's Enter key
 * "next": the public form moves focus on Enter instead of submitting.
 */
export function CoachingQuestionRenderer({
  answers = {},
  errors = {},
  idPrefix,
  mode,
  onAnswer,
  questions,
}: CoachingQuestionRendererProps) {
  const preview = mode === "preview";

  return (
    <div className="grid gap-6">
      {questions.map((question, index) => {
        const base = `${idPrefix}-${question.id}`;
        const titleId = `${base}-title`;
        const descriptionId = question.description ? `${base}-description` : undefined;
        const error = errors[question.id];
        const errorId = error ? `${base}-error` : undefined;
        const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;
        const answer = (value: unknown) => {
          if (!preview) onAnswer?.(question.id, value);
        };

        return (
          <fieldset aria-describedby={describedBy} className="m-0 min-w-0 border-0 p-0" key={question.id}>
            <legend className="mb-2 p-0 text-body font-semibold text-text-strong" id={titleId}>
              {index + 1}. {question.title}
              {question.required ? (
                <>
                  <span aria-hidden="true" className="text-danger">
                    {" "}
                    *
                  </span>
                  <span className="sr-only"> (bắt buộc)</span>
                </>
              ) : null}
            </legend>
            <div className="grid gap-2">
              {question.description ? (
                <p className="whitespace-pre-wrap break-words text-secondary text-text-muted" id={descriptionId}>
                  {question.description}
                </p>
              ) : null}
              <QuestionControl
                answer={answer}
                base={base}
                controlId={getQuestionControlId(idPrefix, question.id)}
                describedBy={describedBy}
                invalid={Boolean(error)}
                preview={preview}
                question={question}
                titleId={titleId}
                value={answers[question.id]}
              />
              {error ? (
                <p className="flex items-start gap-1.5 text-secondary font-medium text-danger" id={errorId}>
                  <CircleAlert aria-hidden="true" className="mt-px shrink-0" size={16} strokeWidth={1.8} />
                  {error}
                </p>
              ) : null}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

function QuestionControl({
  answer,
  base,
  controlId,
  describedBy,
  invalid,
  preview,
  question,
  titleId,
  value,
}: {
  answer: (value: unknown) => void;
  base: string;
  controlId: string;
  describedBy: string | undefined;
  invalid: boolean;
  preview: boolean;
  question: CoachingRendererQuestion;
  titleId: string;
  value: unknown;
}) {
  const textProps = {
    "aria-describedby": describedBy,
    "aria-invalid": invalid || undefined,
    "aria-labelledby": titleId,
    "aria-required": question.required || undefined,
    disabled: preview,
    id: controlId,
  };

  switch (question.type) {
    case "short_text":
      return (
        <input
          {...textProps}
          className={cn(textControlClassName, "min-h-11")}
          enterKeyHint="next"
          maxLength={COACHING_MAX_TEXT_LENGTH}
          onChange={(event) => answer(event.target.value)}
          placeholder={preview ? "Câu trả lời ngắn" : undefined}
          value={typeof value === "string" ? value : ""}
        />
      );
    case "long_text":
      return (
        <textarea
          {...textProps}
          className={cn(textControlClassName, "min-h-28 resize-y py-2.5")}
          maxLength={COACHING_MAX_TEXT_LENGTH}
          onChange={(event) => answer(event.target.value)}
          placeholder={preview ? "Câu trả lời dài" : undefined}
          value={typeof value === "string" ? value : ""}
        />
      );
    case "number": {
      const bounds = getNumberBounds(question.configuration);
      return (
        <input
          {...textProps}
          className={cn(textControlClassName, "min-h-11 tabular-nums")}
          enterKeyHint="next"
          inputMode="decimal"
          max={bounds.max ?? undefined}
          min={bounds.min ?? undefined}
          // Catches what onChange never sees (see readNumberControl).
          onBlur={(event) => {
            const next = readNumberControl(event.target);
            if (next !== (typeof value === "string" ? value : "")) answer(next);
          }}
          // Text the browser cannot read as a number reports value "": store the marker so it is not taken for blank.
          onChange={(event) => answer(readNumberControl(event.target))}
          step="any"
          type="number"
          // "" for the marker leaves the person's unreadable text in the box instead of overwriting it.
          value={
            value === COACHING_INVALID_NUMBER ? "" : typeof value === "number" || typeof value === "string" ? value : ""
          }
        />
      );
    }
    case "single_choice":
    case "multiple_choice":
      return (
        <ChoiceRows
          answer={answer}
          base={base}
          controlId={controlId}
          multiple={question.type === "multiple_choice"}
          options={getChoiceOptions(question.configuration).filter((option) => option.trim() !== "")}
          preview={preview}
          value={value}
        />
      );
    case "scale":
      return <ScaleButtons answer={answer} controlId={controlId} preview={preview} question={question} value={value} />;
    default:
      return null;
  }
}

function ChoiceRows({
  answer,
  base,
  controlId,
  multiple,
  options,
  preview,
  value,
}: {
  answer: (value: unknown) => void;
  base: string;
  controlId: string;
  multiple: boolean;
  options: string[];
  preview: boolean;
  value: unknown;
}) {
  if (options.length === 0) {
    return <EmptyConfiguration>Chưa có lựa chọn nào.</EmptyConfiguration>;
  }

  const selected = Array.isArray(value) ? value : [];
  return (
    <div className="grid gap-2">
      {options.map((option, index) => {
        const checked = multiple ? selected.includes(option) : value === option;
        return (
          <label
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md border border-border-subtle bg-surface-base px-3 py-2 text-body text-text-strong transition-colors",
              preview ? "cursor-default" : "cursor-pointer [&:not(:has(:checked))]:hover:border-border-strong-hover",
              "has-[:checked]:border-action-primary has-[:checked]:bg-action-primary-soft",
            )}
            key={`${index}-${option}`}
          >
            <input
              checked={checked}
              className={cn("h-[18px] w-[18px] shrink-0 accent-action-primary", markFocusClassName)}
              disabled={preview}
              id={index === 0 ? controlId : undefined}
              name={base}
              onChange={(event) => {
                if (!multiple) {
                  answer(option);
                  return;
                }
                answer(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option));
              }}
              type={multiple ? "checkbox" : "radio"}
              value={option}
            />
            <span className="min-w-0 break-words">{option}</span>
          </label>
        );
      })}
    </div>
  );
}

function ScaleButtons({
  answer,
  controlId,
  preview,
  question,
  value,
}: {
  answer: (value: unknown) => void;
  controlId: string;
  preview: boolean;
  question: CoachingRendererQuestion;
  value: unknown;
}) {
  const range = getScaleRange(question.configuration);
  if (!range.valid) {
    return <EmptyConfiguration>Thang điểm chưa hợp lệ: Từ và Đến là số nguyên từ 0 đến 10, Từ nhỏ hơn Đến.</EmptyConfiguration>;
  }

  return (
    <div className="grid gap-1.5">
      {/* auto-fit keeps every button ≥ 44px and wraps 0–10 onto two rows on a phone. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(44px,1fr))] gap-1">
        {getScaleValues(range).map((number, index) => {
          const selected = value === number;
          return (
            <button
              aria-pressed={selected}
              className={cn(
                "min-h-11 min-w-11 rounded-md border text-body tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
                selected
                  ? "border-action-primary bg-action-primary-soft font-semibold text-action-primary shadow-[inset_0_0_0_1px_var(--action-primary)]"
                  : "border-border-strong bg-surface-base text-text-strong",
                preview ? "cursor-default" : cn("cursor-pointer", !selected && "hover:border-border-strong-hover"),
              )}
              disabled={preview}
              id={index === 0 ? controlId : undefined}
              key={number}
              onClick={() => answer(number)}
              type="button"
            >
              {number}
            </button>
          );
        })}
      </div>
      {range.minLabel || range.maxLabel ? (
        <div className="flex justify-between gap-3 text-caption text-text-muted">
          <span>{range.minLabel}</span>
          <span className="text-right">{range.maxLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

function EmptyConfiguration({ children }: { children: ReactNode }) {
  return <p className="text-secondary text-text-muted">{children}</p>;
}
