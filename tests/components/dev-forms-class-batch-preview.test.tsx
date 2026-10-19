// Value: protects=the /dev/forms class form and batch previews (design 17b) are inert and truthful per role: every class/batch write the components can reach has a stub (checked against the components' own imports), saving or creating answers "Bản xem trước không ghi dữ liệu." without calling a real action, refreshing or navigating, the batch class switch swaps fixtures instead of replacing the URL, no preview link points into a live write route (/students/new, /classes/new, /sessions/batch, /imports/*), the TA and the viewer meet the routes' own denials (class: classes.create on create, classes.view on edit; batch: classes.view for the TA, sessions.manage for the viewer), and each state shows what it names (no-year, error, holidays, capped, empty) on the fixed clock;
// fails_when=a new action is imported by the form or the workspace without a stub, a stub calls through, a preview pushes/replaces/refreshes, a fixture link reaches a live write route, a denial's copy drifts from the route's, or a state stops showing its case (e.g. holidays stop unticking, the cap stops disabling the primary);
// why_new=step 15a replaces the class and batch preview placeholders of /dev/forms;
// seam=the class and session-batch action modules are mocked so any real call is observable; next/navigation offers useRouter with push/replace/refresh; bodies render without the AppShell (the controller wraps them); no_claim=the /dev/forms page wiring and production 404 (dev-forms-page.test.tsx), the real actions
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BatchPreviewBody, previewBatchActions } from "@/app/dev/forms/batch-preview";
import { getPreviewBatchContext, PREVIEW_BATCH_CLASSES } from "@/app/dev/forms/class-batch-fixtures";
import { ClassFormPreviewBody, previewClassFormActions } from "@/app/dev/forms/class-form-preview";
import * as classActions from "@/features/classes/actions/class-actions";
import {
  CLASS_CREATE_DENIED,
  CLASS_EDIT_VIEW_DENIED,
  CLASS_EDIT_YEAR_CLOSED,
} from "@/features/classes/management/class-form-route-copy";
import * as batchActions from "@/features/sessions/actions/session-batch-actions";
import { BATCH_CLASSES_VIEW_DENIED, BATCH_SESSIONS_MANAGE_DENIED } from "@/features/sessions/session-batch-route-copy";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/classes/actions/class-actions", () => ({
  changeClassStatusAction: vi.fn(),
  createClassAction: vi.fn(),
  updateClassAction: vi.fn(),
}));
vi.mock("@/features/sessions/actions/session-batch-actions", () => ({
  checkBatchSessionConflictsAction: vi.fn(),
  createBatchSessionsAction: vi.fn(),
}));

const STUB = "Bản xem trước không ghi dữ liệu.";
const LIVE_WRITE_ROUTES = /^\/(students\/new|classes\/new|sessions\/batch|imports)(\/|\?|$)/;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function expectNothingReal() {
  for (const action of [...Object.values(classActions), ...Object.values(batchActions)]) {
    expect(action).not.toHaveBeenCalled();
  }
  expect(router.push).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
  expect(router.refresh).not.toHaveBeenCalled();
}

function expectNoLiveWriteLinks(container: HTMLElement) {
  const hrefs = Array.from(container.querySelectorAll("a[href]")).map((link) => link.getAttribute("href")!);
  expect(hrefs.filter((href) => LIVE_WRITE_ROUTES.test(href))).toEqual([]);
}

