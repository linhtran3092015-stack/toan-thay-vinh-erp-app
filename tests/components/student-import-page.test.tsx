// Value: protects=/imports/students as a four-step wizard (design 17c, step 15b lane I1): honest step names with exactly one current step (all done after a commit), one step body at a time, the file read in the browser with facts + "{file} · {n} dòng" context and inline file errors, the template button, the automatic mapping with problems named by field label (per-field marking, primary disabled with its reason), the dry-run sent with the mapped rows, the review table over EVERY row (no 100-row cap) with "Cần xem / Tất cả" chips, words for every severity, the W3 warning wording, an exact duplicate as an error row and the file's raw value when the server could not normalise it, back keeping the file and mapping while a mapping change or a new file drops the later steps, the commit gate of today's panel (students.create, 0 errors, rows match, reason, checkbox, not pending, not committed) as conditions with the disabled reason, all-or-nothing copy, the commit payload, inline failure, "Không rõ kết quả" on a thrown call, and the success view with its two links;
// fails_when=two step bodies render together, a step opens without its data, the stepper gains a second current step, a mapping problem shows a raw field key, the review shows only the first 100 rows, a warning says "mặc định B" or the server's guardian wording, an exact duplicate reads as a warning, a mapping change keeps the old dry-run, a new file keeps the old mapping, the commit runs without one of today's conditions or sends other rows, a failure leaves the page or claims nothing was written after a lost connection, the result links change, or the page starts calling a next/navigation hook (this test installs no next/navigation mock);
// why_new=no test rendered the student import page or its commit panel before step 15b;
// seam=the actions module is mocked (default calls observable) and most tests inject the actions prop; the workbook parser and the template download are mocked (no real xlsx in jsdom); seeding props open later steps; no_claim=the RPCs, the zod schemas, the real workbook parsing (unit tests cover the mapping module) or the visual layout
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as realActions from "@/features/imports/students/actions";
import type { StudentImportActionOverrides } from "@/features/imports/students/student-import-action-overrides";
import { StudentImportPage, type StudentImportPageProps } from "@/features/imports/students/student-import-page";
import { downloadStudentImportTemplate } from "@/features/imports/students/template-browser";
import type {
  StudentImportCommitResult,
  StudentImportParsedWorkbook,
  StudentImportValidationResult,
  StudentImportValidationRow,
} from "@/features/imports/students/types";
import { parseStudentImportWorkbook, StudentImportWorkbookError } from "@/features/imports/students/workbook";

vi.mock("@/features/imports/students/actions", () => ({
  commitStudentImportRowsAction: vi.fn(),
  validateStudentImportRowsAction: vi.fn(),
}));
vi.mock("@/features/imports/students/template-browser", () => ({ downloadStudentImportTemplate: vi.fn() }));
vi.mock("@/features/imports/students/workbook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/imports/students/workbook")>();
  return { ...actual, parseStudentImportWorkbook: vi.fn() };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const SHA = "a".repeat(64);
// Column G has a header no alias matches, so a field can be moved onto it without a clash.
const HEADERS = ["Họ và tên học viên *", "Năm sinh *", "Khối hiện tại *", "Họ và tên phụ huynh *", "Số điện thoại phụ huynh *", "Quan hệ với học viên *", "Ghi chú khác"];

function workbook({
  birthYear,
  phoneHeader = HEADERS[4],
  rows = 3,
}: { birthYear?: (rowNumber: number) => number; phoneHeader?: string; rows?: number } = {}): StudentImportParsedWorkbook {
  const headers = HEADERS.map((header, index) => (index === 4 ? phoneHeader : header));
  return {
    columns: headers.map((header, index) => ({ columnIndex: index + 1, columnKey: String.fromCharCode(65 + index), sourceHeader: header })),
    rowCount: rows,
    rows: Array.from({ length: rows }, (_, index) => ({
      rowNumber: index + 2,
      values: {
        A: `Học sinh ${index + 2}`,
        B: birthYear?.(index + 2) ?? 2014,
        C: 7,
        D: `Phụ huynh ${index + 2}`,
        E: `09120000${String(index).padStart(2, "0")}`,
        F: "Mẹ",
        G: `Ghi chú ${index + 2}`,
      },
    })),
    sheetName: "HocSinh",
    sourceFilename: "hoc-sinh.xlsx",
    sourceSha256: SHA,
  };
}

