import type {
  SessionBalanceImportBatchDetail,
  SessionBalanceImportBatchListItem,
  SessionBalanceImportBatchRecord,
  SessionBalanceImportColumnMapping,
  SessionBalanceImportDryRunResult,
  SessionBalanceImportParsedWorkbook,
  SessionBalanceImportRowRecord,
  SessionBalanceImportRowResult,
} from "@/features/imports/session-balances/types";

import {
  IMPORTS_PREVIEW_TODAY,
  IMPORTS_PREVIEW_USERS,
  type BalanceBatchImportsPreviewState,
  type ImportsPreviewRole,
} from "./imports-preview-params";

/*
 * Fixtures of /dev/imports `view=balances` and `view=balance-batch` on the
 * fixed clock (2026-10-19, Vietnam). Codes and messages are the real
 * dry-run vocabulary (migration 20260808100000): ASCII server messages that
 * the pages map to Vietnamese by `validation_code`. One batch per stage; the
 * "own" batch is created by the previewed role's own user, the others by a
 * fourth account so the maker / approver / own-batch cases differ only by who
 * is looking.
 */

/** A fourth account (neither previewed role): creator of the batches that are not "own". */
export const BALANCE_PREVIEW_OTHER_USER = { email: "anh@example.com", id: "dev-other", name: "Phạm Quốc Anh" } as const;

export const BALANCE_PREVIEW_BATCH_IDS: Readonly<Record<BalanceBatchImportsPreviewState, string>> = {
  approve: "0b5a1000-0000-4000-8000-000000000002",
  "approve-own": "0b5a1000-0000-4000-8000-000000000001",
  post: "0b5a1000-0000-4000-8000-000000000004",
  posted: "0b5a1000-0000-4000-8000-000000000005",
  reconcile: "0b5a1000-0000-4000-8000-000000000003",
};

const SHA = {
  approve: "4b1e9c0d2a7f3e58c6d1b2a3f4e5d6c7b8a9f0e1d2c3b4a5968778695a4b3c2d",
  "approve-own": "a3f1c9e27b4d5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcd",
  post: "7c2d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5061728394a5b",
  posted: "e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f",
  reconcile: "5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c",
} as const satisfies Record<BalanceBatchImportsPreviewState, string>;

/** The dry-run file of `state=review` (and the template's columns). */
export const BALANCE_PREVIEW_FILE_SHA = "9f2c4e7a1b3d5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcd";

const STUDENTS = {
  anh: { code: "TV-2026-00014", name: "Nguyễn Bảo Anh" },
  haAnh: { code: "TV-2026-00012", name: "Nguyễn Ngọc Hà Anh" },
  huy: { code: "TV-2026-00021", name: "Trần Gia Huy" },
  khang: { code: "TV-2026-00022", name: "Lê Minh Khang" },
  long: { code: "TV-2026-00013", name: "Nguyễn Ngọc Long" },
  vy: { code: "TV-2026-00030", name: "Đỗ Thảo Vy" },
} as const;

const MESSAGES = {
  enrollment: (code: string) => `Hoc vien ${code} khong co enrollment dang active. Can kiem tra truoc khi import.`,
  fractional: "So du co phan thap phan (7.5). Can kiem tra lai. Khong duoc lam tron hoac cat bo.",
  notFound: (code: string) => `Khong tim thay hoc vien voi ma ${code}.`,
  ok: "Hop le. San sang import.",
  required: "Ma hoc vien (student_public_code) la bat buoc.",
  zero: "So du bang 0, khong can tao but toan.",
} as const;

const EXCLUDED = {
  enrollment: "Chưa có enrollment đang active.",
  fractional: "Số dư nguồn có phần lẻ; sổ buổi hiện chỉ hỗ trợ số nguyên.",
} as const;

// ---------------------------------------------------------------- dry run

