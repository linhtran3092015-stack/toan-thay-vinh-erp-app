// Value: protects=the /sessions/batch preview rules added in step 15a on top of calculateBatchOccurrences: listed holidays and drafts outside their template's effective window (the trigger's inclusive bounds) are blocked and never sent, a blocked draft keeps its own tick so removing the holiday restores it, duplicates stay deselected but choosable and past dates stay selected (today's rules), the summary counts holiday days (not sessions), duplicates, out-of-window and past drafts, "Chọn tất cả" only touches choosable drafts, holidays stay sorted/unique/valid, the create button's reason says 0 or more than 100, chip text and checkbox labels keep the pinned "Chọn buổi học ngày" format (unique per slot), and the caps the UI states (100 per request, 300 sessions for the duplicate check) match the schema and the loader;
// fails_when=a holiday or out-of-window draft reaches the request, a holiday wipes the user's tick, a duplicate becomes unchoosable or a past date unselected, the counts drift from the rows, the toggle selects a blocked draft, a malformed holiday is accepted, the cap or its wording drifts from session-batch-schema.ts / the loader's .limit(300), or calculateBatchOccurrences' outputs change under these helpers;
// why_new=step 15a adds batch-preview-models.ts (B3 holidays, B5 effective window, B7 cap, B2 chip labels) — pure, so it is unit-tested apart from the workspace;
// seam=pure functions; drafts come from the real calculateBatchOccurrences; the two caps are checked against the source text of the schema and the loader; no_claim=what the server or the RPC does with the request (session-batch-actions.test.ts), the workspace wiring (batch-session-creation.test.tsx)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { type BatchScheduleOption, calculateBatchOccurrences } from "@/features/sessions/batch-calculation";
import {
  addBatchHoliday,
  BATCH_DUPLICATE_CHECK_LIMIT,
  BATCH_MAX_SESSIONS_MESSAGE,
  BATCH_MAX_SESSIONS_PER_REQUEST,
  BATCH_MIN_SESSIONS_MESSAGE,
  buildBatchPreviewRows,
  formatBatchChipDate,
  getBatchCreateBlockReason,
  getBatchDraftCheckboxLabel,
  getBatchSessionKindLabel,
  getDatesWithSeveralDrafts,
  getSelectedBatchDrafts,
  hasUnselectedChoosableDraft,
  isDraftOutsideScheduleWindow,
  removeBatchHoliday,
  summarizeBatchPreview,
  toggleAllChoosableDrafts,
} from "@/features/sessions/batch-preview-models";

const tuesday: BatchScheduleOption = {
  classId: "cls-1",
  componentCode: null,
  effectiveFrom: "2026-09-01",
  effectiveTo: null,
  endTime: "19:30:00",
  id: "tpl-tue",
  learningMode: "offline",
  meetingUrl: null,
  roomName: "P.102",
  startTime: "17:30:00",
  weekday: 2,
};
// Starts on 2026-10-30 and ends on 2026-11-27: Fridays before or after fall outside it.
const friday: BatchScheduleOption = { ...tuesday, effectiveFrom: "2026-10-30", effectiveTo: "2026-11-27", id: "tpl-fri", weekday: 5 };

function drafts(options: { existing?: Array<{ date: string; template: string }>; startDate?: string; today?: string } = {}) {
  return calculateBatchOccurrences({
    count: 8,
    existingSessions: (options.existing ?? []).map((item) => ({
      endTime: "19:30:00",
      scheduleTemplateId: item.template,
      sessionDate: item.date,
      startTime: "17:30:00",
    })),
    rangeMode: "count",
    slots: [tuesday, friday].map((schedule) => ({
      endTime: schedule.endTime,
      learningMode: schedule.learningMode,
      scheduleTemplateId: schedule.id,
      startTime: schedule.startTime,
      weekday: schedule.weekday,
    })),
    startDate: options.startDate ?? "2026-10-20",
    today: options.today ?? "2026-10-19",
  });
}

