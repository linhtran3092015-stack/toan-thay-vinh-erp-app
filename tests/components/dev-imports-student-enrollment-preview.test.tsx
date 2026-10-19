// Value: protects=the /dev/imports student and enrollment previews are inert and truthful per role and state: every action either wizard can reach has a stub (by source scan of the features' own imports), the stubs answer the features' own shapes ("Bản xem trước không ghi dữ liệu." for writes, fixture dry-runs for the read-only check), nothing real is ever called while a preview walks through its steps, every link stays under /dev, owner sees the wizard on the state's step while maker and viewer see the route's own denial, and the fixtures add up (counts match rows, the clean file has no errors, the batch matches its dry-run, the fixed clock);
// fails_when=a new action reachable from a wizard ships without a stub, a stub calls or returns a real result for a write, a preview link leaves /dev, a role without imports.students / imports.enrollments sees a wizard, a state opens the wrong step, or a fixture count drifts from its rows;
// why_new=step 15b lane I1 replaces the controller's placeholder bodies;
// seam=both real actions modules are mocked so any real call is observable; the bodies render without the AppShell (the controller wraps them; dev-imports-page.test.tsx covers the page); no next/navigation mock (the wizards use none); no_claim=the /dev/imports page wiring, the production 404, or the wizards' own gating (their page tests)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  enrollmentPreviewBatch,
  enrollmentPreviewCommitResult,
  enrollmentPreviewDryRunClean,
  enrollmentPreviewDryRunWithProblems,
  enrollmentPreviewFileClean,
} from "@/app/dev/imports/enrollment-import-fixtures";
import {
  createEnrollmentImportPreviewActions,
  ENROLLMENT_IMPORT_PREVIEW_STUB_MESSAGE,
  EnrollmentImportPreviewBody,
} from "@/app/dev/imports/enrollments-preview";
import { IMPORTS_PREVIEW_STATES, IMPORTS_PREVIEW_TODAY, type EnrollmentImportsPreviewState, type StudentImportsPreviewState } from "@/app/dev/imports/imports-preview-params";
import {
  studentPreviewCommitResult,
  studentPreviewValidationClean,
  studentPreviewValidationWithErrors,
  studentPreviewWorkbookClean,
} from "@/app/dev/imports/student-import-fixtures";
import {
  createStudentImportPreviewActions,
  STUDENT_IMPORT_PREVIEW_STUB_MESSAGE,
  StudentImportPreviewBody,
} from "@/app/dev/imports/students-preview";
import * as enrollmentActions from "@/features/imports/enrollments/actions";
import * as studentActions from "@/features/imports/students/actions";

vi.mock("@/features/imports/students/actions", () => ({
  commitStudentImportRowsAction: vi.fn(),
  validateStudentImportRowsAction: vi.fn(),
}));
vi.mock("@/features/imports/enrollments/actions", () => ({
  commitStudentEnrollmentImportBatchAction: vi.fn(),
  createStudentEnrollmentImportBatchAction: vi.fn(),
  dryRunStudentEnrollmentImportAction: vi.fn(),
}));

const STUB = "Bản xem trước không ghi dữ liệu.";
const studentStates = IMPORTS_PREVIEW_STATES.students as readonly StudentImportsPreviewState[];
const enrollmentStates = IMPORTS_PREVIEW_STATES.enrollments as readonly EnrollmentImportsPreviewState[];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function expectNothingReal() {
  for (const action of [...Object.values(studentActions), ...Object.values(enrollmentActions)]) {
    expect(action).not.toHaveBeenCalled();
  }
}

