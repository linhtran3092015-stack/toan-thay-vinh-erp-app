// Value: protects=the /imports/classes wizard (design 17c, step 15b): the shared Stepper names the five real steps ("Tải mẫu & chọn file" · "Ánh xạ cột" · "Kiểm tra dòng" · "Tạo lô" · "Xác nhận nhập") with exactly one current step and the earlier ones done; only the current step's body is in the DOM; picking a file reads it and opens the mapping with both sheets in Tabs (auto-mapped selects, issues in words, raw rows with weekdays as "Thứ Hai" … "Chủ nhật"); a read error stays inside the file card; a template error is inline (no alert()); the year fallback "2026-2027" is said plainly and sent; "Kiểm tra dòng" sends the same payload as before the redesign and opens the review (two summary strips, sheet Tabs with ImportReviewTable, server messages, state words, never "Thứ 1"); going back keeps the file, the mapping and a fresh result (no second dry-run), while a mapping change makes it stale ("Chạy lại kiểm tra" re-runs it); "Tiếp tục: Tạo lô" and "Tạo lô" are disabled while conflicts or invalid rows remain, with "Còn {n} dòng xung đột hoặc không hợp lệ. Sửa file Excel rồi chọn lại file."; "Tạo lô" also needs a typed reason (empty by default, no "pilot" text) and the confirmation, sends the same payload and opens the batch; an existing batch keeps its link; a lost connection says the result is unknown; without overrides the real actions are used;
// fails_when=a second step body or a second current step renders, the stepper loses a step or its order, the mapping stops auto-mapping or loses a sheet tab, a weekday prints "Thứ 1"/"Thứ 2" from an ISO number, the dry-run or create payload changes shape, back drops the file or mapping, a stale result can create a batch, a batch can be created with conflicts/invalid rows or without reason/confirmation, the existing-batch link disappears, alert() comes back, a "Pilot" default returns, or the page stops falling back to the real actions;
// why_new=the class import page had no test (step 15 map §0 finding 2) and step 15b rebuilds it on the shared wizard shell with seeding props and action overrides;
// seam=next/navigation useRouter (push spy), the actions module (vi.fn, observable), the template download and the workbook parser are mocked at module boundaries; fixtures come from the /dev/imports class fixtures; jsdom has no ResizeObserver so the review tables render as tables;
// no_claim=does not prove the server actions, the RPC classification, real Excel parsing (read-excel-file) or the visual layout
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CLASS_IMPORT_PREVIEW_DRY_RUN,
  CLASS_IMPORT_PREVIEW_DRY_RUN_WITH_ERRORS,
  CLASS_IMPORT_PREVIEW_WORKBOOK,
  CLASS_IMPORT_PREVIEW_WORKBOOK_WITH_ERRORS,
} from "@/app/dev/imports/class-import-fixtures";
import * as realActions from "@/features/imports/classes/actions";
import { ClassScheduleImportPage, type ClassScheduleImportPageProps } from "@/features/imports/classes/class-schedule-import-page";
import { downloadClassScheduleImportTemplate } from "@/features/imports/classes/template-browser";
import type { ClassScheduleImportParsedWorkbook } from "@/features/imports/classes/types";
import { parseClassScheduleImportWorkbook } from "@/features/imports/classes/workbook";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/imports/classes/actions", () => ({
  commitClassScheduleImportBatchAction: vi.fn(),
  createClassScheduleImportBatchAction: vi.fn(),
  dryRunClassScheduleImportAction: vi.fn(),
}));
vi.mock("@/features/imports/classes/template-browser", () => ({ downloadClassScheduleImportTemplate: vi.fn() }));
vi.mock("@/features/imports/classes/workbook", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/imports/classes/workbook")>()),
  parseClassScheduleImportWorkbook: vi.fn(),
}));

const STEP_TITLES = ["Tải mẫu & chọn file", "Ánh xạ cột", "Kiểm tra dòng", "Tạo lô", "Xác nhận nhập"];
const BLOCKING_REASON = "Còn 4 dòng xung đột hoặc không hợp lệ. Sửa file Excel rồi chọn lại file.";
const BATCH_ID = "b7c40000-0000-4000-8000-0000000000aa";

function stubActions() {
  return {
    createClassScheduleImportBatch: vi.fn<typeof realActions.createClassScheduleImportBatchAction>(async () => ({
      data: { id: BATCH_ID } as never,
      ok: true,
    })),
    dryRunClassScheduleImport: vi.fn<typeof realActions.dryRunClassScheduleImportAction>(async () => ({
      data: CLASS_IMPORT_PREVIEW_DRY_RUN,
      ok: true,
    })),
  };
}

