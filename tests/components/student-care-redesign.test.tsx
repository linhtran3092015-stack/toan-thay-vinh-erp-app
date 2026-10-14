// Value: protects=the redesigned student-care screens keep their contracts: exactly one control per queue row (claim only for an unowned, unstarted task the viewer may handle, else "Mở"), the generator settings dialog only with student_care.configure, the generator strip's tone and words, "Ghi nhận hoàn thành" disabled with its visible reason until a successful contact exists, the timeline newest first, and one page primary on the task page;
// fails_when=a row shows both or neither control, a viewer without handle gets "Nhận việc", the configure dialog shows without the permission, the strip goes colour-only or calls a paused/late generator healthy, completion is enabled without a contact or loses its reason, the timeline reorders, or the task page shows two primaries;
// why_new=step 11a rewrites both student-care routes; seam=mutateCare is mocked and must not be called by these renders, next/navigation is stubbed; no_claim=does not prove the RPCs accept the commands or cover layout at given widths
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CareActionForm } from "@/features/student-care/components/care-action-form";
import { CareDetailView } from "@/features/student-care/components/care-detail-view";
import { CARE_COMPLETE_DISABLED_REASON } from "@/features/student-care/components/care-detail-sections";
import { CARE_SEARCH_DEBOUNCE_MS } from "@/features/student-care/components/care-queue-filters";
import { CareQueueView } from "@/features/student-care/components/care-queue-view";
import { CARE_TASK_TABLE_LABEL } from "@/features/student-care/components/care-task-table";
import { GeneratorStatusBar } from "@/features/student-care/components/generator-status-bar";
import { careCommandSchema, type CareDashboard, type CareDetail, type CareStudents } from "@/features/student-care/models";
import { CARE_OWNER_REQUIRED_REASON } from "@/features/student-care/student-care-presentation";
import { parseCareFilter, type CareFilter, type CareTab } from "@/features/student-care/student-care-url-state";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), search: "" }));
vi.mock("@/features/student-care/actions", () => ({ mutateCare: mocks.mutate }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/student-care",
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh, replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.search = "";
});
afterEach(cleanup);

const NOW = Date.parse("2026-10-13T07:05:00Z");
const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

type Row = CareDashboard["rows"][number];
function row(overrides: Partial<Row> & Pick<Row, "id" | "full_name">): Row {
  return {
    claim_due_at: null, completed_at: null, contact_due_at: "2026-10-14T14:53:00Z", detected_at: "2026-10-12T14:53:00Z", due_at: null,
    evidence: {}, evidence_current: true, first_contact_at: null, kind: "followup", lifecycle_status: "active", next_followup_at: null,
    outcome: null, overdue: false, owner_id: OTHER, owner_name: "Đặng Phương Thảo", period_month: null, public_code: "TTV-1",
    status: "in_progress", student_id: "33333333-3333-4333-8333-333333333333", version: 1, ...overrides,
  };
}

function dashboard(overrides: Partial<CareDashboard> = {}): CareDashboard {
  return {
    assignees: [{ id: OTHER, name: "Đặng Phương Thảo", open_tasks: 2 }],
    month: "2026-10-01",
    page: 1,
    queue: { failed: 0, pending: 0 },
    rows: [
      row({ full_name: "Trần Gia Bảo", id: "44444444-4444-4444-8444-444444444441", owner_id: null, owner_name: null, status: "open" }),
      row({ full_name: "Bùi Quang Minh", id: "44444444-4444-4444-8444-444444444442" }),
      row({ full_name: "Lý Nhật Quang", id: "44444444-4444-4444-8444-444444444443", owner_id: null, owner_name: null, status: "following_up" }),
    ],
    settings: { enabled: true, last_error: null, last_reconcile_at: "2026-10-12T23:00:00Z", last_success_at: "2026-10-13T07:02:00Z" },
    summary: { monthly_cancelled: 0, monthly_completed: 212, monthly_on_time: 200, monthly_total: 312, open_alerts: 9, overdue: 3, unassigned: 4 },
    total: 3,
    ...overrides,
  };
}

function renderQueue(
  options: { canAssign?: boolean; canConfigure?: boolean; canHandle?: boolean; data?: CareDashboard | null; filter?: CareFilter; students?: CareStudents | null; tab?: CareTab } = {},
) {
  return render(
    <CareQueueView
      canAssign={options.canAssign ?? false}
      canConfigure={options.canConfigure ?? false}
      canHandle={options.canHandle ?? true}
      data={options.data === undefined ? dashboard() : options.data}
      filter={options.filter ?? parseCareFilter({})}
      now={NOW}
      students={options.students ?? null}
      tab={options.tab ?? "tasks"}
    />,
  );
}

function tableRow(name: string) {
  const table = screen.getByRole("table", { name: "Hàng đợi công việc chăm sóc học sinh" });
  return within(table).getByRole("link", { name }).closest("tr")!;
}

