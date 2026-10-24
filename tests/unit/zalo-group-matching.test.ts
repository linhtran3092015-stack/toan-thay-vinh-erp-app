import { describe, expect, it } from "vitest";

import {
  extractPhones,
  matchStudentsToGroups,
  normalizeForMatch,
  normalizePhone,
  type MatchGroup,
  type MatchStudent,
} from "@/features/parent-messages/zalo-group-matching";

function student(id: string, fullName: string, extra: Partial<MatchStudent> = {}): MatchStudent {
  return { fullName, guardians: [], id, publicCode: `TV-2026-${id.padStart(5, "0")}`, ...extra };
}

function group(threadId: string, groupName: string | null, groupMembersCount: number | null = 3): MatchGroup {
  return { externalThreadId: threadId, groupMembersCount, groupName, zaloAccountId: "acc-1" };
}

function byStudent(matches: ReturnType<typeof matchStudentsToGroups>) {
  return Object.fromEntries(matches.map((match) => [match.studentId, match]));
}

describe("normalizeForMatch", () => {
  it("drops tone marks, đ and punctuation", () => {
    expect(normalizeForMatch("SLL - Đặng Thị Ánh Nguyệt (Lớp 5A)")).toBe("sll dang thi anh nguyet lop 5a");
  });
});

