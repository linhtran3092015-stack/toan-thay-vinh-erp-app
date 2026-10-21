// Value: protects=the /dev/imports class bodies (view=classes and view=class-batch) are inert and truthful: every class & schedule import action the two pages import has a preview stub (source scan, so a new action fails here until stubbed); creating a batch and committing answer "Bản xem trước không ghi dữ liệu." and the dry-run answers fixture results, so no click reaches a real action, router.push or router.refresh; each state opens the step it names (file, mapping, review-clean, review-conflicts; batch ready, committed, previewed); maker and viewer (no imports.classes) get the routes' own denials; links stay off /imports/* and the live write forms, every one under /dev (back link, batch target and the batch page's "Mở lớp" links to the /dev class preview); the fixtures agree with themselves (summaries = row classifications, workbook rows = dry-run rows, batch counts = rows) and the clean workbook auto-maps without issues;
// fails_when=a page gains an action without a stub, a stub calls through or claims a write, a state opens the wrong step, a role without imports.classes sees a page, a preview link leads to /imports/*, a live form or a real /classes/<id> page, or the fixture counts drift from their rows;
// why_new=step 15b replaces the placeholder class body of /dev/imports with the real wizard and batch page;
// seam=the classes actions module is mocked so a real call is observable; next/navigation offers useRouter spies; the body is rendered without AppShell (the controller wraps it, dev-imports-page.test.tsx);
// no_claim=does not prove the /dev/imports page wiring, the production 404 (dev-imports-page.test.tsx) or the pages' own rules (class-schedule-*-page tests)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CLASS_IMPORT_PREVIEW_DRY_RUN,
  CLASS_IMPORT_PREVIEW_DRY_RUN_WITH_ERRORS,
  CLASS_IMPORT_PREVIEW_WORKBOOK,
  CLASS_IMPORT_PREVIEW_WORKBOOK_WITH_ERRORS,
  getClassBatchPreviewDetail,
} from "@/app/dev/imports/class-import-fixtures";
import {
  CLASS_IMPORT_PREVIEW_BATCH_HREF,
  CLASS_IMPORT_PREVIEW_CLASS_HREF,
  CLASS_IMPORT_PREVIEW_IMPORT_HREF,
  ClassImportPreviewBody,
  previewClassImportActions,
  previewClassImportConflictActions,
} from "@/app/dev/imports/class-import-preview";
import type { ClassImportPreviewProps, ImportsPreviewRole } from "@/app/dev/imports/imports-preview-params";
import * as realActions from "@/features/imports/classes/actions";
import { autoMapClassesSheet, autoMapSchedulesSheet, validateClassesMapping, validateSchedulesMapping } from "@/features/imports/classes/mapping";
import type { ClassScheduleImportSummaryCount } from "@/features/imports/classes/types";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/imports/classes/actions", () => ({
  commitClassScheduleImportBatchAction: vi.fn(),
  createClassScheduleImportBatchAction: vi.fn(),
  dryRunClassScheduleImportAction: vi.fn(),
}));

const STUB = "Bản xem trước không ghi dữ liệu.";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function expectNothingReal() {
  for (const action of Object.values(realActions)) expect(action).not.toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
  expect(router.refresh).not.toHaveBeenCalled();
}

function renderBody(props: ClassImportPreviewProps) {
  return render(<ClassImportPreviewBody {...props} />);
}

const stepStates = () =>
  within(screen.getByRole("list", { name: "Các bước nhập lớp & lịch học" }))
    .getAllByRole("listitem")
    .map((item) => item.getAttribute("data-state"));

