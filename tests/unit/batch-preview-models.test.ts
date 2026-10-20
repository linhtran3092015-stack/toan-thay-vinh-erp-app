// Value: protects=the /sessions/batch preview rules added in step 15a on top of calculateBatchOccurrences: listed holidays, duplicates of existing sessions (the server's own rule on the draft's current date/start time/template, so an edited time can make or clear one) and drafts outside their template's effective window (the trigger's inclusive bounds) are blocked and never sent nor counted, a blocked draft keeps its own tick so removing the holiday restores it, past dates stay selected, the summary counts holiday days (not sessions), duplicates, out-of-window and past drafts, "Chọn tất cả" only touches choosable drafts, holidays stay sorted/unique/valid, the create button's reason says 0 or more than 100, chip text and checkbox labels keep the pinned "Chọn buổi học ngày" format (unique per slot), and the caps the UI states (100 per request, 300 sessions for the duplicate check) match the schema and the loader;
// fails_when=a holiday, duplicate or out-of-window draft reaches the request or the count, the duplicate flag is read from the calculation's statusConflict instead of the draft's current values, the client rule drifts from session-batch-actions.ts, a holiday wipes the user's tick, a past date is unselected, the counts drift from the rows, the toggle selects a blocked draft, a malformed holiday is accepted, the cap or its wording drifts from session-batch-schema.ts / the loader's .limit(300), or calculateBatchOccurrences' outputs change under these helpers;
// why_new=step 15a adds batch-preview-models.ts (B3 holidays, B5 effective window, B7 cap, B2 chip labels) — pure, so it is unit-tested apart from the workspace;
// seam=pure functions; drafts come from the real calculateBatchOccurrences; the two caps are checked against the source text of the schema and the loader; no_claim=what the server or the RPC does with the request (session-batch-actions.test.ts), the workspace wiring (batch-session-creation.test.tsx)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { type BatchScheduleOption, calculateBatchOccurrences, type ExistingSessionSnapshot } from "@/features/sessions/batch-calculation";
import {
  addBatchHoliday,
  BATCH_DUPLICATE_CHECK_LIMIT,
  BATCH_MAX_SESSIONS_MESSAGE,
  BATCH_MAX_SESSIONS_PER_REQUEST,
  BATCH_MIN_SESSIONS_MESSAGE,
  BATCH_PREVIEW_FLAG_WORDS,
  buildBatchPreviewRows,
  formatBatchChipDate,
  getBatchCreateBlockReason,
  getBatchDraftCheckboxLabel,
  getBatchDraftRowStatus,
  getBatchSessionKindLabel,
  getDatesWithSeveralDrafts,
  getSelectedBatchDrafts,
  hasUnselectedChoosableDraft,
  isDraftDuplicateOfExisting,
  isDraftOutsideScheduleWindow,
  isSameBatchPreviewRow,
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

type ExistingInput = Array<{ date: string; startTime?: string; template: string | null }>;

function existing(items: ExistingInput = []): ExistingSessionSnapshot[] {
  return items.map((item) => ({
    endTime: "19:30:00",
    scheduleTemplateId: item.template,
    sessionDate: item.date,
    startTime: item.startTime ?? "17:30:00",
  }));
}

function drafts(options: { existing?: ExistingInput; startDate?: string; today?: string } = {}) {
  return calculateBatchOccurrences({
    count: 8,
    existingSessions: existing(options.existing),
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

/** buildBatchPreviewRows with the workspace's inputs: same existing sessions as the calculation, today 2026-10-19. */
function rowsOf(
  list: ReturnType<typeof drafts>,
  options: { existing?: ExistingInput; holidays?: string[]; schedules?: BatchScheduleOption[]; today?: string } = {},
) {
  return buildBatchPreviewRows(list, {
    existingSessions: existing(options.existing),
    holidays: options.holidays ?? [],
    schedules: options.schedules ?? [tuesday, friday],
    today: options.today ?? "2026-10-19",
  });
}

describe("batch preview rows", () => {
  it("flags drafts outside their template's window (inclusive bounds) and blocks them", () => {
    const list = drafts();
    // Tue 20/10, Fri 23/10 (before 30/10), Tue 27/10, Fri 30/10 (first day), …, Fri 27/11 (last day), Tue 1/12, Fri 4/12 (after)
    expect(dates(list.map((draft) => ({ draft })))).toEqual([
      "2026-10-20", "2026-10-23", "2026-10-27", "2026-10-30", "2026-11-03", "2026-11-06", "2026-11-10", "2026-11-13",
    ]);
    const rows = rowsOf(list);

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
    const withHoliday = rowsOf(list, { holidays: ["2026-11-03"] });
    const holiday = withHoliday.find((row) => row.draft.sessionDate === "2026-11-03")!;
    expect(holiday).toMatchObject({ blocked: true, flag: "holiday", selected: false });
    expect(getSelectedBatchDrafts(withHoliday).map((draft) => draft.sessionDate)).not.toContain("2026-11-03");

    const without = rowsOf(list, { holidays: removeBatchHoliday(["2026-11-03"], "2026-11-03") });
    expect(without.find((row) => row.draft.sessionDate === "2026-11-03")).toMatchObject({ blocked: false, flag: "none", selected: true });

    // A draft the user unticked stays unticked after the holiday goes away.
    const unticked = list.map((draft) => (draft.sessionDate === "2026-11-03" ? { ...draft, selected: false } : draft));
    const restored = rowsOf(unticked);
    expect(restored.find((row) => row.draft.sessionDate === "2026-11-03")?.selected).toBe(false);
  });

  it("blocks duplicates like holidays (never sent, never counted) and keeps past dates selected", () => {
    const duplicates: ExistingInput = [{ date: "2026-10-27", template: "tpl-tue" }];
    const list = drafts({ existing: duplicates, startDate: "2026-10-13", today: "2026-10-19" });
    const rows = rowsOf(list, { existing: duplicates });

    expect(rows.find((row) => row.draft.sessionDate === "2026-10-27")).toMatchObject({ blocked: true, flag: "duplicate", selected: false });
    expect(rows.find((row) => row.draft.sessionDate === "2026-10-13")).toMatchObject({ blocked: false, flag: "past", selected: true });
    // Even a duplicate ticked by hand is neither sent nor counted against the cap.
    const ticked = list.map((draft) => (draft.sessionDate === "2026-10-27" ? { ...draft, selected: true } : draft));
    const tickedRows = rowsOf(ticked, { existing: duplicates });
    expect(tickedRows.find((row) => row.flag === "duplicate")).toMatchObject({ blocked: true, selected: false });
    expect(getSelectedBatchDrafts(tickedRows).map((draft) => draft.sessionDate)).not.toContain("2026-10-27");
    expect(summarizeBatchPreview(tickedRows, []).selected).toBe(getSelectedBatchDrafts(tickedRows).length);
    expect(summarizeBatchPreview(tickedRows, [])).toMatchObject({ duplicates: 1 });
  });

  it("recomputes duplicates from each draft's current date, start time and template with the server's rule", () => {
    // 27/10: the Tuesday template already has a session. 03/11: a custom session (no template) at 17:30.
    const sessions: ExistingInput = [
      { date: "2026-10-27", startTime: "17:30:00", template: "tpl-tue" },
      { date: "2026-11-03", startTime: "17:30:00", template: null },
    ];
    const list = drafts({ existing: sessions, startDate: "2026-10-13" });
    const flagOf = (rows: ReturnType<typeof rowsOf>, date: string) => rows.find((row) => row.draft.sessionDate === date)?.flag;
    const edit = (date: string, startTime: string) => list.map((draft) => (draft.sessionDate === date ? { ...draft, startTime } : draft));

    // Same template on that date: still a duplicate whatever the time.
    expect(flagOf(rowsOf(edit("2026-10-27", "18:15"), { existing: sessions }), "2026-10-27")).toBe("duplicate");
    // No template match: the start time decides (HH:MM, seconds ignored), both ways.
    expect(flagOf(rowsOf(list, { existing: sessions }), "2026-11-03")).toBe("duplicate");
    const moved = rowsOf(edit("2026-11-03", "18:15"), { existing: sessions });
    expect(moved.find((row) => row.draft.sessionDate === "2026-11-03")).toMatchObject({ blocked: false, flag: "none" });
    // A draft the calculation found clear becomes a duplicate when its time is edited onto an existing one.
    const clearList = drafts({ startDate: "2026-10-13" });
    const collided = rowsOf(clearList.map((draft) => (draft.sessionDate === "2026-11-03" ? { ...draft, startTime: "17:30" } : draft)), { existing: sessions });
    expect(clearList.find((draft) => draft.sessionDate === "2026-11-03")?.statusConflict).toBe("none");
    expect(collided.find((row) => row.draft.sessionDate === "2026-11-03")).toMatchObject({ blocked: true, flag: "duplicate", selected: false });
    // A past date that stops being a duplicate reads as past again (today, not the calculation's flag).
    const pastDuplicate: ExistingInput = [{ date: "2026-10-13", startTime: "17:30:00", template: null }];
    const pastList = drafts({ existing: pastDuplicate, startDate: "2026-10-13" });
    expect(pastList[0].statusConflict).toBe("duplicate");
    expect(flagOf(rowsOf(pastList.map((draft, index) => (index === 0 ? { ...draft, startTime: "18:15" } : draft)), { existing: pastDuplicate }), "2026-10-13")).toBe("past");
    // Another date never matches.
    expect(isDraftDuplicateOfExisting({ scheduleTemplateId: "tpl-tue", sessionDate: "2026-10-20", startTime: "17:30" }, existing(sessions))).toBe(false);
  });

  it("states each editor row's status in words", () => {
    // review C2-10: one wording per state — the badge says what the chip says ("đã có (bỏ qua)").
    expect(getBatchDraftRowStatus({ flag: "duplicate", selected: false })).toEqual({ label: "Đã có (bỏ qua)", tone: "warning" });
    expect(getBatchDraftRowStatus({ flag: "outside_window", selected: false })).toEqual({ label: "Ngoài hiệu lực", tone: "danger" });
    expect(getBatchDraftRowStatus({ flag: "past", selected: true })).toEqual({ label: "Đã qua", tone: "neutral" });
    for (const flag of ["duplicate", "outside_window", "past"] as const) {
      expect(getBatchDraftRowStatus({ flag, selected: false }).label.toLocaleLowerCase("vi"), flag).toBe(BATCH_PREVIEW_FLAG_WORDS[flag]);
    }
    expect(getBatchDraftRowStatus({ flag: "none", selected: true })).toEqual({ label: "Sẽ tạo", tone: "success" });
    expect(getBatchDraftRowStatus({ flag: "none", selected: false })).toEqual({ label: "Bỏ chọn", tone: "neutral" });
    expect(getBatchDraftRowStatus({ flag: "holiday", selected: false })).toEqual({ label: "Ngày nghỉ", tone: "neutral" });
  });

  it("treats a rebuilt row as the same row only when its draft, flag and tick are unchanged", () => {
    const list = drafts();
    const [first] = rowsOf(list);
    expect(isSameBatchPreviewRow(first, rowsOf(list)[0])).toBe(true);
    expect(isSameBatchPreviewRow(first, rowsOf([{ ...list[0] }, ...list.slice(1)])[0])).toBe(false);
    expect(isSameBatchPreviewRow(first, rowsOf(list, { holidays: [list[0].sessionDate] })[0])).toBe(false);
  });

  it("orders flags outside window > holiday > duplicate > past", () => {
    const list = drafts({ existing: [{ date: "2026-10-23", template: "tpl-fri" }, { date: "2026-10-27", template: "tpl-tue" }], startDate: "2026-10-13" });
    const rows = rowsOf(list, {
      existing: [{ date: "2026-10-23", template: "tpl-fri" }, { date: "2026-10-27", template: "tpl-tue" }],
      holidays: ["2026-10-23", "2026-10-27", "2026-10-13"],
    });
    const flagOf = (date: string) => rows.find((row) => row.draft.sessionDate === date)?.flag;
    expect(flagOf("2026-10-23")).toBe("outside_window");
    expect(flagOf("2026-10-27")).toBe("holiday");
    expect(flagOf("2026-10-13")).toBe("holiday");
  });
});

describe("batch preview summary", () => {
  it("counts what the request carries, holiday days, duplicates, out-of-window and past drafts", () => {
    const duplicates: ExistingInput = [{ date: "2026-10-27", template: "tpl-tue" }];
    const list = drafts({ existing: duplicates, startDate: "2026-10-13" });
    const holidays = ["2026-11-03", "2026-11-06", "2026-12-25"];
    const rows = rowsOf(list, { existing: duplicates, holidays });
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
  it("toggles every choosable draft and leaves blocked ones (holiday, duplicate, out of window) as they were", () => {
    const duplicates: ExistingInput = [{ date: "2026-10-27", template: "tpl-tue" }];
    // 20/10 unticked by hand: the only choosable draft left to tick (the duplicate is blocked).
    const list = drafts({ existing: duplicates }).map((draft) => (draft.sessionDate === "2026-10-20" ? { ...draft, selected: false } : draft));
    const rows = rowsOf(list, { existing: duplicates, holidays: ["2026-11-03"] });
    expect(hasUnselectedChoosableDraft(rows)).toBe(true);
    expect(hasUnselectedChoosableDraft(rowsOf(drafts({ existing: duplicates }), { existing: duplicates, holidays: ["2026-11-03"] }))).toBe(false);

    const selectedAll = toggleAllChoosableDrafts(list, rows);
    // "Chọn tất cả" never ticks the duplicate: its own tick stays the calculation's (false).
    expect(selectedAll.find((draft) => draft.sessionDate === "2026-10-27")?.selected).toBe(false);
    const afterSelect = rowsOf(selectedAll, { existing: duplicates, holidays: ["2026-11-03"] });
    expect(afterSelect.filter((row) => !row.blocked).every((row) => row.selected)).toBe(true);
    expect(afterSelect.filter((row) => row.blocked).every((row) => !row.selected)).toBe(true);
    expect(afterSelect.filter((row) => row.blocked).map((row) => row.flag).sort()).toEqual(["duplicate", "holiday", "outside_window"]);
    expect(hasUnselectedChoosableDraft(afterSelect)).toBe(false);

    const cleared = toggleAllChoosableDrafts(selectedAll, afterSelect);
    const afterClear = rowsOf(cleared, { existing: duplicates });
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
    const rows = rowsOf(list, { schedules: [] });
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

  it("flags duplicates with the create action's own rule (same date; same template, else same HH:MM start)", () => {
    const action = readFileSync(join(process.cwd(), "src/features/sessions/actions/session-batch-actions.ts"), "utf8");
    expect(action).toContain("if (ex.session_date !== s.sessionDate) return false;");
    expect(action).toContain("if (s.scheduleTemplateId && ex.schedule_template_id === s.scheduleTemplateId) {");
    expect(action).toContain("return ex.start_time.slice(0, 5) === s.startTime.slice(0, 5);");
  });
});
