import type { StudentDirectoryFiltersState } from "@/features/students/read-models";
import {
  defaultStudentFilters,
  studentStatusOptions,
} from "@/features/students/student-filters";

const studentsOwnedSearchParams = [
  "search",
  "status",
  "grade",
  "class",
  "level",
  "mode",
  "page",
] as const;

type StudentsOwnedSearchParam = (typeof studentsOwnedSearchParams)[number];

export interface StudentDirectoryViewState {
  filters: StudentDirectoryFiltersState;
  page: number;
}

/**
 * Applies a single directory control change to the latest locally requested
 * filter set. This stays Students-local: URL search params remain the rendered
 * view state, while callers use the returned value only to compose updates
 * before Next navigation has settled.
 */
export function mergePendingStudentDirectoryFilter(
  pendingFilters: StudentDirectoryFiltersState | null,
  renderedFilters: StudentDirectoryFiltersState,
  key: keyof StudentDirectoryFiltersState,
  value: string,
): StudentDirectoryFiltersState {
  return {
    ...(pendingFilters ?? renderedFilters),
    [key]: value,
  };
}

export function areStudentDirectoryFiltersEqual(
  left: StudentDirectoryFiltersState,
  right: StudentDirectoryFiltersState,
): boolean {
  return (
    left.className === right.className &&
    left.grade === right.grade &&
    left.learningLevel === right.learningLevel &&
    left.registeredMode === right.registeredMode &&
    left.search === right.search &&
    left.status === right.status
  );
}

type SearchParamsLike = Pick<URLSearchParams, "get" | "toString">;

const statusValues = new Set(studentStatusOptions.map((option) => option.value));
const levelValues = new Set(["A", "B", "CLC"]);
const modeValues = new Set(["online", "offline"]);

export function parseStudentDirectoryViewState(
  params: SearchParamsLike,
  classNames: readonly string[],
): StudentDirectoryViewState {
  const className = params.get("class");
  const status = params.get("status");
  const grade = params.get("grade");
  const level = params.get("level");
  const mode = params.get("mode");

  return {
    filters: {
      className: className && classNames.includes(className) ? className : defaultStudentFilters.className,
      grade: grade && /^(?:[1-9]|1[0-2])$/.test(grade) ? grade : defaultStudentFilters.grade,
      learningLevel: level && levelValues.has(level) ? level : defaultStudentFilters.learningLevel,
      registeredMode: mode && modeValues.has(mode) ? mode : defaultStudentFilters.registeredMode,
      search: params.get("search") ?? defaultStudentFilters.search,
      status: status && statusValues.has(status as (typeof studentStatusOptions)[number]["value"])
        ? status
        : defaultStudentFilters.status,
    },
    page: parsePage(params.get("page")),
  };
}

export function serializeStudentDirectoryViewState(
  currentParams: SearchParamsLike,
  viewState: StudentDirectoryViewState,
): URLSearchParams {
  const next = new URLSearchParams(currentParams.toString());

  studentsOwnedSearchParams.forEach((key) => next.delete(key));

  if (viewState.filters.search.trim()) next.set("search", viewState.filters.search);
  if (viewState.filters.status !== "all") next.set("status", viewState.filters.status);
  if (viewState.filters.grade !== "all") next.set("grade", viewState.filters.grade);
  if (viewState.filters.className !== "all") next.set("class", viewState.filters.className);
  if (viewState.filters.learningLevel !== "all") next.set("level", viewState.filters.learningLevel);
  if (viewState.filters.registeredMode !== "all") next.set("mode", viewState.filters.registeredMode);
  if (viewState.page > 1) next.set("page", String(viewState.page));

  return next;
}

export function getStudentDirectoryHref(
  currentParams: SearchParamsLike,
  viewState: StudentDirectoryViewState,
): string {
  const query = serializeStudentDirectoryViewState(currentParams, viewState).toString();
  return query ? `/students?${query}` : "/students";
}

export function getStudentDirectoryQuery(
  params: SearchParamsLike,
): string {
  const query = new URLSearchParams();

  studentsOwnedSearchParams.forEach((key) => {
    const value = params.get(key);
    if (isSafeOwnedValue(key, value)) query.set(key, value);
  });

  return query.toString();
}

export function withStudentDirectoryQuery(
  pathname: string,
  params: SearchParamsLike,
): string {
  const query = getStudentDirectoryQuery(params);
  return query ? `${pathname}?${query}` : pathname;
}

export function resetStudentDirectoryViewState(): StudentDirectoryViewState {
  return { filters: defaultStudentFilters, page: 1 };
}

function parsePage(value: string | null): number {
  if (!value || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

function isSafeOwnedValue(
  key: StudentsOwnedSearchParam,
  value: string | null,
): value is string {
  if (value === null) return false;
  if (key === "search") return value.length <= 160;
  if (key === "class") return value.length > 0 && value.length <= 160;
  if (key === "grade") return /^(?:[1-9]|1[0-2])$/.test(value);
  if (key === "level") return levelValues.has(value);
  if (key === "mode") return modeValues.has(value);
  if (key === "status") return statusValues.has(value as (typeof studentStatusOptions)[number]["value"]);
  return /^[1-9]\d*$/.test(value);
}
