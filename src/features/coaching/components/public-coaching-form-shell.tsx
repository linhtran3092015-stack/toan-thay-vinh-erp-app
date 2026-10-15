import type { ReactNode, Ref } from "react";

import { getButtonClassName } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Header line of the public form (design 13c). The public route has no session, so it cannot read the centre's settings. */
export const PUBLIC_FORM_BRAND = "Toán Thầy Vinh";

/**
 * Page frame of the public Coaching routes (outside the app shell): tokens
 * only, no app chrome. On a phone the form sits on white with a 16px gutter
 * (358px of content at 390px); from `sm` it becomes a card on the canvas.
 * Max width ~480px.
 */
export function PublicFormShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-surface-base px-4 py-6 text-text-default sm:bg-surface-canvas sm:py-10">
      <div className="mx-auto w-full max-w-[480px] sm:rounded-lg sm:border sm:border-border-subtle sm:bg-surface-base sm:p-6 sm:shadow-[var(--panel-shadow)]">
        {children}
      </div>
    </main>
  );
}

/**
 * The given name only: a Vietnamese full name ends with it ("Bùi Quang Minh"
 * → "Minh"). The public page opens without a session, so a link sent to the
 * wrong family must not show another child's full name. Null when blank.
 */
export function getStudentGivenName(fullName: string | null | undefined): string | null {
  return fullName?.trim().split(/\s+/).at(-1) || null;
}

/**
 * Brand line, title and instructions of the public form, shared with the
 * builder preview. The public page renders the title as its h1; the preview
 * passes `titleAs="p"` so the builder keeps a single h1.
 */
export function PublicFormIntro({
  instructions,
  studentName,
  title,
  titleAs: Title = "h1",
}: {
  instructions: string | null;
  studentName?: string | null;
  title: string;
  titleAs?: "h1" | "p";
}) {
  return (
    <div className="grid gap-2">
      <p className="text-caption text-text-muted">
        {studentName ? `${PUBLIC_FORM_BRAND} · ${studentName}` : PUBLIC_FORM_BRAND}
      </p>
      <Title className={cn("text-base/[22px] font-bold", title ? "text-text-strong" : "text-text-subtle")}>
        {title || "(Chưa có tiêu đề)"}
      </Title>
      {instructions ? (
        <p className="whitespace-pre-wrap break-words text-body text-text-default">{instructions}</p>
      ) : null}
    </div>
  );
}

/** Under "Gửi phiếu" on the public form and in the builder's preview of it. */
export const PUBLIC_FORM_SUBMIT_NOTE = "Phiếu chỉ gửi được một lần.";

/**
 * Also the exact messages submitPublicCoachingFormAction returns when the link
 * became final while the form was open, so the form can switch to the same
 * screen the page shows on its next load.
 */
const publicStateMessages: Record<string, string> = {
  expired: "Liên kết đã hết hạn.",
  revoked: "Liên kết không còn hiệu lực.",
  submitted: "Phiếu này đã được gửi.",
};

/**
 * Screen state of a page whose read failed: nothing is known about the link,
 * so the screen asks for a reload instead of a new link (asking the centre
 * for one would revoke a link that may still work). Not a link state.
 */
export const PUBLIC_FORM_UNAVAILABLE_STATE = "unavailable";

/** Non-active link states of /coaching/form/[token]; unknown or unpublished states read as invalid. */
export function getPublicFormStateMessage(state: string): string {
  return Object.hasOwn(publicStateMessages, state) ? publicStateMessages[state]! : "Liên kết không hợp lệ.";
}

/**
 * The final link state a submit error message stands for ("expired",
 * "revoked", "submitted"), or null for any other message (retryable). Reads
 * only the map's own entries, so prototype keys never match.
 */
export function getPublicFormStateForMessage(message: string): string | null {
  return Object.entries(publicStateMessages).find(([, text]) => text === message)?.[0] ?? null;
}

export function PublicCoachingFormState({
  headingRef,
  reloadHref,
  state,
}: {
  /** Passed when the screen replaces the open form, so focus can move to its heading (tabIndex -1: no tab stop). */
  headingRef?: Ref<HTMLHeadingElement>;
  /** The page's own path, for the unavailable screen's "Tải lại trang"; ignored on every link state. */
  reloadHref?: string;
  /** A link state, or PUBLIC_FORM_UNAVAILABLE_STATE when the page could not read it. */
  state: string;
}) {
  const unavailable = state === PUBLIC_FORM_UNAVAILABLE_STATE;
  return (
    <PublicFormShell>
      <p className="text-caption text-text-muted">{PUBLIC_FORM_BRAND}</p>
      <h1
        className="mt-2 text-section-title font-semibold text-text-strong outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-border-focus"
        ref={headingRef}
        tabIndex={-1}
      >
        {unavailable ? "Chưa tải được phiếu." : getPublicFormStateMessage(state)}
      </h1>
      <p className="mt-2 text-body text-text-muted">
        {unavailable ? "Vui lòng tải lại trang sau ít phút." : "Liên hệ trung tâm nếu cần một liên kết mới."}
      </p>
      {unavailable && reloadHref ? (
        // A plain link, not next/link: a full page load reads the link again on the server.
        <a className={getButtonClassName({ className: "mt-4", size: "lg", variant: "secondary" })} href={reloadHref}>
          Tải lại trang
        </a>
      ) : null}
    </PublicFormShell>
  );
}
