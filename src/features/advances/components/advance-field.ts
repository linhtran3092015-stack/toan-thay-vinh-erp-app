/**
 * Form controls of the two advance dialogs. They stay hand-rolled instead of
 * `Field`: that renders errors as `role="alert"`, while each dialog keeps one
 * alert (the action banner) and plain `<p id>` field errors.
 *
 * `outline-hidden` (rather than removing the outline) keeps it visible in forced-colors
 * mode; the focus ring is the 3px `--focus-ring`.
 */
const fieldBaseClassName =
  "w-full rounded-md border border-border-strong bg-surface-base px-3 text-control text-text-default outline-hidden transition-colors placeholder:text-text-subtle hover:border-border-strong-hover focus-visible:border-border-focus focus-visible:ring-[3px] focus-visible:ring-focus-ring aria-[invalid=true]:border-danger disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-text-disabled";

/** Inputs and selects: 44px on touch, 40px from `md`. */
export const advanceFieldClassName = `${fieldBaseClassName} min-h-11 md:min-h-10`;

/** Textareas: own height, so no 40px `md` floor competes with it. */
export const advanceTextareaClassName = `${fieldBaseClassName} min-h-24 resize-y py-2`;