/** Value names a source file imports from a module (type-only imports excluded). */
function importedValues(file: string, modules: readonly string[]): string[] {
  const source = readFileSync(join(process.cwd(), file), "utf8");
  const names: string[] = [];
  for (const match of source.matchAll(/import\s*(type\s*)?\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
    if (match[1] || !modules.includes(match[3])) continue;
    for (const part of match[2].split(",").map((item) => item.trim()).filter(Boolean)) {
      if (!part.startsWith("type ")) names.push(part);
    }
  }
  return names.sort();
}

describe("/dev/forms class and batch stubs", () => {
  it("stub every class-form action the form imports", () => {
    const reachable = importedValues("src/features/classes/management/class-form-page.tsx", ["@/features/classes/actions/class-actions"]);
    expect(reachable).toEqual(["createClassAction", "updateClassAction"]);
    expect(Object.keys(previewClassFormActions).sort()).toEqual(reachable.map((name) => name.replace(/Action$/, "")));
  });

  it("stub every batch action the workspace and grid import", () => {
    const modules = ["../actions/session-batch-actions", "@/features/sessions/actions/session-batch-actions"];
    const reachable = [
      ...importedValues("src/features/sessions/components/batch-session-create-workspace.tsx", modules),
      ...importedValues("src/features/sessions/components/batch-preview-grid.tsx", modules),
    ];
    expect(reachable).toEqual(["createBatchSessionsAction"]);
    expect(Object.keys(previewBatchActions)).toEqual(["createBatchSessions"]);
  });
});

describe("/dev/forms class form preview", () => {
  it("owner create: saving answers with the stub and goes nowhere", async () => {
    const { container } = render(<ClassFormPreviewBody role="owner" state="clean" view="class" />);

    expect(screen.getByRole("heading", { level: 1, name: "Tạo lớp" })).toBeInTheDocument();
    expect((screen.getByLabelText("Năm học") as HTMLSelectElement).selectedOptions[0]).toHaveTextContent("(hiện tại)");
    fireEvent.change(screen.getByLabelText("Tên lớp"), { target: { value: "Toán 7A" } });
    fireEvent.change(screen.getByLabelText("Mã lớp"), { target: { value: "7a1" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu lớp (Nháp)" }));

    await waitFor(() => expect(screen.getByText(STUB)).toBeInTheDocument());
    expectNothingReal();
    expectNoLiveWriteLinks(container);
  });

  it("owner create states: no open year blocks the save; error shows the field error and the message", () => {
    render(<ClassFormPreviewBody role="owner" state="no-year" view="class" />);
    expect(screen.getByText("Chưa có năm học đang mở")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu lớp (Nháp)" })).toBeDisabled();
    cleanup();

    render(<ClassFormPreviewBody role="owner" state="error" view="class" />);
    expect(screen.getByLabelText("Mã lớp")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Mã lớp")).toHaveAccessibleDescription("Mã lớp chỉ gồm chữ in hoa, số và các dấu . _ -.");
    expect(screen.getByText("Vui lòng kiểm tra lại thông tin lớp học.")).toBeInTheDocument();
    expectNothingReal();
  });

  it("owner edit: a draft class whose steps never link into the batch tool; error and closed-year states", async () => {
    const { container } = render(<ClassFormPreviewBody role="owner" state="clean" view="class-edit" />);
    expect(screen.getByRole("heading", { level: 1, name: "Chỉnh sửa lớp học" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Lịch tuần" })).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/classes/cls-preview",
    ]);
    expectNoLiveWriteLinks(container);
    cleanup();

    render(<ClassFormPreviewBody role="owner" state="error" view="class-edit" />);
    expect(screen.getByText("Không thể đổi năm học, mã lớp, khối hoặc trình độ sau khi lớp đã được sử dụng.")).toBeInTheDocument();
    expect((screen.getByLabelText("Khối") as HTMLSelectElement).value).toBe("7");
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(screen.getByText(STUB)).toBeInTheDocument());
    expectNothingReal();
    cleanup();

    render(<ClassFormPreviewBody role="owner" state="no-year" view="class-edit" />);
    expect(screen.getByRole("heading", { name: CLASS_EDIT_YEAR_CLOSED.title })).toBeInTheDocument();
    expect(screen.getByText(CLASS_EDIT_YEAR_CLOSED.description)).toBeInTheDocument();
  });

  it.each(["ta", "viewer"] as const)("%s meets the routes' denials", (role) => {
    render(<ClassFormPreviewBody role={role} state="clean" view="class" />);
    expect(screen.getByRole("heading", { level: 1, name: CLASS_CREATE_DENIED.title })).toBeInTheDocument();
    expect(screen.getByText(CLASS_CREATE_DENIED.description)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu lớp (Nháp)" })).not.toBeInTheDocument();
    cleanup();

    render(<ClassFormPreviewBody role={role} state="clean" view="class-edit" />);
    expect(screen.getByRole("heading", { level: 1, name: CLASS_EDIT_VIEW_DENIED.title })).toBeInTheDocument();
    expect(screen.getByText(CLASS_EDIT_VIEW_DENIED.description)).toBeInTheDocument();
  });
});

describe("/dev/forms batch preview", () => {
  it("owner default: today's count mode with one out-of-window and one existing session; creating answers with the stub", async () => {
    const { container } = render(<BatchPreviewBody role="owner" state="default" view="batch" />);

    expect(screen.getByRole("heading", { level: 1, name: "Tạo buổi học hàng loạt" })).toBeInTheDocument();
    expect((screen.getByLabelText("Bắt đầu từ ngày") as HTMLInputElement).value).toBe("2026-10-19");
    expect(screen.getByText(/buổi sẽ tạo/)).toHaveTextContent(
      "8 buổi sẽ tạo · 0 ngày nghỉ bỏ qua · 1 trùng buổi đã có (bỏ qua) · 1 buổi ngoài thời gian hiệu lực của lịch (bỏ qua)",
    );
    expect(screen.getByLabelText("Chọn buổi học ngày 23/10/2026")).toBeDisabled();
    expect(screen.getByLabelText("Chọn buổi học ngày 03/11/2026").closest("label")).toHaveTextContent("đã có");
    expect(screen.getByText("Đã có 9 buổi")).toBeInTheDocument();
    expectNoLiveWriteLinks(container);

    fireEvent.click(screen.getByRole("button", { name: "Tạo hàng loạt (8 buổi học)" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xác nhận tạo" }));
    await waitFor(() => expect(screen.getByText(STUB)).toBeInTheDocument());
    expectNothingReal();
  });

  it("switches class in place instead of navigating to the live route", () => {
    render(<BatchPreviewBody role="owner" state="default" view="batch" />);
    fireEvent.change(screen.getByLabelText(/Chọn lớp học áp dụng/), { target: { value: "cls-9a2" } });

    expect((screen.getByLabelText(/Chọn lớp học áp dụng/) as HTMLSelectElement).value).toBe("cls-9a2");
    expect(screen.getByText("Đã có 5 buổi")).toBeInTheDocument();
    expect(screen.getByText(/^Trình độ A$/)).toBeInTheDocument();
    expectNothingReal();
  });

  it("holidays: Teachers' Day and New Year's Day untick the Friday sessions", () => {
    render(<BatchPreviewBody role="owner" state="holidays" view="batch" />);

    const listed = within(screen.getByRole("list", { name: "Ngày nghỉ đã thêm" })).getAllByRole("listitem");
    expect(listed.map((item) => item.textContent)).toEqual(["20/11/2026 · bỏ 1 buổi", "01/01/2027 · bỏ 1 buổi"]);
    expect(screen.getByText(/buổi sẽ tạo/)).toHaveTextContent("22 buổi sẽ tạo · 2 ngày nghỉ bỏ qua · 2 trùng buổi đã có (bỏ qua)");
    expect(screen.getByText(/Đã chọn:/)).toHaveTextContent("22 / 26 buổi");
    expect(screen.getByLabelText("Chọn buổi học ngày 20/11/2026")).toBeDisabled();
  });

  it("capped: more than 100 sessions disable the primary with the reason", () => {
    render(<BatchPreviewBody role="owner" state="capped" view="batch" />);

    const primary = screen.getByRole("button", { name: /^Tạo hàng loạt \((\d+) buổi học\)$/ });
    const count = Number(/\((\d+) buổi học\)/.exec(primary.textContent ?? "")?.[1]);
    expect(count).toBeGreaterThan(100);
    expect(primary).toBeDisabled();
    expect(primary).toHaveAccessibleDescription("Mỗi đợt tạo tối đa 100 buổi học.");
  });

  it("empty: no session to preview, and nothing to create", () => {
    render(<BatchPreviewBody role="owner" state="empty" view="batch" />);
    expect(screen.getByText("Chưa có buổi học nào được tính toán.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo hàng loạt (0 buổi học)" })).toHaveAccessibleDescription("Cần chọn ít nhất 1 buổi học để tạo.");
  });

  it("the TA meets the classes.view denial, the viewer the sessions.manage one", () => {
    render(<BatchPreviewBody role="ta" state="default" view="batch" />);
    expect(screen.getByRole("heading", { level: 1, name: BATCH_CLASSES_VIEW_DENIED.title })).toBeInTheDocument();
    expect(screen.getByText(BATCH_CLASSES_VIEW_DENIED.description)).toBeInTheDocument();
    expect(screen.queryAllByLabelText(/Chọn buổi học ngày/)).toHaveLength(0);
    cleanup();

    render(<BatchPreviewBody role="viewer" state="default" view="batch" />);
    expect(screen.getByRole("heading", { level: 1, name: BATCH_SESSIONS_MANAGE_DENIED.title })).toBeInTheDocument();
    expect(screen.getByText(BATCH_SESSIONS_MANAGE_DENIED.description)).toBeInTheDocument();
  });

  it("fixtures look like the loader's answer: active classes, newest-first non-cancelled sessions, the class's own templates", () => {
    for (const option of PREVIEW_BATCH_CLASSES) {
      const context = getPreviewBatchContext(option.id);
      expect(context.existingSessionCount).toBe(context.existingSessions.length);
      const dates = context.existingSessions.map((session) => session.sessionDate);
      expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
      expect(context.schedules.length).toBeGreaterThan(0);
      expect(context.schedules.every((schedule) => schedule.classId === option.id)).toBe(true);
    }
  });
});
