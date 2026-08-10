import { describe, expect, it } from "vitest";

import { PAYMENT_REQUEST_PAGE_SIZE, filterPaymentRequests, paginatePaymentRequests } from "@/features/finance/payment-request-directory";
import { defaultPaymentRequestFilters, getPaymentRequestDirectoryHref, getPaymentRequestDirectoryQuery, mergePendingPaymentRequestFilter, parsePaymentRequestDirectoryViewState, resetPaymentRequestDirectoryViewState, serializePaymentRequestDirectoryViewState } from "@/features/finance/payment-request-url-state";
import type { PaymentRequestReadModel } from "@/features/finance/read-models";

const request: PaymentRequestReadModel = { bonusSessions: 1, calculatedUnitPriceVnd: 140000, createdAt: "2026-08-10T10:00:00.000Z", expectedAmountVnd: 1_400_000, guardianFullName: "Phụ huynh A", guardianPhone: "0900000000", id: "request-1", notes: null, paidAmountVnd: 0, paidAt: null, publicCode: "YC-001", purchasedSessions: 10, status: "pending", studentFullName: "Nguyễn An", studentId: "student-1", studentPublicCode: "HV001", topupType: "new", transferCode: "TTVC YC001" };

describe("Payment request directory URL view state", () => {
  it("parses supported values and falls back for invalid status, top-up type, dates, and page", () => {
    expect(parsePaymentRequestDirectoryViewState(new URLSearchParams("search=Nguyễn&status=pending&topupType=new&createdFrom=2026-02-28&createdTo=2024-02-29&page=3"))).toEqual({ filters: { search: "Nguyễn", status: "pending", topupType: "new", createdFrom: "2026-02-28", createdTo: "2024-02-29" }, page: 3 });
    expect(parsePaymentRequestDirectoryViewState(new URLSearchParams("status=wrong&topupType=wrong&createdFrom=2026-02-30&createdTo=2026-99-99&page=0"))).toEqual({ filters: defaultPaymentRequestFilters, page: 1 });
  });

  it("preserves unrelated params, removes only Finance-owned state on reset, and omits invalid safe-return dates", () => {
    const params = new URLSearchParams("notice=created&status=pending&page=4");
    expect(serializePaymentRequestDirectoryViewState(params, { filters: { ...defaultPaymentRequestFilters, search: "An" }, page: 1 }).toString()).toBe("notice=created&search=An");
    expect(getPaymentRequestDirectoryHref(params, resetPaymentRequestDirectoryViewState())).toBe("/finance/payment-requests?notice=created");
    expect(getPaymentRequestDirectoryQuery(new URLSearchParams("notice=created&createdFrom=2026-02-30&status=pending"))).toBe("status=pending");
  });

  it("keeps inverted dates unchanged and composes rapid filter changes in both orders", () => {
    expect(parsePaymentRequestDirectoryViewState(new URLSearchParams("createdFrom=2026-09-01&createdTo=2026-08-01"))).toMatchObject({ filters: { createdFrom: "2026-09-01", createdTo: "2026-08-01" } });
    const statusThenType = mergePendingPaymentRequestFilter(mergePendingPaymentRequestFilter(null, defaultPaymentRequestFilters, "status", "pending"), defaultPaymentRequestFilters, "topupType", "renewal");
    const typeThenStatus = mergePendingPaymentRequestFilter(mergePendingPaymentRequestFilter(null, defaultPaymentRequestFilters, "topupType", "renewal"), defaultPaymentRequestFilters, "status", "pending");
    expect(statusThenType).toMatchObject({ status: "pending", topupType: "renewal" });
    expect(typeThenStatus).toMatchObject({ status: "pending", topupType: "renewal" });
  });

  it("retains current client filtering and 20-row pagination semantics", () => {
    expect(filterPaymentRequests([request], { ...defaultPaymentRequestFilters, search: "nguyen", status: "pending" })).toEqual([request]);
    expect(filterPaymentRequests([request], { ...defaultPaymentRequestFilters, status: "paid" })).toEqual([]);
    const items = Array.from({ length: PAYMENT_REQUEST_PAGE_SIZE + 1 }, (_, index) => ({ ...request, id: `request-${index}`, publicCode: `YC-${index}` }));
    expect(paginatePaymentRequests(items, 99)).toMatchObject({ page: 2, pageCount: 2, start: PAYMENT_REQUEST_PAGE_SIZE });
  });
});
