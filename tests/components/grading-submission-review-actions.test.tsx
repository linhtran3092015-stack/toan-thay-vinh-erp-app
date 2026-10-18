// Value: protects=staff can match a submission to a student and one of that student's sessions that day, mark junk with a reason, re-run the matcher, and see and restore junk under "Đã bỏ qua" on "Bài nộp chưa ghép";
// fails_when=the picker sends the wrong ids, allows saving without a session, skips the reason, hides the "no session" case, forgets to refresh the list, the filter links point elsewhere, or an ignored row hides who/when/why or restores without confirmation;
// why_new=new client UI on the review page;
// seam=server actions replaced by stand-ins, router mocked; no_claim=does not prove the server actions or SQL
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import type { GradingReviewActions } from "@/features/grading-submissions/components/review-actions";
import { UnmatchedSubmissionsPage } from "@/features/grading-submissions/components/unmatched-submissions-page";
import type { IgnoredGradingSubmission, UnmatchedGradingSubmission } from "@/features/grading-submissions/data";
import type { MatchCandidateStudent } from "@/features/grading-submissions/review";

const item: UnmatchedGradingSubmission = {
  answerText: "13. 18",
  answerTruncated: false,
  claimedBirthYear: 2014,
  claimedClassOption: null,
  claimedClassOptionOther: null,
  claimedClassSessionId: null,
  claimedFullName: "Nguyen Minh Anh",
  claimedSessionLabel: null,
  claimedStudentCode: null,
  id: "sub-1",
  issues: ["student_ambiguous"],
  receivedAt: "2026-10-18T12:25:05Z",
  student: null,
  submittedAt: "2026-10-18T12:25:00Z", // 19:25 in Vietnam
};

function session(id: string, classCode: string, startTime: string, endTime: string, overrides: Partial<MatchCandidateStudent["sessions"][number]> = {}) {
  return { attendanceStatus: "present", classCode, classLevel: "CLC", classSessionId: id, endTime, onRoster: true, sessionDate: "2026-10-18", startTime, ...overrides };
}

const students: MatchCandidateStudent[] = [
  {
    birthYear: 2014,
    enrolledOnDay: true,
    fullName: "Nguyễn Minh Anh",
    id: "st-1",
    lifecycleStatus: "active",
    nickname: null,
    publicCode: "TV-2026-00011",
    sessions: [session("ses-evening", "7CLC1", "18:00:00", "19:30:00")],
  },
  {
    birthYear: 2014,
    enrolledOnDay: true,
    fullName: "Nguyễn Minh Anh",
    id: "st-2",
    lifecycleStatus: "active",
    nickname: "Bông",
    publicCode: "TV-2026-00012",
    sessions: [
      session("ses-morning", "7B", "08:00:00", "09:30:00", { attendanceStatus: "additional_study", onRoster: false }),
      session("ses-evening", "7CLC1", "18:00:00", "19:30:00", { attendanceStatus: null }),
    ],
  },
  {
    birthYear: 2014,
    enrolledOnDay: true,
    fullName: "Phạm Gia Huy",
    id: "st-3",
    lifecycleStatus: "active",
    nickname: null,
    publicCode: "TV-2026-00014",
    sessions: [],
  },
];

function makeActions(overrides: Partial<GradingReviewActions> = {}): GradingReviewActions {
  return {
    ignore: vi.fn(async () => ({ message: "Đã bỏ qua bài (bài rác).", ok: true })),
    loadCandidates: vi.fn(async () => ({ ok: true as const, students })),
    match: vi.fn(async () => ({ message: "Đã ghép bài vào buổi học.", ok: true })),
    rematch: vi.fn(async () => ({
      message: "Đã ghép thêm 1 bài.",
      ok: true as const,
      summary: { failed: 0, invalid: 0, matched: 1, skipped: 0, total: 1, unchanged: 0, updated: 0 },
    })),
    restore: vi.fn(async () => ({ message: "Đã khôi phục bài về danh sách chờ ghép.", ok: true })),
    ...overrides,
  };
}

