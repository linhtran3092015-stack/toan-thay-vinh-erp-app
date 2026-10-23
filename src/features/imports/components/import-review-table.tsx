"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import {
  DataTableFrame,
  TableCell,
  TableHeaderCell,
  TableRow,
  TableState,
} from "@/components/patterns/data-table-frame";
import { QuickFilterChips } from "@/components/patterns/quick-filter-chips";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** How a row reads: error blocks the step, warning does not, neutral needs nothing (e.g. "không thay đổi"). */
export type ImportRowSeverity = "error" | "warning" | "valid" | "neutral";

export interface ImportReviewColumn<Row> {
  key: string;
  header: string;
  /** CSS width of the column in the table, e.g. "60px". */
  width?: string;
  /** "right" for counts and amounts (tabular figures). */
  align?: "left" | "right";
  render: (row: Row) => ReactNode;
  /** Leave this column out of the stacked card (e.g. it repeats the card title). */
  hideInCard?: boolean;
}

type ImportReviewFilter = "review" | "all";

export interface ImportReviewTableProps<Row> {
  /** Accessible name of the table / card list, e.g. "Kết quả kiểm tra 48 dòng". */
  caption: string;
  columns: readonly ImportReviewColumn<Row>[];
  rows: readonly Row[];
  getRowKey: (row: Row) => string;
  getRowSeverity: (row: Row) => ImportRowSeverity;
  /** The row's problem in words (error/warning), or a note (valid/neutral); a fallback word is used when empty. */
  getRowIssue: (row: Row) => ReactNode;
  /** Chip labels; the counts are added by the table. */
  chips?: { needsReviewLabel?: string; allLabel?: string };
  /** Show at most this many rows of the active chip; the footer then says "Hiển thị {shown}/{total} dòng". */
  maxRows?: number;
  /** In-frame text when there are no rows at all. */
  emptyText?: string;
  /** Header of the issue column. */
  issueHeader?: string;
  /** Title line of a stacked card (narrow containers), e.g. "Dòng 7 · Nguyễn Văn". */
  cardTitle: (row: Row) => ReactNode;
}

/** Words for each severity: screen-reader prefix of the issue, and the fallback when a feature gives no text. */
export const IMPORT_ROW_SEVERITY_WORDS: Readonly<Record<ImportRowSeverity, string>> = {
  error: "Lỗi",
  neutral: "Không cần xử lý",
  valid: "Hợp lệ",
  warning: "Cảnh báo",
};

/**
 * The table shows from this container width (the 1042px rule of the 14c/14d
 * lists: the frame's 2px border + a 1040px table); below it, stacked cards.
 */
export const IMPORT_REVIEW_TABLE_MIN_WIDTH = 1042;

const NEEDS_REVIEW: ReadonlySet<ImportRowSeverity> = new Set(["error", "warning"]);
const SEVERITY_ORDER: Readonly<Record<ImportRowSeverity, number>> = { error: 0, neutral: 3, valid: 2, warning: 1 };

// The tint stays on hover: TableRow's own `hover:bg-table-row-hover` (a
// :hover rule, more specific than the plain tint) would otherwise wash it out
// under the pointer; `!` wins over it whatever the CSS order.
const rowTint: Record<ImportRowSeverity, string> = {
  error: "bg-danger-bg hover:bg-danger-bg!",
  neutral: "",
  valid: "",
  warning: "bg-warning-bg hover:bg-warning-bg!",
};

const cardTone: Record<ImportRowSeverity, string> = {
  error: "border-danger-border bg-danger-bg",
  neutral: "border-border-subtle bg-surface-base",
  valid: "border-border-subtle bg-surface-base",
  warning: "border-warning-border bg-warning-bg",
};

function isEmptyNode(node: ReactNode): boolean {
  return node === null || node === undefined || node === false || node === "";
}

/**
 * The issue cell always carries words: a success badge "Hợp lệ" for a valid
 * row, the feature's message in the severity colour (with a screen-reader
 * "Lỗi: " / "Cảnh báo: " prefix) for a flagged row, the note in muted text
 * for a neutral row. The message keeps its own element so it can be found
 * by its exact text.
 */
function IssueContent({ issue, severity }: { issue: ReactNode; severity: ImportRowSeverity }) {
  const hasIssue = !isEmptyNode(issue);

  if (severity === "valid") {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Badge tone="success">Hợp lệ</Badge>
        {hasIssue ? <span className="text-secondary text-text-muted">{issue}</span> : null}
      </span>
    );
  }

  if (severity === "neutral") {
    return <span className="text-secondary text-text-muted">{hasIssue ? issue : IMPORT_ROW_SEVERITY_WORDS.neutral}</span>;
  }

  return (
    <span className={cn("text-secondary font-medium", severity === "error" ? "text-danger" : "text-warning")}>
      <span className="sr-only">{IMPORT_ROW_SEVERITY_WORDS[severity]}: </span>
      <span>{hasIssue ? issue : IMPORT_ROW_SEVERITY_WORDS[severity]}</span>
    </span>
  );
}

/**
 * Picks the table or the cards from the wrapper's own width. Exactly one
 * rendering is in the DOM. The server render (and jsdom, which has no
 * layout) stays on the table. On a client mount the layout effect measures
 * the wrapper synchronously: React applies a state update from a layout
 * effect before the browser paints, so a narrow container paints its cards
 * first. A ResizeObserver report is not enough for that (React renders the
 * update it triggers in a later task, after the first paint, which would
 * flash the full table), so the observer only follows later resizes.
 */
