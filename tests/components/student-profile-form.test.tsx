// Value: protects=/students/new and /students/[id]/edit (design 17a): the long-form frame (header "Thêm học sinh" with the TV-… code line, or the student's name with code + status; a ghost back link; TOC "Mục trong form" over sections Hồ sơ · Phụ huynh chính · Xác nhận tiếp tục lưu (only with an exact duplicate) · Lý do thao tác with live statuses that say "đủ" / "thiếu {m}" in words), every field/option/placeholder kept ("Người giám hộ" stays) with aria-invalid + aria-describedby on errored controls, the "Hình thức đăng ký" radiogroup (role radio, aria-checked, arrow keys) bound to the same field, the duplicate lookup before every write, the exact duplicate blocking without a reason, truthful sibling/own-guardian copy with guarded profile links, the save bar's clean/dirty/error states and single primary, "Lưu và thêm tiếp" (same action, reset + success banner + no navigation), server errors above the bar with typed values kept, the first invalid field focused in page order, and the leave guard (Hủy, header link, beforeunload); the touched files stay on the design tokens;
// fails_when=a section/field/option disappears or moves out of its section, the TOC status stops following values or errors, an errored control loses aria-invalid/aria-describedby, the radiogroup loses its roles or keyboard, a write runs before (or without) the lookup, an exact duplicate saves without a reason, the reuse copy claims the typed guardian overwrites (create) or is kept (own guardian on edit), focus goes to the first key of the errors object instead of the first field on the page, the save button is disabled by validation errors, "Lưu và thêm tiếp" navigates or keeps the typed values, a server error clears the form, Hủy leaves without asking while dirty, or a legacy token / outline-none / raw hex / "TTV" enters a touched file;
// why_new=no test rendered StudentProfileForm before step 15a; this rewrite changes its layout, save bar, duplicate copy, focus and leave handling;
// seam=next/navigation offers useRouter with push and refresh only; the server actions module is mocked so every call (and its order) is observable; Element.scrollIntoView and window.scrollTo are stubbed (jsdom has none); no_claim=the server actions, the RPCs, the zod schema's rules (unchanged), the visual sticky layout or the scroll-spy (form-with-toc.test.tsx, /dev/forms)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createStudentWithPrimaryGuardianAction,
  findStudentFormDuplicatesAction,
  updateStudentWithPrimaryGuardianAction,
} from "@/features/students/form/student-form-actions";
import type { StudentFormActionState } from "@/features/students/form/student-form-action-types";
import { ProfileField } from "@/features/students/form/components/student-profile-sections";
import { StudentFormPage } from "@/features/students/form/student-form-page";
import { getStudentProfileFormDefaults } from "@/features/students/form/student-profile-form-helpers";
import type { StudentProfileFormValues } from "@/features/students/form/student-profile-form-schema";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/students/form/student-form-actions", () => ({
  createStudentWithPrimaryGuardianAction: vi.fn(),
  findStudentFormDuplicatesAction: vi.fn(),
  updateStudentWithPrimaryGuardianAction: vi.fn(),
}));
// The real field, counted: each call is one render of one field of the sections.
vi.mock("@/features/students/form/components/student-profile-sections", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/students/form/components/student-profile-sections")>();
  return { ...actual, ProfileField: vi.fn(actual.ProfileField) };
});

const profileFieldRenders = vi.mocked(ProfileField);
const findDuplicates = vi.mocked(findStudentFormDuplicatesAction);
const createStudent = vi.mocked(createStudentWithPrimaryGuardianAction);
const updateStudent = vi.mocked(updateStudentWithPrimaryGuardianAction);

const EDIT_ID = "5f0c2a8e-3b1d-4c6e-9a7f-2d4b6c8e0a13";
const QUANG_ID = "8b6e2f1a-0c4d-4e7b-a1f3-5d9c2b7e4a60";
const AN_ID = "c3d7a9e2-6f1b-4a8c-b5e0-7a2d4f6c8b91";

const editValues: StudentProfileFormValues = {
  birthYear: 2012,
  currentGrade: 8,
  duplicateOverrideReason: "",
  fullName: "Phạm Minh Khang",
  guardianEmail: "hoa.tran@example.com",
  guardianFullName: "Trần Thị Hoa",
  guardianNote: "",
  guardianPhone: "0912345678",
  guardianRelationship: "Mẹ",
  guardianZalo: "",
  internalNote: "",
  learningGoal: "",
  learningLevel: "B",
  nickname: "",
  provinceName: "Hà Nội",
  publicCode: "TV-2025-00042",
  reason: "",
  registeredMode: "offline",
  studentId: EDIT_ID,
};

const quang = { birthYear: 2013, fullName: "Lý Nhật Quang", id: QUANG_ID, isExactDuplicate: false, lifecycleStatus: "active", publicCode: "TV-2024-00088" };
const an = { birthYear: 2016, fullName: "Lý Minh An", id: AN_ID, isExactDuplicate: false, lifecycleStatus: "active", publicCode: "TV-2026-00102" };
const guardian = { fullName: "Nguyễn Thị Thu", id: "e1f4b8c2-9a3d-4b6e-8c7f-0d2a5b9e3c14", phone: "0905123456" };

const created: StudentFormActionState = {
  guardianReused: false,
  message: "Đã tạo hồ sơ học viên thành công.",
  redirectTo: "/students/new-id",
  status: "success",
  studentId: "new-id",
  studentPublicCode: "TV-2026-00123",
};

const scrollIntoView = vi.fn();

beforeEach(() => {
  findDuplicates.mockResolvedValue({ guardian: null, hasExactStudentDuplicate: false, ok: true });
  createStudent.mockResolvedValue(created);
  updateStudent.mockResolvedValue({ ...created, message: "Đã cập nhật hồ sơ học viên thành công.", redirectTo: `/students/${EDIT_ID}` });
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView, writable: true });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

function renderCreate() {
  return render(
    <StudentFormPage
      cancelHref="/students?search=An"
      defaultValues={getStudentProfileFormDefaults("create")}
      mode="create"
      returnQuery="search=An"
    />,
  );
}

function renderEdit(values: Partial<StudentProfileFormValues> = {}) {
  return render(
    <StudentFormPage
      cancelHref={`/students/${EDIT_ID}?search=An`}
      defaultValues={{ ...editValues, ...values }}
      lifecycleStatus="active"
      mode="edit"
      returnQuery="search=An"
    />,
  );
}

const bar = () => screen.getByRole("region", { name: "Thanh lưu thay đổi" });
const toc = () => screen.getByRole("navigation", { name: "Mục trong form" });
const section = (name: string) => screen.getByRole("region", { name });
const tocNames = () => within(toc()).getAllByRole("link").map((link) => link.textContent?.replace(/\s+/g, " ").trim());

