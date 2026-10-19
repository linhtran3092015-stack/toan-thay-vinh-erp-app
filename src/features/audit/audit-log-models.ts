import type {
  AuditActor,
  AuditActorOption,
  AuditFilters,
  AuditLogEntry,
  AuditLogReadModel,
} from "@/features/audit/read-models";
import { formatIsoDate, getVietnamTime, toVietnamDate } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";
import { formatModuleLabel } from "@/lib/module-labels";
import type { Json } from "@/types/database.generated";

/**
 * Pure rules for /audit (design 16a row "Nhật ký"). `data.ts` (server-only)
 * imports the read caps and the filter normalisers from here, so the
 * /dev/lists preview, a client tree, can run the same parsing and the same
 * fixture copy of the query without pulling in the Supabase server client.
 * No server-only or browser imports.
 */

/** `getAuditLogsResult` reads the newest rows by `occurred_at` with `.limit(AUDIT_LOG_ROW_LIMIT)` and an exact count. */
export const AUDIT_LOG_ROW_LIMIT = 100;
/** The filter options come from a separate, unfiltered read of the newest `AUDIT_FILTER_OPTION_ROW_LIMIT` rows. */
export const AUDIT_FILTER_OPTION_ROW_LIMIT = 1000;

/**
 * The route's gate and denial (RLS on `audit_logs` checks `audit.view` too),
 * shared with the /dev/lists preview so both show the same copy. A Next page
 * file may not export extra names, so it lives here.
 */
export const AUDIT_LOG_ACCESS = {
  permission: "audit.view",
  deniedTitle: "Không có quyền xem nhật ký hệ thống",
} as const;

/**
 * No filter applied. Typed as the full `AuditFilters`, so the compiler rejects
 * a missing or extra key; its keys are written in the filter bar's display
 * order because AUDIT_FILTER_KEYS is read from them.
 */
export const EMPTY_AUDIT_FILTERS: Readonly<AuditFilters> = {
  fromDate: "",
  toDate: "",
  module: "",
  action: "",
  actorId: "",
  entityType: "",
  entityId: "",
};

/**
 * Every filter key (= the GET param names, the URL contract of /audit) in the
 * filter bar's display order. Derived from EMPTY_AUDIT_FILTERS so it can never
 * miss a key. `countActiveAuditFilters` and the filter form's remount key read
 * it; the form spells its fields out one by one.
 */
export const AUDIT_FILTER_KEYS = Object.keys(EMPTY_AUDIT_FILTERS) as readonly (keyof AuditFilters)[];

// ---------------------------------------------------------------------------
// Moved verbatim from data.ts (the loader imports them back).
// ---------------------------------------------------------------------------

export function normalizeFilter(
  value: string | undefined,
  maximumLength = 120,
): string {
  return value?.trim().slice(0, maximumLength) ?? "";
}

export function normalizeDate(value: string | undefined): string {
  const normalized = normalizeFilter(value, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return "";
  }

  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }

  return normalized;
}

export function getNextCalendarDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  date.setUTCDate(date.getUTCDate() + 1);

  return date.toISOString().slice(0, 10);
}

export function getActorDisplayName(
  displayName: string | null,
  email: string,
): string {
  const normalizedName = displayName?.trim();

  return normalizedName || email.split("@")[0] || "Nhân sự trung tâm";
}

