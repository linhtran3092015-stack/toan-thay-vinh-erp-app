import { permissionLabel } from "@/lib/permissions/labels";
import { formatIsoDate, toVietnamDate } from "@/lib/datetime";

import type {
  CrmCaseDetailReadModel,
  CrmCaseStatus,
  CrmLeadItemReadModel,
  CrmTrialBookingReadModel,
  EnrollmentChecklistReadModel,
} from "./read-models";

/** The six CRM statuses in lifecycle order (chips, filters, counts). */
export const CRM_CASE_STATUSES = [
  "interested",
  "trial_booked",
  "trial_completed",
  "pending_enrollment_confirmation",
  "converted",
  "dropped",
] as const satisfies readonly CrmCaseStatus[];

export const crmStatusLabels: Record<CrmCaseStatus, string> = {
  converted: "Đã nhập học",
  dropped: "Đã dừng",
  interested: "Đang quan tâm",
  pending_enrollment_confirmation: "Chờ xác nhận nhập học",
  trial_booked: "Đã đặt học thử",
  trial_completed: "Đã học thử",
};

/** CRM keeps its own short mode words (design 12): Online / Offline. */
export function formatCrmMode(mode: string | null | undefined): string {
  if (mode === "online") return "Online";
  if (mode === "offline") return "Offline";
  if (mode === "hybrid") return "Kết hợp";
  return "Chưa xác định";
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Business date `YYYY-MM-DD`: date-only values as-is, timestamps in Vietnam time. */
export function toCrmBusinessDate(value: string): string {
  if (DATE_ONLY.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : toVietnamDate(date);
}

/** `dd/mm/yyyy` for a date or timestamp; "—" when missing. */
export function formatCrmDate(value: string | null | undefined): string {
  return value ? formatIsoDate(toCrmBusinessDate(value)) : "—";
}

/** `dd/mm` for a date or timestamp. */
export function formatCrmDayMonth(value: string): string {
  const [, month, day] = toCrmBusinessDate(value).split("-");
  return `${day}/${month}`;
}

function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  const from = Date.parse(`${fromIsoDate}T00:00:00Z`);
  const to = Date.parse(`${toIsoDate}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

const DROP_REASON_MAX = 24;

/**
 * `status_changed_at` came with migration 20261013100000_phase2b_crm_closed_loop
 * (committed 2026-10-11) as `default now()` without a backfill, so every lead
 * that already existed carries the time the migration was applied instead of
 * its real status change. This is the business date (Vietnam day) of the first
 * full day after the migration could have been applied.
 */
export const CRM_STATUS_TRACKING_SINCE = "2026-10-14";

/**
 * `statusChangedAt` when it records a real status change, `null` when it may
 * be the migration's default on a legacy lead. A lead inserted after the
 * migration gets `created_at` and `status_changed_at` from the same `now()`
 * (create_crm_case sets neither), so equal values are a real initial status
 * time; before CRM_STATUS_TRACKING_SINCE, a value on a lead created earlier
 * that differs from `created_at` cannot be told apart from the default.
 */
export function getTrustedStatusChangedAt(
  item: { createdAt: string; statusChangedAt?: string | null },
): string | null {
  if (!item.statusChangedAt) return null;
  const isUntrusted = toCrmBusinessDate(item.createdAt) < CRM_STATUS_TRACKING_SINCE
    && toCrmBusinessDate(item.statusChangedAt) < CRM_STATUS_TRACKING_SINCE
    && Date.parse(item.statusChangedAt) !== Date.parse(item.createdAt);
  return isUntrusted ? null : item.statusChangedAt;
}

/**
 * Status badge suffix on the lead list (design 12a): days a lead has been
 * "Đang quan tâm", the earliest scheduled trial, the conversion day, or the
 * (truncated) drop reason. Read-only fields; `null` when there is nothing to add.
 */
export function getCrmStatusSuffix(
  item: Pick<CrmLeadItemReadModel, "createdAt" | "dropReason" | "nextTrialDate" | "status" | "statusChangedAt">,
  todayIso: string,
): string | null {
  switch (item.status) {
    case "interested": {
      const changedAt = getTrustedStatusChangedAt(item);
      if (!changedAt) return null;
      const days = daysBetween(toCrmBusinessDate(changedAt), todayIso);
      return days >= 1 ? `${days} ngày` : null;
    }
    case "trial_booked":
      return item.nextTrialDate ? formatCrmDayMonth(item.nextTrialDate) : null;
    case "converted": {
      const changedAt = getTrustedStatusChangedAt(item);
      return changedAt ? formatCrmDayMonth(changedAt) : null;
    }
    case "dropped": {
      const reason = item.dropReason?.trim();
      if (!reason) return null;
      return reason.length > DROP_REASON_MAX ? `${reason.slice(0, DROP_REASON_MAX - 1).trimEnd()}…` : reason;
    }
    default:
      return null;
  }
}

/** Earliest still-scheduled trial date among a lead's bookings. */
export function getNextScheduledTrialDate(
  bookings: readonly { status: string | null; trial_date: string | null }[] | null | undefined,
): string | null {
  const dates = (bookings ?? [])
    .filter((booking) => booking.status === "scheduled" && booking.trial_date)
    .map((booking) => booking.trial_date as string)
    .sort();
  return dates[0] ?? null;
}

export const crmTrialStatusMeta: Record<string, { label: string; tone: "info" | "neutral" | "success" | "warning" }> = {
  attended: { label: "Đã đến học thử", tone: "success" },
  cancelled: { label: "Đã hủy", tone: "neutral" },
  no_show: { label: "Vắng", tone: "warning" },
  scheduled: { label: "Đã đặt lịch", tone: "info" },
};

export function getCrmTrialStatusMeta(status: string) {
  return Object.hasOwn(crmTrialStatusMeta, status)
    ? crmTrialStatusMeta[status]
    : { label: status, tone: "neutral" as const };
}

/* Sale owner names ------------------------------------------------------- */

/** No sale owner on the lead (`sale_owner_id` is null). */
export const CRM_UNASSIGNED_SALE_LABEL = "Chưa phân công";
/**
 * profiles RLS hides other staff's display_name from roles without
 * staff.view, so a set owner id can come back without a name.
 */
export const CRM_HIDDEN_SALE_OWNER_NAME = "Sale khác (không xem được tên)";
export const CRM_HIDDEN_PREVIOUS_SALE_OWNER_NAME = "Sale trước (không xem được tên)";
export const CRM_HIDDEN_NEW_SALE_OWNER_NAME = "Sale mới (không xem được tên)";

/** The lead's sale owner as shown: the name, a hidden-name label for a set id, or "Chưa phân công". */
export function getCrmSaleOwnerName(saleOwnerId: string | null | undefined, displayName: string | null | undefined): string {
  if (!saleOwnerId) return CRM_UNASSIGNED_SALE_LABEL;
  return displayName ?? CRM_HIDDEN_SALE_OWNER_NAME;
}

const assignmentMethodLabels: Record<string, string> = {
  auto_round_robin: "Tự động chia đều",
  manual_assign: "Phân công tay",
  manual_transfer: "Chuyển giao",
  self_claim: "Tự nhận",
};

export function formatAssignmentMethod(method: string): string {
  return Object.hasOwn(assignmentMethodLabels, method) ? assignmentMethodLabels[method] : method;
}

/* Lifecycle rail (design 12b) ------------------------------------------- */

export type CrmLifecycleStepState = "done" | "current" | "upcoming" | "skipped" | "dropped";

export interface CrmLifecycleStep {
  key: CrmCaseStatus;
  label: string;
  state: CrmLifecycleStepState;
  /** Date or timestamp the step was reached, when the data records it. */
  date: string | null;
  /** Extra line, e.g. the drop reason. */
  note?: string | null;
}

const MAIN_PATH = [
  "interested",
  "trial_booked",
  "trial_completed",
  "pending_enrollment_confirmation",
  "converted",
] as const satisfies readonly CrmCaseStatus[];

type LifecycleInput = Pick<
  CrmCaseDetailReadModel,
  "createdAt" | "dropReason" | "droppedAt" | "status" | "statusChangedAt" | "studentId"
> & {
  /** The conversion RPC stamps completedAt; it dates "Đã nhập học" when present. */
  checklist?: Pick<EnrollmentChecklistReadModel, "completedAt"> | null;
  trialBookings: Pick<CrmTrialBookingReadModel, "createdAt" | "resultRecordedAt" | "status">[];
};

function earliest(values: (string | null | undefined)[]): string | null {
  const present = values.filter((value): value is string => Boolean(value));
  if (present.length === 0) return null;
  return present.reduce((min, value) => (Date.parse(value) < Date.parse(min) ? value : min));
}

/**
 * Derives the vertical lifecycle from read-only fields: created_at, the first
 * booking, the first recorded attendance, the checklist completion for the
 * conversion, and a trusted status_changed_at for the current step when
 * nothing more specific exists (booking a trial does not move
 * status_changed_at; legacy defaults are ignored, see
 * getTrustedStatusChangedAt). A step the case went past without evidence (no
 * booking, no attended trial) is "skipped", never shown as done. A dropped
 * case keeps the steps it reached and ends with "Đã dừng".
 */
export function deriveCrmLifecycle(detail: LifecycleInput): CrmLifecycleStep[] {
  const bookings = detail.trialBookings;
  const attended = bookings.filter((booking) => booking.status === "attended");
  const evidence: Record<(typeof MAIN_PATH)[number], { reached: boolean; date: string | null }> = {
    converted: { date: detail.checklist?.completedAt ?? null, reached: detail.status === "converted" },
    interested: { date: detail.createdAt, reached: true },
    pending_enrollment_confirmation: {
      date: null,
      // Advancing to "Chờ xác nhận nhập học" is what creates the provisional student.
      reached: detail.status === "pending_enrollment_confirmation" || detail.status === "converted" || Boolean(detail.studentId),
    },
    trial_booked: { date: earliest(bookings.map((booking) => booking.createdAt)), reached: bookings.length > 0 },
    trial_completed: { date: earliest(attended.map((booking) => booking.resultRecordedAt ?? null)), reached: attended.length > 0 },
  };

  if (detail.status === "dropped") {
    const reached: CrmLifecycleStep[] = MAIN_PATH.filter((key) => evidence[key].reached).map((key) => ({
      date: evidence[key].date,
      key,
      label: crmStatusLabels[key],
      state: "done",
    }));
    return [
      ...reached,
      {
        date: detail.droppedAt ?? getTrustedStatusChangedAt(detail),
        key: "dropped",
        label: crmStatusLabels.dropped,
        note: detail.dropReason,
        state: "dropped",
      },
    ];
  }

  const currentIndex = MAIN_PATH.indexOf(detail.status as (typeof MAIN_PATH)[number]);

  return MAIN_PATH.map((key, index) => {
    const step = evidence[key];
    if (index === currentIndex) {
      // A lead back at "Đang quan tâm" (reopened, or returned after a no-show)
      // reached it again at its last status change, not at created_at.
      const date = key === "interested"
        ? getTrustedStatusChangedAt(detail) ?? step.date
        : step.date ?? getTrustedStatusChangedAt(detail);
      return { date, key, label: crmStatusLabels[key], state: "current" };
    }
    if (index < currentIndex) {
      return { date: step.date, key, label: crmStatusLabels[key], state: step.reached ? "done" : "skipped" };
    }
    return { date: null, key, label: crmStatusLabels[key], state: "upcoming" };
  });
}

/* Enrollment checklist (read-only summary) ------------------------------ */

type ChecklistKey = Exclude<keyof EnrollmentChecklistReadModel, "completedAt" | "completedByName" | "id" | "isFullyCompleted">;

export const CRM_CHECKLIST_ITEMS: readonly { key: ChecklistKey; label: string }[] = [
  { key: "item1PaymentReceived", label: "Đã nhận học phí" },
  { key: "item2SourceConfirmed", label: "Đã xác nhận nguồn lead" },
  { key: "item3SaleConfirmed", label: "Đã xác nhận sale chốt" },
  { key: "item4ClassSelected", label: "Đã chọn lớp chính" },
  { key: "item5ModeConfirmed", label: "Đã xác nhận online/offline" },
  { key: "item6FeeConfirmed", label: "Đã xác nhận học phí & ưu đãi" },
  { key: "item7AssistantSessionsConfirmed", label: "Trợ lý xác nhận số buổi" },
  { key: "item8AccountantTransactionConfirmed", label: "Kế toán xác nhận giao dịch" },
  { key: "item9OfficialStartDateEntered", label: "Đã nhập ngày học chính" },
  { key: "item10CommunicationGroupReady", label: "Sổ liên lạc / Zalo sẵn sàng" },
];

/** Item 8 without sepay.accountant_confirm: shared by the checklist panel and the conversion dialog. */
export const CRM_ACCOUNTANT_CONFIRM_HINT = `Người xác nhận chuyển đổi cần thêm quyền ${permissionLabel("sepay.accountant_confirm")}.`;

export interface CrmChecklistSummaryItem {
  done: boolean;
  /** Why an open item is not ticked by the sale alone. */
  hint: string | null;
  key: ChecklistKey;
  label: string;
  number: number;
}

export interface CrmChecklistSummary {
  done: number;
  initialized: boolean;
  items: CrmChecklistSummaryItem[];
  total: number;
}

export function summarizeCrmChecklist(
  checklist: EnrollmentChecklistReadModel | null,
  options: { hasAccountantPermission: boolean },
): CrmChecklistSummary {
  const items = CRM_CHECKLIST_ITEMS.map(({ key, label }, index) => {
    const done = Boolean(checklist?.[key]);
    let hint: string | null = null;
    if (!done && key === "item1PaymentReceived") {
      hint = "Đánh dấu trong hộp thoại xác nhận chuyển đổi khi phiếu thu tuyển mới đã thanh toán.";
    }
    if (!done && key === "item8AccountantTransactionConfirmed" && !options.hasAccountantPermission) {
      hint = CRM_ACCOUNTANT_CONFIRM_HINT;
    }
    return { done, hint, key, label, number: index + 1 };
  });
  return { done: items.filter((item) => item.done).length, initialized: checklist !== null, items, total: items.length };
}

/* Detail actions: existing gates + one primary -------------------------- */

export type CrmDetailPrimary = "convert" | "advance" | null;

export interface CrmDetailActionAvailability {
  advance: boolean;
  bookTrial: boolean;
  convert: boolean;
  /** Text shown when the conversion action is not offered (or `null`). */
  conversionReason: string | null;
  drop: boolean;
  editNotes: boolean;
  primary: CrmDetailPrimary;
  recordTrialResult: boolean;
  reopen: boolean;
  transfer: boolean;
}

/**
 * The detail page's existing permission/status gates, unchanged, plus the
 * single primary: confirming the conversion once the lead waits for it, else
 * moving the lead to "Chờ xác nhận nhập học", else none. Conversion is never
 * the primary without sepay.accountant_confirm: checklist item 8 stays locked
 * in the dialog, so the user can open it but not submit it.
 */
export function getCrmDetailActions({
  canConfirmOfficial,
  canTransfer,
  canUpdate,
  dropReason,
  droppedAt,
  hasAccountantPermission = true,
  status,
}: {
  canConfirmOfficial: boolean;
  canTransfer: boolean;
  canUpdate: boolean;
  /** Named in the dropped notice when present. */
  dropReason?: string | null;
  droppedAt?: string | null;
  /** sepay.accountant_confirm, needed to tick checklist item 8 and submit the conversion. */
  hasAccountantPermission?: boolean;
  status: CrmCaseStatus;
}): CrmDetailActionAvailability {
  const isOpen = status !== "converted" && status !== "dropped";
  const advance = canUpdate && (status === "interested" || status === "trial_booked" || status === "trial_completed");
  const convert = canConfirmOfficial && isOpen;
  const primary: CrmDetailPrimary = convert && hasAccountantPermission && status === "pending_enrollment_confirmation"
    ? "convert"
    : advance ? "advance" : null;

  let conversionReason: string | null = null;
  if (status === "dropped") {
    // The sentence adds its own period, so a reason typed with one does not end in "..".
    const reason = dropReason?.trim().replace(/[.!?…]+$/u, "").trimEnd();
    const dropped = `Lead đã dừng${droppedAt ? ` ngày ${formatCrmDate(droppedAt)}` : ""}${reason ? `: ${reason}` : ""}.`;
    conversionReason = canUpdate
      ? `${dropped} Mở lại lead trước khi đặt học thử hoặc xác nhận chuyển đổi.`
      : `${dropped} Cần quyền ${permissionLabel("crm.update")} để mở lại.`;
  } else if (isOpen && !canConfirmOfficial) {
    conversionReason = `Xác nhận chuyển đổi cần quyền ${permissionLabel("students.confirm_official")}.`;
  } else if (convert && !hasAccountantPermission) {
    conversionReason = CRM_ACCOUNTANT_CONFIRM_HINT;
  }

  return {
    advance,
    bookTrial: canUpdate && isOpen,
    conversionReason,
    convert,
    drop: canUpdate && isOpen,
    editNotes: canUpdate && status !== "converted",
    primary,
    recordTrialResult: canUpdate && isOpen,
    reopen: canUpdate && status === "dropped",
    transfer: canTransfer && status !== "converted",
  };
}