beforeEach(() => {
  router.refresh.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("manual match", () => {
  it("picks a student, then one of their sessions that day, and matches", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    render(<UnmatchedSubmissionsPage actions={actions} items={[item]} limit={200} />);

    await user.click(screen.getByRole("button", { name: "Ghép tay" }));
    const panel = await screen.findByRole("region", { name: "Ghép tay" });
    expect(actions.loadCandidates).toHaveBeenCalledWith({ submissionId: "sub-1" });
    expect(within(panel).getByText(/18\/10\/2026/)).toBeInTheDocument();

    const confirm = within(panel).getByRole("button", { name: "Ghép vào buổi này" });
    expect(confirm).toBeDisabled();

    await user.click(await within(panel).findByRole("radio", { name: /Bông/ }));
    const sessions = within(panel).getByRole("group", { name: /Buổi của Nguyễn Minh Anh/ });
    // Two sessions that day: the one whose window holds 19:25 is preselected.
    expect(within(sessions).getByRole("radio", { name: /7CLC1 · 18:00–19:30/ })).toBeChecked();
    expect(within(sessions).getByRole("radio", { name: /7B · 08:00–09:30/ })).not.toBeChecked();
    expect(within(sessions).getByText("Ngoài danh sách lớp")).toBeInTheDocument();
    expect(within(sessions).getByText("Điểm danh: Học thêm")).toBeInTheDocument();

    await user.click(within(sessions).getByRole("radio", { name: /7B · 08:00–09:30/ }));
    await user.type(within(panel).getByLabelText("Ghi chú (không bắt buộc)"), "Em học bù sáng");
    await user.click(confirm);

    expect(actions.match).toHaveBeenCalledWith({
      classSessionId: "ses-morning",
      reason: "Em học bù sáng",
      studentId: "st-2",
      submissionId: "sub-1",
    });
    // Confirmed in the row and at the top of the page; the list refreshes a moment later.
    expect(await screen.findAllByText("Đã ghép bài vào buổi học.")).toHaveLength(2);
    expect(screen.queryByRole("region", { name: "Ghép tay" })).toBeNull();
    await waitFor(() => expect(router.refresh).toHaveBeenCalled(), { timeout: 2000 });
  });

  it("filters without accents and says when a student has no session that day", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    render(<UnmatchedSubmissionsPage actions={actions} items={[item]} limit={200} />);

    await user.click(screen.getByRole("button", { name: "Ghép tay" }));
    const panel = await screen.findByRole("region", { name: "Ghép tay" });
    await within(panel).findAllByRole("radio");
    await user.type(within(panel).getByLabelText("Lọc học sinh theo tên hoặc mã"), "pham huy");
    expect(within(panel).getAllByRole("radio")).toHaveLength(1);

    await user.click(within(panel).getByRole("radio", { name: /Phạm Gia Huy/ }));
    expect(within(panel).getByText("Không có buổi để ghép")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Ghép vào buổi này" })).toBeDisabled();
  });

  it("searches other birth years on request", async () => {
    const user = userEvent.setup();
    const loadCandidates = vi.fn(async ({ query }: { query?: string | null; submissionId: string }) =>
      query
        ? {
            ok: true as const,
            students: [{ ...students[0], birthYear: 2013, fullName: "Lê Thị Dung", id: "st-9", publicCode: "TV-2026-00099" }],
          }
        : { ok: true as const, students },
    );
    render(<UnmatchedSubmissionsPage actions={makeActions({ loadCandidates })} items={[item]} limit={200} />);

    await user.click(screen.getByRole("button", { name: "Ghép tay" }));
    const panel = await screen.findByRole("region", { name: "Ghép tay" });
    await within(panel).findAllByRole("radio");
    await user.type(within(panel).getByLabelText("Lọc học sinh theo tên hoặc mã"), "Dung");
    expect(within(panel).getByText("Không có học sinh phù hợp.")).toBeInTheDocument();

    await user.click(within(panel).getByRole("button", { name: "Tìm cả năm sinh khác" }));
    expect(loadCandidates).toHaveBeenLastCalledWith({ query: "Dung", submissionId: "sub-1" });
    await user.click(await within(panel).findByRole("radio", { name: /Lê Thị Dung/ }));

    // Back to the birth-year list: Dung is no longer listed but stays picked with her session.
    await user.click(within(panel).getByRole("button", { name: "Quay lại các em sinh 2014" }));
    expect(within(panel).queryByRole("radio", { name: /Lê Thị Dung/ })).toBeNull();
    expect(within(panel).getByRole("group", { name: /Buổi của Lê Thị Dung/ })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Ghép vào buổi này" })).toBeEnabled();
  });

  it("preselects the student the webhook already recognised and shows a refused match", async () => {
    const user = userEvent.setup();
    const match = vi.fn(async () => ({ message: "Học sinh không có trong buổi này.", ok: false }));
    render(
      <UnmatchedSubmissionsPage
        actions={makeActions({ match })}
        items={[{ ...item, issues: ["outside_window"], student: { fullName: "Nguyễn Minh Anh", id: "st-1", publicCode: "TV-2026-00011" } }]}
        limit={200}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Ghép tay" }));
    const panel = await screen.findByRole("region", { name: "Ghép tay" });
    await waitFor(() => expect(within(panel).getByRole("radio", { name: /TV-2026-00011/ })).toBeChecked());
    expect(within(panel).getByRole("radio", { name: /7CLC1 · 18:00–19:30/ })).toBeChecked();

    await user.click(within(panel).getByRole("button", { name: "Ghép vào buổi này" }));
    expect(await within(panel).findByText("Học sinh không có trong buổi này.")).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("shows a load error", async () => {
    const user = userEvent.setup();
    render(
      <UnmatchedSubmissionsPage
        actions={makeActions({ loadCandidates: vi.fn(async () => ({ message: "Không tải được danh sách học sinh.", ok: false as const })) })}
        items={[item]}
        limit={200}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ghép tay" }));
    expect(await screen.findByText("Không tải được danh sách học sinh.")).toBeInTheDocument();
  });
});

describe("ignore (bài rác)", () => {
  it("needs a reason, then ignores and refreshes", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    render(<UnmatchedSubmissionsPage actions={actions} items={[item]} limit={200} />);

    await user.click(screen.getByRole("button", { name: "Bỏ qua (bài rác)" }));
    const confirm = screen.getByRole("button", { name: "Xác nhận bỏ qua" });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText("Lý do bỏ qua"), "Gõ linh tinh");
    await user.click(confirm);

    expect(actions.ignore).toHaveBeenCalledWith({ reason: "Gõ linh tinh", submissionId: "sub-1" });
    expect(await screen.findAllByText("Đã bỏ qua bài (bài rác).")).toHaveLength(2);
    await waitFor(() => expect(router.refresh).toHaveBeenCalled(), { timeout: 2000 });
  });

  it("goes back without doing anything on Hủy", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    render(<UnmatchedSubmissionsPage actions={actions} items={[item]} limit={200} />);
    await user.click(screen.getByRole("button", { name: "Bỏ qua (bài rác)" }));
    await user.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.getByRole("button", { name: "Ghép tay" })).toBeInTheDocument();
    expect(actions.ignore).not.toHaveBeenCalled();
  });
});

describe("Ghép lại tự động", () => {
  it("re-runs the matcher and shows the summary", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    render(<UnmatchedSubmissionsPage actions={actions} items={[item]} limit={200} />);

    await user.click(screen.getByRole("button", { name: "Ghép lại tự động" }));

    expect(actions.rematch).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Đã ghép thêm 1 bài.")).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows an error without refreshing", async () => {
    const user = userEvent.setup();
    render(
      <UnmatchedSubmissionsPage
        actions={makeActions({ rematch: vi.fn(async () => ({ message: "Không ghép lại được. Vui lòng thử lại.", ok: false as const })) })}
        items={[item]}
        limit={200}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ghép lại tự động" }));
    expect(await screen.findByText("Không ghép lại được. Vui lòng thử lại.")).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("is hidden when nothing waits", () => {
    render(<UnmatchedSubmissionsPage actions={makeActions()} items={[]} limit={200} />);
    expect(screen.queryByRole("button", { name: "Ghép lại tự động" })).toBeNull();
  });
});

describe("filter: Chờ ghép | Đã bỏ qua", () => {
  it("links both views, marking the current one", () => {
    render(<UnmatchedSubmissionsPage actions={makeActions()} items={[item]} limit={200} />);
    const nav = screen.getByRole("navigation", { name: "Lọc theo trạng thái" });
    const pending = within(nav).getByRole("link", { name: "Chờ ghép (1)" });
    expect(pending).toHaveAttribute("aria-current", "page");
    expect(pending).toHaveAttribute("href", "/grading-submissions");
    const ignoredLink = within(nav).getByRole("link", { name: "Đã bỏ qua" });
    expect(ignoredLink).not.toHaveAttribute("aria-current");
    expect(ignoredLink).toHaveAttribute("href", "/grading-submissions?status=ignored");
  });

  it("uses the given base path (dev preview)", () => {
    render(<UnmatchedSubmissionsPage actions={makeActions()} basePath="/dev/grading-submissions" items={[]} limit={200} status="ignored" />);
    const nav = screen.getByRole("navigation", { name: "Lọc theo trạng thái" });
    expect(within(nav).getByRole("link", { name: "Đã bỏ qua" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Chờ ghép" })).toHaveAttribute("href", "/dev/grading-submissions");
  });
});

describe("Đã bỏ qua", () => {
  const ignoredItem: IgnoredGradingSubmission = {
    ...item,
    answerText: "asdfgh",
    claimedFullName: "Ai Đó",
    id: "sub-9",
    ignored: { at: "2026-10-18T13:10:00Z", byName: "Trợ Giảng Thử", reason: "Gõ linh tinh" }, // 20:10 in Vietnam
    issues: ["student_not_found"],
  };

  it("shows who ignored each submission, when and why, without the review actions", () => {
    render(
      <UnmatchedSubmissionsPage
        actions={makeActions()}
        items={[ignoredItem, { ...ignoredItem, claimedFullName: "Bài Cũ", id: "sub-10", ignored: null }]}
        limit={200}
        status="ignored"
      />,
    );

    expect(screen.getByText("2 bài, bỏ qua gần nhất trước.")).toBeInTheDocument();
    const [first, second] = screen.getAllByRole("listitem");
    // Ignore time in Vietnam time, whatever the test runner's zone, then who did it.
    const when = within(first).getByText(/· Trợ Giảng Thử$/);
    expect(when).toHaveTextContent("20:10");
    expect(when).toHaveTextContent("18/10/2026");
    expect(within(first).getByText("Gõ linh tinh")).toBeInTheDocument();
    expect(within(second).getByText("Không có trong lịch sử thao tác")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Khôi phục" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Ghép tay" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Bỏ qua (bài rác)" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ghép lại tự động" })).toBeNull();
  });

  it("restores after an in-row confirmation with an optional note, then refreshes", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    render(<UnmatchedSubmissionsPage actions={actions} items={[ignoredItem]} limit={200} status="ignored" />);

    await user.click(screen.getByRole("button", { name: "Khôi phục" }));
    const panel = screen.getByRole("region", { name: "Khôi phục bài" });
    expect(actions.restore).not.toHaveBeenCalled();
    await user.type(within(panel).getByLabelText("Ghi chú (không bắt buộc)"), "  Bỏ qua nhầm ");
    await user.click(within(panel).getByRole("button", { name: "Xác nhận khôi phục" }));

    expect(actions.restore).toHaveBeenCalledWith({ reason: "Bỏ qua nhầm", submissionId: "sub-9" });
    expect(await screen.findAllByText("Đã khôi phục bài về danh sách chờ ghép.")).toHaveLength(2);
    expect(screen.queryByRole("region", { name: "Khôi phục bài" })).toBeNull();
    await waitFor(() => expect(router.refresh).toHaveBeenCalled(), { timeout: 2000 });
  });

  it("sends no note when left blank, and Hủy goes back without restoring", async () => {
    const user = userEvent.setup();
    const actions = makeActions();
    render(<UnmatchedSubmissionsPage actions={actions} items={[ignoredItem]} limit={200} status="ignored" />);

    await user.click(screen.getByRole("button", { name: "Khôi phục" }));
    await user.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.queryByRole("region", { name: "Khôi phục bài" })).toBeNull();
    expect(actions.restore).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Khôi phục" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận khôi phục" }));
    expect(actions.restore).toHaveBeenCalledWith({ reason: null, submissionId: "sub-9" });
  });

  it("shows a refused restore in the row without refreshing", async () => {
    const user = userEvent.setup();
    const restore = vi.fn(async () => ({ message: "Bài này không còn ở danh sách đã bỏ qua. Tải lại trang để xem danh sách mới.", ok: false }));
    render(<UnmatchedSubmissionsPage actions={makeActions({ restore })} items={[ignoredItem]} limit={200} status="ignored" />);

    await user.click(screen.getByRole("button", { name: "Khôi phục" }));
    const panel = screen.getByRole("region", { name: "Khôi phục bài" });
    await user.click(within(panel).getByRole("button", { name: "Xác nhận khôi phục" }));

    expect(await within(panel).findByText(/không còn ở danh sách đã bỏ qua/)).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Xác nhận khôi phục" })).toBeEnabled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("says when nothing has been ignored", () => {
    render(<UnmatchedSubmissionsPage actions={makeActions()} items={[]} limit={200} status="ignored" />);
    expect(screen.getByText("Chưa có bài bị bỏ qua")).toBeInTheDocument();
  });
});