export function sortUnique(values: readonly (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .sort((left, right) => left.localeCompare(right, "vi"));
}

/** The loader's filter object: trimmed, length-capped values and real calendar dates only. */
export function normalizeAuditFilters(input: Partial<AuditFilters>): AuditFilters {
  return {
    action: normalizeFilter(input.action),
    actorId: normalizeFilter(input.actorId, 36),
    entityId: normalizeFilter(input.entityId, 160),
    entityType: normalizeFilter(input.entityType),
    fromDate: normalizeDate(input.fromDate),
    module: normalizeFilter(input.module),
    toDate: normalizeDate(input.toDate),
  };
}

/** "{name} · {email}" for a readable profile, else the raw actor id. */
export function getAuditActorOptionLabel(
  actorId: string,
  actor: AuditActor | undefined,
): string {
  return actor
    ? `${actor.displayName} · ${actor.email ?? actor.id}`
    : actorId;
}

// ---------------------------------------------------------------------------
// URL → filters (moved from the route).
// ---------------------------------------------------------------------------

export type AuditSearchValue = string | string[] | undefined;
export type AuditSearchParams =
  | Readonly<Record<string, AuditSearchValue>>
  | URLSearchParams;

/** Moved verbatim from `app/(app)/audit/page.tsx`: the first value of a repeated param. */
export function getSearchValue(value: AuditSearchValue): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

/**
 * The seven GET params as the route reads them (first value of a repeated
 * param, missing → ""). Values stay raw: `getAuditLogsResult` normalises them
 * (trim, length caps, real calendar dates). Accepts Next's `searchParams`
 * record or a `URLSearchParams` (the /dev/lists preview's `useSearchParams()`).
 */
export function parseAuditFilters(searchParams: AuditSearchParams): AuditFilters {
  const read = (name: keyof AuditFilters): string =>
    searchParams instanceof URLSearchParams
      ? searchParams.get(name) ?? ""
      : getSearchValue(Object.hasOwn(searchParams, name) ? searchParams[name] : undefined);

  return {
    action: read("action"),
    actorId: read("actorId"),
    entityId: read("entityId"),
    entityType: read("entityType"),
    fromDate: read("fromDate"),
    module: read("module"),
    toDate: read("toDate"),
  };
}

/** Number of non-empty filters (the loader already dropped invalid dates), for "Xóa lọc (n)". */
export function countActiveAuditFilters(filters: AuditFilters): number {
  return AUDIT_FILTER_KEYS.filter((key) => filters[key] !== "").length;
}

/** Both dates set and "Từ ngày" after "Đến ngày": the read runs and matches nothing. */
export function isAuditDateRangeInverted(filters: AuditFilters): boolean {
  return filters.fromDate !== "" && filters.toDate !== "" && filters.fromDate > filters.toDate;
}

// ---------------------------------------------------------------------------
// Header copy.
// ---------------------------------------------------------------------------

/**
 * `totalCount` is the exact count of rows matching the filters (server);
 * `shown` is the rows loaded (≤ AUDIT_LOG_ROW_LIMIT, newest first).
 */
export function getAuditCountLine(totalCount: number, shown: number, filtered: boolean): string {
  const total = filtered
    ? `${formatNumber(totalCount)} bản ghi khớp bộ lọc`
    : `${formatNumber(totalCount)} bản ghi`;

  return shown > 0 ? `${total} · hiển thị ${formatNumber(shown)} mới nhất` : total;
}

export const AUDIT_READ_ONLY_NOTE = "Chỉ đọc: nhật ký không sửa hoặc xóa được từ ứng dụng.";
export const AUDIT_OLDER_ROWS_NOTE = "Thu hẹp bộ lọc để xem bản ghi cũ hơn.";

export const AUDIT_FILTER_CAPTION = `Ngày theo giờ Việt Nam · tùy chọn lấy từ ${formatNumber(AUDIT_FILTER_OPTION_ROW_LIMIT)} bản ghi mới nhất.`;

// ---------------------------------------------------------------------------
// Labels.
// ---------------------------------------------------------------------------

/** Moved from the page: `student_import` → "Student import". Actions and entity types have no Vietnamese vocabulary. */
export function humanizeCode(value: string): string {
  const normalized = value.replaceAll("_", " ").trim();

  if (!normalized) {
    return "Không xác định";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatAuditEntityType(entityType: string | null): string {
  return entityType ? humanizeCode(entityType) : "Không xác định";
}

export const AUDIT_ENTITY_ID_FALLBACK = "Không có mã";

export interface AuditSelectOption {
  label: string;
  value: string;
}

export interface AuditSelectOptions {
  actions: AuditSelectOption[];
  actors: AuditSelectOption[];
  entityTypes: AuditSelectOption[];
  modules: AuditSelectOption[];
}

/** Suffix of an option kept only because the URL filters by it (outside the newest-rows option window). */
export const AUDIT_ACTIVE_OPTION_SUFFIX = " (đang lọc)";

function withActiveValue(
  options: AuditSelectOption[],
  active: string,
  label: (value: string) => string,
): AuditSelectOption[] {
  if (!active || options.some((option) => option.value === active)) {
    return options;
  }

  return [...options, { label: `${label(active)}${AUDIT_ACTIVE_OPTION_SUFFIX}`, value: active }];
}

/**
 * Select options as labels: modules in Vietnamese (`formatModuleLabel`,
 * sorted by label), actions and entity types humanised, actors
 * "{name} · {email}" (the loader's label). An active filter missing from
 * its options (older than the option window, or typed in the URL) is
 * appended so the select shows what is applied instead of "Tất cả".
 */
export function getAuditSelectOptions(
  model: Pick<AuditLogReadModel, "filters" | "options">,
): AuditSelectOptions {
  const { filters, options } = model;
  const modules = options.modules
    .map((value) => ({ label: formatModuleLabel(value), value }))
    .sort((left, right) => left.label.localeCompare(right.label, "vi"));
  const humanised = (values: readonly string[]) =>
    values.map((value) => ({ label: humanizeCode(value), value }));
  const actors = options.actors.map((actor: AuditActorOption) => ({ label: actor.label, value: actor.id }));

  return {
    actions: withActiveValue(humanised(options.actions), filters.action, humanizeCode),
    actors: withActiveValue(actors, filters.actorId, (value) => value),
    entityTypes: withActiveValue(humanised(options.entityTypes), filters.entityType, humanizeCode),
    modules: withActiveValue(modules, filters.module, formatModuleLabel),
  };
}

// ---------------------------------------------------------------------------
// Rows.
// ---------------------------------------------------------------------------

export const AUDIT_SYSTEM_ACTOR_LABEL = "Hệ thống";
export const AUDIT_SYSTEM_ACTOR_CAPTION = "ghi tự động từ database";
export const AUDIT_UNREADABLE_ACTOR_LABEL = "Không đọc được hồ sơ";
export const AUDIT_AUTO_LOCK_ACTION = "class_session_auto_locked";
export const AUDIT_AUTO_LOCK_CAPTION = "khóa tự động";

export interface AuditActorPresentation {
  /** Extra caption for rows a worker wrote under a person's id (auto-lock names the session's completer). */
  automaticCaption: string | null;
  detail: string;
  /** The detail is a raw id (mono), not an e-mail or a sentence. */
  detailIsCode: boolean;
  kind: "system" | "profile" | "unreadable";
  name: string;
}

/**
 * `actor_user_id` null → the database wrote the row (cron, service role,
 * migration): "Hệ thống". An id whose profile the viewer cannot read (RLS:
 * own row or `staff.view`) is a person, never "Hệ thống": "Không đọc được
 * hồ sơ" + the uuid.
 */
export function getAuditActorPresentation(
  entry: Pick<AuditLogEntry, "action" | "actor" | "actorUserId">,
): AuditActorPresentation {
  const automaticCaption = entry.action === AUDIT_AUTO_LOCK_ACTION ? AUDIT_AUTO_LOCK_CAPTION : null;

  if (!entry.actorUserId) {
    return {
      automaticCaption,
      detail: AUDIT_SYSTEM_ACTOR_CAPTION,
      detailIsCode: false,
      kind: "system",
      name: AUDIT_SYSTEM_ACTOR_LABEL,
    };
  }

  if (!entry.actor) {
    return {
      automaticCaption,
      detail: entry.actorUserId,
      detailIsCode: true,
      kind: "unreadable",
      name: AUDIT_UNREADABLE_ACTOR_LABEL,
    };
  }

  return {
    automaticCaption,
    detail: entry.actor.email ?? entry.actor.id,
    detailIsCode: entry.actor.email === null,
    kind: "profile",
    name: entry.actor.displayName,
  };
}

export interface AuditTimestamp {
  /** `16/10/2026` (Vietnam date). */
  date: string;
  /** `10:05:09 16/10/2026`, the vi-VN order (time first), for titles and accessible names. */
  full: string;
  /** `10:05:09` (Vietnam time, with seconds). */
  time: string;
}

/** `occurred_at` in Vietnam time with seconds; an unparsable value is shown as stored. */
export function formatAuditTimestamp(value: string): AuditTimestamp {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { date: value, full: value, time: "" };
  }

  const day = formatIsoDate(toVietnamDate(date));
  const time = getVietnamTime(date);

  return { date: day, full: `${time} ${day}`, time };
}

/** Pretty JSON, verbatim (never summarised). Moved from the page. */
export function stringifyAuditJson(value: Json): string {
  return JSON.stringify(value, null, 2) ?? String(value);
}

/** `metadata` defaults to `{}` in the table: an empty object (or null) gets no panel. */
export function hasAuditMetadata(value: Json): boolean {
  if (value === null) return false;
  if (typeof value === "object" && !Array.isArray(value)) return Object.keys(value).length > 0;
  return true;
}

/** "của {action} lúc {time}": names which entry a repeated control belongs to. */
export function getAuditEntryContext(entry: Pick<AuditLogEntry, "action" | "occurredAt">): string {
  return `của ${humanizeCode(entry.action)} lúc ${formatAuditTimestamp(entry.occurredAt).full}`;
}

/**
 * Tail of a row's "Trước / Sau" button name: with the visible "Xem" / "Ẩn" it
 * reads "Xem dữ liệu trước / sau của {action} lúc {time}".
 */
export function getAuditDataToggleContext(entry: Pick<AuditLogEntry, "action" | "occurredAt">): string {
  return `dữ liệu trước / sau ${getAuditEntryContext(entry)}`;
}
