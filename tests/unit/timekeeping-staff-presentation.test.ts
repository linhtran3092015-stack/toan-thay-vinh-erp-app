// Value: protects=the staff /timekeeping copy (step 12, design 14): the check-in card lists only rules the client really knows (radius, accuracy limit and centre name from the policy, Wi-Fi typed only when the owner requires it, location verified at check-in/out only unless continuous tracking is on, online needs an assigned shift within 15 minutes), a not-configured centre leads with a "may be refused" warning and makes no verification-timing claim, every card in both modes ends with the 22:30/22:45 check-in cutoff (one DAILY_CUTOFF_TEXT shared with the auto-end note), no rule text claims a check passed or names SSID/BSSID; the open-shift evidence line follows the entry flags and its notes add the radius only for an offline shift at a configured centre while always naming the 22:30/22:45 auto-end; clock and date helpers read Vietnam time (Monday after a UTC Sunday evening, 00:xx not 24:xx) and short work dates keep the calendar day with CN/T2..T7;
// fails_when=a rule drops the policy numbers or centre name, a configured centre still shows the warning (or an unconfigured one hides it), the Wi-Fi line appears without wifiRequiredForOffline or mentions SSID/BSSID/"hợp lệ"/"đủ điều kiện", the continuous-tracking variant reuses the endpoint-only sentence, an online card shows location rules, the evidence line claims GPS when the entry has none, the radius note shows for online/unconfigured, the cutoff note disappears or the check-in cutoff item is dropped/moved off the last position, an unconfigured centre still claims when the location is verified, the clock follows the runtime zone, or an invalid work date turns into "undefined NaN/NaN";
// why_new=step 12 adds timekeeping-staff-presentation.ts; the component tests render one policy at a time and never the edge dates;
// seam=none (pure functions, process.env.TZ left as the runner set it: the helpers pin Asia/Ho_Chi_Minh themselves); no_claim=does not prove the server enforces these rules (the card is informational; eligibility stays server-owned) nor that the panel renders them (my-timekeeping-panel-redesign.test.tsx does)
import { describe, expect, it } from "vitest";

import {
  DAILY_CUTOFF_TEXT,
  formatShortWorkDate,
  formatVietnamClockLine,
  formatVietnamClockTime,
  getOpenShiftEvidenceText,
  getOpenShiftRuleNotes,
  getShiftConditionItems,
  ONLINE_SHIFT_WINDOW_MINUTES,
} from "@/features/timekeeping/timekeeping-staff-presentation";
import type { AttendanceVerificationPolicy, TimekeepingMyEntry } from "@/features/timekeeping/types";

const configuredPolicy: AttendanceVerificationPolicy = {
  attendanceRadiusM: 150,
  centerName: "Cơ sở chính",
  configured: true,
  continuousGpsTrackingRequired: false,
  gpsMaxAccuracyM: 60,
  gpsRequiredForOffline: true,
  wifiRequiredForOffline: false,
};

const unconfiguredPolicy: AttendanceVerificationPolicy = {
  ...configuredPolicy,
  configured: false,
};

const openEntry: TimekeepingMyEntry = {
  autoEndedAt: null,
  checkInAt: "2026-10-12T01:30:00.000Z",
  checkInMode: "offline",
  checkOutAt: null,
  checkOutMode: null,
  hasCheckInGpsEvidence: true,
  hasCheckInWifiEvidence: false,
  hasCheckOutGpsEvidence: false,
  hasCheckOutWifiEvidence: false,
  id: "entry-open",
  scheduledEndTime: "18:00:00",
  scheduledStartTime: "09:00:00",
  status: "open",
  workDate: "2026-10-12",
  workShiftCode: "HC",
  workShiftName: "Hành chính",
};

const CUTOFF_NOTE = "Quên ra ca? Hệ thống tự kết thúc ca lúc 22:30 (trợ giảng) hoặc 22:45 (vị trí khác).";
// Pre-landing review (cycle 1): every condition list now ends with the daily check-in cutoff.
const CHECKIN_CUTOFF_ITEM = {
  icon: "schedule",
  id: "checkin-cutoff",
  text: "Không vào ca được sau 22:30 (trợ giảng) hoặc 22:45 (vị trí khác).",
  tone: "info",
};
const BANNED_RULE_TEXT = /ssid|bssid|hợp lệ|đủ điều kiện|đúng địa điểm|latitude|longitude/i;

