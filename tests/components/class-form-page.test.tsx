// Value: protects=the shared class form of /classes/new and /classes/[classId]/edit (design 17b, left): every field keeps its label, default and options (modes in words), "Thông tin lớp" and "Lịch tuần" are section cards with stable ids, "Lịch tuần" states where the schedule is set up with the four next steps (plain text on create; on edit, done steps say so, step 3 links to the class and step 4 to the batch tool only for an active, non-composite class and a user with sessions.manage), the form sends exactly the typed values (create) or values + classId + reason (edit), success pushes to the class with the directory query and refreshes, server field errors land under their control with aria-invalid + aria-describedby and the message by the buttons, "Hủy" and the back link keep the directory query, the page has no nested <main> and one primary ("Lưu lớp (Nháp)" / "Lưu thay đổi") disabled with a reason when there is no open year or no update reason, and the action overrides replace the real actions;
// fails_when=a field, default or option disappears, a raw enum shows, the payload changes shape, a server field error loses its aria wiring, "Hủy" drops the directory query, a <main> or a second primary returns, the no-year warning stops blocking the save, the edit reason stops being required, step 4 links a draft class into the batch tool (or carries the class directory's query there), or an override still calls the real action;
// why_new=step 15a rewrites ClassFormPage (K1–K3) and no test rendered it;
// seam=next/navigation offers useRouter with push and refresh only; the class actions module is mocked so a default call is observable; no_claim=server validation or the create_class/update_class RPCs (class-actions.ts), the routes' gates (create-class-route.test.tsx)
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClassFormPage } from "@/features/classes/management/class-form-page";
import type { AcademicYearManagementItem, ClassDetailReadModel } from "@/features/classes/read-models";

