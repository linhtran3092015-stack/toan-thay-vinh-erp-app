"use client";

import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

import { QuickFilterChips, type QuickFilterChip } from "@/components/patterns/quick-filter-chips";
import { EmptyState } from "@/components/shared/empty-state";
import { Button, getButtonClassName } from "@/components/ui/button";
import type { AllocationSuggestion } from "@/features/finance/allocation-suggestions-data";
import { SepayAllocationSuggestions } from "@/features/finance/components/sepay-allocation-suggestions";
import { SepayManualAllocation, SepayManualAllocationDialog } from "@/features/finance/components/sepay-manual-allocation";
import {
  SepayReconciliationActions,
  type SepayReconciliationCandidateView,
} from "@/features/finance/components/sepay-reconciliation-actions";
import { isSepayTransactionReconcilable, SepayReconciliationDialog } from "@/features/finance/components/sepay-reconciliation-dialog";
import {
  getSepayMatchPresentation,
  getSepaySourceLabel,
  SepayAccountPurposeBadge,
  SepayMatchBadge,
  SepayPagination,
  SepayPurposeFilterNav,
  SepayReference,
} from "@/features/finance/components/sepay-transaction-history";
import type { SepayTransactionReadModel } from "@/features/finance/read-models";
import type { SepayActionOverrides } from "@/features/finance/sepay-action-overrides";
import {
  getSepayDirectoryQuery,
  getSepayReviewStatusCounts,
  parseSepayReviewStatusFilter,
  parseSepaySelectedTransactionId,
  resolveSepayQueueSelection,
  SEPAY_REVIEW_MATCH_STATUSES,
  type SepayAccountPurposeFilter,
  type SepayReviewStatusFilter,
  withSepayReviewSelection,
} from "@/features/finance/sepay-transaction-url-state";
import { formatDateTime, VIETNAM_TIME_ZONE } from "@/lib/datetime";
import { formatVnd } from "@/lib/format";
import { permissionLabel } from "@/lib/permissions/labels";
import { cn } from "@/lib/utils";

export interface SepayReviewWorkspaceProps {
  accountPurposeFilter: SepayAccountPurposeFilter;
  /** Replacements for every server action reachable from the queue (dev preview only). */
  actions?: SepayActionOverrides;
  /** sepay.allocate or payments.manage. */
  canAllocate: boolean;
  /** Reconciliation dialog available (permission granted and candidates loaded). */
  canReconcile: boolean;
  candidates: SepayReconciliationCandidateView[];
  /** sepay.sync_history.manage: the identity-conflict hint can point at the history sync. */
  canSyncHistory?: boolean;
  page: number;
  pageSize: number;
  /** Candidate loading failed: the reconciliation dialog is locked. */
  reconciliationError?: boolean;
  /** Review queue size across every receiving account (independent of the purpose filter); null when unknown. */
  reviewCount?: number | null;
  /** Allocation suggestions; null when the viewer may not allocate. */
  suggestions: readonly AllocationSuggestion[] | null;
  /** Suggestions failed to load (only when the viewer may allocate). */
  suggestionsError?: string | null;
  total: number;
  /** One loaded page of the review queue (SEPAY_REVIEW_MATCH_STATUSES, inbound). */
  transactions: SepayTransactionReadModel[];
}

/** Short labels for the status chips; the badge keeps the full SePay wording. */
const reviewStatusChipLabels: Record<(typeof SEPAY_REVIEW_MATCH_STATUSES)[number], string> = {
  account_purpose_mismatch: "Sai tài khoản nhận",
  amount_mismatch: "Sai số tiền",
  identity_conflict: "Trùng nhận diện",
  unmatched: "Chưa khớp",
};

/** The detail pane shows seconds so two transfers in the same minute can be told apart. */
const dateTimeSecondsFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  second: "2-digit",
  timeZone: VIETNAM_TIME_ZONE,
  year: "numeric",
});

function formatDateTimeWithSeconds(value: string): string {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? value : dateTimeSecondsFormatter.format(timestamp);
}

