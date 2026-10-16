import type {
  LearningResultDirectoryItem,
  LearningResultNotebookStatus,
} from "@/features/learning-results/read-models";

export const LEARNING_RESULTS_PAGE_SIZE = 20;

/** Test-score filter; the last two mirror the "Dưới 5" and "Cần chú ý" quick chips. */
export type LearningResultScoreFilter =
  | ""
  | "scored"
  | "unscored"
  | "below_five"
  | "attention";

export type LearningResultNotebookFilter = "" | LearningResultNotebookStatus;

export interface LearningResultFiltersState {
  classId: string;
  dateFrom: string;
  dateTo: string;
  /** Class grade (khối của lớp), not the student's current grade. */
  grade: string;
  notebookStatus: LearningResultNotebookFilter;
  scoreStatus: LearningResultScoreFilter;
  search: string;
}

/** Typed single-field update shared by the page and its filter fields. */
export type LearningResultFilterChange = <
  Key extends keyof LearningResultFiltersState,
>(
  key: Key,
  value: LearningResultFiltersState[Key],
) => void;

export const defaultLearningResultFilters: LearningResultFiltersState = {
  classId: "",
  dateFrom: "",
  dateTo: "",
  grade: "",
  notebookStatus: "",
  scoreStatus: "",
  search: "",
};

export const learningResultQuickChipValues = [
  "all",
  "unscored",
  "below_five",
  "not_submitted",
  "attention",
] as const;

export type LearningResultQuickChip =
  (typeof learningResultQuickChipValues)[number];

export const learningResultQuickChipLabels: Record<
  LearningResultQuickChip,
  string
> = {
  all: "Tất cả",
  attention: "Cần chú ý",
  below_five: "Dưới 5",
  not_submitted: "Vở chưa nộp",
  unscored: "Chưa có điểm",
};

/** Test score present and under 5. A missing score is not below 5. */
export function isBelowFive(item: LearningResultDirectoryItem): boolean {
  return item.testScore !== null && item.testScore < 5;
}

/** The long-standing attention rule: notebook not handed in, or a test/notebook score under 5. */
export function needsAttention(item: LearningResultDirectoryItem): boolean {
  return (
    item.notebookStatus === "not_submitted" ||
    isBelowFive(item) ||
    (item.notebookScore !== null && item.notebookScore < 5)
  );
}

function matchesScoreStatus(
  item: LearningResultDirectoryItem,
  status: LearningResultScoreFilter,
): boolean {
  switch (status) {
    case "scored":
      return item.testScore !== null;
    case "unscored":
      return item.testScore === null;
    case "below_five":
      return isBelowFive(item);
    case "attention":
      return needsAttention(item);
    default:
      return true;
  }
}

/** Accent-insensitive, case-insensitive; `đ` has no Unicode decomposition so it is folded by hand. */
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .replace(/đ/g, "d")
    .trim();
}

/**
 * `ignoreQuick` skips the two filters the quick chips drive (score status and
 * notebook status) so chip counts describe what pressing each chip would show.
 */
export function matchesLearningResultFilters(
  item: LearningResultDirectoryItem,
  filters: LearningResultFiltersState,
  options: { ignoreQuick?: boolean } = {},
): boolean {
  const search = normalizeSearch(filters.search);

  if (search) {
    const searchable = normalizeSearch(
      `${item.studentName} ${item.studentCode} ${item.className} ${item.classCode}`,
    );

    if (!searchable.includes(search)) {
      return false;
    }
  }

  if (filters.grade && item.classGrade !== Number(filters.grade)) return false;
  if (filters.classId && item.classId !== filters.classId) return false;
  if (filters.dateFrom && item.sessionDate < filters.dateFrom) return false;
  if (filters.dateTo && item.sessionDate > filters.dateTo) return false;

  if (options.ignoreQuick) return true;

  return (
    (!filters.notebookStatus ||
      item.notebookStatus === filters.notebookStatus) &&
    matchesScoreStatus(item, filters.scoreStatus)
  );
}

export function countActiveLearningResultFilters(
  filters: LearningResultFiltersState,
): number {
  return [
    filters.search.trim(),
    filters.classId,
    filters.grade,
    filters.dateFrom,
    filters.dateTo,
    filters.notebookStatus,
    filters.scoreStatus,
  ].filter(Boolean).length;
}

/**
 * The chip that mirrors the current filters; `null` when they match no single
 * chip (e.g. score and notebook filters applied together, or "Đã nộp").
 */
export function getLearningResultQuickChip(
  filters: LearningResultFiltersState,
): LearningResultQuickChip | null {
  const { notebookStatus, scoreStatus } = filters;

  if (!scoreStatus && !notebookStatus) return "all";

  if (!notebookStatus) {
    return scoreStatus === "unscored" ||
      scoreStatus === "below_five" ||
      scoreStatus === "attention"
      ? scoreStatus
      : null;
  }

  return !scoreStatus && notebookStatus === "not_submitted"
    ? "not_submitted"
    : null;
}

