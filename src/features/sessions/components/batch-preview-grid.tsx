"use client";

import { Check } from "lucide-react";
import { memo, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { formatIsoDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";

import {
  BATCH_DUPLICATE_CHECK_LIMIT,
  BATCH_NOTHING_CHOOSABLE_MESSAGE,
  BATCH_PREVIEW_FLAG_WORDS,
  type BatchPreviewFlag,
  type BatchPreviewRow,
  type BatchPreviewSummary,
  formatBatchChipDate,
  getBatchDraftCheckboxLabel,
  getDatesWithSeveralDrafts,
  hasUnselectedChoosableDraft,
  isSameBatchPreviewRow,
} from "../batch-preview-models";

interface BatchPreviewGridProps {
  /** Keep it stable (useCallback): every chip is memoized on it. */
  onToggle: (draftId: string) => void;
  onToggleAll: () => void;
  rows: readonly BatchPreviewRow[];
  summary: BatchPreviewSummary;
}

/** Chip surface per flag; a selected plain chip carries a check mark, every flag carries its word. */
const flagChipClassName: Record<BatchPreviewFlag, string> = {
  duplicate: "border-warning-border bg-warning-bg text-warning-ink",
  holiday: "border-neutral-border bg-neutral-bg text-neutral-ink",
  none: "",
  outside_window: "border-danger-border bg-danger-bg text-danger-ink",
  past: "border-neutral-border bg-neutral-bg text-neutral-ink",
};

function chipClassName(row: BatchPreviewRow): string {
  if (row.flag !== "none") return flagChipClassName[row.flag];
  return row.selected
    ? "border-border-subtle bg-surface-base text-text-strong"
    : "border-border-subtle bg-surface-sunken text-text-muted";
}

/** Columns the grid lays out right now (6/4/3 by container width); 1 where there is no layout (jsdom). */
function columnCount(list: HTMLElement): number {
  const template = getComputedStyle(list).gridTemplateColumns;
  const count = template ? template.split(" ").filter(Boolean).length : 0;
  return count > 0 ? count : 1;
}

/**
 * BatchPreviewGrid (design 17b): every draft of the batch as a chip that IS
 * its selection checkbox (`Chọn buổi học ngày dd/mm/yyyy`), 6 columns on a
 * wide card, 4 then 3 as it narrows. A chip states its condition in words
 * ("đã có (bỏ qua)", "đã qua", "nghỉ", "ngoài hiệu lực"); duplicate, holiday
 * and out-of-window chips cannot be ticked. The grid is one tab stop: arrow
 * keys, Home and End move between chips, Space ticks; a focus move re-renders
 * only the two chips whose tab stop changed. Above it, the summary of what
 * the request will carry; below it, the caption on the scope of the
 * duplicate check.
 */
export function BatchPreviewGrid({ onToggle, onToggleAll, rows, summary }: BatchPreviewGridProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const baseId = useId();
  const summaryId = `${baseId}-summary`;
  const hintId = `${baseId}-hint`;
  const severalDraftDates = useMemo(() => getDatesWithSeveralDrafts(rows), [rows]);
  const choosableIds = useMemo(() => new Set(rows.filter((row) => !row.blocked).map((row) => row.draft.id)), [rows]);
  const firstChoosableId = useMemo(() => rows.find((row) => !row.blocked)?.draft.id ?? null, [rows]);
  const canSelectMore = useMemo(() => hasUnselectedChoosableDraft(rows), [rows]);
  // One tab stop: the chip last focused while it can still be ticked, else the first choosable chip.
  const tabStopId = focusedId !== null && choosableIds.has(focusedId) ? focusedId : firstChoosableId;

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const list = listRef.current;
    const current = event.target;
    if (!list || !(current instanceof HTMLInputElement)) return;
    const all = Array.from(list.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    const index = all.indexOf(current);
    if (index < 0) return;

    // Walks from `start` by `step` to the first chip that can take focus.
    const seek = (start: number, step: number) => {
      for (let next = start; next >= 0 && next < all.length; next += step) {
        if (!all[next].disabled) return all[next];
      }
      return null;
    };
    const columns = columnCount(list);
    let target: HTMLInputElement | null = null;
    switch (event.key) {
      case "ArrowRight":
        target = seek(index + 1, 1);
        break;
      case "ArrowLeft":
        target = seek(index - 1, -1);
        break;
      case "ArrowDown":
        target = seek(index + columns, 1);
        break;
      case "ArrowUp":
        target = seek(index - columns, -1);
        break;
      case "Home":
        target = seek(0, 1);
        break;
      case "End":
        target = seek(all.length - 1, -1);
        break;
      default:
        return;
    }
    event.preventDefault();
    if (target && target !== current) target.focus();
  }

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-body font-semibold text-text-strong">Xem trước</h3>
          <p className="mt-0.5 text-secondary text-text-muted" id={summaryId}>
            <span className="tabular-nums">{summary.selected}</span> buổi sẽ tạo ·{" "}
            <span className="tabular-nums">{summary.holidayDays}</span> ngày nghỉ bỏ qua ·{" "}
            <span className="tabular-nums">{summary.duplicates}</span> trùng buổi đã có (bỏ qua)
            {summary.outsideWindow > 0 ? (
              <>
                {" "}· <span className="tabular-nums">{summary.outsideWindow}</span> buổi ngoài thời gian hiệu lực của lịch (bỏ qua)
              </>
            ) : null}
            {summary.past > 0 ? (
              <>
                {" "}· <span className="tabular-nums">{summary.past}</span> buổi ngày đã qua
              </>
            ) : null}
          </p>
        </div>
        {rows.length > 0 ? (
          // Every draft blocked (e.g. all created a moment ago): nothing to toggle, and it says why.
          <Button
            className="max-md:h-11"
            disabled={firstChoosableId === null}
            disabledReason={BATCH_NOTHING_CHOOSABLE_MESSAGE}
            onClick={onToggleAll}
            size="sm"
            variant="secondary"
          >
            {canSelectMore || firstChoosableId === null ? "Chọn tất cả" : "Bỏ chọn tất cả"}
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-secondary">
        <p className="font-semibold text-text-strong">
          Đã chọn: <span className="tabular-nums text-action-primary">{summary.selected}</span> / {summary.total} buổi
        </p>
        {summary.firstDate && summary.lastDate ? (
          <p className="text-text-muted">
            Từ <span className="tabular-nums text-text-strong">{formatIsoDate(summary.firstDate)}</span> đến{" "}
            <span className="tabular-nums text-text-strong">{formatIsoDate(summary.lastDate)}</span>
          </p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border-strong px-4 py-6 text-center">
          <p className="text-body font-semibold text-text-strong">Chưa có buổi học nào được tính toán.</p>
          <p className="mt-1 text-secondary text-text-muted">
            Hãy kiểm tra lại việc chọn lịch cố định, các thứ trong tuần hoặc khoảng ngày ở phần cấu hình.
          </p>
        </div>
      ) : (
        <div className="@container min-w-0">
          <p className="sr-only" id={hintId}>
            Dùng phím mũi tên để di chuyển giữa các buổi, phím cách để chọn hoặc bỏ chọn.
          </p>
          <ul
            aria-describedby={`${summaryId} ${hintId}`}
            aria-label="Các buổi học trong bảng xem trước"
            className="m-0 grid list-none grid-cols-3 gap-1.5 p-0 @min-[30rem]:grid-cols-4 @min-[42rem]:grid-cols-6"
            onKeyDown={onKeyDown}
            ref={listRef}
          >
            {rows.map((row) => (
              <BatchPreviewChip
                baseId={baseId}
                isTabStop={row.draft.id === tabStopId}
                key={row.draft.id}
                onFocusChip={setFocusedId}
                onToggle={onToggle}
                row={row}
                withTime={severalDraftDates.has(row.draft.sessionDate)}
              />
            ))}
          </ul>
        </div>
      )}

      <p className="text-caption text-text-muted">
        Kiểm tra trùng trên {BATCH_DUPLICATE_CHECK_LIMIT} buổi gần nhất của lớp; máy chủ kiểm tra lại khi tạo.
      </p>
    </div>
  );
}

interface BatchPreviewChipProps {
  baseId: string;
  isTabStop: boolean;
  onFocusChip: (draftId: string) => void;
  onToggle: (draftId: string) => void;
  row: BatchPreviewRow;
  withTime: boolean;
}

/**
 * One chip: a label around its visually hidden checkbox. Memoized on what it
 * renders (the draft object, its flag and tick, the tab stop), so a roving
 * focus move or one toggle re-renders only the chips that changed, even
 * though the workspace rebuilds every row object on each change.
 */
const BatchPreviewChip = memo(
  function BatchPreviewChip({ baseId, isTabStop, onFocusChip, onToggle, row, withTime }: BatchPreviewChipProps) {
    const { draft } = row;
    const word = BATCH_PREVIEW_FLAG_WORDS[row.flag];
    const stateId = `${baseId}-${draft.id}-state`;
    return (
      <li className="min-w-0">
        <label
          className={cn(
            "flex min-h-11 flex-col items-center justify-center rounded-sm border px-1.5 py-1.5 text-center text-caption tabular-nums md:min-h-10",
            "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-border-focus",
            row.blocked ? "cursor-not-allowed" : "cursor-pointer hover:border-border-strong-hover",
            chipClassName(row),
          )}
          data-flag={row.flag}
          data-selected={row.selected}
        >
          <input
            aria-describedby={word ? stateId : undefined}
            aria-label={getBatchDraftCheckboxLabel(draft, { withTime })}
            checked={row.selected}
            className="sr-only"
            data-draft-id={draft.id}
            disabled={row.blocked}
            onChange={() => {
              if (!row.blocked) onToggle(draft.id);
            }}
            onFocus={() => onFocusChip(draft.id)}
            tabIndex={isTabStop ? 0 : -1}
            type="checkbox"
          />
          <span className="flex items-center gap-1 whitespace-nowrap font-medium">
            {row.selected ? <Check aria-hidden="true" className="h-3 w-3 shrink-0" strokeWidth={2.5} /> : null}
            <span className={cn(row.flag === "holiday" && "line-through")}>{formatBatchChipDate(draft)}</span>
          </span>
          {withTime || word ? (
            <span className="leading-4" id={word ? stateId : undefined}>
              {[withTime ? draft.startTime.slice(0, 5) : "", word].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </label>
      </li>
    );
  },
  (previous, next) =>
    previous.baseId === next.baseId &&
    previous.isTabStop === next.isTabStop &&
    previous.onFocusChip === next.onFocusChip &&
    previous.onToggle === next.onToggle &&
    previous.withTime === next.withTime &&
    isSameBatchPreviewRow(previous.row, next.row),
);
