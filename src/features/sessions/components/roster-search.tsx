"use client";

import { useId } from "react";
import type { SessionParticipantReadModel } from "@/features/sessions/detail-read-models";

export function normalizeRosterSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("vi").replace(/đ/g, "d").trim();
}

export function matchesRosterSearch(participant: SessionParticipantReadModel, index: number, search: string, canViewStudents: boolean): boolean {
  const identity = canViewStudents ? `${participant.studentName ?? ""} ${participant.studentCode ?? ""}` : `Học viên ${index + 1}`;
  const normalized = normalizeRosterSearch(identity);
  return normalizeRosterSearch(search).split(/\s+/).every((word) => normalized.includes(word));
}

export function RosterSearch({ search, onSearchChange, onlyMissing, onOnlyMissingChange, missingLabel, visibleCount, totalCount }: {
  search: string;
  onSearchChange: (value: string) => void;
  onlyMissing: boolean;
  onOnlyMissingChange: (value: boolean) => void;
  missingLabel: string;
  visibleCount: number;
  totalCount: number;
}) {
  const id = useId();
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-end gap-3 rounded-lg border border-border-subtle bg-surface-base p-3">
      <label className="grid min-w-0 flex-1 gap-1 text-label font-semibold text-text-strong" htmlFor={id}>
        Tìm học viên trong buổi
        <input id={id} type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Tên hoặc mã học viên · có thể gõ không dấu" className="h-11 w-full rounded-md border border-border-subtle bg-field-bg px-3 text-body font-normal outline-none focus:border-border-focus focus:ring-[3px] focus:ring-focus-ring" />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-body text-text-strong"><input type="checkbox" checked={onlyMissing} onChange={(event) => onOnlyMissingChange(event.target.checked)} />{missingLabel}</label>
      <span className="pb-3 text-caption text-text-muted" role="status">{visibleCount}/{totalCount} học viên</span>
    </div>
  );
}
