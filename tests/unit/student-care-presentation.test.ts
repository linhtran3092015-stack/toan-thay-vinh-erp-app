// Value: protects=the queue's derived words (overdue duration, evidence summary in vi-VN decimals, status tones, one-action-per-row choice) and its URL state (first value wins, invalid values dropped, one quick chip at a time) stay correct after the step 11a redesign;
// fails_when=overdue text measures from the wrong deadline or rounds wrongly, scores lose the decimal comma, a status maps to a different tone, a row offers claim to someone who cannot claim, a repeated or invalid URL value reaches the RPC filter, or a chip leaves another chip's filter set;
// why_new=step 11a adds these pure helpers; seam=pure functions only; no_claim=does not render components
import { describe, expect, it } from "vitest";

import {
  careStatusTones,
  formatCareClock,
  formatCareOverdue,
  formatCareRelative,
  getCareOwnerEvent,
  getCareRowAction,
  getCareSignalLines,
  getCareTaskAbilities,
  summarizeCareEvidence,
} from "@/features/student-care/student-care-presentation";
import {
  applyCareChip,
  countCareActiveFilters,
  getCareActiveChip,
  getCareSearchParamValues,
  getCareTab,
  parseCareFilter,
  parseCareMonthInput,
  toCareRouteSearchParams,
  withCareQuery,
} from "@/features/student-care/student-care-url-state";

const NOW = Date.parse("2026-10-13T07:05:00Z");
const deadlines = { claim_due_at: null, contact_due_at: null, due_at: null, first_contact_at: null, next_followup_at: null, owner_id: "u1" };
const session = (date: string, status: string | null, score: number | null) => ({
  attendance_status: status,
  class_name: "Toán 9A",
  session_date: date,
  session_id: date,
  start_time: "19:30:00",
  test_score: score,
});

