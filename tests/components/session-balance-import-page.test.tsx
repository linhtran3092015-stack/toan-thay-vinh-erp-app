// Value: protects=the session-balance import wizard (design 17c): four honest steps ("Ngày hiệu lực & file" · "Ánh xạ cột" · "Kiểm tra dòng" · "Tạo lô đối soát") with ONE step body at a time and exactly one current step; the batch list as the first section of the first step; the effective date (fixed `today` or the Vietnam date); a read/dropped file checked by the feature (a dropped .csv is refused inline); automatic mapping, Vietnamese mapping issues and the stale rules (a changed mapping or date drops the check); the dry run's exact payload; the review strip (Tổng dòng · Hợp lệ · Cần xem lại · Không hợp lệ · Không thay đổi), "Cần xem" chips, row messages mapped to Vietnamese by validation_code with the server's raw message as fallback, the fractional / zero notes; the create step's consequence text, its gate on reason + confirmation only (never on row quality), the exact create payload and the batch link; failures and lost answers in words; seeding props clamped to what the seeded data allows; the default actions are the real ones; the cap/phrase/limit copy matches the server and parser constants; the touched files stay on the design tokens with truthful copy;
// fails_when=two step bodies render together, a step can be reached without its data, the list moves out of the first step, a dropped non-.xlsx file is accepted, a mapping or date change keeps an old check, the dry run or create sends another payload, a code shows its ASCII message instead of Vietnamese (or an unknown code shows nothing), "Tạo lô đối soát" gets gated by invalid rows or loses its next-steps text, a failed or lost write is silent, a seeded step skips missing data, the 50 / GHI SO DU / 5 MB / 5.000 copy drifts from queries.ts / schemas.ts / workbook.ts, or a touched file picks up outline-none, focus rings, legacy tokens, raw hex, raw palette colours, "pilot", "kế toán", role names or alert();
// why_new=step 15b rebuilt /imports/session-balances on the shared wizard frame; no test covered the wizard before (the workflow test only covers the list and the batch page);
// seam=next/navigation useRouter (push, refresh) mocked; the actions module is mocked so the default wiring is observable; the parser keeps its real implementation (the extension check runs for real) unless a test answers with a fixture workbook; the template download is mocked; jsdom has no ResizeObserver so the review table renders as a table;
// no_claim=does not parse a real .xlsx (read-excel-file needs a browser file), prove the server's validation (RPC), the route gates (session-balance-routes.test.tsx), the batch page (session-balance-approval-workflow.test.tsx) or the visual layout
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as realActions from "@/features/imports/session-balances/actions";
import { SESSION_BALANCE_BATCH_LIST_LIMIT } from "@/features/imports/session-balances/session-balance-batch-list";
import { SESSION_BALANCE_POST_PHRASE } from "@/features/imports/session-balances/session-balance-batch-detail-page";
import {
  SESSION_BALANCE_CREATE_NEXT_STEPS,
  SESSION_BALANCE_IMPORT_LIMITS_TEXT,
  SESSION_BALANCE_REVIEW_ROW_CAP,
  SessionBalanceImportPage,
} from "@/features/imports/session-balances/session-balance-import-page";
import { downloadSessionBalanceImportTemplate } from "@/features/imports/session-balances/template-browser";
import type {
  SessionBalanceImportActionFailure,
  SessionBalanceImportBatchListItem,
  SessionBalanceImportDryRunResult,
  SessionBalanceImportParsedWorkbook,
  SessionBalanceImportRowResult,
} from "@/features/imports/session-balances/types";
import { parseSessionBalanceImportWorkbook } from "@/features/imports/session-balances/workbook";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/imports/session-balances/actions", () => ({
  approveSessionBalanceImportBatchAction: vi.fn(),
  createSessionBalanceImportBatchAction: vi.fn(),
  dryRunSessionBalanceImportAction: vi.fn(),
  excludeSessionBalanceImportRowAction: vi.fn(),
  postSessionBalanceImportBatchAction: vi.fn(),
  reconcileSessionBalanceImportBatchAction: vi.fn(),
}));
vi.mock("@/features/imports/session-balances/workbook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/imports/session-balances/workbook")>();
  return { ...actual, parseSessionBalanceImportWorkbook: vi.fn(actual.parseSessionBalanceImportWorkbook) };
});
vi.mock("@/features/imports/session-balances/template-browser", () => ({ downloadSessionBalanceImportTemplate: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const SHA = "9f2c4e7a1b3d5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcd";

const workbook: SessionBalanceImportParsedWorkbook = {
  columns: [
    { columnIndex: 1, columnKey: "A", sourceHeader: "Mã học viên *" },
    { columnIndex: 2, columnKey: "B", sourceHeader: "Họ và tên học viên" },
    { columnIndex: 3, columnKey: "C", sourceHeader: "Số dư buổi *" },
  ],
  rowCount: 3,
  rows: [
    { rowNumber: 2, values: { A: "TV-2026-00012", B: "Nguyễn Ngọc Hà Anh", C: 10 } },
    { rowNumber: 3, values: { A: "TV-2026-00014", B: "Nguyễn Bảo Anh", C: 7.5 } },
    { rowNumber: 4, values: { A: "TV-2026-09999", B: "Phan Minh Đức", C: 6 } },
  ],
  sheetName: "So_du_buoi",
  sourceFilename: "so-du-dau-ky.xlsx",
  sourceSha256: SHA,
};

const mappedRows = [
  { row_number: 2, source_balance: 10, source_student_name: "Nguyễn Ngọc Hà Anh", student_public_code: "TV-2026-00012" },
  { row_number: 3, source_balance: 7.5, source_student_name: "Nguyễn Bảo Anh", student_public_code: "TV-2026-00014" },
  { row_number: 4, source_balance: 6, source_student_name: "Phan Minh Đức", student_public_code: "TV-2026-09999" },
];

function resultRow(overrides: Partial<SessionBalanceImportRowResult> & Pick<SessionBalanceImportRowResult, "source_row_number" | "validation_status">): SessionBalanceImportRowResult {
  return {
    current_balance_before: null,
    delta_sessions: null,
    expected_balance_after: null,
    source_balance: null,
    source_student_name: null,
    student_enrollment_id: null,
    student_id: null,
    student_public_code: null,
    validation_code: null,
    validation_message: null,
    ...overrides,
  };
}

const dryRun: SessionBalanceImportDryRunResult = {
  rows: [
    resultRow({
      current_balance_before: 2,
      delta_sessions: 10,
      expected_balance_after: 12,
      source_balance: 10,
      source_row_number: 2,
      source_student_name: "Nguyễn Ngọc Hà Anh",
      student_public_code: "TV-2026-00012",
      validation_code: "OK",
      validation_message: "Hop le. San sang import.",
      validation_status: "valid",
    }),
    resultRow({
      source_balance: 7.5,
      source_row_number: 3,
      student_public_code: "TV-2026-00014",
      validation_code: "BALANCE_HAS_FRACTIONAL_PART",
      validation_message: "So du co phan thap phan (7.5). Can kiem tra lai. Khong duoc lam tron hoac cat bo.",
      validation_status: "review",
    }),
    resultRow({
      source_balance: 6,
      source_row_number: 4,
      student_public_code: "TV-2026-09999",
      validation_code: "STUDENT_NOT_FOUND",
      validation_message: "Khong tim thay hoc vien voi ma TV-2026-09999.",
      validation_status: "invalid",
    }),
    resultRow({
      source_balance: 3,
      source_row_number: 5,
      student_public_code: "TV-2026-00040",
      validation_code: "BALANCE_OUT_OF_RANGE",
      validation_message: "So du vuot gioi han cho phep.",
      validation_status: "review",
    }),
    resultRow({
      source_balance: 0,
      source_row_number: 6,
      student_public_code: "TV-2026-00022",
      validation_code: "BALANCE_IS_ZERO",
      validation_message: "So du bang 0, khong can tao but toan.",
      validation_status: "no_change",
    }),
  ],
  summary: { invalid: 1, no_change: 1, review: 2, total: 5, valid: 1 },
};

const batch: SessionBalanceImportBatchListItem = {
  approved_at: null,
  approved_by: null,
  created_at: "2026-10-18T09:15:00Z",
  created_by: "user-other",
  creator_name: "Phạm Quốc Anh",
  effective_on: "2026-10-01",
  excluded_count: 0,
  id: "0b5a1000-0000-4000-8000-000000000002",
  invalid_count: 0,
  no_change_count: 0,
  posted_at: null,
  posted_by: null,
  posted_count: 0,
  reason: "Số dư khối 8",
  reconciled_at: null,
  reconciled_by: null,
  review_count: 0,
  row_count: 12,
  source_filename: "so-du-khoi-8.xlsx",
  source_sha256: SHA,
  status: "awaiting_reconciliation",
  valid_count: 12,
};

const failure = (message: string): SessionBalanceImportActionFailure => ({ code: "invalid_request", message, ok: false });

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

function stepper() {
  return screen.getByRole("list", { name: "Các bước nhập số dư buổi" });
}

function stepStates() {
  return within(stepper())
    .getAllByRole("listitem")
    .map((item) => item.getAttribute("data-state"));
}

/** "1. Ngày hiệu lực & file" without the circle's number and the screen-reader state prefix. */
function stepTitle(item: HTMLElement) {
  return item.textContent?.replace(/^\d*(?:Đã xong|Đang ở bước này|Chưa tới): /, "");
}

function currentStepTitle() {
  const current = within(stepper())
    .getAllByRole("listitem")
    .filter((item) => item.getAttribute("aria-current") === "step");
  expect(current).toHaveLength(1);
  return stepTitle(current[0]);
}

const primary = (name: string | RegExp) => screen.getByRole("button", { name });

describe("SessionBalanceImportPage wizard", () => {
  it("opens on step 1 with one body: the batch list first, the effective date, the file card; one current step of four", () => {
    render(<SessionBalanceImportPage batches={[batch]} canApprove={true} currentUserId="user-me" today="2026-10-19" />);

    expect(screen.getByRole("heading", { level: 1, name: "Nhập số dư buổi đầu kỳ" })).toBeInTheDocument();
    expect(within(stepper()).getAllByRole("listitem").map(stepTitle)).toEqual([
      "1. Ngày hiệu lực & file",
      "2. Ánh xạ cột",
      "3. Kiểm tra dòng",
      "4. Tạo lô đối soát",
    ]);
    expect(stepStates()).toEqual(["current", "upcoming", "upcoming", "upcoming"]);

    const listHeading = screen.getByRole("heading", { level: 2, name: "Danh sách Batch đối soát & Phê duyệt (1)" });
    const stepHeading = screen.getByRole("heading", { level: 2, name: "Ngày hiệu lực và file Excel" });
    expect(listHeading.compareDocumentPosition(stepHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText("Ngày hiệu lực số dư")).toHaveValue("2026-10-19");
    const file = screen.getByLabelText("Chọn file Excel");
    expect(file).toHaveAttribute("accept", ".xlsx");
    expect(screen.getByText(SESSION_BALANCE_IMPORT_LIMITS_TEXT)).toBeInTheDocument();

    // Later step bodies are absent.
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Kết quả kiểm tra")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Lý do tạo lô")).not.toBeInTheDocument();

    const next = primary("Tiếp tục: Ánh xạ cột");
    expect(next).toBeDisabled();
    const reasonId = next.getAttribute("aria-describedby");
    expect(reasonId).toBeTruthy();
    expect(document.getElementById(reasonId ?? "")).toHaveTextContent("Chọn file Excel trước.");
  });

  it("hides the list section when there is no batch yet, and defaults the date to the Vietnam business date", () => {
    vi.useFakeTimers({ now: new Date("2026-10-19T18:30:00Z"), toFake: ["Date"] });
    try {
      render(<SessionBalanceImportPage />);
    } finally {
      vi.useRealTimers();
    }
    expect(screen.queryByRole("heading", { name: /Danh sách Batch/ })).not.toBeInTheDocument();
    // 18:30 UTC is already 01:30 on the 20th in Vietnam.
    expect(screen.getByLabelText("Ngày hiệu lực số dư")).toHaveValue("2026-10-20");
  });

  it("refuses a dropped non-.xlsx file inside the file card (the parser checks it: drops skip `accept`)", async () => {
    render(<SessionBalanceImportPage today="2026-10-19" />);
    const dropped = new File(["a,b"], "so-du.csv", { type: "text/csv" });
    fireEvent.drop(screen.getByLabelText("Chọn file Excel").closest("[data-testid]") as HTMLElement, { dataTransfer: { files: [dropped] } });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Không dùng được file này. Import số dư buổi chỉ nhận file .xlsx.");
    expect(vi.mocked(parseSessionBalanceImportWorkbook)).toHaveBeenCalledWith(dropped);
    expect(currentStepTitle()).toBe("1. Ngày hiệu lực & file");
    expect(primary("Tiếp tục: Ánh xạ cột")).toBeDisabled();
  });

  it("reads a file (facts + context line), keeps it when going back, and maps columns automatically on step 2", async () => {
    vi.mocked(parseSessionBalanceImportWorkbook).mockResolvedValueOnce(workbook);
    render(<SessionBalanceImportPage today="2026-10-19" />);

    const picked = new File(["x"], "so-du-dau-ky.xlsx");
    fireEvent.change(screen.getByLabelText("Chọn file Excel"), { target: { files: [picked] } });

    expect(await screen.findByText("so-du-dau-ky.xlsx · 3 dòng")).toBeInTheDocument();
    expect(screen.getByText("Đã đọc 3 dòng. Bước tiếp: chọn cột cho từng trường.")).toBeInTheDocument();
    fireEvent.click(primary("Tiếp tục: Ánh xạ cột"));

    expect(currentStepTitle()).toBe("2. Ánh xạ cột");
    expect(stepStates()).toEqual(["done", "current", "upcoming", "upcoming"]);
    expect(screen.queryByLabelText("Ngày hiệu lực số dư")).not.toBeInTheDocument();
    expect(screen.getByText("Đã tự khớp 3/3 trường theo tiêu đề cột.")).toBeInTheDocument();
    expect(screen.getByLabelText("Mã học viên")).toHaveValue("A");
    expect(screen.getByLabelText("Họ và tên học viên")).toHaveValue("B");
    expect(screen.getByLabelText("Số dư buổi")).toHaveValue("C");
    expect(screen.getByRole("table", { name: "Xem trước 3 dòng đầu theo ánh xạ" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Quay lại bước\s*Ngày hiệu lực & file/ }));
    expect(currentStepTitle()).toBe("1. Ngày hiệu lực & file");
    expect(screen.getByText("so-du-dau-ky.xlsx", { selector: "span" })).toBeInTheDocument();
    expect(primary("Tiếp tục: Ánh xạ cột")).toBeEnabled();
  });

  it("mapping: issues in Vietnamese with the field's label, the check gated on a complete mapping, then the exact dry-run payload", async () => {
    const dryRunSessionBalanceImport = vi.fn().mockResolvedValue({ data: dryRun, ok: true });
    render(
      <SessionBalanceImportPage
        actions={{ dryRunSessionBalanceImport }}
        initialStep="mapping"
        initialWorkbook={workbook}
        today="2026-10-19"
      />,
    );

    expect(screen.getByText("Máy chủ kiểm tra từng dòng với ngày hiệu lực 19/10/2026; bước này chưa ghi dữ liệu.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Số dư buổi"), { target: { value: "" } });
    expect(screen.getByText("Chưa chọn cột cho trường bắt buộc “Số dư buổi”.")).toBeInTheDocument();
    expect(screen.getByLabelText("Số dư buổi")).toHaveAttribute("aria-invalid", "true");
    expect(primary(/^Kiểm tra/)).toBeDisabled();
    expect(screen.getByText("Chọn đủ cột cho các trường bắt buộc trước khi kiểm tra.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Số dư buổi"), { target: { value: "A" } });
    expect(screen.getByText("Cột A đang được chọn cho nhiều trường; mỗi cột chỉ dùng cho một trường.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Số dư buổi"), { target: { value: "C" } });
    expect(screen.queryByText("Ánh xạ chưa xong.")).not.toBeInTheDocument();
    fireEvent.click(primary("Kiểm tra 3 dòng"));

    await waitFor(() => expect(currentStepTitle()).toBe("3. Kiểm tra dòng"));
    expect(dryRunSessionBalanceImport).toHaveBeenCalledTimes(1);
    expect(dryRunSessionBalanceImport).toHaveBeenCalledWith({ effective_on: "2026-10-19", rows: mappedRows });
  });

  it("mapping: a refused or lost check stays on the step, in words", async () => {
    const dryRunSessionBalanceImport = vi
      .fn()
      .mockResolvedValueOnce(failure("Tài khoản hiện tại không có quyền import số dư buổi."))
      .mockRejectedValueOnce(new Error("network"));
    render(<SessionBalanceImportPage actions={{ dryRunSessionBalanceImport }} initialStep="mapping" initialWorkbook={workbook} today="2026-10-19" />);

    fireEvent.click(primary("Kiểm tra 3 dòng"));
    expect(await screen.findByText("Tài khoản hiện tại không có quyền import số dư buổi.")).toBeInTheDocument();
    expect(currentStepTitle()).toBe("2. Ánh xạ cột");

    await waitFor(() => expect(primary("Kiểm tra 3 dòng")).toBeEnabled());
    fireEvent.click(primary("Kiểm tra 3 dòng"));
    expect(
      await screen.findByText("Không kết nối được máy chủ để kiểm tra. Bước này không ghi dữ liệu; thử lại sau."),
    ).toBeInTheDocument();
    expect(currentStepTitle()).toBe("2. Ánh xạ cột");
  });

  // Value: protects=a check answer that lands after the mapping changed is dropped (the wizard stays on "Ánh xạ cột" and needs a new check), and the way back to the date and the file stays shut while a check runs;
  // fails_when=handleDryRun applies a late answer (setDryRunResult + setStep("review")) without checking that the mapping/date/file it checked are still current, a mapping change stops invalidating an in-flight check, or the mapping step's back is enabled during the check;
  // why_new=every other check test answers at once, so none changed an input while the check was in flight;
  // seam=none (the page's `actions` override props; the answers are promises the test resolves by hand); no_claim=does not prove the server's own checks at batch creation
  it("mapping: drops a check answer that lands after the mapping changed, and keeps back shut while checking", async () => {
    const late = deferred<{ data: SessionBalanceImportDryRunResult; ok: true }>();
    const next = deferred<{ data: SessionBalanceImportDryRunResult; ok: true }>();
    const dryRunSessionBalanceImport = vi.fn().mockReturnValueOnce(late.promise).mockReturnValueOnce(next.promise);
    render(<SessionBalanceImportPage actions={{ dryRunSessionBalanceImport }} initialStep="mapping" initialWorkbook={workbook} today="2026-10-19" />);

    fireEvent.click(primary("Kiểm tra 3 dòng"));
    fireEvent.change(screen.getByLabelText("Họ và tên học viên"), { target: { value: "" } });
    await act(async () => {
      late.resolve({ data: dryRun, ok: true });
    });

    expect(currentStepTitle()).toBe("2. Ánh xạ cột");
    expect(screen.queryByLabelText("Kết quả kiểm tra")).not.toBeInTheDocument();
    await waitFor(() => expect(primary("Kiểm tra 3 dòng")).toBeEnabled());

    fireEvent.click(primary("Kiểm tra 3 dòng"));
    expect(screen.getByRole("button", { name: /Quay lại bước\s*Ngày hiệu lực & file/ })).toBeDisabled();
    await act(async () => {
      next.resolve({ data: dryRun, ok: true });
    });
    await waitFor(() => expect(currentStepTitle()).toBe("3. Kiểm tra dòng"));
    expect(dryRunSessionBalanceImport).toHaveBeenCalledTimes(2);
    expect(dryRunSessionBalanceImport.mock.calls[1][0].rows[0]).not.toHaveProperty("source_student_name", "Nguyễn Ngọc Hà Anh");
  });

  // Value: protects=a check call that throws after the mapping changed leaves nothing behind: "Ánh xạ cột" shows no "Chưa kiểm tra được." banner for a check of a mapping no longer chosen;
  // fails_when=the catch branch of handleDryRun sets its error without checking that its run is still the latest;
  // why_new=the late-answer test above resolves with a success, so the guard in the catch branch never ran;
  // seam=none (the page's `actions` override props; the call is a promise the test rejects by hand); no_claim=does not prove which errors a real lost connection throws
  it("mapping: drops a check failure that lands after the mapping changed", async () => {
    const late = deferred<{ data: SessionBalanceImportDryRunResult; ok: true }>();
    const dryRunSessionBalanceImport = vi.fn().mockReturnValueOnce(late.promise);
    render(<SessionBalanceImportPage actions={{ dryRunSessionBalanceImport }} initialStep="mapping" initialWorkbook={workbook} today="2026-10-19" />);

    fireEvent.click(primary("Kiểm tra 3 dòng"));
    fireEvent.change(screen.getByLabelText("Họ và tên học viên"), { target: { value: "" } });
    await act(async () => {
      late.reject(new Error("network"));
    });

    expect(currentStepTitle()).toBe("2. Ánh xạ cột");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Chưa kiểm tra được.")).not.toBeInTheDocument();
    await waitFor(() => expect(primary("Kiểm tra 3 dòng")).toBeEnabled());
  });

  it("review: the five counts, 'Cần xem' first, Vietnamese messages by code with the raw message as fallback, and the notes", () => {
    render(
      <SessionBalanceImportPage initialDryRun={dryRun} initialStep="review" initialWorkbook={workbook} today="2026-10-19" />,
    );

    expect(currentStepTitle()).toBe("3. Kiểm tra dòng");
    const strip = screen.getByLabelText("Kết quả kiểm tra");
    expect(strip.tagName).toBe("DL");
    expect(within(strip).getAllByRole("term").map((term) => term.textContent)).toEqual([
      "Tổng dòng",
      "Hợp lệ",
      "Cần xem lại",
      "Không hợp lệ",
      "Không thay đổi",
    ]);
    expect(within(strip).getAllByRole("definition").map((value) => value.textContent)).toEqual(["5", "1", "2", "1", "1"]);

    const chips = screen.getByRole("group", { name: "Lọc dòng cần xem" });
    expect(within(chips).getAllByRole("button").map((chip) => [chip.textContent, chip.getAttribute("aria-pressed")])).toEqual([
      ["Cần xem3", "true"],
      ["Tất cả5", "false"],
    ]);

    expect(screen.getByText("Không hợp lệ: Không tìm thấy học viên có mã này.")).toBeInTheDocument();
    expect(screen.getByText("Cần xem lại: Số dư có phần lẻ; sổ buổi chỉ ghi số nguyên và không làm tròn.")).toBeInTheDocument();
    // Unknown code: the server's own (ASCII) message.
    expect(screen.getByText("Cần xem lại: So du vuot gioi han cho phep.")).toBeInTheDocument();
    expect(screen.queryByText(/Khong tim thay hoc vien/)).not.toBeInTheDocument();
    // Errors first under "Cần xem"; the valid and unchanged rows only under "Tất cả".
    const codes = () => screen.getAllByRole("row").slice(1).map((row) => row.querySelectorAll("td")[1]?.textContent);
    expect(codes()).toEqual(["TV-2026-09999", "TV-2026-00014", "TV-2026-00040"]);
    fireEvent.click(within(chips).getByRole("button", { name: /^Tất cả/ }));
    expect(codes()).toEqual(["TV-2026-00012", "TV-2026-00014", "TV-2026-09999", "TV-2026-00040", "TV-2026-00022"]);
    expect(screen.getByText("Không thay đổi: Số dư bằng 0, không tạo bút toán.")).toBeInTheDocument();
    expect(screen.getByText("7,5")).toBeInTheDocument();

    expect(screen.getByText("Có số dư lẻ.")).toBeInTheDocument();
    expect(screen.getByText("Có số dư bằng 0.")).toBeInTheDocument();
    expect(
      screen.getByText("Còn 1 dòng không hợp lệ: lô có dòng này không đối soát được. Nên sửa file Excel rồi chọn lại file."),
    ).toBeInTheDocument();
    // Not gated by row quality.
    expect(primary("Tiếp tục: Tạo lô đối soát")).toBeEnabled();
  });

  it("review: caps the table at 500 rows and says so", () => {
    const rows = Array.from({ length: SESSION_BALANCE_REVIEW_ROW_CAP + 2 }, (_, index) =>
      resultRow({ source_balance: 1, source_row_number: index + 2, student_public_code: `TV-2026-${String(index).padStart(5, "0")}`, validation_code: "OK", validation_status: "valid" }),
    );
    render(
      <SessionBalanceImportPage
        initialDryRun={{ rows, summary: { invalid: 0, no_change: 0, review: 0, total: rows.length, valid: rows.length } }}
        initialStep="review"
        initialWorkbook={workbook}
      />,
    );
    expect(SESSION_BALANCE_REVIEW_ROW_CAP).toBe(500);
    expect(screen.getByText("Hiển thị 500/502 dòng")).toBeInTheDocument();
    expect(screen.getByText("Không còn dòng cần xử lý. Bước tiếp: tạo lô đối soát.")).toBeInTheDocument();
  });

  it("going back from the review keeps the file and mapping; a changed date drops the check and the next check sends the new date", async () => {
    const dryRunSessionBalanceImport = vi.fn().mockResolvedValue({ data: dryRun, ok: true });
    render(
      <SessionBalanceImportPage
        actions={{ dryRunSessionBalanceImport }}
        initialDryRun={dryRun}
        initialStep="review"
        initialWorkbook={workbook}
        today="2026-10-19"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Quay lại bước\s*Ánh xạ cột/ }));
    expect(screen.getByLabelText("Số dư buổi")).toHaveValue("C");
    fireEvent.click(screen.getByRole("button", { name: /Quay lại bước\s*Ngày hiệu lực & file/ }));
    fireEvent.change(screen.getByLabelText("Ngày hiệu lực số dư"), { target: { value: "2026-10-01" } });
    fireEvent.click(primary("Tiếp tục: Ánh xạ cột"));

    // The old check is gone: "Kiểm tra dòng" is not reachable without a new check.
    expect(stepStates()).toEqual(["done", "current", "upcoming", "upcoming"]);
    fireEvent.click(primary("Kiểm tra 3 dòng"));
    await waitFor(() => expect(currentStepTitle()).toBe("3. Kiểm tra dòng"));
    expect(dryRunSessionBalanceImport).toHaveBeenCalledWith({ effective_on: "2026-10-01", rows: mappedRows });
  });

  it("create: states what happens next; gated on reason and confirmation only; sends the exact payload and opens the batch", async () => {
    const createSessionBalanceImportBatch = vi.fn().mockResolvedValue({ data: { id: "new-batch-id" }, ok: true });
    render(
      <SessionBalanceImportPage
        actions={{ createSessionBalanceImportBatch }}
        initialDryRun={dryRun}
        initialStep="create"
        initialWorkbook={workbook}
        today="2026-10-19"
      />,
    );

    expect(currentStepTitle()).toBe("4. Tạo lô đối soát");
    expect(stepStates()).toEqual(["done", "done", "done", "current"]);
    expect(screen.getByText(SESSION_BALANCE_CREATE_NEXT_STEPS)).toBeInTheDocument();
    expect(SESSION_BALANCE_CREATE_NEXT_STEPS).toBe("Sau khi tạo lô: đối soát → phê duyệt → ghi sổ; mỗi bước ở trang lô.");
    expect(screen.getByText("Lô sẽ có 1 dòng không hợp lệ.")).toBeInTheDocument();

    expect(primary("Tạo lô đối soát")).toBeDisabled();
    expect(screen.getByText("Nhập lý do tạo lô.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Lý do tạo lô"), { target: { value: "  Số dư đầu kỳ tháng 10  " } });
    expect(primary("Tạo lô đối soát")).toBeDisabled();
    expect(screen.getByText("Đánh dấu ô xác nhận.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Tôi xác nhận kết quả kiểm tra ở bước trước là của đúng file nguồn này." }));
    // Still enabled with an invalid row: the server stages every row and the batch page decides.
    expect(primary("Tạo lô đối soát")).toBeEnabled();
    fireEvent.click(primary("Tạo lô đối soát"));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/imports/session-balances/new-batch-id"));
    expect(createSessionBalanceImportBatch).toHaveBeenCalledWith({
      effectiveOn: "2026-10-19",
      reason: "Số dư đầu kỳ tháng 10",
      rows: mappedRows,
      sourceFilename: "so-du-dau-ky.xlsx",
      sourceSha256: SHA,
    });
  });

  // Value: protects=the confirmation tick belongs to one check: after a new check the box is clear again and "Tạo lô đối soát" waits for it, as in the other three wizards;
  // fails_when=handleDryRun stops resetting isConfirmed on success, so a tick given for one result carries over to another;
  // why_new=the create tests above start from a fresh page, so none re-ran the check after ticking;
  // seam=none (the page's `actions` override props); no_claim=does not prove the server's own checks at batch creation
  it("create: a new check clears the confirmation tick", async () => {
    const dryRunSessionBalanceImport = vi.fn().mockResolvedValue({ data: dryRun, ok: true });
    render(
      <SessionBalanceImportPage
        actions={{ dryRunSessionBalanceImport }}
        initialDryRun={dryRun}
        initialStep="create"
        initialWorkbook={workbook}
        today="2026-10-19"
      />,
    );
    fireEvent.change(screen.getByLabelText("Lý do tạo lô"), { target: { value: "Số dư đầu kỳ" } });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(primary("Tạo lô đối soát")).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /Quay lại bước\s*Kiểm tra dòng/ }));
    fireEvent.click(screen.getByRole("button", { name: /Quay lại bước\s*Ánh xạ cột/ }));
    fireEvent.click(primary("Kiểm tra 3 dòng"));
    await waitFor(() => expect(currentStepTitle()).toBe("3. Kiểm tra dòng"));
    fireEvent.click(primary("Tiếp tục: Tạo lô đối soát"));

    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(primary("Tạo lô đối soát")).toBeDisabled();
    expect(screen.getByText("Đánh dấu ô xác nhận.")).toBeInTheDocument();
  });

  it("create: a refused write stays inline; a lost answer says the result is unknown and reloads the list", async () => {
    const createSessionBalanceImportBatch = vi
      .fn()
      .mockResolvedValueOnce(failure("File này đã được tạo batch trước đó. Không thể tạo batch trùng từ cùng một file nguồn."))
      .mockRejectedValueOnce(new Error("network"));
    render(
      <SessionBalanceImportPage
        actions={{ createSessionBalanceImportBatch }}
        getBatchHref={(id) => `/dev/imports?batch=${id}`}
        initialDryRun={dryRun}
        initialStep="create"
        initialWorkbook={workbook}
      />,
    );
    fireEvent.change(screen.getByLabelText("Lý do tạo lô"), { target: { value: "Số dư" } });
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(primary("Tạo lô đối soát"));
    expect(
      await screen.findByText("File này đã được tạo batch trước đó. Không thể tạo batch trùng từ cùng một file nguồn."),
    ).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();

    await waitFor(() => expect(primary("Tạo lô đối soát")).toBeEnabled());
    fireEvent.click(primary("Tạo lô đối soát"));
    expect(await screen.findByText("Không rõ kết quả. Mở lại trang (hoặc lô) để kiểm tra trước khi thử lại.")).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  // Value: protects=the effective date gates both steps: an empty date keeps "Tiếp tục: Ánh xạ cột" off with "Chọn ngày hiệu lực trước.", and a mapping step reached without one keeps the check off with "Chọn ngày hiệu lực ở bước 1 trước khi kiểm tra." and sends nothing;
  // fails_when=the file step's or the mapping step's reason drops the date condition, or handleDryRun runs without an effective date;
  // why_new=every other test has a date (a fixed `today` or the Vietnam date), so the date branch of either reason never ran;
  // seam=none (seeding props and the page's `actions` override props); no_claim=does not prove the server refuses a check or a batch without a date
  it("an empty effective date keeps both steps from going on, with the reason", () => {
    render(<SessionBalanceImportPage initialWorkbook={workbook} today="2026-10-19" />);
    expect(primary("Tiếp tục: Ánh xạ cột")).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Ngày hiệu lực số dư"), { target: { value: "" } });
    const next = primary("Tiếp tục: Ánh xạ cột");
    expect(next).toBeDisabled();
    expect(document.getElementById(next.getAttribute("aria-describedby") ?? "")).toHaveTextContent("Chọn ngày hiệu lực trước.");
    cleanup();

    const dryRunSessionBalanceImport = vi.fn();
    render(
      <SessionBalanceImportPage
        actions={{ dryRunSessionBalanceImport }}
        initialEffectiveOn=""
        initialStep="mapping"
        initialWorkbook={workbook}
        today="2026-10-19"
      />,
    );
    expect(currentStepTitle()).toBe("2. Ánh xạ cột");
    const check = primary("Kiểm tra 3 dòng");
    expect(check).toBeDisabled();
    expect(document.getElementById(check.getAttribute("aria-describedby") ?? "")).toHaveTextContent(
      "Chọn ngày hiệu lực ở bước 1 trước khi kiểm tra.",
    );
    fireEvent.click(check);
    expect(dryRunSessionBalanceImport).not.toHaveBeenCalled();
  });

  it("clamps seeded steps to the data they need", () => {
    render(<SessionBalanceImportPage initialStep="review" initialWorkbook={workbook} />);
    expect(currentStepTitle()).toBe("2. Ánh xạ cột");
    cleanup();

    render(<SessionBalanceImportPage initialDryRun={dryRun} initialStep="create" />);
    expect(currentStepTitle()).toBe("1. Ngày hiệu lực & file");
    cleanup();

    render(
      <SessionBalanceImportPage
        initialDryRun={dryRun}
        initialMapping={{ source_balance: null, student_public_code: "A" }}
        initialStep="create"
        initialWorkbook={workbook}
      />,
    );
    expect(currentStepTitle()).toBe("2. Ánh xạ cột");
  });

  it("uses the real server actions when no override is passed", async () => {
    vi.mocked(realActions.dryRunSessionBalanceImportAction).mockResolvedValue({ data: dryRun, ok: true });
    render(<SessionBalanceImportPage initialStep="mapping" initialWorkbook={workbook} today="2026-10-19" />);

    fireEvent.click(primary("Kiểm tra 3 dòng"));
    await waitFor(() => expect(realActions.dryRunSessionBalanceImportAction).toHaveBeenCalledTimes(1));
    expect(realActions.createSessionBalanceImportBatchAction).not.toHaveBeenCalled();
  });

  it("shows a template failure inline next to the template button", async () => {
    vi.mocked(downloadSessionBalanceImportTemplate).mockRejectedValueOnce(new Error("Không tạo được file mẫu."));
    render(<SessionBalanceImportPage />);

    fireEvent.click(screen.getByRole("button", { name: "Tải file mẫu (.xlsx)" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tạo được file mẫu.");
  });
});

describe("session-balance import copy and sources", () => {
  const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");

  it("states the caps, phrase and limits the server and parser enforce", () => {
    expect(read("src/features/imports/session-balances/queries.ts")).toMatch(/\.limit\(50\)/);
    expect(SESSION_BALANCE_BATCH_LIST_LIMIT).toBe(50);
    expect(read("src/features/imports/session-balances/schemas.ts")).toContain(`(val) => val === "${SESSION_BALANCE_POST_PHRASE}"`);
    expect(SESSION_BALANCE_POST_PHRASE).toBe("GHI SO DU");
    expect(read("src/features/imports/session-balances/workbook.ts")).toContain("SESSION_BALANCE_IMPORT_MAX_ROWS = 5000");
    expect(read("src/features/imports/session-balances/workbook.ts")).toContain("SESSION_BALANCE_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024");
    expect(SESSION_BALANCE_IMPORT_LIMITS_TEXT).toBe("Chỉ nhận .xlsx có đúng một trang tính, tối đa 5 MB và 5.000 dòng dữ liệu.");
  });

  it("keeps the touched files on the design tokens with truthful copy", () => {
    const files = [
      "src/features/imports/session-balances/session-balance-import-page.tsx",
      "src/features/imports/session-balances/session-balance-batch-detail-page.tsx",
      "src/features/imports/session-balances/session-balance-batch-list.tsx",
      "src/features/imports/session-balances/session-balance-import-labels.ts",
      "src/features/imports/session-balances/session-balance-import-action-overrides.ts",
      "src/app/(app)/imports/session-balances/loading.tsx",
      "src/app/(app)/imports/session-balances/[batchId]/loading.tsx",
      "src/app/(app)/imports/session-balances/page.tsx",
      "src/app/(app)/imports/session-balances/[batchId]/page.tsx",
      "src/app/dev/imports/balance-import-preview.tsx",
      "src/app/dev/imports/balance-import-fixtures.ts",
    ];
    const forbidden =
      /outline-none|focus:ring|focus-visible:ring|\b(text-ink[\w-]*|border-hairline[\w-]*|bg-surface-[12]|bg-canvas|shadow-card|font-display|bg-white|text-primary|bg-primary)\b|#[0-9a-fA-F]{3,8}\b/;
    // Same prefixes and colours as the shared wizard shell's scan (import-wizard-shell.test.tsx).
    const rawPalette =
      /\b(?:text|bg|border|ring|fill|stroke|from|via|to|divide|outline|decoration|accent|caret|shadow)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;
    const untruthful = /pilot|kế toán|Chủ trung tâm|Quản lý vận hành|Trợ giảng|\balert\(|student_session_ledger_entries|imports\.session_balances\.approve`/i;

    for (const file of files) {
      const source = read(file);
      expect(source, file).not.toMatch(forbidden);
      expect(source, file).not.toMatch(rawPalette);
      expect(source, file).not.toMatch(untruthful);
    }
  });

  it("keeps the screen's four-eyes rule (owner decision O3)", () => {
    expect(read("src/features/imports/session-balances/session-balance-batch-detail-page.tsx")).toContain(
      "const isCreator = currentUserId === batch.created_by;",
    );
  });
});
