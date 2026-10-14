// Value: protects=the read-only derivations behind the CRM redesign: list badge suffixes (days interested, next scheduled trial, conversion day, truncated drop reason), the lifecycle rail (dates from created_at / first booking / first attendance / status_changed_at, skipped steps never shown as done, dropped keeps reached steps then "Đã dừng" with its reason), the 10-item checklist summary with its accountant and payment hints, assignment method words, and the detail page's existing action gates plus its single primary and conversion reason;
// fails_when=a suffix invents data (e.g. "0 ngày"), a skipped trial step renders as done, a dropped case loses its reason, item 8 stops naming the accountant permission for a sale, an action gate drifts from the pre-redesign page (transfer on converted, conversion on dropped, notes on converted), or two primaries become possible;
// why_new=step 10 adds these helpers; the page tests only see their rendered output for one status;
// seam=none (pure functions); no_claim=does not prove the loaders fill statusChangedAt/resultRecordedAt from production rows (crm-directory-counts and crm-detail-view cover the wiring)
import { describe, expect, it } from "vitest";

import {
  deriveCrmLifecycle,
  formatAssignmentMethod,
  formatCrmMode,
  getCrmDetailActions,
  getCrmStatusSuffix,
  getCrmTrialStatusMeta,
  getNextScheduledTrialDate,
  getTrustedStatusChangedAt,
  summarizeCrmChecklist,
} from "@/features/crm/crm-presentation";
import type { CrmCaseStatus, EnrollmentChecklistReadModel } from "@/features/crm/read-models";

const TODAY = "2026-10-14";
// Dates after status_changed_at tracking started (see CRM_STATUS_TRACKING_SINCE).
const LATER = "2026-10-28";
const NEW_LEAD = "2026-10-12T02:00:00Z";

