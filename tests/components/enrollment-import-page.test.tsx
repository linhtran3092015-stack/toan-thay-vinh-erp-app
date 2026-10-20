// Value: protects=/imports/enrollments as a five-step wizard (design 17c, step 15b lane I1): honest steps with the automatic column mapping shown read-only and marked done (never current), one step body at a time, the year labelled plainly, a dropped non-.xlsx file refused inline, the dry-run sent with the year and the parsed rows, review chips "Cần xem / Tất cả" replacing the old status select with words for every classification, "Tạo lô" behind an inline GuardedActionPanel confirmation (no window.confirm) and blocked by conflicts, invalid rows, a stale year or a missing file, NO commit without a created batch (the hard-coded fallback batch id is gone), the commit gated on the typed phrase, a ready batch, 0 conflicts and a fresh dry-run, the commit sent with the created batch id, inline failures, "Không rõ kết quả" on a thrown call, and a result card without a batch link;
// fails_when=the commit controls appear (or the commit action runs) before a batch exists, a fallback batch id returns, window.confirm comes back, the status <select> returns, a conflict or a stale year no longer blocks, the phrase check loosens, the create/commit payloads change, the mapping becomes a current step, two step bodies render together, or the page starts calling a next/navigation hook (no next/navigation mock here);
// why_new=step 15b rewrites the page into a wizard; the only existing test pins the commit copy (enrollment-import-commit-counts.test.tsx, kept unchanged);
// seam=the actions module is mocked (default calls observable) and most tests inject the actions prop; the workbook parser and the template download are mocked; seeding props open later steps; no_claim=the RPCs, the server's own phrase/permission checks, the real workbook parsing (enrollment-import-mapping.test.ts covers the header mapping) or the visual layout
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as realActions from "@/features/imports/enrollments/actions";
import { EnrollmentImportPage, type EnrollmentImportPageProps } from "@/features/imports/enrollments/enrollment-import-page";
import type { EnrollmentImportDryRunResult, EnrollmentImportDryRunRow } from "@/features/imports/enrollments/types";
import { parseEnrollmentWorkbook, type ParsedEnrollmentWorkbook } from "@/features/imports/enrollments/workbook";

vi.mock("@/features/imports/enrollments/actions", () => ({
  commitStudentEnrollmentImportBatchAction: vi.fn(),
  createStudentEnrollmentImportBatchAction: vi.fn(),
  dryRunStudentEnrollmentImportAction: vi.fn(),
}));
vi.mock("@/features/imports/enrollments/template-browser", () => ({ downloadEnrollmentImportTemplate: vi.fn() }));
vi.mock("@/features/imports/enrollments/workbook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/imports/enrollments/workbook")>();
  return { ...actual, parseEnrollmentWorkbook: vi.fn() };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const HEADERS = ["Mã học viên *", "Mã lớp *", "Hình thức *", "Hiệu lực từ *"];

const parsed: ParsedEnrollmentWorkbook = {
  headers: HEADERS,
  mapping: { class_code: HEADERS[1], effective_from: HEADERS[3], registered_mode: HEADERS[2], student_public_code: HEADERS[0] },
  rows: [2, 3, 4].map((sourceRow) => ({
    class_code: "6A1",
    effective_from: "2026-10-20",
    registered_mode: "offline",
    source_row: sourceRow,
    student_public_code: `TV-2026-0020${sourceRow}`,
  })),
  sheetName: "Enrollments",
  totalRows: 3,
};
const file = { name: "ghi-danh.xlsx", sha256: "b".repeat(64), workbook: parsed };

function dryRow(sourceRow: number, overrides: Partial<EnrollmentImportDryRunRow> = {}): EnrollmentImportDryRunRow {
  return {
    academic_year_code: "2026-2027",
    class_code: "6A1",
    classification: "new",
    effective_from: "2026-10-20",
    registered_mode: "offline",
    resolved_class_id: "class-6A1",
    resolved_enrollment_id: null,
    resolved_student_id: `student-${sourceRow}`,
    source_row: sourceRow,
    student_public_code: `TV-2026-0020${sourceRow}`,
    validation_code: null,
    validation_message: null,
    ...overrides,
  };
}