function useReviewLayout() {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<"table" | "cards">("table");

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    // 0 = not laid out (e.g. a hidden tab panel, or jsdom): keep the current layout.
    const width = element.getBoundingClientRect().width;
    if (width > 0) setLayout(width >= IMPORT_REVIEW_TABLE_MIN_WIDTH ? "table" : "cards");
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      if (nextWidth > 0) setLayout(nextWidth >= IMPORT_REVIEW_TABLE_MIN_WIDTH ? "table" : "cards");
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { layout, ref };
}

/**
 * Review step table (design 17c, §4.6) over the rows a dry-run returned:
 * chips "Cần xem {n}" (errors + warnings, errors first; the default while
 * n > 0) and "Tất cả {n}" (file order), row tints by severity always paired
 * with words, an issue column, an optional cap with "Hiển thị {shown}/{total}
 * dòng" in the frame footer, and the empty text inside the frame. Read-only:
 * no in-app row edits or drops (the fix is in the Excel file). One rendering
 * per container width: the table from 1042px, stacked cards below.
 */
export function ImportReviewTable<Row>({
  caption,
  cardTitle,
  chips,
  columns,
  emptyText = "Không có dòng nào để kiểm tra.",
  getRowIssue,
  getRowKey,
  getRowSeverity,
  issueHeader = "Vấn đề",
  maxRows,
  rows,
}: ImportReviewTableProps<Row>) {
  const { layout, ref } = useReviewLayout();
  const [chosenFilter, setChosenFilter] = useState<ImportReviewFilter | null>(null);

  const entries = rows.map((row, index) => ({ index, row, severity: getRowSeverity(row) }));
  const reviewEntries = entries
    .filter((entry) => NEEDS_REVIEW.has(entry.severity))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.index - b.index);
  const reviewCount = reviewEntries.length;
  // Default: "Cần xem" while something needs review; it falls back to "Tất cả" when nothing does (e.g. after a re-run).
  const filter: ImportReviewFilter = chosenFilter === "all" || reviewCount === 0 ? "all" : "review";
  const visibleEntries = filter === "review" ? reviewEntries : entries;
  const shownEntries = maxRows !== undefined ? visibleEntries.slice(0, Math.max(maxRows, 0)) : visibleEntries;
  const isCapped = shownEntries.length < visibleEntries.length;
  const footer = isCapped ? (
    <span className="tabular-nums">
      Hiển thị {formatNumber(shownEntries.length)}/{formatNumber(visibleEntries.length)} dòng
    </span>
  ) : null;

  const header = (
    <tr>
      {columns.map((column) => (
        <TableHeaderCell key={column.key} numeric={column.align === "right"} style={column.width ? { width: column.width } : undefined}>
          {column.header}
        </TableHeaderCell>
      ))}
      <TableHeaderCell>{issueHeader}</TableHeaderCell>
    </tr>
  );

  return (
    <div className="@container grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3" ref={ref}>
      {rows.length > 0 ? (
        <QuickFilterChips
          chips={[
            { count: reviewCount, label: chips?.needsReviewLabel ?? "Cần xem", value: "review" },
            { count: rows.length, label: chips?.allLabel ?? "Tất cả", value: "all" },
          ]}
          className="max-md:[&_button]:h-11"
          label="Lọc dòng cần xem"
          onChange={(value) => setChosenFilter(value)}
          value={filter}
        />
      ) : null}

      {rows.length === 0 ? (
        // Rendered once in either layout, inside a frame.
        <div className="rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]">
          <TableState>
            <p className="text-body text-text-muted">{emptyText}</p>
          </TableState>
        </div>
      ) : layout === "table" ? (
        <DataTableFrame
          body={shownEntries.map(({ row, severity }) => (
            <TableRow className={rowTint[severity]} key={getRowKey(row)} tall={NEEDS_REVIEW.has(severity)}>
              {columns.map((column) => (
                <TableCell key={column.key} numeric={column.align === "right"}>
                  {column.render(row)}
                </TableCell>
              ))}
              <TableCell className="py-2">
                <IssueContent issue={getRowIssue(row)} severity={severity} />
              </TableCell>
            </TableRow>
          ))}
          caption={caption}
          // Positioned, so the cells' sr-only text stays inside the frame's horizontal scroll instead of widening the page.
          className="relative"
          footer={footer}
          header={header}
        />
      ) : (
        <div className="grid min-w-0 gap-2">
          {/* role="list" restates the semantics Safari drops with list-style: none. */}
          <ul aria-label={caption} className="m-0 grid list-none gap-2 p-0" role="list">
            {shownEntries.map(({ row, severity }) => (
              <li
                className={cn("min-w-0 rounded-lg border px-4 py-3 shadow-[var(--panel-shadow)]", cardTone[severity])}
                data-severity={severity}
                key={getRowKey(row)}
              >
                <div className="text-body font-semibold text-text-strong">{cardTitle(row)}</div>
                <div className="mt-1">
                  <IssueContent issue={getRowIssue(row)} severity={severity} />
                </div>
                <dl className="mt-2 grid gap-x-4 gap-y-1.5 @min-[480px]:grid-cols-2">
                  {columns
                    .filter((column) => !column.hideInCard)
                    .map((column) => (
                      <div className="flex min-w-0 items-baseline justify-between gap-3 @min-[480px]:block" key={column.key}>
                        <dt className="shrink-0 text-caption text-text-muted">{column.header}</dt>
                        <dd className={cn("min-w-0 text-secondary text-text-default", column.align === "right" && "tabular-nums")}>
                          {column.render(row)}
                        </dd>
                      </div>
                    ))}
                </dl>
              </li>
            ))}
          </ul>
          {footer ? <p className="text-secondary text-text-muted">{footer}</p> : null}
        </div>
      )}
    </div>
  );
}