const mocks = vi.hoisted(() => ({
  changeClassStatusAction: vi.fn(),
  createClassAction: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  updateClassAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("@/features/classes/actions/class-actions", () => ({
  changeClassStatusAction: mocks.changeClassStatusAction,
  createClassAction: mocks.createClassAction,
  updateClassAction: mocks.updateClassAction,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const counts = { active: 0, archived: 0, closed: 0, draft: 0, total: 0 };
const years: AcademicYearManagementItem[] = [
  { classCounts: counts, code: "2027-2028", endsOn: "2028-05-31", id: "11111111-1111-4111-8111-111111111111", isCurrent: false, name: "Năm học 2027–2028", startsOn: "2027-08-15", status: "draft" },
  { classCounts: counts, code: "2026-2027", endsOn: "2027-05-31", id: "22222222-2222-4222-8222-222222222222", isCurrent: true, name: "Năm học 2026–2027", startsOn: "2026-08-15", status: "active" },
];

function classDetail(overrides: Partial<ClassDetailReadModel> = {}): ClassDetailReadModel {
  return {
    academicYear: years[1],
    activeScheduleCount: 2,
    activeStudentCount: 14,
    classinUrl: "https://classin.example/6b1",
    code: "6B1",
    componentClasses: [],
    defaultLearningMode: "offline",
    grade: 6,
    id: "33333333-3333-4333-8333-333333333333",
    level: "B",
    name: "Toán 6B chiều",
    notes: "Ghi chú cũ",
    schedules: [],
    status: "active",
    weeklySessionCount: 3,
    ...overrides,
  };
}

const select = (label: string) => screen.getByLabelText(label) as HTMLSelectElement;
const input = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const optionTexts = (label: string) => Array.from(select(label).options).map((option) => option.textContent);
const saveButton = (name: string) => screen.getByRole("button", { name });

describe("ClassFormPage — create", () => {
  it("lays out the header, both sections and every field with today's defaults", () => {
    const { container } = render(<ClassFormPage academicYears={years} directoryQuery="status=active&page=2" />);

    expect(screen.getByRole("heading", { level: 1, name: "Tạo lớp" })).toBeInTheDocument();
    expect(screen.getByText("Lớp mới ở trạng thái Nháp cho đến khi kích hoạt.")).toBeInTheDocument();
    expect(container.querySelector("main")).toBeNull();

    const info = screen.getByRole("region", { name: "Thông tin lớp" });
    expect(info).toHaveAttribute("id", "thong-tin");
    expect(screen.getByRole("region", { name: "Lịch tuần" })).toHaveAttribute("id", "lich-tuan");
    expect(screen.queryByRole("region", { name: "Lý do thao tác" })).not.toBeInTheDocument();

    expect(input("Tên lớp")).toHaveValue("");
    expect(input("Tên lớp")).toBeRequired();
    expect(input("Tên lớp")).toHaveAttribute("maxLength", "200");
    expect(input("Mã lớp")).toHaveAttribute("placeholder", "Ví dụ: 5A1");
    expect(input("Mã lớp")).toBeRequired();
    expect(optionTexts("Năm học")).toEqual(["2027-2028 — Năm học 2027–2028", "2026-2027 — Năm học 2026–2027 (hiện tại)"]);
    expect(select("Năm học").value).toBe(years[1].id);
    expect(optionTexts("Khối")).toEqual(Array.from({ length: 12 }, (_, index) => `Khối ${index + 1}`));
    expect(select("Khối").value).toBe("1");
    expect(optionTexts("Trình độ")).toEqual(["A — Nâng cao", "B — Cơ bản", "CLC — Chất lượng cao"]);
    expect(select("Trình độ").value).toBe("A");
    expect(optionTexts("Hình thức mặc định")).toEqual(["Tại lớp", "Trực tuyến", "Kết hợp"]);
    expect(select("Hình thức mặc định").value).toBe("hybrid");
    expect(optionTexts("Số buổi mỗi tuần")).toEqual(Array.from({ length: 7 }, (_, index) => `${index + 1} buổi/tuần`));
    expect(select("Số buổi mỗi tuần").value).toBe("2");
    expect(select("Số buổi mỗi tuần")).toHaveAccessibleDescription("Giới hạn số dòng lịch tuần đang hiệu lực");
    expect(input("Đường dẫn ClassIn")).toHaveAttribute("type", "url");
    expect(input("Đường dẫn ClassIn")).toHaveAttribute("placeholder", "Chỉ cần cho lớp trực tuyến hoặc kết hợp");
    expect(screen.getByLabelText("Ghi chú")).toHaveAttribute("maxLength", "10000");
    expect(screen.queryByText(/\b(offline|online|hybrid)\b/)).not.toBeInTheDocument();
  });

  it("says where the weekly schedule is set up, with the next steps as plain text", () => {
    render(<ClassFormPage academicYears={years} />);

    const schedule = screen.getByRole("region", { name: "Lịch tuần" });
    expect(within(schedule).getByText("Lịch tuần được thiết lập trên trang lớp sau khi kích hoạt lớp.")).toBeInTheDocument();
    const steps = within(schedule).getAllByRole("listitem");
    expect(steps.map((step) => step.textContent)).toEqual([
      "1.Lưu lớp (Nháp)",
      "2.Kích hoạt lớp",
      "3.Thiết lập lịch tuần",
      "4.Tạo buổi hàng loạt",
    ]);
    expect(within(schedule).queryAllByRole("link")).toHaveLength(0);
    // No editor and no room UI on this route.
    expect(within(schedule).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(schedule).queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryByText(/Trùng phòng|Thêm dòng/)).not.toBeInTheDocument();
  });

  it("has one primary, keeps the directory query on Hủy and the back link", () => {
    const { container } = render(<ClassFormPage academicYears={years} directoryQuery="status=active&page=2" />);

    expect(saveButton("Lưu lớp (Nháp)")).toHaveAttribute("type", "submit");
    expect(container.querySelectorAll("button.bg-action-primary, a.bg-action-primary")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Hủy" })).toHaveAttribute("href", "/classes?status=active&page=2");
    expect(screen.getByRole("link", { name: "Quay lại danh sách lớp" })).toHaveAttribute("href", "/classes?status=active&page=2");
  });

  it("sends the typed values, uppercases the code and pushes to the class with the directory query", async () => {
    mocks.createClassAction.mockResolvedValueOnce({ message: "Đã tạo lớp học mới.", redirectTo: "/classes/new-id", status: "success" });
    render(<ClassFormPage academicYears={years} directoryQuery="status=active" />);

    fireEvent.change(input("Tên lớp"), { target: { value: "Toán 6B chiều" } });
    fireEvent.change(input("Mã lớp"), { target: { value: "6b1" } });
    expect(input("Mã lớp")).toHaveValue("6B1");
    fireEvent.change(select("Khối"), { target: { value: "6" } });
    fireEvent.change(select("Trình độ"), { target: { value: "B" } });
    fireEvent.change(select("Hình thức mặc định"), { target: { value: "offline" } });
    fireEvent.change(select("Số buổi mỗi tuần"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Ghi chú"), { target: { value: "Lớp chiều" } });
    fireEvent.click(saveButton("Lưu lớp (Nháp)"));

    await waitFor(() => expect(mocks.createClassAction).toHaveBeenCalledOnce());
    expect(mocks.createClassAction).toHaveBeenCalledWith({
      academicYearId: years[1].id,
      classinUrl: "",
      code: "6B1",
      defaultLearningMode: "offline",
      grade: 6,
      level: "B",
      name: "Toán 6B chiều",
      notes: "Lớp chiều",
      weeklySessionCount: 3,
    });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/classes/new-id?status=active"));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.updateClassAction).not.toHaveBeenCalled();
  });

  it("puts server field errors under their control and the message by the buttons, keeping the values", async () => {
    mocks.createClassAction.mockResolvedValueOnce({
      fieldErrors: { code: ["Mã lớp chỉ gồm chữ in hoa, số và các dấu . _ -."] },
      message: "Vui lòng kiểm tra lại thông tin lớp học.",
      status: "error",
    });
    render(<ClassFormPage academicYears={years} />);

    fireEvent.change(input("Tên lớp"), { target: { value: "Toán 6B" } });
    fireEvent.change(input("Mã lớp"), { target: { value: "6B 1" } });
    fireEvent.click(saveButton("Lưu lớp (Nháp)"));

    await waitFor(() => expect(input("Mã lớp")).toHaveAttribute("aria-invalid", "true"));
    expect(input("Mã lớp")).toHaveAccessibleDescription("Mã lớp chỉ gồm chữ in hoa, số và các dấu . _ -.");
    expect(input("Tên lớp")).not.toHaveAttribute("aria-invalid");
    expect(input("Mã lớp")).toHaveValue("6B 1");
    const banner = screen.getAllByRole("alert").find((element) => element.textContent?.includes("Vui lòng kiểm tra lại thông tin lớp học."));
    expect(banner).toBeDefined();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("warns without an open year and keeps the save disabled with the reason", () => {
    render(<ClassFormPage academicYears={[]} />);

    const warning = screen.getByText("Chưa có năm học đang mở").closest("[role=status]")!;
    expect(warning).toHaveTextContent("Cần tạo hoặc kích hoạt năm học trước khi tạo lớp.");
    const yearsLink = within(warning as HTMLElement).getByRole("link", { name: "Đi tới quản lý năm học" });
    expect(yearsLink).toHaveAttribute("href", "/classes/academic-years");
    // review C2-6: a 44px target below md (DESIGN), inline text from md.
    expect(yearsLink).toHaveClass("inline-flex", "min-h-11", "items-center", "md:min-h-0");
    expect(select("Năm học")).toBeDisabled();
    expect(saveButton("Lưu lớp (Nháp)")).toBeDisabled();
    expect(saveButton("Lưu lớp (Nháp)")).toHaveAccessibleDescription("Cần có năm học đang mở để tạo lớp.");
  });

  // Value (extension, ship audit of step 15a): protects=while a create runs the form holds still: the only primary reads "Đang lưu…", is busy and disabled, every control is disabled, a second click sends nothing, and the class opens exactly once when the answer lands;
  // fails_when=the rewritten Button loses `isPending` (double create), the fields stay editable during the save (values sent differ from what is on screen), or the push repeats;
  // why_new=every other case resolves the action at once, so the pending frame (renamed from "Đang tạo lớp..." to "Đang lưu…" in this rewrite) is never rendered; seam=none (same next/navigation and class-actions mocks; the action returns a promise the test settles); no_claim=server-side idempotency of create_class, or implicit submission rules of real browsers
  it("holds the form while the create runs: one request, 'Đang lưu…', every control disabled", async () => {
    let settle!: (state: { message: string; redirectTo?: string; status: "success" | "error" }) => void;
    mocks.createClassAction.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    render(<ClassFormPage academicYears={years} directoryQuery="status=active" />);
    fireEvent.change(input("Tên lớp"), { target: { value: "Toán 6B chiều" } });
    fireEvent.change(input("Mã lớp"), { target: { value: "6B1" } });
    fireEvent.click(saveButton("Lưu lớp (Nháp)"));

    const pending = await screen.findByRole("button", { name: "Đang lưu…" });
    expect(pending).toBeDisabled();
    expect(pending).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("button", { name: "Lưu lớp (Nháp)" })).not.toBeInTheDocument();
    for (const label of ["Tên lớp", "Mã lớp", "Năm học", "Khối", "Trình độ", "Hình thức mặc định", "Số buổi mỗi tuần", "Đường dẫn ClassIn", "Ghi chú"]) {
      expect(screen.getByLabelText(label), label).toBeDisabled();
    }
    fireEvent.click(pending);
    expect(mocks.createClassAction).toHaveBeenCalledOnce();

    await act(async () => settle({ message: "Đã tạo lớp học mới.", redirectTo: "/classes/new-id", status: "success" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/classes/new-id?status=active"));
    expect(mocks.push).toHaveBeenCalledOnce();
    expect(mocks.createClassAction).toHaveBeenCalledOnce();
  });

  // Value (extension, review R3 of step 15a): protects=a rejected save (network down, a deploy in between) is answered by the buttons with "Không thể kết nối tới hệ thống lưu lớp. Vui lòng thử lại." while every typed value stays and the save can be tried again, in create and edit;
  // fails_when=the rejection escapes the transition (the error boundary replaces the page and the typed form is lost), the values reset, or the page navigates;
  // why_new=every other case resolves the action; seam=the class actions module mock rejects; no_claim=what the server did with a request it received before the connection dropped
  it("keeps the typed values and says so when the save cannot reach the server", async () => {
    mocks.createClassAction.mockRejectedValueOnce(new Error("network"));
    render(<ClassFormPage academicYears={years} directoryQuery="status=active" />);
    fireEvent.change(input("Tên lớp"), { target: { value: "Toán 6B chiều" } });
    fireEvent.change(input("Mã lớp"), { target: { value: "6b1" } });
    fireEvent.change(select("Khối"), { target: { value: "6" } });
    fireEvent.click(saveButton("Lưu lớp (Nháp)"));

    const banner = await screen.findByText("Không thể kết nối tới hệ thống lưu lớp. Vui lòng thử lại.");
    expect(banner.closest('[role="alert"]')).not.toBeNull();
    expect(input("Tên lớp")).toHaveValue("Toán 6B chiều");
    expect(input("Mã lớp")).toHaveValue("6B1");
    expect(select("Khối").value).toBe("6");
    expect(await screen.findByRole("button", { name: "Lưu lớp (Nháp)" })).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();

    mocks.createClassAction.mockResolvedValueOnce({ message: "Đã tạo lớp học mới.", redirectTo: "/classes/new-id", status: "success" });
    fireEvent.click(saveButton("Lưu lớp (Nháp)"));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/classes/new-id?status=active"));
    expect(mocks.createClassAction).toHaveBeenCalledTimes(2);
  });

  it("keeps the edit form and the reason when the update cannot reach the server", async () => {
    mocks.updateClassAction.mockRejectedValueOnce(new Error("version skew"));
    render(<ClassFormPage academicYears={years} classDetail={classDetail()} initialReason="Đổi tên lớp" />);
    fireEvent.change(input("Tên lớp"), { target: { value: "Toán 6B tối" } });
    fireEvent.click(saveButton("Lưu thay đổi"));

    expect(await screen.findByText("Không thể kết nối tới hệ thống lưu lớp. Vui lòng thử lại.")).toBeInTheDocument();
    expect(input("Tên lớp")).toHaveValue("Toán 6B tối");
    expect(screen.getByLabelText("Lý do cập nhật")).toHaveValue("Đổi tên lớp");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  // Value (extension, review D1/D9 of step 15a): protects=the back link, Hủy, the primary and the step links are 44px targets below md with their desktop size kept, and on the 6-column desktop grid "Trình độ" spans 2 columns ("A — Nâng cao" no longer clips) while every row of the grid still fills exactly 6 columns;
  // fails_when=a control drops back to 40px on touch, a touch class replaces the desktop size, "Trình độ" shrinks back to one column, or a row is left with empty columns;
  // why_new=no test checked target sizes or the grid; seam=class names (jsdom has no layout); no_claim=rendered pixel sizes or text clipping
  it("gives touch-size targets below md and packs the desktop grid into full rows", () => {
    render(<ClassFormPage academicYears={years} canManageSessions classDetail={classDetail()} />);

    expect(screen.getByRole("link", { name: "Quay lại chi tiết lớp" })).toHaveClass("max-md:h-11", "h-10");
    expect(screen.getByRole("link", { name: "Hủy" })).toHaveClass("max-md:h-11", "h-10");
    expect(saveButton("Lưu thay đổi")).toHaveClass("max-md:h-11", "h-10");
    for (const name of ["Thiết lập lịch tuần", "Tạo buổi hàng loạt"]) {
      expect(screen.getByRole("link", { name }), name).toHaveClass("flex", "min-h-11", "flex-1");
    }

    const fieldOf = (label: string) => screen.getByLabelText(label).parentElement!;
    expect(fieldOf("Trình độ")).toHaveClass("lg:col-span-2");
    const grid = fieldOf("Tên lớp").parentElement!;
    expect(grid).toHaveClass("lg:grid-cols-6");
    const spans = Array.from(grid.children).map((field) => Number(/(?:^|\s)lg:col-span-(\d)/.exec(field.className)?.[1] ?? 1));
    const rows: number[] = [];
    for (const span of spans) {
      if (rows.length === 0 || rows[rows.length - 1] + span > 6) rows.push(span);
      else rows[rows.length - 1] += span;
    }
    expect(rows.every((width) => width === 6), `lg rows ${rows.join(" | ")}`).toBe(true);
  });

  it("uses the action overrides instead of the real actions", async () => {
    const createClass = vi.fn().mockResolvedValue({ message: "Bản xem trước không ghi dữ liệu.", status: "error" });
    render(<ClassFormPage academicYears={years} actions={{ createClass }} />);

    fireEvent.change(input("Tên lớp"), { target: { value: "Toán 6B" } });
    fireEvent.change(input("Mã lớp"), { target: { value: "6B1" } });
    fireEvent.click(saveButton("Lưu lớp (Nháp)"));

    await waitFor(() => expect(screen.getByText("Bản xem trước không ghi dữ liệu.")).toBeInTheDocument());
    expect(createClass).toHaveBeenCalledOnce();
    expect(mocks.createClassAction).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe("ClassFormPage — edit", () => {
  it("starts from the class, keeps today's title and requires the update reason", async () => {
    mocks.updateClassAction.mockResolvedValueOnce({ message: "Đã cập nhật lớp học.", redirectTo: "/classes/33333333-3333-4333-8333-333333333333", status: "success" });
    const detail = classDetail();
    render(<ClassFormPage academicYears={years} classDetail={detail} directoryQuery="status=active" />);

    expect(screen.getByRole("heading", { level: 1, name: "Chỉnh sửa lớp học" })).toBeInTheDocument();
    expect(screen.getByText(/^Lớp 6B1 — Toán 6B chiều\./)).toBeInTheDocument();
    expect(input("Tên lớp")).toHaveValue("Toán 6B chiều");
    expect(input("Mã lớp")).toHaveValue("6B1");
    expect(select("Khối").value).toBe("6");
    expect(select("Trình độ").value).toBe("B");
    expect(select("Hình thức mặc định").value).toBe("offline");
    expect(select("Số buổi mỗi tuần").value).toBe("3");
    expect(input("Đường dẫn ClassIn")).toHaveValue("https://classin.example/6b1");
    expect(screen.getByLabelText("Ghi chú")).toHaveValue("Ghi chú cũ");

    expect(screen.getByRole("region", { name: "Lý do thao tác" })).toHaveAttribute("id", "ly-do");
    const save = saveButton("Lưu thay đổi");
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription("Nhập lý do cập nhật để lưu thay đổi.");
    expect(screen.getByRole("link", { name: "Hủy" })).toHaveAttribute("href", `/classes/${detail.id}?status=active`);
    expect(screen.getByRole("link", { name: "Quay lại chi tiết lớp" })).toHaveAttribute("href", `/classes/${detail.id}?status=active`);

    fireEvent.change(screen.getByLabelText("Lý do cập nhật"), { target: { value: "Đổi tên theo lịch mới" } });
    fireEvent.change(input("Tên lớp"), { target: { value: "Toán 6B tối" } });
    fireEvent.click(saveButton("Lưu thay đổi"));

    await waitFor(() => expect(mocks.updateClassAction).toHaveBeenCalledOnce());
    expect(mocks.updateClassAction).toHaveBeenCalledWith({
      academicYearId: years[1].id,
      classId: detail.id,
      classinUrl: "https://classin.example/6b1",
      code: "6B1",
      defaultLearningMode: "offline",
      grade: 6,
      level: "B",
      name: "Toán 6B tối",
      notes: "Ghi chú cũ",
      reason: "Đổi tên theo lịch mới",
      weeklySessionCount: 3,
    });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/classes/${detail.id}?status=active`));
    expect(mocks.createClassAction).not.toHaveBeenCalled();
  });

  it("marks done steps and links step 3 and step 4 for an active class", () => {
    const detail = classDetail();
    render(<ClassFormPage academicYears={years} canManageSessions classDetail={detail} directoryQuery="status=active" />);

    const schedule = screen.getByRole("region", { name: "Lịch tuần" });
    expect(schedule).toHaveTextContent("Hiện lớp có 2 dòng lịch tuần đang hiệu lực.");
    const steps = within(schedule).getAllByRole("listitem");
    expect(steps[0]).toHaveTextContent("đã xong");
    expect(steps[1]).toHaveTextContent("đã xong");
    expect(steps[2]).not.toHaveTextContent("đã xong");
    expect(within(steps[2]).getByRole("link", { name: "Thiết lập lịch tuần" })).toHaveAttribute("href", `/classes/${detail.id}?status=active`);
    // The batch tool reads the session directory's params, never the class directory's.
    expect(within(steps[3]).getByRole("link", { name: "Tạo buổi hàng loạt" })).toHaveAttribute("href", `/sessions/batch?classId=${detail.id}`);
  });

  it("never links a draft class into the batch tool", () => {
    render(<ClassFormPage academicYears={years} classDetail={classDetail({ status: "draft" })} />);

    const steps = within(screen.getByRole("region", { name: "Lịch tuần" })).getAllByRole("listitem");
    expect(steps[0]).toHaveTextContent("đã xong");
    expect(steps[1]).not.toHaveTextContent("đã xong");
    expect(within(steps[2]).getByRole("link", { name: "Thiết lập lịch tuần" })).toBeInTheDocument();
    expect(within(steps[3]).queryByRole("link")).not.toBeInTheDocument();
  });

  // Value (extension, review A1/C1 and cycle-2 C2-1 of step 15a): protects=step 4 links into /sessions/batch under the class page's own rule (an active class, not a composite parent, a user with sessions.manage) without the class directory's query (the batch route parses its query as the SESSION directory's: a class search or page would filter the sessions list), and a composite parent ("lớp ghép") links neither step 3 nor step 4 and says in words that schedules and sessions belong to its component classes;
  // fails_when=a TA without sessions.manage (or a default caller) gets a link the batch route denies, a composite parent is sent to set up a schedule or create sessions the database rejects, or the batch link carries the class directory's search/page/status;
  // why_new=the ship review found step 4 linked regardless of permission and of composite parents; cycle 2 found the class directory query leaking into the batch route; seam=none (same mocks as above); no_claim=the edit route's permission read (create-class-route.test.tsx)
  it("links step 4 only for sessions.manage and never with the class directory's query", () => {
    const detail = classDetail();
    const { rerender } = render(<ClassFormPage academicYears={years} classDetail={detail} directoryQuery="status=active" />);
    const steps = () => within(screen.getByRole("region", { name: "Lịch tuần" })).getAllByRole("listitem");
    expect(within(steps()[3]).queryByRole("link")).not.toBeInTheDocument();
    expect(steps()[3]).toHaveTextContent("4.Tạo buổi hàng loạt");
    expect(within(steps()[2]).getByRole("link", { name: "Thiết lập lịch tuần" })).toBeInTheDocument();

    rerender(<ClassFormPage academicYears={years} canManageSessions classDetail={detail} directoryQuery="q=6B&page=2&status=active" />);
    const batchLink = within(steps()[3]).getByRole("link", { name: "Tạo buổi hàng loạt" });
    expect(batchLink).toHaveAttribute("href", `/sessions/batch?classId=${detail.id}`);
    expect([...new URLSearchParams(batchLink.getAttribute("href")!.split("?")[1]).keys()]).toEqual(["classId"]);
    // Step 3 stays inside the class directory and keeps its query.
    expect(within(steps()[2]).getByRole("link", { name: "Thiết lập lịch tuần" })).toHaveAttribute("href", `/classes/${detail.id}?q=6B&page=2&status=active`);
  });

  it("never links a composite parent's schedule or sessions and names its component classes", () => {
    const detail = classDetail({
      componentClasses: [
        { code: "6B1-DS", effectiveFrom: "2026-09-01", id: "44444444-4444-4444-8444-444444444444", name: "Đại số 6B" },
        { code: "6B1-HH", effectiveFrom: "2026-11-01", id: "55555555-5555-4555-8555-555555555555", name: "Hình học 6B" },
      ],
    });
    render(<ClassFormPage academicYears={years} canManageSessions classDetail={detail} directoryQuery="status=active" />);

    const schedule = screen.getByRole("region", { name: "Lịch tuần" });
    expect(within(schedule).queryAllByRole("link")).toHaveLength(0);
    expect(schedule).toHaveTextContent("Lớp ghép không có lịch riêng. Lịch tuần và buổi học thuộc các lớp thành phần: 6B1-DS, 6B1-HH.");
    expect(schedule).not.toHaveTextContent("Lịch tuần được thiết lập trên trang lớp sau khi kích hoạt lớp.");
    expect(within(schedule).getAllByRole("listitem").map((step) => step.textContent)).toEqual([
      "1.Lưu lớp (Nháp)đã xong",
      "2.Kích hoạt lớpđã xong",
      "3.Thiết lập lịch tuần",
      "4.Tạo buổi hàng loạt",
    ]);
  });

  // Value (extension, review Sec1/M3 of step 15a): protects=the /dev preview can point every link of the form at /dev pages (no-year warning, back link, Hủy, step 3, step 4) while the routes keep their defaults;
  // fails_when=a link ignores its override (the preview then links into a live write page such as /classes/academic-years or /classes/{id});
  // why_new=the form hard-coded its targets; seam=none; no_claim=which /dev pages the preview picks (dev-forms-class-batch-preview.test.tsx)
  it("sends every link to the overrides when given", () => {
    render(
      <ClassFormPage
        academicYears={years}
        batchHref="/dev/forms?view=batch"
        canManageSessions
        cancelHref="/dev/class?state=active"
        classDetail={classDetail()}
        classPageHref="/dev/class?state=active"
        directoryQuery="status=active"
      />,
    );
    expect(screen.getByRole("link", { name: "Hủy" })).toHaveAttribute("href", "/dev/class?state=active");
    expect(screen.getByRole("link", { name: "Quay lại chi tiết lớp" })).toHaveAttribute("href", "/dev/class?state=active");
    expect(screen.getByRole("link", { name: "Thiết lập lịch tuần" })).toHaveAttribute("href", "/dev/class?state=active");
    expect(screen.getByRole("link", { name: "Tạo buổi hàng loạt" })).toHaveAttribute("href", "/dev/forms?view=batch");
    cleanup();

    render(<ClassFormPage academicYears={[]} academicYearsHref="/dev/lists?view=classes" cancelHref="/dev/lists?view=classes" />);
    expect(screen.getByRole("link", { name: "Đi tới quản lý năm học" })).toHaveAttribute("href", "/dev/lists?view=classes");
    expect(screen.getByRole("link", { name: "Hủy" })).toHaveAttribute("href", "/dev/lists?view=classes");
    expect(screen.getByRole("link", { name: "Quay lại danh sách lớp" })).toHaveAttribute("href", "/dev/lists?view=classes");
  });

  it("can start from a seeded answer (preview) and still sends through the override", async () => {
    const updateClass = vi.fn().mockResolvedValue({ message: "Bản xem trước không ghi dữ liệu.", status: "error" });
    render(
      <ClassFormPage
        academicYears={years}
        actions={{ updateClass }}
        classDetail={classDetail()}
        initialActionState={{ message: "Không thể đổi năm học, mã lớp, khối hoặc trình độ sau khi lớp đã được sử dụng.", status: "error" }}
        initialReason="Chuyển khối"
        initialValues={{ grade: 7 }}
      />,
    );

    expect(screen.getByText("Không thể đổi năm học, mã lớp, khối hoặc trình độ sau khi lớp đã được sử dụng.")).toBeInTheDocument();
    expect(select("Khối").value).toBe("7");
    expect(screen.getByLabelText("Lý do cập nhật")).toHaveValue("Chuyển khối");
    fireEvent.click(saveButton("Lưu thay đổi"));
    await waitFor(() => expect(updateClass).toHaveBeenCalledOnce());
    expect(mocks.updateClassAction).not.toHaveBeenCalled();
  });
});

// Value (extension, review R3-7 of step 15a): protects=a save that ends on the page (server field errors, a server message, a rejected action) gives keyboard and phone users a focus target: the first control the server rejected, in page order and scrolled into view; otherwise the control the save started from (the primary, or a field on Enter) once it is enabled again, or the message by the buttons when that control is gone; focus the user moved elsewhere meanwhile stays put;
// fails_when=focus stays on <body> after the save disabled the controls, a rejected field is not focused (or the first in the errors object wins over page order), or a restore steals focus the user moved;
// why_new=the form disabled every control during the save and never moved focus afterwards; seam=jsdom keeps focus on a control that becomes disabled, so each case drops it to <body> as browsers do; Element.scrollIntoView is stubbed (jsdom has none); no_claim=real browsers' focus fixup or scrolling
describe("ClassFormPage — focus after a save that stays on the page", () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView, writable: true });
  });

  afterEach(() => {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  /** Browsers drop focus from a control that becomes disabled; jsdom keeps it there (and ignores blur() on it). */
  function dropFocusToBody() {
    const backLink = screen.getByRole("link", { name: "Quay lại danh sách lớp" });
    act(() => {
      backLink.focus();
      backLink.blur();
    });
    expect(document.activeElement).toBe(document.body);
  }

  function deferCreate() {
    const deferred = {} as { reject: (error: unknown) => void; resolve: (state: object) => void };
    mocks.createClassAction.mockImplementationOnce(
      () =>
        new Promise((resolve, reject) => {
          deferred.resolve = resolve;
          deferred.reject = reject;
        }),
    );
    return deferred;
  }

  function fillName() {
    fireEvent.change(input("Tên lớp"), { target: { value: "Toán 6B chiều" } });
    fireEvent.change(input("Mã lớp"), { target: { value: "6b1" } });
  }

  it("focuses 'Mã lớp' when the server rejects the code", async () => {
    mocks.createClassAction.mockResolvedValueOnce({
      fieldErrors: { code: ["Mã lớp đã tồn tại."] },
      message: "Vui lòng kiểm tra lại thông tin lớp học.",
      status: "error",
    });
    render(<ClassFormPage academicYears={years} />);
    fillName();
    const save = saveButton("Lưu lớp (Nháp)");
    // A keyboard user: focus starts on the primary, and the rejected field still wins.
    save.focus();
    fireEvent.click(save);

    const code = input("Mã lớp");
    await waitFor(() => expect(code).toHaveFocus());
    expect(code).toHaveAccessibleDescription("Mã lớp đã tồn tại.");
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(code);
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: "center" }));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("focuses the first rejected control in page order", async () => {
    mocks.createClassAction.mockResolvedValueOnce({
      // Errors-object order puts the code first; on the page "Tên lớp" comes first.
      fieldErrors: { code: ["Mã lớp đã tồn tại."], name: ["Tên lớp đã được dùng trong năm học này."] },
      message: "Vui lòng kiểm tra lại thông tin lớp học.",
      status: "error",
    });
    render(<ClassFormPage academicYears={years} />);
    fillName();
    fireEvent.click(saveButton("Lưu lớp (Nháp)"));

    await waitFor(() => expect(input("Tên lớp")).toHaveFocus());
    expect(input("Tên lớp")).toHaveAttribute("aria-invalid", "true");
    expect(input("Mã lớp")).toHaveAttribute("aria-invalid", "true");
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(input("Tên lớp"));
  });

  it("gives focus back to the primary when its save fails without field errors", async () => {
    const create = deferCreate();
    render(<ClassFormPage academicYears={years} />);
    fillName();
    const save = saveButton("Lưu lớp (Nháp)");
    save.focus();
    fireEvent.click(save);
    expect(await screen.findByRole("button", { name: "Đang lưu…" })).toBe(save);
    expect(save).toBeDisabled();
    dropFocusToBody();

    await act(async () => create.resolve({ message: "Lớp chưa được lưu. Vui lòng thử lại.", status: "error" }));
    await waitFor(() => expect(save).toHaveFocus());
    expect(save).toHaveAccessibleName("Lưu lớp (Nháp)");
    expect(screen.getByText("Lớp chưa được lưu. Vui lòng thử lại.")).toBeInTheDocument();
  });

  it("moves focus to the message by the buttons when the control the save started from is gone", async () => {
    const create = deferCreate();
    render(<ClassFormPage academicYears={years} />);
    fillName();
    const save = saveButton("Lưu lớp (Nháp)");
    save.focus();
    fireEvent.click(save);
    await screen.findByRole("button", { name: "Đang lưu…" });
    dropFocusToBody();
    save.remove();

    await act(async () => create.resolve({ message: "Lớp chưa được lưu. Vui lòng thử lại.", status: "error" }));
    const alert = screen.getByText("Lớp chưa được lưu. Vui lòng thử lại.").closest('[role="alert"]')!;
    await waitFor(() => expect(document.activeElement).toContainElement(alert as HTMLElement));
    expect(document.activeElement).toHaveAttribute("tabindex", "-1");
  });

  it("gives focus back to the field a rejected save started from (Enter) and keeps the values", async () => {
    const create = deferCreate();
    render(<ClassFormPage academicYears={years} />);
    fillName();
    const code = input("Mã lớp");
    code.focus();
    // Enter in a field submits the form.
    fireEvent.submit(code.form!);
    await screen.findByRole("button", { name: "Đang lưu…" });
    expect(code).toBeDisabled();
    dropFocusToBody();

    await act(async () => create.reject(new Error("network")));
    await waitFor(() => expect(code).toHaveFocus());
    expect(screen.getByText("Không thể kết nối tới hệ thống lưu lớp. Vui lòng thử lại.")).toBeInTheDocument();
    expect(input("Tên lớp")).toHaveValue("Toán 6B chiều");
    expect(code).toHaveValue("6B1");
  });

  it("leaves focus where the user moved it during the save", async () => {
    const create = deferCreate();
    render(<ClassFormPage academicYears={years} />);
    fillName();
    const save = saveButton("Lưu lớp (Nháp)");
    save.focus();
    fireEvent.click(save);
    await screen.findByRole("button", { name: "Đang lưu…" });
    dropFocusToBody();
    const cancel = screen.getByRole("link", { name: "Hủy" });
    act(() => cancel.focus());

    await act(async () => create.resolve({ message: "Lớp chưa được lưu. Vui lòng thử lại.", status: "error" }));
    await screen.findByRole("button", { name: "Lưu lớp (Nháp)" });
    expect(cancel).toHaveFocus();
  });
});

// Value (extension, review A4 of step 15a): protects=typed class edits and the update reason are not lost silently: while the form differs from the class (or today's defaults) or a reason is typed, reload/close warns and every link the form renders (back link, "Hủy", the no-year warning, steps 3 and 4) asks "Thay đổi chưa lưu sẽ mất" first ("Ở lại" keeps the edits, "Rời trang" pushes the link's target); a clean form leaves at once, new-tab clicks (ctrl/meta/shift/alt, middle button) are left to the browser, and while a save runs the links wait for it and reload still warns;
// fails_when=a form link drops its click guard, the dialog navigates on "Ở lại" or not on "Rời trang", a clean form (or one reverted to its values) asks, a modified click is intercepted, the update reason stops counting as an edit, beforeunload stays registered on a clean form, or a link leaves mid-save;
// why_new=step 15a added the next-steps links into the class page and the batch tool, and the class form had no leave guard (the student form had one); seam=none (same next/navigation and class-actions mocks; clicks are dispatched as MouseEvents so defaultPrevented is observable; jsdom renders next/link without a router, so an unguarded click is never prevented); no_claim=the sidebar or browser back button, which no form guard intercepts
describe("ClassFormPage — leave guard", () => {
  const unload = () => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };

  /** Dispatches a click on the link; true when the page held the navigation (read after React's handlers, at window). */
  function click(link: HTMLElement, init: MouseEventInit = {}): boolean {
    const event = new MouseEvent("click", { bubbles: true, button: 0, cancelable: true, ...init });
    let held = false;
    const afterPage = (bubbled: Event) => {
      held = bubbled.defaultPrevented;
      // jsdom cannot navigate to another document; stop it once the page's answer is read.
      bubbled.preventDefault();
    };
    window.addEventListener("click", afterPage);
    act(() => {
      link.dispatchEvent(event);
    });
    window.removeEventListener("click", afterPage);
    return held;
  }

  const leaveDialog = () => screen.queryByRole("dialog", { name: "Thay đổi chưa lưu sẽ mất" });
  const step3 = () => screen.getByRole("link", { name: "Thiết lập lịch tuần" });

  function renderEdit() {
    const detail = classDetail();
    render(<ClassFormPage academicYears={years} canManageSessions classDetail={detail} directoryQuery="status=active" />);
    return detail;
  }

  it("asks before step 3 leaves typed edits: 'Ở lại' keeps them, 'Rời trang' pushes the class page", () => {
    const detail = renderEdit();
    fireEvent.change(input("Tên lớp"), { target: { value: "Toán 6B tối" } });

    expect(click(step3())).toBe(true);
    const dialog = screen.getByRole("dialog", { name: "Thay đổi chưa lưu sẽ mất" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ở lại" }));
    expect(leaveDialog()).not.toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(input("Tên lớp")).toHaveValue("Toán 6B tối");

    expect(click(step3())).toBe(true);
    fireEvent.click(within(screen.getByRole("dialog", { name: "Thay đổi chưa lưu sẽ mất" })).getByRole("button", { name: "Rời trang" }));
    expect(mocks.push).toHaveBeenCalledOnce();
    expect(mocks.push).toHaveBeenCalledWith(`/classes/${detail.id}?status=active`);
  });

  it("guards every link the form renders, the update reason alone included", () => {
    const detail = renderEdit();
    fireEvent.change(screen.getByLabelText("Lý do cập nhật"), { target: { value: "Đổi tên" } });

    for (const [name, href] of [
      ["Quay lại chi tiết lớp", `/classes/${detail.id}?status=active`],
      ["Hủy", `/classes/${detail.id}?status=active`],
      ["Tạo buổi hàng loạt", `/sessions/batch?classId=${detail.id}`],
    ]) {
      mocks.push.mockClear();
      expect(click(screen.getByRole("link", { name })), name).toBe(true);
      fireEvent.click(within(screen.getByRole("dialog", { name: "Thay đổi chưa lưu sẽ mất" })).getByRole("button", { name: "Rời trang" }));
      expect(mocks.push, name).toHaveBeenCalledWith(href);
    }
    cleanup();

    render(<ClassFormPage academicYears={[]} />);
    fireEvent.change(input("Tên lớp"), { target: { value: "Toán 6B chiều" } });
    expect(click(screen.getByRole("link", { name: "Đi tới quản lý năm học" }))).toBe(true);
    expect(leaveDialog()).toBeInTheDocument();
  });

  it("leaves at once from a clean form, and from one reverted to the class's values", () => {
    renderEdit();
    expect(click(step3())).toBe(false);
    expect(click(screen.getByRole("link", { name: "Hủy" }))).toBe(false);
    expect(leaveDialog()).not.toBeInTheDocument();

    fireEvent.change(select("Khối"), { target: { value: "7" } });
    fireEvent.change(select("Khối"), { target: { value: "6" } });
    expect(click(step3())).toBe(false);
    expect(leaveDialog()).not.toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("leaves new-tab clicks to the browser", () => {
    renderEdit();
    fireEvent.change(input("Tên lớp"), { target: { value: "Toán 6B tối" } });

    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      expect(click(step3(), init), JSON.stringify(init)).toBe(false);
      expect(click(screen.getByRole("link", { name: "Hủy" }), init), JSON.stringify(init)).toBe(false);
    }
    expect(leaveDialog()).not.toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("warns on reload only while the form holds unsaved edits", () => {
    renderEdit();
    expect(unload()).toBe(false);

    fireEvent.change(screen.getByLabelText("Lý do cập nhật"), { target: { value: "Đổi khối" } });
    expect(unload()).toBe(true);
    fireEvent.change(screen.getByLabelText("Lý do cập nhật"), { target: { value: "" } });
    expect(unload()).toBe(false);

    fireEvent.change(select("Khối"), { target: { value: "7" } });
    expect(unload()).toBe(true);
    fireEvent.change(select("Khối"), { target: { value: "6" } });
    expect(unload()).toBe(false);
  });

  // Value (extension, cycle-6 review AE5 of step 15a): protects=the leave guard compares the form to the class as the page opened it (read once at mount, like the form's own values), so a refresh that brings a colleague's edit of the class (a new name, notes, weekly count) leaves an untouched form clean: no beforeunload prompt, and a link leaves at once without the dialog; an edit typed afterwards is still caught;
  // fails_when=the dirty check recomputes its baseline from the live classDetail on every render again (the refreshed class differs from the values on screen, so the untouched form looks dirty);
  // why_new=cycle 6 found the false dirty state after a refresh; seam=rerender with a classDetail whose name, notes and weekly count changed (what router.refresh hands over); no_claim=what the form shows after such a refresh (it keeps the values it opened with)
  it("stays clean when a refresh brings a colleague's edit of the class", () => {
    const { rerender } = render(<ClassFormPage academicYears={years} canManageSessions classDetail={classDetail()} directoryQuery="status=active" />);
    expect(unload()).toBe(false);

    rerender(
      <ClassFormPage
        academicYears={structuredClone(years)}
        canManageSessions
        classDetail={classDetail({ name: "Toán 6B chiều (đổi phòng)", notes: "Ghi chú mới", weeklySessionCount: 4 })}
        directoryQuery="status=active"
      />,
    );
    expect(unload()).toBe(false);
    expect(click(step3())).toBe(false);
    expect(click(screen.getByRole("link", { name: "Hủy" }))).toBe(false);
    expect(leaveDialog()).not.toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();

    fireEvent.change(input("Tên lớp"), { target: { value: "Toán 6B tối" } });
    expect(unload()).toBe(true);
    expect(click(step3())).toBe(true);
    expect(leaveDialog()).toBeInTheDocument();
  });

  it("holds the links and still warns on reload while a save runs", async () => {
    let settle!: (state: { message: string; status: "error" }) => void;
    mocks.createClassAction.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settle = resolve;
        }),
    );
    render(<ClassFormPage academicYears={years} />);
    fireEvent.change(input("Tên lớp"), { target: { value: "Toán 6B chiều" } });
    fireEvent.change(input("Mã lớp"), { target: { value: "6B1" } });
    fireEvent.click(saveButton("Lưu lớp (Nháp)"));
    await screen.findByRole("button", { name: "Đang lưu…" });

    expect(click(screen.getByRole("link", { name: "Hủy" }))).toBe(true);
    expect(leaveDialog()).not.toBeInTheDocument();
    expect(unload()).toBe(true);

    await act(async () => settle({ message: "Lớp chưa được lưu. Vui lòng thử lại.", status: "error" }));
    await screen.findByRole("button", { name: "Lưu lớp (Nháp)" });
    expect(click(screen.getByRole("link", { name: "Hủy" }))).toBe(true);
    expect(leaveDialog()).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