describe("student care presentation", () => {
  it("states how long a row is overdue from the shown deadline", () => {
    expect(formatCareOverdue({ ...deadlines, contact_due_at: "2026-10-13T05:05:00Z" }, NOW)).toBe("Quá hạn 2 giờ");
    expect(formatCareOverdue({ ...deadlines, contact_due_at: "2026-10-12T05:05:00Z" }, NOW)).toBe("Quá hạn 1 ngày");
    expect(formatCareOverdue({ ...deadlines, next_followup_at: "2026-10-13T06:50:00Z" }, NOW)).toBe("Quá hạn 15 phút");
    // The follow-up wins over the first-contact due, as in the "Hạn liên hệ" column.
    expect(formatCareOverdue({ ...deadlines, contact_due_at: "2026-10-10T07:05:00Z", next_followup_at: "2026-10-13T04:05:00Z" }, NOW)).toBe("Quá hạn 3 giờ");
  });

  it("falls back to the passed claim deadline when the shown deadline is still ahead", () => {
    expect(formatCareOverdue({ ...deadlines, claim_due_at: "2026-10-13T03:05:00Z", contact_due_at: "2026-10-14T07:05:00Z", owner_id: null }, NOW)).toBe("Quá hạn 4 giờ");
    expect(formatCareOverdue({ ...deadlines, contact_due_at: "2026-10-14T07:05:00Z" }, NOW)).toBe("Quá hạn");
  });

  it("summarises evidence with dates and vi-VN decimal scores", () => {
    expect(summarizeCareEvidence("low_test_streak", [session("2026-10-07", "present", 5.5), session("2026-10-12", "present", 4)])).toBe("5,5 · 4,0");
    expect(summarizeCareEvidence("absence_streak", [session("2026-10-07", "unexcused_absence", null), session("2026-10-12", "unexcused_absence", null)])).toBe("07/10, 12/10 không phép");
    expect(summarizeCareEvidence("absence_streak", [session("2026-10-07", "excused_absence", null), session("2026-10-12", "unexcused_absence", null)])).toBe("07/10, 12/10");
    expect(summarizeCareEvidence("absence_month", [session("2026-10-02", "excused_absence", null), session("2026-10-06", "unexcused_absence", null), session("2026-10-09", "unexcused_absence", null)])).toBe("3 buổi T10");
  });

  it("labels the signal cell by rule for alerts and by kind otherwise", () => {
    const alert = { evidence: { low_test_streak: [session("2026-10-07", "present", 5.5)], absence_streak: [session("2026-10-07", "unexcused_absence", null)] }, first_contact_at: null, kind: "alert" as const, period_month: null, status: "open" as const };
    expect(getCareSignalLines(alert).map((line) => line.label)).toEqual(["Vắng 2 buổi liên tiếp", "Hai bài có điểm gần nhất dưới 6"]);
    expect(getCareSignalLines({ ...alert, evidence: {}, kind: "monthly", period_month: "2026-10-01" })).toEqual([{ detail: "chưa có liên hệ", label: "Coaching tháng 10" }]);
    expect(getCareSignalLines({ ...alert, evidence: {}, kind: "monthly", period_month: "2026-10-01", status: "completed" })[0].detail).toBe("");
  });

  it("maps every status to its tone", () => {
    expect(careStatusTones).toEqual({ cancelled: "neutral", completed: "success", following_up: "warning", in_progress: "info", open: "neutral" });
  });

  it("offers claim only on an unowned, unstarted task to a handler", () => {
    expect(getCareRowAction({ owner_id: null, status: "open" }, true)).toBe("claim");
    expect(getCareRowAction({ owner_id: null, status: "open" }, false)).toBe("open");
    expect(getCareRowAction({ owner_id: "u1", status: "open" }, true)).toBe("open");
    expect(getCareRowAction({ owner_id: null, status: "following_up" }, true)).toBe("open");
  });

  it("keeps the pre-redesign edit and claim rules on the task page", () => {
    expect(getCareTaskAbilities({ canAssign: false, canHandle: true, task: { owner_id: "u2", status: "in_progress" }, userId: "u1" })).toEqual({ canCancel: false, canClaim: false, canEdit: false, canReassign: false, closed: false, needsOwner: false });
    expect(getCareTaskAbilities({ canAssign: false, canHandle: true, task: { owner_id: "u1", status: "open" }, userId: "u1" })).toMatchObject({ canClaim: true, canEdit: true });
    expect(getCareTaskAbilities({ canAssign: true, canHandle: true, task: { owner_id: "u1", status: "completed" }, userId: "u1" })).toEqual({ canCancel: false, canClaim: false, canEdit: false, canReassign: false, closed: true, needsOwner: false });
  });

  // Value: protects=the task page offers only commands mutate_student_care accepts: nothing that needs an owner (contact, schedule, Coaching, complete, cancel) on an unowned task, and no assign or cancel without student_care.handle;
  // fails_when=an unowned task offers the contact form or the exception to a manager (RPC: STUDENT_CARE_CLAIM_FIRST), or an assign-only viewer gets "Giao cho người khác" / "Ngoại lệ" (mutateCare: no handle permission);
  // why_new=F9/F11 of the step 11a ship review; seam=pure function; no_claim=the RPC still enforces both rules
  it("needs an owner before contact or exception, and student_care.handle for every command", () => {
    expect(getCareTaskAbilities({ canAssign: true, canHandle: true, task: { owner_id: null, status: "open" }, userId: "u1" })).toEqual({ canCancel: false, canClaim: true, canEdit: false, canReassign: true, closed: false, needsOwner: true });
    expect(getCareTaskAbilities({ canAssign: true, canHandle: true, task: { owner_id: null, status: "following_up" }, userId: "u1" })).toMatchObject({ canCancel: false, canEdit: false, canReassign: true, needsOwner: true });
    expect(getCareTaskAbilities({ canAssign: true, canHandle: true, task: { owner_id: "u2", status: "in_progress" }, userId: "u1" })).toMatchObject({ canCancel: true, canEdit: true, canReassign: true, needsOwner: false });
    expect(getCareTaskAbilities({ canAssign: true, canHandle: false, task: { owner_id: "u2", status: "in_progress" }, userId: "u1" })).toEqual({ canCancel: false, canClaim: false, canEdit: false, canReassign: false, closed: false, needsOwner: false });
  });

  // payload.owner_id is what mutate_student_care logs for assign / assign_student (null for a claim: its owner is the actor).
  const ownerEvent = (id: string, event_type: string, occurred_at: string, task_id: string | null = "t1", owner_id: string | null = null) => ({
    event_type,
    id,
    occurred_at,
    payload: owner_id ? { owner_id } : {},
    task_id,
  });
  const ownedTask = (kind: "alert" | "monthly" | "followup", owner_id: string | null = "u1") => ({ completed_at: null, detected_at: "2026-10-12T00:00:00Z", id: "t1", kind, owner_id });

  it("dates the owner by the latest claim or assign of this task", () => {
    const event = ownerEvent;
    expect(getCareOwnerEvent([event("a", "claim", "2026-10-13T01:10:00Z"), event("b", "contact", "2026-10-13T02:00:00Z")], ownedTask("alert"))).toEqual({ at: "2026-10-13T01:10:00Z", kind: "claim" });
    expect(getCareOwnerEvent([event("a", "claim", "2026-10-13T01:10:00Z"), event("b", "assign", "2026-10-13T03:00:00Z", "t1", "u1"), event("c", "assign", "2026-10-13T05:00:00Z", "t2", "u1")], ownedTask("alert"))).toEqual({ at: "2026-10-13T03:00:00Z", kind: "assign" });
    expect(getCareOwnerEvent([event("a", "contact", "2026-10-13T01:10:00Z")], ownedTask("alert"))).toBeNull();
  });

  // Value: protects=the header's "(nhận …)" / "(được giao …)" names how the current owner got the task, including a long-term assignment (assign_student logs task_id NULL while it moves the student's open monthly/followup tasks);
  // fails_when=a claim by A still reads "nhận" after assign_student moved the task to B, an assign_student is ignored, or an event naming someone else dates the current owner;
  // why_new=G7 of the step 11a ship review (cycle 2), verified in 20260917101000_student_care_workflows.sql (assign_student loop, events insert with payload owner_id); seam=pure function; no_claim=does not read the RPC
  it("counts a long-term assignment and shows a date only for an event naming the current owner", () => {
    const event = ownerEvent;
    const claimByA = event("a", "claim", "2026-10-13T01:10:00Z");
    // claim by A, then assign_student to B: B is the owner and it was given, not claimed.
    expect(getCareOwnerEvent([claimByA, event("s", "assign_student", "2026-10-13T03:00:00Z", null, "uB")], ownedTask("followup", "uB"))).toEqual({ at: "2026-10-13T03:00:00Z", kind: "assign" });
    // assign_student to the current owner: "được giao".
    expect(getCareOwnerEvent([event("s", "assign_student", "2026-10-13T03:00:00Z", null, "u1")], ownedTask("monthly"))).toEqual({ at: "2026-10-13T03:00:00Z", kind: "assign" });
    // The latest owner-changing event names someone else: no date rather than a wrong one.
    expect(getCareOwnerEvent([claimByA, event("s", "assign_student", "2026-10-13T03:00:00Z", null, "uB")], ownedTask("followup", "u1"))).toBeNull();
    expect(getCareOwnerEvent([event("b", "assign", "2026-10-13T03:00:00Z", "t1", "uB")], ownedTask("alert"))).toBeNull();
    // assign_student does not move an alert, nor a task created after it or closed before it.
    expect(getCareOwnerEvent([claimByA, event("s", "assign_student", "2026-10-13T03:00:00Z", null, "uB")], ownedTask("alert"))).toEqual({ at: "2026-10-13T01:10:00Z", kind: "claim" });
    expect(getCareOwnerEvent([event("s", "assign_student", "2026-10-11T03:00:00Z", null, "u1")], ownedTask("monthly"))).toBeNull();
    expect(getCareOwnerEvent([claimByA, event("s", "assign_student", "2026-10-14T03:00:00Z", null, "uB")], { ...ownedTask("followup"), completed_at: "2026-10-13T05:00:00Z" })).toEqual({ at: "2026-10-13T01:10:00Z", kind: "claim" });
    // An unowned task has no owner date.
    expect(getCareOwnerEvent([claimByA], ownedTask("followup", null))).toBeNull();
  });

  it("formats the generator clock and age", () => {
    expect(formatCareClock("2026-10-13T07:02:00Z", NOW)).toBe("14:02");
    expect(formatCareClock("2026-10-12T23:00:00Z", NOW)).toBe("06:00");
    expect(formatCareClock("2026-10-11T23:00:00Z", NOW)).toBe("12/10 06:00");
    expect(formatCareRelative("2026-10-13T07:02:00Z", NOW)).toBe("3 phút trước");
    expect(formatCareRelative("2026-10-13T07:04:40Z", NOW)).toBe("vừa xong");
    expect(formatCareRelative("2026-10-13T04:35:00Z", NOW)).toBe("2 giờ trước");
    expect(formatCareRelative("2026-10-09T07:00:00Z", NOW)).toBe("4 ngày trước");
    expect(formatCareRelative(null, NOW)).toBeNull();
  });
});

