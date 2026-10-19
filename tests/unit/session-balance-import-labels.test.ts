// Value: protects=the session-balance wording module: every dry-run validation code (migration 20260808100000) has a Vietnamese message and an unknown code falls back to the server's raw message (or a neutral sentence), never an inherited property; row status words and severities (invalid = error, review = warning, valid/posted = valid, no change/excluded = neutral, unknown = flagged); the issue text per status; batch status words and tones (unknown kept visible); the list's per-viewer status ("Chờ đối tác duyệt (Maker)" for the creator, "Chờ bạn duyệt" only with the approval permission); balances never rounded, deltas signed;
// fails_when=a server code shows its ASCII message, a new code prints nothing, "constructor" or "toString" resolves to a function, a review row stops being flagged, an excluded row loses its reason, an approver-less viewer is told "Chờ bạn duyệt", or 7.5 renders as 8;
// why_new=step 15b maps the dry-run messages to Vietnamese by validation_code (allowed presentation fix) and moves both pages' status words into one module;
// seam=none (pure module);
// no_claim=does not prove where the pages place these words (the page and workflow tests) or that the server keeps these codes (the migration is the source)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  formatSessionBalance,
  formatSignedSessions,
  getSessionBalanceBatchListStatus,
  getSessionBalanceBatchStatus,
  getSessionBalanceRowIssue,
  getSessionBalanceRowSeverity,
  getSessionBalanceRowStatusLabel,
  getSessionBalanceValidationMessage,
  SESSION_BALANCE_VALIDATION_MESSAGES,
} from "@/features/imports/session-balances/session-balance-import-labels";

describe("getSessionBalanceValidationMessage", () => {
  it("has a Vietnamese message for every code the dry-run RPC sets", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260808100000_session_balance_import_foundation.sql"), "utf8");
    const codes = [...migration.matchAll(/v_validation_code\s*:=\s*'([A-Z_]+)'/g)].map((match) => match[1]);
    expect(new Set(codes)).toEqual(
      new Set([
        "STUDENT_PUBLIC_CODE_REQUIRED",
        "SOURCE_BALANCE_INVALID",
        "BALANCE_IS_ZERO",
        "BALANCE_HAS_FRACTIONAL_PART",
        "STUDENT_CODE_AMBIGUOUS",
        "STUDENT_NOT_FOUND",
        "NO_ACTIVE_ENROLLMENT",
        "OK",
      ]),
    );
    expect(Object.keys(SESSION_BALANCE_VALIDATION_MESSAGES).sort()).toEqual([...new Set(codes)].sort());
    for (const message of Object.values(SESSION_BALANCE_VALIDATION_MESSAGES)) expect(message).toMatch(/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹáàãéèíìóòõúùýđ]/i);
  });

  it.each([
    ["STUDENT_NOT_FOUND", "Khong tim thay hoc vien voi ma TV-1.", "Không tìm thấy học viên có mã này."],
    ["BALANCE_HAS_FRACTIONAL_PART", "So du co phan thap phan (7.5).", "Số dư có phần lẻ; sổ buổi chỉ ghi số nguyên và không làm tròn."],
    ["NO_ACTIVE_ENROLLMENT", "Hoc vien X khong co enrollment dang active.", "Học viên chưa có ghi danh đang hoạt động; kiểm tra trước khi nhập."],
    ["NEW_SERVER_CODE", "  So du vuot gioi han.  ", "So du vuot gioi han."],
    ["constructor", "Raw message", "Raw message"],
    ["toString", null, "Máy chủ không gửi thông báo cho dòng này."],
    [null, "", "Máy chủ không gửi thông báo cho dòng này."],
  ])("%s → %s", (code, raw, expected) => {
    expect(getSessionBalanceValidationMessage(code, raw)).toBe(expected);
  });
});