describe("CRM list status suffix", () => {
  it("counts whole Vietnam days a lead has been interested and omits a same-day lead", () => {
    expect(getCrmStatusSuffix({ createdAt: NEW_LEAD, status: "interested", statusChangedAt: "2026-10-14T03:00:00Z" }, LATER)).toBe("14 ngày");
    // 23:30 UTC on the 13th is already the 14th in Vietnam.
    expect(getCrmStatusSuffix({ createdAt: NEW_LEAD, status: "interested", statusChangedAt: "2026-10-13T23:30:00Z" }, TODAY)).toBeNull();
    expect(getCrmStatusSuffix({ createdAt: NEW_LEAD, status: "interested", statusChangedAt: null }, TODAY)).toBeNull();
  });

  it("shows the earliest scheduled trial and the conversion day as dd/mm", () => {
    expect(getCrmStatusSuffix({ createdAt: NEW_LEAD, nextTrialDate: "2026-10-14", status: "trial_booked" }, TODAY)).toBe("14/10");
    expect(getCrmStatusSuffix({ createdAt: NEW_LEAD, nextTrialDate: null, status: "trial_booked" }, TODAY)).toBeNull();
    expect(getCrmStatusSuffix({ createdAt: NEW_LEAD, status: "converted", statusChangedAt: "2026-10-15T18:00:00Z" }, LATER)).toBe("16/10");
  });

  it("truncates a long drop reason and adds nothing to statuses without a suffix", () => {
    expect(getCrmStatusSuffix({ createdAt: NEW_LEAD, dropReason: "học nơi khác", status: "dropped" }, TODAY)).toBe("học nơi khác");
    expect(getCrmStatusSuffix({ createdAt: NEW_LEAD, dropReason: "Phụ huynh chọn học nơi khác gần nhà hơn", status: "dropped" }, TODAY)).toBe("Phụ huynh chọn học nơi…");
    expect(getCrmStatusSuffix({ createdAt: NEW_LEAD, status: "trial_completed", statusChangedAt: "2026-10-01T00:00:00Z" }, TODAY)).toBeNull();
    expect(getCrmStatusSuffix({ createdAt: NEW_LEAD, status: "pending_enrollment_confirmation", statusChangedAt: "2026-10-01T00:00:00Z" }, TODAY)).toBeNull();
  });

  // Value: protects=status_changed_at that may be the default of migration 20261013100000 (default now(), no backfill) is never shown as a real status date: no "· N ngày" / "· dd/mm" suffix and no rail date, while a value equal to created_at (both set by the same insert now()) and any value from CRM_STATUS_TRACKING_SINCE (a Vietnam day) on keep theirs;
  // fails_when=getTrustedStatusChangedAt is bypassed (a legacy lead reads "Đang quan tâm · 3 ngày" counted from the migration day), the created_at equality check is dropped (every lead created before the cutoff loses its status date) or compares strings instead of instants, or the cutoff is read in UTC instead of Vietnam time;
  // why_new=fix pass 1 (F3) added the legacy guard, fix pass 2 (G4) replaced its two-cutoff rule; seam=none (pure functions); no_claim=does not prove the migration was applied before 2026-10-14 in production (the cutoff is a documented business decision)
  it("ignores the migration default on legacy leads but keeps real status dates", () => {
    const legacy = { createdAt: "2026-09-20T03:00:00Z", statusChangedAt: "2026-10-12T05:00:00Z" };
    expect(getTrustedStatusChangedAt(legacy)).toBeNull();
    expect(getCrmStatusSuffix({ ...legacy, status: "interested" }, LATER)).toBeNull();
    expect(getCrmStatusSuffix({ ...legacy, status: "converted" }, LATER)).toBeNull();

    // Created around the migration with a different status time: may still be the default.
    expect(getTrustedStatusChangedAt({ createdAt: "2026-10-11T02:00:00Z", statusChangedAt: "2026-10-12T05:00:00Z" })).toBeNull();

    // Same instant as created_at (same insert now()), even in another offset notation: a real initial status time.
    const fresh = { createdAt: "2026-10-12T03:00:00Z", statusChangedAt: "2026-10-12T10:00:00+07:00" };
    expect(getTrustedStatusChangedAt(fresh)).toBe("2026-10-12T10:00:00+07:00");
    expect(getCrmStatusSuffix({ ...fresh, status: "interested" }, LATER)).toBe("16 ngày");
    expect(getCrmStatusSuffix({ ...fresh, status: "converted" }, LATER)).toBe("12/10");

    const legacyChangedLater = { createdAt: "2026-09-20T03:00:00Z", statusChangedAt: "2026-10-14T02:00:00Z" };
    expect(getTrustedStatusChangedAt(legacyChangedLater)).toBe("2026-10-14T02:00:00Z");
    expect(getCrmStatusSuffix({ ...legacyChangedLater, status: "interested" }, LATER)).toBe("14 ngày");
    expect(getCrmStatusSuffix({ ...legacyChangedLater, status: "converted" }, LATER)).toBe("14/10");
  });

  it("reads the tracking cutoff as a Vietnam day", () => {
    // 16:30 UTC on the 13th is 23:30 on 13/10 in Vietnam: still before the cutoff.
    expect(getTrustedStatusChangedAt({ createdAt: "2026-09-20T03:00:00Z", statusChangedAt: "2026-10-13T16:30:00Z" })).toBeNull();
    // 17:30 UTC on the 13th is 00:30 on 14/10 in Vietnam: tracked.
    expect(getTrustedStatusChangedAt({ createdAt: "2026-09-20T03:00:00Z", statusChangedAt: "2026-10-13T17:30:00Z" })).toBe("2026-10-13T17:30:00Z");
  });

  it("picks the earliest still-scheduled trial only", () => {
    expect(getNextScheduledTrialDate([
      { status: "attended", trial_date: "2026-10-01" },
      { status: "scheduled", trial_date: "2026-10-20" },
      { status: "scheduled", trial_date: "2026-10-16" },
      { status: "cancelled", trial_date: "2026-10-10" },
    ])).toBe("2026-10-16");
    expect(getNextScheduledTrialDate(undefined)).toBeNull();
  });
});