/** Short pointer; the full "payment requests failed to load" alert is rendered once by the screen. */
const reconciliationLockedReason = "Đối soát đang tạm khóa: xem thông báo ở đầu trang.";
const identityConflictReason = "Giao dịch này trùng với một giao dịch khác nên chưa đối soát được ở đây.";
const identityConflictSyncHint = "Đồng bộ lịch sử ở tab Tất cả giao dịch.";
const identityConflictAdminHint = "Báo quản trị để đồng bộ lịch sử SePay.";

interface ReviewUrlState {
  status: SepayReviewStatusFilter;
  transactionId: string;
}

/** `status` and `tx` from the address bar: the only source of the chip and selection. */
function readReviewUrlState(search: string): ReviewUrlState {
  const params = new URLSearchParams(search);
  return {
    status: parseSepayReviewStatusFilter(params.get("status") ?? undefined),
    transactionId: parseSepaySelectedTransactionId(params.get("tx") ?? undefined),
  };
}

function writeReviewUrl(next: ReviewUrlState) {
  const query = withSepayReviewSelection(window.location.search, next);
  // Null state: Next syncs its router with a plain History API call (no server round trip).
  window.history.replaceState(null, "", `${window.location.pathname}${query}${window.location.hash}`);
}
const departedNotice = "Giao dịch đang xem đã rời hàng đợi (đã được xử lý hoặc chuyển trang); đang hiển thị giao dịch kế tiếp.";
const changedNotice = "Giao dịch đang xem đã thay đổi sau khi tải lại; bấm “Xem giao dịch này” để tiếp tục.";
const acknowledgeReason = "Giao dịch này được chọn tự động. Kiểm tra số tiền và nội dung rồi bấm “Xem giao dịch này” để mở thao tác.";
const selectionHeldReason = "Đang ghi nhận phân bổ; chờ xong rồi chọn giao dịch khác.";
const viewOnlyReason = `Bạn chỉ xem được giao dịch. Phân bổ hoặc đối soát cần quyền ${permissionLabel("sepay.allocate")} hoặc ${permissionLabel("payments.manage")}.`;

/**
 * "Cần xử lý" (design 07, frame 7c): queue of inbound transfers that still need
 * a decision on the left, the selected transfer with the existing allocation
 * and reconciliation flows on the right (lg+). Below lg each queue card carries
 * the same existing triggers and its suggestion. Both dialogs are rendered once
 * here, outside the breakpoint-hidden containers. Selection and the status chip
 * are kept in the address bar (`tx`, `status`) without a server round trip, and
 * are re-read from it whenever the URL changes under the mounted workspace.
 */
