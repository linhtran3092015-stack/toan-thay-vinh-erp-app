// Value: protects=bulk link loader lists only unlinked studying students, never offers a group linked to anyone, and stops at the first connection step not ready;
// fails_when=the linked-thread filter, phone normalization, given-name order or a CRM step guard is dropped or reordered, or a load error is swallowed;
// why_new=getZaloGroupLinkWorkspace had no test, and the checklist and suggestion table read only what it returns;
// seam=none; no_claim=does not prove the real PostgREST filters return these rows or that ZaloCRM answers this way
// Value (second pass): protects=every student outside the table competes for groups, no groups load for a missing or offline nick, guardian details need guardians.view;
// fails_when=rivals are dropped, the nick gate only checks a blank id, or guardian names/phones reach the page without guardians.view;
// why_new=red-team, testing and security review of the first version; seam=none; no_claim=real PostgREST filtering (filters are only recorded)
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isZaloCrmConfigured: vi.fn(),
  centerAccountId: vi.fn(),
  listAllZaloGroups: vi.fn(),
  listZaloAccounts: vi.fn(),
  queries: [] as { filters: string[]; table: string }[],
  settings: vi.fn(),
  tables: {} as Record<string, { data: unknown[] | null; error: unknown }>,
}));

/** Answers each query by table and records its filters. */
function query(table: string) {
  const record = { filters: [] as string[], table };
  mocks.queries.push(record);
  const builder = {
    eq: (column: string, value: unknown) => (record.filters.push(`eq:${column}=${String(value)}`), builder),
    in: (column: string, values: unknown[]) => (record.filters.push(`in:${column}=${values.join(",")}`), builder),
    is: (column: string, value: unknown) => (record.filters.push(`is:${column}=${String(value)}`), builder),
    not: (column: string, operator: string, value: unknown) => (record.filters.push(`not:${column}:${operator}=${String(value)}`), builder),
    order: () => builder,
    range: async () => mocks.tables[table] ?? { data: null, error: { message: `unexpected query ${table}` } },
    select: () => builder,
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => ({ from: query }) }));
vi.mock("@/features/settings/system-settings-data", () => ({ getSystemSettings: mocks.settings, getZaloCenterAccountId: mocks.centerAccountId }));
vi.mock("@/lib/zalo-crm", () => ({
  isZaloCrmConfigured: mocks.isZaloCrmConfigured,
  listAllZaloGroupsCached: mocks.listAllZaloGroups,
  listZaloAccounts: mocks.listZaloAccounts,
}));

import { getZaloGroupLinkWorkspace } from "@/features/parent-messages/zalo-group-link-data";

const ids = {
  an: "70000000-0000-4000-8000-000000000001",
  binh: "70000000-0000-4000-8000-000000000002",
  chau: "70000000-0000-4000-8000-000000000003",
  dung: "70000000-0000-4000-8000-000000000004",
  paused: "70000000-0000-4000-8000-000000000009",
};

const centerAccount = { displayName: "Nick Mau", id: "acc-center", phone: null, status: "connected", zaloUid: null };

