import type { BadgeTone } from "@/components/ui/badge";
import { labelFrom } from "@/features/imports/components/import-labels";
import type { ImportRowSeverity } from "@/features/imports/components/import-review-table";
import type {
  SessionBalanceImportBatchListItem,
  SessionBalanceImportBatchStatus,
  SessionBalanceImportRowStatus,
} from "@/features/imports/session-balances/types";

/*
 * Wording of the session-balance import (design 17c) in one pure, server-safe
 * place: row and batch status words, the Vietnamese text for the dry-run
 * validation codes and number formats. Every lookup is prototype-safe
 * (`labelFrom` → `Object.hasOwn`), so an unknown code falls back to words
 * instead of printing an inherited property.
 */

/**
 * Dry-run validation codes (`dry_run_session_balance_import_rows`,
 * migration 20260808100000) → Vietnamese. The server's own messages are
 * ASCII without diacritics; they stay the fallback for a code not listed here.
 */
export const SESSION_BALANCE_VALIDATION_MESSAGES: Readonly<Record<string, string>> = {
  BALANCE_HAS_FRACTIONAL_PART: "Số dư có phần lẻ; sổ buổi chỉ ghi số nguyên và không làm tròn.",
  BALANCE_IS_ZERO: "Số dư bằng 0, không tạo bút toán.",
  NO_ACTIVE_ENROLLMENT: "Học viên chưa có ghi danh đang hoạt động; kiểm tra trước khi nhập.",
  OK: "Sẵn sàng ghi sổ khi lô được duyệt.",
  SOURCE_BALANCE_INVALID: "Số dư buổi trống hoặc không phải là số.",
  STUDENT_CODE_AMBIGUOUS: "Mã học viên trùng với nhiều học viên.",
  STUDENT_NOT_FOUND: "Không tìm thấy học viên có mã này.",
  STUDENT_PUBLIC_CODE_REQUIRED: "Thiếu mã học viên.",
};

const NO_SERVER_MESSAGE = "Máy chủ không gửi thông báo cho dòng này.";

/** Vietnamese text for a validation code; the server's raw message (or a neutral sentence) for an unknown code. */
export function getSessionBalanceValidationMessage(code: string | null | undefined, rawMessage: string | null | undefined): string {
  return labelFrom(SESSION_BALANCE_VALIDATION_MESSAGES, code, () => rawMessage?.trim() || NO_SERVER_MESSAGE);
}

export const SESSION_BALANCE_ROW_STATUS_LABELS: Readonly<Record<SessionBalanceImportRowStatus, string>> = {
  excluded: "Đã loại",
  invalid: "Không hợp lệ",
  no_change: "Không thay đổi",
  posted: "Đã ghi sổ",
  review: "Cần xem lại",
  valid: "Hợp lệ",
};

export function getSessionBalanceRowStatusLabel(status: string | null | undefined): string {
  return labelFrom(SESSION_BALANCE_ROW_STATUS_LABELS, status, (code) => `Trạng thái chưa hỗ trợ: ${code || "trống"}`);
}

const ROW_SEVERITY: Readonly<Record<SessionBalanceImportRowStatus, ImportRowSeverity>> = {
  excluded: "neutral",
  invalid: "error",
  no_change: "neutral",
  posted: "valid",
  review: "warning",
  valid: "valid",
};

/** Review-table severity: invalid blocks (error), review needs a decision (warning), the rest needs nothing. An unknown status is flagged. */
export function getSessionBalanceRowSeverity(status: string | null | undefined): ImportRowSeverity {
  const key = status ?? "";
  return Object.hasOwn(ROW_SEVERITY, key) ? ROW_SEVERITY[key as SessionBalanceImportRowStatus] : "warning";
}

export interface SessionBalanceRowIssueSource {
  excluded_reason?: string | null;
  validation_code: string | null;
  validation_message: string | null;
  validation_status: string;
}

/**
 * The issue cell of a row, in words: "{status}: {message}" for a flagged or
 * unchanged row, the exclusion reason for an excluded row, "Đã ghi sổ." for a
 * posted row; `null` for a valid row (its "Hợp lệ" badge says it all).
 */
export function getSessionBalanceRowIssue(row: SessionBalanceRowIssueSource): string | null {
  const status = row.validation_status;
  if (status === "valid") return null;
  if (status === "posted") return "Đã ghi sổ.";
  if (status === "excluded") return `Đã loại: ${row.excluded_reason?.trim() || "không ghi lý do."}`;
  return `${getSessionBalanceRowStatusLabel(status)}: ${getSessionBalanceValidationMessage(row.validation_code, row.validation_message)}`;
}

const BATCH_STATUS: Readonly<Record<SessionBalanceImportBatchStatus, { label: string; tone: BadgeTone }>> = {
  approved: { label: "Đã phê duyệt", tone: "info" },
  awaiting_approval: { label: "Đang chờ phê duyệt", tone: "warning" },
  awaiting_reconciliation: { label: "Đang chờ đối soát", tone: "warning" },
  draft: { label: "Nháp", tone: "neutral" },
  posted: { label: "Đã ghi sổ", tone: "success" },
  previewed: { label: "Đã xem trước", tone: "neutral" },
  rejected: { label: "Đã từ chối", tone: "danger" },
};

/** Batch status word and badge tone; an unknown status keeps its code visible. */
export function getSessionBalanceBatchStatus(status: string | null | undefined): { label: string; tone: BadgeTone } {
  const key = status ?? "";
  if (Object.hasOwn(BATCH_STATUS, key)) return BATCH_STATUS[key as SessionBalanceImportBatchStatus];
  return { label: `Trạng thái chưa hỗ trợ: ${key || "trống"}`, tone: "neutral" };
}

/**
 * The list's status word for the person looking at it. A batch waiting for
 * approval reads "Chờ đối tác duyệt (Maker)" for its creator (the screen keeps
 * the four-eyes rule), "Chờ bạn duyệt" for someone who may approve it, and
 * "Đang chờ phê duyệt" for anyone else.
 */
export function getSessionBalanceBatchListStatus(
  batch: Pick<SessionBalanceImportBatchListItem, "created_by" | "status">,
  viewer: { canApprove: boolean; currentUserId: string | null },
): { label: string; tone: BadgeTone } {
  if (batch.status === "awaiting_approval") {
    if (viewer.currentUserId === batch.created_by) return { label: "Chờ đối tác duyệt (Maker)", tone: "warning" };
    if (viewer.canApprove) return { label: "Chờ bạn duyệt", tone: "warning" };
  }
  return getSessionBalanceBatchStatus(batch.status);
}

const balanceFormatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 });

/** A balance as given (never rounded to an integer): 7.5 → "7,5", -2 → "-2"; empty → "—". */
export function formatSessionBalance(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : balanceFormatter.format(value);
}

/** A ledger delta with its sign: 10 → "+10", -2 → "-2", 0 → "0"; empty → "—". */
export function formatSignedSessions(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value > 0 ? `+${balanceFormatter.format(value)}` : balanceFormatter.format(value);
}