function row(rowNumber: number, overrides: Partial<StudentImportValidationRow> = {}): StudentImportValidationRow {
  return {
    errors: [],
    exact_student_duplicate: false,
    existing_guardian_id: null,
    guardian_reused: false,
    normalized_data: {
      birth_year: 2014,
      current_grade: 7,
      guardian_email: null,
      guardian_full_name: `Phụ huynh ${rowNumber}`,
      guardian_notes: null,
      guardian_phone: `09120000${String(rowNumber - 2).padStart(2, "0")}`,
      guardian_relationship: "Mẹ",
      guardian_zalo: null,
      internal_notes: null,
      learning_goal: null,
      learning_level: null,
      nickname: null,
      province_city: null,
      registered_mode: null,
      student_full_name: `Học sinh ${rowNumber}`,
    },
    row_number: rowNumber,
    status: "valid",
    warnings: [],
    ...overrides,
  };
}

function result(rows: StudentImportValidationRow[]): StudentImportValidationResult {
  return {
    invalid_count: rows.filter((item) => item.status === "invalid").length,
    row_count: rows.length,
    rows,
    valid_count: rows.filter((item) => item.status === "valid").length,
    warning_count: rows.filter((item) => item.status === "warning").length,
  };
}

const REUSED = { code: "GUARDIAN_WILL_BE_REUSED", field: "guardian_phone", message: "Phụ huynh đã tồn tại và sẽ được dùng lại." };
const cleanResult = () => result([row(2), row(3, { guardian_reused: true, status: "warning", warnings: [REUSED] }), row(4)]);
const errorResult = () =>
  result([
    row(2),
    row(3, { guardian_reused: true, status: "warning", warnings: [REUSED] }),
    row(4, {
      errors: [{ code: "BIRTH_YEAR_INVALID", field: "birth_year", message: "Năm sinh phải gồm 4 chữ số." }],
      normalized_data: { ...row(4).normalized_data, birth_year: null },
      status: "invalid",
    }),
    row(5, {
      errors: [{ code: "EXACT_STUDENT_DUPLICATE", field: "student_full_name", message: "Học viên đã tồn tại với cùng họ tên, năm sinh và số điện thoại phụ huynh." }],
      exact_student_duplicate: true,
      status: "invalid",
    }),
  ]);

const commitResult: StudentImportCommitResult = {
  batch_id: "batch-1",
  committed_at: "2026-10-19T03:15:00.000Z",
  committed_by: "user-1",
  guardian_created_count: 2,
  guardian_reused_count: 1,
  row_count: 3,
  source_filename: "hoc-sinh.xlsx",
  source_sha256: SHA,
  student_count: 3,
  students: [2, 3, 4].map((rowNumber, index) => ({
    guardian_id: `g-${rowNumber}`,
    guardian_reused: rowNumber === 3,
    row_number: rowNumber,
    student_id: `s-${rowNumber}`,
    student_public_code: `TV-2026-0010${index}`,
  })),
};

type Overrides = Required<StudentImportActionOverrides>;

function renderPage(props: Partial<StudentImportPageProps> = {}) {
  const actions = {
    commitStudentImportRows: vi.fn<Overrides["commitStudentImportRows"]>(async () => ({ data: commitResult, ok: true })),
    validateStudentImportRows: vi.fn<Overrides["validateStudentImportRows"]>(async () => ({ data: cleanResult(), ok: true })),
  };
  const view = render(<StudentImportPage actions={actions} canCreateStudents {...props} />);
  return { ...view, actions };
}