function dryRun(rows: EnrollmentImportDryRunRow[]): EnrollmentImportDryRunResult {
  const count = (classification: EnrollmentImportDryRunRow["classification"]) => rows.filter((row) => row.classification === classification).length;
  return {
    academic_year_code: "2026-2027",
    academic_year_id: "ay-2026-2027",
    conflict_count: count("existing_conflict"),
    invalid_count: count("invalid"),
    matching_count: count("existing_matching"),
    new_count: count("new"),
    row_count: rows.length,
    rows,
  };
}

const cleanDryRun = () => dryRun([dryRow(2), dryRow(3), dryRow(4, { classification: "existing_matching" })]);
const problemDryRun = () =>
  dryRun([
    dryRow(2),
    dryRow(3, { registered_mode: "online" }),
    dryRow(4, { classification: "existing_matching" }),
    dryRow(5, {
      classification: "existing_conflict",
      validation_code: "ENROLLMENT_IMPORT_ACTIVE_ENROLLMENT_CONFLICT",
      validation_message: "Học viên đang có ghi danh active khác lớp, hình thức hoặc ngày bắt đầu.",
    }),
    dryRow(6, {
      classification: "invalid",
      student_public_code: "TV-2026-00999",
      validation_code: "ENROLLMENT_IMPORT_STUDENT_NOT_FOUND",
      validation_message: "Không tìm thấy học viên có mã TV-2026-00999.",
    }),
  ]);
const batch = { id: "batch-3", matching_count: 1, new_count: 2, row_count: 3, status: "ready_to_commit" };

function renderPage(props: Partial<EnrollmentImportPageProps> = {}) {
  const actions = {
    commitStudentEnrollmentImportBatch: vi.fn(async () => ({
      data: { batch_id: "batch-3", committed_at: "2026-10-19T03:40:00.000Z", committed_new_count: 2, reused_matching_count: 1, status: "committed" },
      success: true,
    })),
    createStudentEnrollmentImportBatch: vi.fn(async () => ({ data: { batch: { ...batch } as Record<string, unknown>, dry_run: cleanDryRun() }, success: true })),
    dryRunStudentEnrollmentImport: vi.fn(async () => ({ data: cleanDryRun(), success: true })),
  };
  const view = render(<EnrollmentImportPage actions={actions} {...props} />);
  return { ...view, actions };
}

const stepItems = () => within(screen.getByRole("list", { name: "Các bước nhập ghi danh" })).getAllByRole("listitem");
const states = () => stepItems().map((item) => item.getAttribute("data-state"));
const currentStep = () => stepItems().find((item) => item.getAttribute("aria-current") === "step");
const describedBy = (element: HTMLElement) =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent)
    .join(" ");
