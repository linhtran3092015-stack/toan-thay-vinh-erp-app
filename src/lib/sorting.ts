import { useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";

export interface SortState<K extends string> {
  direction: SortDirection;
  key: K;
}

const collator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

/** Compares strings with Vietnamese collation, numbers numerically, nulls last. */
export function compareValues(left: unknown, right: unknown): number {
  if (left === right) return 0;
  if (left === null || left === undefined) return 1;
  if (right === null || right === undefined) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return collator.compare(String(left), String(right));
}

/**
 * Client-side sort state for a loaded table. `getValue` maps a row to the
 * comparable value for a column; the initial sort keeps the server order.
 */
export function useSortedRows<T, K extends string>(
  rows: readonly T[],
  getValue: (row: T, key: K) => unknown,
  initial: SortState<K> | null = null,
) {
  const [sort, setSort] = useState<SortState<K> | null>(initial);

  const sortedRows = useMemo<T[]>(() => {
    if (!sort) return [...rows];
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((left, right) => factor * compareValues(getValue(left, sort.key), getValue(right, sort.key)));
  }, [getValue, rows, sort]);

  const toggleSort = (key: K) => {
    setSort((current) =>
      current?.key === key
        ? { direction: current.direction === "asc" ? "desc" : "asc", key }
        : { direction: "asc", key },
    );
  };

  return { setSort, sort, sortedRows, toggleSort };
}
