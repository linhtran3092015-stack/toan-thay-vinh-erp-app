// Value: protects=the payment-request list's pure rules: the money strip leaves cancelled/expired requests out of "Phải thu" and counts only pending/partial as outstanding; chip counts follow the other filters but not the status, "Hết hạn" stays hidden at 0; "Còn" only while owed, "Thừa" on overpay; the 14-day caption uses the dashboard's `created_at < now() - 14 days` threshold; the header names the 1000-row cap;
// fails_when=a cancelled request is summed into Phải thu, a chip count ignores search/type/dates or narrows by its own status, the expired chip shows at 0, a cancelled row says "Còn", the overdue rule drifts from the dashboard threshold (calendar days, or <=), or the cap notice disappears at 1000 rows;
// why_new=step 14c moves the directory helpers into payment-request-directory-models.ts and adds chips, the strip fix and captions; seam=pure functions, fixed `today`; no_claim=rendering (payment-request-directory-presentation.test.tsx)
import { describe, expect, it } from "vitest";

import {
  buildPaymentRequestStatusChips,
  canCancelPaymentRequest,
  countActivePaymentRequestFilters,
  describePaymentRequestBalance,
  describePaymentRequestBonus,
  describePaymentRequestDirectoryContext,
  describePaymentRequestSessionExtras,
  describePaymentRequestUnitPrice,
  getPaymentRequestCreatedDate,
  getPaymentRequestStatusChipValue,
  getPaymentRequestTopupLabel,
  isPaymentRequestOverdue,
  keepTogether,
  PAYMENT_REQUEST_LOAD_LIMIT,
  paginatePaymentRequests,
  summarizePaymentRequests,
} from "@/features/finance/payment-request-directory-models";
import { defaultPaymentRequestFilters } from "@/features/finance/payment-request-url-state";
import type { PaymentRequestReadModel } from "@/features/finance/read-models";

const base: PaymentRequestReadModel = { bonusSessions: 0, calculatedUnitPriceVnd: 140_000, createdAt: "2026-10-10T03:00:00Z", expectedAmountVnd: 1_400_000, guardianFullName: "Nguyễn Thị Mai", guardianPhone: "0900000000", id: "r-1", notes: null, paidAmountVnd: 0, paidAt: null, publicCode: "PAY-261010-AAAAAAAAAAAA", purchasedSessions: 10, status: "pending", studentFullName: "Nguyễn Minh An", studentId: "s-1", studentPublicCode: "HV001", topupType: "new", transferCode: "NGUYEN MINH AN 2014 0900000000 PAY-261010-AAAAAAAAAAAA" };
const request = (overrides: Partial<PaymentRequestReadModel>): PaymentRequestReadModel => ({ ...base, ...overrides });
// Intl vi-VN puts a no-break space before ₫ (formatVnd).