/** Value imports of a feature folder from its actions module (relative or absolute), with the Action suffix dropped. */
function reachableActions(folder: string): string[] {
  const root = join(process.cwd(), "src/features/imports", folder);
  const reachable = new Set<string>();
  for (const name of readdirSync(root).filter((file) => /\.tsx?$/.test(file) && file !== "actions.ts")) {
    const source = readFileSync(join(root, name), "utf8");
    const pattern = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*"(?:\\./actions|@/features/imports/${folder}/actions)"`, "g");
    for (const match of source.matchAll(pattern)) {
      for (const entry of match[1].split(",").map((part) => part.trim()).filter(Boolean)) reachable.add(entry.replace(/Action$/, ""));
    }
  }
  return [...reachable].sort();
}

const currentStep = (label: string) =>
  within(screen.getByRole("list", { name: label }))
    .getAllByRole("listitem")
    .find((item) => item.getAttribute("aria-current") === "step");

function expectLinksUnderDev() {
  for (const link of document.querySelectorAll("a[href]")) expect(link.getAttribute("href")).toMatch(/^\/dev\//);
}

describe("/dev/imports student preview", () => {
  it("stubs every student import action the wizard can reach, with the action's own shapes", async () => {
    expect(reachableActions("students")).toEqual(["commitStudentImportRows", "validateStudentImportRows"]);
    for (const state of studentStates) {
      const stubs = createStudentImportPreviewActions(state);
      expect(Object.keys(stubs).sort()).toEqual(reachableActions("students"));
      await expect(stubs.commitStudentImportRows({ reason: "x", rows: [], sourceFilename: "a.xlsx", sourceSha256: "0".repeat(64) })).resolves.toEqual({
        code: "forbidden",
        message: STUB,
        ok: false,
      });
      const check = await stubs.validateStudentImportRows({ rows: [] });
      expect(check).toEqual({ data: state === "review-clean" || state === "done" ? studentPreviewValidationClean : studentPreviewValidationWithErrors, ok: true });
    }
    expect(STUDENT_IMPORT_PREVIEW_STUB_MESSAGE).toBe(STUB);
    expectNothingReal();
  });

  it.each(studentStates)("owner, state %s: the wizard on the state's step, links under /dev, nothing real", (state) => {
    render(<StudentImportPreviewBody role="owner" state={state} view="students" />);

    const expected = { done: undefined, file: "1. Tải mẫu & chọn file", mapping: "2. Ánh xạ cột", "review-clean": "3. Kiểm tra dòng", "review-errors": "3. Kiểm tra dòng" }[state];
    if (expected) expect(currentStep("Các bước nhập học sinh")).toHaveTextContent(expected);
    else expect(screen.getByText("Đã nhập 8 học sinh.")).toBeInTheDocument();
    expectLinksUnderDev();
    expectNothingReal();
  });

  it.each(["maker", "viewer"] as const)("%s sees the route's denial in every state", (role) => {
    for (const state of studentStates) {
      render(<StudentImportPreviewBody role={role} state={state} view="students" />);
      expect(screen.getByRole("heading", { level: 1, name: "Không có quyền import học viên" })).toBeInTheDocument();
      expect(screen.queryByRole("list", { name: "Các bước nhập học sinh" })).not.toBeInTheDocument();
      cleanup();
    }
  });

  it("walks mapping → review on the stub and stops a commit with the stub message", async () => {
    render(<StudentImportPreviewBody role="owner" state="mapping" view="students" />);
    expect(screen.getByRole("alert")).toHaveTextContent('Chưa chọn cột cho trường bắt buộc "Số điện thoại phụ huynh".');
    fireEvent.change(screen.getByLabelText("Số điện thoại phụ huynh"), { target: { value: "E" } });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra 8 dòng" }));
    await waitFor(() => expect(currentStep("Các bước nhập học sinh")).toHaveTextContent("3. Kiểm tra dòng"));
    expect(screen.getByRole("button", { name: "Tiếp: Xác nhận nhập" })).toBeDisabled();
    cleanup();

    render(<StudentImportPreviewBody role="owner" state="review-clean" view="students" />);
    fireEvent.click(screen.getByRole("button", { name: "Tiếp: Xác nhận nhập" }));
    fireEvent.change(screen.getByLabelText("Lý do nhập"), { target: { value: "Xem trước" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận nhập 8 học sinh" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(STUB);
    expectNothingReal();
  });

  it("fixtures add up: counts match rows, the clean file has no errors and matches the commit", () => {
    for (const validation of [studentPreviewValidationWithErrors, studentPreviewValidationClean]) {
      expect(validation.row_count).toBe(validation.rows.length);
      expect(validation.valid_count + validation.warning_count + validation.invalid_count).toBe(validation.row_count);
    }
    expect(studentPreviewValidationWithErrors.invalid_count).toBeGreaterThan(0);
    expect(studentPreviewValidationWithErrors.rows.some((row) => row.exact_student_duplicate && row.status === "invalid")).toBe(true);
    expect(studentPreviewValidationClean.invalid_count).toBe(0);
    expect(studentPreviewWorkbookClean.rowCount).toBe(studentPreviewValidationClean.row_count);
    expect(studentPreviewCommitResult.student_count).toBe(studentPreviewValidationClean.row_count);
    expect(studentPreviewCommitResult.guardian_created_count + studentPreviewCommitResult.guardian_reused_count).toBe(studentPreviewCommitResult.student_count);
    expect(studentPreviewCommitResult.committed_at.startsWith(IMPORTS_PREVIEW_TODAY)).toBe(true);
  });
});

describe("/dev/imports enrollment preview", () => {
  it("stubs every enrollment import action the wizard can reach, with the actions' own shapes", async () => {
    expect(reachableActions("enrollments")).toEqual([
      "commitStudentEnrollmentImportBatch",
      "createStudentEnrollmentImportBatch",
      "dryRunStudentEnrollmentImport",
    ]);
    for (const state of enrollmentStates) {
      const stubs = createEnrollmentImportPreviewActions(state);
      expect(Object.keys(stubs).sort()).toEqual(reachableActions("enrollments"));
      await expect(stubs.createStudentEnrollmentImportBatch("a.xlsx", "0".repeat(64), "x", "2026-2027", [])).resolves.toEqual({ error: STUB, success: false });
      await expect(stubs.commitStudentEnrollmentImportBatch("batch", "x")).resolves.toEqual({ error: STUB, success: false });
      await expect(stubs.dryRunStudentEnrollmentImport("2026-2027", [])).resolves.toEqual({
        data: state === "batch" || state === "done" ? enrollmentPreviewDryRunClean : enrollmentPreviewDryRunWithProblems,
        success: true,
      });
    }
    expect(ENROLLMENT_IMPORT_PREVIEW_STUB_MESSAGE).toBe(STUB);
    expectNothingReal();
  });

  it.each(enrollmentStates)("owner, state %s: the wizard on the state's step, no links, nothing real", (state) => {
    render(<EnrollmentImportPreviewBody role="owner" state={state} view="enrollments" />);

    const expected = { batch: "5. Xác nhận ghi danh", done: undefined, file: "1. Chọn năm học & file", review: "3. Kiểm tra dòng" }[state];
    if (expected) expect(currentStep("Các bước nhập ghi danh")).toHaveTextContent(expected);
    else expect(screen.getByText("Đã ghi danh 8 học sinh.")).toBeInTheDocument();
    expect(document.querySelectorAll("a[href]")).toHaveLength(0);
    expectNothingReal();
  });

  it.each(["maker", "viewer"] as const)("%s sees the route's denial in every state", (role) => {
    for (const state of enrollmentStates) {
      render(<EnrollmentImportPreviewBody role={role} state={state} view="enrollments" />);
      expect(screen.getByRole("heading", { level: 1, name: "Không có quyền import ghi danh học viên" })).toBeInTheDocument();
      expect(screen.queryByRole("list", { name: "Các bước nhập ghi danh" })).not.toBeInTheDocument();
      cleanup();
    }
  });

  it("review shows the blocking rows; batch types the phrase and stops the commit with the stub message", async () => {
    render(<EnrollmentImportPreviewBody role="owner" state="review" view="enrollments" />);
    expect(screen.getByRole("button", { name: "Cần xem3", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tiếp: Tạo lô" })).toBeDisabled();
    cleanup();

    render(<EnrollmentImportPreviewBody role="owner" state="batch" view="enrollments" />);
    expect(screen.getByText(/^Ghi danh mới:/).textContent).toBe("Ghi danh mới: 7 · Dùng lại: 1");
    fireEvent.change(screen.getByLabelText("Gõ cụm xác nhận"), { target: { value: "GHI DANH 8" } });
    fireEvent.click(screen.getByRole("button", { name: "XÁC NHẬN COMMIT GHI DANH 8 HỌC VIÊN" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(STUB);
    expectNothingReal();
  });

  it("fixtures add up: counts match rows, the clean dry-run has no problems and matches the batch and the commit", () => {
    for (const dryRun of [enrollmentPreviewDryRunWithProblems, enrollmentPreviewDryRunClean]) {
      expect(dryRun.row_count).toBe(dryRun.rows.length);
      expect(dryRun.new_count + dryRun.matching_count + dryRun.conflict_count + dryRun.invalid_count).toBe(dryRun.row_count);
    }
    expect(enrollmentPreviewDryRunWithProblems.conflict_count).toBeGreaterThan(0);
    expect(enrollmentPreviewDryRunWithProblems.invalid_count).toBeGreaterThan(0);
    expect(enrollmentPreviewDryRunClean.conflict_count + enrollmentPreviewDryRunClean.invalid_count).toBe(0);
    expect(enrollmentPreviewFileClean.workbook.totalRows).toBe(enrollmentPreviewDryRunClean.row_count);
    expect(enrollmentPreviewBatch).toMatchObject({
      matching_count: enrollmentPreviewDryRunClean.matching_count,
      new_count: enrollmentPreviewDryRunClean.new_count,
      status: "ready_to_commit",
    });
    expect(enrollmentPreviewCommitResult.batch_id).toBe(enrollmentPreviewBatch.id);
    expect(enrollmentPreviewCommitResult.committed_at.startsWith(IMPORTS_PREVIEW_TODAY)).toBe(true);
  });
});