export function SepayReviewWorkspace({
  accountPurposeFilter,
  actions,
  canAllocate,
  canReconcile,
  canSyncHistory = false,
  candidates,
  page,
  pageSize,
  reconciliationError = false,
  reviewCount = 0,
  suggestions,
  suggestionsError = null,
  total,
  transactions,
}: SepayReviewWorkspaceProps) {
  const counts = getSepayReviewStatusCounts(transactions, total);
  const search = useSearchParams()?.toString() ?? "";
  const [status, setStatus] = useState<SepayReviewStatusFilter>(() => readReviewUrlState(search).status);
  const [selectedId, setSelectedId] = useState(() => readReviewUrlState(search).transactionId);
  const [syncedSearch, setSyncedSearch] = useState(search);
  /**
   * Last row shown in the detail pane. null right after a user choice (select, chip, URL
   * navigation), so the next row shown is accepted as intended.
   */
  const [lastShown, setLastShown] = useState<{ id: string; index: number } | null>(null);
  /**
   * The shown transfer changed without a user action (refresh): "departed" when the row
   * left the page, "changed" otherwise (newer row on top, row moved out of the status chip).
   * Writes stay locked until the user presses "Xem giao dịch này".
   */
  const [autoSwitch, setAutoSwitch] = useState<"changed" | "departed" | null>(null);
  /** Set when a refresh moved (or cleared) the selection: the address bar must follow it. */
  const [urlFollowsSelection, setUrlFollowsSelection] = useState(false);
  /** A suggestion allocation is in flight: hold the selection so its result is not lost. */
  const [suggestionPending, setSuggestionPending] = useState(false);
  const [openDialog, setOpenDialog] = useState<{ kind: "allocate" | "reconcile"; transaction: SepayTransactionReadModel } | null>(null);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);

  // Next keeps this component mounted when only search params change (purpose links, the
  // Cần xử lý tab, "Về trang 1"): re-read the chip and selection from the new URL. A URL
  // that matches the current state is our own replaceState echoing back: nothing to reset.
  if (search !== syncedSearch) {
    const fromUrl = readReviewUrlState(search);
    setSyncedSearch(search);
    if (fromUrl.status !== status || fromUrl.transactionId !== selectedId) {
      setStatus(fromUrl.status);
      setSelectedId(fromUrl.transactionId);
      setLastShown(null);
      setAutoSwitch(null);
      setUrlFollowsSelection(false);
    }
  }

  const activeStatus = counts ? status : "";
  const visible = activeStatus ? transactions.filter((transaction) => transaction.matchStatus === activeStatus) : transactions;
  const explicit = visible.find((transaction) => transaction.id === selectedId) ?? null;
  const departed = lastShown !== null && !transactions.some((transaction) => transaction.id === lastShown.id);
  const selected = !explicit && departed && lastShown
    ? visible[Math.min(lastShown.index, visible.length - 1)] ?? null
    : resolveSepayQueueSelection(visible, selectedId);
  const selectedIndex = selected ? visible.indexOf(selected) : -1;
  if (selected?.id !== lastShown?.id || (selected && selectedIndex !== lastShown?.index)) {
    setLastShown(selected ? { id: selected.id, index: selectedIndex } : null);
    if (lastShown !== null && selected && selected.id !== lastShown.id) {
      // A refresh changed the shown transfer without a user action: pin the new row, say why,
      // and lock writes until the user acknowledges it.
      setAutoSwitch(departed ? "departed" : "changed");
      setSelectedId(selected.id);
      setUrlFollowsSelection(true);
    } else if (lastShown !== null && !selected) {
      // The shown row was the last one under the status chip: clear the selection quietly.
      setAutoSwitch(null);
      setSelectedId("");
      setUrlFollowsSelection(true);
    }
  }
  const showDepartedNotice = autoSwitch !== null;
  const canAct = canAllocate || canReconcile;

  // After a refresh moved the selection to the next row (or cleared it), point the address bar there too.
  useEffect(() => {
    if (urlFollowsSelection) writeReviewUrl({ status: activeStatus, transactionId: selectedId });
  }, [activeStatus, selectedId, urlFollowsSelection]);

  function select(transactionId: string) {
    if (suggestionPending) return;
    setSelectedId(transactionId);
    setLastShown(null);
    setAutoSwitch(null);
    setUrlFollowsSelection(false);
    writeReviewUrl({ status: activeStatus, transactionId });
  }

  function changeStatus(next: SepayReviewStatusFilter) {
    if (suggestionPending) return;
    setStatus(next);
    setSelectedId("");
    setLastShown(null);
    setAutoSwitch(null);
    setUrlFollowsSelection(false);
    writeReviewUrl({ status: next, transactionId: "" });
  }

  function openShared(kind: "allocate" | "reconcile", transaction: SepayTransactionReadModel, trigger: HTMLElement | null) {
    dialogTriggerRef.current = trigger;
    setOpenDialog({ kind, transaction });
  }

  const handlers: QueueActionHandlers = {
    actions,
    canAllocate,
    canReconcile,
    canSyncHistory,
    reconciliationError,
    onSuggestionPending: setSuggestionPending,
    onOpenAllocation: (transaction, trigger) => openShared("allocate", transaction, trigger),
    onOpenReconciliation: (transaction, trigger) => openShared("reconcile", transaction, trigger),
  };

  const sharedDialogs = (
    <>
      {openDialog?.kind === "allocate" ? (
        <SepayManualAllocationDialog
          actions={actions}
          onClose={() => setOpenDialog(null)}
          returnFocusRef={dialogTriggerRef}
          transaction={openDialog.transaction}
        />
      ) : null}
      {canReconcile ? (
        <SepayReconciliationDialog
          actions={actions}
          candidates={candidates}
          isOpen={openDialog?.kind === "reconcile"}
          onClose={() => setOpenDialog(null)}
          returnFocusRef={dialogTriggerRef}
          transaction={openDialog?.kind === "reconcile" ? openDialog.transaction : null}
        />
      ) : null}
    </>
  );

  if (transactions.length === 0 && total > 0) {
    // A stale ?page= after the queue shrank: the queue is not empty, only this page.
    return (
      <div className="grid min-w-0 gap-4">
        <SepayPurposeFilterNav purpose={accountPurposeFilter} queue="review" />
        <section
          aria-labelledby="sepay-review-stale-page-title"
          className="grid gap-3 rounded-lg border border-border-subtle bg-surface-base p-4 shadow-[var(--panel-shadow)]"
        >
          <h2 className="text-control font-semibold text-text-strong" id="sepay-review-stale-page-title">
            Trang này không còn giao dịch.
          </h2>
          <p className="text-secondary text-text-muted">
            Hàng đợi vẫn còn {total} giao dịch cần xử lý; danh sách đã ngắn lại sau khi có giao dịch được xử lý.
          </p>
          <div>
            <Link
              className={getButtonClassName({ size: "lg", variant: "secondary" })}
              href={`/finance/sepay${getSepayDirectoryQuery(accountPurposeFilter, "review")}`}
            >
              Về trang 1 của hàng đợi
            </Link>
          </div>
          <SepayPagination accountPurposeFilter={accountPurposeFilter} page={page} pageSize={pageSize} queue="review" total={total} />
        </section>
      </div>
    );
  }

  if (transactions.length === 0 && accountPurposeFilter && reviewCount !== 0) {
    // Only this receiving account is clear; other accounts still have (or may have) transfers waiting.
    return (
      <div className="grid min-w-0 gap-4">
        <SepayPurposeFilterNav purpose={accountPurposeFilter} queue="review" />
        <EmptyState
          description={reviewCount === null
            ? "Chưa đếm được hàng đợi của các tài khoản nhận khác; mở hàng đợi của mọi tài khoản để kiểm tra."
            : `Các tài khoản nhận khác vẫn còn ${reviewCount} giao dịch cần đối soát hoặc phân bổ.`}
          title="Tài khoản nhận này không còn giao dịch cần xử lý"
        >
          <Link
            className={getButtonClassName({ size: "lg", variant: "secondary" })}
            href={`/finance/sepay${getSepayDirectoryQuery("", "review")}`}
          >
            Xem hàng đợi của mọi tài khoản
          </Link>
        </EmptyState>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="grid min-w-0 gap-4">
        <SepayPurposeFilterNav purpose={accountPurposeFilter} queue="review" />
        <EmptyState
          description={accountPurposeFilter
            ? "Không còn giao dịch tiền vào nào của tài khoản nhận này cần đối soát hoặc phân bổ."
            : "Không còn giao dịch tiền vào nào cần đối soát hoặc phân bổ."}
          icon={CircleCheck}
          title="Tất cả giao dịch đã khớp"
          tone="success"
        >
          <Link
            className={getButtonClassName({ size: "lg", variant: "secondary" })}
            href={`/finance/sepay${getSepayDirectoryQuery(accountPurposeFilter, "")}`}
          >
            Xem tất cả giao dịch
          </Link>
        </EmptyState>
      </div>
    );
  }

  const loadedAll = counts !== null;
  const queueSum = transactions.reduce((sum, transaction) => sum + transaction.amountVnd, 0);
  const statusChips: QuickFilterChip<SepayReviewStatusFilter>[] = counts
    ? [
        { count: transactions.length, disabled: suggestionPending, label: "Tất cả", value: "" },
        ...SEPAY_REVIEW_MATCH_STATUSES.map((value) => ({ count: counts[value], disabled: suggestionPending, label: reviewStatusChipLabels[value], value })),
      ]
    : [];
  const suggestionFor = (transactionId: string) => suggestions?.find((suggestion) => suggestion.transactionId === transactionId) ?? null;

  return (
    <div className="grid min-w-0 gap-4">
      <SepayPurposeFilterNav purpose={accountPurposeFilter} queue="review" />

      {showDepartedNotice ? (
        // Only the lg+ detail pane shows "the selected transfer"; phones see the whole queue.
        <p className="hidden rounded-md border border-info-border bg-info-bg px-4 py-3 text-secondary text-info-ink lg:block" role="status">
          {autoSwitch === "departed" ? departedNotice : changedNotice}
        </p>
      ) : null}

      {canAllocate && suggestionsError ? (
        <p className="rounded-md border border-danger-border bg-danger-bg px-4 py-3 text-secondary text-danger" role="alert">
          Không tải được gợi ý khớp giao dịch. {suggestionsError}
        </p>
      ) : null}

      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[440px_minmax(0,1fr)]">
        <section
          aria-labelledby="sepay-review-queue-title"
          className="min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]"
        >
          <div className="grid gap-3 border-b border-border-row px-4 py-3">
            <h2 className="text-control font-semibold text-text-strong" id="sepay-review-queue-title">
              {loadedAll
                ? `${total} giao dịch · ${formatVnd(queueSum)}`
                : `${total} giao dịch cần xử lý · trang này ${transactions.length}`}
            </h2>
            {suggestionPending ? (
              <p className="text-secondary text-text-muted" role="status">{selectionHeldReason}</p>
            ) : null}
            {counts ? (
              <QuickFilterChips
                className="[&>button]:min-h-11 sm:[&>button]:min-h-8"
                chips={statusChips}
                label="Lọc theo trạng thái khớp"
                onChange={changeStatus}
                value={activeStatus}
              />
            ) : null}
          </div>

          <ul aria-label="Hàng đợi giao dịch cần xử lý" className="grid">
            {visible.map((transaction) => (
              <SepayQueueItem
                canAct={canAct}
                handlers={handlers}
                isSelected={transaction.id === selected?.id}
                key={transaction.id}
                onSelect={() => select(transaction.id)}
                selectionHeld={suggestionPending}
                reconciliationError={reconciliationError}
                suggestion={canAllocate ? suggestionFor(transaction.id) : null}
                transaction={transaction}
              />
            ))}
          </ul>
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-secondary text-text-muted">Không còn giao dịch ở trạng thái này.</p>
          ) : null}
          <div className="px-4 pb-3 empty:hidden">
            <SepayPagination accountPurposeFilter={accountPurposeFilter} page={page} pageSize={pageSize} queue="review" total={total} />
          </div>
        </section>

        {selected ? (
          <SepayReviewDetail
            // Keyed: a new transfer gets fresh controls, so focus or state never carries over.
            key={selected.id}
            canAct={canAct}
            needsAcknowledge={showDepartedNotice}
            onAcknowledge={() => select(selected.id)}
            handlers={handlers}
            reconciliationError={reconciliationError}
            suggestion={canAllocate ? suggestionFor(selected.id) : null}
            transaction={selected}
          />
        ) : null}
      </div>

      {sharedDialogs}
    </div>
  );
}

