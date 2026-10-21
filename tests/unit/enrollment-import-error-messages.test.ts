// Value: protects=the Vietnamese messages the enrollment import shows for its RPC error codes (batch not found / already committed / not ready / revalidation / reused file / permission), the raw database text for unknown errors and the fallback when the database gives none; fails_when=a known code reaches the user as a raw SCREAMING_CASE string, an unknown error is swallowed, or an empty message renders blank; why_new=the page used to prefix "Lỗi Commit ghi danh:" twice around the raw code; seam=none (pure function); no_claim=which RPC raises which code (supabase tests)
import { describe, expect, it } from "vitest";

import { describeEnrollmentImportDatabaseError } from "@/features/imports/enrollments/errors";

describe("describeEnrollmentImportDatabaseError", () => {
  it.each([
    ["STUDENT_ENROLLMENT_IMPORT_BATCH_NOT_FOUND", /Không tìm thấy batch staging/],
    ["STUDENT_ENROLLMENT_IMPORT_BATCH_ALREADY_COMMITTED", /đã được commit trước đó/],
    ["STUDENT_ENROLLMENT_IMPORT_BATCH_NOT_READY", /không ở trạng thái sẵn sàng commit/],
    ["STUDENT_ENROLLMENT_IMPORT_REVALIDATION_FAILED", /đã thay đổi sau khi tạo batch/],
    ["STUDENT_ENROLLMENT_IMPORT_SHA_ALREADY_EXISTS", /đã được dùng để tạo batch trước đó/],
    ["IMPORTS_ENROLLMENTS_PERMISSION_DENIED", /không có quyền import ghi danh/],
  ])("maps %s to a Vietnamese message", (code, expected) => {
    const message = describeEnrollmentImportDatabaseError(code, "fallback");

    expect(message).toMatch(expected);
    expect(message).not.toContain(code);
  });

  it("keeps an unknown database message as is", () => {
    expect(describeEnrollmentImportDatabaseError("deadlock detected", "fallback")).toBe(
      "deadlock detected",
    );
  });

  it("uses the fallback when the database gives no message", () => {
    expect(describeEnrollmentImportDatabaseError("", "Giao dịch commit thất bại.")).toBe(
      "Giao dịch commit thất bại.",
    );
    expect(describeEnrollmentImportDatabaseError(undefined, "Giao dịch commit thất bại.")).toBe(
      "Giao dịch commit thất bại.",
    );
  });
});