/** `state=review`: every server outcome (valid, review ×2, invalid ×2, no change), file order. */
export const BALANCE_PREVIEW_DRY_RUN: SessionBalanceImportDryRunResult = (() => {
  const rows: SessionBalanceImportRowResult[] = [
    dryRow(2, STUDENTS.haAnh, 10, { after: 12, before: 2, code: "OK", delta: 10, message: MESSAGES.ok, status: "valid" }),
    dryRow(3, STUDENTS.long, -2, { after: 3, before: 5, code: "OK", delta: -2, message: MESSAGES.ok, status: "valid" }),
    dryRow(4, STUDENTS.anh, 7.5, { code: "BALANCE_HAS_FRACTIONAL_PART", message: MESSAGES.fractional, status: "review" }),
    dryRow(5, STUDENTS.huy, 4, { code: "NO_ACTIVE_ENROLLMENT", message: MESSAGES.enrollment(STUDENTS.huy.code), status: "review" }),
    dryRow(6, { code: "TV-2026-09999", name: "Phan Minh Đức" }, 6, {
      code: "STUDENT_NOT_FOUND",
      message: MESSAGES.notFound("TV-2026-09999"),
      status: "invalid",
    }),
    dryRow(7, { code: null, name: "Vũ Hải Yến" }, 8, { code: "STUDENT_PUBLIC_CODE_REQUIRED", message: MESSAGES.required, status: "invalid" }),
    dryRow(8, STUDENTS.khang, 0, { code: "BALANCE_IS_ZERO", message: MESSAGES.zero, status: "no_change" }),
    dryRow(9, STUDENTS.vy, 12, { after: 12, before: 0, code: "OK", delta: 12, message: MESSAGES.ok, status: "valid" }),
  ];
  return {
    rows,
    summary: {
      invalid: rows.filter((row) => row.validation_status === "invalid").length,
      no_change: rows.filter((row) => row.validation_status === "no_change").length,
      review: rows.filter((row) => row.validation_status === "review").length,
      total: rows.length,
      valid: rows.filter((row) => row.validation_status === "valid").length,
    },
  };
})();

function dryRow(
  rowNumber: number,
  student: { code: string | null; name: string },
  balance: number,
  result: { after?: number; before?: number; code: string; delta?: number; message: string; status: SessionBalanceImportRowResult["validation_status"] },
): SessionBalanceImportRowResult {
  return {
    current_balance_before: result.before ?? null,
    delta_sessions: result.delta ?? null,
    expected_balance_after: result.after ?? null,
    source_balance: balance,
    source_row_number: rowNumber,
    source_student_name: student.name,
    student_enrollment_id: null,
    student_id: null,
    student_public_code: student.code,
    validation_code: result.code,
    validation_message: result.message,
    validation_status: result.status,
  };
}

/** The parsed file behind the dry run (three columns with the template's headers, rows 2–9). */
export const BALANCE_PREVIEW_WORKBOOK: SessionBalanceImportParsedWorkbook = {
  columns: [
    { columnIndex: 1, columnKey: "A", sourceHeader: "Mã học viên *" },
    { columnIndex: 2, columnKey: "B", sourceHeader: "Họ và tên học viên" },
    { columnIndex: 3, columnKey: "C", sourceHeader: "Số dư buổi *" },
  ],
  rowCount: BALANCE_PREVIEW_DRY_RUN.rows.length,
  rows: BALANCE_PREVIEW_DRY_RUN.rows.map((row) => ({
    rowNumber: row.source_row_number,
    values: { A: row.student_public_code, B: row.source_student_name, C: row.source_balance },
  })),
  sheetName: "So_du_buoi",
  sourceFilename: "so-du-buoi-dau-ky-10-2026.xlsx",
  sourceSha256: BALANCE_PREVIEW_FILE_SHA,
};

export const BALANCE_PREVIEW_MAPPING: SessionBalanceImportColumnMapping = {
  source_balance: "C",
  source_student_name: "B",
  student_public_code: "A",
};

// ---------------------------------------------------------------- batches

interface BatchShape {
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  createdBy: string;
  filename: string;
  postedAt?: string;
  postedBy?: string;
  reason: string;
  reconciledAt?: string;
  reconciledBy?: string;
  rows: SessionBalanceImportRowRecord[];
  state: BalanceBatchImportsPreviewState;
  status: SessionBalanceImportBatchRecord["status"];
}

