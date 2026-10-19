"use client";

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";

import {
  countLoadedNotifications,
  filterNotificationsByChip,
  type NotificationChip,
} from "@/features/notifications/notification-models";
import type { NotificationActionResult, NotificationEntry } from "@/features/notifications/read-models";

const NO_IDS: ReadonlySet<string> = new Set();
const CONNECTION_ERROR = "Không thể kết nối tới hệ thống thông báo.";

/** Where a settled result sends focus. `fallback` = the labelled list, else the in-frame empty message. */
type FocusTarget = { kind: "banner" } | { kind: "fallback" } | { id: string; kind: "row" | "rowButton" };

/** `origin` = what held focus when the action started; focus only moves if it is still there or was lost. */
interface FocusRequest {
  origin: Element | null;
  target: FocusTarget;
}

export interface NotificationListResults {
  /** "Đánh dấu tất cả đã đọc" result, under the header. Account-wide: a late one still shows after a page change. */
  banner: NotificationActionResult | null;
  /** A row button's failure, in that row. Page-scoped: dropped on a page change. */
  rowError: { id: string; message: string } | null;
}

const NO_RESULTS: NotificationListResults = { banner: null, rowError: null };

/**
 * A settled result → the messages shown. At most one alert: a failure
 * replaces any other failure (the latest failure shows). A success clears
 * only its own target: a row success that row's error, mark-all everything.
 */
export function applyNotificationResult(
  current: NotificationListResults,
  target: "all" | { id: string },
  result: NotificationActionResult,
): NotificationListResults {
  if (target === "all") return { banner: result, rowError: null };
  if (result.status === "success") {
    return current.rowError?.id === target.id ? { ...current, rowError: null } : current;
  }
  return {
    banner: current.banner?.status === "error" ? null : current.banner,
    rowError: { id: target.id, message: result.message },
  };
}

function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function focusWasLost(): boolean {
  return document.activeElement === null || document.activeElement === document.body;
}

/**
 * A result may move focus only if focus was lost (its control unmounted or
 * turned disabled) or is still where the action left it, inside this page.
 * Never out of a topbar dialog, never off a control the user moved to.
 */
function mayMoveFocus(root: HTMLElement | null, origin: Element | null): boolean {
  if (focusWasLost()) return true;
  return document.activeElement === origin && root !== null && root.contains(origin);
}

function findRow(list: HTMLElement | null, id: string): HTMLElement | null {
  for (const child of list?.children ?? []) {
    if (child instanceof HTMLElement && child.dataset.notificationId === id) return child;
  }
  return null;
}

interface Options {
  entries: readonly NotificationEntry[];
  markAll: () => Promise<NotificationActionResult>;
  markOne: (id: string) => Promise<NotificationActionResult>;
  onRefresh: () => void;
  page: number;
}

/**
 * The notification list's client state in one place: the chip, rows read in
 * this tab, pending marks, the shown results and where results send focus.
 *
 * - Page epoch: a pager link is a soft navigation that keeps the list mounted
 *   with a new `page`. The render that sees it bumps the epoch and resets the
 *   page's state (chip, results, focus request); `epochRef` follows in a layout
 *   effect. Handlers capture the render's epoch, so anything started on an
 *   earlier page (even 1→2→1) is recognised as stale.
 * - Opens: a linked row opens at once (next/link, or the browser for a new
 *   tab) and its mark-read runs in the background; nothing navigates after an
 *   await, so a slow action never pulls the user back. One mark per row at a time.
 * - Results: see `applyNotificationResult`. Row results are page-scoped;
 *   mark-all results are account-wide.
 * - Focus: see `mayMoveFocus`. After a pager click whose link left the page
 *   (2→1 via "Mới hơn", a last page via "Cũ hơn"), focus goes to the
 *   remaining pager link.
 */