const base = {
  createdAt: "2026-10-01T03:00:00Z",
  dropReason: null,
  droppedAt: null,
  // After CRM_STATUS_TRACKING_SINCE, so the value is trusted on this pre-migration lead.
  statusChangedAt: "2026-10-16T08:00:00Z",
  studentId: null as string | null,
  trialBookings: [] as { createdAt: string; resultRecordedAt?: string | null; status: string }[],
};

describe("CRM lifecycle rail", () => {
  it("dates each reached step from its own evidence and rings the current one", () => {
    const steps = deriveCrmLifecycle({
      ...base,
      status: "pending_enrollment_confirmation",
      studentId: "student-1",
      trialBookings: [{ createdAt: "2026-10-02T04:00:00Z", resultRecordedAt: "2026-10-05T14:00:00Z", status: "attended" }],
    });
    expect(steps.map((step) => [step.label, step.state, step.date])).toEqual([
      ["Đang quan tâm", "done", "2026-10-01T03:00:00Z"],
      ["Đã đặt học thử", "done", "2026-10-02T04:00:00Z"],
      ["Đã học thử", "done", "2026-10-05T14:00:00Z"],
      ["Chờ xác nhận nhập học", "current", "2026-10-16T08:00:00Z"],
      ["Đã nhập học", "upcoming", null],
    ]);
  });

  it("marks trial steps the case went past without a booking as skipped, not done", () => {
    const steps = deriveCrmLifecycle({ ...base, status: "pending_enrollment_confirmation", studentId: "student-1" });
    expect(steps.map((step) => step.state)).toEqual(["done", "skipped", "skipped", "current", "upcoming"]);
  });

  // Value: protects=a lead back at "Đang quan tâm" (reopened, or returned after a no-show) dates its current step from the trusted last status change, falling back to created_at;
  // fails_when=the current interested step keeps created_at although status_changed_at records the return, or a legacy default (untrusted) dates it instead of created_at;
  // why_new=step 10 fix pass 4 (P3); seam=none; no_claim=none beyond protects (pure function)
  it("dates a current Đang quan tâm step from its trusted status change, else created_at", () => {
    const reopened = deriveCrmLifecycle({
      ...base,
      status: "interested",
      trialBookings: [{ createdAt: "2026-10-02T04:00:00Z", status: "no_show" }],
    });
    expect(reopened[0]).toMatchObject({ date: "2026-10-16T08:00:00Z", key: "interested", state: "current" });

    const legacy = deriveCrmLifecycle({ ...base, status: "interested", statusChangedAt: "2026-10-12T08:00:00Z" });
    expect(legacy[0]).toMatchObject({ date: "2026-10-01T03:00:00Z", state: "current" });
    expect(deriveCrmLifecycle({ ...base, status: "interested", statusChangedAt: null })[0].date).toBe("2026-10-01T03:00:00Z");

    // Only the current step moves: a later step still dates Đang quan tâm from created_at.
    expect(deriveCrmLifecycle({ ...base, status: "trial_booked", trialBookings: [{ createdAt: "2026-10-03T02:00:00Z", status: "scheduled" }] })[0])
      .toMatchObject({ date: "2026-10-01T03:00:00Z", state: "done" });
  });

  it("keeps the booking date for a current trial_booked step (booking does not move status_changed_at)", () => {
    const steps = deriveCrmLifecycle({
      ...base,
      status: "trial_booked",
      statusChangedAt: "2026-10-01T03:00:00Z",
      trialBookings: [{ createdAt: "2026-10-03T02:00:00Z", status: "scheduled" }],
    });
    expect(steps[1]).toMatchObject({ date: "2026-10-03T02:00:00Z", state: "current" });
  });

  it("ends a dropped case with Đã dừng, its date and reason, after only the steps it reached", () => {
    const steps = deriveCrmLifecycle({
      ...base,
      dropReason: "Học nơi khác",
      droppedAt: "2026-10-09T03:00:00Z",
      status: "dropped",
      trialBookings: [{ createdAt: "2026-10-02T04:00:00Z", status: "no_show" }],
    });
    expect(steps.map((step) => [step.label, step.state])).toEqual([
      ["Đang quan tâm", "done"],
      ["Đã đặt học thử", "done"],
      ["Đã dừng", "dropped"],
    ]);
    expect(steps[2]).toMatchObject({ date: "2026-10-09T03:00:00Z", note: "Học nơi khác" });
  });

  it("finishes a converted case on Đã nhập học with its conversion date", () => {
    const steps = deriveCrmLifecycle({ ...base, status: "converted", statusChangedAt: "2026-10-18T03:00:00Z", studentId: "student-1" });
    expect(steps.at(-1)).toMatchObject({ date: "2026-10-18T03:00:00Z", label: "Đã nhập học", state: "current" });
    expect(steps[3].state).toBe("done");
  });

  // Value: protects=the rail never dates a step with a legacy status_changed_at default and dates a conversion from the checklist completion stamped by the convert RPC;
  // fails_when=the current-step fallback reads statusChangedAt directly, or the converted step ignores checklist.completedAt;
  // why_new=fix pass 1 (F3); seam=none; no_claim=none beyond protects (pure function)
  it("leaves a legacy default undated and dates a conversion from the checklist completion", () => {
    const legacy = deriveCrmLifecycle({ ...base, status: "pending_enrollment_confirmation", statusChangedAt: "2026-10-12T08:00:00Z", studentId: "student-1" });
    expect(legacy[3]).toMatchObject({ date: null, state: "current" });

    const converted = deriveCrmLifecycle({
      ...base,
      checklist: { completedAt: "2026-10-08T03:00:00Z" },
      status: "converted",
      statusChangedAt: "2026-10-12T08:00:00Z",
      studentId: "student-1",
    });
    expect(converted.at(-1)).toMatchObject({ date: "2026-10-08T03:00:00Z", state: "current" });
  });
});

