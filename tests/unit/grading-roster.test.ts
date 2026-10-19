import { describe, expect, it } from "vitest";

import { buildGradingRoster, lastNameWord, maskedPhoneHint, type GradingRosterRow } from "@/features/grading-submissions/roster";

function row(overrides: Partial<GradingRosterRow>): GradingRosterRow {
  return {
    fullName: "Lê Văn An",
    guardianPhoneLast4: null,
    nickname: null,
    publicCode: "TV-2026-00001",
    sessions: [],
    ...overrides,
  };
}

describe("buildGradingRoster", () => {
  it("sorts by given name, then by the rest of the name, in Vietnamese order", () => {
    const roster = buildGradingRoster([
      row({ fullName: "Phạm Thu Đào", publicCode: "TV-2026-00004" }),
      row({ fullName: "Trần Văn Dũng", publicCode: "TV-2026-00003" }),
      row({ fullName: "Vũ Ngọc Ánh", publicCode: "TV-2026-00005" }),
      row({ fullName: "Bùi Văn Anh", publicCode: "TV-2026-00002" }),
      row({ fullName: "Đỗ Văn Anh", publicCode: "TV-2026-00006" }),
    ]);
    expect(roster.map((entry) => entry.fullName)).toEqual(["Bùi Văn Anh", "Đỗ Văn Anh", "Vũ Ngọc Ánh", "Trần Văn Dũng", "Phạm Thu Đào"]);
  });

  it("adds a masked parent phone only to namesakes", () => {
    const roster = buildGradingRoster([
      row({ fullName: "Nguyễn Minh Anh", guardianPhoneLast4: "4828", publicCode: "TV-2026-00010" }),
      row({ fullName: "Nguyễn  minh Anh", guardianPhoneLast4: "1234", publicCode: "TV-2026-00011" }),
      row({ fullName: "Lê Văn Bình", guardianPhoneLast4: "9999", publicCode: "TV-2026-00012" }),
    ]);
    expect(Object.fromEntries(roster.map((entry) => [entry.code, entry.label]))).toEqual({
      "TV-2026-00010": "Nguyễn Minh Anh (PH ***4828)",
      "TV-2026-00011": "Nguyễn  minh Anh (PH ***1234)",
      "TV-2026-00012": "Lê Văn Bình",
    });
    expect(roster.at(-1)?.code).toBe("TV-2026-00012");
    expect(JSON.stringify(roster)).not.toContain("9999");
  });

  it("uses the ERP code when a namesake has no phone, and both when the last 4 digits collide", () => {
    const noPhone = buildGradingRoster([
      row({ fullName: "Hà Gia Huy", guardianPhoneLast4: "5555", publicCode: "TV-2026-00020" }),
      row({ fullName: "Hà Gia Huy", publicCode: "TV-2026-00021" }),
    ]);
    expect(noPhone.map((entry) => entry.label).sort()).toEqual(["Hà Gia Huy (PH ***5555)", "Hà Gia Huy (TV-2026-00021)"]);

    const samePhone = buildGradingRoster([
      row({ fullName: "Hà Gia Huy", guardianPhoneLast4: "5555", publicCode: "TV-2026-00020" }),
      row({ fullName: "Hà Gia Huy", guardianPhoneLast4: "5555", publicCode: "TV-2026-00021" }),
    ]);
    expect(samePhone.map((entry) => entry.label)).toEqual([
      "Hà Gia Huy (PH ***5555, TV-2026-00020)",
      "Hà Gia Huy (PH ***5555, TV-2026-00021)",
    ]);
  });

  it("uses the nickname as the given name and labels today's sessions", () => {
    const [entry] = buildGradingRoster([
      row({
        fullName: "Trần Thị Mai",
        nickname: " Bông ",
        sessions: [{ classCode: "7CLC1", endTime: "19:30:00", id: "3a000000-0000-4000-8000-000000000031", startTime: "18:00:00" }],
      }),
    ]);
    expect(entry.givenName).toBe("Bông");
    expect(entry.sessions).toEqual([
      { classCode: "7CLC1", endTime: "19:30", id: "3a000000-0000-4000-8000-000000000031", label: "7CLC1 · 18:00–19:30", startTime: "18:00" },
    ]);
  });
});

describe("helpers", () => {
  it("takes the last word as the given name and masks only 4 digits", () => {
    expect(lastNameWord("  Nguyễn Văn   An ")).toBe("An");
    expect(maskedPhoneHint("4828")).toBe("PH ***4828");
    expect(maskedPhoneHint("0912344828")).toBeNull();
    expect(maskedPhoneHint(null)).toBeNull();
  });
});