const stepper = () => screen.getByRole("list", { name: "Các bước nhập học sinh" });
const stepItems = () => within(stepper()).getAllByRole("listitem");
const currentStep = () => stepItems().find((item) => item.getAttribute("aria-current") === "step");
const describedBy = (element: HTMLElement) =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent)
    .join(" ");
const conditionTexts = () =>
  within(screen.getByRole("region", { name: "Xác nhận nhập học sinh" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);

describe("StudentImportPage wizard", () => {
  it("opens on the file step with the four honest steps, one body and the template button", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Nhập học sinh từ file" })).toBeInTheDocument();
    expect(stepItems().map((item) => item.getAttribute("data-state"))).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
    expect(stepper()).toHaveTextContent("1. Tải mẫu & chọn file");
    expect(stepper()).toHaveTextContent("2. Ánh xạ cột");
    expect(stepper()).toHaveTextContent("3. Kiểm tra dòng");
    expect(stepper()).toHaveTextContent("4. Xác nhận nhập");

    const input = screen.getByLabelText("Chọn file Excel");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", expect.stringContaining(".xlsx"));
    expect(describedBy(input)).toContain("tối đa 500 dòng");

    // Only the file step's body: no mapping selects, no review table, no commit panel.
    expect(screen.queryByLabelText("Họ và tên học viên")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Xác nhận nhập học sinh" })).not.toBeInTheDocument();

    const next = screen.getByRole("button", { name: "Tiếp: Ánh xạ cột" });
    expect(next).toBeDisabled();
    expect(describedBy(next)).toBe("Chọn file Excel trước.");

    fireEvent.click(screen.getByRole("button", { name: "Tải file mẫu .xlsx" }));
    expect(downloadStudentImportTemplate).toHaveBeenCalledTimes(1);
  });

  it("reads the chosen file, shows its facts and the context line, then maps the columns automatically", async () => {
    vi.mocked(parseStudentImportWorkbook).mockResolvedValue(workbook());
    renderPage();

    const file = new File(["x"], "hoc-sinh.xlsx");
    fireEvent.change(screen.getByLabelText("Chọn file Excel"), { target: { files: [file] } });

    expect(await screen.findByText("Tên file")).toBeInTheDocument();
    expect(parseStudentImportWorkbook).toHaveBeenCalledWith(file);
    expect(screen.getByText("hoc-sinh.xlsx · 3 dòng")).toBeInTheDocument();
    expect(screen.getByText("HocSinh")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tiếp: Ánh xạ cột" }));

    expect(currentStep()).toHaveTextContent("2. Ánh xạ cột");
    expect(stepItems()[0]).toHaveAttribute("data-state", "done");
    expect(screen.queryByLabelText("Chọn file Excel")).not.toBeInTheDocument();
    expect(screen.getByText("1 cột trong file chưa dùng.")).toBeInTheDocument();
    expect(screen.getByLabelText("Họ và tên học viên")).toHaveValue("A");
    expect(screen.getByLabelText("Số điện thoại phụ huynh")).toHaveValue("E");
    expect(screen.getByLabelText("Tên thường gọi")).toHaveValue("");
    expect(screen.getByRole("table", { name: "Xem trước các dòng đầu sau khi ánh xạ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kiểm tra 3 dòng" })).toBeEnabled();
  });

  it("shows a file error inside the file step and stays there", async () => {
    vi.mocked(parseStudentImportWorkbook).mockRejectedValue(new StudentImportWorkbookError("invalid_extension", "Import học viên v1 chỉ nhận file .xlsx."));
    renderPage();

    fireEvent.change(screen.getByLabelText("Chọn file Excel"), { target: { files: [new File(["x"], "hoc-sinh.csv")] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Import học viên v1 chỉ nhận file .xlsx.");
    expect(currentStep()).toHaveTextContent("1. Tải mẫu & chọn file");
    expect(screen.getByRole("button", { name: "Tiếp: Ánh xạ cột" })).toBeDisabled();
  });

  it("names mapping problems by field label, marks the field and keeps the check disabled with its reason", () => {
    renderPage({ initialStep: "mapping", initialWorkbook: workbook({ phoneHeader: "Điện thoại" }) });

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("Ánh xạ cột chưa hợp lệ: còn 1 lỗi.");
    expect(banner).toHaveTextContent('Chưa chọn cột cho trường bắt buộc "Số điện thoại phụ huynh".');
    expect(banner).not.toHaveTextContent("guardian_phone");

    const phone = screen.getByLabelText("Số điện thoại phụ huynh");
    expect(phone).toHaveAttribute("aria-invalid", "true");
    expect(describedBy(phone)).toBe("Chưa chọn cột.");

    const check = screen.getByRole("button", { name: "Kiểm tra 3 dòng" });
    expect(check).toBeDisabled();
    expect(describedBy(check)).toBe("Chọn cột cho mọi trường bắt buộc trước khi kiểm tra.");

    fireEvent.change(phone, { target: { value: "E" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kiểm tra 3 dòng" })).toBeEnabled();

    // One column for two fields: both are named.
    fireEvent.change(screen.getByLabelText("Tên thường gọi"), { target: { value: "A" } });
    expect(screen.getByRole("alert")).toHaveTextContent('Cột A đang được chọn cho cả "Họ và tên học viên" và "Tên thường gọi".');
    expect(describedBy(screen.getByLabelText("Tên thường gọi"))).toBe("Cột này đang dùng cho trường khác.");
  });

  it("sends the mapped rows to the dry-run and opens the review on success; a failure stays on the mapping step", async () => {
    const { actions } = renderPage({ initialStep: "mapping", initialWorkbook: workbook() });
    actions.validateStudentImportRows.mockResolvedValueOnce({ code: "forbidden", message: "Tài khoản không có quyền import.", ok: false } as never);

    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra 3 dòng" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tài khoản không có quyền import.");
    expect(currentStep()).toHaveTextContent("2. Ánh xạ cột");
    await waitFor(() => expect(screen.getByRole("button", { name: "Kiểm tra 3 dòng" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra 3 dòng" }));
    await waitFor(() => expect(currentStep()).toHaveTextContent("3. Kiểm tra dòng"));
    expect(actions.validateStudentImportRows).toHaveBeenLastCalledWith({
      rows: [2, 3, 4].map((rowNumber, index) => ({
        birth_year: 2014,
        current_grade: 7,
        guardian_full_name: `Phụ huynh ${rowNumber}`,
        guardian_phone: `09120000${String(index).padStart(2, "0")}`,
        guardian_relationship: "Mẹ",
        row_number: rowNumber,
        student_full_name: `Học sinh ${rowNumber}`,
      })),
    });
    expect(realActions.validateStudentImportRowsAction).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Họ và tên học viên")).not.toBeInTheDocument();
  });

  it("reviews every row with chips, severity words, the W3 warning and duplicates as errors", () => {
    renderPage({ initialDryRun: errorResult(), initialWorkbook: workbook({ birthYear: (rowNumber) => (rowNumber === 4 ? 20013 : 2014), rows: 4 }) });

    expect(currentStep()).toHaveTextContent("3. Kiểm tra dòng");
    const strip = screen.getByLabelText("Kết quả kiểm tra");
    expect(strip).toHaveTextContent("Tổng dòng4");
    expect(strip).toHaveTextContent("Cảnh báo (vẫn nhập được)1");
    expect(strip).toHaveTextContent("Lỗi (phải sửa trong file)2");

    const chips = screen.getByRole("group", { name: "Lọc dòng cần xem" });
    expect(within(chips).getByRole("button", { name: "Cần xem3" })).toHaveAttribute("aria-pressed", "true");
    const table = screen.getByRole("table", { name: "Kết quả kiểm tra 4 dòng" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Dòng",
      "Họ tên",
      "Năm sinh",
      "Khối",
      "Phụ huynh",
      "SĐT",
      "Quan hệ",
      "Vấn đề",
    ]);
    // Errors first (the exact duplicate is one of them), then the warning.
    const bodyRows = within(table).getAllByRole("row").slice(1);
    expect(bodyRows.map((item) => within(item).getAllByRole("cell")[0].textContent)).toEqual(["4", "5", "3"]);
    expect(bodyRows[0]).toHaveTextContent("20013");
    expect(bodyRows[0]).toHaveTextContent("Lỗi: Năm sinh phải gồm 4 chữ số.");
    expect(bodyRows[1]).toHaveTextContent("Lỗi: Học viên đã tồn tại với cùng họ tên, năm sinh và số điện thoại phụ huynh.");
    expect(bodyRows[2]).toHaveTextContent("Cảnh báo: Phụ huynh đã có trong hệ thống và sẽ được dùng lại.");
    expect(screen.queryByText("Phụ huynh đã tồn tại và sẽ được dùng lại.")).not.toBeInTheDocument();
    expect(screen.queryByText(/mặc định B|Nguồn/)).not.toBeInTheDocument();

    fireEvent.click(within(chips).getByRole("button", { name: "Tất cả4" }));
    expect(within(table).getAllByRole("row")).toHaveLength(5);
    expect(within(table).getAllByText("Hợp lệ")).toHaveLength(1);

    const next = screen.getByRole("button", { name: "Tiếp: Xác nhận nhập" });
    expect(next).toBeDisabled();
    expect(describedBy(next)).toBe("Bật khi không còn dòng lỗi.");
    expect(screen.getByText("Còn 2 dòng lỗi. Sửa file Excel rồi chọn lại file; ứng dụng không sửa hay bỏ dòng.")).toBeInTheDocument();
  });

  it("shows all rows of a large dry-run instead of today's first 100", () => {
    const many = result(Array.from({ length: 120 }, (_, index) => row(index + 2)));
    renderPage({ initialDryRun: many });

    expect(screen.getByRole("button", { name: "Tất cả120" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("table", { name: "Kết quả kiểm tra 120 dòng" })).getAllByRole("row")).toHaveLength(121);
    expect(screen.queryByText(/Hiển thị|Đang hiển thị 100/)).not.toBeInTheDocument();
  });

  it("goes back keeping the file and mapping; a mapping change drops the dry-run and a new file drops everything", async () => {
    const { actions } = renderPage({ initialDryRun: cleanResult(), initialWorkbook: workbook() });

    fireEvent.click(screen.getByRole("button", { name: "Quay lại bước Ánh xạ cột" }));
    expect(currentStep()).toHaveTextContent("2. Ánh xạ cột");
    expect(screen.getByLabelText("Họ và tên học viên")).toHaveValue("A");
    // Unchanged mapping: on to the kept result without a second call.
    fireEvent.click(screen.getByRole("button", { name: "Tiếp: Kiểm tra dòng" }));
    expect(currentStep()).toHaveTextContent("3. Kiểm tra dòng");
    expect(actions.validateStudentImportRows).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Quay lại bước Ánh xạ cột" }));
    fireEvent.change(screen.getByLabelText("Tên thường gọi"), { target: { value: "G" } });
    expect(screen.queryByRole("button", { name: "Tiếp: Kiểm tra dòng" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra 3 dòng" }));
    await waitFor(() => expect(actions.validateStudentImportRows).toHaveBeenCalledTimes(1));
    expect(actions.validateStudentImportRows.mock.calls[0]?.[0].rows[0]).toMatchObject({ nickname: "Ghi chú 2" });
    await waitFor(() => expect(currentStep()).toHaveTextContent("3. Kiểm tra dòng"));

    fireEvent.click(screen.getByRole("button", { name: "Quay lại bước Ánh xạ cột" }));
    // The mapping step's back stays disabled until the dry-run transition settles.
    const backToFile = screen.getByRole("button", { name: "Quay lại bước Tải mẫu & chọn file" });
    await waitFor(() => expect(backToFile).toBeEnabled());
    fireEvent.click(backToFile);
    expect(screen.getByText("hoc-sinh.xlsx · 3 dòng")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Chọn file khác" }));

    expect(screen.queryByText("hoc-sinh.xlsx · 3 dòng")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Chọn file Excel")).toBeInTheDocument();
    expect(stepItems().map((item) => item.getAttribute("data-state"))).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
    expect(screen.getByRole("button", { name: "Tiếp: Ánh xạ cột" })).toBeDisabled();
  });

  it("gates the commit on today's conditions with the reason, then commits the mapped rows once", async () => {
    const { actions } = renderPage({ initialDryRun: cleanResult(), initialStep: "confirm", initialWorkbook: workbook() });

    expect(currentStep()).toHaveTextContent("4. Xác nhận nhập");
    expect(screen.getByText(/Ghi toàn bộ/).textContent).toBe("Ghi toàn bộ 3 học sinh trong một lần; nếu máy chủ từ chối thì không ghi dòng nào.");
    expect(conditionTexts()).toEqual([
      "Đạt:Có quyền tạo hồ sơ học sinh",
      "Đạt:0 dòng lỗi",
      "Đạt:Kết quả kiểm tra khớp file đang chọn (3 dòng)",
      "Chưa đạt:Chưa nhập lý do",
      "Chưa đạt:Chưa đánh dấu xác nhận",
    ]);

    const commit = screen.getByRole("button", { name: "Xác nhận nhập 3 học sinh" });
    expect(commit).toBeDisabled();
    expect(describedBy(commit)).toBe("Nhập lý do nhập dữ liệu.");

    fireEvent.change(screen.getByLabelText("Lý do nhập"), { target: { value: "  Nhập học sinh khối 7  " } });
    expect(describedBy(commit)).toBe("Đánh dấu ô xác nhận trước khi nhập.");
    fireEvent.click(screen.getByRole("checkbox", { name: /đồng ý ghi toàn bộ 3 học sinh trong một lần/ }));
    expect(commit).toBeEnabled();
    expect(commit).not.toHaveAttribute("aria-describedby");

    fireEvent.click(commit);
    await screen.findByText("Đã nhập 3 học sinh.");

    expect(actions.commitStudentImportRows).toHaveBeenCalledTimes(1);
    expect(actions.commitStudentImportRows).toHaveBeenCalledWith({
      reason: "Nhập học sinh khối 7",
      rows: expect.arrayContaining([expect.objectContaining({ row_number: 2, student_full_name: "Học sinh 2" })]),
      sourceFilename: "hoc-sinh.xlsx",
      sourceSha256: SHA,
    });
    expect(actions.commitStudentImportRows.mock.calls[0]?.[0].rows).toHaveLength(3);
    expect(realActions.commitStudentImportRowsAction).not.toHaveBeenCalled();

    expect(stepItems().every((item) => item.getAttribute("data-state") === "done")).toBe(true);
    expect(screen.getByText("TV-2026-00100")).toBeInTheDocument();
    expect(screen.getByText("19/10/2026 10:15")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở danh sách học viên" })).toHaveAttribute("href", "/students");
    expect(screen.getByRole("link", { name: "Xem nhật ký thao tác" })).toHaveAttribute("href", "/audit");
    expect(screen.queryByRole("button", { name: /Xác nhận nhập/ })).not.toBeInTheDocument();
  });

  it("keeps the commit off without students.create and when the dry-run no longer matches the file", () => {
    renderPage({ canCreateStudents: false });
    expect(screen.getByText("Chỉ kiểm tra được, chưa nhập được.")).toBeInTheDocument();
    cleanup();

    renderPage({ canCreateStudents: false, initialDryRun: cleanResult(), initialStep: "confirm", initialWorkbook: workbook() });
    expect(conditionTexts()[0]).toBe("Chưa đạt:Chưa có quyền tạo hồ sơ học sinh");
    expect(screen.getByLabelText("Lý do nhập")).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    const commit = screen.getByRole("button", { name: "Xác nhận nhập 3 học sinh" });
    expect(commit).toBeDisabled();
    expect(describedBy(commit)).toBe("Tài khoản này chưa có quyền tạo hồ sơ học sinh.");
    cleanup();

    // A dry-run of four rows against a three-row file (or no file at all).
    renderPage({ initialDryRun: result([row(2), row(3), row(4), row(5)]), initialStep: "confirm", initialWorkbook: workbook() });
    expect(conditionTexts()[2]).toBe("Chưa đạt:Kết quả kiểm tra không khớp file đang chọn");
    fireEvent.change(screen.getByLabelText("Lý do nhập"), { target: { value: "Lý do" } });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Xác nhận nhập 4 học sinh" })).toBeDisabled();
  });

  it("keeps a refused commit inline and says the result is unknown when the call itself fails", async () => {
    const { actions } = renderPage({ initialDryRun: cleanResult(), initialStep: "confirm", initialWorkbook: workbook() });
    actions.commitStudentImportRows
      .mockResolvedValueOnce({ code: "conflict", message: "File này đã được import thành công trước đó.", ok: false } as never)
      .mockRejectedValueOnce(new Error("network"));

    fireEvent.change(screen.getByLabelText("Lý do nhập"), { target: { value: "Lý do" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận nhập 3 học sinh" }));

    const refused = await screen.findByRole("alert");
    expect(refused).toHaveTextContent("Chưa nhập.");
    expect(refused).toHaveTextContent("File này đã được import thành công trước đó.");
    expect(currentStep()).toHaveTextContent("4. Xác nhận nhập");
    await waitFor(() => expect(screen.getByRole("button", { name: "Xác nhận nhập 3 học sinh" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận nhập 3 học sinh" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Không rõ kết quả. Mở lại trang để kiểm tra trước khi thử lại."));
    expect(screen.queryByText(/chưa được thay đổi|chưa ghi/i)).not.toBeInTheDocument();
  });

  it("falls back to the real actions and clamps a seeded step to the data it has", async () => {
    vi.mocked(realActions.validateStudentImportRowsAction).mockResolvedValue({ data: cleanResult(), ok: true });
    render(<StudentImportPage canCreateStudents initialStep="review" initialWorkbook={workbook()} />);

    // No dry-run yet: "review" opens the mapping step.
    expect(currentStep()).toHaveTextContent("2. Ánh xạ cột");
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra 3 dòng" }));
    await waitFor(() => expect(currentStep()).toHaveTextContent("3. Kiểm tra dòng"));
    expect(realActions.validateStudentImportRowsAction).toHaveBeenCalledTimes(1);
    cleanup();

    render(<StudentImportPage canCreateStudents initialStep="confirm" />);
    expect(currentStep()).toHaveTextContent("1. Tải mẫu & chọn file");
  });

  it("opens on a seeded commit result with the given result links", () => {
    renderPage({ initialCommitResult: commitResult, resultLinks: { auditLog: "/dev/a", studentList: "/dev/s" } });

    expect(screen.getByText("Đã nhập 3 học sinh.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở danh sách học viên" })).toHaveAttribute("href", "/dev/s");
    expect(screen.getByRole("link", { name: "Xem nhật ký thao tác" })).toHaveAttribute("href", "/dev/a");
    fireEvent.click(screen.getByRole("button", { name: "Nhập file khác" }));
    expect(screen.getByLabelText("Chọn file Excel")).toBeInTheDocument();
    expect(currentStep()).toHaveTextContent("1. Tải mẫu & chọn file");
  });
});