describe("student care queue (13a)", () => {
  it("gives every row exactly one control: claim when unowned and open, otherwise open", () => {
    renderQueue();
    const claimRow = tableRow("Trần Gia Bảo");
    expect(within(claimRow).getByRole("button", { name: "Nhận việc · Trần Gia Bảo" })).toBeInTheDocument();
    expect(within(claimRow).queryByRole("link", { name: /^Mở/ })).toBeNull();
    for (const name of ["Bùi Quang Minh", "Lý Nhật Quang"]) {
      expect(within(tableRow(name)).getByRole("link", { name: `Mở công việc · ${name}` })).toBeInTheDocument();
      expect(within(tableRow(name)).queryByRole("button")).toBeNull();
    }
    expect(within(tableRow("Trần Gia Bảo")).getByText("Chưa giao")).toBeInTheDocument();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("does not offer claim to a viewer without student_care.handle", () => {
    renderQueue({ canHandle: false });
    expect(screen.queryByRole("button", { name: /Nhận việc/ })).toBeNull();
    expect(within(tableRow("Trần Gia Bảo")).getByRole("link", { name: "Mở công việc · Trần Gia Bảo" })).toBeInTheDocument();
  });

  it("shows the month figures and gates the generator settings behind student_care.configure", () => {
    const { unmount } = renderQueue();
    expect(screen.getByRole("heading", { level: 1, name: "Chăm sóc học sinh" })).toBeInTheDocument();
    expect(screen.getByText("Tháng 10/2026 · 9 cảnh báo đang mở · 4 chưa giao · 3 quá hạn · Coaching tháng 212/312 hoàn thành")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cấu hình bộ tự sinh" })).toBeNull();
    unmount();

    renderQueue({ canConfigure: true });
    fireEvent.click(screen.getByRole("button", { name: "Cấu hình bộ tự sinh" }));
    const dialog = screen.getByRole("dialog", { name: "Cấu hình bộ tự sinh" });
    expect(within(dialog).getByRole("button", { name: "Tạm dừng tự động" })).toBeInTheDocument();
    expect(within(dialog).getByText(/Tạm dừng giữ nguyên lịch sử/)).toBeInTheDocument();
  });

  it("keeps a failed dashboard read inside the table frame instead of an empty list", () => {
    renderQueue({ data: null });
    expect(screen.getAllByText("Chưa tải được chăm sóc học sinh").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Chưa có công việc/)).toBeNull();
  });

  it("does not let an empty queue read as all clear while the generator is late", () => {
    renderQueue({ data: dashboard({ rows: [], settings: { enabled: true, last_error: null, last_reconcile_at: null, last_success_at: "2026-10-13T06:00:00Z" }, total: 0 }) });
    expect(screen.getAllByText(/Không có cảnh báo chưa có nghĩa tất cả học sinh đều ổn/).length).toBeGreaterThan(1);
  });

  it("counts chips from the summary without disabling a zero count", () => {
    renderQueue({ data: dashboard({ summary: { monthly_cancelled: 0, monthly_completed: 0, monthly_on_time: 0, monthly_total: 0, open_alerts: 0, overdue: 0, unassigned: 0 } }) });
    const chips = screen.getByRole("group", { name: "Lọc nhanh công việc chăm sóc" });
    expect(within(chips).getByRole("button", { name: /^Cảnh báo sớm\s?0$/ })).toBeEnabled();
    expect(within(chips).getByRole("button", { name: /^Coaching tháng\s?0\/0$/ })).toBeEnabled();
    expect(within(chips).getByRole("button", { name: "Của tôi" })).toBeEnabled();
    fireEvent.click(within(chips).getByRole("button", { name: /^Quá hạn\s?0$/ }));
    expect(mocks.replace).toHaveBeenCalledWith("/student-care?overdue=true", { scroll: false });
  });
});

const STUDENT = "77777777-7777-4777-8777-777777777777";

// Generated by /ship coverage audit (Claude Opus 5.5) — 2026-10-15
describe("student care queue navigation and assignment tabs (13a)", () => {
  // Value: protects=a filter change on a student-scoped queue (/student-care?student_id=… from the student and home cards) keeps the student, resets the page, and "Xem tất cả học sinh" drops only the student;
  // fails_when=the rewritten FilterBar drops student_id (the old form kept it as a hidden input) or keeps a stale page past the new result set;
  // why_new=the chip test covers only the chip path with an empty URL; seam=none; no_claim=router.replace is mocked, so it does not prove the server re-reads the URL
  it("keeps the student filter and resets the page when a filter changes", () => {
    mocks.search = `student_id=${STUDENT}&kind=alert&page=3`;
    const { unmount } = renderQueue();
    fireEvent.change(screen.getByRole("combobox", { name: "Trạng thái" }), { target: { value: "in_progress" } });
    expect(mocks.replace).toHaveBeenLastCalledWith(`/student-care?student_id=${STUDENT}&kind=alert&status=in_progress`, { scroll: false });
    unmount();

    renderQueue();
    fireEvent.click(screen.getByRole("button", { name: "Xem tất cả học sinh" }));
    expect(mocks.replace).toHaveBeenLastCalledWith("/student-care?kind=alert", { scroll: false });
  });

  // Value: protects=the frame pager shows "a–b trong N task" at the RPC page size (50) and moves pages without losing the active filters; page 1 drops the page key;
  // fails_when=the page size drifts from the RPC's limit 50, the pager rebuilds the URL without the filters, or page 1 keeps a stray page=1;
  // why_new=the old "Trang trước/Trang sau" links were replaced by CarePager and nothing renders it with total > 50; seam=none; no_claim=router.push is mocked
  it("pages through the queue in RPC-sized pages and keeps the filters", () => {
    mocks.search = "kind=alert";
    const { unmount } = renderQueue({ data: dashboard({ total: 120 }), filter: parseCareFilter({ kind: "alert" }) });
    expect(screen.getAllByText("1–50 trong 120 task").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Sau" })[0]);
    expect(mocks.push).toHaveBeenLastCalledWith("/student-care?kind=alert&page=2");
    unmount();

    mocks.search = "kind=alert&page=3";
    renderQueue({ data: dashboard({ total: 120 }), filter: parseCareFilter({ kind: "alert", page: "3" }) });
    expect(screen.getAllByText("101–120 trong 120 task").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "1" })[0]);
    expect(mocks.push).toHaveBeenLastCalledWith("/student-care?kind=alert");
  });

  // Value: protects=the "Phân công lâu dài" / "Theo dõi riêng" tabs keep their permission gates: assign_student only with student_care.assign, create_followup only on the inactive tab with student_care.handle, and a failed student read shows the in-frame error;
  // fails_when=the restyled CareStudentsTable shows a write dialog to a viewer without the permission, offers follow-up on the active tab, or renders a failed read as an empty list;
  // why_new=the preview test renders only the empty inactive tab; seam=none; no_claim=mutateCare is mocked and never called; the RPC still enforces the permission
  it("gates the assignment-tab dialogs by permission and tab", () => {
    const students: CareStudents = {
      rows: [{ full_name: "Phạm Khánh Linh", id: STUDENT, lifecycle_status: "active", owner_id: null, owner_name: null, public_code: "TTV-00200" }],
      total: 1,
    };
    const first = renderQueue({ canAssign: false, canHandle: true, students, tab: "assignments" });
    expect(screen.queryAllByRole("button", { name: "Phân công" })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: "Tạo lịch theo dõi" })).toHaveLength(0);
    expect(screen.getAllByRole("link", { name: "Xem công việc" })[0]).toHaveAttribute("href", `/student-care?student_id=${STUDENT}`);
    first.unmount();

    // student_care.assign alone is not enough: mutateCare and the RPC check student_care.handle first (F11).
    const assignOnly = renderQueue({ canAssign: true, canHandle: false, students, tab: "assignments" });
    expect(screen.queryAllByRole("button", { name: "Phân công" })).toHaveLength(0);
    assignOnly.unmount();

    const assign = renderQueue({ canAssign: true, canHandle: true, students, tab: "assignments" });
    expect(screen.queryAllByRole("button", { name: "Tạo lịch theo dõi" })).toHaveLength(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Phân công" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Phân công phụ trách · Phạm Khánh Linh" });
    expect(within(dialog).getByRole("combobox", { name: /Người phụ trách/ })).toBeRequired();
    assign.unmount();

    const inactive = renderQueue({ canAssign: false, canHandle: true, students, tab: "inactive" });
    expect(screen.getAllByRole("button", { name: "Tạo lịch theo dõi" }).length).toBeGreaterThan(0);
    inactive.unmount();

    renderQueue({ canAssign: true, canHandle: true, students: null, tab: "assignments" });
    expect(screen.getAllByText("Chưa tải được chăm sóc học sinh").length).toBeGreaterThan(0);
    expect(screen.queryAllByRole("button", { name: "Phân công" })).toHaveLength(0);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});

describe("generator status strip", () => {
  const base = dashboard();

  it("is neutral and says it is running when healthy", () => {
    render(<GeneratorStatusBar data={base} now={NOW} />);
    const strip = screen.getByRole("status");
    expect(strip).toHaveAttribute("data-tone", "neutral");
    expect(strip).toHaveTextContent("Bộ tự sinh đang bật · chạy thành công 14:02 (3 phút trước) · hàng đợi 0 · đối soát gần nhất 06:00");
  });

  it("warns in words when late or queued, and is danger when paused or failing", () => {
    const { unmount } = render(<GeneratorStatusBar data={{ ...base, settings: { ...base.settings, last_success_at: "2026-10-13T06:50:00Z" } }} now={NOW} />);
    expect(screen.getByRole("alert")).toHaveAttribute("data-tone", "warning");
    expect(screen.getByRole("alert")).toHaveTextContent("chưa cập nhật đúng hạn");
    unmount();

    const failing = render(<GeneratorStatusBar data={{ ...base, queue: { failed: 2, pending: 2 }, settings: { ...base.settings, last_error: "timeout" } }} now={NOW} />);
    expect(screen.getByRole("alert")).toHaveAttribute("data-tone", "danger");
    expect(screen.getByRole("alert")).toHaveTextContent("Một số học sinh đang chờ kiểm tra lại");
    // queue.failed (attempts > 0) is a subset of queue.pending in get_student_care_dashboard (F10).
    expect(screen.getByRole("alert")).toHaveTextContent("hàng đợi 2 (2 đang thử lại)");
    expect(screen.getByRole("alert")).not.toHaveTextContent(/lỗi ·|0 chờ/);
    expect(screen.getByText("Lỗi gần nhất: timeout")).toBeInTheDocument();
    failing.unmount();

    render(<GeneratorStatusBar data={{ ...base, settings: { ...base.settings, enabled: false } }} now={NOW} />);
    expect(screen.getByRole("status")).toHaveAttribute("data-tone", "danger");
    expect(screen.getByRole("status")).toHaveTextContent("Bộ tự sinh đang tạm dừng");
    expect(screen.getByText(/Không có cảnh báo chưa có nghĩa/)).toBeInTheDocument();
  });
});

function detail(overrides: Partial<CareDetail["task"]> = {}, rest: Partial<CareDetail> = {}): CareDetail {
  return {
    assignees: [{ id: ME, name: "Đặng Phương Thảo" }],
    assignment: null,
    available_coaching: [],
    coaching: [],
    contacts: [],
    events: [
      { actor_name: null, event_type: "signals_updated", id: "e1", occurred_at: "2026-10-12T14:53:00Z", payload: {}, task_id: "55555555-5555-4555-8555-555555555555" },
      { actor_name: "Đặng Phương Thảo", event_type: "contact", id: "e3", occurred_at: "2026-10-13T02:15:00Z", payload: { channel: "phone", note: "Máy bận", recipient: "guardian", success: false }, task_id: "55555555-5555-4555-8555-555555555555" },
      { actor_name: "Đặng Phương Thảo", event_type: "claim", id: "e2", occurred_at: "2026-10-13T01:10:00Z", payload: {}, task_id: "55555555-5555-4555-8555-555555555555" },
    ],
    student: { full_name: "Trần Gia Bảo", id: "33333333-3333-4333-8333-333333333333", lifecycle_status: "active", public_code: "TTV-00131" },
    task: {
      claim_due_at: null, completed_at: null, contact_due_at: "2026-10-14T14:53:00Z", detected_at: "2026-10-12T14:53:00Z", due_at: null,
      evidence: { absence_streak: [{ attendance_status: "unexcused_absence", class_name: "Toán 9A", session_date: "2026-10-12", session_id: "s2", start_time: "19:30:00", test_score: null }] },
      evidence_current: true, first_contact_at: null, id: "55555555-5555-4555-8555-555555555555", kind: "alert", next_followup_at: null,
      outcome: null, owner_id: ME, period_month: null, status: "in_progress", student_id: "33333333-3333-4333-8333-333333333333", version: 3,
      ...overrides,
    },
    ...rest,
  };
}