describe("getShiftConditionItems", () => {
  it("lists the configured offline radius, accuracy and centre, then the endpoint-only verification timing", () => {
    const items = getShiftConditionItems(configuredPolicy, "offline");

    expect(items).toEqual([
      {
        icon: "location",
        id: "location-rule",
        text: "Vị trí: trong bán kính 150 m quanh Cơ sở chính, sai số tối đa 60 m. Kiểm tra khi bấm Vào ca.",
        tone: "info",
      },
      {
        icon: "verification",
        id: "verification-timing",
        text: "Vị trí chỉ được xác minh lúc vào ca và lúc ra ca.",
        tone: "info",
      },
      // Intentional change (review cycle 1): the check-in cutoff item now closes the list.
      CHECKIN_CUTOFF_ITEM,
    ]);
  });

  it("leads with a warning and no radius or verification-timing claim when the centre location is not configured", () => {
    const items = getShiftConditionItems(unconfiguredPolicy, "offline");

    // Intentional change (review cycle 1): the warning now says on-site check-in "may be
    // refused" (the server either refuses or skips the check), not a fixed precondition.
    expect(items[0]).toEqual({
      icon: "warning",
      id: "center-not-configured",
      text: "Chưa cấu hình vị trí Trung tâm: chấm công tại Trung tâm có thể bị từ chối cho đến khi chủ trung tâm lưu tọa độ.",
      tone: "warning",
    });
    // Intentional change: no "verification-timing" line without saved coordinates; the cutoff closes the list.
    expect(items.map((item) => item.id)).toEqual(["center-not-configured", "checkin-cutoff"]);
    expect(items.some((item) => item.id === "verification-timing")).toBe(false);
    expect(items.some((item) => /xác minh|theo dõi liên tục/.test(item.text))).toBe(false);
    expect(items.some((item) => /bán kính|150 m|60 m/.test(item.text))).toBe(false);

    const tracked = getShiftConditionItems({ ...unconfiguredPolicy, continuousGpsTrackingRequired: true }, "offline");
    expect(tracked.map((item) => item.id)).toEqual(["center-not-configured", "checkin-cutoff"]);
  });

  it("adds the Wi-Fi line only when the owner requires it, between location and verification timing", () => {
    expect(getShiftConditionItems(configuredPolicy, "offline").some((item) => item.icon === "wifi")).toBe(false);

    const items = getShiftConditionItems({ ...configuredPolicy, wifiRequiredForOffline: true }, "offline");

    // Intentional change (review cycle 1): "checkin-cutoff" is appended last.
    expect(items.map((item) => item.id)).toEqual(["location-rule", "wifi-rule", "verification-timing", "checkin-cutoff"]);
    expect(items[1]).toEqual({
      icon: "wifi",
      id: "wifi-rule",
      text: "Wi-Fi: nhập tên mạng Trung tâm đã đăng ký khi xác nhận.",
      tone: "info",
    });

    const unconfiguredWifi = getShiftConditionItems({ ...unconfiguredPolicy, wifiRequiredForOffline: true }, "offline");
    // Intentional change: no verification-timing line without saved coordinates.
    expect(unconfiguredWifi.map((item) => item.id)).toEqual(["center-not-configured", "wifi-rule", "checkin-cutoff"]);
  });

  it("never names SSID/BSSID or claims a check passed, for any policy or mode", () => {
    const policies: AttendanceVerificationPolicy[] = [
      configuredPolicy,
      unconfiguredPolicy,
      { ...configuredPolicy, wifiRequiredForOffline: true },
      { ...unconfiguredPolicy, wifiRequiredForOffline: true },
      { ...configuredPolicy, continuousGpsTrackingRequired: true, wifiRequiredForOffline: true },
    ];

    for (const policy of policies) {
      for (const mode of ["offline", "online"] as const) {
        for (const item of getShiftConditionItems(policy, mode)) {
          expect(item.text).not.toMatch(BANNED_RULE_TEXT);
        }
      }
    }
  });

  it("shows the continuous-tracking sentence instead of the endpoint-only one when tracking is required", () => {
    const items = getShiftConditionItems({ ...configuredPolicy, continuousGpsTrackingRequired: true }, "offline");
    const timing = items.find((item) => item.id === "verification-timing");

    expect(timing?.text).toBe("Vị trí được theo dõi liên tục trong ca.");
    expect(items.some((item) => item.text.includes("chỉ được xác minh"))).toBe(false);
  });

  it("gives online attendance the assigned-shift 15-minute rule and no location, Wi-Fi or configuration lines", () => {
    const expected = [
      {
        icon: "schedule",
        id: "online-schedule",
        text: "Trực tuyến chỉ nhận khi bạn có ca được xếp hôm nay, trong 15 phút trước hoặc sau giờ ca.",
        tone: "info",
      },
      {
        icon: "verification",
        id: "online-location",
        text: "Không cần lấy vị trí khi chấm công trực tuyến.",
        tone: "info",
      },
      // Intentional change (review cycle 1): online cards also end with the check-in cutoff.
      CHECKIN_CUTOFF_ITEM,
    ];

    expect(getShiftConditionItems(configuredPolicy, "online")).toEqual(expected);
    expect(getShiftConditionItems({ ...unconfiguredPolicy, continuousGpsTrackingRequired: true, wifiRequiredForOffline: true }, "online")).toEqual(expected);
  });

  // Value: protects=the daily check-in cutoff (migration 20261012120000: no check-in at or after 22:30 for TAs / 22:45 otherwise) is the LAST line of every check-in card, in both modes and for every policy shape, exactly once, and its time text is the same DAILY_CUTOFF_TEXT the open-shift auto-end note uses; the online window stays 15 minutes;
  // fails_when=a policy branch returns early without the cutoff item, the item is pushed before the Wi-Fi/verification lines or duplicated, the online list drops it, or the cutoff copy drifts between the check-in card and the auto-end note;
  // why_new=the exact-list tests above pin one policy each; this sweeps every policy/mode combination and the shared constant;
  // seam=none; no_claim=does not prove the server enforces the cutoff or that a TA is told which of the two times applies to them
  it("ends every condition list with the single check-in cutoff item, sharing the auto-end cutoff text", () => {
    const policies: AttendanceVerificationPolicy[] = [
      configuredPolicy,
      unconfiguredPolicy,
      { ...configuredPolicy, wifiRequiredForOffline: true },
      { ...unconfiguredPolicy, wifiRequiredForOffline: true },
      { ...configuredPolicy, continuousGpsTrackingRequired: true, wifiRequiredForOffline: true },
      { ...unconfiguredPolicy, continuousGpsTrackingRequired: true },
    ];

    for (const policy of policies) {
      for (const mode of ["offline", "online"] as const) {
        const items = getShiftConditionItems(policy, mode);
        expect(items.at(-1), `${mode} ${JSON.stringify(policy)}`).toEqual(CHECKIN_CUTOFF_ITEM);
        expect(items.filter((item) => item.id === "checkin-cutoff")).toHaveLength(1);
      }
    }

    expect(DAILY_CUTOFF_TEXT).toBe("22:30 (trợ giảng) hoặc 22:45 (vị trí khác)");
    expect(CHECKIN_CUTOFF_ITEM.text).toContain(DAILY_CUTOFF_TEXT);
    expect(CUTOFF_NOTE).toContain(DAILY_CUTOFF_TEXT);
    expect(ONLINE_SHIFT_WINDOW_MINUTES).toBe(15);
  });
});

