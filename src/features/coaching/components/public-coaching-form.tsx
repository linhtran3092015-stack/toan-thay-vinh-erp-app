"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { ResultBanner } from "@/components/shared/result-banner";
import { Button } from "@/components/ui/button";
import { submitPublicCoachingFormAction } from "@/features/coaching/actions/public-coaching-form-actions";
import type { CoachingActionOverrides } from "@/features/coaching/coaching-action-overrides";
import { PUBLIC_FORM_CONNECTION_ERROR_MESSAGE } from "@/features/coaching/coaching-presentation";
import type { PublicCoachingQuestion } from "@/features/coaching/forms/coaching-form-types";
import {
  COACHING_REQUIRED_ANSWER_MESSAGE,
  validatePublicAnswers,
} from "@/features/coaching/forms/coaching-question-rules";

import { CoachingQuestionRenderer, getQuestionControlId, readNumberControl } from "./coaching-question-renderer";
import {
  getPublicFormStateForMessage,
  PUBLIC_FORM_SUBMIT_NOTE,
  PublicCoachingFormState,
  PublicFormIntro,
  PublicFormShell,
} from "./public-coaching-form-shell";

export interface PublicCoachingFormProps {
  /** Inert stub in the /dev preview; the real page passes nothing. */
  action?: CoachingActionOverrides["submitPublicCoachingForm"];
  instructions: string | null;
  questions: PublicCoachingQuestion[];
  /** Given name of the student the link was issued for (never the full name: the page has no session). */
  studentName?: string | null;
  title: string;
  token: string;
}

type FocusableControl = HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** A form element Enter can move focus to: a control (not a fieldset or output), enabled and shown. */
function isFocusableControl(element: Element): element is FocusableControl {
  if (
    !(
      element instanceof HTMLInputElement ||
      element instanceof HTMLButtonElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement
    )
  ) {
    return false;
  }
  return !element.disabled && !element.hidden && !(element instanceof HTMLInputElement && element.type === "hidden");
}

const isRadio = (element: Element): element is HTMLInputElement =>
  element instanceof HTMLInputElement && element.type === "radio";

/**
 * Enter in any input (a text or number box, a radio, a checkbox) would submit
 * the one-time form early (implicit submission). It moves focus to the next
 * control instead, as the one-line boxes' Enter key ("next") promises: past
 * the rest of a radio group, onto another group's checked radio, and to
 * "Gửi phiếu" after the last answer. Left alone while an input method
 * composes (Vietnamese input commits a word with Enter, and Safari reports
 * that keydown as keyCode 229 rather than isComposing), in textareas (a new
 * line) and on buttons (Enter presses them). A held Enter does nothing at
 * all in the form.
 */
function moveFocusOnEnter(event: KeyboardEvent<HTMLFormElement>) {
  if (event.key !== "Enter") return;
  // A held Enter auto-repeats: it would walk focus onto "Gửi phiếu" and the next repeat would press it.
  if (event.repeat) {
    event.preventDefault();
    return;
  }
  if (event.nativeEvent.isComposing || event.keyCode === 229) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.type === "submit" || target.type === "button") return;
  event.preventDefault();

  const form = event.currentTarget;
  const controls = Array.from(form.elements).filter(isFocusableControl);
  const after = controls
    .slice(controls.indexOf(target) + 1)
    .filter((control) => !(isRadio(target) && isRadio(control) && control.name === target.name));
  let next: FocusableControl | undefined = after[0];
  if (next && isRadio(next)) {
    const groupName = next.name;
    next = after.find((control) => isRadio(control) && control.name === groupName && control.checked) ?? next;
  }
  // "Gửi phiếu" is the last control, so it is next after the last answer (a disabled one cannot take focus anyway).
  next?.focus();
}

const subscribeToNothing = () => () => {};

/**
 * False in the server HTML (and while it hydrates), true once React runs in
 * the browser. Until then the whole form stays disabled:
 * - "Gửi phiếu": the form has no submit handler yet, so it would do a native
 *   GET to the same URL, losing the answers and putting the chosen options in
 *   the address (history, server logs);
 * - the questions: the first client render after hydration writes the
 *   (empty) controlled values back, wiping anything typed or ticked in the
 *   server HTML on a slow phone.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

/**
 * /coaching/form/[token] (design 13c preview, mobile-first): brand line,
 * title, instructions, numbered questions and a full-width 48px "Gửi phiếu".
 * Required questions are checked here first, so a missing answer is named
 * next to its question and focused before anything is sent; the server stays
 * authoritative. Empty optional answers are left out of the payload. After a
 * successful submission only the confirmation remains (no second submit).
 * When the server says the link is already used, expired or revoked, the form
 * gives way to that final screen (retrying could never succeed); any other
 * failure, including a call that never reached the server, keeps the answers
 * on screen with a message so the parent can send again. Enter never submits
 * (it moves to the next control), and the questions and "Gửi phiếu" stay
 * disabled ("Đang tải phiếu…") until the page has hydrated.
 */
