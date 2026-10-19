// Value: protects=the /audit rules moved out of the server-only loader and the route (calendar-date and length normalisers, first-value URL parsing for both Next's record and URLSearchParams, active-filter count, inverted range, the truthful count line, Vietnamese module options with the active-value fallback, actor wording "Hệ thống" vs "Không đọc được hồ sơ", Vietnam time with seconds, verbatim JSON and the empty-metadata rule);
// fails_when=a moved normaliser changes behaviour (e.g. accepts 2026-02-30 or stops trimming, or a length cap 120/36/160 drifts), AUDIT_FILTER_KEYS stops covering every filter key or stops following EMPTY_AUDIT_FILTERS, a repeated param stops reading its first value, a prototype key such as "constructor" reads an Object member, a null actor is no longer "Hệ thống" or an unreadable profile is called "Hệ thống", a time is formatted in the host zone, or an active filter outside the option window renders as "Tất cả";
// why_new=step 14d moves these helpers into the pure audit-log-models.ts so the /dev/lists preview (a client tree) can share them; seam=none (pure functions); no_claim=what the database returns or how the page lays the values out (audit-log-page.test.tsx)
import { describe, expect, it } from "vitest";

import {
  AUDIT_FILTER_CAPTION,
  AUDIT_FILTER_KEYS,
  EMPTY_AUDIT_FILTERS,
  countActiveAuditFilters,
  formatAuditEntityType,
  formatAuditTimestamp,
  getActorDisplayName,
  getAuditActorOptionLabel,
  getAuditActorPresentation,
  getAuditCountLine,
  getAuditDataToggleContext,
  getAuditSelectOptions,
  getNextCalendarDate,
  getSearchValue,
  hasAuditMetadata,
  humanizeCode,
  isAuditDateRangeInverted,
  normalizeAuditFilters,
  normalizeDate,
  normalizeFilter,
  parseAuditFilters,
  sortUnique,
  stringifyAuditJson,
} from "@/features/audit/audit-log-models";
import type { AuditFilterOptions, AuditFilters } from "@/features/audit/read-models";

const filters = (overrides: Partial<AuditFilters> = {}): AuditFilters => ({ ...EMPTY_AUDIT_FILTERS, ...overrides });
const options = (overrides: Partial<AuditFilterOptions> = {}): AuditFilterOptions => ({
  actions: [],
  actors: [],
  entityTypes: [],
  modules: [],
  ...overrides,
});

describe("audit filter normalisers (moved verbatim from data.ts)", () => {
  it("keeps only real calendar dates in YYYY-MM-DD", () => {
    expect(normalizeDate(" 2026-10-16 ")).toBe("2026-10-16");
    expect(normalizeDate("2024-02-29")).toBe("2024-02-29");
    expect(normalizeDate("2026-02-29")).toBe("");
    expect(normalizeDate("2026-02-30")).toBe("");
    expect(normalizeDate("16/10/2026")).toBe("");
    expect(normalizeDate("2026-10-16T00:00")).toBe("2026-10-16");
    expect(normalizeDate(undefined)).toBe("");
  });

  it("trims and cuts free text to the loader's lengths", () => {
    expect(normalizeFilter("  rbac  ")).toBe("rbac");
    expect(normalizeFilter("x".repeat(200))).toHaveLength(120);
    expect(normalizeFilter("y".repeat(50), 36)).toHaveLength(36);
    expect(normalizeFilter(undefined)).toBe("");
  });

  it("steps to the next calendar day across month and year ends", () => {
    expect(getNextCalendarDate("2026-10-16")).toBe("2026-10-17");
    expect(getNextCalendarDate("2026-02-28")).toBe("2026-03-01");
    expect(getNextCalendarDate("2026-12-31")).toBe("2027-01-01");
  });

  it("names an actor by display name, else the e-mail local part, else a generic staff label", () => {
    expect(getActorDisplayName("  Cô Lan ", "lan@example.com")).toBe("Cô Lan");
    expect(getActorDisplayName(null, "minh.tuyensinh@example.com")).toBe("minh.tuyensinh");
    expect(getActorDisplayName("", "@example.com")).toBe("Nhân sự trung tâm");
  });

  it("builds the loader's filter object: trimmed, capped at 120 / 36 (actor) / 160 (entity id), real dates only", () => {
    expect(
      normalizeAuditFilters({
        action: ` ${"a".repeat(130)} `,
        actorId: "b".repeat(50),
        entityId: "c".repeat(200),
        entityType: " student ",
        fromDate: "2026-02-30",
        module: "m".repeat(121),
        toDate: " 2026-10-16 ",
      }),
    ).toEqual({
      action: "a".repeat(120),
      actorId: "b".repeat(36),
      entityId: "c".repeat(160),
      entityType: "student",
      fromDate: "",
      module: "m".repeat(120),
      toDate: "2026-10-16",
    });
    expect(normalizeAuditFilters({})).toEqual(EMPTY_AUDIT_FILTERS);
  });

  it("labels an actor option '{name} · {email}', the id when the profile is unreadable or has no e-mail", () => {
    const actor = { displayName: "Cô Lan", email: "lan@example.com", id: "a1" };
    expect(getAuditActorOptionLabel("a1", actor)).toBe("Cô Lan · lan@example.com");
    expect(getAuditActorOptionLabel("a1", { ...actor, email: null })).toBe("Cô Lan · a1");
    expect(getAuditActorOptionLabel("a9", undefined)).toBe("a9");
  });

  it("sorts unique non-empty option values in Vietnamese order", () => {
    expect(sortUnique(["students", null, "rbac", "students", "", "attendance"])).toEqual([
      "attendance",
      "rbac",
      "students",
    ]);
  });
});