function primaryButtons(container: HTMLElement) {
  return Array.from(container.querySelectorAll("button")).filter((button) => button.className.includes("bg-action-primary "));
}

describe("student care task page (13b)", () => {
  it("titles the task by its rule, shows the claim time, and keeps one page primary", () => {
    const { container } = render(<CareDetailView canAssign={false} canHandle data={detail()} userId={ME} />);
    expect(screen.getByRole("heading", { level: 1, name: "Trần Gia Bảo · Vắng 2 buổi liên tiếp" })).toBeInTheDocument();
    expect(screen.getByText(/người xử lý Đặng Phương Thảo \(nhận 13\/10 08:10\)/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nhận việc" })).toBeNull();
    expect(primaryButtons(container).map((button) => button.textContent)).toEqual(["Lưu lần liên hệ"]);
  });

  it("puts claim in the header as the only primary when the viewer may claim", () => {
    const { container } = render(<CareDetailView canAssign={false} canHandle data={detail({ status: "open" })} userId={ME} />);
    expect(primaryButtons(container).map((button) => button.textContent)).toEqual(["Nhận việc"]);
    expect(screen.getByRole("button", { name: "Lưu lần liên hệ" })).toBeInTheDocument();
  });

  it("keeps completion disabled with its visible reason until a successful contact exists", () => {
    const { unmount } = render(<CareDetailView canAssign={false} canHandle data={detail()} userId={ME} />);
    const complete = screen.getByRole("button", { name: "Ghi nhận hoàn thành" });
    expect(complete).toBeDisabled();
    expect(complete).toHaveAccessibleDescription(CARE_COMPLETE_DISABLED_REASON);
    unmount();

    render(<CareDetailView canAssign={false} canHandle data={detail({}, { contacts: [{ contact_at: "2026-10-13T03:00:00Z", id: "66666666-6666-4666-8666-666666666666", note: "Đã gặp phụ huynh" }] })} userId={ME} />);
    expect(screen.getByRole("button", { name: "Ghi nhận hoàn thành" })).toBeEnabled();
    expect(screen.queryByText(CARE_COMPLETE_DISABLED_REASON)).toBeNull();
  });

  it("uses real radio groups for channel, recipient and result", () => {
    render(<CareDetailView canAssign={false} canHandle data={detail()} userId={ME} />);
    expect(within(screen.getByRole("group", { name: "Kênh" })).getAllByRole("radio")).toHaveLength(4);
    expect(within(screen.getByRole("group", { name: "Người nhận" })).getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Đã trao đổi thực chất" })).toBeChecked();
  });

  // Generated by /ship coverage audit (Claude Opus 5.5) — 2026-10-15
  // Value: protects=the contact form's segmented radios still send mutate_student_care's command: channel/recipient values, success as a boolean, the follow-up read as Vietnam time, the task's ids/version, a schema-valid command, and a cleared form after success;
  // fails_when=the select→radio rewrite sends success as "true"/"false" text or drops a radio, the follow-up loses its +07:00 reading, or the form keeps the saved note after success;
  // why_new=the preview test submits only to its stub and checks the message, never the payload; seam=none; no_claim=mutateCare is mocked, so the RPC's own checklist rules are not exercised
  it("sends the contact command with radio values, a boolean result and the follow-up in Vietnam time", async () => {
    mocks.mutate.mockResolvedValue({ message: "Đã lưu cập nhật chăm sóc học viên.", ok: true });
    render(<CareDetailView canAssign={false} canHandle data={detail()} userId={ME} />);
    const form = screen.getByRole("button", { name: "Lưu lần liên hệ" }).closest("form")!;

    fireEvent.click(within(form).getByRole("radio", { name: "Zalo" }));
    fireEvent.click(within(form).getByRole("radio", { name: "Cả hai" }));
    fireEvent.change(within(form).getByRole("textbox", { name: /^Ghi chú/ }), { target: { value: "Phụ huynh xác nhận lịch học bù" } });
    fireEvent.change(within(form).getByLabelText(/Hẹn liên hệ tiếp/), { target: { value: "2026-10-15T09:30" } });
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
    const command = mocks.mutate.mock.calls[0][0];
    expect(command).toEqual({
      channel: "zalo",
      next_followup_at: "2026-10-15T02:30:00.000Z",
      note: "Phụ huynh xác nhận lịch học bù",
      op: "contact",
      recipient: "both",
      request_id: expect.any(String),
      student_id: "33333333-3333-4333-8333-333333333333",
      success: true,
      task_id: "55555555-5555-4555-8555-555555555555",
      version: 3,
    });
    expect(careCommandSchema.safeParse(command).success).toBe(true);
    await waitFor(() => expect(within(form).getByRole("textbox", { name: /^Ghi chú/ })).toHaveValue(""));
  });

  // Generated by /ship coverage audit (Claude Opus 5.5) — 2026-10-15 — REGRESSION (red at HEAD)
  // Value: protects=after one contact is saved, the next contact on the same page records the result, channel and recipient the user picks (an unreachable call must not be stored as "đã trao đổi thực chất");
  // fails_when=CareActionForm clears fields with form.reset() on success (reset drops the radios' dirty checkedness and React re-applies defaultChecked on every later radio click) instead of remounting them, so the choice snaps back to the default;
  // why_new=the old <select name="success"> form had no reset and remounted per version (key), so no test existed; seam=none; no_claim=jsdom stands in for the browser's checked-attribute rule; mutateCare is mocked
  it("lets the user pick a different result for a second contact after a successful save", async () => {
    mocks.mutate.mockResolvedValue({ message: "Đã lưu cập nhật chăm sóc học viên.", ok: true });
    render(<CareDetailView canAssign={false} canHandle data={detail()} userId={ME} />);
    const form = screen.getByRole("button", { name: "Lưu lần liên hệ" }).closest("form")!;
    const fill = (note: string, followup: string) => {
      fireEvent.change(within(form).getByRole("textbox", { name: /^Ghi chú/ }), { target: { value: note } });
      fireEvent.change(within(form).getByLabelText(/Hẹn liên hệ tiếp/), { target: { value: followup } });
    };

    fill("Đã gặp phụ huynh", "2026-10-15T09:30");
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
    // The fieldset stays disabled until the transition settles; wait so the next clicks reach enabled radios.
    await waitFor(() => expect(within(form).getByRole("button", { name: "Lưu lần liên hệ" })).toBeEnabled());

    fireEvent.click(within(form).getByRole("radio", { name: "Chưa liên lạc được" }));
    fireEvent.click(within(form).getByRole("radio", { name: "Zalo" }));
    expect(within(form).getByRole("radio", { name: "Chưa liên lạc được" })).toBeChecked();
    expect(within(form).getByRole("radio", { name: "Zalo" })).toBeChecked();

    fill("Không bắt máy", "2026-10-16T19:00");
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(2));
    const second = mocks.mutate.mock.calls[1][0];
    expect(second).toMatchObject({ channel: "zalo", next_followup_at: "2026-10-16T12:00:00.000Z", op: "contact", success: false });
    expect(second.request_id).not.toBe(mocks.mutate.mock.calls[0][0].request_id);
  });

  it("lists the timeline newest first with contact details", () => {
    render(<CareDetailView canAssign={false} canHandle data={detail()} userId={ME} />);
    const items = within(screen.getByRole("list", { name: "Dòng thời gian chăm sóc" })).getAllByRole("listitem");
    expect(items.map((item) => item.querySelector("p")?.textContent)).toEqual([
      "Ghi nhận liên hệ · Điện thoại · Phụ huynh · chưa liên lạc được",
      "Nhận việc",
      "Cập nhật cảnh báo",
    ]);
    expect(within(items[2]).getByText(/Hệ thống/)).toBeInTheDocument();
  });

  it("explains why the forms are hidden and gates reassignment and the exception", () => {
    const { unmount } = render(<CareDetailView canAssign={false} canHandle data={detail({ owner_id: OTHER })} userId={ME} />);
    expect(screen.queryByRole("button", { name: "Lưu lần liên hệ" })).toBeNull();
    expect(screen.getByText(/Chỉ người phụ trách hoặc người điều phối được ghi nhận liên hệ/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Giao cho người khác" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ngoại lệ · hủy task…" })).toBeNull();
    unmount();

    render(<CareDetailView canAssign canHandle data={detail({ owner_id: OTHER })} userId={ME} />);
    expect(screen.getByRole("button", { name: "Giao cho người khác" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ngoại lệ · hủy task…" }));
    const dialog = screen.getByRole("dialog", { name: "Ngoại lệ · hủy công việc" });
    expect(within(dialog).getByText(/Ngoại lệ không tính là Coaching hoàn thành/)).toBeInTheDocument();
    expect(within(dialog).getByRole("textbox", { name: /Lý do/ })).toBeRequired();
  });

  it("shows the result instead of forms on a closed task", () => {
    render(<CareDetailView canAssign canHandle data={detail({ completed_at: "2026-10-13T04:00:00Z", outcome: "Đã thống nhất lịch học bù", status: "completed" })} userId={ME} />);
    expect(screen.queryByRole("button", { name: "Lưu lần liên hệ" })).toBeNull();
    expect(screen.getByText("Đã thống nhất lịch học bù")).toBeInTheDocument();
    expect(screen.getByText(/Công việc đã kết thúc \(Đã hoàn thành\)/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// /ship Step 9.4 fix list, cycle 1 (F1–F11, T1–T5)
// ---------------------------------------------------------------------------

const UNCERTAIN = /Chưa xác nhận được kết quả lưu/;

function openConfigureDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Cấu hình bộ tự sinh" }));
  return screen.getByRole("dialog", { name: "Cấu hình bộ tự sinh" });
}

describe("care dialogs keep their command safe across close and reopen", () => {
  // Value: protects=a retry after an uncertain result reuses the request_id even though closing the dialog unmounted the form, so mutate_student_care's idempotency still prevents a second follow-up task or assignment;
  // fails_when=the request key lives only in CareActionForm (unmounted on close) and the retry gets a new id;
  // why_new=F1 of the step 11a ship review; seam=mutateCare mock rejects once (network) then resolves; no_claim=does not exercise the RPC's request_id lookup
  it("reuses the request id after an uncertain result when the dialog was closed and reopened", async () => {
    mocks.mutate.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ message: "Đã lưu cập nhật chăm sóc học viên.", ok: true });
    renderQueue({ canConfigure: true });
    let dialog = openConfigureDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạm dừng tự động" }));
    expect(await within(dialog).findByText(UNCERTAIN)).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeEnabled());
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    dialog = openConfigureDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạm dừng tự động" }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(2));
    expect(mocks.mutate.mock.calls[1][0].request_id).toBe(mocks.mutate.mock.calls[0][0].request_id);
    expect(mocks.mutate.mock.calls[1][0]).toEqual(mocks.mutate.mock.calls[0][0]);
  });

  // Value: protects=Escape, the scrim and "Hủy" cannot close a dialog while its command is in flight, and an error that arrives is still visible under the trigger after the dialog is closed;
  // fails_when=onClose unmounts the form mid-command (the result is lost) or the parent drops a failure result;
  // why_new=F2 of the step 11a ship review; seam=mutateCare mock returns a promise the test resolves; no_claim=none
  it("refuses to close while pending and keeps a failure under the trigger after closing", async () => {
    let settle: (value: { message: string; ok: boolean }) => void = () => undefined;
    mocks.mutate.mockImplementationOnce(() => new Promise((resolve) => { settle = resolve; }));
    renderQueue({ canConfigure: true });
    const dialog = openConfigureDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạm dừng tự động" }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    expect(screen.getByRole("dialog", { name: "Cấu hình bộ tự sinh" })).toBe(dialog);
    expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeDisabled();

    const message = "Công việc vừa được người khác cập nhật. Tải lại trang trước khi thao tác.";
    await act(async () => settle({ message, ok: false }));
    expect(within(dialog).getByText(message)).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });

  // Value: protects=a successful dialog command closes the dialog and shows its result under the trigger; a refused one keeps the dialog open with the reason inside it;
  // fails_when=success leaves the dialog open or shows nothing, or ok:false closes the dialog and hides the reason;
  // why_new=T1 of the step 11a ship review; seam=mutateCare mock; no_claim=none
  it("closes on success with the result under the trigger and stays open on a refusal", async () => {
    mocks.mutate.mockResolvedValueOnce({ message: "Anh/chị không có quyền thực hiện thao tác này.", ok: false });
    renderQueue({ canConfigure: true });
    let dialog = openConfigureDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạm dừng tự động" }));
    expect(await within(dialog).findByText("Anh/chị không có quyền thực hiện thao tác này.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Cấu hình bộ tự sinh" })).toBe(dialog);
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeEnabled());
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));

    mocks.mutate.mockResolvedValueOnce({ message: "Đã lưu cập nhật chăm sóc học viên.", ok: true });
    dialog = openConfigureDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạm dừng tự động" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const trigger = screen.getByRole("button", { name: "Cấu hình bộ tự sinh" });
    expect(within(trigger.parentElement!).getByText("Đã lưu cập nhật chăm sóc học viên.")).toBeInTheDocument();
    expect(screen.queryByText("Anh/chị không có quyền thực hiện thao tác này.")).toBeNull();
  });
});

describe("queue filters keep typing and partial input out of the URL (F3, F4)", () => {
  afterEach(() => vi.useRealTimers());

  function queue() {
    return <CareQueueView canAssign={false} canConfigure={false} canHandle data={dashboard()} filter={parseCareFilter({})} now={NOW} students={null} tab="tasks" />;
  }

  // Value: protects=every typed character stays in the search box while the URL lags, and the dashboard is read once per pause (300ms) instead of per keystroke; Enter applies at once;
  // fails_when=the input is controlled by the URL (characters dropped mid-transition) or each keystroke calls router.replace;
  // why_new=F3 of the step 11a ship review; seam=next/navigation mocked with a URL that does not change, fake timers; no_claim=does not measure real navigation latency
  it("keeps every typed character and replaces the URL once after the pause", () => {
    vi.useFakeTimers();
    render(queue());
    const input = screen.getByTestId("desktop-care-search");
    for (const value of ["B", "Bả", "Bảo"]) fireEvent.change(input, { target: { value } });
    expect(input).toHaveValue("Bảo");
    act(() => vi.advanceTimersByTime(CARE_SEARCH_DEBOUNCE_MS - 1));
    expect(mocks.replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith("/student-care?search=B%E1%BA%A3o", { scroll: false });

    fireEvent.change(input, { target: { value: "An" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mocks.replace).toHaveBeenCalledTimes(2);
    expect(mocks.replace).toHaveBeenLastCalledWith("/student-care?search=An", { scroll: false });
    act(() => vi.advanceTimersByTime(CARE_SEARCH_DEBOUNCE_MS * 2));
    expect(mocks.replace).toHaveBeenCalledTimes(2);
  });

  it("sends a waiting search with the next filter change and takes outside URL changes", () => {
    vi.useFakeTimers();
    const { rerender } = render(queue());
    const input = screen.getByTestId("desktop-care-search");
    fireEvent.change(input, { target: { value: "Minh" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Loại công việc" }), { target: { value: "alert" } });
    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenLastCalledWith("/student-care?search=Minh&kind=alert", { scroll: false });
    act(() => vi.advanceTimersByTime(CARE_SEARCH_DEBOUNCE_MS));
    expect(mocks.replace).toHaveBeenCalledTimes(1);

    // Our own value landing keeps the draft; a value from elsewhere (back/forward) replaces it.
    mocks.search = "search=Minh&kind=alert";
    rerender(queue());
    expect(input).toHaveValue("Minh");
    mocks.search = "search=Linh";
    rerender(queue());
    expect(input).toHaveValue("Linh");
  });

  // Generated by /ship coverage audit (Claude Opus 5.5) — 2026-10-15 — REGRESSION (red at HEAD)
  // Value: protects=a search push still waiting when the user switches page tab cannot drag them back to the tab they left; a search typed on a students tab keeps that tab;
  // fails_when=the debounced push (F3) runs navigate() from the render where it was typed, so withCareQuery rebuilds the URL with the old tab and drops tab=assignments;
  // why_new=the F3 tests only type on the tasks tab and never change the URL from outside while a push waits; seam=none (next/navigation mocked, URL change simulated by rerender);
  // no_claim=does not prove which of the tab Link push and the delayed replace lands first in a real browser
  it("does not send a waiting search back to the tab the user left", () => {
    vi.useFakeTimers();
    const view = (tab: CareTab) => (
      <CareQueueView canAssign={false} canConfigure={false} canHandle data={dashboard()} filter={parseCareFilter({})} now={NOW} students={tab === "tasks" ? null : STUDENTS} tab={tab} />
    );

    mocks.search = "tab=assignments";
    const first = render(view("assignments"));
    fireEvent.change(screen.getByTestId("desktop-care-search"), { target: { value: "An" } });
    act(() => vi.advanceTimersByTime(CARE_SEARCH_DEBOUNCE_MS));
    expect(mocks.replace).toHaveBeenLastCalledWith("/student-care?tab=assignments&search=An", { scroll: false });
    first.unmount();
    mocks.replace.mockClear();

    mocks.search = "";
    const { rerender } = render(view("tasks"));
    fireEvent.change(screen.getByTestId("desktop-care-search"), { target: { value: "Minh" } });
    // The "Phân công lâu dài" tab link lands before the 300ms pause ends.
    mocks.search = "tab=assignments";
    rerender(view("assignments"));
    act(() => vi.advanceTimersByTime(CARE_SEARCH_DEBOUNCE_MS));
    const urls = mocks.replace.mock.calls.map(([url]) => String(url));
    expect(urls.filter((url) => !url.includes("tab=assignments"))).toEqual([]);
  });

  // Value: protects=two quick filter changes before the URL updates both reach the URL (pendingQueryRef merge);
  // fails_when=the second change rebuilds the query from the stale URL and drops the first;
  // why_new=[testing] stub from the step 11a review; seam=the mocked URL never updates between the two changes; no_claim=none
  it("keeps both params on two quick filter changes", () => {
    render(queue());
    fireEvent.change(screen.getByRole("combobox", { name: "Loại công việc" }), { target: { value: "alert" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Trạng thái" }), { target: { value: "in_progress" } });
    expect(mocks.replace).toHaveBeenLastCalledWith("/student-care?kind=alert&status=in_progress", { scroll: false });
  });

  // Value: protects=a month typed by hand where type=month falls back to a text box (Safari, Firefox desktop) reaches the URL only as a whole YYYY-MM, and the partial text stays in the box;
  // fails_when=each keystroke writes "2026-1-01" style months to the URL (the schema then drops them and the field jumps back);
  // why_new=F4 of the step 11a ship review; seam=before each change the input's type is switched to text to stand in for those browsers (jsdom sanitises month values, and React restores type=month after the event, so the partial text itself cannot be read back here); no_claim=does not run Safari
  it("writes the coaching month only when a whole month is typed", () => {
    render(queue());
    const month = screen.getByLabelText("Tháng Coaching");
    const typeMonth = (value: string) => {
      month.setAttribute("type", "text");
      fireEvent.change(month, { target: { value } });
    };
    for (const partial of ["2", "2026-", "2026-1", "2026-13"]) typeMonth(partial);
    expect(mocks.replace).not.toHaveBeenCalled();
    typeMonth("2026-09");
    expect(mocks.replace).toHaveBeenLastCalledWith("/student-care?month=2026-09", { scroll: false });
    typeMonth("");
    expect(mocks.replace).toHaveBeenLastCalledWith("/student-care", { scroll: false });
    expect(mocks.replace).toHaveBeenCalledTimes(2);
  });
});

describe("queue fixes (F5, F8, F11, T4)", () => {
  // Value: protects=the page tabs read Công việc · Phân công lâu dài · Theo dõi riêng (design 13a);
  // fails_when=the tabs come from Object.keys of a label map (alphabetical by key); why_new=F5 (QA fail); seam=none; no_claim=none
  it("orders the page tabs as designed", () => {
    renderQueue();
    const tabs = within(screen.getByRole("tablist", { name: "Mục trong chăm sóc học sinh" })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Công việc", "Phân công lâu dài", "Theo dõi riêng"]);
  });

  // Value: protects=a page past the last one says the page has no more tasks and links back to page 1 with the filters kept, and the pager stays;
  // fails_when=it shows the "nothing to do" empty copy (or the not-all-clear copy) and hides the pager;
  // why_new=F8 of the step 11a ship review; seam=none; no_claim=router navigation is not followed
  it("tells a page past the last one apart from an empty queue", () => {
    mocks.search = "kind=alert&page=4";
    renderQueue({ data: dashboard({ rows: [], total: 120 }), filter: parseCareFilter({ kind: "alert", page: "4" }) });
    expect(screen.getAllByText("Trang này không còn công việc").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Chưa có công việc chăm sóc/)).toBeNull();
    expect(screen.queryByText(/Không có công việc phù hợp/)).toBeNull();
    expect(screen.getAllByRole("link", { name: "Về trang 1" })[0]).toHaveAttribute("href", "/student-care?kind=alert");
    // G6: the footer counts the rows this page shows (none), marks no page current, and "Trước" goes to the last page.
    expect(screen.getAllByText("0 trong 120 task").length).toBeGreaterThan(1);
    expect(screen.queryByText("101–120 trong 120 task")).toBeNull();
    for (const pager of screen.getAllByRole("navigation", { name: "Phân trang" })) expect(pager.querySelector("[aria-current]")).toBeNull();
    fireEvent.click(within(screen.getAllByRole("navigation", { name: "Phân trang" })[0]).getByRole("button", { name: "Trước" }));
    expect(mocks.push).toHaveBeenCalledWith("/student-care?kind=alert&page=3");
  });

  // Value: protects=the generator settings dialog is offered only to a viewer who also has student_care.handle (mutateCare refuses configure without it);
  // fails_when=canConfigure alone shows "Cấu hình bộ tự sinh"; why_new=F11 of the step 11a ship review; seam=none; no_claim=the RPC still checks both
  it("needs student_care.handle as well as configure for the generator settings", () => {
    renderQueue({ canConfigure: true, canHandle: false });
    expect(screen.queryByRole("button", { name: "Cấu hình bộ tự sinh" })).toBeNull();
  });

  // Value: protects=an overdue row says how late it is in words and an alert whose evidence changed carries the "bằng chứng đã thay đổi" badge in both the table and the record list;
  // fails_when=the overdue text goes colour-only or measures from the wrong deadline, or either layout drops the badge;
  // why_new=T4 (coverage G4); seam=none; no_claim=does not prove which layout is visible at a width
  it("shows overdue duration and changed evidence in the table and the record list", () => {
    renderQueue({
      data: dashboard({
        rows: [
          row({ contact_due_at: "2026-10-13T05:05:00Z", full_name: "Mai Phương Linh", id: "44444444-4444-4444-8444-444444444451", overdue: true }),
          row({ evidence: { absence_streak: [] }, evidence_current: false, full_name: "Hồ Anh Khoa", id: "44444444-4444-4444-8444-444444444452", kind: "alert" }),
        ],
        total: 2,
      }),
    });
    const list = screen.getByRole("list", { name: CARE_TASK_TABLE_LABEL });
    const record = (name: string) => within(list).getByRole("link", { name: `Mở công việc · ${name}` }).closest("article")!;
    expect(within(tableRow("Mai Phương Linh")).getByText("Quá hạn 2 giờ")).toBeInTheDocument();
    expect(within(record("Mai Phương Linh")).getByText("Quá hạn 2 giờ")).toBeInTheDocument();
    expect(within(tableRow("Hồ Anh Khoa")).getByText("bằng chứng đã thay đổi")).toBeInTheDocument();
    expect(within(record("Hồ Anh Khoa")).getByText("bằng chứng đã thay đổi")).toBeInTheDocument();
    expect(within(tableRow("Mai Phương Linh")).queryByText("bằng chứng đã thay đổi")).toBeNull();
  });

  it("states a queue with only waiting students without a retry count", () => {
    render(<GeneratorStatusBar data={dashboard({ queue: { failed: 0, pending: 4 } })} now={NOW} />);
    expect(screen.getByRole("alert")).toHaveTextContent("hàng đợi 4 · đối soát");
  });
});

describe("task page fixes (F7, F9, F11, T5)", () => {
  // Value: protects=the header dates the current owner by the latest claim or assign: after a reassign it says "được giao …", not the old claim time;
  // fails_when=it takes the newest claim event regardless of later assigns; why_new=F7 of the step 11a ship review; seam=none; no_claim=none
  it("dates the owner by a later reassign instead of the older claim", () => {
    const base = detail();
    // payload.owner_id = the assignee, as mutate_student_care logs it (G7: an assign dates the owner only when it names them).
    const events = [...base.events, { actor_name: "Hoàng Minh Khôi", event_type: "assign", id: "e4", occurred_at: "2026-10-13T04:00:00Z", payload: { owner_id: ME }, task_id: base.task.id }];
    render(<CareDetailView canAssign={false} canHandle data={{ ...base, events }} userId={ME} />);
    expect(screen.getByText(/người xử lý Đặng Phương Thảo \(được giao 13\/10 11:00\)/)).toBeInTheDocument();
    expect(screen.queryByText(/\(nhận 13\/10/)).toBeNull();
  });

  // Value: protects=an unowned task offers no contact, schedule, Coaching, completion or exception (the RPC answers STUDENT_CARE_CLAIM_FIRST) and says why, while claim and reassign stay;
  // fails_when=a manager sees the contact form or "Ngoại lệ" on an unowned task, or the reason is missing;
  // why_new=F9 of the step 11a ship review (verified in 20260917101000_student_care_workflows.sql); seam=none; no_claim=none
  it("asks to claim or assign an unowned task before contact or exception", () => {
    render(<CareDetailView canAssign canHandle data={detail({ owner_id: null, status: "open" })} userId={ME} />);
    expect(screen.queryByRole("button", { name: "Lưu lần liên hệ" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ghi nhận hoàn thành" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Đổi lịch hẹn…" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tạo / gắn phiếu Coaching…" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ngoại lệ · hủy task…" })).toBeNull();
    expect(screen.getAllByText(new RegExp(CARE_OWNER_REQUIRED_REASON.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"))).length).toBe(2);
    expect(screen.getByRole("button", { name: "Nhận việc" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Giao cho người khác" })).toBeInTheDocument();
  });

  // Value: protects=a viewer with student_care.assign but not handle is offered no reassign or exception (mutateCare refuses every command without handle);
  // fails_when=the header or completion card gates on canAssign alone; why_new=F11 of the step 11a ship review; seam=none; no_claim=none
  it("needs student_care.handle for reassign and exception", () => {
    render(<CareDetailView canAssign canHandle={false} data={detail({ owner_id: OTHER })} userId={ME} />);
    expect(screen.queryByRole("button", { name: "Giao cho người khác" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ngoại lệ · hủy task…" })).toBeNull();
    expect(screen.getByText(/chỉ có quyền xem chăm sóc học sinh/)).toBeInTheDocument();
  });

  // Value: protects=the evidence table names each attendance status with its tone (unexcused danger, excused info, present success), a missing attendance as "—", and scores in vi-VN decimals with "—" when missing;
  // fails_when=a status loses its label or tone, or a missing score prints "null"/"0";
  // why_new=T5 (coverage G2); seam=none; no_claim=none
  it("badges every attendance status in the evidence table", () => {
    const evidence = {
      absence_month: [
        { attendance_status: "unexcused_absence", class_name: "Toán 9A", session_date: "2026-10-09", session_id: "s1", start_time: "19:30:00", test_score: null },
        { attendance_status: "excused_absence", class_name: "Toán 9B", session_date: "2026-10-06", session_id: "s2", start_time: "19:30:00", test_score: null },
        { attendance_status: "present", class_name: "Toán 9C", session_date: "2026-10-03", session_id: "s3", start_time: "19:30:00", test_score: 7.5 },
        { attendance_status: null, class_name: "Toán 9D", session_date: "2026-10-01", session_id: "s4", start_time: "19:30:00", test_score: null },
      ],
    };
    render(<CareDetailView canAssign={false} canHandle data={detail({ evidence })} userId={ME} />);
    const table = screen.getByRole("table", { name: /Bằng chứng/ });
    const cells = (className: string) => {
      const cellsOfRow = within(table).getByRole("link", { name: new RegExp(`${className}$`) }).closest("tr")!.querySelectorAll("td");
      return { attendance: cellsOfRow[2], score: cellsOfRow[3] };
    };
    const expectations: [string, string, string, string][] = [
      ["Toán 9A", "Vắng không phép", "bg-danger-bg", "—"],
      ["Toán 9B", "Vắng có phép", "bg-info-bg", "—"],
      ["Toán 9C", "Có mặt", "bg-success-bg", "7,5"],
    ];
    for (const [className, label, tone, score] of expectations) {
      const { attendance, score: scoreCell } = cells(className);
      expect(within(attendance).getByText(label)).toHaveClass(tone);
      expect(scoreCell).toHaveTextContent(score);
    }
    expect(cells("Toán 9D").attendance).toHaveTextContent(/^—$/);
    expect(cells("Toán 9D").score).toHaveTextContent(/^—$/);
  });
});

const CONTACT = "66666666-6666-4666-8666-666666666666";
const COACHING = "88888888-8888-4888-8888-888888888888";
const TASK_IDS = { student_id: "33333333-3333-4333-8333-333333333333", task_id: "55555555-5555-4555-8555-555555555555", version: 3 };
const STUDENTS: CareStudents = {
  rows: [{ full_name: "Phạm Khánh Linh", id: STUDENT, lifecycle_status: "active", owner_id: null, owner_name: null, public_code: "TTV-00200" }],
  total: 1,
};

function renderDetailForCommands() {
  render(
    <CareDetailView
      canAssign
      canHandle
      data={detail({}, {
        available_coaching: [{ campaign_name: "Theo sát HS lớp 9", id: COACHING }],
        contacts: [{ contact_at: "2026-10-13T03:00:00Z", id: CONTACT, note: "Đã gặp phụ huynh" }],
      })}
      userId={ME}
    />,
  );
}

function dialogForm(trigger: string, title: string, submit: string) {
  fireEvent.click(screen.getAllByRole("button", { name: trigger })[0]);
  const dialog = screen.getByRole("dialog", { name: title });
  return { dialog, form: within(dialog).getByRole("button", { name: submit }).closest("form")! };
}

const typeInto = (scope: HTMLElement, name: RegExp, value: string) => fireEvent.change(within(scope).getByRole("textbox", { name }), { target: { value } });
const chooseIn = (scope: HTMLElement, name: RegExp, value: string) => fireEvent.change(within(scope).getByRole("combobox", { name }), { target: { value } });
const followupIn = (scope: HTMLElement, label: RegExp) => fireEvent.change(within(scope).getByLabelText(label), { target: { value: "2026-10-20T09:30" } });

// Value: protects=every dialog/card command still sends mutate_student_care's field names for its op with the task's ids, and the result passes careCommandSchema;
// fails_when=a restyled form renames or drops a field (owner_id, contact_event_id, coaching_id, next_followup_at, note) or sends a payload the schema rejects;
// why_new=T2 of the step 11a ship review; seam=mutateCare mock; no_claim=the RPC's own rules (future follow-up, eligible assignee) are not exercised
describe("care command payloads (T2)", () => {
  const cases: { name: string; expected: Record<string, unknown>; fill: () => HTMLFormElement }[] = [
    {
      expected: { ...TASK_IDS, contact_event_id: CONTACT, note: "Đã thống nhất lịch học bù", op: "complete" },
      fill: () => {
        renderDetailForCommands();
        const form = screen.getByRole("button", { name: "Ghi nhận hoàn thành" }).closest("form")!;
        chooseIn(form, /Lần trao đổi/, CONTACT);
        typeInto(form, /Kết luận/, "Đã thống nhất lịch học bù");
        return form;
      },
      name: "complete",
    },
    {
      expected: { ...TASK_IDS, note: "Bảo lưu đến tháng 12", op: "cancel" },
      fill: () => {
        renderDetailForCommands();
        const { form } = dialogForm("Ngoại lệ · hủy task…", "Ngoại lệ · hủy công việc", "Ghi nhận ngoại lệ");
        typeInto(form, /Lý do/, "Bảo lưu đến tháng 12");
        return form;
      },
      name: "cancel",
    },
    {
      expected: { ...TASK_IDS, next_followup_at: "2026-10-20T02:30:00.000Z", note: "Phụ huynh hẹn tuần sau", op: "schedule" },
      fill: () => {
        renderDetailForCommands();
        const { form } = dialogForm("Đổi lịch hẹn…", "Đổi lịch hẹn", "Lưu lịch hẹn");
        typeInto(form, /Nội dung \/ lý do/, "Phụ huynh hẹn tuần sau");
        followupIn(form, /Hẹn theo dõi/);
        return form;
      },
      name: "schedule",
    },
    {
      expected: { ...TASK_IDS, coaching_id: COACHING, next_followup_at: "2026-10-20T02:30:00.000Z", note: "Điểm giảm hai bài liên tiếp", op: "coaching" },
      fill: () => {
        renderDetailForCommands();
        const { form } = dialogForm("Tạo / gắn phiếu Coaching…", "Tạo / gắn phiếu Coaching", "Lưu liên kết Coaching");
        chooseIn(form, /Phiếu Coaching/, COACHING);
        typeInto(form, /Lý do Coaching/, "Điểm giảm hai bài liên tiếp");
        followupIn(form, /Ngày giờ theo dõi/);
        return form;
      },
      name: "coaching",
    },
    {
      expected: { ...TASK_IDS, note: "Cân bằng khối lượng", op: "assign", owner_id: ME },
      fill: () => {
        renderDetailForCommands();
        const { form } = dialogForm("Giao cho người khác", "Giao cho người khác", "Chuyển người xử lý");
        chooseIn(form, /Người xử lý mới/, ME);
        typeInto(form, /Lý do/, "Cân bằng khối lượng");
        return form;
      },
      name: "assign",
    },
    {
      expected: { note: "Phụ trách lớp 9", op: "assign_student", owner_id: OTHER, student_id: STUDENT },
      fill: () => {
        renderQueue({ canAssign: true, canHandle: true, students: STUDENTS, tab: "assignments" });
        const { form } = dialogForm("Phân công", "Phân công phụ trách · Phạm Khánh Linh", "Lưu phân công");
        chooseIn(form, /Người phụ trách/, OTHER);
        typeInto(form, /Lý do/, "Phụ trách lớp 9");
        return form;
      },
      name: "assign_student",
    },
    {
      expected: { next_followup_at: "2026-10-20T02:30:00.000Z", note: "Hỏi lịch quay lại", op: "create_followup", student_id: STUDENT },
      fill: () => {
        renderQueue({ canAssign: false, canHandle: true, students: STUDENTS, tab: "inactive" });
        const { form } = dialogForm("Tạo lịch theo dõi", "Tạo lịch theo dõi · Phạm Khánh Linh", "Tạo việc theo dõi");
        typeInto(form, /Nội dung \/ lý do/, "Hỏi lịch quay lại");
        followupIn(form, /Hẹn liên hệ/);
        return form;
      },
      name: "create_followup",
    },
  ];

  it.each(cases)("sends a schema-valid $name command", async ({ expected, fill }) => {
    mocks.mutate.mockResolvedValue({ message: "Đã lưu cập nhật chăm sóc học viên.", ok: true });
    fireEvent.submit(fill());
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
    const command = mocks.mutate.mock.calls[0][0];
    expect(command).toEqual({ ...expected, request_id: expect.any(String) });
    expect(careCommandSchema.safeParse(command).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// /ship Step 9.4 fix list, cycle 2 (G1–G9)
// ---------------------------------------------------------------------------

const SAVED = { message: "Đã lưu cập nhật chăm sóc học viên.", ok: true };
const TASK = "55555555-5555-4555-8555-555555555555";

describe("care commands stay idempotent and reachable (G1, G2, G3)", () => {
  // Value: protects=a retry after an uncertain result cannot write twice even when the 60s background refresh bumped the task version meanwhile: the first command (old version, same request_id) is resent, so the RPC replays it or answers STALE_VERSION;
  // fails_when=the request key includes `version`, so the refreshed form sends a new request_id with the new version (a second contact / Coaching record);
  // why_new=G1 of the step 11a ship review (cycle 2, red-team CRITICAL); seam=mutateCare mock throws, then the form is re-rendered with version+1 as StudentCareRefresh would; no_claim=does not exercise the RPC's request_id lookup
  it("resends the first command after an uncertain result although a refresh bumped the version", async () => {
    mocks.mutate
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ message: "Chưa xác nhận được kết quả lưu. Có thể thử lại an toàn.", ok: false })
      .mockResolvedValueOnce(SAVED);
    const form = (version: number) => <CareActionForm base={{ op: "claim", task_id: TASK, version }} label="Nhận việc" />;
    const { rerender } = render(form(3));
    const submitAndSettle = async (calls: number) => {
      fireEvent.click(screen.getByRole("button", { name: "Nhận việc" }));
      await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(calls));
      await waitFor(() => expect(screen.getByRole("button", { name: "Nhận việc" })).toBeEnabled());
    };
    await submitAndSettle(1);
    rerender(form(4));
    await submitAndSettle(2);
    // mutateCare's own "not confirmed" answer is uncertain too: the key is kept.
    rerender(form(5));
    await submitAndSettle(3);
    const [first, second, third] = mocks.mutate.mock.calls.map(([command]) => command);
    expect(first).toMatchObject({ op: "claim", task_id: TASK, version: 3 });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  // Generated by /ship review pass 3 (Claude Opus 5.5) — 2026-10-15 — REGRESSION (red at HEAD)
  // Value: protects=a network or gateway failure (postgrest-js returns it as { error }, mutateCare answers its generic "Không lưu được công việc…") keeps the request key, so a retry cannot write a second follow-up / contact;
  // fails_when=only the "Chưa xác nhận…" prefix keeps the key and the generic refusal drops it;
  // why_new=G1 tests cover a thrown action and the "Chưa xác nhận" message only; seam=none; no_claim=mutateCare mocked; does not run postgrest-js
  it("keeps the request key after mutateCare's generic refusal, which may hide a committed write", async () => {
    mocks.mutate.mockResolvedValueOnce({ message: "Không lưu được công việc. Vui lòng tải lại và thử lại.", ok: false }).mockResolvedValueOnce(SAVED);
    const form = () => <CareActionForm base={{ op: "create_followup", student_id: TASK }} label="Tạo việc theo dõi">{null}</CareActionForm>;
    const { rerender } = render(form());
    fireEvent.click(screen.getByRole("button", { name: "Tạo việc theo dõi" }));
    await screen.findByText(/Không lưu được công việc/);
    await waitFor(() => expect(screen.getByRole("button", { name: "Tạo việc theo dõi" })).toBeEnabled());
    rerender(form());
    fireEvent.click(screen.getByRole("button", { name: "Tạo việc theo dõi" }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(2));
    const [first, second] = mocks.mutate.mock.calls.map(([command]) => command);
    expect(second).toEqual(first);
  });

  // Value: protects=a definite refusal (nothing written) does not pin the form to the old version: the next try is a new command with the current version;
  // fails_when=the key is kept after every failure, so a STALE_VERSION answer repeats on every retry until the values change;
  // why_new=guards the G1 change (clear the key on success or a definite refusal); seam=mutateCare mock; no_claim=passes before G1 as well (it guards the new rule, it does not prove G1)
  it("starts a new command with the current version after a definite refusal", async () => {
    mocks.mutate.mockResolvedValueOnce({ message: "Công việc vừa được người khác cập nhật. Tải lại trang trước khi thao tác.", ok: false }).mockResolvedValueOnce(SAVED);
    const form = (version: number) => <CareActionForm base={{ op: "claim", task_id: TASK, version }} label="Nhận việc" />;
    const { rerender } = render(form(3));
    fireEvent.click(screen.getByRole("button", { name: "Nhận việc" }));
    await screen.findByText(/Công việc vừa được người khác cập nhật/);
    await waitFor(() => expect(screen.getByRole("button", { name: "Nhận việc" })).toBeEnabled());
    rerender(form(4));
    fireEvent.click(screen.getByRole("button", { name: "Nhận việc" }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(2));
    const [first, second] = mocks.mutate.mock.calls.map(([command]) => command);
    expect(second.version).toBe(4);
    expect(second.request_id).not.toBe(first.request_id);
  });

  // Value: protects=after a failed dialog command, focus is back inside the dialog, so Escape and Tab reach it (the disabled fieldset had dropped focus to the page);
  // fails_when=focus stays on body after the command settles and Escape no longer closes the dialog;
  // why_new=G2 of the step 11a ship review (cycle 2); seam=jsdom keeps focus on a control its fieldset disables, so the test moves focus to body as a browser does; no_claim=does not run a real browser's focus fixup
  it("returns focus into the dialog after a failed submit so Escape still closes it", async () => {
    let settle: (value: { message: string; ok: boolean }) => void = () => undefined;
    mocks.mutate.mockImplementationOnce(() => new Promise((resolve) => { settle = resolve; }));
    renderQueue({ canConfigure: true });
    const dialog = openConfigureDialog();
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    const submit = within(dialog).getByRole("button", { name: "Tạm dừng tự động" });
    submit.focus();
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
    // jsdom neither drops focus from a control its fieldset disables nor blurs a disabled one: focus a
    // stand-in and remove it, which sends focus to body as the browser's focus fixup does.
    const standIn = document.body.appendChild(document.createElement("button"));
    standIn.focus();
    standIn.remove();
    expect(document.activeElement).toBe(document.body);

    await act(async () => settle({ message: "Anh/chị không có quyền thực hiện thao tác này.", ok: false }));
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    expect(document.activeElement).not.toBe(dialog);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  // Value: protects=an uncertain result stays in sight when the dialog is reopened (above the form) and under the trigger while closed, until a later submit settles;
  // fails_when=opening the dialog clears the result (setResult(null)), so the warning that the save may or may not have happened disappears before the retry;
  // why_new=G3 of the step 11a ship review (cycle 2); seam=mutateCare mock throws once, then succeeds; no_claim=the typed values are not prefilled on reopen (deferred)
  it("keeps an uncertain result visible across reopening until a later submit settles", async () => {
    mocks.mutate.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(SAVED);
    renderQueue({ canConfigure: true });
    let dialog = openConfigureDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạm dừng tự động" }));
    expect(await within(dialog).findByText(UNCERTAIN)).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Hủy" })).toBeEnabled());
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    expect(screen.getByRole("alert")).toHaveTextContent(UNCERTAIN);

    dialog = openConfigureDialog();
    const carried = within(dialog).getByText(UNCERTAIN).closest("[role=alert]")!;
    const form = within(dialog).getByRole("button", { name: "Tạm dừng tự động" }).closest("form")!;
    expect(carried.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(dialog).getAllByText(UNCERTAIN)).toHaveLength(1);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("alert")).toHaveTextContent(UNCERTAIN);

    dialog = openConfigureDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạm dừng tự động" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByText(UNCERTAIN)).toBeNull();
    expect(screen.getByText(SAVED.message)).toBeInTheDocument();
  });
});

describe("task page keeps results that remove their own control (G4, G5)", () => {
  // Value: protects=the generator alert is not re-announced every minute: the relative age that changes on each 60s refresh stays visible but outside the live region's spoken text;
  // fails_when=the alert's text includes "(n phút trước)", so each refresh changes an assertive live region;
  // why_new=G4 of the step 11a ship review (cycle 2); seam=aria-hidden nodes are removed to approximate what a screen reader announces; no_claim=does not run a screen reader
  it("keeps the changing age out of the generator alert's spoken text", () => {
    const base = dashboard();
    render(<GeneratorStatusBar data={{ ...base, settings: { ...base.settings, last_success_at: "2026-10-13T06:50:00Z" } }} now={NOW} />);
    const alert = screen.getByRole("alert");
    const spoken = alert.cloneNode(true) as HTMLElement;
    spoken.querySelectorAll("[aria-hidden=true]").forEach((node) => node.remove());
    expect(spoken.textContent).not.toMatch(/phút trước/);
    expect(spoken.textContent).toContain("chạy thành công 13:50");
    expect(spoken.textContent).toContain("chưa cập nhật đúng hạn");
    expect(alert).toHaveTextContent("chạy thành công 13:50 (15 phút trước)");
  });

  function expectFocusedResultUnderHeader() {
    const focused = document.activeElement as HTMLElement;
    expect(focused).toHaveTextContent(SAVED.message);
    expect(focused).toHaveAttribute("tabindex", "-1");
    expect(focused.previousElementSibling?.tagName).toBe("HEADER");
    expect(within(focused.previousElementSibling as HTMLElement).getByRole("heading", { level: 1 })).toBeInTheDocument();
  }

  // Value: protects=a claim, completion or exception that succeeds keeps its result on the page (under the header, focused) although the re-render with the new task state removes the control that produced it;
  // fails_when=the result lives only in the claim form / completion card / exception dialog, so it vanishes with them and focus lands on body;
  // why_new=G5 of the step 11a ship review (cycle 2); seam=mutateCare mock; the server re-render is simulated by rerendering with the closed/claimed task; no_claim=does not follow a real server action response
  it("keeps a claim's success under the header after the claim button goes away", async () => {
    mocks.mutate.mockResolvedValueOnce(SAVED);
    const { rerender } = render(<CareDetailView canAssign={false} canHandle data={detail({ owner_id: null, status: "open" })} userId={ME} />);
    fireEvent.click(screen.getByRole("button", { name: "Nhận việc" }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
    rerender(<CareDetailView canAssign={false} canHandle data={detail({ owner_id: ME, status: "in_progress", version: 4 })} userId={ME} />);
    expect(screen.queryByRole("button", { name: "Nhận việc" })).toBeNull();
    await waitFor(() => expectFocusedResultUnderHeader());
  });

  it.each([
    {
      name: "completion",
      submit: () => {
        const form = screen.getByRole("button", { name: "Ghi nhận hoàn thành" }).closest("form")!;
        chooseIn(form, /Lần trao đổi/, CONTACT);
        typeInto(form, /Kết luận/, "Đã thống nhất lịch học bù");
        fireEvent.submit(form);
      },
      status: "completed" as const,
    },
    {
      name: "exception",
      submit: () => {
        const { form } = dialogForm("Ngoại lệ · hủy task…", "Ngoại lệ · hủy công việc", "Ghi nhận ngoại lệ");
        typeInto(form, /Lý do/, "Bảo lưu đến tháng 12");
        fireEvent.submit(form);
      },
      status: "cancelled" as const,
    },
  ])("keeps the $name success under the header after the task closes", async ({ status, submit }) => {
    mocks.mutate.mockResolvedValueOnce(SAVED);
    const extra = { contacts: [{ contact_at: "2026-10-13T03:00:00Z", id: CONTACT, note: "Đã gặp phụ huynh" }] };
    const { rerender } = render(<CareDetailView canAssign canHandle data={detail({}, extra)} userId={ME} />);
    submit();
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    rerender(<CareDetailView canAssign canHandle data={detail({ completed_at: "2026-10-13T05:00:00Z", outcome: "Xong", status, version: 4 }, extra)} userId={ME} />);
    expect(screen.queryByRole("button", { name: "Ghi nhận hoàn thành" })).toBeNull();
    expect(screen.getByText("Xong")).toBeInTheDocument();
    await waitFor(() => expectFocusedResultUnderHeader());
  });
});

describe("queue footer and filters (G8, G9)", () => {
  afterEach(() => vi.useRealTimers());

  const view = (tab: CareTab) => (
    <CareQueueView canAssign={false} canConfigure={false} canHandle data={dashboard()} filter={parseCareFilter({})} now={NOW} students={tab === "tasks" ? null : STUDENTS} tab={tab} />
  );

  // Value: protects=a search typed on another tab and still waiting when Back returns to a URL this component pushed earlier is dropped, not sent with the tab the user left;
  // fails_when=pushedQueryRef keeps an old push forever (Back to it looks like our own landing, so the waiting search is not cancelled) and navigate() rebuilds the URL with the tab of the render that scheduled it;
  // why_new=G8 of the step 11a ship review (cycle 2); seam=next/navigation mocked, URL changes simulated by rerender, fake timers; no_claim=does not drive real history
  it("drops a waiting search when Back returns to a URL it pushed earlier", () => {
    vi.useFakeTimers();
    const { rerender } = render(view("tasks"));
    fireEvent.change(screen.getByRole("combobox", { name: "Loại công việc" }), { target: { value: "alert" } });
    expect(mocks.replace).toHaveBeenLastCalledWith("/student-care?kind=alert", { scroll: false });
    mocks.search = "kind=alert";
    rerender(view("tasks"));

    // The "Phân công lâu dài" tab link (outside this component), then typing there.
    mocks.search = "tab=assignments";
    rerender(view("assignments"));
    fireEvent.change(screen.getByTestId("desktop-care-search"), { target: { value: "Minh" } });
    // Back, before the 300ms pause ends, to the URL pushed above.
    mocks.search = "kind=alert";
    rerender(view("tasks"));
    act(() => vi.advanceTimersByTime(CARE_SEARCH_DEBOUNCE_MS * 2));

    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(mocks.replace.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("tab=assignments"))).toEqual([]);
    expect(screen.getByTestId("desktop-care-search")).toHaveValue("");
  });

  // Value: protects=clearing the coaching month while the URL has none shows the month the dashboard still uses, not a blank field;
  // fails_when=the draft stays empty (nothing in the URL changes, so it is never re-synced) while the list is still scoped to the default month;
  // why_new=G9 of the step 11a ship review (cycle 2); seam=jsdom sanitises month values, so the cleared value is set through a text input like the F4 test; no_claim=none
  it("shows the dashboard month again when a month the URL does not hold is cleared", () => {
    render(view("tasks"));
    const month = screen.getByLabelText("Tháng Coaching");
    expect(month).toHaveValue("2026-10");
    month.setAttribute("type", "text");
    fireEvent.change(month, { target: { value: "" } });
    expect(month).toHaveValue("2026-10");
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
