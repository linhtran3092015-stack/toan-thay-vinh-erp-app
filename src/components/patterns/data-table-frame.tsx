import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type DataTableFrameStatus = "ready" | "loading" | "empty" | "error" | "forbidden";

interface DataTableFrameProps {
  body: ReactNode;
  caption: string;
  className?: string;
  header: ReactNode;
  tableClassName?: string;
  /** Footer row inside the frame: result meta on the left, pager on the right. */
  footer?: ReactNode;
  /**
   * Loading/empty/error/forbidden stay inside the frame so the page keeps its
   * geometry. The feature decides the status and supplies the slot content.
   */
  status?: DataTableFrameStatus;
  loading?: ReactNode;
  empty?: ReactNode;
  error?: ReactNode;
  forbidden?: ReactNode;
}

/**
 * Presentation-only table framing (design 10): 40px header on `--table-header`,
 * 48/56px rows separated by `--border-row`, hover and selected surfaces,
 * numeric cells right-aligned with tabular figures. Columns and row actions
 * remain feature-owned.
 */
export function DataTableFrame({
  body,
  caption,
  className,
  header,
  tableClassName,
  footer,
  status = "ready",
  loading,
  empty,
  error,
  forbidden,
}: DataTableFrameProps) {
  const slot =
    status === "loading"
      ? loading
      : status === "empty"
        ? empty
        : status === "error"
          ? error
          : status === "forbidden"
            ? forbidden
            : null;

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border border-border-subtle bg-surface-base shadow-[var(--panel-shadow)]",
        className,
      )}
    >
      <table className={cn("w-full border-separate border-spacing-0 text-left text-table-body text-text-default", tableClassName)}>
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-table-header text-table-header text-text-muted">
          {header}
        </thead>
        {status === "ready" ? (
          <tbody className="[&>tr+tr>td]:border-t [&>tr+tr>td]:border-border-row [&>tr+tr>th]:border-t [&>tr+tr>th]:border-border-row">
            {body}
          </tbody>
        ) : null}
      </table>
      {/* State and footer stay pinned to the visible width while a wide table scrolls. */}
      {slot ? <div className="sticky left-0 w-full border-t border-border-row">{slot}</div> : null}
      {footer ? (
        <div className="sticky left-0 flex w-full flex-wrap items-center justify-between gap-3 border-t border-border-row px-4 py-2.5 text-secondary text-text-muted">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

interface TableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  numeric?: boolean;
}

/** 40px column header, 12/600 muted; `numeric` right-aligns like its cells. */
export function TableHeaderCell({ children, className, numeric, ...props }: TableHeaderCellProps) {
  return (
    <th
      className={cn(
        "h-10 whitespace-nowrap px-3 text-left font-semibold first:pl-4 last:pr-4",
        numeric && "text-right",
        className,
      )}
      scope="col"
      {...props}
    >
      {children}
    </th>
  );
}

interface TableRowProps {
  children: ReactNode;
  className?: string;
  selected?: boolean;
  /** 56px row for a mandatory secondary line; default 48px. */
  tall?: boolean;
}

export function TableRow({ children, className, selected = false, tall = false }: TableRowProps) {
  return (
    <tr
      aria-selected={selected || undefined}
      className={cn(
        "group/row hover:bg-table-row-hover",
        selected && "bg-table-row-selected",
        tall ? "h-14" : "h-12",
        className,
      )}
      data-selected={selected || undefined}
    >
      {children}
    </tr>
  );
}

interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  /** Right-aligned tabular figures for amounts, counts, dates in dense columns. */
  numeric?: boolean;
}

export function TableCell({ children, className, numeric, ...props }: TableCellProps) {
  return (
    <td
      className={cn(
        "px-3 py-0 align-middle first:pl-4 last:pr-4",
        numeric && "text-right tabular-nums",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

interface TableStateProps {
  children: ReactNode;
  className?: string;
}

/** Centered state block inside the frame (empty by filter, loading notice, forbidden). */
export function TableState({ children, className }: TableStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      {children}
    </div>
  );
}

/** Skeleton rows that keep the 48px row rhythm while data loads. */
export function TableSkeletonRows({ columns, rows = 10 }: { columns: number; rows?: number }) {
  return (
    <div aria-hidden="true" className="motion-safe:animate-pulse">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          className="grid h-12 items-center gap-3 border-t border-border-row px-4 first:border-t-0"
          key={rowIndex}
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (__, cellIndex) => (
            <div
              className={cn("h-3.5 rounded-sm bg-surface-sunken", cellIndex === 0 ? "w-4/5" : "w-3/5")}
              key={cellIndex}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
