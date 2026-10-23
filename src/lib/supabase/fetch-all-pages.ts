export interface PageResult<T> {
  data: T[] | null;
  error: unknown;
}

/** Rows per request, below PostgREST's max_rows (1000), so a short page is the last one. */
export const FETCH_PAGE_SIZE = 500;

/**
 * Reads every page of a query whose list must be complete (a student picker).
 * PostgREST cuts a response at max_rows without an error, so this pages through
 * `range`. The query needs a total order (end on a unique column) or pages can
 * overlap.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<PageResult<T>> {
  const rows: T[] = [];

  for (let from = 0; ; from += FETCH_PAGE_SIZE) {
    const result = await fetchPage(from, from + FETCH_PAGE_SIZE - 1);
    if (result.error) return { data: null, error: result.error };

    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < FETCH_PAGE_SIZE) return { data: rows, error: null };
  }
}
