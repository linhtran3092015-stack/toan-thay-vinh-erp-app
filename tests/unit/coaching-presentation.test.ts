// Value: protects=the Coaching record's formatting helpers (design 13c): review dates drop the year only when it matches the opening year, the header reason is the first non-empty line cut to 80 characters (code points, so an emoji is never split) with "…", record times read in Vietnam time across a UTC midnight, the link panel's datetime-local value is formatted and read back as Vietnam wall time in any runtime zone (invalid or rolled-over values rejected), an unparseable value is shown as it came rather than "Invalid Date", the timeline is newest first with each change's previous status read past a note that carries none, an unknown priority never reads an Object.prototype member, and the create dialog's priority options are the badge wording without "Ưu tiên";
// fails_when=a review date in another year loses its year (or a same-year one keeps it), the summary takes a blank first line, exceeds 80 characters or leaves half an emoji, the expiry field follows the runtime's zone (7 hours off on the UTC server) or accepts 30/02, a 20:00Z timestamp renders on the UTC day, an invalid timestamp turns into "NaN/NaN" or "Invalid Date", the timeline keeps RPC order or takes the previous status from the immediately preceding event, or "constructor" returns a function as a priority, or a dialog option drifts from the badge (the old "Trung bình" next to "Ưu tiên vừa");
// why_new=step 11b adds coaching-presentation.ts; coaching-detail-page.test.tsx sees only one rendered record and none of the edge inputs;
// seam=none (pure functions); no_claim=does not prove the RPCs return ISO timestamps or event_sequence order, nor that the components render these values (coaching-detail-page.test.tsx renders the dialog, list badge and record header)
import { describe, expect, it } from "vitest";

import {
  buildCoachingTimeline,
  coachingPriorityOptions,
  coachingPriorityPresentation,
  formatCoachingDate,
  formatCoachingDateTime,
  formatCoachingDateTimeLocal,
  formatCoachingReviewDate,
  formatCoachingShortDateTime,
  getCoachingPriorityPresentation,
  parseCoachingDateTimeLocal,
  summarizeCoachingReason,
} from "@/features/coaching/coaching-presentation";
import type { CoachingRecordEvent } from "@/features/coaching/read-models";

describe("formatCoachingReviewDate", () => {
  it.each([
    ["same year as the opening: day/month only", "2026-10-20", "2026", "20/10"],
    ["another year: the year is kept", "2027-01-05", "2026", "05/01/2027"],
    ["no reference year: the year is kept", "2026-10-20", undefined, "20/10/2026"],
    ["a timestamp still reads its date part", "2026-10-20T00:00:00Z", "2026", "20/10"],
    ["not YYYY-MM-DD: unchanged", "20/10/2026", "2026", "20/10/2026"],
    ["empty: unchanged", "", "2026", ""],
  ])("%s", (_case, value, referenceYear, expected) => {
    expect(formatCoachingReviewDate(value, referenceYear)).toBe(expected);
  });
});

describe("summarizeCoachingReason", () => {
  const long = "a".repeat(100);
  const spaceAtCut = `${"x".repeat(78)} ${"y".repeat(30)}`;

  it.each([
    ["the first non-empty line, trimmed", "\n   \n  Điểm giảm liên tục 3 tuần  \nDòng thứ hai", "Điểm giảm liên tục 3 tuần"],
    ["Windows line endings", "Dòng một\r\nDòng hai", "Dòng một"],
    ["exactly 80 characters: unchanged", "b".repeat(80), "b".repeat(80)],
    ["longer than 80: cut to 80 with the ellipsis", long, `${"a".repeat(79)}…`],
    ["a space at the cut is not kept before the ellipsis", spaceAtCut, `${"x".repeat(78)}…`],
    ["blank: empty", "  \n\t\n ", ""],
    ["empty: empty", "", ""],
  ])("%s", (_case, reason, expected) => {
    const summary = summarizeCoachingReason(reason);
    expect(summary).toBe(expected);
    expect(summary.length).toBeLessThanOrEqual(80);
  });

  it("counts an emoji as one character and never cuts it in half", () => {
    // UTF-16 length 90: the emoji's two code units sit at positions 78-79, across a UTF-16 cut at 79.
    const atCut = `${"a".repeat(78)}😀${"b".repeat(10)}`;
    expect(summarizeCoachingReason(atCut)).toBe(`${"a".repeat(78)}😀…`);
    expect(Array.from(summarizeCoachingReason(atCut))).toHaveLength(80);
    // No lone half of a surrogate pair (what a UTF-16 cut leaves before the ellipsis).
    expect(summarizeCoachingReason(atCut)).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    // 80 code points (81 UTF-16 units) fit as they are.
    const fits = `${"a".repeat(79)}😀`;
    expect(summarizeCoachingReason(fits)).toBe(fits);
  });
});

