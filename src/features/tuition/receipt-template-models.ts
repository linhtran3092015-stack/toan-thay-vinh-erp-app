/**
 * Mẫu Phiếu học phí (design 15b, `/finance/tuition-periods/templates`): pure
 * helpers shared by the templates route, TuitionTemplateManagement and the
 * `/dev/fee-notices` preview.
 *
 * What is truthful here: the lock snapshots the latest version by
 * `published_at`, so the first version newest-first is the one "đang dùng";
 * locked periods name the version they snapshotted; drafts carry no version id
 * and take the latest one when they lock. `published_by` is null for the
 * seeded v1, and a publisher's profile is hidden by RLS from anyone without
 * `staff.view` (except their own).
 */
import type { FeeNoticeTemplateContent } from "@/features/tuition/fee-notice-model";
import { formatIsoDate, getVietnamTime, toVietnamDate } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";

/** The only template the app publishes (`publishTuitionTemplateAction` always sends this code). */
export const TUITION_NOTICE_TEMPLATE_CODE = "TUITION_NOTICE_DEFAULT";

/** UI-only limits (the RPC stores any length). They bound each field, not the page count: a long announcement plus footer flows onto a second A5 page. */
export const TEMPLATE_FIELD_LIMITS = {
  announcement: 1000,
  centerDisplayName: 120,
  footer: 300,
  reason: 500,
  title: 120,
} as const;

const SYSTEM_PUBLISHER = "Hệ thống";
const HIDDEN_PUBLISHER = "người khác (không xem được tên)";
const MAX_NAMED_PERIODS = 3;

/** `tuition_receipt_template_versions` row with the publisher's profile embedded (`publisher:profiles!…_published_by_fkey(display_name)`). */
export interface TuitionTemplateVersionRow {
  content: unknown;
  id: string;
  published_at: string;
  published_by: string | null;
  /** null when `published_by` is null or RLS hides the profile; PostgREST may hand back a one-row array. */
  publisher: { display_name: string | null } | { display_name: string | null }[] | null;
  reason: string;
  version_number: number;
}

/** `tuition_collection_periods` columns the usage line reads. */
export interface TuitionTemplatePeriodRow {
  id: string;
  name: string;
  receipt_template_version_id: string | null;
  status: string;
}

/** Editable template text, in the server action's input names. */
export interface TuitionTemplateFormValues {
  announcement: string;
  centerDisplayName: string;
  footer: string;
  title: string;
}

export interface TuitionTemplateVersion {
  content: TuitionTemplateFormValues;
  id: string;
  /** ISO timestamp. */
  publishedAt: string;
  /** display_name, "Hệ thống" (no publisher) or "người khác (không xem được tên)" (profile not readable). */
  publisherName: string;
  reason: string;
  version: number;
}

