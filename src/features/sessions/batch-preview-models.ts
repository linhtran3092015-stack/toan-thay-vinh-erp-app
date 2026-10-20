import type { BadgeTone } from "@/components/ui/badge";
import { formatIsoDate } from "@/lib/datetime";

import { type BatchScheduleOption, type ExistingSessionSnapshot, VIETNAMESE_SHORT_WEEKDAYS } from "./batch-calculation";
import { type BatchSessionDraftItem, isValidDateString } from "./forms/session-batch-schema";

/*
 * Pure preview rules of /sessions/batch (design 17b, BatchPreviewGrid) layered
 * on top of `calculateBatchOccurrences`, whose outputs stay untouched: client
 * holidays, the schedule templates' effective window, the selection the
 * request will carry and the counts the grid states. Nothing here is
 * persisted; the server re-checks duplicates and the RPC stays the only write.
 */

/** Sessions one request may carry: `.max(100, …)` of `createBatchSessionsPayloadSchema` (pinned by a source test). */
export const BATCH_MAX_SESSIONS_PER_REQUEST = 100;
/** The schema's own wording of that cap, reused as the create button's disabled reason. */
export const BATCH_MAX_SESSIONS_MESSAGE = `Mỗi đợt tạo tối đa ${BATCH_MAX_SESSIONS_PER_REQUEST} buổi học.`;
/** The schema's `.min(1, …)` wording, reused when nothing is selected. */
export const BATCH_MIN_SESSIONS_MESSAGE = "Cần chọn ít nhất 1 buổi học để tạo.";
/** Why "Chọn tất cả" is disabled when every draft is blocked (all already exist, fall on a holiday or out of window). */
export const BATCH_NOTHING_CHOOSABLE_MESSAGE = "Không còn buổi nào chọn được.";
/** Newest non-cancelled sessions the loader reads for the client duplicate check: `.limit(300)` in batch-data.ts (pinned). */
export const BATCH_DUPLICATE_CHECK_LIMIT = 300;

/**
 * Why a draft is shown the way it is, strongest first: a regular session
 * outside its template's effective window would make the RPC abort the whole
 * batch (CLASS_SESSION_SCHEDULE_NOT_EFFECTIVE); a holiday the user listed; a
 * session the class already has on that date/slot (non-cancelled, newest
 * BATCH_DUPLICATE_CHECK_LIMIT; the server skips it anyway); a date before
 * today (still created).
 */
export type BatchPreviewFlag = "outside_window" | "holiday" | "duplicate" | "past" | "none";

/** The word each flag carries on its chip and row (state is never colour alone). */
export const BATCH_PREVIEW_FLAG_WORDS: Readonly<Record<BatchPreviewFlag, string>> = {
  duplicate: "đã có (bỏ qua)",
  holiday: "nghỉ",
  none: "",
  outside_window: "ngoài hiệu lực",
  past: "đã qua",
};

export interface BatchPreviewRow {
  draft: BatchSessionDraftItem;
  flag: BatchPreviewFlag;
  /**
   * Holiday, duplicate and out-of-window drafts cannot be chosen until the
   * holiday, the draft's time or the range changes; they are never sent nor
   * counted against the cap.
   */
  blocked: boolean;
  /** What the request carries: the draft's own tick, never for a blocked draft. */
  selected: boolean;
}

export interface BatchPreviewSummary {
  /** Every draft in the preview. */
  total: number;
  /** Drafts the request will carry. */
  selected: number;
  /** Listed holidays that fall on at least one draft (days, not sessions). */
  holidayDays: number;
  /** Drafts per listed holiday date (0 when the holiday hits nothing). */
  holidayHits: Readonly<Record<string, number>>;
  duplicates: number;
  outsideWindow: number;
  past: number;
  firstDate: string | null;
  lastDate: string | null;
}

/**
 * True when a regular (template) draft falls before its template's
 * `effectiveFrom` or after its `effectiveTo` — the insert trigger's own rule,
 * bounds inclusive. Custom drafts (no template) have no window.
 */
export function isDraftOutsideScheduleWindow(
  draft: Pick<BatchSessionDraftItem, "scheduleTemplateId" | "sessionDate">,
  schedule: Pick<BatchScheduleOption, "effectiveFrom" | "effectiveTo"> | undefined,
): boolean {
  if (!draft.scheduleTemplateId || !schedule) return false;
  const from = schedule.effectiveFrom.slice(0, 10);
  const to = schedule.effectiveTo ? schedule.effectiveTo.slice(0, 10) : null;
  return draft.sessionDate < from || (to !== null && draft.sessionDate > to);
}