describe("Coaching record times in Vietnam time", () => {
  it.each([
    // 20:00Z on 19/09 is already 03:00 on 20/09 in Vietnam (UTC+7).
    ["after a UTC evening", "2026-09-19T20:00:00Z", "20/09/2026", "20/09 03:00", "20/09/2026 03:00"],
    ["just before Vietnam midnight", "2026-09-19T16:59:00Z", "19/09/2026", "19/09 23:59", "19/09/2026 23:59"],
    ["at Vietnam midnight", "2026-12-31T17:00:00Z", "01/01/2027", "01/01 00:00", "01/01/2027 00:00"],
    ["an offset timestamp", "2026-10-13T10:20:00+07:00", "13/10/2026", "13/10 10:20", "13/10/2026 10:20"],
  ])("%s", (_case, value, date, shortDateTime, dateTime) => {
    expect(formatCoachingDate(value)).toBe(date);
    expect(formatCoachingShortDateTime(value)).toBe(shortDateTime);
    expect(formatCoachingDateTime(value)).toBe(dateTime);
  });

  it.each(["không phải ngày", "", "2026-13-45T99:00:00Z"])("returns %j unchanged when it is not a date", (value) => {
    expect(formatCoachingDate(value)).toBe(value);
    expect(formatCoachingShortDateTime(value)).toBe(value);
    expect(formatCoachingDateTime(value)).toBe(value);
  });
});

function event(id: string, eventType: CoachingRecordEvent["eventType"], status: string | null): CoachingRecordEvent {
  return {
    eventType,
    id,
    note: null,
    occurredAt: "2026-09-20T02:00:00Z",
    occurredByDisplayName: "Cô Hạnh",
    outcome: null,
    status,
  };
}

describe("buildCoachingTimeline", () => {
  it("lists newest first and reads each previous status past events that carry none", () => {
    // As get_coaching_record_events returns them: oldest first.
    const events = [
      event("opened", "opened", "open"),
      event("note-1", "note_added", null),
      event("note-2", "note_added", null),
      event("started", "status_changed", "in_progress"),
      event("note-3", "note_added", null),
      event("closed", "outcome_recorded", "closed"),
    ];

    expect(buildCoachingTimeline(events).map((entry) => [entry.event.id, entry.previousStatus])).toEqual([
      ["closed", "in_progress"],
      ["note-3", "in_progress"],
      ["started", "open"],
      ["note-2", "open"],
      ["note-1", "open"],
      ["opened", null],
    ]);
    // The input order is left as it was.
    expect(events.map((item) => item.id)).toEqual(["opened", "note-1", "note-2", "started", "note-3", "closed"]);
  });

  it("returns an empty timeline for no events", () => {
    expect(buildCoachingTimeline([])).toEqual([]);
  });
});

describe("getCoachingPriorityPresentation", () => {
  it.each([
    ["high", { label: "Ưu tiên cao", tone: "danger" }],
    ["medium", { label: "Ưu tiên vừa", tone: "warning" }],
    ["low", { label: "Ưu tiên thấp", tone: "neutral" }],
    // Unknown values (a newer enum value, a prototype key) read as medium, never as Object members.
    ["urgent", coachingPriorityPresentation.medium],
    ["constructor", coachingPriorityPresentation.medium],
    ["__proto__", coachingPriorityPresentation.medium],
  ])("%s", (priority, expected) => {
    expect(getCoachingPriorityPresentation(priority)).toEqual(expected);
  });
});

describe("coachingPriorityOptions", () => {
  it("lists low to high with the badge wording minus its prefix, so the create dialog cannot drift", () => {
    expect(coachingPriorityOptions.map((option) => [option.value, option.label])).toEqual([
      ["low", "Thấp"],
      ["medium", "Vừa"],
      ["high", "Cao"],
    ]);
    for (const option of coachingPriorityOptions) {
      expect(getCoachingPriorityPresentation(option.value).label).toBe(`Ưu tiên ${option.label.toLocaleLowerCase("vi")}`);
    }
    expect(coachingPriorityOptions.map((option) => option.value).sort()).toEqual(
      Object.keys(coachingPriorityPresentation).sort(),
    );
  });
});

describe("datetime-local values in Vietnam time", () => {
  it.each([
    // 20:00Z on 19/09 is 03:00 on 20/09 in Vietnam, whatever zone the runtime is in.
    ["across a UTC midnight", "2026-09-19T20:00:00.000Z", "2026-09-20T03:00", "2026-09-19T20:00:00.000Z"],
    ["with seconds, to the minute", "2026-10-15T03:20:45.000Z", "2026-10-15T10:20", "2026-10-15T03:20:00.000Z"],
    ["at Vietnam midnight", "2026-12-31T17:00:00.000Z", "2027-01-01T00:00", "2026-12-31T17:00:00.000Z"],
  ])("formats an instant %s and reads the value back", (_case, instant, local, readBack) => {
    expect(formatCoachingDateTimeLocal(new Date(instant))).toBe(local);
    expect(parseCoachingDateTimeLocal(local)?.toISOString()).toBe(readBack);
  });

  it("reads a field value as Vietnam wall time, with or without seconds", () => {
    expect(parseCoachingDateTimeLocal("2026-12-01T09:30")?.toISOString()).toBe("2026-12-01T02:30:00.000Z");
    expect(parseCoachingDateTimeLocal("2026-12-01T09:30:15")?.toISOString()).toBe("2026-12-01T02:30:15.000Z");
  });

  it.each(["", "2026-12-01", "01/12/2026 09:30", "2026-13-01T00:00", "2026-02-30T10:00", "2026-10-18T24:00", "2026-12-01T09:30Z"])(
    "returns null for %j",
    (value) => {
      expect(parseCoachingDateTimeLocal(value)).toBeNull();
    },
  );

  it("formats an invalid date as an empty field", () => {
    expect(formatCoachingDateTimeLocal(new Date("không phải ngày"))).toBe("");
  });
});