function batchRow(
  state: BalanceBatchImportsPreviewState,
  rowNumber: number,
  student: { code: string; name: string },
  balance: number,
  result: {
    after?: number;
    before?: number;
    code: string;
    delta?: number;
    excluded?: string;
    message: string;
    status: SessionBalanceImportRowRecord["validation_status"];
  },
): SessionBalanceImportRowRecord {
  const id = `${BALANCE_PREVIEW_BATCH_IDS[state].slice(0, 24)}${String(rowNumber).padStart(12, "0")}`;
  return {
    batch_id: BALANCE_PREVIEW_BATCH_IDS[state],
    created_at: "2026-10-17T03:05:00.000Z",
    current_balance_before: result.before ?? null,
    delta_sessions: result.delta ?? null,
    excluded_reason: result.excluded ?? null,
    expected_balance_after: result.after ?? null,
    id,
    ledger_entry_id: result.status === "posted" ? `1edfe000-0000-4000-8000-${String(rowNumber).padStart(12, "0")}` : null,
    source_balance: balance,
    source_row_number: rowNumber,
    source_student_name: student.name,
    student_enrollment_id: null,
    student_id: null,
    student_public_code: student.code,
    validation_code: result.code,
    validation_message: result.message,
    validation_status: result.status,
  };
}

/** Rows of a batch at each stage: two review rows wait for exclusion, then are excluded; valid rows become posted. */
function rowsFor(state: BalanceBatchImportsPreviewState): SessionBalanceImportRowRecord[] {
  const isPosted = state === "posted";
  const isReconciled = state !== "reconcile";
  const valid = isPosted ? "posted" : "valid";
  return [
    batchRow(state, 2, STUDENTS.haAnh, 10, { after: 12, before: 2, code: "OK", delta: 10, message: MESSAGES.ok, status: valid }),
    batchRow(state, 3, STUDENTS.long, -2, { after: 3, before: 5, code: "OK", delta: -2, message: MESSAGES.ok, status: valid }),
    batchRow(state, 4, STUDENTS.anh, 7.5, {
      code: "BALANCE_HAS_FRACTIONAL_PART",
      excluded: isReconciled ? EXCLUDED.fractional : undefined,
      message: MESSAGES.fractional,
      status: isReconciled ? "excluded" : "review",
    }),
    batchRow(state, 5, STUDENTS.huy, 4, {
      code: "NO_ACTIVE_ENROLLMENT",
      excluded: isReconciled ? EXCLUDED.enrollment : undefined,
      message: MESSAGES.enrollment(STUDENTS.huy.code),
      status: isReconciled ? "excluded" : "review",
    }),
    batchRow(state, 6, STUDENTS.khang, 0, { code: "BALANCE_IS_ZERO", message: MESSAGES.zero, status: "no_change" }),
    batchRow(state, 7, STUDENTS.vy, 12, { after: 12, before: 0, code: "OK", delta: 12, message: MESSAGES.ok, status: valid }),
  ];
}

function shapes(role: ImportsPreviewRole): BatchShape[] {
  const own = IMPORTS_PREVIEW_USERS[role].id;
  const other = BALANCE_PREVIEW_OTHER_USER.id;
  const approver = IMPORTS_PREVIEW_USERS.owner.id;
  return [
    {
      createdAt: "2026-10-19T02:40:00.000Z",
      createdBy: own,
      filename: "so-du-lop-9-bo-sung.xlsx",
      reason: "Bổ sung số dư đầu kỳ lớp 9A2 chuyển từ sổ tay.",
      reconciledAt: "2026-10-19T03:10:00.000Z",
      reconciledBy: own,
      rows: rowsFor("approve-own"),
      state: "approve-own",
      status: "awaiting_approval",
    },
    {
      createdAt: "2026-10-18T09:15:00.000Z",
      createdBy: other,
      filename: "so-du-buoi-khoi-8.xlsx",
      reason: "Số dư buổi đầu kỳ khối 8 theo sổ tay giáo viên.",
      reconciledAt: "2026-10-18T10:02:00.000Z",
      reconciledBy: other,
      rows: rowsFor("approve"),
      state: "approve",
      status: "awaiting_approval",
    },
    {
      createdAt: "2026-10-17T03:05:00.000Z",
      createdBy: other,
      filename: "so-du-buoi-khoi-7.xlsx",
      reason: "Số dư buổi đầu kỳ khối 7.",
      rows: rowsFor("reconcile"),
      state: "reconcile",
      status: "awaiting_reconciliation",
    },
    {
      approvedAt: "2026-10-15T08:20:00.000Z",
      approvedBy: approver,
      createdAt: "2026-10-15T01:30:00.000Z",
      createdBy: other,
      filename: "so-du-buoi-khoi-6.xlsx",
      reason: "Số dư buổi đầu kỳ khối 6.",
      reconciledAt: "2026-10-15T02:45:00.000Z",
      reconciledBy: other,
      rows: rowsFor("post"),
      state: "post",
      status: "approved",
    },
    {
      approvedAt: "2026-10-10T08:00:00.000Z",
      approvedBy: approver,
      createdAt: "2026-10-10T02:00:00.000Z",
      createdBy: other,
      filename: "so-du-buoi-khoi-10.xlsx",
      postedAt: "2026-10-10T09:30:00.000Z",
      postedBy: approver,
      reason: "Số dư buổi đầu kỳ khối 10.",
      reconciledAt: "2026-10-10T03:15:00.000Z",
      reconciledBy: other,
      rows: rowsFor("posted"),
      state: "posted",
      status: "posted",
    },
  ];
}