export function PublicCoachingForm({
  action = submitPublicCoachingFormAction,
  instructions,
  questions,
  studentName,
  title,
  token,
}: PublicCoachingFormProps) {
  const idPrefix = useId();
  const hydrated = useHydrated();
  const loadingId = useId();
  const successRef = useRef<HTMLHeadingElement>(null);
  const finalStateRef = useRef<HTMLHeadingElement>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverMessage, setServerMessage] = useState("");
  const [done, setDone] = useState(false);
  /** "expired" | "revoked" | "submitted" once the server reports the link as final. */
  const [finalState, setFinalState] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const errorMessages = Object.values(errors);
  const onlyMissing = errorMessages.every((message) => message === COACHING_REQUIRED_ANSWER_MESSAGE);

  useEffect(() => {
    if (done) successRef.current?.focus();
  }, [done]);

  useEffect(() => {
    if (finalState) finalStateRef.current?.focus();
  }, [finalState]);

  const setAnswer = (questionId: string, value: unknown) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setErrors((current) => {
      if (!(questionId in current)) return current;
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  };

  /**
   * The answers with every number box re-read from the page: React may not
   * have reported a box's latest text (see readNumberControl), and the check
   * must judge what the parent sees.
   */
  const withNumberBoxes = (stored: Record<string, unknown>): Record<string, unknown> => {
    let next = stored;
    for (const question of questions) {
      if (question.type !== "number") continue;
      const control = document.getElementById(getQuestionControlId(idPrefix, question.id));
      if (!(control instanceof HTMLInputElement)) continue;
      const value = readNumberControl(control);
      if (value !== (stored[question.id] ?? "")) next = { ...next, [question.id]: value };
    }
    return next;
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const current = withNumberBoxes(answers);
    if (current !== answers) setAnswers(current);
    const checked = validatePublicAnswers(questions, current);
    const firstInvalid = questions.find((question) => question.id in checked.errors);
    setErrors(checked.errors);
    setServerMessage("");
    if (firstInvalid) {
      document.getElementById(getQuestionControlId(idPrefix, firstInvalid.id))?.focus();
      return;
    }

    startTransition(async () => {
      let result: Awaited<ReturnType<typeof action>>;
      try {
        result = await action(token, checked.payload);
      } catch {
        // A rejected call (offline, a deploy while the page was open) must not reach the error boundary and wipe the answers.
        result = { message: PUBLIC_FORM_CONNECTION_ERROR_MESSAGE, status: "error" };
      }
      if (result.status === "success") {
        setDone(true);
        return;
      }
      const state = getPublicFormStateForMessage(result.message);
      if (state) setFinalState(state);
      else setServerMessage(result.message);
    });
  };

  if (finalState) {
    return <PublicCoachingFormState headingRef={finalStateRef} state={finalState} />;
  }

  if (done) {
    return (
      <PublicFormShell>
        <h1
          className="text-section-title font-semibold text-text-strong outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-border-focus"
          ref={successRef}
          tabIndex={-1}
        >
          Phiếu Coaching đã được gửi thành công.
        </h1>
        <p className="mt-2 text-body text-text-muted">Cảm ơn bạn đã dành thời gian phản hồi.</p>
      </PublicFormShell>
    );
  }

  return (
    <PublicFormShell>
      <form className="grid gap-6" noValidate onKeyDown={moveFocusOnEnter} onSubmit={submit}>
        <PublicFormIntro instructions={instructions} studentName={studentName} title={title} />
        {/* Inert until React controls the inputs (see useHydrated). */}
        <fieldset className="m-0 min-w-0 border-0 p-0" disabled={!hydrated}>
          <CoachingQuestionRenderer
            answers={answers}
            errors={errors}
            idPrefix={idPrefix}
            mode="interactive"
            onAnswer={setAnswer}
            questions={questions}
          />
        </fieldset>
        <div className="grid gap-3">
          {errorMessages.length > 0 ? (
            <ResultBanner
              description={
                onlyMissing
                  ? `Còn ${errorMessages.length} câu cần trả lời; các câu đó được đánh dấu ở trên.`
                  : `Còn ${errorMessages.length} câu cần sửa; các câu đó được đánh dấu ở trên.`
              }
              title={onlyMissing ? "Vui lòng trả lời các câu hỏi bắt buộc." : "Vui lòng kiểm tra lại phiếu."}
              tone="error"
            />
          ) : serverMessage ? (
            <ResultBanner title={serverMessage} tone="error" />
          ) : null}
          {/* Disabled in the server HTML: a disabled default button also blocks Enter's implicit submission. */}
          <Button
            aria-describedby={hydrated ? undefined : loadingId}
            className="h-12! w-full"
            disabled={!hydrated || pending}
            isLoading={pending}
            size="lg"
            type="submit"
          >
            {pending ? "Đang gửi…" : "Gửi phiếu"}
          </Button>
          {hydrated ? null : (
            <p className="text-center text-caption text-text-muted" id={loadingId}>
              Đang tải phiếu…
            </p>
          )}
          <noscript>
            <p className="text-center text-caption text-text-muted">
              Trình duyệt đang tắt JavaScript. Hãy mở liên kết bằng Chrome hoặc Safari bản mới để gửi phiếu.
            </p>
          </noscript>
          <p className="text-center text-caption text-text-muted">{PUBLIC_FORM_SUBMIT_NOTE}</p>
        </div>
      </form>
    </PublicFormShell>
  );
}