export interface TuitionTemplateUsage {
  /** Locked periods whose notices were snapshotted from the current version, in read order. */
  lockedPeriodNames: string[];
  /** Drafts without a pinned version: they take the latest version when they lock. */
  draftCount: number;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

/** Stored content (`center_display_name`, …) → form values; missing or non-text keys read as "". */
export function readTemplateFormValues(content: unknown): TuitionTemplateFormValues {
  const record = content && typeof content === "object" && !Array.isArray(content) ? (content as Record<string, unknown>) : {};
  return {
    announcement: readString(record, "announcement"),
    centerDisplayName: readString(record, "center_display_name"),
    footer: readString(record, "footer"),
    title: readString(record, "title"),
  };
}

/** Form values → the stored keys FeeNoticeA5's sample model reads. */
export function toTemplateContent(values: TuitionTemplateFormValues): FeeNoticeTemplateContent {
  return {
    announcement: values.announcement,
    center_display_name: values.centerDisplayName,
    footer: values.footer,
    title: values.title,
  };
}

/** Values as they are sent and compared: ends trimmed, inner line breaks kept. */
export function normalizeTemplateFormValues(values: TuitionTemplateFormValues): TuitionTemplateFormValues {
  return {
    announcement: values.announcement.trim(),
    centerDisplayName: values.centerDisplayName.trim(),
    footer: values.footer.trim(),
    title: values.title.trim(),
  };
}

export function getTemplatePublisherName(row: Pick<TuitionTemplateVersionRow, "published_by" | "publisher">): string {
  if (!row.published_by) return SYSTEM_PUBLISHER;
  const profile = Array.isArray(row.publisher) ? row.publisher[0] : row.publisher;
  const name = profile?.display_name?.trim();
  return name ? name : HIDDEN_PUBLISHER;
}

/** Rows as read (newest first) → view models, order kept. */
export function toTuitionTemplateVersions(rows: readonly TuitionTemplateVersionRow[]): TuitionTemplateVersion[] {
  return rows.map((row) => ({
    content: readTemplateFormValues(row.content),
    id: row.id,
    publishedAt: row.published_at,
    publisherName: getTemplatePublisherName(row),
    reason: row.reason,
    version: row.version_number,
  }));
}

/** The number the RPC gives the next publish: max + 1 (one template), v1 when none exists. */
export function getNextTemplateVersion(versions: readonly Pick<TuitionTemplateVersion, "version">[]): number {
  return versions.reduce((max, version) => Math.max(max, version.version), 0) + 1;
}

function isValidTimestamp(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}

/** ISO timestamp → "25/09/2026 10:12" in Vietnam time (unparseable values are shown as-is). */
export function formatTemplatePublishedAt(value: string): string {
  if (!isValidTimestamp(value)) return value;
  return `${formatIsoDate(toVietnamDate(value))} ${getVietnamTime(new Date(value)).slice(0, 5)}`;
}

/** ISO timestamp → "25/09/2026" (Vietnam date). */
export function formatTemplatePublishedOn(value: string): string {
  return isValidTimestamp(value) ? formatIsoDate(toVietnamDate(value)) : value;
}

/** Which periods use the current version: locked ones by snapshot, drafts by the lock's "latest" rule. */
export function summarizeTemplateUsage(
  periods: readonly TuitionTemplatePeriodRow[],
  currentVersionId: string | null,
): TuitionTemplateUsage {
  return {
    draftCount: periods.filter((period) => period.status === "draft" && period.receipt_template_version_id === null).length,
    lockedPeriodNames: currentVersionId
      ? periods
          .filter((period) => period.status === "locked" && period.receipt_template_version_id === currentVersionId)
          .map((period) => period.name)
      : [],
  };
}

/**
 * "Kỳ đã khóa dùng v3: A, B, C và 2 kỳ khác · 1 kỳ nháp sẽ dùng phiên bản mới
 * nhất khi khóa". Periods are named (there is no period code).
 */
export function formatTemplateUsage(usage: TuitionTemplateUsage, version: number): string {
  const parts: string[] = [];
  const names = usage.lockedPeriodNames;
  if (names.length > 0) {
    const shown = names.slice(0, MAX_NAMED_PERIODS).join(", ");
    const rest = names.length - MAX_NAMED_PERIODS;
    parts.push(`Kỳ đã khóa dùng v${version}: ${shown}${rest > 0 ? ` và ${formatNumber(rest)} kỳ khác` : ""}`);
  }
  if (usage.draftCount > 0) {
    parts.push(`${formatNumber(usage.draftCount)} kỳ nháp sẽ dùng phiên bản mới nhất khi khóa`);
  }
  return parts.length > 0 ? parts.join(" · ") : `Chưa có kỳ thu nào dùng v${version}.`;
}

function sameTemplateContent(a: TuitionTemplateFormValues, b: TuitionTemplateFormValues): boolean {
  const left = normalizeTemplateFormValues(a);
  const right = normalizeTemplateFormValues(b);
  return (
    left.announcement === right.announcement &&
    left.centerDisplayName === right.centerDisplayName &&
    left.footer === right.footer &&
    left.title === right.title
  );
}

/**
 * Why "Xuất bản" is disabled, or null when it may publish. Order: nothing to
 * publish, then the fields the old form required (title, centre, footer),
 * then the reason the RPC requires.
 */
export function getTemplatePublishBlockedReason(
  values: TuitionTemplateFormValues,
  reason: string,
  current: Pick<TuitionTemplateVersion, "content" | "version"> | null,
): string | null {
  if (current && sameTemplateContent(values, current.content)) return `Chưa có thay đổi so với v${current.version}.`;
  const normalized = normalizeTemplateFormValues(values);
  if (!normalized.title || !normalized.centerDisplayName || !normalized.footer) return "Điền tiêu đề, tên trung tâm và chân trang.";
  if (!reason.trim()) return "Nhập lý do xuất bản.";
  return null;
}