let actions: ReturnType<typeof stubActions>;

beforeEach(() => {
  actions = stubActions();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function renderPage(props: Partial<ClassScheduleImportPageProps> = {}) {
  return render(<ClassScheduleImportPage actions={actions} {...props} />);
}

const stepper = () => screen.getByRole("list", { name: "Các bước nhập lớp & lịch học" });
const stepStates = () => within(stepper()).getAllByRole("listitem").map((item) => item.getAttribute("data-state"));

function expectStep(index: number) {
  const items = within(stepper()).getAllByRole("listitem");
  expect(items).toHaveLength(5);
  expect(stepStates()).toEqual(STEP_TITLES.map((_, position) => (position < index ? "done" : position === index ? "current" : "upcoming")));
  expect(items.filter((item) => item.getAttribute("aria-current") === "step")).toHaveLength(1);
  expect(items[index]).toHaveAttribute("aria-current", "step");
}

function withoutYear(workbook: ClassScheduleImportParsedWorkbook): ClassScheduleImportParsedWorkbook {
  return {
    ...workbook,
    classesSheet: {
      ...workbook.classesSheet,
      rows: workbook.classesSheet.rows.map((row) => ({ ...row, values: { ...row.values, A: null } })),
    },
  };
}

/** An action answer the test hands back by hand (a request still in flight): an answer, or a call that throws. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
}

async function goToBatchStep() {
  renderPage({ initialDryRun: CLASS_IMPORT_PREVIEW_DRY_RUN, initialWorkbook: CLASS_IMPORT_PREVIEW_WORKBOOK });
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục: Tạo lô" }));
  expectStep(3);
}

describe("ClassScheduleImportPage: steps and file", () => {
  it("names the five real steps in order and opens on the file step only", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Nhập lớp & lịch học từ file" })).toBeInTheDocument();
    const titles = within(stepper())
      .getAllByRole("listitem")
      .map((item) => item.querySelector(".text-body")?.textContent?.replace(/^.*?: /, ""));
    expect(titles).toEqual(STEP_TITLES.map((title, index) => `${index + 1}. ${title}`));
    expectStep(0);

    expect(screen.getByLabelText("Chọn file Excel")).toHaveAttribute("type", "file");
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("button", { name: "Tạo lô" })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    const next = screen.getByRole("button", { name: "Tiếp tục: Ánh xạ cột" });
    expect(next).toBeDisabled();
    expect(next).toHaveAccessibleDescription("Chọn file Excel trước.");
  });

  it("reads a picked file and opens the mapping with the file in the header", async () => {
    vi.mocked(parseClassScheduleImportWorkbook).mockResolvedValue(CLASS_IMPORT_PREVIEW_WORKBOOK);
    renderPage();

    const file = new File(["x"], "lop-lich-hoc-2026-2027.xlsx");
    fireEvent.change(screen.getByLabelText("Chọn file Excel"), { target: { files: [file] } });

    expect(await screen.findByRole("tab", { name: /Sheet Classes/, selected: true })).toBeInTheDocument();
    expect(parseClassScheduleImportWorkbook).toHaveBeenCalledWith(file);
    expectStep(1);
    expect(screen.getByText("lop-lich-hoc-2026-2027.xlsx · 6 lớp · 10 lịch học")).toBeInTheDocument();
    expect(screen.queryByLabelText("Chọn file Excel")).toBeNull();
  });

  // Value: protects=while the chosen file is being read, the file step says so ("Đang đọc file.") instead of asking for a file that was just chosen, as the student and enrollment wizards do;
  // fails_when=the file step's disabled reason ignores isReading;
  // why_new=the read tests resolve at once, so no test saw the file step during a read (and the reason said "Chọn file Excel trước." then);
  // seam=parseClassScheduleImportWorkbook mocked with a read the test finishes by hand; no_claim=does not time a real read
  it("says the file is being read while it is", async () => {
    const read = deferred<ClassScheduleImportParsedWorkbook>();
    vi.mocked(parseClassScheduleImportWorkbook).mockReturnValueOnce(read.promise);
    renderPage();

    fireEvent.change(screen.getByLabelText("Chọn file Excel"), { target: { files: [new File(["x"], "lop-lich-hoc-2026-2027.xlsx")] } });
    const next = screen.getByRole("button", { name: "Tiếp tục: Ánh xạ cột" });
    expect(next).toBeDisabled();
    expect(next).toHaveAccessibleDescription("Đang đọc file.");

    await act(async () => {
      read.resolve(CLASS_IMPORT_PREVIEW_WORKBOOK);
    });
    expect(await screen.findByRole("tab", { name: /Sheet Classes/, selected: true })).toBeInTheDocument();
    expectStep(1);
  });

  it("keeps a read error inside the file card and stays on the file step", async () => {
    vi.mocked(parseClassScheduleImportWorkbook).mockRejectedValue(new Error('File Excel thiếu sheet "Schedules".'));
    renderPage();

    fireEvent.change(screen.getByLabelText("Chọn file Excel"), { target: { files: [new File(["x"], "sai.xlsx")] } });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent('Không dùng được file này. File Excel thiếu sheet "Schedules".');
    expectStep(0);
  });

  it("validates a dropped file itself, since a drop skips the input's accept", async () => {
    const actual = await vi.importActual<typeof import("@/features/imports/classes/workbook")>("@/features/imports/classes/workbook");
    vi.mocked(parseClassScheduleImportWorkbook).mockImplementationOnce(actual.parseClassScheduleImportWorkbook);
    renderPage();

    fireEvent.drop(screen.getByTestId("class-import-file-dropzone"), { dataTransfer: { files: [new File(["a,b"], "lop.csv")] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Chỉ hỗ trợ file định dạng Excel (.xlsx hoặc .xls).");
    expectStep(0);
  });

  it("shows a template download error inline, never through alert()", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    vi.mocked(downloadClassScheduleImportTemplate).mockRejectedValue(new Error("Trình duyệt chặn tải xuống."));
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Tải file mẫu (.xlsx)" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được file mẫu: Trình duyệt chặn tải xuống.");
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

describe("ClassScheduleImportPage: mapping", () => {
  it("shows both sheets in Tabs, one at a time, auto-mapped, with weekdays in words", () => {
    renderPage({ initialWorkbook: CLASS_IMPORT_PREVIEW_WORKBOOK });
    expectStep(1);

    expect(screen.getByRole("tab", { name: /Sheet Classes/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Mã lớp")).toHaveValue("B");
    expect(screen.getByLabelText("Trạng thái")).toHaveValue("H");
    expect(screen.queryByLabelText("Thứ")).toBeNull();
    expect(screen.getByText("Sheet Classes: đã ánh xạ đủ trường bắt buộc.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Sheet Schedules/ }));
    expect(screen.getByLabelText("Thứ")).toHaveValue("C");
    expect(screen.queryByLabelText("Trạng thái")).toBeNull();
    const preview = screen.getByRole("table", { name: "10 dòng đầu của sheet Schedules theo ánh xạ hiện tại" });
    expect(within(preview).getAllByText("Thứ Ba").length).toBeGreaterThan(0);
    expect(within(preview).getByText("Chủ nhật")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Thứ [1-7]\b/);
  });

  it("blocks the check while a required field is unmapped, with the issue in words", () => {
    renderPage({ initialWorkbook: CLASS_IMPORT_PREVIEW_WORKBOOK });

    fireEvent.change(screen.getByLabelText("Tên lớp"), { target: { value: "unassigned" } });

    expect(screen.getByText('Trường bắt buộc "Tên lớp" chưa được gán cột.')).toBeInTheDocument();
    const check = screen.getByRole("button", { name: "Kiểm tra dòng" });
    expect(check).toBeDisabled();
    expect(check).toHaveAccessibleDescription("Sửa ánh xạ cột: còn 1 vấn đề.");
  });

  it("says the fallback year plainly and sends it", async () => {
    renderPage({ initialWorkbook: withoutYear(CLASS_IMPORT_PREVIEW_WORKBOOK) });

    expect(screen.getByText(/chưa có giá trị nên lô dùng năm học mặc định/)).toHaveTextContent(
      "Cột “Mã năm học” chưa có giá trị nên lô dùng năm học mặc định 2026-2027 (đặt cố định trong ứng dụng).",
    );
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra dòng" }));
    await waitFor(() => expect(actions.dryRunClassScheduleImport).toHaveBeenCalledTimes(1));
    expect(actions.dryRunClassScheduleImport.mock.calls[0][0]).toMatchObject({ academic_year_code: "2026-2027" });
  });

  it("runs the check with the same payload as before and opens the review", async () => {
    renderPage({ initialWorkbook: CLASS_IMPORT_PREVIEW_WORKBOOK });
    expect(screen.getByText(/Năm học của lô:/)).toHaveTextContent("Năm học của lô: 2026-2027, lấy từ cột “Mã năm học” (dòng đầu tiên có giá trị).");

    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra dòng" }));

    expect(await screen.findByRole("table", { name: "Kết quả kiểm tra 6 dòng lớp học" })).toBeInTheDocument();
    expectStep(2);
    const payload = actions.dryRunClassScheduleImport.mock.calls[0][0] as unknown as {
      academic_year_code: string;
      classes: unknown[];
      schedules: unknown[];
    };
    expect(payload.academic_year_code).toBe("2026-2027");
    expect(payload.classes).toHaveLength(6);
    expect(payload.classes[0]).toEqual({
      academic_year_code: "2026-2027",
      class_code: "6A1",
      class_name: "Toán 6 Nâng cao A1",
      default_learning_mode: "hybrid",
      grade: 6,
      level: "A",
      source_row_number: 2,
      status: "active",
      weekly_session_count: 2,
    });
    expect(payload.schedules).toHaveLength(10);
    expect(payload.schedules[0]).toEqual({
      class_code: "6A1",
      component_code: "MAIN",
      effective_from: "2026-11-02",
      effective_to: null,
      end_time: "19:30:00",
      learning_mode: "hybrid",
      // A mapped but empty cell is sent as "" (unchanged behaviour).
      meeting_url: "",
      room_name: "P.201",
      source_row_number: 2,
      start_time: "18:00:00",
      weekday: 2,
    });
    expect(realActions.dryRunClassScheduleImportAction).not.toHaveBeenCalled();
  });

  it("keeps a dry-run error inline on the mapping step", async () => {
    actions.dryRunClassScheduleImport.mockResolvedValueOnce({
      code: "database_error",
      message: "Lỗi kiểm tra dữ liệu từ cơ sở dữ liệu: timeout",
      ok: false,
    } as never);
    renderPage({ initialWorkbook: CLASS_IMPORT_PREVIEW_WORKBOOK });

    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra dòng" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Không kiểm tra được dữ liệu. Lỗi kiểm tra dữ liệu từ cơ sở dữ liệu: timeout");
    expectStep(1);
  });
});

describe("ClassScheduleImportPage: review", () => {
  it("shows both summary strips and the sheets' rows with state words and weekdays in words", () => {
    renderPage({ initialDryRun: CLASS_IMPORT_PREVIEW_DRY_RUN, initialWorkbook: CLASS_IMPORT_PREVIEW_WORKBOOK });
    expectStep(2);

    const classStrip = screen.getByLabelText("Tổng quan Lớp học (sheet Classes)");
    expect(within(classStrip).getAllByRole("term").map((term) => term.textContent)).toEqual([
      "Tổng",
      "Tạo mới",
      "Đã tồn tại & khớp",
      "Xung đột",
      "Không hợp lệ",
    ]);
    expect(within(classStrip).getAllByRole("definition").map((value) => value.textContent)).toEqual(["6", "4", "2", "0", "0"]);
    expect(within(screen.getByLabelText("Tổng quan Lịch học (sheet Schedules)")).getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "10",
      "8",
      "2",
      "0",
      "0",
    ]);

    const classTable = screen.getByRole("table", { name: "Kết quả kiểm tra 6 dòng lớp học" });
    expect(within(classTable).getAllByText("Tạo mới")).toHaveLength(4);
    expect(within(classTable).getAllByText("Đã tồn tại & khớp")).toHaveLength(2);
    expect(within(classTable).getByText("Lớp học 9A1 đã tồn tại và khớp dữ liệu.")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: /dòng lịch học/ })).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /Lịch học/ }));
    const scheduleTable = screen.getByRole("table", { name: "Kết quả kiểm tra 10 dòng lịch học" });
    expect(screen.queryByRole("table", { name: /dòng lớp học/ })).toBeNull();
    for (const label of ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ nhật"]) {
      expect(within(scheduleTable).getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(within(scheduleTable).getAllByText("18:00–19:30").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/Thứ [1-7]\b/);

    const next = screen.getByRole("button", { name: "Tiếp tục: Tạo lô" });
    expect(next).toBeEnabled();
  });

  it("blocks 'Tiếp tục: Tạo lô' while conflicts or invalid rows remain, rows needing review first", () => {
    renderPage({ initialDryRun: CLASS_IMPORT_PREVIEW_DRY_RUN_WITH_ERRORS, initialWorkbook: CLASS_IMPORT_PREVIEW_WORKBOOK_WITH_ERRORS });

    const next = screen.getByRole("button", { name: "Tiếp tục: Tạo lô" });
    expect(next).toBeDisabled();
    expect(next).toHaveAccessibleDescription(BLOCKING_REASON);
    expect(screen.getByText(/Ứng dụng không sửa hay bỏ dòng/)).toHaveTextContent(
      "Còn 4 dòng xung đột hoặc không hợp lệ. Ứng dụng không sửa hay bỏ dòng: sửa file Excel rồi chọn lại file.",
    );

    const chips = screen.getByRole("group", { name: "Lọc dòng cần xem" });
    expect(within(chips).getByRole("button", { name: "Cần xem2", pressed: true })).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Kết quả kiểm tra 7 dòng lớp học" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(table).getByText("Mã lớp 6A1 bị lặp lại trong file Excel.")).toBeInTheDocument();
    expect(within(table).getByText("Xung đột")).toBeInTheDocument();
    expect(within(table).getByText("Không hợp lệ")).toBeInTheDocument();
    expect(within(table).getAllByText("Lỗi:", { exact: false }).length).toBe(2);
  });
});

describe("ClassScheduleImportPage: back, stale and 'Tạo lô'", () => {
  it("goes back keeping the file, the mapping and a fresh result", () => {
    renderPage({ initialDryRun: CLASS_IMPORT_PREVIEW_DRY_RUN, initialWorkbook: CLASS_IMPORT_PREVIEW_WORKBOOK });

    fireEvent.click(screen.getByRole("button", { name: "Quay lại bước Ánh xạ cột" }));
    expectStep(1);
    expect(screen.getByLabelText("Mã lớp")).toHaveValue("B");

    fireEvent.click(screen.getByRole("button", { name: "Quay lại bước Tải mẫu & chọn file" }));
    expectStep(0);
    expect(screen.getByText("lop-lich-hoc-2026-2027.xlsx")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chọn file khác" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục: Ánh xạ cột" }));
    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục: Kiểm tra dòng" }));
    expectStep(2);
    expect(actions.dryRunClassScheduleImport).not.toHaveBeenCalled();
  });

  it("marks the result stale after a mapping change and re-runs the check", async () => {
    renderPage({ initialDryRun: CLASS_IMPORT_PREVIEW_DRY_RUN, initialWorkbook: CLASS_IMPORT_PREVIEW_WORKBOOK });
    fireEvent.click(screen.getByRole("button", { name: "Quay lại bước Ánh xạ cột" }));
    expect(screen.queryByText("Kết quả kiểm tra trước không còn đúng.")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /Sheet Schedules/ }));
    fireEvent.change(screen.getByLabelText("Phòng học"), { target: { value: "unassigned" } });

    expect(screen.getByText("Kết quả kiểm tra trước không còn đúng.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tiếp tục: Kiểm tra dòng" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Chạy lại kiểm tra" }));

    await waitFor(() => expect(actions.dryRunClassScheduleImport).toHaveBeenCalledTimes(1));
    expect((actions.dryRunClassScheduleImport.mock.calls[0][0] as unknown as { schedules: { room_name: unknown }[] }).schedules[0].room_name).toBeNull();
    expect(await screen.findByRole("table", { name: "Kết quả kiểm tra 6 dòng lớp học" })).toBeInTheDocument();
    expectStep(2);
  });

  // Value: protects=a re-run that fails (lost or refused) keeps the old result stale: the error in words, the stale banner, "Chạy lại kiểm tra" as the only way on, no review and no batch from it;
  // fails_when=the checked state is recorded before the answer or on a failure, or the primary goes to the review whenever a result exists, so a result for the old mapping reaches "Tạo lô";
  // why_new=step 15b keeps the stale result during a re-run (the old page cleared it first); the stale test above only re-runs successfully;
  // seam=none (the page's `actions` override props); no_claim=does not prove the server's own checks at batch creation; the answers are fixtures
  it("keeps a stale result stale when the re-run fails, so it never reaches the review", async () => {
    actions.dryRunClassScheduleImport
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({ code: "database_error", message: "Lỗi kiểm tra dữ liệu từ cơ sở dữ liệu: timeout", ok: false } as never);
    renderPage({ initialDryRun: CLASS_IMPORT_PREVIEW_DRY_RUN, initialWorkbook: CLASS_IMPORT_PREVIEW_WORKBOOK });
    fireEvent.click(screen.getByRole("button", { name: "Quay lại bước Ánh xạ cột" }));
    fireEvent.click(screen.getByRole("tab", { name: /Sheet Schedules/ }));
    fireEvent.change(screen.getByLabelText("Phòng học"), { target: { value: "unassigned" } });

    fireEvent.click(screen.getByRole("button", { name: "Chạy lại kiểm tra" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không kiểm tra được dữ liệu. Không kết nối được máy chủ để kiểm tra. Bước này chưa ghi gì: kiểm tra mạng rồi thử lại.",
    );
    const rerun = await screen.findByRole("button", { name: "Chạy lại kiểm tra" });
    await waitFor(() => expect(rerun).toBeEnabled());
    expect(screen.getByText("Kết quả kiểm tra trước không còn đúng.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tiếp tục: Kiểm tra dòng" })).toBeNull();
    expectStep(1);

    fireEvent.click(rerun);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Lỗi kiểm tra dữ liệu từ cơ sở dữ liệu: timeout"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Chạy lại kiểm tra" })).toBeEnabled());
    expect(screen.getByText("Kết quả kiểm tra trước không còn đúng.")).toBeInTheDocument();
    expectStep(1);
    expect(screen.queryByRole("table", { name: "Kết quả kiểm tra 6 dòng lớp học" })).toBeNull();
    expect(actions.dryRunClassScheduleImport).toHaveBeenCalledTimes(2);
    expect(actions.createClassScheduleImportBatch).not.toHaveBeenCalled();
  });

  // Value: protects=a dry-run answer that lands after the mapping changed is dropped (the wizard stays on "Ánh xạ cột" with no result, old or stale), and the way back to the file stays shut while a check runs, so a late answer can never land on a cleared file;
  // fails_when=handleRunDryRun applies a late answer (setDryRunResult + setStep("review")) without checking that the inputs it checked are still current, a mapping change stops invalidating an in-flight check, or the mapping step's back is enabled during the check;
  // why_new=every other dry-run test answers at once; in the browser, back → "Chọn file khác" during a check let the old file's result open "Kiểm tra dòng" with "Tiếp tục: Tạo lô" enabled and an empty batch frame;
  // seam=none (the page's `actions` override props; the answers are promises the test resolves by hand); no_claim=does not prove the server's own checks at batch creation
  it("drops a dry-run answer that lands after the mapping changed, and keeps back shut while checking", async () => {
    const late = deferred<Awaited<ReturnType<typeof realActions.dryRunClassScheduleImportAction>>>();
    const next = deferred<Awaited<ReturnType<typeof realActions.dryRunClassScheduleImportAction>>>();
    actions.dryRunClassScheduleImport.mockReturnValueOnce(late.promise).mockReturnValueOnce(next.promise);
    renderPage({ initialWorkbook: CLASS_IMPORT_PREVIEW_WORKBOOK });

    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra dòng" }));
    fireEvent.click(screen.getByRole("tab", { name: /Sheet Schedules/ }));
    fireEvent.change(screen.getByLabelText("Phòng học"), { target: { value: "unassigned" } });
    await act(async () => {
      late.resolve({ data: CLASS_IMPORT_PREVIEW_DRY_RUN, ok: true });
    });

    expectStep(1);
    expect(screen.queryByRole("table", { name: "Kết quả kiểm tra 6 dòng lớp học" })).toBeNull();
    expect(screen.queryByText("Kết quả kiểm tra trước không còn đúng.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Tiếp tục: Kiểm tra dòng" })).toBeNull();
    const check = await screen.findByRole("button", { name: "Kiểm tra dòng" });
    await waitFor(() => expect(check).toBeEnabled());

    fireEvent.click(check);
    expect(screen.getByRole("button", { name: "Quay lại bước Tải mẫu & chọn file" })).toBeDisabled();
    await act(async () => {
      next.resolve({ data: CLASS_IMPORT_PREVIEW_DRY_RUN, ok: true });
    });
    expect(await screen.findByRole("table", { name: "Kết quả kiểm tra 6 dòng lớp học" })).toBeInTheDocument();
    expectStep(2);
    expect((actions.dryRunClassScheduleImport.mock.calls[1][0] as unknown as { schedules: { room_name: unknown }[] }).schedules[0].room_name).toBeNull();
    expect(actions.createClassScheduleImportBatch).not.toHaveBeenCalled();
  });

  // Value: protects=a dry-run call that throws after the mapping changed leaves nothing behind: "Ánh xạ cột" shows no "Không kiểm tra được dữ liệu." banner for a check of a mapping no longer chosen;
  // fails_when=the catch branch of handleRunDryRun sets its error without checking that its run is still the latest;
  // why_new=the late-answer test above resolves with a success, so the guard in the catch branch never ran;
  // seam=none (the page's `actions` override props; the call is a promise the test rejects by hand); no_claim=does not prove which errors a real lost connection throws
  it("drops a dry-run failure that lands after the mapping changed", async () => {
    const late = deferred<Awaited<ReturnType<typeof realActions.dryRunClassScheduleImportAction>>>();
    actions.dryRunClassScheduleImport.mockReturnValueOnce(late.promise);
    renderPage({ initialWorkbook: CLASS_IMPORT_PREVIEW_WORKBOOK });

    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra dòng" }));
    fireEvent.click(screen.getByRole("tab", { name: /Sheet Schedules/ }));
    fireEvent.change(screen.getByLabelText("Phòng học"), { target: { value: "unassigned" } });
    await act(async () => {
      late.reject(new TypeError("Failed to fetch"));
    });

    expectStep(1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/Không kiểm tra được dữ liệu/)).toBeNull();
    const check = await screen.findByRole("button", { name: "Kiểm tra dòng" });
    await waitFor(() => expect(check).toBeEnabled());
  });

  it("resets everything from 'Chọn file khác'", () => {
    renderPage({ initialDryRun: CLASS_IMPORT_PREVIEW_DRY_RUN, initialStep: "file", initialWorkbook: CLASS_IMPORT_PREVIEW_WORKBOOK });
    expectStep(0);

    fireEvent.click(screen.getByRole("button", { name: "Chọn file khác" }));

    expect(screen.getByLabelText("Chọn file Excel")).toBeInTheDocument();
    expect(screen.queryByText(/lop-lich-hoc-2026-2027\.xlsx/)).toBeNull();
    expect(screen.getByRole("button", { name: "Tiếp tục: Ánh xạ cột" })).toBeDisabled();
  });

  it("keeps 'Tạo lô' disabled while conflicts or invalid rows remain, whatever is typed", () => {
    renderPage({
      initialDryRun: CLASS_IMPORT_PREVIEW_DRY_RUN_WITH_ERRORS,
      initialStep: "batch",
      initialWorkbook: CLASS_IMPORT_PREVIEW_WORKBOOK_WITH_ERRORS,
    });
    expectStep(3);

    fireEvent.change(screen.getByLabelText("Lý do tạo lô"), { target: { value: "Nhập lớp đầu năm" } });
    fireEvent.click(screen.getByLabelText("Tôi đã xem kết quả kiểm tra và muốn lưu file này thành lô chờ xác nhận."));

    const create = screen.getByRole("button", { name: "Tạo lô" });
    expect(create).toBeDisabled();
    expect(create).toHaveAccessibleDescription(BLOCKING_REASON);
    expect(screen.getByText("Còn 4 dòng xung đột hoặc không hợp lệ")).toBeInTheDocument();
    fireEvent.click(create);
    expect(actions.createClassScheduleImportBatch).not.toHaveBeenCalled();
  });

  it("needs a typed reason (empty by default) and the confirmation, then creates the batch and opens it", async () => {
    await goToBatchStep();

    const reason = screen.getByLabelText("Lý do tạo lô");
    expect(reason).toHaveValue("");
    expect(reason.getAttribute("placeholder")).not.toMatch(/pilot/i);
    expect(document.body.textContent).not.toMatch(/pilot/i);
    expect(screen.getByText("Không còn dòng xung đột hoặc không hợp lệ")).toBeInTheDocument();

    const create = screen.getByRole("button", { name: "Tạo lô" });
    expect(create).toBeDisabled();
    expect(create).toHaveAccessibleDescription("Nhập lý do tạo lô.");

    fireEvent.change(reason, { target: { value: "  Nhập lớp và lịch học đầu năm  " } });
    expect(screen.getByRole("button", { name: "Tạo lô" })).toHaveAccessibleDescription("Đánh dấu ô xác nhận.");

    fireEvent.click(screen.getByLabelText("Tôi đã xem kết quả kiểm tra và muốn lưu file này thành lô chờ xác nhận."));
    const enabled = screen.getByRole("button", { name: "Tạo lô" });
    expect(enabled).toBeEnabled();
    await act(async () => {
      fireEvent.click(enabled);
    });

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/imports/classes/${BATCH_ID}`));
    const payload = actions.createClassScheduleImportBatch.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(payload).toMatchObject({
      academic_year_code: "2026-2027",
      explicit_confirmation: true,
      reason: "Nhập lớp và lịch học đầu năm",
      source_filename: "lop-lich-hoc-2026-2027.xlsx",
      source_sha256: CLASS_IMPORT_PREVIEW_WORKBOOK.sourceSha256,
    });
    expect(payload.classes).toHaveLength(6);
    expect(payload.schedules).toHaveLength(10);
  });

  it("keeps the link to a batch already made from the same file", async () => {
    actions.createClassScheduleImportBatch.mockResolvedValueOnce({
      code: "conflict",
      existingBatchId: "e0000000-0000-4000-8000-000000000001",
      message: "File này đã được tạo batch trước đó.",
      ok: false,
    } as never);
    await goToBatchStep();
    fireEvent.change(screen.getByLabelText("Lý do tạo lô"), { target: { value: "Nhập lại" } });
    fireEvent.click(screen.getByLabelText("Tôi đã xem kết quả kiểm tra và muốn lưu file này thành lô chờ xác nhận."));
    fireEvent.click(screen.getByRole("button", { name: "Tạo lô" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("File này đã được tạo batch trước đó.");
    expect(within(alert).getByRole("link", { name: "Mở lô đã tạo từ file này" })).toHaveAttribute(
      "href",
      "/imports/classes/e0000000-0000-4000-8000-000000000001",
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it("says the result is unknown when the connection drops while creating", async () => {
    actions.createClassScheduleImportBatch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await goToBatchStep();
    fireEvent.change(screen.getByLabelText("Lý do tạo lô"), { target: { value: "Nhập lớp" } });
    fireEvent.click(screen.getByLabelText("Tôi đã xem kết quả kiểm tra và muốn lưu file này thành lô chờ xác nhận."));
    fireEvent.click(screen.getByRole("button", { name: "Tạo lô" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không rõ kết quả. Bấm “Tạo lô” lại: nếu lô đã được tạo, trang sẽ hiện link mở lô đó.",
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it("falls back to the real actions when no overrides are given", async () => {
    vi.mocked(realActions.dryRunClassScheduleImportAction).mockResolvedValue({ data: CLASS_IMPORT_PREVIEW_DRY_RUN, ok: true });
    render(<ClassScheduleImportPage initialWorkbook={CLASS_IMPORT_PREVIEW_WORKBOOK} />);

    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra dòng" }));

    await waitFor(() => expect(realActions.dryRunClassScheduleImportAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("table", { name: "Kết quả kiểm tra 6 dòng lớp học" })).toBeInTheDocument();
  });
});

describe("class import sources", () => {
  const files = [
    "src/features/imports/classes/class-schedule-import-page.tsx",
    "src/features/imports/classes/class-schedule-batch-detail-page.tsx",
    "src/features/imports/classes/class-schedule-import-presentation.tsx",
    "src/features/imports/classes/class-schedule-import-rows.tsx",
    "src/features/imports/classes/class-schedule-import-action-overrides.ts",
    "src/app/(app)/imports/classes/loading.tsx",
    "src/app/(app)/imports/classes/[batchId]/loading.tsx",
    "src/app/dev/imports/class-import-preview.tsx",
    "src/app/dev/imports/class-import-fixtures.ts",
  ];

  it("stay on the design tokens, off alert() and off local-time formatting", () => {
    const forbidden =
      /outline-none|focus:ring|focus-visible:ring|\b(text-ink[\w-]*|border-hairline[\w-]*|bg-surface-[12]|bg-canvas|shadow-card|font-display|bg-white|text-primary|bg-primary)\b|#[0-9a-fA-F]{3,8}\b/;
    const rawPalette =
      /\b(?:text|bg|border|ring|fill|stroke|from|via|to|divide|outline|decoration|accent|caret|shadow)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(forbidden);
      expect(source, file).not.toMatch(rawPalette);
      expect(source, file).not.toMatch(/\balert\(|toLocaleString|new Intl\.DateTimeFormat|Pilot Data Import/);
      expect(source, file).not.toMatch(/Thứ \{/);
    }
  });
});