// A summary of mixed booleans is not reachable in production (the convert RPC
// writes all ten at once); it only exercises the per-item counting and hints.
const checklist: EnrollmentChecklistReadModel = {
  completedAt: null,
  completedByName: null,
  id: "checklist-1",
  isFullyCompleted: false,
  item10CommunicationGroupReady: false,
  item1PaymentReceived: false,
  item2SourceConfirmed: true,
  item3SaleConfirmed: true,
  item4ClassSelected: true,
  item5ModeConfirmed: true,
  item6FeeConfirmed: true,
  item7AssistantSessionsConfirmed: true,
  item8AccountantTransactionConfirmed: false,
  item9OfficialStartDateEntered: true,
};

describe("CRM checklist summary", () => {
  it("counts done items out of 10 and explains items a sale cannot tick", () => {
    const summary = summarizeCrmChecklist(checklist, { hasAccountantPermission: false });
    expect(summary).toMatchObject({ done: 7, initialized: true, total: 10 });
    expect(summary.items.filter((item) => !item.done).map((item) => item.number)).toEqual([1, 8, 10]);
    expect(summary.items[0].hint).toBe("Đánh dấu trong hộp thoại xác nhận chuyển đổi khi phiếu thu tuyển mới đã thanh toán.");
    expect(summary.items[7].hint).toBe("Người xác nhận chuyển đổi cần thêm quyền xác nhận giao dịch (kế toán).");
    expect(summary.items[9].hint).toBeNull();
  });

  it("drops the accountant hint for an accountant and reports an uninitialized checklist as 0/10", () => {
    expect(summarizeCrmChecklist(checklist, { hasAccountantPermission: true }).items[7].hint).toBeNull();
    expect(summarizeCrmChecklist(null, { hasAccountantPermission: true })).toMatchObject({ done: 0, initialized: false, total: 10 });
  });
});

describe("CRM assignment method words", () => {
  it("names the four stored methods and leaves an unknown code readable", () => {
    expect(["auto_round_robin", "manual_assign", "manual_transfer", "self_claim", "legacy"].map(formatAssignmentMethod)).toEqual([
      "Tự động chia đều",
      "Phân công tay",
      "Chuyển giao",
      "Tự nhận",
      "legacy",
    ]);
  });
});