function expectLinksStayInPreview() {
  for (const link of document.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href") ?? "";
    expect(href, href).not.toMatch(/^\/imports\//);
    expect(href, href).not.toMatch(/\/students\/new|\/classes\/new|\/sessions\/batch/);
    // Every link stays under /dev (the batch page's "Mở lớp" opens the /dev class preview, never /classes/<id>).
    expect(href, href).toMatch(/^\/dev\/(?:imports|class)\?/);
  }
}

describe("/dev/imports class preview stubs", () => {
  it("stubs every class import action the two pages import", () => {
    const reachable = new Set<string>();
    for (const file of ["class-schedule-import-page.tsx", "class-schedule-batch-detail-page.tsx"]) {
      const source = readFileSync(join(process.cwd(), "src/features/imports/classes", file), "utf8");
      for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"(?:\.\/actions|@\/features\/imports\/classes\/actions)"/g)) {
        for (const name of match[1].split(",").map((part) => part.trim()).filter(Boolean)) reachable.add(name.replace(/Action$/, ""));
      }
    }

    expect([...reachable].sort()).toEqual(["commitClassScheduleImportBatch", "createClassScheduleImportBatch", "dryRunClassScheduleImport"]);
    expect(Object.keys(previewClassImportActions).sort()).toEqual([...reachable].sort());
    expect(Object.keys(previewClassImportConflictActions).sort()).toEqual([...reachable].sort());
  });

  it("answers writes with the stub message and the dry-run with fixture results", async () => {
    const createInput = {} as Parameters<typeof previewClassImportActions.createClassScheduleImportBatch>[0];
    const commitInput = {} as Parameters<typeof previewClassImportActions.commitClassScheduleImportBatch>[0];
    const dryRunInput = {} as Parameters<typeof previewClassImportActions.dryRunClassScheduleImport>[0];

    for (const stubs of [previewClassImportActions, previewClassImportConflictActions]) {
      expect(await stubs.createClassScheduleImportBatch(createInput)).toEqual({ code: "forbidden", message: STUB, ok: false });
      expect(await stubs.commitClassScheduleImportBatch(commitInput)).toEqual({ code: "forbidden", message: STUB, ok: false });
    }
    expect(await previewClassImportActions.dryRunClassScheduleImport(dryRunInput)).toEqual({ data: CLASS_IMPORT_PREVIEW_DRY_RUN, ok: true });
    expect(await previewClassImportConflictActions.dryRunClassScheduleImport(dryRunInput)).toEqual({
      data: CLASS_IMPORT_PREVIEW_DRY_RUN_WITH_ERRORS,
      ok: true,
    });
    expectNothingReal();
  });

  it("keeps the batch target, the back link and the class links under /dev", () => {
    expect(CLASS_IMPORT_PREVIEW_BATCH_HREF).toBe("/dev/imports?view=class-batch&state=ready");
    expect(CLASS_IMPORT_PREVIEW_IMPORT_HREF).toBe("/dev/imports?view=classes");
    expect(CLASS_IMPORT_PREVIEW_CLASS_HREF).toBe("/dev/class?state=active");
    const source = readFileSync(join(process.cwd(), "src/app/dev/imports/class-import-preview.tsx"), "utf8");
    expect(source).toContain("batchHref={() => CLASS_IMPORT_PREVIEW_BATCH_HREF}");
    expect(source).toContain("importHref={CLASS_IMPORT_PREVIEW_IMPORT_HREF}");
    expect(source).toContain("classHref={() => CLASS_IMPORT_PREVIEW_CLASS_HREF}");
  });
});

