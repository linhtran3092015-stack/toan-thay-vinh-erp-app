"use client";

import { Bell, CalendarClock, ClipboardCheck, HandCoins, HeartHandshake, PhoneCall, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type MouseEvent, type ReactNode } from "react";

import { TableState } from "@/components/patterns/data-table-frame";
import { PageHeader } from "@/components/patterns/page-header";
import { QuickFilterChips } from "@/components/patterns/quick-filter-chips";
import { ResultBanner } from "@/components/shared/result-banner";
import { Button, getButtonClassName } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notifications/actions/notification-actions";
import { useNotificationListState } from "@/features/notifications/components/use-notification-list-state";
import type { NotificationActionOverrides } from "@/features/notifications/notification-action-overrides";
import {
  NOTIFICATIONS_PATH,
  buildNotificationChips,
  describeNotificationChipScope,
  describeNotificationContext,
  getNotificationEventLabel,
  getNotificationEventTone,
  getNotificationFamily,
  getNotificationPageHref,
  isNotificationUnread,
  type NotificationFamily,
} from "@/features/notifications/notification-models";
import type { NotificationEntry } from "@/features/notifications/read-models";
import { formatDateTime, formatShortDateTime, getVietnamToday } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface NotificationListPageProps {
  /** Server-action overrides for the /dev preview; the real page passes nothing. */
  actions?: NotificationActionOverrides;
  /** The pager's path ("/notifications"; the /dev preview passes "/dev/lists"). */
  basePath?: string;
  entries: readonly NotificationEntry[];
  /** The loaded page is full, so an older page may exist (there is no total). */
  hasNextPage?: boolean;
  /** 1-based page number of `entries`. */
  page?: number;
  /** Query params kept on the pager links (the preview's `view/role/state`). */
  preservedParams?: Readonly<Record<string, string>>;
  /** Vietnam business date `YYYY-MM-DD` from the server, so SSR and client agree on short dates. */
  today?: string;
  /** Exact unread total of the account over all pages (the topbar bell's read). */
  unreadCount: number;
}

const NO_PARAMS: Readonly<Record<string, string>> = {};
const LIST_LABEL = "Danh sách thông báo";

/** One lucide icon per event family (first code segment); unknown families get the bell. */
const FAMILY_ICONS: Record<NotificationFamily, ReactNode> = {
  ai_grading: <ClipboardCheck />,
  crm: <PhoneCall />,
  ops: <TriangleAlert />,
  other: <Bell />,
  salary_advance: <HandCoins />,
  session: <CalendarClock />,
  student_care: <HeartHandshake />,
};

const FOCUS_OUTLINE = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus";
/** Inside the frame's `overflow-hidden`: the ring is drawn inward. */
const INSET_FOCUS_OUTLINE = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus";
const EMPTY_TITLE = cn("rounded-sm text-body font-semibold text-text-strong", FOCUS_OUTLINE);
/** 32px desktop pager links, 44px touch; the colour is important over the global `a { color: inherit }`. */
const PAGER_LINK = getButtonClassName({ className: "text-text-strong! max-md:h-11", size: "sm", variant: "secondary" });

/**
 * Notifications (design 16a "Thông báo"): header with the exact unread total
 * and the page's only primary ("Đánh dấu tất cả đã đọc", which marks every
 * unread notification of the account), local chips over the loaded page, one
 * framed strip list (icon tile by event family, title, event label, message,
 * time, unread dot) and the newer/older pager in the frame footer.
 *
 * Opening an unread row opens its link at once (next/link, or the browser for
 * a modified or middle click) and marks it read in the background; a failure
 * only leaves the row unread next time. Read rows are plain links. Rows
 * without a link get a "Đánh dấu đã đọc" button whose result stays on the
 * row; "Đánh dấu tất cả đã đọc" reports under the header. Nothing runs an
 * action while rendering. The results and focus rules (page changes, one
 * alert, when a result may move focus) live in `useNotificationListState`.
 */
