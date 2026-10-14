// Value: protects=the "Cần xử lý" URL contract (status chip, selected tx) and the permission flags that decide which SePay flows the screen offers;
// fails_when=an unknown status/tx leaks into state, rewriting the selection drops accountPurpose/queue/page (or the preview's role/state), partial queues get counts that look like totals, a stale tx id selects nothing, or sepay.view alone unlocks allocation/reconciliation;
// why_new=step 7 part 2 adds tabs, status chips and list/detail selection on top of the existing queue=review loader;
// seam=pure helpers, no rendering; no_claim=does not prove the loader filters the review statuses (sepay-transactions-page and data tests own that)
import { describe, expect, it } from "vitest";

import { getSepayScreenAccess } from "@/features/finance/sepay-access";
import {
  getSepayReviewStatusCounts,
  parseSepayReviewStatusFilter,
  parseSepaySelectedTransactionId,
  resolveSepayQueueSelection,
  withSepayReviewSelection,
} from "@/features/finance/sepay-transaction-url-state";

describe("SePay review URL state", () => {
  it("accepts only review match statuses as the status chip", () => {
    expect(parseSepayReviewStatusFilter("amount_mismatch")).toBe("amount_mismatch");
    expect(parseSepayReviewStatusFilter("identity_conflict")).toBe("identity_conflict");
    expect(parseSepayReviewStatusFilter("auto_matched")).toBe("");
    expect(parseSepayReviewStatusFilter(["unmatched"])).toBe("");
    expect(parseSepayReviewStatusFilter(undefined)).toBe("");
  });

  it("accepts uuid-shaped transaction ids only", () => {
    expect(parseSepaySelectedTransactionId("c1000000-0000-4000-8000-000000000002")).toBe("c1000000-0000-4000-8000-000000000002");
    expect(parseSepaySelectedTransactionId("<script>")).toBe("");
    expect(parseSepaySelectedTransactionId(["c1"])).toBe("");
    expect(parseSepaySelectedTransactionId(undefined)).toBe("");
  });

  it("rewrites status and tx while keeping every other parameter", () => {
    expect(withSepayReviewSelection("?accountPurpose=renewal&queue=review&page=2", { status: "unmatched", transactionId: "abc-1" }))
      .toBe("?accountPurpose=renewal&queue=review&page=2&status=unmatched&tx=abc-1");
    expect(withSepayReviewSelection("?tab=review&role=accountant&status=unmatched&tx=abc-1", { status: "", transactionId: "" }))
      .toBe("?tab=review&role=accountant");
    expect(withSepayReviewSelection("", { status: "", transactionId: "" })).toBe("");
  });

  it("counts statuses only when the whole queue is loaded", () => {
    const rows = [{ matchStatus: "unmatched" as const }, { matchStatus: "unmatched" as const }, { matchStatus: "amount_mismatch" as const }];
    expect(getSepayReviewStatusCounts(rows, 3)).toEqual({ account_purpose_mismatch: 0, amount_mismatch: 1, identity_conflict: 0, unmatched: 2 });
    expect(getSepayReviewStatusCounts(rows, 120)).toBeNull();
  });

  it("selects the requested row when visible, otherwise the first row", () => {
    const rows = [{ id: "a" }, { id: "b" }];
    expect(resolveSepayQueueSelection(rows, "b")).toEqual({ id: "b" });
    expect(resolveSepayQueueSelection(rows, "gone")).toEqual({ id: "a" });
    expect(resolveSepayQueueSelection([], "a")).toBeNull();
  });
});

describe("SePay screen access", () => {
  it("keeps sepay.view alone read-only", () => {
    expect(getSepayScreenAccess(["sepay.view"])).toEqual({ canAllocate: false, canReconcile: false, canReverse: false, canSyncHistory: false });
  });

  it("lets sepay.allocate allocate and reconcile without reversal or history sync", () => {
    expect(getSepayScreenAccess(["sepay.view", "sepay.allocate"])).toEqual({ canAllocate: true, canReconcile: true, canReverse: false, canSyncHistory: false });
  });

  it("lets payments.manage allocate, reconcile and reverse", () => {
    expect(getSepayScreenAccess(["sepay.view", "payments.manage"])).toEqual({ canAllocate: true, canReconcile: true, canReverse: true, canSyncHistory: false });
  });

  it("lets history sync reconcile without allocating", () => {
    expect(getSepayScreenAccess(["sepay.view", "sepay.sync_history.manage"])).toEqual({ canAllocate: false, canReconcile: true, canReverse: false, canSyncHistory: true });
  });
});