function type(label: string, value: string) {
  const field = screen.getByLabelText(label);
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

function fillValidCreate() {
  type("Họ và tên", "Nguyễn Gia Hân");
  type("Họ tên phụ huynh", "Đỗ Thị Lan");
  fireEvent.change(screen.getByLabelText("Quan hệ với học viên"), { target: { value: "Mẹ" } });
  type("Số điện thoại", "0987 654 321");
  type("Lý do tạo hồ sơ", "Phụ huynh đăng ký tư vấn.");
}

function bannerWith(strongText: string) {
  const strong = screen.getByText(strongText);
  const banner = strong.closest('[role="status"], [role="alert"]');
  expect(banner, strongText).not.toBeNull();
  return banner as HTMLElement;
}

describe("StudentProfileForm (design 17a)", () => {
  it("renders the create frame: header, TOC, sections with every field, the after-save note and one primary", () => {
    const { container } = renderCreate();

    expect(screen.getByRole("heading", { level: 1, name: "Thêm học sinh" })).toBeInTheDocument();
    expect(screen.getByText("Mã học sinh (TV-…) được cấp tự động khi lưu · các trường có dấu * là bắt buộc")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về danh sách" })).toHaveAttribute("href", "/students?search=An");
    expect(container.textContent).not.toMatch(/TTV/);

    const links = within(toc()).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["#ho-so", "#phu-huynh", "#ly-do"]);
    expect(links[0]).toHaveAccessibleName("Hồ sơ: 4/9 · thiếu 1");
    expect(links[1]).toHaveAccessibleName("Phụ huynh chính: 0/6 · thiếu 3");
    expect(links[2]).toHaveAccessibleName("Lý do thao tác: thiếu 1");
    expect(screen.queryByRole("region", { name: "Xác nhận tiếp tục lưu" })).not.toBeInTheDocument();

    const hoSo = section("Hồ sơ");
    expect(hoSo).toHaveAttribute("id", "ho-so");
    for (const label of ["Họ và tên", "Tên thường gọi", "Năm sinh", "Khối hiện tại", "Mức học tập", "Tỉnh/thành phố", "Mục tiêu học tập", "Ghi chú nội bộ"]) {
      expect(within(hoSo).getByLabelText(label), label).toBeInTheDocument();
    }
    expect(within(hoSo).getByRole("radiogroup", { name: "Hình thức đăng ký" })).toBeInTheDocument();
    expect(within(within(hoSo).getByLabelText("Khối hiện tại")).getAllByRole("option").map((option) => option.textContent)).toEqual(
      Array.from({ length: 12 }, (_, index) => `Khối ${index + 1}`),
    );
    expect(within(within(hoSo).getByLabelText("Mức học tập")).getAllByRole("option").map((option) => option.textContent)).toEqual(["A", "B", "CLC"]);
    expect(within(hoSo).queryByLabelText("Mã học viên")).not.toBeInTheDocument();

    const phuHuynh = section("Phụ huynh chính");
    expect(phuHuynh).toHaveAttribute("id", "phu-huynh");
    expect(within(phuHuynh).getByText("Bắt buộc để tạo yêu cầu thanh toán và nhận thông báo học phí.")).toBeInTheDocument();
    for (const label of ["Họ tên phụ huynh", "Quan hệ với học viên", "Số điện thoại", "Zalo", "Email", "Ghi chú phụ huynh"]) {
      expect(within(phuHuynh).getByLabelText(label), label).toBeInTheDocument();
    }
    expect(within(within(phuHuynh).getByLabelText("Quan hệ với học viên")).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Chọn quan hệ",
      "Mẹ",
      "Bố",
      "Người giám hộ",
      "Khác",
    ]);
    expect(within(phuHuynh).getByLabelText("Số điện thoại")).toHaveAttribute("type", "tel");
    expect(within(phuHuynh).getByRole("button", { name: "Kiểm tra hồ sơ trùng" })).toBeInTheDocument();

    const lyDo = section("Lý do thao tác");
    expect(lyDo).toHaveAttribute("id", "ly-do");
    expect(within(lyDo).getByLabelText("Lý do tạo hồ sơ")).toHaveAttribute("placeholder", "Ví dụ: Tạo hồ sơ sau khi phụ huynh đăng ký tư vấn.");

    // Truthful F1: no source / rate / enrollment inputs, a note instead.
    expect(screen.getByText("Nguồn học viên, đơn giá học phí và ghi danh vào lớp được thiết lập trên hồ sơ học sinh sau khi lưu.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Nguồn học viên|Đơn giá|Sale phụ trách/)).not.toBeInTheDocument();

    expect(bar()).toHaveTextContent("Chưa có thay đổi");
    expect(within(bar()).queryByRole("button", { name: "Hủy" })).not.toBeInTheDocument();
    expect(within(bar()).getByRole("button", { name: "Lưu học sinh" })).toBeDisabled();
    expect(within(bar()).getByRole("button", { name: "Lưu học sinh" })).toHaveAttribute("type", "submit");
    expect(within(bar()).getByRole("button", { name: "Lưu và thêm tiếp" })).toBeDisabled();

    // G3: the save is the page's only primary.
    const primaries = Array.from(container.querySelectorAll("a, button")).filter((element) => /(^|\s)bg-action-primary(\s|$)/.test(element.className));
    expect(primaries).toEqual([within(bar()).getByRole("button", { name: "Lưu học sinh" })]);
  });

  it("renders the edit frame with the name, code + status, read-only fields and 'Lưu thay đổi' only", () => {
    renderEdit();

    expect(screen.getByRole("heading", { level: 1, name: "Phạm Minh Khang" })).toBeInTheDocument();
    expect(screen.getByText("TV-2025-00042").parentElement).toHaveTextContent("TV-2025-00042 · Đang học");
    expect(screen.getByRole("link", { name: "Về hồ sơ" })).toHaveAttribute("href", `/students/${EDIT_ID}?search=An`);

    const hoSo = section("Hồ sơ");
    expect(within(hoSo).getByLabelText("Mã học viên")).toHaveValue("TV-2025-00042");
    expect(within(hoSo).getByLabelText("Mã học viên")).toHaveAttribute("readonly");
    expect(within(hoSo).getByLabelText("Trạng thái hiện tại")).toHaveValue("Đang học");
    expect(within(toc()).getAllByRole("link")[0]).toHaveAccessibleName("Hồ sơ: 6/9 · đủ");
    expect(within(section("Lý do thao tác")).getByLabelText("Lý do cập nhật hồ sơ")).toHaveAttribute(
      "placeholder",
      "Ví dụ: Cập nhật thông tin theo xác nhận của phụ huynh.",
    );
    expect(within(bar()).getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
    expect(within(bar()).queryByRole("button", { name: "Lưu và thêm tiếp" })).not.toBeInTheDocument();
  });

  it("keeps the TOC statuses and the save bar in step with typing and errors", async () => {
    renderCreate();

    type("Họ và tên", "Nguyễn Gia Hân");
    type("Họ tên phụ huynh", "Đỗ Thị Lan");
    expect(tocNames()).toEqual(["Hồ sơ: 5/9 · đủ", "Phụ huynh chính: 1/6 · thiếu 2", "Lý do thao tác: thiếu 1"]);
    expect(within(toc()).getByRole("link", { name: "Hồ sơ: 5/9 · đủ" }).querySelector("[data-tone]")).toHaveAttribute("data-tone", "success");
    expect(bar()).toHaveTextContent("2 thay đổi chưa lưu");
    expect(bar()).toHaveTextContent("Họ và tên, Họ tên phụ huynh");
    expect(within(bar()).getByRole("button", { name: "Lưu học sinh" })).toBeEnabled();
    expect(within(bar()).getByRole("button", { name: "Lưu và thêm tiếp" })).toBeEnabled();
    expect(within(bar()).getByRole("button", { name: "Hủy" })).toBeInTheDocument();

    type("Số điện thoại", "0905 123 45");
    const phone = screen.getByLabelText("Số điện thoại");
    await waitFor(() => expect(phone).toHaveAttribute("aria-invalid", "true"));
    expect(phone).toHaveAttribute("aria-describedby", "guardianPhone-error");
    expect(document.getElementById("guardianPhone-error")).toHaveTextContent("Số điện thoại cần là số di động Việt Nam hợp lệ.");
    expect(within(toc()).getByRole("link", { name: "Phụ huynh chính: 1 lỗi" }).querySelector("[data-tone]")).toHaveAttribute("data-tone", "danger");
    // Before a submit attempt the bar still counts changes.
    expect(bar()).toHaveTextContent("3 thay đổi chưa lưu");

    type("Số điện thoại", "0905 123 456");
    await waitFor(() => expect(phone).not.toHaveAttribute("aria-invalid"));
    expect(phone).toHaveAttribute("aria-describedby", "guardianPhone-hint");
  });

  it("binds 'Hình thức đăng ký' to a radiogroup with roles, aria-checked and arrow keys", async () => {
    renderCreate();
    const group = screen.getByRole("radiogroup", { name: "Hình thức đăng ký" });
    const offline = within(group).getByRole("radio", { name: "Offline" });
    const online = within(group).getByRole("radio", { name: "Online" });

    expect(group).toHaveAttribute("aria-required", "true");
    expect(offline).toHaveAttribute("aria-checked", "true");
    expect(offline).toHaveAttribute("tabindex", "0");
    expect(online).toHaveAttribute("aria-checked", "false");
    expect(online).toHaveAttribute("tabindex", "-1");

    offline.focus();
    fireEvent.keyDown(offline, { key: "ArrowRight" });
    expect(online).toHaveAttribute("aria-checked", "true");
    expect(online).toHaveFocus();
    expect(bar()).toHaveTextContent("1 thay đổi chưa lưu");
    expect(bar()).toHaveTextContent("Hình thức đăng ký");

    fireEvent.keyDown(online, { key: "ArrowRight" });
    expect(offline).toHaveAttribute("aria-checked", "true");
    expect(bar()).toHaveTextContent("Chưa có thay đổi");

    fireEvent.click(online);
    fillValidCreate();
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu học sinh" }));
    await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(1));
    expect(createStudent.mock.calls[0][0]).toMatchObject({ registeredMode: "online" });
  });

  it("runs the duplicate lookup before the write, then opens the new profile with the directory query", async () => {
    renderCreate();
    fillValidCreate();
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu học sinh" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/students/new-id?search=An"));
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(findDuplicates).toHaveBeenCalledWith({
      birthYear: new Date().getFullYear() - 13,
      fullName: "Nguyễn Gia Hân",
      guardianPhone: "0987 654 321",
      studentId: undefined,
    });
    expect(findDuplicates.mock.invocationCallOrder[0]).toBeLessThan(createStudent.mock.invocationCallOrder[0]);
    expect(createStudent).toHaveBeenCalledWith({
      ...getStudentProfileFormDefaults("create"),
      fullName: "Nguyễn Gia Hân",
      guardianFullName: "Đỗ Thị Lan",
      guardianPhone: "0987 654 321",
      guardianRelationship: "Mẹ",
      publicCode: undefined,
      reason: "Phụ huynh đăng ký tư vấn.",
      studentId: undefined,
    });
    expect(updateStudent).not.toHaveBeenCalled();
  });

  it("blocks an exact duplicate until the override reason is given, in its own TOC section", async () => {
    findDuplicates.mockResolvedValue({
      guardian: { ...guardian, children: [{ ...quang, isExactDuplicate: true }, an] },
      hasExactStudentDuplicate: true,
      ok: true,
    });
    renderCreate();
    fillValidCreate();
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu học sinh" }));

    const confirmation = await screen.findByRole("region", { name: "Xác nhận tiếp tục lưu" });
    expect(confirmation).toHaveAttribute("id", "xac-nhan");
    const reasonField = within(confirmation).getByLabelText("Lý do vẫn tạo hoặc cập nhật hồ sơ");
    await waitFor(() => expect(reasonField).toHaveFocus());
    expect(reasonField).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById("duplicateOverrideReason-error")).toHaveTextContent(
      "Có học viên trùng họ tên, năm sinh và số điện thoại phụ huynh. Cần nhập lý do để tiếp tục.",
    );
    expect(createStudent).not.toHaveBeenCalled();

    const danger = bannerWith("Đã có học sinh trùng họ tên, năm sinh và số điện thoại phụ huynh:");
    expect(danger).toHaveAttribute("role", "alert");
    expect(section("Phụ huynh chính")).toContainElement(danger);
    expect(danger).toHaveTextContent(
      "Đã có học sinh trùng họ tên, năm sinh và số điện thoại phụ huynh: Lý Nhật Quang (TV-2024-00088). Cần nhập lý do ở mục “Xác nhận tiếp tục lưu” để vẫn lưu.",
    );
    expect(within(danger).getByRole("link", { name: "Lý Nhật Quang (TV-2024-00088)" })).toHaveAttribute("href", `/students/${QUANG_ID}?search=An`);

    expect(tocNames()).toEqual(["Hồ sơ: 5/9 · đủ", "Phụ huynh chính: 3/6 · đủ", "Xác nhận tiếp tục lưu: 1 lỗi", "Lý do thao tác: đủ"]);
    expect(bar()).toHaveTextContent("Đang nhập · 1 lỗi cần sửa");
    expect(bar()).toHaveTextContent("Lý do vẫn tạo hoặc cập nhật hồ sơ");

    type("Lý do vẫn tạo hoặc cập nhật hồ sơ", "Hai anh em sinh đôi, khác hồ sơ.");
    await waitFor(() => expect(reasonField).not.toHaveAttribute("aria-invalid"));
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu học sinh" }));

    await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(1));
    expect(findDuplicates).toHaveBeenCalledTimes(2);
    expect(createStudent.mock.calls[0][0]).toMatchObject({ duplicateOverrideReason: "Hai anh em sinh đôi, khác hồ sơ." });
  });

  it("says a reused guardian keeps its record (create) and checks the three lookup fields first", async () => {
    renderCreate();
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra hồ sơ trùng" }));
    await waitFor(() => expect(screen.getByLabelText("Họ và tên")).toHaveFocus());
    expect(findDuplicates).not.toHaveBeenCalled();

    findDuplicates.mockResolvedValue({ guardian: { ...guardian, children: [quang, an] }, hasExactStudentDuplicate: false, ok: true });
    type("Họ và tên", "Lý Gia Hân");
    type("Số điện thoại", "0905 123 456");
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra hồ sơ trùng" }));

    const warning = await waitFor(() => bannerWith("Số điện thoại này đã thuộc phụ huynh Nguyễn Thị Thu"));
    expect(section("Phụ huynh chính")).toContainElement(warning);
    expect(warning).toHaveTextContent(
      "Số điện thoại này đã thuộc phụ huynh Nguyễn Thị Thu của Lý Nhật Quang (TV-2024-00088) và Lý Minh An (TV-2026-00102). Khi lưu, hồ sơ phụ huynh hiện có được dùng lại; thông tin phụ huynh vừa nhập không ghi đè hồ sơ đó.",
    );
    expect(within(warning).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      `/students/${QUANG_ID}?search=An`,
      `/students/${AN_ID}?search=An`,
    ]);
    expect(screen.queryByRole("region", { name: "Xác nhận tiếp tục lưu" })).not.toBeInTheDocument();

    // A changed key hides the result until the next lookup.
    type("Số điện thoại", "0905 123 457");
    expect(screen.queryByText("Số điện thoại này đã thuộc phụ huynh Nguyễn Thị Thu")).not.toBeInTheDocument();

    findDuplicates.mockResolvedValue({ guardian: null, hasExactStudentDuplicate: false, ok: true });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra hồ sơ trùng" }));
    expect(await screen.findByText("Không tìm thấy phụ huynh hoặc học sinh trùng theo số điện thoại này.")).toBeInTheDocument();

    findDuplicates.mockResolvedValue({ message: "Không thể kết nối tới hệ thống kiểm tra trùng hồ sơ.", ok: false });
    type("Số điện thoại", "0905 123 458");
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra hồ sơ trùng" }));
    const failure = await waitFor(() => bannerWith("Chưa kiểm tra được hồ sơ trùng."));
    expect(section("Phụ huynh chính")).toContainElement(failure);
    expect(failure).toHaveTextContent("Không thể kết nối tới hệ thống kiểm tra trùng hồ sơ.");
  });

  it("on edit, says the student's own guardian is updated and never lists the student itself", async () => {
    findDuplicates.mockResolvedValue({
      guardian: { ...guardian, children: [{ ...quang, fullName: "Phạm Minh Khang", id: EDIT_ID, publicCode: "TV-2025-00042" }, an], fullName: "Trần Thị Hoa", phone: "0912345678" },
      hasExactStudentDuplicate: false,
      ok: true,
    });
    renderEdit();
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra hồ sơ trùng" }));

    const info = await waitFor(() => bannerWith("Số điện thoại của phụ huynh chính hiện tại: Trần Thị Hoa"));
    expect(info).toHaveTextContent(
      "Số điện thoại của phụ huynh chính hiện tại: Trần Thị Hoa. Khi lưu, hồ sơ phụ huynh này được cập nhật theo thông tin vừa nhập (dùng chung với Lý Minh An (TV-2026-00102)).",
    );
    expect(info).not.toHaveTextContent("Phạm Minh Khang");
    expect(findDuplicates).toHaveBeenCalledWith({ birthYear: 2012, fullName: "Phạm Minh Khang", guardianPhone: "0912345678", studentId: EDIT_ID });

    // Another family's phone: the reuse warning instead.
    findDuplicates.mockResolvedValue({ guardian: { ...guardian, children: [quang] }, hasExactStudentDuplicate: false, ok: true });
    type("Số điện thoại", "0905123456");
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra hồ sơ trùng" }));
    expect(await waitFor(() => bannerWith("Số điện thoại này đã thuộc phụ huynh Nguyễn Thị Thu"))).toHaveTextContent("của Lý Nhật Quang (TV-2024-00088). Khi lưu");
  });

  it("saves an edit through the update action and returns to the profile", async () => {
    renderEdit();
    type("Lý do cập nhật hồ sơ", "Cập nhật theo xác nhận của phụ huynh.");
    expect(bar()).toHaveTextContent("1 thay đổi chưa lưu");
    expect(bar()).toHaveTextContent("Lý do cập nhật hồ sơ");
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/students/${EDIT_ID}?search=An`));
    expect(updateStudent).toHaveBeenCalledWith(expect.objectContaining({ reason: "Cập nhật theo xác nhận của phụ huynh.", studentId: EDIT_ID }));
    expect(createStudent).not.toHaveBeenCalled();
  });

  it("shows a server error above the bar and keeps the typed values and field errors", async () => {
    createStudent.mockResolvedValue({
      fieldErrors: { guardianPhone: ["Số điện thoại cần là số Việt Nam hợp lệ, ví dụ 0901234125."] },
      message: "Vui lòng kiểm tra lại thông tin học viên và phụ huynh.",
      status: "error",
    });
    renderCreate();
    fillValidCreate();
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu học sinh" }));

    const alert = await within(bar()).findByRole("alert");
    expect(alert).toHaveTextContent("Chưa lưu được hồ sơ. Vui lòng kiểm tra lại thông tin học viên và phụ huynh.");
    expect(screen.getByLabelText("Họ và tên")).toHaveValue("Nguyễn Gia Hân");
    expect(screen.getByLabelText("Lý do tạo hồ sơ")).toHaveValue("Phụ huynh đăng ký tư vấn.");
    expect(screen.getByLabelText("Số điện thoại")).toHaveAttribute("aria-invalid", "true");
    expect(bar()).toHaveTextContent("Đang nhập · 1 lỗi cần sửa");
    expect(bar()).toHaveTextContent("Số điện thoại phụ huynh");
    expect(router.push).not.toHaveBeenCalled();

    // A rejected call (network) never escapes: the bar explains, values stay.
    createStudent.mockRejectedValue(new Error("network"));
    type("Số điện thoại", "0987 654 322");
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu học sinh" }));
    await waitFor(() => expect(within(bar()).getByRole("alert")).toHaveTextContent("Không thể kết nối tới hệ thống lưu hồ sơ. Vui lòng thử lại."));
    expect(screen.getByLabelText("Họ và tên")).toHaveValue("Nguyễn Gia Hân");
  });

  it("focuses the first invalid field in page order and names the errors in the bar without disabling save", async () => {
    renderCreate();
    // birthYear sorts before fullName in the schema (and in the errors object); fullName comes first on the page.
    type("Năm sinh", "1980");
    const save = within(bar()).getByRole("button", { name: "Lưu học sinh" });
    fireEvent.click(save);

    const fullName = screen.getByLabelText("Họ và tên");
    await waitFor(() => expect(fullName).toHaveFocus());
    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: "center" }));
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(fullName);
    expect(findDuplicates).not.toHaveBeenCalled();
    expect(createStudent).not.toHaveBeenCalled();

    expect(bar()).toHaveTextContent("Đang nhập · 6 lỗi cần sửa");
    expect(bar()).toHaveTextContent("Họ và tên");
    expect(bar().querySelector("[data-tone]")).toHaveAttribute("data-tone", "danger");
    expect(save).toBeEnabled();

    // Every errored control carries aria-invalid and points at its message.
    for (const [label, id] of [
      ["Họ và tên", "fullName"],
      ["Năm sinh", "birthYear"],
      ["Họ tên phụ huynh", "guardianFullName"],
      ["Quan hệ với học viên", "guardianRelationship"],
      ["Số điện thoại", "guardianPhone"],
      ["Lý do tạo hồ sơ", "reason"],
    ]) {
      const control = screen.getByLabelText(label);
      expect(control, label).toHaveAttribute("aria-invalid", "true");
      expect(control, label).toHaveAttribute("aria-describedby", `${id}-error`);
      expect(document.getElementById(`${id}-error`), label).not.toBeEmptyDOMElement();
    }
    expect(tocNames()).toEqual(["Hồ sơ: 2 lỗi", "Phụ huynh chính: 3 lỗi", "Lý do thao tác: 1 lỗi"]);

    // With the earlier fields fixed, focus goes to the next one down the page.
    type("Họ và tên", "Nguyễn Gia Hân");
    type("Năm sinh", "2013");
    type("Họ tên phụ huynh", "Đỗ Thị Lan");
    fireEvent.click(save);
    await waitFor(() => expect(screen.getByLabelText("Quan hệ với học viên")).toHaveFocus());
    expect(bar()).toHaveTextContent("Đang nhập · 3 lỗi cần sửa");
  });

  it("'Lưu và thêm tiếp' saves with the same action, resets to an empty form, shows the new profile link and stays", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderCreate();
    fillValidCreate();
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu và thêm tiếp" }));

    const banner = await waitFor(() => bannerWith("Đã tạo hồ sơ TV-2026-00123."));
    expect(banner).toHaveAttribute("role", "status");
    expect(within(banner).getByRole("link", { name: "Mở hồ sơ" })).toHaveAttribute("href", "/students/new-id?search=An");
    expect(findDuplicates.mock.invocationCallOrder[0]).toBeLessThan(createStudent.mock.invocationCallOrder[0]);
    expect(createStudent).toHaveBeenCalledWith(expect.objectContaining({ fullName: "Nguyễn Gia Hân", reason: "Phụ huynh đăng ký tư vấn." }));
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();

    expect(screen.getByLabelText("Họ và tên")).toHaveValue("");
    expect(screen.getByLabelText("Họ tên phụ huynh")).toHaveValue("");
    expect(screen.getByLabelText("Lý do tạo hồ sơ")).toHaveValue("");
    expect(bar()).toHaveTextContent("Chưa có thay đổi");
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    await waitFor(() => expect(screen.getByLabelText("Họ và tên")).toHaveFocus());
    expect(tocNames()).toEqual(["Hồ sơ: 4/9 · thiếu 1", "Phụ huynh chính: 0/6 · thiếu 3", "Lý do thao tác: thiếu 1"]);
  });

  it("asks before leaving with unsaved edits (Hủy, header link, reload) and leaves at once when clean", async () => {
    renderCreate();
    const unload = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(unload()).toBe(false);

    type("Họ và tên", "Nguyễn Gia Hân");
    expect(unload()).toBe(true);

    fireEvent.click(within(bar()).getByRole("button", { name: "Hủy" }));
    let dialog = screen.getByRole("dialog", { name: "Thay đổi chưa lưu sẽ mất" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ở lại" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Họ và tên")).toHaveValue("Nguyễn Gia Hân");

    const back = screen.getByRole("link", { name: "Về danh sách" });
    const click = new MouseEvent("click", { bubbles: true, button: 0, cancelable: true });
    act(() => {
      back.dispatchEvent(click);
    });
    expect(click.defaultPrevented).toBe(true);
    dialog = screen.getByRole("dialog", { name: "Thay đổi chưa lưu sẽ mất" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Rời trang" }));
    expect(router.push).toHaveBeenCalledWith("/students?search=An");

    // A clean form has no Hủy; reverting the edit makes it clean again and reload no longer asks.
    type("Họ và tên", "");
    expect(within(bar()).queryByRole("button", { name: "Hủy" })).not.toBeInTheDocument();
    expect(unload()).toBe(false);
  });

  it("keeps the touched files on the design tokens and off the legacy form controls", () => {
    const files = [
      "src/features/students/form/student-form-page.tsx",
      "src/features/students/form/components/student-profile-form.tsx",
      "src/features/students/form/components/student-profile-sections.tsx",
      "src/features/students/form/student-form-toc.ts",
      "src/features/students/form/student-form-action-overrides.ts",
      "src/features/students/form/student-form-route-copy.ts",
      "src/app/(app)/students/new/loading.tsx",
      "src/app/dev/forms/student-form-preview.tsx",
      "src/app/dev/forms/student-form-fixtures.ts",
    ];
    const forbidden =
      /outline-none|focus:ring|focus-visible:ring|\b(text-ink[\w-]*|border-hairline[\w-]*|bg-surface-[12]|bg-canvas|shadow-card|font-display|bg-white|text-primary|bg-primary)\b|#[0-9a-fA-F]{3,8}\b/;

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(forbidden);
      expect(source, file).not.toMatch(/\bTTV\b/);
      expect(source, file).not.toMatch(/form-controls|unsaved-changes-dialog/);
    }
  });
});

// Value (extension, ship audit of step 15a): protects=the write never runs unless the save's own duplicate lookup answered (a lookup error or a rejected lookup stops the save with "Chưa lưu được hồ sơ." above the bar, typed values kept), and the page holds still while work is in flight: during "Kiểm tra hồ sơ trùng" the save and "Lưu và thêm tiếp" wait with the reason "Đang kiểm tra hồ sơ trùng…"; during a save every bar button and the lookup button are disabled ("Đang lưu…"), a second click sends nothing, the header link neither navigates nor opens the leave dialog, and reload/close warns; once the save lands the profile opens exactly once and reload no longer warns;
// fails_when=submitValues falls through to create/update after a failed or rejected lookup, the bar stops receiving isSubmitting (a second write becomes possible), the header link or Hủy leaves mid-save (the save would then navigate on its own later), useSaveInFlightGuard is dropped, or the lookup-in-flight block on save disappears;
// why_new=the existing cases only resolve the lookup and the write at once (no in-flight state is ever rendered) and never fail the lookup during a save; the /dev preview's dirty save cannot tell a lookup error from the write stub (both answer the same message);
// seam=none (same next/navigation and actions-module mocks as above; the mocks return pending promises the test settles by hand); no_claim=the server-side lookup itself, browser implicit-submit rules, or the sidebar/back-button navigation the leave guard does not intercept
describe("StudentProfileForm in-flight and lookup-failure safety", () => {
  const unload = () => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };

  it("never writes when the save's own duplicate lookup fails or rejects, and says why above the bar", async () => {
    renderCreate();
    fillValidCreate();
    const save = within(bar()).getByRole("button", { name: "Lưu học sinh" });

    findDuplicates.mockResolvedValueOnce({ message: "Database trả về kết quả kiểm tra trùng không hợp lệ.", ok: false });
    fireEvent.click(save);
    expect(await within(bar()).findByRole("alert")).toHaveTextContent(
      "Chưa lưu được hồ sơ. Database trả về kết quả kiểm tra trùng không hợp lệ.",
    );
    expect(findDuplicates).toHaveBeenCalledTimes(1);
    expect(createStudent).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Họ và tên")).toHaveValue("Nguyễn Gia Hân");

    findDuplicates.mockRejectedValueOnce(new Error("network"));
    fireEvent.click(save);
    await waitFor(() =>
      expect(within(bar()).getByRole("alert")).toHaveTextContent("Chưa lưu được hồ sơ. Không thể kết nối tới hệ thống kiểm tra trùng hồ sơ."),
    );
    expect(findDuplicates).toHaveBeenCalledTimes(2);
    expect(createStudent).not.toHaveBeenCalled();
    expect(updateStudent).not.toHaveBeenCalled();
    // The bar is usable again for a retry.
    expect(save).toBeEnabled();
    expect(screen.getByLabelText("Lý do tạo hồ sơ")).toHaveValue("Phụ huynh đăng ký tư vấn.");
  });

  it("holds the page while a lookup or a save is in flight: one write, no leaving mid-save, reload warns", async () => {
    let settleLookup!: (result: Awaited<ReturnType<typeof findStudentFormDuplicatesAction>>) => void;
    findDuplicates.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settleLookup = resolve;
        }),
    );
    renderCreate();
    fillValidCreate();
    const save = within(bar()).getByRole("button", { name: "Lưu học sinh" });

    // "Kiểm tra hồ sơ trùng" running: both save actions wait for it, with the reason.
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra hồ sơ trùng" }));
    await waitFor(() => expect(save).toBeDisabled());
    expect(save).toHaveAccessibleDescription("Đang kiểm tra hồ sơ trùng…");
    expect(within(bar()).getByRole("button", { name: "Lưu và thêm tiếp" })).toBeDisabled();
    await act(async () => settleLookup({ guardian: null, hasExactStudentDuplicate: false, ok: true }));
    expect(save).toBeEnabled();

    let settleCreate!: (state: StudentFormActionState) => void;
    createStudent.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settleCreate = resolve;
        }),
    );
    fireEvent.click(save);
    await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(1));

    const saving = within(bar()).getByRole("button", { name: "Đang lưu…" });
    expect(saving).toBeDisabled();
    expect(within(bar()).getByRole("button", { name: "Lưu và thêm tiếp" })).toBeDisabled();
    expect(within(bar()).getByRole("button", { name: "Hủy" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Kiểm tra hồ sơ trùng" })).toBeDisabled();
    fireEvent.click(saving);

    // The header link neither leaves nor asks while the save runs; reload/close warns.
    const back = screen.getByRole("link", { name: "Về danh sách" });
    expect(back).toHaveAttribute("aria-disabled", "true");
    const click = new MouseEvent("click", { bubbles: true, button: 0, cancelable: true });
    act(() => {
      back.dispatchEvent(click);
    });
    expect(click.defaultPrevented).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
    expect(unload()).toBe(true);

    await act(async () => settleCreate(created));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/students/new-id?search=An"));
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(createStudent).toHaveBeenCalledTimes(1);
    // One lookup for the check, one for the save.
    expect(findDuplicates).toHaveBeenCalledTimes(2);
    // Saved: nothing left to lose, so reload no longer warns.
    expect(unload()).toBe(false);
  });
});

// Value (extension, review fixes of step 15a): protects=typing re-renders only the table of contents (the sections render once per form render, not per keystroke); after "Lưu và thêm tiếp" the next record validates on blur like the first (no error while typing the first digit); the sections are disabled while a save runs (no edit typed then is lost) and come back with the typed values, focus returning to a field the save disabled; a stale override-reason error stops counting once the exact duplicate no longer applies; each "Hình thức đăng ký" option is itself 44px below md / 40px from md;
// fails_when=the form watches every field at its root again, the save-and-add reset runs inside handleSubmit (RHF then marks the fresh form submitted), the fieldset around the sections is dropped or wraps the save bar, the focus hand-back after a save is dropped, the duplicateOverrideReason filter is removed together with the error clear when the confirmation hides (cycle 5: either alone still hides the stale error), or the min-height moves back onto the bordered group;
// why_new=review findings P3, R2, R4, T1 and D1 of step 15a: none of these was rendered by the cases above;
// seam=ProfileField is the real component wrapped in vi.fn (render count); the other mocks as above; jsdom never drops focus from a control that becomes disabled, so the test moves focus away as a browser would; no_claim=the real paint cost of a keystroke, pixel heights (class names only) or browser focus-fixup timing
describe("StudentProfileForm review fixes", () => {
  it("re-renders only the table of contents while typing in a field the form itself does not read", () => {
    renderEdit();
    const province = screen.getByLabelText("Tỉnh/thành phố");
    // The first edit makes the field dirty: the bar, and so the form, renders once more.
    fireEvent.change(province, { target: { value: "Hà" } });
    expect(bar()).toHaveTextContent("1 thay đổi chưa lưu");
    const rendersBefore = profileFieldRenders.mock.calls.length;
    expect(rendersBefore).toBeGreaterThan(0);

    fireEvent.change(province, { target: { value: "" } });
    fireEvent.change(province, { target: { value: "Đà Nẵng" } });
    fireEvent.change(province, { target: { value: "" } });

    // The table of contents follows every keystroke...
    expect(within(toc()).getAllByRole("link")[0]).toHaveAccessibleName("Hồ sơ: 5/9 · đủ");
    expect(province).toHaveValue("");
    // ...while no field of the sections rendered again.
    expect(profileFieldRenders.mock.calls.length).toBe(rendersBefore);
  });

  it("starts the record after 'Lưu và thêm tiếp' fresh: a field validates on blur again, not on the first keystroke", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderCreate();
    fillValidCreate();
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu và thêm tiếp" }));
    await waitFor(() => bannerWith("Đã tạo hồ sơ TV-2026-00123."));
    await waitFor(() => expect(screen.getByLabelText("Họ và tên")).toHaveFocus());

    const phone = screen.getByLabelText("Số điện thoại");
    fireEvent.change(phone, { target: { value: "0" } });
    // Give a keystroke validation (the resolver is async) every chance to land.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(phone).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByText("Số điện thoại cần là số di động Việt Nam hợp lệ.")).not.toBeInTheDocument();
    expect(bar()).toHaveTextContent("1 thay đổi chưa lưu");

    fireEvent.blur(phone);
    await waitFor(() => expect(phone).toHaveAttribute("aria-invalid", "true"));
    expect(document.getElementById("guardianPhone-error")).toHaveTextContent("Số điện thoại cần là số di động Việt Nam hợp lệ.");
  });

  it("disables the sections (not the bar) while a save runs, then gives them back with the typed values", async () => {
    let settleCreate!: (state: StudentFormActionState) => void;
    createStudent.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settleCreate = resolve;
        }),
    );
    renderCreate();
    fillValidCreate();
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu học sinh" }));
    await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(1));

    const fullName = screen.getByLabelText("Họ và tên");
    for (const label of ["Họ và tên", "Năm sinh", "Khối hiện tại", "Số điện thoại", "Quan hệ với học viên", "Lý do tạo hồ sơ"]) {
      expect(screen.getByLabelText(label), label).toBeDisabled();
    }
    for (const radio of within(screen.getByRole("radiogroup", { name: "Hình thức đăng ký" })).getAllByRole("radio")) {
      expect(radio).toBeDisabled();
    }
    // No layout change: the fieldset draws no box; the bar (with "Đang lưu…") stays outside it.
    const sections = fullName.closest("fieldset");
    expect(sections).toHaveClass("contents");
    expect(sections).not.toContainElement(bar());
    expect(within(bar()).getByRole("button", { name: "Đang lưu…" })).toBeInTheDocument();

    await act(async () => settleCreate({ message: "Vui lòng thử lại.", status: "error" }));
    await waitFor(() => expect(fullName).toBeEnabled());
    expect(fullName).toHaveValue("Nguyễn Gia Hân");
    expect(screen.getByLabelText("Lý do tạo hồ sơ")).toHaveValue("Phụ huynh đăng ký tư vấn.");
    expect(screen.getByRole("radio", { name: "Offline" })).toBeEnabled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("gives focus back to the field a save disabled (Enter in a field), once the save has failed", async () => {
    let settleCreate!: (state: StudentFormActionState) => void;
    createStudent.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settleCreate = resolve;
        }),
    );
    renderCreate();
    fillValidCreate();
    const fullName = screen.getByLabelText("Họ và tên");
    fullName.focus();
    // Enter in a text field submits the form.
    fireEvent.submit(fullName.closest("form")!);
    await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(1));
    expect(fullName).toBeDisabled();

    // A browser drops focus from a control that becomes disabled; jsdom keeps it, so move it away by hand.
    const tocLink = within(toc()).getAllByRole("link")[0];
    act(() => {
      tocLink.focus();
      tocLink.blur();
    });
    expect(document.activeElement).toBe(document.body);

    await act(async () => settleCreate({ message: "Vui lòng thử lại.", status: "error" }));
    await waitFor(() => expect(fullName).toHaveFocus());
    expect(within(bar()).getByRole("alert")).toHaveTextContent("Chưa lưu được hồ sơ. Vui lòng thử lại.");
  });

  it("stops counting the override reason's error once the exact duplicate no longer applies", async () => {
    findDuplicates.mockResolvedValue({
      guardian: { ...guardian, children: [{ ...quang, isExactDuplicate: true }] },
      hasExactStudentDuplicate: true,
      ok: true,
    });
    renderCreate();
    fillValidCreate();
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu học sinh" }));

    await screen.findByRole("region", { name: "Xác nhận tiếp tục lưu" });
    await waitFor(() => expect(bar()).toHaveTextContent("Đang nhập · 1 lỗi cần sửa"));
    expect(bar()).toHaveTextContent("Lý do vẫn tạo hoặc cập nhật hồ sơ");

    // Another guardian phone: the duplicate result (and its section) no longer apply, though RHF still holds the reason's error.
    type("Số điện thoại", "0987 654 322");
    await waitFor(() => expect(screen.queryByRole("region", { name: "Xác nhận tiếp tục lưu" })).not.toBeInTheDocument());
    expect(bar()).not.toHaveTextContent("lỗi cần sửa");
    expect(bar()).not.toHaveTextContent("Lý do vẫn tạo hoặc cập nhật hồ sơ");
    expect(bar()).toHaveTextContent("5 thay đổi chưa lưu");
    expect(bar().querySelector("[data-tone]")).not.toHaveAttribute("data-tone", "danger");
    expect(tocNames()).toEqual(["Hồ sơ: 5/9 · đủ", "Phụ huynh chính: 3/6 · đủ", "Lý do thao tác: đủ"]);
    expect(createStudent).not.toHaveBeenCalled();
  });

  it("makes each 'Hình thức đăng ký' option itself 44px tall below md and 40px from md", () => {
    renderCreate();
    const group = screen.getByRole("radiogroup", { name: "Hình thức đăng ký" });
    // The group's 1px border sits inside a min-height on the group: its options would be 42px / 38px.
    expect(group.className).not.toMatch(/(^|\s)(md:)?min-h-/);
    const options = within(group).getAllByRole("radio");
    expect(options).toHaveLength(2);
    for (const option of options) {
      expect(option).toHaveClass("min-h-11", "md:min-h-10");
    }
  });
});

// Value (extension, cycle-2 review fixes of step 15a): protects=keyboard and screen-reader users keep their place when a save fails: a save started from "Lưu học sinh" or "Lưu và thêm tiếp" (both disabled while it runs, which drops focus to <body>) hands focus back to that button once a lookup failure or a server error ends it, and to the "Chưa lưu được hồ sơ." banner when the button is gone; fields the server rejects take focus like a client-side invalid submit (first in page order); the "Mở hồ sơ" link of the success banner is a 44px tap target below md;
// fails_when=rememberFocusBeforeSubmit only looks inside the sections again, the hand-back after a save is dropped or loses its banner fallback (or the banner wrapper loses tabIndex -1), the server's fieldErrors stop requesting focus (or focus them in errors-object order), or the link loses min-h-11;
// why_new=review findings RT2-3, C2-5 and C2-6 of step 15a: the cases above only hand focus back to a field (Enter), never to a save-bar button or the banner, and never focus a server-rejected field;
// seam=same mocks as above; jsdom never drops focus from a control that becomes disabled, so the tests move focus to <body> by hand as a browser would; no UI path removes the save button mid-save today, so the banner fallback is reached by detaching the button by hand; no_claim=browser focus-fixup timing, screen-reader announcement order, pixel heights (class names only)
describe("StudentProfileForm cycle-2 review fixes", () => {
  /** A browser drops focus from a control that becomes disabled; jsdom keeps it (and will not blur a disabled control). */
  function dropFocusToBody() {
    const tocLink = within(toc()).getAllByRole("link")[0];
    act(() => {
      tocLink.focus();
      tocLink.blur();
    });
    expect(document.activeElement).toBe(document.body);
  }

  it("gives focus back to 'Lưu học sinh' when the save's lookup fails", async () => {
    let settleLookup!: (result: Awaited<ReturnType<typeof findStudentFormDuplicatesAction>>) => void;
    findDuplicates.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settleLookup = resolve;
        }),
    );
    renderCreate();
    fillValidCreate();
    const save = within(bar()).getByRole("button", { name: "Lưu học sinh" });
    save.focus();
    fireEvent.click(save);
    await waitFor(() => expect(findDuplicates).toHaveBeenCalledTimes(1));
    expect(save).toBeDisabled();
    dropFocusToBody();

    await act(async () => settleLookup({ message: "Không thể kết nối tới hệ thống kiểm tra trùng hồ sơ.", ok: false }));
    await waitFor(() => expect(save).toHaveFocus());
    expect(save).toHaveAccessibleName("Lưu học sinh");
    expect(within(bar()).getByRole("alert")).toHaveTextContent("Chưa lưu được hồ sơ. Không thể kết nối tới hệ thống kiểm tra trùng hồ sơ.");
    expect(createStudent).not.toHaveBeenCalled();
  });

  it("gives focus back to 'Lưu và thêm tiếp' when its save fails on the server", async () => {
    let settleCreate!: (state: StudentFormActionState) => void;
    createStudent.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settleCreate = resolve;
        }),
    );
    renderCreate();
    fillValidCreate();
    const saveAndAdd = within(bar()).getByRole("button", { name: "Lưu và thêm tiếp" });
    saveAndAdd.focus();
    fireEvent.click(saveAndAdd);
    await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(1));
    expect(saveAndAdd).toBeDisabled();
    dropFocusToBody();

    await act(async () => settleCreate({ message: "Vui lòng thử lại.", status: "error" }));
    await waitFor(() => expect(saveAndAdd).toHaveFocus());
    expect(within(bar()).getByRole("alert")).toHaveTextContent("Chưa lưu được hồ sơ. Vui lòng thử lại.");
    expect(screen.getByLabelText("Họ và tên")).toHaveValue("Nguyễn Gia Hân");
    expect(screen.queryByText(/^Đã tạo hồ sơ/)).not.toBeInTheDocument();
  });

  it("moves focus to the save error when the button the save started from is gone", async () => {
    let settleCreate!: (state: StudentFormActionState) => void;
    createStudent.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          settleCreate = resolve;
        }),
    );
    renderCreate();
    fillValidCreate();
    const save = within(bar()).getByRole("button", { name: "Lưu học sinh" });
    save.focus();
    fireEvent.click(save);
    await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(1));
    dropFocusToBody();
    save.remove();

    await act(async () => settleCreate({ message: "Vui lòng thử lại.", status: "error" }));
    const alert = within(bar()).getByRole("alert");
    await waitFor(() => expect(document.activeElement).toContainElement(alert));
    expect(document.activeElement).toHaveAttribute("tabindex", "-1");
    expect(alert).toHaveTextContent("Chưa lưu được hồ sơ. Vui lòng thử lại.");
  });

  it("focuses the first field the server rejects, in page order", async () => {
    createStudent.mockResolvedValue({
      // Errors-object order puts reason first; on the page the phone comes first.
      fieldErrors: {
        reason: ["Lý do cần ít nhất 10 ký tự."],
        guardianPhone: ["Số điện thoại cần là số Việt Nam hợp lệ, ví dụ 0901234125."],
      },
      message: "Vui lòng kiểm tra lại thông tin học viên và phụ huynh.",
      status: "error",
    });
    renderCreate();
    fillValidCreate();
    const save = within(bar()).getByRole("button", { name: "Lưu học sinh" });
    // A keyboard user: focus starts on the save button, and the rejected field still wins.
    save.focus();
    fireEvent.click(save);

    const phone = screen.getByLabelText("Số điện thoại");
    await waitFor(() => expect(phone).toHaveFocus());
    expect(phone).toHaveAttribute("aria-invalid", "true");
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(phone);
    expect(screen.getByLabelText("Lý do tạo hồ sơ")).toHaveAttribute("aria-invalid", "true");
    expect(within(bar()).getByRole("alert")).toHaveTextContent("Chưa lưu được hồ sơ. Vui lòng kiểm tra lại thông tin học viên và phụ huynh.");
    expect(bar()).toHaveTextContent("Đang nhập · 2 lỗi cần sửa");
  });

  it("makes the 'Mở hồ sơ' link of the success banner a 44px tap target below md, inline from md", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    renderCreate();
    fillValidCreate();
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu và thêm tiếp" }));

    const banner = await waitFor(() => bannerWith("Đã tạo hồ sơ TV-2026-00123."));
    expect(within(banner).getByRole("link", { name: "Mở hồ sơ" })).toHaveClass("inline-flex", "min-h-11", "items-center", "md:min-h-0");
  });
});

// Value (extension, cycle-5 review fix AD2 of step 15a): protects=the override reason belongs to the exact duplicate the user saw when typing it: once the lookup key changes and "Xác nhận tiếp tục lưu" hides, the reason is emptied (a later save sends "" and coming back to the same identity asks again); a save whose own lookup finds another exact duplicate (after a key change, or the same key now matching another student) never writes with the earlier reason, shows the section for the new duplicate and focuses its empty reason, in create and edit;
// fails_when=the reason survives the section hiding, coming back to the first identity silently restores it, or the save passes the earlier reason once the lookup names another exact duplicate than the one on screen when the save started;
// why_new=review finding AD2 of step 15a: every duplicate case above types the reason for the duplicate it then saves, never one whose key or exact match changed in between;
// seam=same mocks as above; the lookup mock answers by guardian phone (A = Lý Nhật Quang at 0987 654 321, B = Lý Minh An at 0987 654 322) or once per call; a reason left in RHF while its section is hidden is read through what the write receives and the bar's dirty count; no_claim=the RPC's own required-reason check or the audit rows it writes
describe("StudentProfileForm cycle-5 review fixes", () => {
  const REASON_FIELD = "Lý do vẫn tạo hoặc cập nhật hồ sơ";
  const EXACT_BANNER = "Đã có học sinh trùng họ tên, năm sinh và số điện thoại phụ huynh:";

  function exactDuplicateOf(student: typeof quang): Awaited<ReturnType<typeof findStudentFormDuplicatesAction>> {
    return { guardian: { ...guardian, children: [{ ...student, isExactDuplicate: true }] }, hasExactStudentDuplicate: true, ok: true };
  }

  const confirmation = () => screen.queryByRole("region", { name: "Xác nhận tiếp tục lưu" });

  it("empties the override reason once the duplicate it was written for no longer applies", async () => {
    findDuplicates.mockResolvedValue(exactDuplicateOf(quang));
    renderCreate();
    fillValidCreate();
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra hồ sơ trùng" }));
    await screen.findByRole("region", { name: "Xác nhận tiếp tục lưu" });
    type(REASON_FIELD, "Hai anh em sinh đôi, khác hồ sơ.");
    expect(bar()).toHaveTextContent("6 thay đổi chưa lưu");

    // Another guardian phone: the section hides and takes its reason with it.
    findDuplicates.mockResolvedValue({ guardian: null, hasExactStudentDuplicate: false, ok: true });
    type("Số điện thoại", "0987 654 322");
    await waitFor(() => expect(confirmation()).not.toBeInTheDocument());
    expect(bar()).toHaveTextContent("5 thay đổi chưa lưu");
    expect(bar()).not.toHaveTextContent(REASON_FIELD);

    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu học sinh" }));
    await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(1));
    expect(createStudent.mock.calls[0][0]).toMatchObject({ duplicateOverrideReason: "", guardianPhone: "0987 654 322" });
  });

  it("asks again for a duplicate found at save after a key change (A then B), never passing A's reason", async () => {
    findDuplicates.mockImplementation(async ({ guardianPhone }) =>
      exactDuplicateOf(guardianPhone.replace(/\s/g, "") === "0987654322" ? an : quang),
    );
    renderCreate();
    fillValidCreate();
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu học sinh" }));
    await screen.findByRole("region", { name: "Xác nhận tiếp tục lưu" });
    type(REASON_FIELD, "Trùng tên với Quang nhưng là học sinh khác.");
    await waitFor(() => expect(screen.getByLabelText(REASON_FIELD)).not.toHaveAttribute("aria-invalid"));

    type("Số điện thoại", "0987 654 322");
    await waitFor(() => expect(confirmation()).not.toBeInTheDocument());
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu học sinh" }));

    await waitFor(() => expect(findDuplicates).toHaveBeenCalledTimes(2));
    const section = await screen.findByRole("region", { name: "Xác nhận tiếp tục lưu" });
    const reasonField = within(section).getByLabelText(REASON_FIELD);
    await waitFor(() => expect(reasonField).toHaveFocus());
    expect(createStudent).not.toHaveBeenCalled();
    expect(reasonField).toHaveValue("");
    expect(reasonField).toHaveAttribute("aria-invalid", "true");
    const danger = bannerWith(EXACT_BANNER);
    expect(within(danger).getByRole("link", { name: "Lý Minh An (TV-2026-00102)" })).toBeInTheDocument();
    expect(danger).not.toHaveTextContent("Lý Nhật Quang");

    type(REASON_FIELD, "Hồ sơ mới, khác Lý Minh An.");
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu học sinh" }));
    await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(1));
    expect(createStudent.mock.calls[0][0]).toMatchObject({ duplicateOverrideReason: "Hồ sơ mới, khác Lý Minh An.", guardianPhone: "0987 654 322" });
  });

  it("asks again when the save's lookup names another exact duplicate for the same key than the one on screen", async () => {
    findDuplicates.mockResolvedValueOnce(exactDuplicateOf(quang)).mockResolvedValue(exactDuplicateOf(an));
    renderCreate();
    fillValidCreate();
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra hồ sơ trùng" }));
    await screen.findByRole("region", { name: "Xác nhận tiếp tục lưu" });
    type(REASON_FIELD, "Trùng tên với Quang nhưng là học sinh khác.");

    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu học sinh" }));
    await waitFor(() => expect(findDuplicates).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(bannerWith(EXACT_BANNER)).getByRole("link", { name: "Lý Minh An (TV-2026-00102)" })).toBeInTheDocument());
    const reasonField = screen.getByLabelText(REASON_FIELD);
    await waitFor(() => expect(reasonField).toHaveFocus());
    expect(createStudent).not.toHaveBeenCalled();
    expect(reasonField).toHaveValue("");
    expect(reasonField).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById("duplicateOverrideReason-error")).toHaveTextContent("Cần nhập lý do để tiếp tục.");
  });

  it("does not restore the reason (or its error) when the key comes back to the same duplicate (edit): it is asked again", async () => {
    findDuplicates.mockImplementation(async ({ guardianPhone }) =>
      guardianPhone === "0912345678" ? exactDuplicateOf(quang) : { guardian: null, hasExactStudentDuplicate: false, ok: true },
    );
    renderEdit();
    type("Lý do cập nhật hồ sơ", "Cập nhật theo xác nhận của phụ huynh.");
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(screen.getByLabelText(REASON_FIELD)).toHaveAttribute("aria-invalid", "true"));

    // Away and back before typing: the section comes back without the earlier save's error.
    type("Số điện thoại", "0912345679");
    await waitFor(() => expect(confirmation()).not.toBeInTheDocument());
    type("Số điện thoại", "0912345678");
    await screen.findByRole("region", { name: "Xác nhận tiếp tục lưu" });
    expect(screen.getByLabelText(REASON_FIELD)).not.toHaveAttribute("aria-invalid");
    expect(bar()).not.toHaveTextContent("lỗi cần sửa");

    // Away and back after typing: the reason is not restored.
    type(REASON_FIELD, "Trùng tên với Quang nhưng là học sinh khác.");
    type("Số điện thoại", "0912345679");
    await waitFor(() => expect(confirmation()).not.toBeInTheDocument());
    type("Số điện thoại", "0912345678");
    const section = await screen.findByRole("region", { name: "Xác nhận tiếp tục lưu" });
    expect(within(section).getByLabelText(REASON_FIELD)).toHaveValue("");

    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(findDuplicates).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByLabelText(REASON_FIELD)).toHaveFocus());
    expect(screen.getByLabelText(REASON_FIELD)).toHaveAttribute("aria-invalid", "true");
    expect(updateStudent).not.toHaveBeenCalled();
  });
});

// Value (extension, cycle-6 review fix P6-1 of step 15a): protects=a duplicate lookup that fails (a rejected call or `{ ok: false }`), from a save or from "Kiểm tra hồ sơ trùng", keeps the last successful result on screen: the exact duplicate's notice, "Xác nhận tiếp tục lưu" and the reason typed for it stay, the failure is said (above the bar for a save, in "Phụ huynh chính" for the check) and nothing is written; the retry re-runs the lookup and, finding the same duplicate, saves with that reason;
// fails_when=a failed lookup replaces the result with nothing again (the section hides, the cycle-5 effect empties the reason, and the retry stops on an empty reason), or a failed save lookup falls through to the write;
// why_new=cycle 6 found the retry after a failed lookup blocked with the reason emptied; seam=the lookup mock rejects or answers ok:false once, then answers the same exact duplicate; no_claim=the server-side lookup itself or why it failed
describe("StudentProfileForm cycle-6 review fixes", () => {
  const REASON_FIELD = "Lý do vẫn tạo hoặc cập nhật hồ sơ";
  const EXACT_BANNER = "Đã có học sinh trùng họ tên, năm sinh và số điện thoại phụ huynh:";
  const REASON = "Hai anh em sinh đôi, khác hồ sơ.";
  const exactQuang: Awaited<ReturnType<typeof findStudentFormDuplicatesAction>> = {
    guardian: { ...guardian, children: [{ ...quang, isExactDuplicate: true }] },
    hasExactStudentDuplicate: true,
    ok: true,
  };

  const failures = {
    "ok: false": () => findDuplicates.mockResolvedValueOnce({ message: "Database trả về kết quả kiểm tra trùng không hợp lệ.", ok: false }),
    rejected: () => findDuplicates.mockRejectedValueOnce(new Error("network")),
  } as const;
  const failureMessage = {
    "ok: false": "Database trả về kết quả kiểm tra trùng không hợp lệ.",
    rejected: "Không thể kết nối tới hệ thống kiểm tra trùng hồ sơ.",
  } as const;

  it.each([
    ["the save", "rejected"],
    ["the save", "ok: false"],
    ["'Kiểm tra hồ sơ trùng'", "ok: false"],
    ["'Kiểm tra hồ sơ trùng'", "rejected"],
  ] as const)("keeps the shown duplicate and its typed reason when a lookup from %s fails (%s), and the retry saves with it", async (trigger, failure) => {
    findDuplicates.mockResolvedValue(exactQuang);
    renderCreate();
    fillValidCreate();
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra hồ sơ trùng" }));
    await screen.findByRole("region", { name: "Xác nhận tiếp tục lưu" });
    type(REASON_FIELD, REASON);
    expect(bar()).toHaveTextContent("6 thay đổi chưa lưu");

    failures[failure]();
    if (trigger === "the save") {
      fireEvent.click(within(bar()).getByRole("button", { name: "Lưu học sinh" }));
      await waitFor(() =>
        expect(within(bar()).getByRole("alert")).toHaveTextContent(`Chưa lưu được hồ sơ. ${failureMessage[failure]}`),
      );
    } else {
      fireEvent.click(screen.getByRole("button", { name: "Kiểm tra hồ sơ trùng" }));
      const lookupFailure = await waitFor(() => bannerWith("Chưa kiểm tra được hồ sơ trùng."));
      expect(section("Phụ huynh chính")).toContainElement(lookupFailure);
      expect(lookupFailure).toHaveTextContent(failureMessage[failure]);
    }
    expect(findDuplicates).toHaveBeenCalledTimes(2);
    expect(createStudent).not.toHaveBeenCalled();

    // The last successful result stays: its notice, the section and the reason typed for it.
    await act(async () => {});
    const confirmationSection = screen.getByRole("region", { name: "Xác nhận tiếp tục lưu" });
    expect(within(confirmationSection).getByLabelText(REASON_FIELD)).toHaveValue(REASON);
    expect(within(bannerWith(EXACT_BANNER)).getByRole("link", { name: "Lý Nhật Quang (TV-2024-00088)" })).toBeInTheDocument();
    expect(bar()).toHaveTextContent("6 thay đổi chưa lưu");

    // The retry runs the lookup again; the same exact duplicate is answered by the kept reason.
    fireEvent.click(within(bar()).getByRole("button", { name: "Lưu học sinh" }));
    await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(1));
    expect(findDuplicates).toHaveBeenCalledTimes(3);
    expect(createStudent.mock.calls[0][0]).toMatchObject({ duplicateOverrideReason: REASON, fullName: "Nguyễn Gia Hân" });
  });
});