describe("parseAuditFilters", () => {
  it("reads the seven params from Next's record, first value of a repeated param, missing as empty", () => {
    expect(
      parseAuditFilters({
        action: ["student_updated", "student_created"],
        fromDate: "2026-10-01",
        module: "students",
        other: "ignored",
        page: "2",
      }),
    ).toEqual({
      action: "student_updated",
      actorId: "",
      entityId: "",
      entityType: "",
      fromDate: "2026-10-01",
      module: "students",
      toDate: "",
    });
  });

  it("keeps values raw: the loader normalises them", () => {
    expect(parseAuditFilters({ entityId: "  HS0142  ", toDate: "2026-02-30" })).toMatchObject({
      entityId: "  HS0142  ",
      toDate: "2026-02-30",
    });
  });

  it("reads URLSearchParams the same way (the /dev/lists preview)", () => {
    const params = new URLSearchParams("view=audit&module=rbac&module=ops&actorId=abc&state=capped");
    expect(parseAuditFilters(params)).toEqual(filters({ actorId: "abc", module: "rbac" }));
  });

  it("never reads Object prototype members for a record without the key", () => {
    const record = Object.create(null) as Record<string, string>;
    expect(parseAuditFilters(record)).toEqual(EMPTY_AUDIT_FILTERS);
    expect(getSearchValue([])).toBe("");
    expect(getSearchValue(undefined)).toBe("");
  });

  it("lists the URL contract names in the bar's order", () => {
    expect(AUDIT_FILTER_KEYS).toEqual(["fromDate", "toDate", "module", "action", "actorId", "entityType", "entityId"]);
  });

  it("derives the key list from EMPTY_AUDIT_FILTERS, so it covers every filter key exactly once", () => {
    const everyKey = Object.keys(normalizeAuditFilters({})).sort();

    expect(AUDIT_FILTER_KEYS).toEqual(Object.keys(EMPTY_AUDIT_FILTERS));
    expect([...AUDIT_FILTER_KEYS].sort()).toEqual(everyKey);
    expect(Object.keys(parseAuditFilters({})).sort()).toEqual(everyKey);
    expect(new Set(AUDIT_FILTER_KEYS).size).toBe(AUDIT_FILTER_KEYS.length);
    expect(Object.values(EMPTY_AUDIT_FILTERS).every((value) => value === "")).toBe(true);
  });
});

describe("filter state", () => {
  it("counts each non-empty filter once", () => {
    expect(countActiveAuditFilters(EMPTY_AUDIT_FILTERS)).toBe(0);
    expect(countActiveAuditFilters(filters({ fromDate: "2026-10-01", module: "rbac", toDate: "2026-10-16" }))).toBe(3);
  });

  it("flags only a range whose start is after its end", () => {
    expect(isAuditDateRangeInverted(filters({ fromDate: "2026-10-17", toDate: "2026-10-16" }))).toBe(true);
    expect(isAuditDateRangeInverted(filters({ fromDate: "2026-10-16", toDate: "2026-10-16" }))).toBe(false);
    expect(isAuditDateRangeInverted(filters({ fromDate: "2026-10-17" }))).toBe(false);
  });
});

describe("header copy", () => {
  it("states the exact count and the rows shown, with the filter scope when filtered", () => {
    expect(getAuditCountLine(1240, 100, false)).toBe("1.240 bản ghi · hiển thị 100 mới nhất");
    expect(getAuditCountLine(37, 37, true)).toBe("37 bản ghi khớp bộ lọc · hiển thị 37 mới nhất");
    expect(getAuditCountLine(0, 0, true)).toBe("0 bản ghi khớp bộ lọc");
    expect(getAuditCountLine(0, 0, false)).toBe("0 bản ghi");
  });

  it("names the option window from the constant", () => {
    expect(AUDIT_FILTER_CAPTION).toBe("Ngày theo giờ Việt Nam · tùy chọn lấy từ 1.000 bản ghi mới nhất.");
  });
});