const dates = (rows: Array<{ draft: { sessionDate: string } }>) => rows.map((row) => row.draft.sessionDate);

describe("batch preview rows", () => {
  it("flags drafts outside their template's window (inclusive bounds) and blocks them", () => {
    const list = drafts();
    // Tue 20/10, Fri 23/10 (before 30/10), Tue 27/10, Fri 30/10 (first day), …, Fri 27/11 (last day), Tue 1/12, Fri 4/12 (after)
    expect(dates(list.map((draft) => ({ draft })))).toEqual([
      "2026-10-20", "2026-10-23", "2026-10-27", "2026-10-30", "2026-11-03", "2026-11-06", "2026-11-10", "2026-11-13",
    ]);
    const rows = buildBatchPreviewRows(list, { holidays: [], schedules: [tuesday, friday] });

    const outside = rows.filter((row) => row.flag === "outside_window");
    expect(dates(outside)).toEqual(["2026-10-23"]);
    expect(outside[0]).toMatchObject({ blocked: true, selected: false });
    // The draft itself keeps the calculation's tick; only the effective selection drops.
    expect(outside[0].draft.selected).toBe(true);
    expect(rows.find((row) => row.draft.sessionDate === "2026-10-30")).toMatchObject({ blocked: false, flag: "none", selected: true });

    expect(isDraftOutsideScheduleWindow({ scheduleTemplateId: "tpl-fri", sessionDate: "2026-11-27" }, friday)).toBe(false);
    expect(isDraftOutsideScheduleWindow({ scheduleTemplateId: "tpl-fri", sessionDate: "2026-11-28" }, friday)).toBe(true);
    expect(isDraftOutsideScheduleWindow({ scheduleTemplateId: "tpl-fri", sessionDate: "2026-10-29" }, friday)).toBe(true);
    // Custom drafts (no template) have no window; an unknown template is not guessed at.
    expect(isDraftOutsideScheduleWindow({ scheduleTemplateId: null, sessionDate: "2020-01-01" }, friday)).toBe(false);
    expect(isDraftOutsideScheduleWindow({ scheduleTemplateId: "tpl-x", sessionDate: "2020-01-01" }, undefined)).toBe(false);
  });

  it("blocks holidays without touching the draft's own tick, so removing the holiday restores it", () => {
    const list = drafts();
    const withHoliday = buildBatchPreviewRows(list, { holidays: ["2026-11-03"], schedules: [tuesday, friday] });
    const holiday = withHoliday.find((row) => row.draft.sessionDate === "2026-11-03")!;
    expect(holiday).toMatchObject({ blocked: true, flag: "holiday", selected: false });
    expect(getSelectedBatchDrafts(withHoliday).map((draft) => draft.sessionDate)).not.toContain("2026-11-03");

    const without = buildBatchPreviewRows(list, { holidays: removeBatchHoliday(["2026-11-03"], "2026-11-03"), schedules: [tuesday, friday] });
    expect(without.find((row) => row.draft.sessionDate === "2026-11-03")).toMatchObject({ blocked: false, flag: "none", selected: true });

    // A draft the user unticked stays unticked after the holiday goes away.
    const unticked = list.map((draft) => (draft.sessionDate === "2026-11-03" ? { ...draft, selected: false } : draft));
    const restored = buildBatchPreviewRows(unticked, { holidays: [], schedules: [tuesday, friday] });
    expect(restored.find((row) => row.draft.sessionDate === "2026-11-03")?.selected).toBe(false);
  });

  it("keeps today's rules: duplicates deselected but choosable, past dates selected", () => {
    const list = drafts({ existing: [{ date: "2026-10-27", template: "tpl-tue" }], startDate: "2026-10-13", today: "2026-10-19" });
    const rows = buildBatchPreviewRows(list, { holidays: [], schedules: [tuesday, friday] });

    expect(rows.find((row) => row.draft.sessionDate === "2026-10-27")).toMatchObject({ blocked: false, flag: "duplicate", selected: false });
    expect(rows.find((row) => row.draft.sessionDate === "2026-10-13")).toMatchObject({ blocked: false, flag: "past", selected: true });
    // Ticking a duplicate by hand sends it (the server's own dedupe skips it).
    const ticked = list.map((draft) => (draft.sessionDate === "2026-10-27" ? { ...draft, selected: true } : draft));
    expect(buildBatchPreviewRows(ticked, { holidays: [], schedules: [tuesday, friday] }).find((row) => row.flag === "duplicate")?.selected).toBe(true);
  });

  it("orders flags outside window > holiday > duplicate > past", () => {
    const list = drafts({ existing: [{ date: "2026-10-23", template: "tpl-fri" }, { date: "2026-10-27", template: "tpl-tue" }], startDate: "2026-10-13" });
    const rows = buildBatchPreviewRows(list, { holidays: ["2026-10-23", "2026-10-27", "2026-10-13"], schedules: [tuesday, friday] });
    const flagOf = (date: string) => rows.find((row) => row.draft.sessionDate === date)?.flag;
    expect(flagOf("2026-10-23")).toBe("outside_window");
    expect(flagOf("2026-10-27")).toBe("holiday");
    expect(flagOf("2026-10-13")).toBe("holiday");
  });
});