// Value (extension, coverage pass 2): protects=hybrid and missing/unknown learning modes read as "Kết hợp" / "Chưa xác định" (never a raw code), and an unknown trial status (including a prototype key) shows as itself in a neutral badge;
// fails_when=the hybrid branch or the fallback is removed (raw "hybrid"/undefined leaks into list, header or trial rows), or the Object.hasOwn guard is replaced by a plain lookup so "constructor" yields a function label;
// why_new=list/detail tests only render online/offline and the four known trial statuses; seam=none; no_claim=none beyond protects (pure functions)
describe("CRM mode and trial status words", () => {
  it("names every mode with a readable fallback and keeps an unknown trial status neutral and literal", () => {
    expect(["online", "offline", "hybrid", "in_person", null, undefined, ""].map((mode) => formatCrmMode(mode))).toEqual([
      "Online",
      "Offline",
      "Kết hợp",
      "Chưa xác định",
      "Chưa xác định",
      "Chưa xác định",
      "Chưa xác định",
    ]);
    expect(getCrmTrialStatusMeta("no_show")).toEqual({ label: "Vắng", tone: "warning" });
    expect(getCrmTrialStatusMeta("rescheduled")).toEqual({ label: "rescheduled", tone: "neutral" });
    expect(getCrmTrialStatusMeta("constructor")).toEqual({ label: "constructor", tone: "neutral" });
  });
});

