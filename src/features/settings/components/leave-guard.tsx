"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/**
 * What the leave dialog says. "discard": a form has unsaved changes and leaving
 * drops them. "saving": a multi-step save is still running; leaving lets it
 * finish but its errors can no longer be shown, and nothing is discarded.
 */
type LeaveGuardVariant = "discard" | "saving";

interface LeaveRegistration {
  discard: () => void;
  variant: LeaveGuardVariant;
}

interface LeaveGuardValue {
  isGuarded: () => boolean;
  /** Registers (or, with `null`, unregisters) a guarded form: how to drop its draft and which dialog to show. */
  setGuard: (id: string, registration: LeaveRegistration | null) => void;
  /** Asks first while a form is guarded, then navigates (discarding drafts only in the "discard" variant). */
  requestNavigation: (href: string) => void;
}

const LeaveGuardContext = createContext<LeaveGuardValue | null>(null);

/**
 * Tracks whether any settings form on the visible page has unsaved changes so
 * links inside the hub can ask before leaving. Forms register through
 * `useLeaveGuard`; Next keeps hidden copies of earlier routes, and their effects
 * are cleaned up while hidden, so only the visible page counts.
 *
 * The provider hosts the one shared leave dialog, outside the page content: it
 * never sits inside a <p> or a disabled <fieldset> of a form, and it stacks
 * above the StickySaveBar. "Rời trang" calls every registered discard before
 * navigating, so a hidden copy of the route cannot bring the draft back. While
 * a form registers the "saving" variant, the dialog warns about the running
 * save instead and "Vẫn rời trang" navigates without discarding anything.
 */
export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const guardedForms = useRef(new Map<string, LeaveRegistration>());
  const [pending, setPending] = useState<{ href: string; variant: LeaveGuardVariant } | null>(null);
  const isGuarded = useCallback(() => guardedForms.current.size > 0, []);
  const setGuard = useCallback((id: string, registration: LeaveRegistration | null) => {
    if (registration) guardedForms.current.set(id, registration);
    else guardedForms.current.delete(id);
  }, []);
  const requestNavigation = useCallback(
    (href: string) => {
      const registrations = Array.from(guardedForms.current.values());
      if (registrations.length === 0) router.push(href);
      // A running save outranks a draft: its dialog never discards anything.
      else setPending({ href, variant: registrations.some((entry) => entry.variant === "saving") ? "saving" : "discard" });
    },
    [router],
  );
  const value = useMemo(() => ({ isGuarded, requestNavigation, setGuard }), [isGuarded, requestNavigation, setGuard]);

  const leave = () => {
    if (!pending) return;
    setPending(null);
    if (pending.variant === "discard") {
      // Snapshot first: each discard makes its form clean, which unregisters it.
      for (const entry of Array.from(guardedForms.current.values())) entry.discard();
    }
    router.push(pending.href);
  };

  return (
    <LeaveGuardContext.Provider value={value}>
      {children}
      <LeaveConfirmDialog
        isOpen={pending !== null}
        onLeave={leave}
        onStay={() => setPending(null)}
        variant={pending?.variant ?? "discard"}
      />
    </LeaveGuardContext.Provider>
  );
}

/**
 * Asks the browser to confirm a reload/close while `active` (beforeunload).
 * It only prompts; it never discards anything.
 */
function useBeforeUnloadPrompt(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers need returnValue set to show their native prompt.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [active]);
}

/**
 * While a save is in flight: warns on reload/close so the request is not cut
 * off. Separate from `useLeaveGuard`: it never registers a discard and does not
 * hold hub links.
 */
export function useSaveInFlightGuard(isSaving: boolean): void {
  useBeforeUnloadPrompt(isSaving);
}

/**
 * While `active`: warns on reload/close (beforeunload) and makes hub links
 * rendered through `GuardedLink` / `useGuardedNavigation` confirm before
 * navigating. In the default "discard" variant `onDiscard` drops the draft when
 * the person chooses "Rời trang"; the "saving" variant (a multi-step save still
 * running) asks with its own copy and never calls `onDiscard`.
 * Not every Next navigation is intercepted (sidebar, browser back).
 */
export function useLeaveGuard(
  active: boolean,
  onDiscard?: () => void,
  { variant = "discard" }: { variant?: LeaveGuardVariant } = {},
): void {
  const guard = useContext(LeaveGuardContext);
  const id = useId();
  const discardRef = useRef(onDiscard);

  useEffect(() => {
    discardRef.current = onDiscard;
  });

  useEffect(() => {
    if (!active) return;
    guard?.setGuard(id, { discard: () => discardRef.current?.(), variant });
    return () => guard?.setGuard(id, null);
  }, [active, guard, id, variant]);

  useBeforeUnloadPrompt(active);
}

const leaveDialogCopy: Record<LeaveGuardVariant, { description: string; leave: string; title: string }> = {
  discard: {
    description: "Trang này còn thay đổi chưa lưu. Nếu rời trang, các thay đổi đó sẽ không được lưu.",
    leave: "Rời trang",
    title: "Thay đổi chưa lưu sẽ mất",
  },
  saving: {
    description:
      "Phân quyền đang được lưu lần lượt cho từng vai trò. Rời trang lúc này thì nếu một vai trò lưu lỗi, trang sẽ không báo được. Nên đợi lưu xong.",
    leave: "Vẫn rời trang",
    title: "Đang lưu phân quyền",
  },
};

export function LeaveConfirmDialog({
  isOpen,
  onLeave,
  onStay,
  variant = "discard",
}: {
  isOpen: boolean;
  onLeave: () => void;
  onStay: () => void;
  variant?: LeaveGuardVariant;
}) {
  const copy = leaveDialogCopy[variant];
  const titleId = useId();
  const descriptionId = useId();
  const stayRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      ariaDescribedBy={descriptionId}
      ariaLabelledBy={titleId}
      className="p-5 sm:max-w-md"
      initialFocusRef={stayRef}
      isOpen={isOpen}
      onClose={onStay}
    >
      <h2 className="text-section-title font-semibold text-text-strong" id={titleId}>
        {copy.title}
      </h2>
      <p className="mt-2 text-body text-text-muted" id={descriptionId}>
        {copy.description}
      </p>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button className="max-sm:h-11" onClick={onLeave} variant="secondary">
          {copy.leave}
        </Button>
        <Button className="max-sm:h-11" onClick={onStay} ref={stayRef}>
          Ở lại
        </Button>
      </div>
    </Dialog>
  );
}

/**
 * Click guard for in-hub links. While a form is guarded (dirty, or a
 * multi-step save running), a plain left click is held and the provider's leave
 * dialog asks first; leaving then navigates with the router (discarding drafts
 * only in the "discard" variant). Modifier and middle
 * clicks (new tab/window) pass through untouched. Outside a provider it does
 * nothing (the link navigates normally).
 */
export function useGuardedNavigation(): {
  onLinkClick: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
} {
  const guard = useContext(LeaveGuardContext);

  const onLinkClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, href: string) => {
      if (!guard || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      if (!guard.isGuarded()) return;
      event.preventDefault();
      guard.requestNavigation(href);
    },
    [guard],
  );

  return { onLinkClick };
}

/**
 * A next/link that asks before leaving while a settings form on the page has
 * unsaved changes. Outside a LeaveGuardProvider it is a plain Link.
 */
export function GuardedLink({
  href,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const { onLinkClick } = useGuardedNavigation();

  return (
    <Link
      href={href}
      onClick={(event) => {
        onClick?.(event);
        onLinkClick(event, href);
      }}
      {...props}
    />
  );
}