describe("batch preview summary", () => {
  it("counts what the request carries, holiday days, duplicates, out-of-window and past drafts", () => {
    const list = drafts({ existing: [{ date: "2026-10-27", template: "tpl-tue" }], startDate: "2026-10-13" });
    const holidays = ["2026-11-03", "2026-11-06", "2026-12-25"];
    const rows = buildBatchPreviewRows(list, { holidays, schedules: [tuesday, friday] });
    const summary = summarizeBatchPreview(rows, holidays);

    expect(summary).toEqual({
      duplicates: 1,
      firstDate: "2026-10-13",
      holidayDays: 2,
      holidayHits: { "2026-11-03": 1, "2026-11-06": 1, "2026-12-25": 0 },
      lastDate: rows.at(-1)!.draft.sessionDate,
      outsideWindow: 2,
      past: 1,
      selected: rows.filter((row) => row.selected).length,
      total: 8,
    });
    expect(summary.selected).toBe(getSelectedBatchDrafts(rows).length);
    expect(summarizeBatchPreview([], [])).toMatchObject({ firstDate: null, lastDate: null, selected: 0, total: 0 });
  });
});

describe("batch preview selection helpers", () => {
  it("toggles every choosable draft and leaves blocked ones as they were", () => {
    const list = drafts({ existing: [{ date: "2026-10-27", template: "tpl-tue" }] });
    const rows = buildBatchPreviewRows(list, { holidays: ["2026-11-03"], schedules: [tuesday, friday] });
    expect(hasUnselectedChoosableDraft(rows)).toBe(true);

    const selectedAll = toggleAllChoosableDrafts(list, rows);
    const afterSelect = buildBatchPreviewRows(selectedAll, { holidays: ["2026-11-03"], schedules: [tuesday, friday] });
    expect(afterSelect.filter((row) => !row.blocked).every((row) => row.selected)).toBe(true);
    expect(afterSelect.filter((row) => row.blocked).every((row) => !row.selected)).toBe(true);
    expect(hasUnselectedChoosableDraft(afterSelect)).toBe(false);

    const cleared = toggleAllChoosableDrafts(selectedAll, afterSelect);
    const afterClear = buildBatchPreviewRows(cleared, { holidays: [], schedules: [tuesday, friday] });
    // Choosable drafts are cleared; the holiday draft kept its own tick and comes back once the holiday is removed.
    expect(afterClear.filter((row) => row.selected).map((row) => row.draft.sessionDate)).toEqual(["2026-11-03"]);
  });

  it("keeps holidays sorted, unique and valid", () => {
    expect(addBatchHoliday([], "2027-01-01")).toEqual(["2027-01-01"]);
    expect(addBatchHoliday(["2027-01-01"], "2026-11-20")).toEqual(["2026-11-20", "2027-01-01"]);
    expect(addBatchHoliday(["2026-11-20"], "2026-11-20")).toEqual(["2026-11-20"]);
    expect(addBatchHoliday(["2026-11-20"], "")).toEqual(["2026-11-20"]);
    expect(addBatchHoliday([], "2026-02-30")).toEqual([]);
    expect(addBatchHoliday([], "20/11/2026")).toEqual([]);
    expect(removeBatchHoliday(["2026-11-20", "2027-01-01"], "2026-11-20")).toEqual(["2027-01-01"]);
  });

  it("explains why the create button is disabled at 0 and above the cap", () => {
    expect(getBatchCreateBlockReason(0)).toBe(BATCH_MIN_SESSIONS_MESSAGE);
    expect(getBatchCreateBlockReason(1)).toBeNull();
    expect(getBatchCreateBlockReason(100)).toBeNull();
    expect(getBatchCreateBlockReason(101)).toBe("Mỗi đợt tạo tối đa 100 buổi học.");
  });
});