/**
 * True when the class already has a non-cancelled session the server would
 * skip this draft for — `createBatchSessionsAction`'s own rule, on the
 * draft's current date, start time and template: same date and either the
 * same template or the same start time (HH:MM).
 */
export function isDraftDuplicateOfExisting(
  draft: Pick<BatchSessionDraftItem, "scheduleTemplateId" | "sessionDate" | "startTime">,
  existingSessions: readonly ExistingSessionSnapshot[],
): boolean {
  return existingSessions.some((existing) => {
    if (existing.sessionDate !== draft.sessionDate) return false;
    if (draft.scheduleTemplateId && existing.scheduleTemplateId === draft.scheduleTemplateId) return true;
    return existing.startTime.slice(0, 5) === draft.startTime.slice(0, 5);
  });
}

/**
 * Flags every draft and resolves what the request will carry. Order and
 * drafts are kept as given. Duplicate and past are recomputed from the
 * draft's current values (an edited start time can make or clear a
 * duplicate), never read from the calculation's `statusConflict`.
 */
export function buildBatchPreviewRows(
  drafts: readonly BatchSessionDraftItem[],
  {
    existingSessions,
    holidays,
    schedules,
    today,
  }: {
    existingSessions: readonly ExistingSessionSnapshot[];
    holidays: readonly string[];
    schedules: readonly BatchScheduleOption[];
    /** Vietnam business date `YYYY-MM-DD`. */
    today: string;
  },
): BatchPreviewRow[] {
  const holidaySet = new Set(holidays);
  const schedulesById = new Map(schedules.map((schedule) => [schedule.id, schedule]));
  const existingByDate = new Map<string, ExistingSessionSnapshot[]>();
  for (const existing of existingSessions) {
    const onDate = existingByDate.get(existing.sessionDate);
    if (onDate) onDate.push(existing);
    else existingByDate.set(existing.sessionDate, [existing]);
  }

  return drafts.map((draft) => {
    const schedule = draft.scheduleTemplateId ? schedulesById.get(draft.scheduleTemplateId) : undefined;
    const flag: BatchPreviewFlag = isDraftOutsideScheduleWindow(draft, schedule)
      ? "outside_window"
      : holidaySet.has(draft.sessionDate)
        ? "holiday"
        : isDraftDuplicateOfExisting(draft, existingByDate.get(draft.sessionDate) ?? [])
          ? "duplicate"
          : draft.sessionDate < today
            ? "past"
            : "none";
    const blocked = flag === "outside_window" || flag === "holiday" || flag === "duplicate";
    return { blocked, draft, flag, selected: draft.selected && !blocked };
  });
}

/** A chip's word as a badge label: same words, first letter capitalised. */
function toBadgeLabel(word: string): string {
  return word.charAt(0).toLocaleUpperCase("vi") + word.slice(1);
}

/** The editor badges reuse the chips' words (one wording per state); only the holiday badge says "Ngày nghỉ". */
const DRAFT_ROW_STATUS: Readonly<Record<BatchPreviewFlag, { label: string; tone: BadgeTone }>> = {
  duplicate: { label: toBadgeLabel(BATCH_PREVIEW_FLAG_WORDS.duplicate), tone: "warning" },
  holiday: { label: "Ngày nghỉ", tone: "neutral" },
  none: { label: "Sẽ tạo", tone: "success" },
  outside_window: { label: toBadgeLabel(BATCH_PREVIEW_FLAG_WORDS.outside_window), tone: "danger" },
  past: { label: toBadgeLabel(BATCH_PREVIEW_FLAG_WORDS.past), tone: "neutral" },
};

/** The status badge of a row in "Chỉnh từng buổi" (a plain draft unticked by hand reads "Bỏ chọn"). */
export function getBatchDraftRowStatus(row: Pick<BatchPreviewRow, "flag" | "selected">): { label: string; tone: BadgeTone } {
  if (row.flag === "none" && !row.selected) return { label: "Bỏ chọn", tone: "neutral" };
  return DRAFT_ROW_STATUS[row.flag];
}

/** True when two rows render the same (the draft object, its flag and its effective tick). */
export function isSameBatchPreviewRow(a: BatchPreviewRow, b: BatchPreviewRow): boolean {
  return a.draft === b.draft && a.flag === b.flag && a.selected === b.selected && a.blocked === b.blocked;
}