function group(externalThreadId: string, groupName: string) {
  return { externalThreadId, groupAvatarUrl: null, groupMembersCount: 3, groupName, id: `conv-${externalThreadId}`, lastMessageAt: null, zaloAccountId: "acc-center" };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queries.length = 0;
  mocks.settings.mockResolvedValue({ "zalo.center_account_id": " acc-center ", "zalo.center_account_name": "Nick Mau" });
  mocks.centerAccountId.mockResolvedValue("acc-center");
  mocks.isZaloCrmConfigured.mockReturnValue(true);
  mocks.listZaloAccounts.mockResolvedValue({ data: [{ ...centerAccount, id: "acc-other" }, centerAccount], ok: true });
  mocks.tables = {
    classes: { data: [{ code: "L6B", id: "class-2" }, { code: "L5A", id: "class-1" }], error: null },
    guardians: {
      data: [
        { full_name: "Tran Thi Mai", id: "gd-1", normalized_phone: null, phone: "+84 912 000 111", zalo: null },
        { full_name: "Tran Van Khoa", id: "gd-2", normalized_phone: "0987000222", phone: "0987 000 222", zalo: null },
        { full_name: "Nguyen Van Hai", id: "gd-3", normalized_phone: "0903000333", phone: "chua co", zalo: null },
        { full_name: "Pham Van Long", id: "gd-4", normalized_phone: null, phone: "chua co", zalo: "84966000555" },
      ],
      error: null,
    },
    student_enrollments: {
      data: [
        { class_id: "class-1", id: "en-1", student_id: ids.binh },
        { class_id: "class-2", id: "en-2", student_id: ids.dung },
        { class_id: "class-1", id: "en-3", student_id: ids.dung },
        { class_id: "class-gone", id: "en-4", student_id: ids.an },
      ],
      error: null,
    },
    student_guardians: {
      data: [
        { guardian_id: "gd-1", id: "sg-1", is_primary: false, student_id: ids.binh },
        { guardian_id: "gd-2", id: "sg-2", is_primary: true, student_id: ids.binh },
        { guardian_id: "gd-3", id: "sg-3", is_primary: true, student_id: ids.an },
        { guardian_id: "gd-4", id: "sg-4", is_primary: true, student_id: ids.dung },
        { guardian_id: "gd-gone", id: "sg-5", is_primary: true, student_id: ids.an },
      ],
      error: null,
    },
    students: {
      data: [
        { birth_year: 2015, full_name: "Nguyễn Thị An", id: ids.an, lifecycle_status: "active", public_code: "TV-MAU-001", zalo_group_thread_id: null },
        { birth_year: 2014, full_name: "Trần Văn Bình", id: ids.binh, lifecycle_status: "resumed", public_code: "TV-MAU-002", zalo_group_thread_id: null },
        { birth_year: 2013, full_name: "Lê Minh Châu", id: ids.chau, lifecycle_status: "active", public_code: "TV-MAU-003", zalo_group_thread_id: "thread-linked-studying" },
        { birth_year: 2016, full_name: "Phạm Gia Dũng", id: ids.dung, lifecycle_status: "active", public_code: "TV-MAU-004", zalo_group_thread_id: null },
        { birth_year: 2012, full_name: "Đỗ Văn Tạm Nghỉ", id: ids.paused, lifecycle_status: "reserved", public_code: "TV-MAU-009", zalo_group_thread_id: "thread-linked-paused" },
      ].reverse(),
      error: null,
    },
  };
  mocks.listAllZaloGroups.mockResolvedValue({
    data: {
      groups: [
        group("thread-linked-studying", "SLL Lê Minh Châu"),
        // Linked to a paused student: Bình's full name, so it would be a sure match if offered.
        group("thread-linked-paused", "SLL Trần Văn Bình"),
        group("thread-an", "SLL Nguyễn Thị An"),
        group("thread-binh-ph", "PH Binh 0912 000 111"),
        group("thread-long-ph", "PH Long 0966.000.555"),
      ],
      total: 5,
      truncated: false,
    },
    ok: true,
  });
});