/** Pressing a chip sets score + notebook status exclusively and keeps every other filter. */
export function applyLearningResultQuickChip(
  filters: LearningResultFiltersState,
  chip: LearningResultQuickChip,
): LearningResultFiltersState {
  if (chip === "all") {
    return { ...filters, notebookStatus: "", scoreStatus: "" };
  }

  if (chip === "not_submitted") {
    return { ...filters, notebookStatus: "not_submitted", scoreStatus: "" };
  }

  return { ...filters, notebookStatus: "", scoreStatus: chip };
}

/** Counts over the loaded rows that satisfy every filter except the chip-driven ones. */
export function countLearningResultQuickChips(
  items: readonly LearningResultDirectoryItem[],
  filters: LearningResultFiltersState,
): Record<LearningResultQuickChip, number> {
  const counts: Record<LearningResultQuickChip, number> = {
    all: 0,
    attention: 0,
    below_five: 0,
    not_submitted: 0,
    unscored: 0,
  };

  for (const item of items) {
    if (!matchesLearningResultFilters(item, filters, { ignoreQuick: true })) {
      continue;
    }

    counts.all += 1;
    if (item.testScore === null) counts.unscored += 1;
    if (isBelowFive(item)) counts.below_five += 1;
    if (item.notebookStatus === "not_submitted") counts.not_submitted += 1;
    if (needsAttention(item)) counts.attention += 1;
  }

  return counts;
}

/**
 * The loader keeps the newest `LEARNING_RESULTS_LIMIT` rows by session date, so
 * once the cap is hit nothing older than the oldest loaded session date is
 * here. `null` for an empty list.
 */
export function getOldestLearningResultDate(
  items: readonly LearningResultDirectoryItem[],
): string | null {
  let oldest: string | null = null;

  for (const item of items) {
    if (oldest === null || item.sessionDate < oldest) {
      oldest = item.sessionDate;
    }
  }

  return oldest;
}

/**
 * True when the chosen date range may include rows the capped load left out
 * (ISO dates compare as strings). The loader orders newest first and cuts at
 * the limit, so the oldest loaded day can itself be cut partway: only a
 * `dateFrom` strictly after `oldestLoadedDate` is fully inside the window. A
 * range with a bound but no `dateFrom` reaches back without limit. No bounds at
 * all is the default view of exactly the newest rows, so it is complete.
 * Callers pass the date only when the load was capped.
 */
export function reachesBeforeLoadedWindow(
  filters: Pick<LearningResultFiltersState, "dateFrom" | "dateTo">,
  oldestLoadedDate: string,
): boolean {
  const hasDateBound = filters.dateFrom !== "" || filters.dateTo !== "";

  return (
    hasDateBound &&
    (filters.dateFrom === "" || filters.dateFrom <= oldestLoadedDate)
  );
}

export interface LearningResultClassOption {
  id: string;
  label: string;
}

/** One option per class, sorted by name; a name shared by two classes gets its code appended. */
export function getLearningResultClassOptions(
  items: readonly LearningResultDirectoryItem[],
): LearningResultClassOption[] {
  const classes = new Map<string, { code: string; name: string }>();

  for (const item of items) {
    classes.set(item.classId, { code: item.classCode, name: item.className });
  }

  const nameCounts = new Map<string, number>();
  for (const { name } of classes.values()) {
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }

  return Array.from(classes, ([id, { code, name }]) => ({
    id,
    label: (nameCounts.get(name) ?? 0) > 1 ? `${name} · ${code}` : name,
  })).sort((left, right) => left.label.localeCompare(right.label, "vi"));
}

export function getLearningResultGradeOptions(
  items: readonly LearningResultDirectoryItem[],
): number[] {
  return Array.from(new Set(items.map((item) => item.classGrade))).sort(
    (left, right) => left - right,
  );
}

export interface LearningResultPage<T> {
  page: number;
  pageCount: number;
  rangeEnd: number;
  rangeStart: number;
  rows: T[];
  total: number;
}

/** 1-based page clamped into range; an empty list is page 1 of 1 with range 0–0. */
export function paginateLearningResults<T>(
  rows: readonly T[],
  requestedPage: number,
  pageSize: number = LEARNING_RESULTS_PAGE_SIZE,
): LearningResultPage<T> {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const startIndex = (page - 1) * pageSize;
  const pageRows = rows.slice(startIndex, startIndex + pageSize);

  return {
    page,
    pageCount,
    rangeEnd: startIndex + pageRows.length,
    rangeStart: pageRows.length === 0 ? 0 : startIndex + 1,
    rows: pageRows,
    total: rows.length,
  };
}

const scoreFormatter = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 2,
});

export function formatLearningResultScore(score: number): string {
  return scoreFormatter.format(score);
}