describe("CRM detail actions", () => {
  const all = { canConfirmOfficial: true, canTransfer: true, canUpdate: true };

  it("keeps the pre-redesign gates for every status", () => {
    const gates = (status: CrmCaseStatus) => {
      const actions = getCrmDetailActions({ ...all, status });
      return [actions.transfer, actions.bookTrial, actions.advance, actions.reopen, actions.drop, actions.convert, actions.editNotes];
    };
    expect(gates("interested")).toEqual([true, true, true, false, true, true, true]);
    expect(gates("trial_completed")).toEqual([true, true, true, false, true, true, true]);
    expect(gates("pending_enrollment_confirmation")).toEqual([true, true, false, false, true, true, true]);
    expect(gates("dropped")).toEqual([true, false, false, true, false, false, true]);
    expect(gates("converted")).toEqual([false, false, false, false, false, false, false]);
  });

  // Value (extension, coverage pass 1): protects=recording a trial result keeps the pre-redesign gate (crm.update and an open case) and every write action needs its own permission;
  // fails_when=recordTrialResult loses its isOpen or canUpdate check, or bookTrial/drop/reopen/advance/editNotes/transfer/convert stop requiring crm.update, crm.transfer or students.confirm_official;
  // why_new=the gate table above omits recordTrialResult and only runs with every permission granted; seam=none; no_claim=none beyond protects (pure function; the view wiring is in crm-detail-view)
  it("records trial results only on an open case with crm.update and grants nothing without permissions", () => {
    const statuses: CrmCaseStatus[] = ["interested", "trial_booked", "trial_completed", "pending_enrollment_confirmation", "converted", "dropped"];
    expect(statuses.map((status) => getCrmDetailActions({ ...all, status }).recordTrialResult)).toEqual([true, true, true, true, false, false]);

    const none = { canConfirmOfficial: false, canTransfer: false, canUpdate: false };
    for (const status of statuses) {
      const { advance, bookTrial, convert, drop, editNotes, recordTrialResult, reopen, transfer } = getCrmDetailActions({ ...none, status });
      expect({ advance, bookTrial, convert, drop, editNotes, recordTrialResult, reopen, transfer }).toEqual({
        advance: false,
        bookTrial: false,
        convert: false,
        drop: false,
        editNotes: false,
        recordTrialResult: false,
        reopen: false,
        transfer: false,
      });
    }
  });

  it("chooses one primary: conversion while waiting for it, else moving to waiting, else none", () => {
    expect(getCrmDetailActions({ ...all, status: "pending_enrollment_confirmation" }).primary).toBe("convert");
    expect(getCrmDetailActions({ ...all, status: "trial_booked" }).primary).toBe("advance");
    expect(getCrmDetailActions({ ...all, canConfirmOfficial: false, status: "pending_enrollment_confirmation" }).primary).toBeNull();
    expect(getCrmDetailActions({ ...all, canUpdate: false, status: "interested" }).primary).toBeNull();
    expect(getCrmDetailActions({ ...all, status: "converted" }).primary).toBeNull();
  });

  // Value: protects=a confirmer without sepay.accountant_confirm (admissions roles hold students.confirm_official but not it) is never handed conversion as the primary, keeps the dialog openable, and reads why it cannot be completed;
  // fails_when=primary becomes "convert" although checklist item 8 stays locked, convert turns false (the dialog disappears), or the reason is not the shared accountant hint;
  // why_new=step 10 fix pass 4 (P1); seam=none; no_claim=none beyond protects (pure function; the view wiring is in crm-detail-view)
  it("never makes conversion the primary without the accountant permission and says why", () => {
    const confirmer = { ...all, hasAccountantPermission: false };
    const pending = getCrmDetailActions({ ...confirmer, status: "pending_enrollment_confirmation" });
    expect(pending).toMatchObject({
      advance: false,
      conversionReason: "Người xác nhận chuyển đổi cần thêm quyền xác nhận giao dịch (kế toán).",
      convert: true,
      primary: null,
    });
    expect(getCrmDetailActions({ ...confirmer, status: "trial_booked" })).toMatchObject({ convert: true, primary: "advance" });
    expect(getCrmDetailActions({ ...confirmer, status: "dropped" }).conversionReason).toMatch(/^Lead đã dừng/);
    expect(getCrmDetailActions({ ...confirmer, status: "converted" }).conversionReason).toBeNull();
    expect(getCrmDetailActions({ ...all, hasAccountantPermission: true, status: "pending_enrollment_confirmation" }).primary).toBe("convert");
  });

  it("states why conversion is not offered", () => {
    expect(getCrmDetailActions({ ...all, canConfirmOfficial: false, status: "pending_enrollment_confirmation" }).conversionReason)
      .toBe("Xác nhận chuyển đổi cần quyền xác nhận học sinh chính thức.");
    expect(getCrmDetailActions({ ...all, status: "dropped" }).conversionReason)
      .toBe("Lead đã dừng. Mở lại lead trước khi đặt học thử hoặc xác nhận chuyển đổi.");
    expect(getCrmDetailActions({ ...all, dropReason: "Học nơi khác", droppedAt: "2026-10-09T03:00:00Z", status: "dropped" }).conversionReason)
      .toBe("Lead đã dừng ngày 09/10/2026: Học nơi khác. Mở lại lead trước khi đặt học thử hoặc xác nhận chuyển đổi.");
    expect(getCrmDetailActions({ ...all, canUpdate: false, dropReason: "Học nơi khác", droppedAt: "2026-10-09T03:00:00Z", status: "dropped" }).conversionReason)
      .toBe("Lead đã dừng ngày 09/10/2026: Học nơi khác. Cần quyền cập nhật CRM để mở lại.");
    expect(getCrmDetailActions({ ...all, status: "pending_enrollment_confirmation" }).conversionReason).toBeNull();
    expect(getCrmDetailActions({ ...all, canUpdate: false, dropReason: "Học nơi khác gần nhà!… ", status: "dropped" }).conversionReason)
      .toBe("Lead đã dừng: Học nơi khác gần nhà. Cần quyền cập nhật CRM để mở lại.");
    expect(getCrmDetailActions({ ...all, dropReason: "Học nơi khác.", status: "dropped" }).conversionReason)
      .toBe("Lead đã dừng: Học nơi khác. Mở lại lead trước khi đặt học thử hoặc xác nhận chuyển đổi.");
    expect(getCrmDetailActions({ ...all, canConfirmOfficial: false, status: "converted" }).conversionReason).toBeNull();
  });
});
