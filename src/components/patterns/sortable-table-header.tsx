"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import type { SortState } from "@/lib/sorting";
import { cn } from "@/lib/utils";

interface SortableTableHeaderProps<K extends string> {
  children: ReactNode;
  className?: string;
  onSort: (key: K) => void;
  sort: SortState<K> | null;
  sortKey: K;
}

/** Column header button that toggles asc/desc and announces the state via aria-sort. */
export function SortableTableHeader<K extends string>({ children, className, onSort, sort, sortKey }: SortableTableHeaderProps<K>) {
  const active = sort?.key === sortKey;
  const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
  const Icon = active ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th aria-sort={ariaSort} className={cn("h-10 border-b border-border-subtle px-3 text-left font-semibold", className)} scope="col">
      <button
        className={cn(
          "inline-flex items-center gap-1 rounded-sm text-left hover:text-text-strong focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring",
          active ? "text-text-strong" : "text-text-muted",
        )}
        onClick={() => onSort(sortKey)}
        type="button"
      >
        {children}
        <Icon aria-hidden="true" size={14} strokeWidth={1.8} />
      </button>
    </th>
  );
}

/** Plain header cell with the same spacing, for columns that do not sort. */
export function TableHeaderCell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th className={cn("h-10 border-b border-border-subtle px-3 text-left font-semibold", className)} scope="col">
      {children}
    </th>
  );
}