describe("row status words", () => {
  it.each([
    ["valid", "Hợp lệ", "valid"],
    ["review", "Cần xem lại", "warning"],
    ["invalid", "Không hợp lệ", "error"],
    ["no_change", "Không thay đổi", "neutral"],
    ["excluded", "Đã loại", "neutral"],
    ["posted", "Đã ghi sổ", "valid"],
    ["hasOwnProperty", "Trạng thái chưa hỗ trợ: hasOwnProperty", "warning"],
    ["", "Trạng thái chưa hỗ trợ: trống", "warning"],
  ])("%j → %j (%s)", (status, label, severity) => {
    expect(getSessionBalanceRowStatusLabel(status)).toBe(label);
    expect(getSessionBalanceRowSeverity(status)).toBe(severity);
  });

  it("writes the issue of each row in words", () => {
    const base = { validation_code: "STUDENT_NOT_FOUND", validation_message: "Khong tim thay." };
    expect(getSessionBalanceRowIssue({ ...base, validation_status: "invalid" })).toBe("Không hợp lệ: Không tìm thấy học viên có mã này.");
    expect(getSessionBalanceRowIssue({ validation_code: "BALANCE_IS_ZERO", validation_message: "x", validation_status: "no_change" })).toBe(
      "Không thay đổi: Số dư bằng 0, không tạo bút toán.",
    );
    expect(getSessionBalanceRowIssue({ validation_code: "OK", validation_message: "Hop le.", validation_status: "valid" })).toBeNull();
    expect(getSessionBalanceRowIssue({ validation_code: "OK", validation_message: "Hop le.", validation_status: "posted" })).toBe("Đã ghi sổ.");
    expect(
      getSessionBalanceRowIssue({ excluded_reason: " Học viên đã nghỉ. ", validation_code: "NO_ACTIVE_ENROLLMENT", validation_message: "x", validation_status: "excluded" }),
    ).toBe("Đã loại: Học viên đã nghỉ.");
    expect(getSessionBalanceRowIssue({ excluded_reason: null, validation_code: null, validation_message: null, validation_status: "excluded" })).toBe(
      "Đã loại: không ghi lý do.",
    );
  });
});

describe("batch status words", () => {
  it.each([
    ["awaiting_reconciliation", "Đang chờ đối soát", "warning"],
    ["awaiting_approval", "Đang chờ phê duyệt", "warning"],
    ["approved", "Đã phê duyệt", "info"],
    ["posted", "Đã ghi sổ", "success"],
    ["rejected", "Đã từ chối", "danger"],
    ["draft", "Nháp", "neutral"],
    ["previewed", "Đã xem trước", "neutral"],
    ["archived", "Trạng thái chưa hỗ trợ: archived", "neutral"],
    ["valueOf", "Trạng thái chưa hỗ trợ: valueOf", "neutral"],
  ])("%s → %s (%s)", (status, label, tone) => {
    expect(getSessionBalanceBatchStatus(status)).toEqual({ label, tone });
  });

  it("words a batch waiting for approval for the person looking at the list", () => {
    const batch = { created_by: "user-maker", status: "awaiting_approval" as const };
    expect(getSessionBalanceBatchListStatus(batch, { canApprove: true, currentUserId: "user-maker" }).label).toBe("Chờ đối tác duyệt (Maker)");
    expect(getSessionBalanceBatchListStatus(batch, { canApprove: false, currentUserId: "user-maker" }).label).toBe("Chờ đối tác duyệt (Maker)");
    expect(getSessionBalanceBatchListStatus(batch, { canApprove: true, currentUserId: "user-checker" }).label).toBe("Chờ bạn duyệt");
    expect(getSessionBalanceBatchListStatus(batch, { canApprove: false, currentUserId: "user-checker" }).label).toBe("Đang chờ phê duyệt");
    expect(
      getSessionBalanceBatchListStatus({ created_by: "user-checker", status: "posted" }, { canApprove: true, currentUserId: "user-checker" }),
    ).toEqual({ label: "Đã ghi sổ", tone: "success" });
  });
});

describe("number formats", () => {
  it("never rounds a balance and signs a delta", () => {
    expect(formatSessionBalance(7.5)).toBe("7,5");
    expect(formatSessionBalance(-2)).toBe("-2");
    expect(formatSessionBalance(1234)).toBe("1.234");
    expect(formatSessionBalance(null)).toBe("—");
    expect(formatSessionBalance(Number.NaN)).toBe("—");
    expect(formatSignedSessions(10)).toBe("+10");
    expect(formatSignedSessions(-2)).toBe("-2");
    expect(formatSignedSessions(0)).toBe("0");
    expect(formatSignedSessions(undefined)).toBe("—");
  });
});