const conditions = (name: string) =>
  within(screen.getByRole("region", { name }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
const commitButton = () => screen.queryByRole("button", { name: /XÁC NHẬN COMMIT GHI DANH/ });

describe("EnrollmentImportPage wizard", () => {
  it("opens on the year and file step with five honest steps and no commit controls", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Nhập ghi danh từ file" })).toBeInTheDocument();
    expect(stepItems().map((item) => item.textContent)).toEqual([
      // The circle's number, then the screen-reader state, the title and the description.
      "1Đang ở bước này: 1. Chọn năm học & file",
      "2Chưa tới: 2. Ánh xạ cộtTự khớp theo tiêu đề cột",
      "3Chưa tới: 3. Kiểm tra dòng",
      "4Chưa tới: 4. Tạo lô",
      "5Chưa tới: 5. Xác nhận ghi danh",
    ]);

    const year = screen.getByLabelText("Năm học");
    expect(year).toHaveValue("2026-2027");
    expect(within(year).getAllByRole("option").map((option) => option.textContent)).toEqual(["2026-2027"]);
    expect(screen.queryByText(/chính thức/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Chọn file Excel")).toHaveAttribute("type", "file");
    expect(commitButton()).not.toBeInTheDocument();

    const check = screen.getByRole("button", { name: "Kiểm tra dòng" });
    expect(check).toBeDisabled();
    expect(describedBy(check)).toBe("Chọn file Excel trước.");
  });

  it("refuses a dropped non-.xlsx file inline without parsing it", async () => {
    renderPage();
    fireEvent.drop(screen.getByTestId("enrollment-import-file-dropzone"), {
      dataTransfer: { files: [new File(["a,b"], "ghi-danh.csv", { type: "text/csv" })] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Chỉ nhận file .xlsx.");
    expect(parseEnrollmentWorkbook).not.toHaveBeenCalled();
  });

  it("shows the automatic mapping read-only and done, then sends the year and rows to the dry-run", async () => {
    const { actions } = renderPage({ initialFile: file });

    expect(states()).toEqual(["current", "done", "upcoming", "upcoming", "upcoming"]);
    expect(screen.getByText("ghi-danh.xlsx · 3 dòng")).toBeInTheDocument();
    const mapping = screen.getByRole("region", { name: "Ánh xạ cột" });
    expect(mapping).toHaveTextContent('Mã học viênCột "Mã học viên *"');
    expect(mapping).toHaveTextContent('Hiệu lực từCột "Hiệu lực từ *"');
    expect(within(mapping).queryByRole("combobox")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra 3 dòng" }));
    await waitFor(() => expect(currentStep()).toHaveTextContent("3. Kiểm tra dòng"));
    expect(actions.dryRunStudentEnrollmentImport).toHaveBeenCalledWith("2026-2027", parsed.rows);
    expect(realActions.dryRunStudentEnrollmentImportAction).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Năm học")).not.toBeInTheDocument();
  });

  it("replaces the status select with review chips and words for every classification", () => {
    renderPage({ initialDryRun: problemDryRun(), initialFile: file });

    expect(currentStep()).toHaveTextContent("3. Kiểm tra dòng");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText(/Lọc trạng thái/)).not.toBeInTheDocument();

    const strip = screen.getByLabelText("Kết quả kiểm tra năm học 2026-2027");
    expect(strip).toHaveTextContent("Xung đột (phải sửa trong file)1");
    expect(strip).toHaveTextContent("Không hợp lệ (phải sửa trong file)1");

    const chips = screen.getByRole("group", { name: "Lọc dòng cần xem" });
    expect(within(chips).getByRole("button", { name: "Cần xem2", pressed: true })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Kết quả kiểm tra 5 dòng" });
    let rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Lỗi: Xung đột: Học viên đang có ghi danh active khác lớp, hình thức hoặc ngày bắt đầu.");
    expect(rows[1]).toHaveTextContent("Lỗi: Không hợp lệ: Không tìm thấy học viên có mã TV-2026-00999.");

    fireEvent.click(within(chips).getByRole("button", { name: "Tất cả5" }));
    rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual(["2", "3", "4", "5", "6"]);
    expect(rows[0]).toHaveTextContent("Tại lớp");
    expect(rows[0]).toHaveTextContent("20/10/2026");
    expect(rows[0]).toHaveTextContent("Hợp lệGhi danh mới");
    expect(rows[1]).toHaveTextContent("Trực tuyến");
    expect(rows[2]).toHaveTextContent("Đã có ghi danh khớp; dùng lại");

    const next = screen.getByRole("button", { name: "Tiếp: Tạo lô" });
    expect(next).toBeDisabled();
    expect(describedBy(next)).toBe("Bật khi không còn dòng xung đột hoặc không hợp lệ.");
    expect(screen.getByText("Còn 2 dòng xung đột hoặc không hợp lệ. Sửa file Excel rồi chọn lại file.")).toBeInTheDocument();
  });

  it("never shows commit controls before a batch exists, and there is no fallback batch", () => {
    renderPage({ initialDryRun: cleanDryRun(), initialStep: "commit" });

    // No created batch: "commit" opens the batch step.
    expect(currentStep()).toHaveTextContent("4. Tạo lô");
    expect(commitButton()).not.toBeInTheDocument();
    expect(screen.queryByText(/GHI DANH \d/)).not.toBeInTheDocument();
    // Seeded without a file: the batch cannot be created either.
    expect(conditions("Tạo lô ghi danh")[0]).toBe("Chưa đạt:Chưa có file đang chọn");
    expect(screen.getByRole("button", { name: "Tạo lô 3 dòng" })).toBeDisabled();
    expect(realActions.commitStudentEnrollmentImportBatchAction).not.toHaveBeenCalled();
  });

  it("confirms the batch inline (no window.confirm) and creates it with the file, reason, year and rows", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const { actions } = renderPage({ initialDryRun: cleanDryRun(), initialFile: file, initialStep: "batch" });

    expect(conditions("Tạo lô ghi danh")).toEqual([
      "Đạt:Đã chọn file ghi-danh.xlsx",
      "Đạt:0 dòng xung đột",
      "Đạt:0 dòng không hợp lệ",
      "Đạt:Kết quả kiểm tra còn mới",
      "Đạt:Đã nhập lý do tạo lô",
      "Chưa đạt:Chưa đánh dấu xác nhận",
    ]);
    expect(screen.getByText(/Tạo một lô chờ xác nhận/).textContent).toBe(
      "Tạo một lô chờ xác nhận cho 3 dòng của năm học 2026-2027. Bước này chưa ghi danh học sinh nào; mỗi file chỉ tạo lô được một lần.",
    );
    const create = screen.getByRole("button", { name: "Tạo lô 3 dòng" });
    expect(create).toBeDisabled();
    expect(describedBy(create)).toBe("Đánh dấu ô xác nhận trước khi tạo lô.");

    fireEvent.change(screen.getByLabelText("Lý do tạo lô"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("checkbox", { name: /muốn tạo lô cho 3 dòng/ }));
    expect(create).toBeDisabled();
    expect(describedBy(create)).toBe("Nhập lý do tạo lô.");

    fireEvent.change(screen.getByLabelText("Lý do tạo lô"), { target: { value: "Ghi danh đầu năm" } });
    expect(create).toBeEnabled();
    fireEvent.click(create);

    await waitFor(() => expect(currentStep()).toHaveTextContent("5. Xác nhận ghi danh"));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(actions.createStudentEnrollmentImportBatch).toHaveBeenCalledWith("ghi-danh.xlsx", "b".repeat(64), "Ghi danh đầu năm", "2026-2027", parsed.rows);
    expect(realActions.createStudentEnrollmentImportBatchAction).not.toHaveBeenCalled();
    expect(screen.getByText("GHI DANH 3")).toBeInTheDocument();
    expect(screen.getByText(/^Ghi danh mới:/).textContent).toBe("Ghi danh mới: 2 · Dùng lại: 1");

    // Back to "Tạo lô": the created batch, not a second create button. The step can
    // change before the create transition settles, and back stays disabled until it does.
    const backToBatch = screen.getByRole("button", { name: "Quay lại bước Tạo lô" });
    await waitFor(() => expect(backToBatch).toBeEnabled());
    fireEvent.click(backToBatch);
    expect(screen.getByText("Đã tạo lô.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Tạo lô/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tiếp: Xác nhận ghi danh" }));
    expect(currentStep()).toHaveTextContent("5. Xác nhận ghi danh");
  });

  it("gates the commit on the typed phrase and commits the created batch with the default reason", async () => {
    const { actions } = renderPage({ initialBatch: batch, initialDryRun: cleanDryRun(), initialFile: file });

    expect(currentStep()).toHaveTextContent("5. Xác nhận ghi danh");
    expect(conditions("Xác nhận ghi danh")).toEqual([
      "Đạt:Đã tạo lô",
      "Đạt:Lô sẵn sàng xác nhận",
      "Đạt:Kết quả kiểm tra còn mới",
      "Đạt:0 dòng xung đột",
      "Đạt:Có dòng để ghi danh",
      "Chưa đạt:Chưa gõ đúng cụm xác nhận",
    ]);
    const commit = screen.getByRole("button", { name: "XÁC NHẬN COMMIT GHI DANH 3 HỌC VIÊN" });
    expect(commit).toBeDisabled();
    expect(describedBy(commit)).toBe("Gõ đúng cụm xác nhận để bật nút.");

    const phrase = screen.getByLabelText("Gõ cụm xác nhận");
    fireEvent.change(phrase, { target: { value: "ghi danh 3" } });
    expect(commit).toBeDisabled();
    fireEvent.change(phrase, { target: { value: "GHI DANH 3" } });
    expect(commit).toBeEnabled();

    fireEvent.click(commit);
    await screen.findByText("Đã ghi danh 3 học sinh.");
    expect(actions.commitStudentEnrollmentImportBatch).toHaveBeenCalledWith("batch-3", "Xác nhận ghi danh năm học 2026-2027: 2 mới, 1 dùng lại");
    expect(realActions.commitStudentEnrollmentImportBatchAction).not.toHaveBeenCalled();
    expect(states().every((state) => state === "done")).toBe(true);
    expect(screen.getByText("19/10/2026 10:40")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(commitButton()).not.toBeInTheDocument();
  });

  it("keeps the commit off for conflicts and a batch that is not ready, even with the phrase typed", () => {
    renderPage({ initialBatch: batch, initialDryRun: { ...cleanDryRun(), conflict_count: 1 } });
    fireEvent.change(screen.getByLabelText("Gõ cụm xác nhận"), { target: { value: "GHI DANH 3" } });
    expect(conditions("Xác nhận ghi danh")[3]).toBe("Chưa đạt:Còn 1 dòng xung đột");
    expect(commitButton()).toBeDisabled();
    cleanup();

    renderPage({ initialBatch: { ...batch, status: "rejected" }, initialDryRun: cleanDryRun() });
    fireEvent.change(screen.getByLabelText("Gõ cụm xác nhận"), { target: { value: "GHI DANH 3" } });
    expect(conditions("Xác nhận ghi danh")[1]).toBe("Chưa đạt:Lô đang ở trạng thái Bị từ chối");
    expect(screen.getByRole("region", { name: "Xác nhận ghi danh" })).toHaveTextContent("Bị từ chối");
    expect(commitButton()).toBeDisabled();
  });

  it("marks the dry-run stale when the year changes: no skipping ahead without a fresh check", () => {
    renderPage({ initialBatch: batch, initialDryRun: cleanDryRun(), initialFile: file });

    fireEvent.click(screen.getByRole("button", { name: "Quay lại bước Tạo lô" }));
    fireEvent.click(screen.getByRole("button", { name: "Quay lại bước Kiểm tra dòng" }));
    fireEvent.click(screen.getByRole("button", { name: "Quay lại bước Chọn năm học & file" }));
    expect(screen.getByRole("button", { name: "Tiếp: Kiểm tra dòng" })).toBeEnabled();

    // The only option today is 2026-2027; any change of the select marks the result stale.
    fireEvent.change(screen.getByLabelText("Năm học"), { target: { value: "" } });
    expect(screen.getByText("Năm học đã đổi sau lần kiểm tra gần nhất.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tiếp: Kiểm tra dòng" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kiểm tra 3 dòng" })).toBeInTheDocument();
  });

  it("keeps refused writes inline and says the result is unknown when a call itself fails", async () => {
    const { actions } = renderPage({ initialBatch: batch, initialDryRun: cleanDryRun() });
    actions.commitStudentEnrollmentImportBatch
      .mockResolvedValueOnce({ error: "Lỗi Commit ghi danh: STUDENT_ENROLLMENT_IMPORT_REVALIDATION_FAILED", success: false } as never)
      .mockRejectedValueOnce(new Error("network"));

    fireEvent.change(screen.getByLabelText("Gõ cụm xác nhận"), { target: { value: "GHI DANH 3" } });
    fireEvent.click(screen.getByRole("button", { name: "XÁC NHẬN COMMIT GHI DANH 3 HỌC VIÊN" }));
    const refused = await screen.findByRole("alert");
    expect(refused).toHaveTextContent("Chưa ghi danh.");
    expect(refused).toHaveTextContent("STUDENT_ENROLLMENT_IMPORT_REVALIDATION_FAILED");
    await waitFor(() => expect(screen.getByRole("button", { name: "XÁC NHẬN COMMIT GHI DANH 3 HỌC VIÊN" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "XÁC NHẬN COMMIT GHI DANH 3 HỌC VIÊN" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Không rõ kết quả. Mở lại trang để kiểm tra trước khi thử lại."));
    expect(currentStep()).toHaveTextContent("5. Xác nhận ghi danh");
  });

  // Value: protects=a refused or lost dry-run and batch creation are said inline in words, the wizard stays on its step with nothing created, and the same button can retry;
  // fails_when=handleRunDryRun or handleCreateBatch loses its !success or catch branch (silent failure, an unhandled rejection), moves on without a batch, or the "Chưa tạo lô." / unknown-result words change;
  // why_new=the failure test above covers the commit only; no test made the dry-run or the batch creation fail;
  // seam=none (the page's `actions` override props); no_claim=does not prove which errors the server returns or whether a lost create reached it; the answers are fixtures
  it("keeps a refused or lost dry-run and batch creation inline, on their step, retryable", async () => {
    const { actions } = renderPage({ initialFile: file });
    actions.dryRunStudentEnrollmentImport
      .mockResolvedValueOnce({ error: "Không tìm thấy năm học 2026-2027.", success: false } as never)
      .mockRejectedValueOnce(new Error("network"));

    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra 3 dòng" }));
    const refusedCheck = await screen.findByRole("alert");
    expect(refusedCheck).toHaveTextContent("Chưa kiểm tra được.");
    expect(refusedCheck).toHaveTextContent("Không tìm thấy năm học 2026-2027.");
    expect(currentStep()).toHaveTextContent("1. Chọn năm học & file");
    await waitFor(() => expect(screen.getByRole("button", { name: "Kiểm tra 3 dòng" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra 3 dòng" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Không kết nối được tới máy chủ. Kiểm tra kết nối rồi thử lại; bước này không ghi dữ liệu.",
      ),
    );
    expect(currentStep()).toHaveTextContent("1. Chọn năm học & file");
    expect(actions.dryRunStudentEnrollmentImport).toHaveBeenCalledTimes(2);
    cleanup();

    const created = renderPage({ initialDryRun: cleanDryRun(), initialFile: file, initialStep: "batch" });
    created.actions.createStudentEnrollmentImportBatch
      .mockResolvedValueOnce({ error: "File này đã được tạo batch trước đó.", success: false } as never)
      .mockRejectedValueOnce(new Error("network"));
    fireEvent.click(screen.getByRole("checkbox", { name: /muốn tạo lô cho 3 dòng/ }));

    fireEvent.click(screen.getByRole("button", { name: "Tạo lô 3 dòng" }));
    const refusedBatch = await screen.findByRole("alert");
    expect(refusedBatch).toHaveTextContent("Chưa tạo lô.");
    expect(refusedBatch).toHaveTextContent("File này đã được tạo batch trước đó.");
    expect(currentStep()).toHaveTextContent("4. Tạo lô");
    await waitFor(() => expect(screen.getByRole("button", { name: "Tạo lô 3 dòng" })).toBeEnabled());

    fireEvent.click(screen.getByRole("button", { name: "Tạo lô 3 dòng" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Không rõ kết quả. Mở lại trang để kiểm tra trước khi thử lại."));
    expect(currentStep()).toHaveTextContent("4. Tạo lô");
    expect(screen.queryByText("Đã tạo lô.")).not.toBeInTheDocument();
    expect(commitButton()).not.toBeInTheDocument();
    expect(created.actions.createStudentEnrollmentImportBatch).toHaveBeenCalledTimes(2);
    expect(created.actions.commitStudentEnrollmentImportBatch).not.toHaveBeenCalled();
  });

  // Value: protects=the batch is created with the SHA-256 of the chosen file's bytes (the server's one-batch-per-file key), shown short with the full value in title;
  // fails_when=computeSha256 hashes something else, drops the zero padding of a byte below 0x10, or the create call stops sending the hash of the file read in step 1;
  // why_new=every other test seeds `initialFile` with a made-up hash; no test reads a file through the input, so computeSha256 and the read path never ran;
  // seam=none (parseEnrollmentWorkbook is mocked as in the rest of the file; jsdom's File and WebCrypto do the hashing); no_claim=does not parse a real .xlsx or prove the server dedupes on the hash
  it("hashes the chosen file's bytes and creates the batch with that SHA-256", async () => {
    vi.mocked(parseEnrollmentWorkbook).mockResolvedValueOnce(parsed);
    // SHA-256("abc"), a FIPS 180-2 test vector with bytes 0x01, 0x03 and 0x00 (zero padding matters).
    const ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    const { actions } = renderPage();

    const chosen = new File(["abc"], "ghi-danh.xlsx");
    fireEvent.change(screen.getByLabelText("Chọn file Excel"), { target: { files: [chosen] } });

    expect(await screen.findByText("ghi-danh.xlsx · 3 dòng")).toBeInTheDocument();
    expect(parseEnrollmentWorkbook).toHaveBeenCalledWith(chosen);
    expect(screen.getByTitle(ABC_SHA256)).toHaveTextContent("ba7816bf8f01…");
    expect(states()).toEqual(["current", "done", "upcoming", "upcoming", "upcoming"]);

    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra 3 dòng" }));
    await waitFor(() => expect(currentStep()).toHaveTextContent("3. Kiểm tra dòng"));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp: Tạo lô" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /muốn tạo lô cho 3 dòng/ }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo lô 3 dòng" }));

    await waitFor(() => expect(currentStep()).toHaveTextContent("5. Xác nhận ghi danh"));
    expect(actions.createStudentEnrollmentImportBatch).toHaveBeenCalledWith(
      "ghi-danh.xlsx",
      ABC_SHA256,
      "Nhập ghi danh học sinh năm học 2026-2027",
      "2026-2027",
      parsed.rows,
    );
  });

  // Value: protects=a typed "Lý do xác nhận" is the commit's audit reason (trimmed), with the default only when the field is left empty, as before the redesign;
  // fails_when=the commit call sends defaultCommitReason whatever is typed, stops trimming, or the hint stops naming the default it will use;
  // why_new=the commit tests only commit with an empty reason field, so they pass whether or not a typed reason is used;
  // seam=none (the page's `actions` override props); no_claim=does not prove the server stores the reason in the audit log
  it("commits with the typed reason, trimmed, instead of the default", async () => {
    const { actions } = renderPage({ initialBatch: batch, initialDryRun: cleanDryRun(), initialFile: file });

    const reason = screen.getByLabelText("Lý do xác nhận");
    expect(describedBy(reason)).toBe("Để trống thì dùng: Xác nhận ghi danh năm học 2026-2027: 2 mới, 1 dùng lại");
    fireEvent.change(reason, { target: { value: "  Ghi danh đợt 2 theo danh sách lớp  " } });
    fireEvent.change(screen.getByLabelText("Gõ cụm xác nhận"), { target: { value: "GHI DANH 3" } });
    fireEvent.click(screen.getByRole("button", { name: "XÁC NHẬN COMMIT GHI DANH 3 HỌC VIÊN" }));

    await screen.findByText("Đã ghi danh 3 học sinh.");
    expect(actions.commitStudentEnrollmentImportBatch).toHaveBeenCalledTimes(1);
    expect(actions.commitStudentEnrollmentImportBatch).toHaveBeenCalledWith("batch-3", "Ghi danh đợt 2 theo danh sách lớp");
  });

  it("falls back to the real actions when none are injected", async () => {
    vi.mocked(realActions.dryRunStudentEnrollmentImportAction).mockResolvedValue({ data: cleanDryRun(), success: true });
    render(<EnrollmentImportPage initialFile={file} />);

    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra 3 dòng" }));
    await waitFor(() => expect(currentStep()).toHaveTextContent("3. Kiểm tra dòng"));
    expect(realActions.dryRunStudentEnrollmentImportAction).toHaveBeenCalledWith("2026-2027", parsed.rows);
  });
});