export function NotificationListPage({
  actions,
  basePath = NOTIFICATIONS_PATH,
  entries,
  hasNextPage = false,
  page = 1,
  preservedParams = NO_PARAMS,
  today,
  unreadCount,
}: NotificationListPageProps) {
  const router = useRouter();
  const [fallbackToday] = useState(getVietnamToday);
  const businessToday = today ?? fallbackToday;
  const {
    bannerRef,
    chip,
    counts,
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
    results: { banner, rowError },
    rootRef,
    setChip,
    visible,
  } = useNotificationListState({
    entries,
    markAll: actions?.markAllNotificationsRead ?? markAllNotificationsReadAction,
    markOne: actions?.markNotificationRead ?? markNotificationReadAction,
    onRefresh: () => router.refresh(),
    page,
  });

  const hasPager = page > 1 || hasNextPage;

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5" ref={rootRef}>
      <PageHeader
        actions={
          <Button
            className="max-md:h-11"
            disabled={unreadCount === 0}
            disabledReason="Không còn thông báo chưa đọc."
            isLoading={isMarkingAll}
            onClick={markEverythingRead}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        }
        title="Thông báo"
      >
        <p className="mt-1 text-secondary tabular-nums text-text-muted">{describeNotificationContext(unreadCount, page)}</p>
      </PageHeader>

      {banner ? (
        <div className={cn("rounded-md", FOCUS_OUTLINE)} ref={bannerRef} tabIndex={-1}>
          <ResultBanner title={banner.message} tone={banner.status === "success" ? "success" : "error"} />
        </div>
      ) : null}

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
        {entries.length > 0 ? (
          <div className="grid gap-1.5">
            <QuickFilterChips
              chips={buildNotificationChips(counts)}
              className="max-md:[&_button]:h-11"
              label="Lọc nhanh thông báo"
              onChange={setChip}
              value={chip}
            />
            <p className="text-caption tabular-nums text-text-muted">{describeNotificationChipScope(entries.length)}</p>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
          {visible.length > 0 ? (
            // Focusable (-1) as the fallback when the focused row leaves the "Chưa đọc" filter.
            <ul aria-label={LIST_LABEL} className={cn("divide-y divide-border-row", INSET_FOCUS_OUTLINE)} ref={listRef} tabIndex={-1}>
              {visible.map((entry) => {
                const isUnread = isNotificationUnread(entry, locallyRead);
                return (
                  <NotificationRow
                    entry={entry}
                    // Never on a row that already reads as read (mark-all or a refresh got there).
                    error={rowError?.id === entry.id && isUnread ? rowError.message : null}
                    isPending={pendingIds.has(entry.id)}
                    isUnread={isUnread}
                    key={entry.id}
                    onMarkRead={markRowRead}
                    onOpen={openRow}
                    today={businessToday}
                  />
                );
              })}
            </ul>
          ) : (
            <TableState>
              {/* The empty message is the focus fallback when there is no list (tabIndex -1). */}
              {entries.length > 0 ? (
                <p className={EMPTY_TITLE} ref={emptyRef} tabIndex={-1}>
                  Không có thông báo chưa đọc trên trang này.
                </p>
              ) : page > 1 ? (
                <p className={EMPTY_TITLE} ref={emptyRef} tabIndex={-1}>
                  Không còn thông báo cũ hơn.
                </p>
              ) : (
                <>
                  <p className={EMPTY_TITLE} ref={emptyRef} tabIndex={-1}>
                    Không có thông báo
                  </p>
                  <p className="max-w-xl text-secondary text-text-muted">
                    Các cập nhật cần chú ý trong quá trình vận hành sẽ xuất hiện tại đây.
                  </p>
                </>
              )}
            </TableState>
          )}

          {hasPager ? (
            <nav
              aria-label="Phân trang thông báo"
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-border-row px-4 py-2.5"
              ref={pagerRef}
            >
              <span className="justify-self-start">
                {page > 1 ? (
                  <Link className={PAGER_LINK} href={getNotificationPageHref(basePath, preservedParams, page - 1)} onClick={notePagerClick}>
                    Mới hơn
                  </Link>
                ) : null}
              </span>
              <span className="text-secondary tabular-nums text-text-muted">Trang {formatNumber(page)}</span>
              <span className="justify-self-end">
                {hasNextPage ? (
                  <Link className={PAGER_LINK} href={getNotificationPageHref(basePath, preservedParams, page + 1)} onClick={notePagerClick}>
                    Cũ hơn
                  </Link>
                ) : null}
              </span>
            </nav>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface NotificationRowProps {
  entry: NotificationEntry;
  /** The row button's failure message (the page's one alert), shown under the button. */
  error: string | null;
  isPending: boolean;
  isUnread: boolean;
  onMarkRead: (entry: NotificationEntry) => void;
  onOpen: (event: MouseEvent<HTMLAnchorElement>, entry: NotificationEntry) => void;
  today: string;
}

/**
 * One strip row (≥ 48px). With a link, the title is a `Link` stretched over
 * the row (its accessible name is the title; the row draws the focus ring).
 * The title row is a two-column grid: the title wraps in its column and the
 * time + unread-dot slot (reserved on read rows) stay top-right, so times line
 * up on every row and width. The event label is one caption element, never
 * repeated in a badge. A row without a link can take focus (`tabIndex={-1}`)
 * once its button marked it read.
 */
function NotificationRow({ entry, error, isPending, isUnread, onMarkRead, onOpen, today }: NotificationRowProps) {
  const { href } = entry;
  const id = useId();
  const errorId = `${id}-error`;
  const unreadId = `${id}-unread`;
  // Unread rows (and a row still being marked) go through the click handler; read rows are plain links.
  const handlesOpen = href !== null && (isUnread || isPending);

  return (
    <li
      aria-busy={isPending || undefined}
      className={cn(
        "relative flex min-h-12 gap-3 px-4 py-3",
        href !== null
          ? "hover:bg-surface-hover has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-border-focus"
          : "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus",
      )}
      data-notification-id={entry.id}
      tabIndex={href === null ? -1 : undefined}
    >
      <IconTile className="mt-px" tone={getNotificationEventTone(entry.eventCode)}>
        {FAMILY_ICONS[getNotificationFamily(entry.eventCode)]}
      </IconTile>
      <div className="min-w-0 flex-1">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3">
          <p
            className={cn(
              "min-w-0 break-words text-body",
              isUnread ? "font-semibold text-text-strong" : "font-medium text-text-default",
            )}
          >
            {href !== null ? (
              <Link
                // Name = the title; while unread, "Chưa đọc" is its description for anyone tabbing through the links.
                aria-describedby={isUnread ? unreadId : undefined}
                className="outline-hidden after:absolute after:inset-0"
                href={href}
                onAuxClick={handlesOpen ? (event) => { if (event.button === 1) onOpen(event, entry); } : undefined}
                onClick={handlesOpen ? (event) => onOpen(event, entry) : undefined}
              >
                {entry.title}
              </Link>
            ) : (
              entry.title
            )}
          </p>
          <span className="flex items-center gap-2">
            {/*
              Only the time sits above the stretched link, so its full-timestamp title can be hovered;
              on touch it lets taps through, so tapping the time still opens the row.
            */}
            <time
              className="relative z-10 text-caption tabular-nums text-text-muted pointer-coarse:pointer-events-none"
              dateTime={entry.createdAt}
              title={formatDateTime(entry.createdAt)}
            >
              {formatShortDateTime(entry.createdAt, today)}
            </time>
            {/* The dot's slot exists on read rows too, so every row's time ends at the same x. */}
            <span
              aria-hidden="true"
              className={cn("h-2 w-2 shrink-0 rounded-full", isUnread ? "bg-action-primary" : "invisible")}
            />
            {isUnread ? (
              <span className="sr-only" id={unreadId}>
                Chưa đọc
              </span>
            ) : null}
          </span>
        </div>
        <p className="text-caption text-text-muted">{getNotificationEventLabel(entry.eventCode)}</p>
        <p className="mt-1 whitespace-pre-line break-words text-secondary text-text-muted">{entry.message}</p>
        {href === null && isUnread ? (
          <Button
            aria-describedby={error ? errorId : undefined}
            aria-label={`Đánh dấu đã đọc: ${entry.title}`}
            className="-ml-3 mt-1 max-md:h-11"
            isLoading={isPending}
            onClick={() => onMarkRead(entry)}
            size="sm"
            variant="ghost"
          >
            Đánh dấu đã đọc
          </Button>
        ) : null}
        {error ? (
          <p className="mt-1 text-secondary text-danger" id={errorId} role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </li>
  );
}
