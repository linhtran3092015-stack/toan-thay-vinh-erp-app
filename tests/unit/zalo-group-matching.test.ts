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

function group(threadId: string, groupName: string | null): MatchGroup {
  return { externalThreadId: threadId, groupMembersCount: 3, groupName, zaloAccountId: "acc-1" };
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

  it("ignores longer digit runs", () => {
    expect(extractPhones("Mã 091234567890")).toEqual([]);
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
      matchStudentsToGroups([student("1", "Nguyễn Văn An")], [group("g1", "SLL Nguyen Van An - 5A"), group("g2", "SLL Trần Bình")]),
    );
    expect(result["1"].confidence).toBe("sure");
    expect(result["1"].suggestion?.group.externalThreadId).toBe("g1");
    expect(result["1"].suggestion?.reasons).toEqual(["student_name"]);
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
});