export function useNotificationListState({ entries, markAll, markOne, onRefresh, page }: Options) {
  const [chip, setChip] = useState<NotificationChip>("all");
  const [results, setResults] = useState<NotificationListResults>(NO_RESULTS);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(NO_IDS);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  /*
   * Rows marked read in this tab, valid only against the entries they were
   * marked on: a successful action revalidates the route, and the refreshed
   * entries (with `readAt`) then win. Rows whose background mark is still
   * running stay read across a refresh another action triggered meanwhile.
   */
  const [localRead, setLocalRead] = useState<{ base: readonly NotificationEntry[]; ids: ReadonlySet<string> }>({
    base: entries,
    ids: NO_IDS,
  });
  const stillMarking = [...localRead.ids].filter((id) => pendingIds.has(id));
  if (localRead.base !== entries) {
    setLocalRead({ base: entries, ids: stillMarking.length > 0 ? new Set(stillMarking) : NO_IDS });
  }
  const locallyRead = localRead.base === entries ? localRead.ids : new Set(stillMarking);

  const [shownPage, setShownPage] = useState({ epoch: 0, page });
  if (shownPage.page !== page) {
    setShownPage({ epoch: shownPage.epoch + 1, page });
    setChip("all");
    setResults(NO_RESULTS);
    setFocusRequest(null);
  }
  const epoch = shownPage.epoch;

  const rootRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const emptyRef = useRef<HTMLParagraphElement>(null);
  const pagerRef = useRef<HTMLElement>(null);

  /** Same ids as `pendingIds`, readable in handlers before the next render. */
  const pendingRef = useRef(new Set<string>());
  const markingAllRef = useRef(false);
  const epochRef = useRef(epoch);
  const pagerClickRef = useRef<Element | null>(null);

  useLayoutEffect(() => {
    if (epochRef.current === epoch) return;
    epochRef.current = epoch;
    const pagerClicked = pagerClickRef.current !== null;
    pagerClickRef.current = null;
    if (pagerClicked && focusWasLost()) {
      (pagerRef.current?.querySelector("a") ?? listRef.current ?? emptyRef.current)?.focus({ preventScroll: true });
    }
  }, [epoch]);

  useEffect(() => {
    if (!focusRequest || !mayMoveFocus(rootRef.current, focusRequest.origin)) return;
    const { target } = focusRequest;
    if (target.kind === "banner") {
      bannerRef.current?.focus();
      return;
    }
    const row = target.kind === "fallback" ? null : findRow(listRef.current, target.id);
    const element = target.kind === "rowButton" ? row?.querySelector("button") : row;
    // A row the "Chưa đọc" chip filtered out falls back to the list (or its empty message). No scroll jump.
    (element ?? listRef.current ?? emptyRef.current)?.focus({ preventScroll: true });
  }, [focusRequest]);

  const markLocallyRead = (id: string) => {
    setLocalRead((current) => ({ base: current.base, ids: new Set([...current.ids, id]) }));
  };
  const startPending = (id: string) => {
    pendingRef.current.add(id);
    setPendingIds(new Set(pendingRef.current));
  };
  const endPending = (id: string) => {
    pendingRef.current.delete(id);
    setPendingIds(new Set(pendingRef.current));
  };
  const runMarkOne = async (id: string): Promise<NotificationActionResult> => {
    try {
      return await markOne(id);
    } catch {
      return { message: CONNECTION_ERROR, status: "error" };
    }
  };

  /**
   * Opening an unread linked row: the link opens at once (next/link for a plain
   * click, the browser for a new tab or window) and the row is marked read in
   * the background. The mark completes server-side whatever the page does; a
   * failure only leaves the row unread next time.
   */
  const openRow = (event: MouseEvent<HTMLAnchorElement>, entry: NotificationEntry) => {
    // Already marking this row: the click just follows the link, never a second action.
    if (pendingRef.current.has(entry.id)) return;
    const heldFocus = document.activeElement === event.currentTarget;
    markLocallyRead(entry.id);
    startPending(entry.id);
    void runMarkOne(entry.id).finally(() => endPending(entry.id));
    // A new tab keeps this page: under "Chưa đọc" the row and its focused link leave the list.
    if (!isPlainClick(event) && heldFocus && chip === "unread") {
      setFocusRequest({ origin: event.currentTarget, target: { kind: "fallback" } });
    }
  };

  /** A row without a link: its "Đánh dấu đã đọc" button. */
  const markRowRead = async (entry: NotificationEntry) => {
    if (pendingRef.current.has(entry.id)) return;
    const origin = document.activeElement;
    const startedIn = epoch;
    startPending(entry.id);
    setResults((current) => (current.rowError?.id === entry.id ? { ...current, rowError: null } : current));
    const result = await runMarkOne(entry.id);
    endPending(entry.id);
    if (result.status === "success") {
      markLocallyRead(entry.id);
      onRefresh();
    }
    if (startedIn !== epochRef.current) return;
    setResults((current) => applyNotificationResult(current, { id: entry.id }, result));
    // Success: the row is the result (its button leaves). Failure: back to the button for a retry.
    setFocusRequest({ origin, target: { id: entry.id, kind: result.status === "success" ? "row" : "rowButton" } });
  };

  /** "Đánh dấu tất cả đã đọc": every unread notification of the account. */
  const markEverythingRead = async () => {
    if (markingAllRef.current) return;
    markingAllRef.current = true;
    const origin = document.activeElement;
    setIsMarkingAll(true);
    setResults((current) => ({ ...current, banner: null }));
    let result: NotificationActionResult;
    try {
      result = await markAll();
    } catch {
      result = { message: CONNECTION_ERROR, status: "error" };
    }
    markingAllRef.current = false;
    setIsMarkingAll(false);
    setResults((current) => applyNotificationResult(current, "all", result));
    // The button was disabled while loading: success or failure, focus moves to the result.
    setFocusRequest({ origin, target: { kind: "banner" } });
    if (result.status === "success") {
      setLocalRead((current) => ({ base: current.base, ids: new Set(current.base.map((entry) => entry.id)) }));
      onRefresh();
    }
  };

  /** Pager links: remember a plain click so the next page can restore focus if the link is gone. */
  const notePagerClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isPlainClick(event)) pagerClickRef.current = event.currentTarget;
  };

  return {
    bannerRef,
    chip,
    counts: countLoadedNotifications(entries, locallyRead),
    emptyRef,
    isMarkingAll,
    listRef,
    locallyRead,
    markEverythingRead,
    markRowRead,
    notePagerClick,
    openRow,
    pagerRef,
    pendingIds,
    results,
    rootRef,
    setChip,
    visible: filterNotificationsByChip(entries, chip, locallyRead),
  };
}