describe("batch preview labels", () => {
  it("formats chips as weekday + day/month and checkbox names with the pinned prefix", () => {
    expect(formatBatchChipDate({ sessionDate: "2026-11-03", weekday: 2 })).toBe("T3 03/11");
    expect(formatBatchChipDate({ sessionDate: "2026-11-08", weekday: 7 })).toBe("CN 08/11");
    expect(getBatchDraftCheckboxLabel({ sessionDate: "2026-11-03", startTime: "17:30" })).toBe("Chọn buổi học ngày 03/11/2026");
    expect(getBatchDraftCheckboxLabel({ sessionDate: "2026-11-03", startTime: "17:30:00" }, { withTime: true })).toBe(
      "Chọn buổi học ngày 03/11/2026 lúc 17:30",
    );
  });

  it("finds dates holding two drafts so their labels stay unique", () => {
    const list = calculateBatchOccurrences({
      count: 4,
      rangeMode: "count",
      slots: [
        { endTime: "09:00", learningMode: "offline", scheduleTemplateId: "a", startTime: "07:30", weekday: 2 },
        { endTime: "11:00", learningMode: "offline", scheduleTemplateId: "b", startTime: "09:30", weekday: 2 },
      ],
      startDate: "2026-10-20",
      today: "2026-10-19",
    });
    const rows = buildBatchPreviewRows(list, { holidays: [], schedules: [] });
    expect([...getDatesWithSeveralDrafts(rows)]).toEqual(["2026-10-20", "2026-10-27"]);
  });

  it("names the session kind the strategy produces", () => {
    expect(getBatchSessionKindLabel("template")).toEqual({ detail: "theo lịch cố định", kind: "Buổi chính" });
    expect(getBatchSessionKindLabel("custom")).toEqual({ detail: "lịch lặp tùy chỉnh", kind: "Buổi bổ sung" });
  });
});

describe("caps stated by the batch UI", () => {
  it("matches the request schema's .max(100) and its wording", () => {
    const schema = readFileSync(join(process.cwd(), "src/features/sessions/forms/session-batch-schema.ts"), "utf8");
    expect(schema).toContain(`.max(${BATCH_MAX_SESSIONS_PER_REQUEST}, "${BATCH_MAX_SESSIONS_MESSAGE}")`);
    expect(schema).toContain(`.min(1, "${BATCH_MIN_SESSIONS_MESSAGE}")`);
  });

  it("matches the loader's .limit(300) on existing sessions", () => {
    const loader = readFileSync(join(process.cwd(), "src/features/sessions/batch-data.ts"), "utf8");
    expect(loader).toContain(`.limit(${BATCH_DUPLICATE_CHECK_LIMIT})`);
  });
});
