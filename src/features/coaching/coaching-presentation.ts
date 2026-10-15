import type { BadgeTone } from "@/components/ui/badge";
import { VIETNAM_TIME_ZONE } from "@/lib/datetime";

import type { CoachingPriority, CoachingRecordEvent } from "./read-models";

/**
 * Presentation of the Coaching record and form builder (design 13c). Labels
 * the tests pin stay with their components (status badge, event actions,
 * link panel); this module holds the record page's own wording and
 * formatting, plus the priority wording the /coaching list and create dialog
 * share. Times render in Vietnam time whatever the server's zone.
 */

/**
 * Priority wording (design 13c: cao / vừa / thấp), shared by the /coaching
 * list badge, the record header and the create dialog so all say the same
 * thing.
 */
export const coachingPriorityPresentation: Record<CoachingPriority, { label: string; tone: BadgeTone }> = {
  high: { label: "Ưu tiên cao", tone: "danger" },
  low: { label: "Ưu tiên thấp", tone: "neutral" },
  medium: { label: "Ưu tiên vừa", tone: "warning" },
};

const PRIORITY_LABEL_PREFIX = "Ưu tiên ";

/**
 * Options of the create dialog's "Mức ưu tiên" select (low → high), derived
 * from the badge wording so the dialog cannot drift from the list and record
 * ("Ưu tiên vừa" → "Vừa").
 */
export const coachingPriorityOptions: ReadonlyArray<{ label: string; value: CoachingPriority }> = (
  ["low", "medium", "high"] as const
).map((value) => {
  const short = coachingPriorityPresentation[value].label.slice(PRIORITY_LABEL_PREFIX.length);
  return { label: `${short.charAt(0).toLocaleUpperCase("vi")}${short.slice(1)}`, value };
});

/**
 * Lookup that cannot return an Object.prototype member for a priority the
 * enum gains later (or "constructor"); such a value reads as medium, as the
 * record page always did.
 */
export function getCoachingPriorityPresentation(priority: string): { label: string; tone: BadgeTone } {
  return Object.hasOwn(coachingPriorityPresentation, priority)
    ? coachingPriorityPresentation[priority as CoachingPriority]
    : coachingPriorityPresentation.medium;
}

/**
 * Shown when a server action call itself fails (network drop, a deploy while
 * the tab was open): the call rejects instead of returning a state, and a
 * rejected call must never reach the error boundary and wipe what was typed.
 */
export const COACHING_CONNECTION_ERROR_MESSAGE = "Không thể kết nối hệ thống. Nội dung vẫn được giữ trên màn hình.";
export const PUBLIC_FORM_CONNECTION_ERROR_MESSAGE =
  "Chưa gửi được phiếu vì mất kết nối. Câu trả lời vẫn còn trên màn hình, vui lòng thử lại.";

export const coachingEventLabels: Record<CoachingRecordEvent["eventType"], string> = {
  note_added: "Ghi chú",
  opened: "Mở phiếu",
  outcome_recorded: "Kết quả",
  status_changed: "Đổi trạng thái",
};

const parts = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  timeZone: VIETNAM_TIME_ZONE,
  year: "numeric",
});

function vietnamParts(value: string | Date): Record<string, string> | null {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return Object.fromEntries(parts.formatToParts(date).map((part) => [part.type, part.value]));
}

/** ISO timestamp → `20/09/2026` (Vietnam time). */
export function formatCoachingDate(value: string): string {
  const p = vietnamParts(value);
  return p ? `${p.day}/${p.month}/${p.year}` : value;
}

/** ISO timestamp → `13/10 10:20` (Vietnam time), the timeline and link-row format. */
export function formatCoachingShortDateTime(value: string): string {
  const p = vietnamParts(value);
  return p ? `${p.day}/${p.month} ${p.hour}:${p.minute}` : value;
}

/** ISO timestamp → `13/10/2026 10:20` (Vietnam time). */
export function formatCoachingDateTime(value: string): string {
  const p = vietnamParts(value);
  return p ? `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}` : value;
}

/**
 * Instant → `YYYY-MM-DDTHH:mm` in Vietnam time, the value of a
 * `datetime-local` field. The server renders in UTC and the browser in
 * Vietnam time, and hydration keeps the server's field value: computing in
 * Vietnam time on both sides keeps the field and the state the same.
 */
export function formatCoachingDateTimeLocal(date: Date): string {
  const p = vietnamParts(date);
  return p ? `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` : "";
}

/** Vietnam has kept UTC+7 without daylight saving since 1975. */
const VIETNAM_UTC_OFFSET = "+07:00";

/**
 * A `datetime-local` value read as Vietnam wall time whatever the browser's
 * zone (`new Date(value)` would use the browser's) → the instant. Null unless
 * it is `YYYY-MM-DDTHH:mm[:ss]` naming a real minute: Date rolls 30/02 or
 * 24:00 over to the next day, so the value must read back unchanged.
 */
export function parseCoachingDateTimeLocal(value: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(:\d{2})?$/.exec(value);
  if (!match) return null;
  const date = new Date(`${match[1]}${match[2] ?? ":00"}${VIETNAM_UTC_OFFSET}`);
  return formatCoachingDateTimeLocal(date) === match[1] ? date : null;
}

/** `YYYY-MM-DD` review date → `20/10`, with the year when it differs from `referenceYear`. */
export function formatCoachingReviewDate(value: string, referenceYear?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return match[1] === referenceYear ? `${match[3]}/${match[2]}` : `${match[3]}/${match[2]}/${match[1]}`;
}

/**
 * First non-empty line of the reason, cut to `max` characters (the full text
 * stays in its own card). Counted in code points: a UTF-16 cut could split an
 * emoji and leave half a surrogate pair on screen.
 */
export function summarizeCoachingReason(reason: string, max = 80): string {
  const line = reason.split(/\r?\n/).find((item) => item.trim() !== "")?.trim() ?? "";
  const characters = Array.from(line);
  return characters.length > max ? `${characters.slice(0, max - 1).join("").trimEnd()}…` : line;
}

export interface CoachingTimelineEntry {
  event: CoachingRecordEvent;
  /** Status before this event, from the closest earlier event that carries one (events store only the new status). */
  previousStatus: string | null;
}

/**
 * Newest first. The RPC returns events in recording order (event_sequence,
 * oldest first), so the previous status of each change is read while walking
 * forward and the list is then reversed.
 */
export function buildCoachingTimeline(events: readonly CoachingRecordEvent[]): CoachingTimelineEntry[] {
  let lastStatus: string | null = null;
  const forward = events.map((event) => {
    const entry = { event, previousStatus: lastStatus };
    if (event.status) lastStatus = event.status;
    return entry;
  });
  return forward.reverse();
}