describe("getOpenShiftEvidenceText", () => {
  it.each([
    ["online: the assigned-shift rule, whatever the flags say", { checkInMode: "online" as const, hasCheckInGpsEvidence: true, hasCheckInWifiEvidence: true }, "Trực tuyến · theo ca được xếp"],
    ["offline with GPS only", { hasCheckInGpsEvidence: true, hasCheckInWifiEvidence: false }, "Đã ghi nhận vị trí lúc vào ca"],
    ["offline with GPS and Wi-Fi", { hasCheckInGpsEvidence: true, hasCheckInWifiEvidence: true }, "Đã ghi nhận vị trí lúc vào ca và thông tin Wi-Fi"],
    ["offline without GPS (Wi-Fi alone is not location)", { hasCheckInGpsEvidence: false, hasCheckInWifiEvidence: true }, "Vào ca không kèm dữ liệu vị trí"],
    ["offline without any evidence", { hasCheckInGpsEvidence: false, hasCheckInWifiEvidence: false }, "Vào ca không kèm dữ liệu vị trí"],
  ])("%s", (_case, overrides, expected) => {
    expect(getOpenShiftEvidenceText({ ...openEntry, ...overrides })).toBe(expected);
  });
});

describe("getOpenShiftRuleNotes", () => {
  it("adds the radius reminder for an offline shift at a configured centre, then the auto-end cutoff", () => {
    expect(getOpenShiftRuleNotes(openEntry, configuredPolicy)).toEqual([
      "Ra ca tại Trung tâm cần lấy lại vị trí trong bán kính 150 m.",
      CUTOFF_NOTE,
    ]);
  });

  it("keeps only the 22:30/22:45 cutoff for an online shift or an unconfigured centre", () => {
    expect(getOpenShiftRuleNotes({ ...openEntry, checkInMode: "online" }, configuredPolicy)).toEqual([CUTOFF_NOTE]);
    expect(getOpenShiftRuleNotes(openEntry, unconfiguredPolicy)).toEqual([CUTOFF_NOTE]);
  });

  it("never mentions pay or worked hours", () => {
    for (const note of getOpenShiftRuleNotes(openEntry, configuredPolicy)) {
      expect(note).not.toMatch(/giờ làm|9 giờ|lương|đơn giá/i);
    }
  });
});