export function summarizeBatchPreview(rows: readonly BatchPreviewRow[], holidays: readonly string[]): BatchPreviewSummary {
  const holidayHits: Record<string, number> = Object.fromEntries(holidays.map((date) => [date, 0]));
  let selected = 0;
  let duplicates = 0;
  let outsideWindow = 0;
  let past = 0;

  for (const row of rows) {
    if (row.selected) selected += 1;
    if (row.flag === "duplicate") duplicates += 1;
    if (row.flag === "outside_window") outsideWindow += 1;
    if (row.flag === "past") past += 1;
    if (row.flag === "holiday") holidayHits[row.draft.sessionDate] = (holidayHits[row.draft.sessionDate] ?? 0) + 1;
  }

  return {
    duplicates,
    firstDate: rows[0]?.draft.sessionDate ?? null,
    holidayDays: Object.values(holidayHits).filter((hits) => hits > 0).length,
    holidayHits,
    lastDate: rows.at(-1)?.draft.sessionDate ?? null,
    outsideWindow,
    past,
    selected,
    total: rows.length,
  };
}

/** The drafts the create request carries, in preview order. */
export function getSelectedBatchDrafts(rows: readonly BatchPreviewRow[]): BatchSessionDraftItem[] {
  return rows.filter((row) => row.selected).map((row) => row.draft);
}

/**
 * "Chọn tất cả" when any choosable draft is unticked, else "Bỏ chọn tất cả":
 * sets every choosable draft at once. Blocked drafts (holiday, duplicate,
 * out of window) keep their own tick so removing a holiday restores what the
 * user had.
 */
export function toggleAllChoosableDrafts(
  drafts: readonly BatchSessionDraftItem[],
  rows: readonly BatchPreviewRow[],
): BatchSessionDraftItem[] {
  const blockedIds = new Set(rows.filter((row) => row.blocked).map((row) => row.draft.id));
  const select = rows.some((row) => !row.blocked && !row.selected);
  return drafts.map((draft) => (blockedIds.has(draft.id) ? draft : { ...draft, selected: select }));
}

/** True when at least one choosable draft is unticked (the toggle then reads "Chọn tất cả"). */
export function hasUnselectedChoosableDraft(rows: readonly BatchPreviewRow[]): boolean {
  return rows.some((row) => !row.blocked && !row.selected);
}

/** Adds a valid `YYYY-MM-DD` holiday; the list stays sorted and unique. Invalid or empty input changes nothing. */
export function addBatchHoliday(holidays: readonly string[], date: string): string[] {
  const value = date.trim();
  if (!isValidDateString(value) || holidays.includes(value)) return [...holidays];
  return [...holidays, value].sort();
}

export function removeBatchHoliday(holidays: readonly string[], date: string): string[] {
  return holidays.filter((holiday) => holiday !== date);
}

/** The disabled reason of the create button, or null when the selection can be sent. */
export function getBatchCreateBlockReason(selectedCount: number): string | null {
  if (selectedCount === 0) return BATCH_MIN_SESSIONS_MESSAGE;
  if (selectedCount > BATCH_MAX_SESSIONS_PER_REQUEST) return BATCH_MAX_SESSIONS_MESSAGE;
  return null;
}

/** Chip text: `T3 03/11` (short weekday + day/month, no year). */
export function formatBatchChipDate(draft: Pick<BatchSessionDraftItem, "sessionDate" | "weekday">): string {
  const [, month = "", day = ""] = draft.sessionDate.split("-");
  return `${VIETNAMESE_SHORT_WEEKDAYS[draft.weekday] ?? ""} ${day}/${month}`.trim();
}

/**
 * Accessible name of a draft's checkbox: `Chọn buổi học ngày 03/11/2026`,
 * plus ` lúc 17:30` when the date holds more than one draft so every name
 * stays unique.
 */
export function getBatchDraftCheckboxLabel(
  draft: Pick<BatchSessionDraftItem, "sessionDate" | "startTime">,
  options: { withTime?: boolean } = {},
): string {
  const time = options.withTime ? ` lúc ${draft.startTime.slice(0, 5)}` : "";
  return `Chọn buổi học ngày ${formatIsoDate(draft.sessionDate)}${time}`;
}

/** Dates holding more than one draft (two slots on one weekday): their chips and labels show the time. */
export function getDatesWithSeveralDrafts(rows: readonly BatchPreviewRow[]): Set<string> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.draft.sessionDate, (counts.get(row.draft.sessionDate) ?? 0) + 1);
  return new Set([...counts].filter(([, count]) => count > 1).map(([date]) => date));
}

/**
 * The session kind the RPC will record, read-only: the calculation derives it
 * from the strategy (template → regular, custom → additional).
 */
export function getBatchSessionKindLabel(strategy: "template" | "custom"): { detail: string; kind: string } {
  return strategy === "template"
    ? { detail: "theo lịch cố định", kind: "Buổi chính" }
    : { detail: "lịch lặp tùy chỉnh", kind: "Buổi bổ sung" };
}