describe("getZaloGroupLinkWorkspace", () => {
  it("fails when any student or guardian list cannot be read, before calling ZaloCRM", async () => {
    mocks.tables.guardians = { data: null, error: { message: "permission denied for table guardians" } };
    expect(await getZaloGroupLinkWorkspace({ includeGuardianDetails: true })).toEqual({ error: "Không tải được danh sách học sinh và phụ huynh.", ok: false });
    expect(mocks.listZaloAccounts).not.toHaveBeenCalled();
    expect(mocks.listAllZaloGroups).not.toHaveBeenCalled();
  });

  it("stops at the first connection step that is not ready, without calling the next one", async () => {
    // Not configured: no CRM calls, counts still known.
    mocks.isZaloCrmConfigured.mockReturnValue(false);
    let result = await getZaloGroupLinkWorkspace({ includeGuardianDetails: true });
    expect(result.ok && result.data.status).toMatchObject({ configured: false, crmError: null, groupsTotal: null, linkedStudents: 1, studyingStudents: 4 });
    expect(result.ok && result.data.matches).toEqual([]);
    expect(mocks.listZaloAccounts).not.toHaveBeenCalled();
    expect(mocks.listAllZaloGroups).not.toHaveBeenCalled();

    // CRM unreachable or key refused.
    mocks.isZaloCrmConfigured.mockReturnValue(true);
    mocks.listZaloAccounts.mockResolvedValueOnce({ error: "Invalid API key.", ok: false });
    result = await getZaloGroupLinkWorkspace({ includeGuardianDetails: true });
    expect(result.ok && result.data.status).toMatchObject({ centerAccount: null, configured: true, crmError: "Invalid API key.", groupsTotal: null });
    expect(mocks.listAllZaloGroups).not.toHaveBeenCalled();

    // No center nick chosen: never list groups (the CRM would return every nick's groups).
    mocks.settings.mockResolvedValueOnce({ "zalo.center_account_id": "   ", "zalo.center_account_name": "" });
    mocks.centerAccountId.mockResolvedValueOnce("");
    result = await getZaloGroupLinkWorkspace({ includeGuardianDetails: true });
    expect(result.ok && result.data.status).toMatchObject({ centerAccount: null, centerAccountId: "", crmError: null, groupsTotal: null });
    expect(result.ok && result.data.matches).toEqual([]);
    expect(mocks.listAllZaloGroups).not.toHaveBeenCalled();

    // The chosen nick is gone from ZaloCRM, or not connected: same gate as checklist step 3.
    mocks.listZaloAccounts.mockResolvedValueOnce({ data: [{ ...centerAccount, id: "acc-other" }], ok: true });
    result = await getZaloGroupLinkWorkspace({ includeGuardianDetails: true });
    expect(result.ok && result.data.status).toMatchObject({ centerAccount: null, groupsTotal: null });
    mocks.listZaloAccounts.mockResolvedValueOnce({ data: [{ ...centerAccount, status: "disconnected" }], ok: true });
    result = await getZaloGroupLinkWorkspace({ includeGuardianDetails: true });
    expect(result.ok && result.data.status).toMatchObject({ centerAccount: { status: "disconnected" }, groupsTotal: null });
    expect(result.ok && result.data.matches).toEqual([]);
    expect(mocks.listAllZaloGroups).not.toHaveBeenCalled();

    // Groups could not be listed.
    mocks.listAllZaloGroups.mockResolvedValueOnce({ error: "Không kết nối được ZaloCRM: timeout", ok: false });
    result = await getZaloGroupLinkWorkspace({ includeGuardianDetails: true });
    expect(result.ok && result.data.status).toMatchObject({
      centerAccount,
      groupsError: "Không kết nối được ZaloCRM: timeout",
      groupsTotal: null,
    });
    expect(result.ok && result.data.matches).toEqual([]);
    expect(mocks.listAllZaloGroups).toHaveBeenCalledWith("acc-center");
  });

  it("lists unlinked studying students in given-name order and never offers a group linked to anyone", async () => {
    const result = await getZaloGroupLinkWorkspace({ includeGuardianDetails: true });
    if (!result.ok) throw new Error(result.error);
    const { matches, status, students } = result.data;

    // Ended guardian links and past enrollments never feed names, phones or class codes.
    expect(mocks.queries.find((entry) => entry.table === "student_guardians")?.filters).toContain("is:ended_at=null");
    expect(mocks.queries.find((entry) => entry.table === "student_enrollments")?.filters).toEqual(
      expect.arrayContaining(["eq:status=active", "is:effective_to=null"]),
    );
    expect(status).toEqual({
      centerAccount,
      centerAccountId: "acc-center",
      centerAccountName: "Nick Mau",
      configured: true,
      crmError: null,
      groupsError: null,
      groupsListed: 5,
      groupsTotal: 5,
      groupsTruncated: false,
      linkedStudents: 1,
      studyingStudents: 4,
    });
    expect(students).toEqual([
      { birthYear: 2015, classCodes: [], fullName: "Nguyễn Thị An", guardianSummary: "Nguyen Van Hai · 0903000333", id: ids.an, publicCode: "TV-MAU-001" },
      {
        birthYear: 2014,
        classCodes: ["L5A"],
        fullName: "Trần Văn Bình",
        guardianSummary: "Tran Van Khoa · 0987000222; Tran Thi Mai · 0912000111",
        id: ids.binh,
        publicCode: "TV-MAU-002",
      },
      { birthYear: 2016, classCodes: ["L5A", "L6B"], fullName: "Phạm Gia Dũng", guardianSummary: "Pham Van Long · 0966000555", id: ids.dung, publicCode: "TV-MAU-004" },
    ]);

    const offered = matches.flatMap((match) => match.candidates.map((candidate) => candidate.group.externalThreadId));
    expect(offered).not.toContain("thread-linked-paused");
    expect(offered).not.toContain("thread-linked-studying");
    expect(
      matches.map((match) => ({
        candidates: match.candidates.map((candidate) => [candidate.group.externalThreadId, ...candidate.reasons]),
        confidence: match.confidence,
        studentId: match.studentId,
      })),
    ).toEqual([
      { candidates: [["thread-an", "student_name"]], confidence: "sure", studentId: ids.an },
      // Phone found only after "+84 912 000 111" is normalized.
      { candidates: [["thread-binh-ph", "guardian_phone"]], confidence: "ambiguous", studentId: ids.binh },
      // Phone found only through the guardian's zalo field ("84966000555").
      { candidates: [["thread-long-ph", "guardian_phone"]], confidence: "ambiguous", studentId: ids.dung },
    ]);
  });

  it("lets every student outside the table compete, and hides guardian details without guardians.view", async () => {
    // A withdrawn namesake of An, never linked: "SLL Nguyễn Thị An" may be hers.
    mocks.tables.students = {
      data: [
        ...(mocks.tables.students.data ?? []),
        { birth_year: 2009, full_name: "Nguyễn Thị An", id: "70000000-0000-4000-8000-000000000010", lifecycle_status: "withdrawn", public_code: "TV-MAU-010", zalo_group_thread_id: null },
      ],
      error: null,
    };
    const result = await getZaloGroupLinkWorkspace({ includeGuardianDetails: false });
    if (!result.ok) throw new Error(result.error);
    const an = result.data.matches.find((match) => match.studentId === ids.an);
    expect(an?.confidence).toBe("ambiguous");
    expect(result.data.matches.map((match) => match.studentId)).not.toContain("70000000-0000-4000-8000-000000000010");
    expect(result.data.students.map((student) => student.guardianSummary)).toEqual(["", "", ""]);
    // No guardian association reaches the page either.
    const reasons = result.data.matches.flatMap((match) => match.candidates.flatMap((candidate) => candidate.reasons));
    expect(reasons.some((reason) => reason.startsWith("guardian_"))).toBe(false);
  });

  it("reports how many groups were read when the CRM read is truncated", async () => {
    mocks.listAllZaloGroups.mockResolvedValueOnce({ data: { groups: [group("thread-an", "SLL Nguyễn Thị An")], total: 5, truncated: true }, ok: true });
    const result = await getZaloGroupLinkWorkspace({ includeGuardianDetails: true });
    expect(result.ok && result.data.status).toMatchObject({ groupsListed: 1, groupsTotal: 5, groupsTruncated: true });
  });
});
