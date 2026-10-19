// Value: protects=the shared class form of /classes/new and /classes/[classId]/edit (design 17b, left): every field keeps its label, default and options (modes in words), "Thông tin lớp" and "Lịch tuần" are section cards with stable ids, "Lịch tuần" states where the schedule is set up with the four next steps (plain text on create; on edit, done steps say so, step 3 links to the class and step 4 to the batch tool only for an active class), the form sends exactly the typed values (create) or values + classId + reason (edit), success pushes to the class with the directory query and refreshes, server field errors land under their control with aria-invalid + aria-describedby and the message by the buttons, "Hủy" and the back link keep the directory query, the page has no nested <main> and one primary ("Lưu lớp (Nháp)" / "Lưu thay đổi") disabled with a reason when there is no open year or no update reason, and the action overrides replace the real actions;
// fails_when=a field, default or option disappears, a raw enum shows, the payload changes shape, a server field error loses its aria wiring, "Hủy" drops the directory query, a <main> or a second primary returns, the no-year warning stops blocking the save, the edit reason stops being required, step 4 links a draft class into the batch tool, or an override still calls the real action;
// why_new=step 15a rewrites ClassFormPage (K1–K3) and no test rendered it;
// seam=next/navigation offers useRouter with push and refresh only; the class actions module is mocked so a default call is observable; no_claim=server validation or the create_class/update_class RPCs (class-actions.ts), the routes' gates (create-class-route.test.tsx)
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
    expect(within(warning as HTMLElement).getByRole("link", { name: "Đi tới quản lý năm học" })).toHaveAttribute("href", "/classes/academic-years");
    expect(select("Năm học")).toBeDisabled();
    expect(saveButton("Lưu lớp (Nháp)")).toBeDisabled();
    expect(saveButton("Lưu lớp (Nháp)")).toHaveAccessibleDescription("Cần có năm học đang mở để tạo lớp.");
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
    render(<ClassFormPage academicYears={years} classDetail={detail} directoryQuery="status=active" />);

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