describe("select options", () => {
  it("labels modules in Vietnamese sorted by label, actions and entity types humanised", () => {
    const result = getAuditSelectOptions({
      filters: EMPTY_AUDIT_FILTERS,
      options: options({
        actions: ["class_session_auto_locked"],
        entityTypes: ["student_import_batch"],
        modules: ["students", "rbac", "attendance"],
      }),
    });
    expect(result.modules).toEqual([
      { label: "Điểm danh", value: "attendance" },
      { label: "Học viên", value: "students" },
      { label: "Phân quyền", value: "rbac" },
    ]);
    expect(result.actions).toEqual([{ label: "Class session auto locked", value: "class_session_auto_locked" }]);
    expect(result.entityTypes).toEqual([{ label: "Student import batch", value: "student_import_batch" }]);
  });

  it("appends an active filter missing from the option window instead of showing 'Tất cả'", () => {
    const result = getAuditSelectOptions({
      filters: filters({ action: "payroll_approved", actorId: "a1-uuid", entityType: "constructor", module: "staff" }),
      options: options({
        actions: ["student_updated"],
        actors: [{ id: "a2-uuid", label: "Cô Lan · lan@example.com" }],
        modules: ["students"],
      }),
    });
    expect(result.modules.at(-1)).toEqual({ label: "Nhân sự (đang lọc)", value: "staff" });
    expect(result.actions.at(-1)).toEqual({ label: "Payroll approved (đang lọc)", value: "payroll_approved" });
    expect(result.actors.at(-1)).toEqual({ label: "a1-uuid (đang lọc)", value: "a1-uuid" });
    expect(result.entityTypes).toEqual([{ label: "Constructor (đang lọc)", value: "constructor" }]);
  });

  it("does not duplicate an active value that is already an option", () => {
    const result = getAuditSelectOptions({ filters: filters({ module: "rbac" }), options: options({ modules: ["rbac"] }) });
    expect(result.modules).toEqual([{ label: "Phân quyền", value: "rbac" }]);
  });

  it("falls back to the code for an unknown module, prototype names included", () => {
    const result = getAuditSelectOptions({ filters: EMPTY_AUDIT_FILTERS, options: options({ modules: ["constructor", "to_string"] }) });
    expect(result.modules.map((option) => option.label)).toEqual(["Constructor", "To String"]);
  });
});

describe("row presentation", () => {
  const actor = { displayName: "Cô Lan", email: "lan@example.com", id: "a1" };

  it("calls a null actor 'Hệ thống' and an unreadable profile a person with its uuid", () => {
    expect(getAuditActorPresentation({ action: "ops_alert_raised", actor: null, actorUserId: null })).toEqual({
      automaticCaption: null,
      detail: "ghi tự động từ database",
      detailIsCode: false,
      kind: "system",
      name: "Hệ thống",
    });
    expect(getAuditActorPresentation({ action: "guardian_updated", actor: null, actorUserId: "a9" })).toEqual({
      automaticCaption: null,
      detail: "a9",
      detailIsCode: true,
      kind: "unreadable",
      name: "Không đọc được hồ sơ",
    });
    expect(getAuditActorPresentation({ action: "student_updated", actor, actorUserId: "a1" })).toMatchObject({
      detail: "lan@example.com",
      detailIsCode: false,
      kind: "profile",
      name: "Cô Lan",
    });
  });

  it("marks the auto-lock worker's rows, which carry the session completer as actor", () => {
    expect(
      getAuditActorPresentation({ action: "class_session_auto_locked", actor, actorUserId: "a1" }).automaticCaption,
    ).toBe("khóa tự động");
  });

  it("formats occurred_at in Vietnam time with seconds, whatever the host zone", () => {
    expect(formatAuditTimestamp("2026-10-15T17:30:05.123+00:00")).toEqual({
      date: "16/10/2026",
      full: "00:30:05 16/10/2026",
      time: "00:30:05",
    });
    expect(formatAuditTimestamp("2026-12-31T17:00:00.000Z")).toEqual({
      date: "01/01/2027",
      full: "00:00:00 01/01/2027",
      time: "00:00:00",
    });
    expect(formatAuditTimestamp("not-a-date")).toEqual({ date: "not-a-date", full: "not-a-date", time: "" });
  });

  it("humanises codes and falls back for missing entity data", () => {
    expect(humanizeCode("student_import")).toBe("Student import");
    expect(humanizeCode("__")).toBe("Không xác định");
    expect(formatAuditEntityType(null)).toBe("Không xác định");
    expect(formatAuditEntityType("class_session")).toBe("Class session");
  });

  it("prints JSON verbatim and hides only an empty metadata object", () => {
    const value = { full_name: "Phạm Thu Hà", lifecycle_status: "reserved", nested: { list: [1, 2] } };
    expect(stringifyAuditJson(value)).toBe(JSON.stringify(value, null, 2));
    expect(stringifyAuditJson(7)).toBe("7");
    expect(hasAuditMetadata({})).toBe(false);
    expect(hasAuditMetadata(null)).toBe(false);
    expect(hasAuditMetadata({ source: "settings" })).toBe(true);
    expect(hasAuditMetadata([])).toBe(true);
  });

  it("names the disclosure by action and time", () => {
    expect(
      getAuditDataToggleContext({ action: "student_updated", occurredAt: "2026-10-16T02:15:44.902+00:00" }),
    ).toBe("dữ liệu trước / sau của Student updated lúc 09:15:44 16/10/2026");
  });
});