describe("/dev/imports class wizard states", () => {
  it("file: opens on the file step", () => {
    renderBody({ role: "owner", state: "file", view: "classes" });

    expect(stepStates()).toEqual(["current", "upcoming", "upcoming", "upcoming", "upcoming"]);
    expect(screen.getByLabelText("Chọn file Excel")).toHaveAttribute("type", "file");
    expectLinksStayInPreview();
    expectNothingReal();
  });

  it("mapping: opens the clean file's mapping and runs the stubbed check into the review", async () => {
    renderBody({ role: "owner", state: "mapping", view: "classes" });

    expect(stepStates()).toEqual(["done", "current", "upcoming", "upcoming", "upcoming"]);
    expect(screen.getByText("lop-lich-hoc-2026-2027.xlsx · 6 lớp · 10 lịch học")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra dòng" }));

    expect(await screen.findByRole("table", { name: "Kết quả kiểm tra 6 dòng lớp học" })).toBeInTheDocument();
    expect(stepStates()).toEqual(["done", "done", "current", "upcoming", "upcoming"]);
    expectNothingReal();
  });

  it("review-clean: reaches 'Tạo lô' and answers it with the stub message", async () => {
    renderBody({ role: "owner", state: "review-clean", view: "classes" });
    expect(stepStates()).toEqual(["done", "done", "current", "upcoming", "upcoming"]);

    fireEvent.click(screen.getByRole("button", { name: "Tiếp tục: Tạo lô" }));
    fireEvent.change(screen.getByLabelText("Lý do tạo lô"), { target: { value: "Xem thử" } });
    fireEvent.click(screen.getByLabelText("Tôi đã xem kết quả kiểm tra và muốn lưu file này thành lô chờ xác nhận."));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Tạo lô" }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(STUB);
    expectLinksStayInPreview();
    expectNothingReal();
  });

  it("review-conflicts: shows the broken file's rows and blocks the batch", () => {
    renderBody({ role: "owner", state: "review-conflicts", view: "classes" });

    expect(screen.getByText("lop-lich-hoc-2026-2027-ban-cu.xlsx · 7 lớp · 11 lịch học")).toBeInTheDocument();
    const next = screen.getByRole("button", { name: "Tiếp tục: Tạo lô" });
    expect(next).toBeDisabled();
    expect(next).toHaveAccessibleDescription("Còn 4 dòng xung đột hoặc không hợp lệ. Sửa file Excel rồi chọn lại file.");
    expectNothingReal();
  });
});

describe("/dev/imports class batch states", () => {
  it("ready: offers the commit and answers it with the stub message", async () => {
    renderBody({ role: "owner", state: "ready", view: "class-batch" });

    expect(stepStates()).toEqual(["done", "done", "done", "done", "current"]);
    expect(screen.getByRole("link", { name: "Về trang nhập lớp & lịch học" })).toHaveAttribute("href", CLASS_IMPORT_PREVIEW_IMPORT_HREF);
    fireEvent.click(screen.getByLabelText("Tôi đã kiểm tra lô và đồng ý tạo các lớp và lịch học mới."));
    fireEvent.change(screen.getByLabelText("Gõ IMPORT LOP LICH để xác nhận"), { target: { value: "IMPORT LOP LICH" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Nhập lớp & lịch học" }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(STUB);
    expect(screen.getByText("Chờ xác nhận nhập")).toBeInTheDocument();
    expectLinksStayInPreview();
    expectNothingReal();
  });

  it.each([
    { badge: "Đã nhập", state: "committed" as const, steps: ["done", "done", "done", "done", "done"] },
    { badge: "Không nhập được", state: "previewed" as const, steps: ["done", "done", "done", "done", "current"] },
  ])("$state: shows the batch without a commit panel", ({ badge, state, steps }) => {
    renderBody({ role: "owner", state, view: "class-batch" });

    expect(within(screen.getByRole("banner")).getByText(badge)).toBeInTheDocument();
    expect(stepStates()).toEqual(steps);
    expect(screen.queryByRole("button", { name: "Nhập lớp & lịch học" })).toBeNull();
    expectLinksStayInPreview();
    expectNothingReal();
  });

  // Value: protects=the committed batch's six "Mở lớp" links all open the /dev class preview, so the link check above is not passing on an empty set;
  // fails_when=the preview stops passing classHref (the links go back to /classes/<fixture id>, which is no real class) or the class links vanish;
  // why_new=the batch page's class target became injectable; before it the preview linked to real /classes/<id> pages;
  // seam=same as the file; no_claim=does not prove /dev/class renders this class (it shows its own fixture class)
  it("committed: every 'Mở lớp' opens the /dev class preview", () => {
    renderBody({ role: "owner", state: "committed", view: "class-batch" });

    const links = within(screen.getByRole("table", { name: "6 dòng lớp học trong lô" })).getAllByRole("link", { name: /^Mở lớp / });
    expect(links).toHaveLength(6);
    for (const link of links) expect(link).toHaveAttribute("href", CLASS_IMPORT_PREVIEW_CLASS_HREF);
    expectNothingReal();
  });
});

describe("/dev/imports class roles", () => {
  it.each(["maker", "viewer"] as ImportsPreviewRole[])("%s gets the routes' denials and no page", (role) => {
    renderBody({ role, state: "review-clean", view: "classes" });
    expect(screen.getByRole("heading", { name: "Không có quyền import lớp & lịch học" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Các bước nhập lớp & lịch học" })).toBeNull();
    cleanup();

    renderBody({ role, state: "ready", view: "class-batch" });
    expect(screen.getByRole("heading", { name: "Không có quyền truy cập" })).toBeInTheDocument();
    expect(screen.getByText("Tài khoản hiện tại không có quyền xem chi tiết batch import lớp học & lịch học.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nhập lớp & lịch học" })).toBeNull();
    expectNothingReal();
  });
});

describe("/dev/imports class fixtures", () => {
  function counts(rows: readonly { classification: string }[]): ClassScheduleImportSummaryCount {
    const of = (value: string) => rows.filter((row) => row.classification === value).length;
    return { existing_conflict: of("existing_conflict"), existing_matching: of("existing_matching"), invalid: of("invalid"), new: of("new"), total: rows.length };
  }

  it("agree with themselves: summaries, workbook rows and batch counts", () => {
    for (const [workbook, result] of [
      [CLASS_IMPORT_PREVIEW_WORKBOOK, CLASS_IMPORT_PREVIEW_DRY_RUN],
      [CLASS_IMPORT_PREVIEW_WORKBOOK_WITH_ERRORS, CLASS_IMPORT_PREVIEW_DRY_RUN_WITH_ERRORS],
    ] as const) {
      expect(result.class_summary).toEqual(counts(result.class_rows));
      expect(result.schedule_summary).toEqual(counts(result.schedule_rows));
      expect(workbook.classesSheet.rowCount).toBe(result.class_rows.length);
      expect(workbook.schedulesSheet.rowCount).toBe(result.schedule_rows.length);
      for (const row of result.schedule_rows) expect(row.weekday).toBeGreaterThanOrEqual(1);
      for (const row of result.schedule_rows) expect(row.weekday).toBeLessThanOrEqual(7);
    }

    for (const state of ["ready", "committed", "previewed"] as const) {
      const { batch, classRows, scheduleRows } = getClassBatchPreviewDetail(state);
      expect(batch.class_row_count).toBe(classRows.length);
      expect(batch.schedule_row_count).toBe(scheduleRows.length);
      expect(new Set([...classRows, ...scheduleRows].map((row) => row.id)).size).toBe(classRows.length + scheduleRows.length);
    }
    expect(getClassBatchPreviewDetail("ready").batch.status).toBe("ready_to_commit");
    expect(getClassBatchPreviewDetail("previewed").batch.status).toBe("previewed");
    expect(getClassBatchPreviewDetail("committed").batch.status).toBe("committed");
  });

  it("auto-map without issues, so the mapping state opens ready to check", () => {
    for (const workbook of [CLASS_IMPORT_PREVIEW_WORKBOOK, CLASS_IMPORT_PREVIEW_WORKBOOK_WITH_ERRORS]) {
      expect(validateClassesMapping(autoMapClassesSheet(workbook.classesSheet).mapping).isValid).toBe(true);
      expect(validateSchedulesMapping(autoMapSchedulesSheet(workbook.schedulesSheet).mapping).isValid).toBe(true);
    }
  });
});