describe("Vietnam clock and date helpers", () => {
  it.each([
    ["afternoon", "2026-10-12T09:58:00Z", "Thứ Hai, 12/10/2026 · 16:58"],
    ["UTC Sunday evening is Monday 00:05 in Vietnam", "2026-10-11T17:05:00Z", "Thứ Hai, 12/10/2026 · 00:05"],
    ["Sunday keeps its capitalised name", "2026-10-11T03:00:00Z", "Chủ Nhật, 11/10/2026 · 10:00"],
    ["Saturday", "2026-10-10T00:00:00Z", "Thứ Bảy, 10/10/2026 · 07:00"],
  ])("formatVietnamClockLine: %s", (_case, iso, expected) => {
    expect(formatVietnamClockLine(Date.parse(iso))).toBe(expected);
  });

  it.each([
    ["Saturday", "2026-10-10", "T7 10/10"],
    ["Sunday", "2026-10-04", "CN 04/10"],
    ["Monday", "2026-10-12", "T2 12/10"],
    ["single-digit day and month are padded", "2026-01-05", "T2 05/01"],
    ["fixture month (Tuesday)", "2026-09-01", "T3 01/09"],
  ])("formatShortWorkDate: %s", (_case, workDate, expected) => {
    expect(formatShortWorkDate(workDate)).toBe(expected);
  });

  it.each(["", "not-a-date", "2026-10", "10/10/2026"])("formatShortWorkDate passes %j through unchanged", (value) => {
    expect(formatShortWorkDate(value)).toBe(value);
  });

  it.each([
    ["UTC instant", "2026-10-12T09:58:00Z", "16:58"],
    ["+07:00 offset", "2026-09-02T15:30:00+07:00", "15:30"],
    ["Vietnam midnight reads 00:00, not 24:00", "2026-10-11T17:00:00.000Z", "00:00"],
    ["late cutoff", "2026-10-12T15:45:00Z", "22:45"],
    ["unreadable timestamp shows a dash instead of throwing", "not-a-date", "—"],
  ])("formatVietnamClockTime: %s", (_case, iso, expected) => {
    expect(formatVietnamClockTime(iso)).toBe(expected);
  });
});