describe("phones", () => {
  it("finds mobile numbers written with spaces, dots or +84", () => {
    expect(extractPhones("PH Hoa 0912.345.678 / +84 987 654 321")).toEqual(["0912345678", "0987654321"]);
  });

  it("ignores longer digit runs on either side", () => {
    expect(extractPhones("Mã 091234567890")).toEqual([]);
    expect(extractPhones("Mã 10912345678")).toEqual([]);
  });

  it("keeps a class number next to the phone apart", () => {
    expect(extractPhones("SLL An lớp 5 0912 345 678")).toEqual(["0912345678"]);
  });

  it("normalizes 84… and 0… forms", () => {
    expect(normalizePhone("84912345678")).toBe("0912345678");
    expect(normalizePhone("0912 345 678")).toBe("0912345678");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
});

describe("matchStudentsToGroups", () => {
  it("pre-selects the one group that carries the student's full name", () => {
    const result = byStudent(
      matchStudentsToGroups([student("1", "Nguyễn Văn An")], [group("g1", "SLL Nguyễn Văn An - 5A"), group("g2", "SLL Trần Bình")]),
    );
    expect(result["1"].confidence).toBe("sure");
    expect(result["1"].suggestion?.group.externalThreadId).toBe("g1");
    expect(result["1"].suggestion?.reasons).toEqual(["student_name"]);
  });

  // Value: protects=a name that only matches after dropping tone marks (Hùng vs Hưng) is never pre-ticked on its own; fails_when=sure is decided on the toneless name; why_new=red-team found Hùng/Hưng pre-ticked; seam=none; no_claim=real group naming habits on the center nick
  it("never pre-selects a name that only matches without tone marks", () => {
    const result = byStudent(
      matchStudentsToGroups([student("1", "Lê Văn Hùng"), student("2", "Nguyễn Văn An")], [group("g1", "SLL Lê Văn Hưng 9A"), group("g2", "SLL Nguyen Van An")]),
    );
    expect(result["1"].confidence).toBe("ambiguous");
    expect(result["1"].candidates[0].reasons).toEqual(["student_name_loose"]);
    expect(result["2"].confidence).toBe("ambiguous");
  });

  it("pre-selects a toneless name when a guardian phone confirms the family", () => {
    const result = byStudent(
      matchStudentsToGroups(
        [student("1", "Nguyễn Văn An", { guardians: [{ fullName: "Trần Thị Hoa", phones: ["0912345678"] }] })],
        [group("g1", "SLL Nguyen Van An 0912345678")],
      ),
    );
    expect(result["1"].confidence).toBe("sure");
    expect(result["1"].suggestion?.reasons).toEqual(["student_name_loose", "guardian_phone"]);
  });

  it("never pre-selects on guardian evidence alone, even phone plus name", () => {
    const result = byStudent(
      matchStudentsToGroups(
        [student("1", "Phạm Gia Bảo", { guardians: [{ fullName: "Trần Thị Hoa", phones: ["0912345678"] }] })],
        [group("g1", "PH Trần Thị Hoa 0912345678")],
      ),
    );
    expect(result["1"].confidence).toBe("ambiguous");
    expect(result["1"].candidates[0].reasons).toEqual(["guardian_phone", "guardian_name"]);
  });

  it("never pre-selects a large group even when it carries the student's name", () => {
    const result = byStudent(matchStudentsToGroups([student("1", "Nguyễn Văn An")], [group("g1", "Lớp 5A - Nguyễn Văn An lớp trưởng", 40)]));
    expect(result["1"].confidence).toBe("ambiguous");
  });

  // Value: protects=a group named after a reserved/withdrawn/linked namesake is not handed to the current student; fails_when=rivals are ignored in the tie check; why_new=red-team: rivals were only unlinked studying students; seam=none; no_claim=rival list completeness (loader test covers it)
  it("lets students without a row compete for groups", () => {
    const result = byStudent(
      matchStudentsToGroups([student("1", "Trần Gia Bảo")], [group("g1", "SLL Trần Gia Bảo Ngọc")], [student("9", "Trần Gia Bảo Ngọc")]),
    );
    expect(result["1"].confidence).toBe("ambiguous");
    expect(result["9"]).toBeUndefined();
  });

  it("does not offer a group a rival clearly owns", () => {
    const result = byStudent(
      matchStudentsToGroups([student("1", "Đỗ Minh Khoa")], [group("g1", "Sổ liên lạc TV-2026-00009 Đỗ Minh Khoa")], [student("9", "Đỗ Minh Khôi")]),
    );
    // The group carries the rival's code and the current student's exact name: staff pick.
    expect(result["1"].confidence).toBe("ambiguous");
    expect(result["1"].candidates.map((candidate) => candidate.group.externalThreadId)).toEqual(["g1"]);
  });

  it("offers at most five candidates", () => {
    const groups = [1, 2, 3, 4, 5, 6].map((n) => group(`g${n}`, `PH Trần Thị Hoa nhóm ${n}`));
    const result = byStudent(matchStudentsToGroups([student("1", "Phạm Gia Bảo", { guardians: [{ fullName: "Trần Thị Hoa", phones: [] }] })], groups));
    expect(result["1"].candidates).toHaveLength(5);
    expect(result["1"].candidates[0].reasons).toEqual(["guardian_name"]);
  });

  it("does not match a name inside a longer name", () => {
    const result = byStudent(matchStudentsToGroups([student("1", "Văn An")], [group("g1", "SLL Nguyễn Văn Anh")]));
    expect(result["1"].confidence).toBe("none");
  });

  it("matches the student code even without the name", () => {
    const result = byStudent(matchStudentsToGroups([student("845", "Lê Minh")], [group("g1", "Sổ liên lạc TV-2026-00845")]));
    expect(result["845"].suggestion?.reasons).toEqual(["student_code"]);
    expect(result["845"].confidence).toBe("sure");
  });

  it("leaves namesakes for staff to pick", () => {
    const result = byStudent(
      matchStudentsToGroups([student("1", "Nguyễn Minh Anh"), student("2", "Nguyễn Minh Anh")], [group("g1", "SLL Nguyễn Minh Anh"), group("g2", "SLL Nguyễn Minh Anh 2")]),
    );
    expect(result["1"].confidence).toBe("ambiguous");
    expect(result["2"].confidence).toBe("ambiguous");
    expect(result["1"].candidates.map((candidate) => candidate.group.externalThreadId).sort()).toEqual(["g1", "g2"]);
  });

  it("uses the guardian phone in the group name to tell namesakes apart", () => {
    const result = byStudent(
      matchStudentsToGroups(
        [
          student("1", "Nguyễn Minh Anh", { guardians: [{ fullName: "Trần Thị Hoa", phones: ["0912345678"] }] }),
          student("2", "Nguyễn Minh Anh", { guardians: [{ fullName: "Lê Văn Nam", phones: ["0987654321"] }] }),
        ],
        [group("g1", "SLL Nguyễn Minh Anh 0987 654 321"), group("g2", "SLL Nguyễn Minh Anh - 0912345678")],
      ),
    );
    expect(result["1"].suggestion?.group.externalThreadId).toBe("g2");
    expect(result["2"].suggestion?.group.externalThreadId).toBe("g1");
    expect(result["1"].suggestion?.reasons).toEqual(["student_name", "guardian_phone"]);
  });

  it("never pre-selects on the guardian phone alone (siblings share it)", () => {
    const guardians = [{ fullName: "Trần Thị Hoa", phones: ["0912345678"] }];
    const result = byStudent(
      matchStudentsToGroups([student("1", "Phạm Gia Bảo", { guardians }), student("2", "Phạm Gia Hân", { guardians })], [group("g1", "PH Hoa 0912345678")]),
    );
    expect(result["1"].confidence).toBe("ambiguous");
    expect(result["2"].confidence).toBe("ambiguous");
    expect(result["1"].candidates[0].reasons).toEqual(["guardian_phone"]);
  });

  it("gives each sibling the group with their own name", () => {
    const guardians = [{ fullName: "Trần Thị Hoa", phones: ["0912345678"] }];
    const result = byStudent(
      matchStudentsToGroups(
        [student("1", "Phạm Gia Bảo", { guardians }), student("2", "Phạm Gia Hân", { guardians })],
        [group("g1", "SLL Phạm Gia Bảo"), group("g2", "SLL Phạm Gia Hân")],
      ),
    );
    expect(result["1"].suggestion?.group.externalThreadId).toBe("g1");
    expect(result["2"].suggestion?.group.externalThreadId).toBe("g2");
  });

  it("does not offer a group already pre-selected for someone else", () => {
    const result = byStudent(
      matchStudentsToGroups(
        [student("1", "Đỗ Quang Huy", { guardians: [{ fullName: "Đỗ Văn Tú", phones: ["0911222333"] }] }), student("2", "Đỗ Quang Huy")],
        [group("g1", "SLL Đỗ Quang Huy 0911222333")],
      ),
    );
    expect(result["1"].suggestion?.group.externalThreadId).toBe("g1");
    expect(result["2"].confidence).toBe("none");
  });

  it("ignores one-word names and unnamed groups", () => {
    const result = byStudent(matchStudentsToGroups([student("1", "An")], [group("g1", "Lớp An Khang"), group("g2", null)]));
    expect(result["1"].confidence).toBe("none");
  });

  // Value: protects=each tie-break and gate in the rewritten matcher (stronger guardian-only pair, assigned student's second group, one student on two groups, member cap, toneless+guardian name, NFC);
  // fails_when=any of those branches is removed (each case was red under its mutant in review); why_new=cycle-2 testing review; seam=none; no_claim=real group names
  it("lets a stronger guardian-only pair block the group for a name-only student", () => {
    const result = byStudent(
      matchStudentsToGroups(
        [student("1", "Phạm Gia Bảo", { guardians: [{ fullName: "Trần Thị Hoa", phones: ["0912345678"] }] }), student("2", "Nguyễn Văn An")],
        [group("g1", "PH Trần Thị Hoa 0912345678 - Nguyễn Văn An")],
      ),
    );
    expect(result["1"].confidence).toBe("ambiguous");
    expect(result["2"].confidence).toBe("ambiguous");
  });

  it("does not hand a second group naming an assigned student to a namesake", () => {
    const result = byStudent(
      matchStudentsToGroups(
        [student("1", "Đỗ Quang Huy", { guardians: [{ fullName: "Đỗ Văn Tú", phones: ["0911222333"] }] }), student("2", "Đỗ Quang Huy")],
        [group("g1", "SLL Đỗ Quang Huy 0911222333"), group("g2", "SLL Đỗ Quang Huy lớp 7")],
      ),
    );
    expect(result["1"].suggestion?.group.externalThreadId).toBe("g1");
    expect(result["2"].confidence).toBe("ambiguous");
  });

  it("does not pre-select when one student matches two groups equally", () => {
    const result = byStudent(matchStudentsToGroups([student("1", "Nguyễn Văn An")], [group("g1", "SLL Nguyễn Văn An"), group("g2", "Nhóm Nguyễn Văn An (cũ)")]));
    expect(result["1"].confidence).toBe("ambiguous");
    expect(result["1"].candidates).toHaveLength(2);
  });

  it.each([
    [15, "sure"],
    [16, "ambiguous"],
    [null, "sure"],
  ] as const)("treats a group with %s members as %s", (members, confidence) => {
    const result = byStudent(matchStudentsToGroups([student("1", "Nguyễn Văn An")], [group("g1", "SLL Nguyễn Văn An", members)]));
    expect(result["1"].confidence).toBe(confidence);
  });

  it("does not pre-select a toneless name confirmed only by a guardian name", () => {
    const result = byStudent(
      matchStudentsToGroups([student("1", "Nguyễn Văn An", { guardians: [{ fullName: "Trần Thị Hoa", phones: [] }] })], [group("g1", "SLL Nguyen Van An - PH Tran Thi Hoa")]),
    );
    expect(result["1"].confidence).toBe("ambiguous");
  });

  it("matches a group name typed with decomposed tone marks exactly", () => {
    const result = byStudent(matchStudentsToGroups([student("1", "Lê Văn Hùng")], [group("g1", "SLL Lê Văn Hùng".normalize("NFD"))]));
    expect(result["1"].suggestion?.reasons).toEqual(["student_name"]);
  });

  it.each([
    ["SLL An 0212 345 678", []],
    ["SLL An 0912-345-678", ["0912345678"]],
  ])("extracts phones from %j", (name, expected) => {
    expect(extractPhones(name)).toEqual(expected);
  });

  it("does not pre-select a group another family's guardian evidence points at", () => {
    const result = byStudent(
      matchStudentsToGroups(
        [student("1", "Nguyễn Văn Hùng"), student("2", "Lê Minh Khoa", { guardians: [{ fullName: "Nguyễn Văn Hùng", phones: [] }] })],
        [group("g1", "SLL Nguyễn Văn Hùng")],
      ),
    );
    expect(result["1"].confidence).toBe("ambiguous");
  });
});