function count(rows: readonly SessionBalanceImportRowRecord[], status: SessionBalanceImportRowRecord["validation_status"]): number {
  return rows.filter((row) => row.validation_status === status).length;
}

function toRecord(shape: BatchShape): SessionBalanceImportBatchRecord {
  const posted = count(shape.rows, "posted");
  return {
    approved_at: shape.approvedAt ?? null,
    approved_by: shape.approvedBy ?? null,
    created_at: shape.createdAt,
    created_by: shape.createdBy,
    effective_on: IMPORTS_PREVIEW_TODAY.slice(0, 8) + "01",
    excluded_count: count(shape.rows, "excluded"),
    id: BALANCE_PREVIEW_BATCH_IDS[shape.state],
    invalid_count: count(shape.rows, "invalid"),
    metadata: {},
    no_change_count: count(shape.rows, "no_change"),
    posted_at: shape.postedAt ?? null,
    posted_by: shape.postedBy ?? null,
    posted_count: posted,
    reason: shape.reason,
    reconciled_at: shape.reconciledAt ?? null,
    reconciled_by: shape.reconciledBy ?? null,
    review_count: count(shape.rows, "review"),
    row_count: shape.rows.length,
    source_filename: shape.filename,
    source_sha256: SHA[shape.state],
    status: shape.status,
    // The batch keeps counting valid rows after posting (they are the posted ones).
    valid_count: count(shape.rows, "valid") + posted,
  };
}

const PROFILES: SessionBalanceImportBatchDetail["profiles"] = {
  [BALANCE_PREVIEW_OTHER_USER.id]: { email: BALANCE_PREVIEW_OTHER_USER.email, full_name: BALANCE_PREVIEW_OTHER_USER.name },
  ...Object.fromEntries(
    Object.values(IMPORTS_PREVIEW_USERS).map((user) => [user.id, { email: user.email, full_name: user.displayName }]),
  ),
};

/** The list of `view=balances` for a role, newest first (one batch per stage, the first one the role's own). */
export function getBalancePreviewBatches(role: ImportsPreviewRole): SessionBalanceImportBatchListItem[] {
  return shapes(role).map((shape) => ({ ...toRecord(shape), creator_name: PROFILES[shape.createdBy]?.full_name ?? null }));
}

/** The batch page of `view=balance-batch&state=…` for a role. */
export function getBalancePreviewDetail(state: BalanceBatchImportsPreviewState, role: ImportsPreviewRole): SessionBalanceImportBatchDetail {
  const shape = shapes(role).find((candidate) => candidate.state === state) ?? shapes(role)[0];
  return { batch: toRecord(shape), profiles: PROFILES, rows: shape.rows };
}

/** Preview link of a fixture batch: its own `balance-batch` state for the same role, under /dev. */
export function getBalancePreviewBatchHref(batchId: string, role: ImportsPreviewRole): string {
  const state = (Object.keys(BALANCE_PREVIEW_BATCH_IDS) as BalanceBatchImportsPreviewState[]).find(
    (key) => BALANCE_PREVIEW_BATCH_IDS[key] === batchId,
  );
  return `/dev/imports?view=balance-batch&state=${state ?? "reconcile"}&role=${role}`;
}
