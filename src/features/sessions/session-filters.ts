import type { SessionDirectoryItem } from "./read-models";

export interface SessionDirectoryFiltersState {
  classId: string;
  dateFrom: string;
  dateTo: string;
  kind: string;
  search: string;
  status: string;
}

export const defaultSessionFilters: SessionDirectoryFiltersState = {
  classId: "all", dateFrom: "", dateTo: "", kind: "all", search: "", status: "all",
};

export function filterSessions(sessions: SessionDirectoryItem[], filters: SessionDirectoryFiltersState) {
  const search = normalize(filters.search);
  return sessions.filter((session) =>
    (search.length === 0 || normalize(session.classCode).includes(search) || normalize(session.className).includes(search) || normalize(session.componentCode ?? "").includes(search)) &&
    (filters.classId === "all" || session.classId === filters.classId) &&
    (filters.status === "all" || session.status === filters.status) &&
    (filters.kind === "all" || session.sessionKind === filters.kind) &&
    (filters.dateFrom.length === 0 || session.sessionDate >= filters.dateFrom) &&
    (filters.dateTo.length === 0 || session.sessionDate <= filters.dateTo),
  );
}

export function paginateSessions(sessions: SessionDirectoryItem[], requestedPage: number, pageSize = 20) {
  const pageCount = Math.max(1, Math.ceil(sessions.length / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = sessions.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, sessions.length);
  return { end, page, pageCount, rows: sessions.slice((page - 1) * pageSize, page * pageSize), start };
}

export function countActiveSessionFilters(filters: SessionDirectoryFiltersState): number {
  return Object.entries(filters).filter(([key, value]) => key === "search" || key === "dateFrom" || key === "dateTo" ? value.trim().length > 0 : value !== "all").length;
}

export function hasActiveSessionFilters(filters: SessionDirectoryFiltersState): boolean {
  return countActiveSessionFilters(filters) > 0;
}

export function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
