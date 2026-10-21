import type { ReactNode } from "react";

import { PageHeader } from "@/components/patterns/page-header";
import { Stepper, type StepperStep } from "@/components/patterns/stepper";

export interface ImportWizardFrameProps {
  /** Page h1, e.g. "Nhập học sinh từ file". */
  title: string;
  /**
   * 13px muted line under the title once a file is read: "{file} · {n} dòng".
   * Never a batch code: no import pipeline has one.
   */
  context?: ReactNode;
  /** Accessible name of the step list, e.g. "Các bước nhập học sinh". */
  stepperLabel: string;
  /** The pipeline's real steps (W1); exactly one is `current`. */
  steps: readonly StepperStep[];
  /** Header actions (e.g. a link back to the batch list); never the step's primary. */
  headerActions?: ReactNode;
  /** The current step's body only. */
  children: ReactNode;
  /** The step's `ImportActionBar`, under the body. */
  actionBar?: ReactNode;
}

// The shared Stepper lays steps out in four columns from xl; a pipeline with
// another step count gets one column per step there (full literals for the
// Tailwind scanner; `!` because `cn` does not merge the Stepper's own class).
const STEPPER_XL_COLUMNS: Readonly<Record<number, string>> = {
  2: "xl:grid-cols-2!",
  3: "xl:grid-cols-3!",
  5: "xl:grid-cols-5!",
  6: "xl:grid-cols-6!",
};

// The Stepper's borders assume an even count: every odd step keeps a right
// rule from sm (`sm:[&:nth-child(odd)]:border-r`). With an odd count the last
// step would double the frame's right edge at xl, and from sm to xl it would
// sit alone in its row beside an empty cell. Set on the <ol>: no right rule on
// the last step, and from sm to below xl it spans both columns. `!` beats the
// Stepper's own rule whatever the CSS order.
const STEPPER_ODD_LAST_STEP = "[&>li:last-child]:border-r-0! sm:[&>li:last-child]:col-span-2 xl:[&>li:last-child]:col-span-1";

/**
 * Extra Stepper classes of an import pipeline with `stepCount` steps: one
 * column per step at xl, and the odd-count last-step fixes above. Undefined
 * for four steps (the Stepper's own layout). Shared by the wizard frame and
 * the batch pages that repeat the wizard's steps.
 */
export function importStepperClassName(stepCount: number): string | undefined {
  const classes = [STEPPER_XL_COLUMNS[stepCount], stepCount % 2 === 1 ? STEPPER_ODD_LAST_STEP : undefined].filter(Boolean);
  return classes.length > 0 ? classes.join(" ") : undefined;
}

/**
 * Import wizard frame (design 17c, §4.3): PageHeader (title + optional
 * context line) → Stepper → the current step's body → the action bar, in one
 * column with a 20px gap. Presentation only and server-safe: the feature owns
 * which step is current, the step body and every action.
 */
export function ImportWizardFrame({
  actionBar,
  children,
  context,
  headerActions,
  stepperLabel,
  steps,
  title,
}: ImportWizardFrameProps) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader actions={headerActions} title={title}>
        {context ? <p className="mt-1 text-secondary text-text-muted">{context}</p> : null}
      </PageHeader>
      <Stepper className={importStepperClassName(steps.length)} label={stepperLabel} steps={steps} />
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">{children}</div>
      {actionBar}
    </div>
  );
}