describe("payment request directory models", () => {
  it("sums Phải thu without cancelled or expired requests and keeps Còn chờ nhận to pending and partial ones", () => {
    const summary = summarizePaymentRequests([
      request({ expectedAmountVnd: 1_400_000, id: "a" }),
      request({ expectedAmountVnd: 2_600_000, id: "b", paidAmountVnd: 1_000_000, status: "partially_paid" }),
      request({ expectedAmountVnd: 1_300_000, id: "c", status: "cancelled" }),
      request({ expectedAmountVnd: 900_000, id: "d", status: "expired" }),
      request({ expectedAmountVnd: 1_400_000, id: "e", paidAmountVnd: 1_500_000, status: "paid" }),
    ]);
    expect(summary).toEqual({ expectedVnd: 5_400_000, outstandingVnd: 3_000_000, paidVnd: 2_500_000 });
    expect(summarizePaymentRequests([])).toEqual({ expectedVnd: 0, outstandingVnd: 0, paidVnd: 0 });
  });

  it("counts chips over rows matching search, type and dates, never their own status", () => {
    const items = [
      request({ id: "a", studentFullName: "Đặng Hải Đăng" }),
      request({ id: "b", status: "paid", studentFullName: "Đặng Văn Lâm", topupType: "renewal" }),
      request({ id: "c", status: "cancelled", studentFullName: "Trần Gia Bảo" }),
      request({ createdAt: "2026-09-01T03:00:00Z", id: "d", status: "partially_paid", studentFullName: "Đặng Thu" }),
    ];
    const filters = { ...defaultPaymentRequestFilters, createdFrom: "2026-10-01", search: "dang", status: "paid" as const };
    const chips = buildPaymentRequestStatusChips(items, filters);

    expect(chips.map((chip) => [chip.value, chip.count, chip.disabled ?? false])).toEqual([
      ["all", 2, false],
      ["pending", 1, false],
      ["partially_paid", 0, true],
      ["paid", 1, false],
      ["cancelled", 0, true],
    ]);
    expect(chips.map((chip) => chip.label)).toEqual(["Tất cả", "Chờ thanh toán", "Thanh toán một phần", "Đã thanh toán", "Đã hủy"]);
    expect(getPaymentRequestStatusChipValue(filters)).toBe("paid");
    expect(getPaymentRequestStatusChipValue(defaultPaymentRequestFilters)).toBe("all");
  });

  it("shows the expired chip only with expired rows or while it is the active status, enabled when active", () => {
    expect(buildPaymentRequestStatusChips([request({})], defaultPaymentRequestFilters).some((chip) => chip.value === "expired")).toBe(false);
    expect(buildPaymentRequestStatusChips([request({ status: "expired" })], defaultPaymentRequestFilters).find((chip) => chip.value === "expired")).toMatchObject({ count: 1, label: "Hết hạn" });
    expect(buildPaymentRequestStatusChips([request({})], { ...defaultPaymentRequestFilters, status: "expired" }).find((chip) => chip.value === "expired")).toMatchObject({ count: 0, disabled: false });
  });

  it("says Còn only while a request is owed and Thừa when more than expected arrived", () => {
    expect(describePaymentRequestBalance(request({ paidAmountVnd: 400_000, status: "partially_paid" }))).toBe("Còn 1.000.000\u00a0₫");
    expect(describePaymentRequestBalance(request({}))).toBe("Còn 1.400.000\u00a0₫");
    expect(describePaymentRequestBalance(request({ status: "cancelled" }))).toBeNull();
    expect(describePaymentRequestBalance(request({ status: "expired" }))).toBeNull();
    expect(describePaymentRequestBalance(request({ paidAmountVnd: 1_400_000, status: "paid" }))).toBeNull();
    expect(describePaymentRequestBalance(request({ paidAmountVnd: 1_500_000, status: "paid" }))).toBe("Thừa 100.000\u00a0₫");
  });

  it("flags a pending request with the dashboard's threshold: created more than 14 × 24h before now", () => {
    const now = Date.parse("2026-10-16T05:00:00Z");
    // 14 days + 1 minute: overdue (still 02/10 in Vietnam, so a calendar-day rule would wait another day).
    expect(isPaymentRequestOverdue(request({ createdAt: "2026-10-02T04:59:00Z" }), now)).toBe(true);
    // Exactly 14 days, and 14 days − 1 minute: not yet (`created_at < now() - 14 days` is strict).
    expect(isPaymentRequestOverdue(request({ createdAt: "2026-10-02T05:00:00Z" }), now)).toBe(false);
    expect(isPaymentRequestOverdue(request({ createdAt: "2026-10-02T05:01:00Z" }), now)).toBe(false);
    expect(isPaymentRequestOverdue(request({ createdAt: "2026-09-01T03:00:00Z", paidAmountVnd: 100_000, status: "partially_paid" }), now)).toBe(false);
    expect(isPaymentRequestOverdue(request({ createdAt: "not-a-date" }), now)).toBe(false);
    expect(getPaymentRequestCreatedDate("2026-08-09T18:00:00Z")).toBe("2026-08-10");
    expect(getPaymentRequestCreatedDate("not-a-date")).toBe("not-a-date");
  });

  it("names the 1000-row cap in the header line and only then", () => {
    expect(PAYMENT_REQUEST_LOAD_LIMIT).toBe(1000);
    expect(describePaymentRequestDirectoryContext(3, 28)).toBe("3/28 yêu cầu trong danh sách đã tải");
    expect(describePaymentRequestDirectoryContext(999, 999)).toBe("999/999 yêu cầu trong danh sách đã tải");
    expect(describePaymentRequestDirectoryContext(12, 1000)).toBe("12/1000 yêu cầu trong danh sách đã tải · chỉ gồm 1.000 yêu cầu mới nhất");
  });

  it("keeps the small row helpers truthful", () => {
    expect(describePaymentRequestSessionExtras(request({ bonusSessions: 2 }))).toEqual(["+2 tặng", "140.000\u00a0₫/buổi"]);
    expect(describePaymentRequestSessionExtras(request({ calculatedUnitPriceVnd: 0 }))).toEqual([]);
    expect(describePaymentRequestBonus(request({ bonusSessions: 3 }))).toBe("+3 tặng");
    expect(describePaymentRequestBonus(request({}))).toBeNull();
    expect(describePaymentRequestUnitPrice(request({}))).toBe("140.000\u00a0₫/buổi");
    expect(describePaymentRequestUnitPrice(request({ calculatedUnitPriceVnd: 0 }))).toBeNull();
    expect(keepTogether("16/10 09:40")).toBe("16/10\u00a009:40");
    expect(keepTogether("16/10/2025 09:40")).toBe("16/10/2025\u00a009:40");
    expect(getPaymentRequestTopupLabel("new")).toBe("Tuyển mới");
    expect(getPaymentRequestTopupLabel("renewal")).toBe("Tái phí");
    expect(canCancelPaymentRequest(request({}))).toBe(true);
    expect(canCancelPaymentRequest(request({ paidAmountVnd: 1 }))).toBe(false);
    expect(canCancelPaymentRequest(request({ status: "partially_paid" }))).toBe(false);
    expect(countActivePaymentRequestFilters({ ...defaultPaymentRequestFilters, search: "   " })).toBe(0);
    const rows = Array.from({ length: 21 }, (_, index) => request({ id: `r-${index}` }));
    expect(paginatePaymentRequests(rows, 2)).toMatchObject({ end: 21, page: 2, start: 20 });
    expect(paginatePaymentRequests([], 1)).toMatchObject({ end: 0, page: 1, pageCount: 1, start: 0 });
  });
});
