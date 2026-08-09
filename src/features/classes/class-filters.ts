import type { ClassDirectoryItem } from "./read-models";

export interface ClassDirectoryFiltersState {
  grade: string;
  level: string;
  mode: string;
  search: string;
  status: string;
  year: string;
}

export const defaultClassFilters: ClassDirectoryFiltersState = {
  grade: "all", level: "all", mode: "all", search: "", status: "all", year: "all",
};

export function filterClasses(classes: ClassDirectoryItem[], filters: ClassDirectoryFiltersState): ClassDirectoryItem[] {
  const search = normalize(filters.search);
  return classes.filter((item) =>
    (search.length === 0 || normalize(item.code).includes(search) || normalize(item.name).includes(search)) &&
    (filters.year === "all" || item.academicYear?.code === filters.year) &&
    (filters.grade === "all" || String(item.grade) === filters.grade) &&
    (filters.level === "all" || item.level === filters.level) &&
    (filters.mode === "all" || item.defaultLearningMode === filters.mode) &&
    (filters.status === "all" || item.status === filters.status),
  );
}

export function paginateClasses(classes: ClassDirectoryItem[], requestedPage: number, pageSize = 20) {
  const pageCount = Math.max(1, Math.ceil(classes.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = classes.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, classes.length);
  return { end, page, pageCount, rows: classes.slice((page - 1) * pageSize, page * pageSize), start };
}

export function countActiveClassFilters(filters: ClassDirectoryFiltersState): number {
  return Object.entries(filters).filter(([key, value]) => key === "search" ? value.trim().length > 0 : value !== "all").length;
}

export function hasActiveClassFilters(filters: ClassDirectoryFiltersState): boolean {
  return countActiveClassFilters(filters) > 0;
}

export function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