interface QueueActionHandlers {
  /** Only the card suggestions call actions directly; the triggers open the shared dialogs. */
  actions?: SepayActionOverrides;
  canAllocate: boolean;
  canReconcile: boolean;
  canSyncHistory: boolean;
  /** Payment requests failed to load: reconciliation is locked even for permitted viewers. */
  reconciliationError: boolean;
  onSuggestionPending: (pending: boolean) => void;
  onOpenAllocation: (transaction: SepayTransactionReadModel, trigger: HTMLElement | null) => void;
  onOpenReconciliation: (transaction: SepayTransactionReadModel, trigger: HTMLElement | null) => void;
}

function SepayQueueItem({
  canAct,
  handlers,
  isSelected,
  onSelect,
  reconciliationError,
  selectionHeld,
  suggestion,
  transaction,
}: {
  canAct: boolean;
  handlers: QueueActionHandlers;
  isSelected: boolean;
  onSelect: () => void;
  reconciliationError: boolean;
  selectionHeld: boolean;
  suggestion: AllocationSuggestion | null;
  transaction: SepayTransactionReadModel;
}) {
  const time = formatDateTime(transaction.transactionAt);
  const amount = formatVnd(transaction.amountVnd);

  return (
    <li
      className={cn(
        "relative min-w-0 border-b border-border-row px-4 py-3 last:border-b-0",
        isSelected && "lg:bg-surface-selected lg:shadow-[inset_3px_0_0_var(--action-primary)]",
      )}
      data-selected={isSelected || undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="tabular-nums text-control font-semibold text-text-strong">{amount}</p>
        <p className="shrink-0 tabular-nums text-secondary text-text-muted">{time}</p>
      </div>
      <p className="mt-1 break-words font-mono text-caption text-text-default">{transaction.transferContent}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <SepayMatchBadge status={transaction.matchStatus} />
        <SepayAccountPurposeBadge purpose={transaction.accountPurpose} />
      </div>

      {/* lg+: the whole card selects the transaction for the detail pane. */}
      <button
        aria-label={`Xem giao dịch ${transaction.bankTransactionId} · ${amount} · ${time}`}
        aria-pressed={isSelected}
        className="absolute inset-0 hidden cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus disabled:cursor-not-allowed lg:block"
        disabled={selectionHeld && !isSelected}
        onClick={onSelect}
        type="button"
      />

      {/* Below lg: the existing triggers (shared dialogs) and the card's suggestion; 44px touch targets. */}
      <div className="mt-3 grid gap-3 border-t border-border-row pt-3 lg:hidden [&_button]:min-h-11">
        <div className="flex flex-wrap items-center gap-2">
          {canAct ? (
            <SepayTransactionReviewActions handlers={handlers} transaction={transaction} />
          ) : (
            <p className="text-secondary text-text-muted">{reconciliationError ? reconciliationLockedReason : viewOnlyReason}</p>
          )}
        </div>
        {suggestion ? <SepayCardSuggestion handlers={handlers} suggestion={suggestion} /> : null}
      </div>
    </li>
  );
}

/** Phone card: "Có gợi ý: …" disclosure opening the same per-transaction suggestion as the detail pane. */
function SepayCardSuggestion({ handlers, suggestion }: { handlers: QueueActionHandlers; suggestion: AllocationSuggestion }) {
  const [expanded, setExpanded] = useState(false);
  const best = suggestion.candidates[0];
  if (!best) return null;
  return (
    <div className="grid gap-2">
      <button
        aria-expanded={expanded}
        className="inline-flex items-center justify-between gap-2 rounded-md border border-border-strong bg-surface-base px-3 text-left text-secondary font-medium text-text-default"
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        <span>
          Có gợi ý: {best.studentName} · {best.confidence === "high" ? "Tin cậy cao" : "Cần kiểm tra"}
        </span>
        <span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      {expanded ? (
        <SepayAllocationSuggestions
          actions={handlers.actions}
          layout="detail"
          onPendingChange={handlers.onSuggestionPending}
          suggestions={[suggestion]}
        />
      ) : null}
    </div>
  );
}

function SepayTransactionReviewActions({
  handlers,
  transaction,
}: {
  handlers: QueueActionHandlers;
  transaction: SepayTransactionReadModel;
}) {
  const reconcilable = isSepayTransactionReconcilable(transaction);
  const blockedConflict = transaction.matchStatus === "identity_conflict" && !reconcilable;
  // Never leave the Đối soát slot silently empty: say why it is locked.
  const lockedByLoadError = reconcilable && !handlers.canReconcile && handlers.reconciliationError;
  return (
    <>
      <SepayManualAllocation
        canAllocate={handlers.canAllocate}
        onOpenDialog={handlers.onOpenAllocation}
        transaction={transaction}
      />
      {handlers.canReconcile && !blockedConflict ? (
        <SepayReconciliationActions
          onOpenDialog={handlers.onOpenReconciliation}
          transaction={transaction}
        />
      ) : null}
      {blockedConflict ? (
        <p className="text-secondary text-text-muted">
          {identityConflictReason} {handlers.canSyncHistory ? identityConflictSyncHint : identityConflictAdminHint}
        </p>
      ) : null}
      {lockedByLoadError ? <p className="text-secondary text-text-muted">{reconciliationLockedReason}</p> : null}
    </>
  );
}

function SepayReviewDetail({
  canAct,
  handlers,
  needsAcknowledge,
  onAcknowledge,
  reconciliationError,
  suggestion,
  transaction,
}: {
  canAct: boolean;
  handlers: QueueActionHandlers;
  /** Selected automatically after the previous transfer left: no write until the user looks at it. */
  needsAcknowledge: boolean;
  onAcknowledge: () => void;
  reconciliationError: boolean;
  suggestion: AllocationSuggestion | null;
  transaction: SepayTransactionReadModel;
}) {
  const match = getSepayMatchPresentation(transaction.matchStatus);

  return (
    <section aria-labelledby="sepay-review-detail-title" className="hidden min-w-0 gap-5 lg:grid">
      <div className="min-w-0 overflow-hidden rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
        <h2 className="sr-only" id="sepay-review-detail-title">
          Giao dịch đang chọn · {transaction.bankTransactionId}
        </h2>
        <dl className="grid grid-cols-2 gap-4 border-b border-border-row p-4 min-[1400px]:grid-cols-4">
          <DetailField label="Số tiền">
            <span className="text-[20px]/[28px] font-semibold tabular-nums text-text-strong">{formatVnd(transaction.amountVnd)}</span>
          </DetailField>
          <DetailField label="Thời điểm">
            <span className="tabular-nums">{formatDateTimeWithSeconds(transaction.transactionAt)}</span>
          </DetailField>
          <DetailField label="Mã giao dịch ngân hàng">
            <span className="break-all font-mono text-secondary">{transaction.bankTransactionId}</span>
          </DetailField>
          <DetailField label="Tài khoản nhận">
            <SepayAccountPurposeBadge purpose={transaction.accountPurpose} />
          </DetailField>
          <DetailField label="Ngân hàng · STK">
            {transaction.bankBrand} · <span className="break-all font-mono text-secondary">{transaction.accountNumber}</span>
          </DetailField>
          <DetailField label="Nguồn · số tham chiếu">
            {getSepaySourceLabel(transaction.ingestionSource)}
            {transaction.referenceNumber ? <span className="break-all"> · Ref: {transaction.referenceNumber}</span> : null}
          </DetailField>
          <DetailField label="Trạng thái khớp">
            <SepayMatchBadge status={transaction.matchStatus} />
          </DetailField>
          <DetailField label="Tham chiếu hiện có">
            <span className="text-secondary font-normal text-text-default"><SepayReference transaction={transaction} /></span>
          </DetailField>
        </dl>
        <div className="flex min-w-0 flex-wrap items-baseline gap-2 px-4 py-3 text-secondary text-text-default">
          <span className="text-text-muted">Nội dung:</span>
          <code className="min-w-0 break-words rounded-sm bg-surface-sunken px-1.5 py-0.5 font-mono text-caption">{transaction.transferContent}</code>
        </div>
      </div>

      {needsAcknowledge ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-info-border bg-info-bg px-4 py-3">
          <p className="min-w-0 flex-1 text-secondary text-info-ink">{acknowledgeReason}</p>
          <Button onClick={onAcknowledge} size="sm" type="button" variant="secondary">Xem giao dịch này</Button>
        </div>
      ) : null}

      {suggestion ? (
        <SepayAllocationSuggestions
          actions={handlers.actions}
          confirmDisabledReason={needsAcknowledge ? "Xác nhận đang khóa cho đến khi bạn bấm “Xem giao dịch này”." : null}
          layout="detail"
          onPendingChange={handlers.onSuggestionPending}
          suggestions={[suggestion]}
        />
      ) : null}

      <section
        aria-labelledby="sepay-review-actions-title"
        className="rounded-lg border border-border-subtle bg-surface-base p-4 shadow-[var(--panel-shadow)]"
      >
        <h2 className="text-control font-semibold text-text-strong" id="sepay-review-actions-title">Xử lý giao dịch</h2>
        <p className="mt-1 text-secondary text-text-muted">
          {match.label}. Phân bổ học phí ghi nhận tiền và số buổi cho một hoặc nhiều học sinh; đối soát khớp với một yêu cầu thanh toán
          hoặc đóng giao dịch kèm lý do. Phân bổ và gợi ý khớp có bước kiểm tra riêng, đối soát hỏi xác nhận trước khi ghi.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {needsAcknowledge ? (
            <p className="text-secondary text-text-muted">Bấm “Xem giao dịch này” ở trên để mở thao tác.</p>
          ) : canAct ? (
            <SepayTransactionReviewActions handlers={handlers} transaction={transaction} />
          ) : (
            <p className="text-secondary text-text-muted">{reconciliationError ? reconciliationLockedReason : viewOnlyReason}</p>
          )}
        </div>
      </section>
    </section>
  );
}

function DetailField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-secondary text-text-muted">{label}</dt>
      <dd className="mt-1 text-control font-semibold text-text-strong">{children}</dd>
    </div>
  );
}