describe("student care URL state", () => {
  it("reads the first value of a repeated key and drops invalid values", () => {
    const values = getCareSearchParamValues(toCareRouteSearchParams("kind=alert&kind=monthly&status=bad&month=2026-13&page=-2&student_id=x&search=%20An%20"));
    expect(parseCareFilter(values)).toEqual({ kind: "alert", page: 1, search: "An" });
    expect(parseCareFilter({ month: "2026-10", search: "a".repeat(200) }).search).toHaveLength(160);
    expect(parseCareFilter({ month: "2026-10" }).month).toBe("2026-10-01");
    expect(getCareTab("inactive")).toBe("inactive");
    expect(getCareTab("other")).toBe("tasks");
  });

  it("allows one chip at a time and keeps search, month and a real status", () => {
    const filter = parseCareFilter({ kind: "alert", month: "2026-09", search: "Bảo", status: "in_progress" });
    expect(getCareActiveChip(filter)).toBe("alert");
    const overdue = applyCareChip(filter, "overdue");
    expect(overdue).toMatchObject({ kind: undefined, month: "2026-09-01", overdue: "true", page: 1, search: "Bảo", status: "in_progress" });
    expect(getCareActiveChip(overdue)).toBe("overdue");
    const unassigned = applyCareChip(overdue, "unassigned");
    expect(unassigned).toMatchObject({ overdue: undefined, status: "unassigned" });
    expect(applyCareChip(unassigned, "all")).toMatchObject({ kind: undefined, mine: undefined, overdue: undefined, status: undefined });
    expect(getCareActiveChip(parseCareFilter({}))).toBe("all");
    expect(getCareActiveChip(parseCareFilter({ kind: "alert", mine: "true" }))).toBeNull();
  });

  // Value: protects="Tất cả" is not shown active while a filter-bar status narrows the list (it would claim every task is shown);
  // fails_when=getCareActiveChip returns "all" whenever no chip-owned filter is set; why_new=F6 of the step 11a ship review; seam=pure function; no_claim=none
  it("activates no chip while a filter-bar status applies", () => {
    expect(getCareActiveChip(parseCareFilter({ status: "in_progress" }))).toBeNull();
    expect(getCareActiveChip(parseCareFilter({ status: "unassigned" }))).toBe("unassigned");
    expect(getCareActiveChip(parseCareFilter({ month: "2026-09", search: "An" }))).toBe("all");
  });

  // Value: protects=a month typed by hand (Safari/Firefox show a text box for type=month) reaches the URL only when whole;
  // fails_when=a partial "2026-1" or "2026-13" becomes a filter change; why_new=F4 of the step 11a ship review; seam=pure function; no_claim=none
  it("accepts only a whole YYYY-MM from the month input", () => {
    expect(parseCareMonthInput("2026-09")).toBe("2026-09-01");
    expect(parseCareMonthInput("")).toBeUndefined();
    for (const partial of ["2", "2026", "2026-", "2026-1", "2026-13", "2026-00", "26-09"]) expect(parseCareMonthInput(partial)).toBeNull();
  });

  it("rewrites only its own keys and counts active filters", () => {
    expect(withCareQuery("view=list&role=owner&kind=alert&page=3", { overdue: "true", page: 1 })).toBe("view=list&role=owner&overdue=true");
    expect(withCareQuery("view=list&kind=alert", {}, "inactive")).toBe("view=list&tab=inactive");
    expect(countCareActiveFilters(parseCareFilter({ kind: "alert", mine: "true", search: "An" }))).toBe(3);
    expect(countCareActiveFilters(parseCareFilter({ kind: "alert", search: "An" }), "assignments")).toBe(1);
  });
});
