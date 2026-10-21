// Value: protects=the /imports/classes/[batchId] page (design 17c step 5, step 15b): the status badge in words per batch status (ready_to_commit "Chờ xác nhận nhập", previewed "Không nhập được", committed "Đã nhập", rejected, unknown shown raw); the same five-step Stepper with steps 1–4 done and "Xác nhận nhập" current, or all done once committed; created/committed times in Vietnam time whatever the runtime zone; the actor as the stored account id; both summary strips; "Lớp sẽ được tạo" / "Lịch học sẽ được tạo" (weekday in words) only while ready; the commit panel only in ready_to_commit, disabled until 0 conflicts/invalid, a reason, the checkbox and the exact server phrase "IMPORT LOP LICH" (lowercase never passes), sending a payload the server schema accepts; after a commit the page shows the result and refreshes; errors inline, a lost connection says the result is unknown and refreshes; class links per staged row (the real /classes/<id> by default, an injected classHref otherwise); the five-step stepper classes of the wizard frame; a new detail from the server replaces the local copy;
// fails_when=the commit can run from another status, with conflict/invalid counts, without reason/checkbox, or with any other phrase (or the sent text stops matching the schema), the phrase gets visually uppercased again, a timestamp is printed in the runtime zone, a weekday prints as "Thứ 1", a status loses its words, the class links disappear or ignore an injected classHref, or the page stops falling back to the real commit action;
// why_new=the batch page had no test (step 15 map §0 finding 2) and step 15b rebuilds it with the shared Stepper, GuardedActionPanel and an action override;
// seam=next/navigation useRouter (refresh spy) and the actions module are mocked; detail fixtures come from the /dev/imports class fixtures (with targeted overrides); jsdom has no ResizeObserver so row tables render as tables;
// no_claim=does not prove the commit RPC, the route's loader or gate (class-import-routes.test.tsx), or the visual layout
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CLASS_IMPORT_PREVIEW_BATCH_ID, getClassBatchPreviewDetail } from "@/app/dev/imports/class-import-fixtures";
import * as realActions from "@/features/imports/classes/actions";
import { ClassScheduleBatchDetailPage, CLASS_IMPORT_COMMIT_PHRASE } from "@/features/imports/classes/class-schedule-batch-detail-page";
import { commitClassScheduleImportBatchSchema } from "@/features/imports/classes/schemas";
import type { ClassScheduleImportBatchDetail, ClassScheduleImportBatchRecord } from "@/features/imports/classes/types";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/imports/classes/actions", () => ({
  commitClassScheduleImportBatchAction: vi.fn(),
  createClassScheduleImportBatchAction: vi.fn(),
  dryRunClassScheduleImportAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const COMMITTED_AT = "2026-10-19T03:15:00.000Z";

function committedRecord(batch: ClassScheduleImportBatchRecord): ClassScheduleImportBatchRecord {
  return { ...batch, committed_at: COMMITTED_AT, committed_by: batch.created_by, status: "committed" };
}

function withBatch(detail: ClassScheduleImportBatchDetail, overrides: Partial<ClassScheduleImportBatchRecord>): ClassScheduleImportBatchDetail {
  return { ...detail, batch: { ...detail.batch, ...overrides } };
}

function renderPage(
  detail: ClassScheduleImportBatchDetail,
  commit = vi.fn<typeof realActions.commitClassScheduleImportBatchAction>(async () => ({ data: committedRecord(detail.batch), ok: true })),
) {
  const view = render(<ClassScheduleBatchDetailPage actions={{ commitClassScheduleImportBatch: commit }} detail={detail} />);
  return { commit, ...view };
}

const stepStates = () =>
  within(screen.getByRole("list", { name: "Các bước nhập lớp & lịch học" }))
    .getAllByRole("listitem")
    .map((item) => item.getAttribute("data-state"));
const header = () => screen.getByRole("banner");
const factValue = (label: string) => screen.getByText(label, { selector: "dt" }).nextElementSibling;
const commitPanel = () => screen.queryByRole("region", { name: "Xác nhận nhập" });
const commitButton = () => screen.getByRole("button", { name: "Nhập lớp & lịch học" });
const checkbox = () => screen.getByLabelText("Tôi đã kiểm tra lô và đồng ý tạo các lớp và lịch học mới.");
const phrase = () => screen.getByLabelText("Gõ IMPORT LOP LICH để xác nhận");

describe("ClassScheduleBatchDetailPage: ready batch", () => {
  it("shows the status, the stepper at 'Xác nhận nhập', the facts in Vietnam time and both summaries", () => {
    renderPage(getClassBatchPreviewDetail("ready"));

    expect(within(header()).getByRole("heading", { level: 1, name: "Lô nhập lớp & lịch học" })).toBeInTheDocument();
    expect(within(header()).getByText("Chờ xác nhận nhập")).toBeInTheDocument();
    expect(within(header()).getByText("lop-lich-hoc-2026-2027.xlsx · 6 lớp · 10 lịch học · năm học 2026-2027")).toBeInTheDocument();
    expect(within(header()).getByRole("link", { name: "Về trang nhập lớp & lịch học" })).toHaveAttribute("href", "/imports/classes");

    expect(stepStates()).toEqual(["done", "done", "done", "done", "current"]);
    // Deliberate equal-strength copy edit (step 15b review): the rows section follows the commit panel, so "ở cuối trang" was wrong.
    expect(screen.getByText("Kiểm tra lô rồi xác nhận ở mục Xác nhận nhập bên dưới")).toBeInTheDocument();
    // The wizard frame's five-step classes: five columns at xl, the odd last step without a doubled right rule.
    const stepperClassName = screen.getByRole("list", { name: "Các bước nhập lớp & lịch học" }).className;
    expect(stepperClassName).toContain("xl:grid-cols-5!");
    expect(stepperClassName).toContain("[&>li:last-child]:border-r-0!");

    expect(factValue("Tạo lô lúc")).toHaveTextContent("19/10/2026 09:40");
    expect(factValue("Người tạo lô")).toHaveTextContent("Tài khoản d0000000…");
    expect(within(factValue("Người tạo lô") as HTMLElement).getByTitle("d0000000-0000-4000-8000-000000000001")).toBeInTheDocument();
    expect(factValue("Lý do tạo lô")).toHaveTextContent("Nhập lớp và lịch học đầu năm học 2026-2027");
    expect(screen.queryByText("Nhập lúc", { selector: "dt" })).toBeNull();

    expect(within(screen.getByLabelText("Tổng quan Lớp học (sheet Classes)")).getAllByRole("definition").map((cell) => cell.textContent)).toEqual([
      "6",
      "4",
      "2",
      "0",
      "0",
    ]);
    expect(within(screen.getByLabelText("Tổng quan Lịch học (sheet Schedules)")).getAllByRole("definition").map((cell) => cell.textContent)).toEqual([
      "10",
      "8",
      "2",
      "0",
      "0",
    ]);
  });

  it("lists the classes and schedules the commit will create, weekdays in words", () => {
    renderPage(getClassBatchPreviewDetail("ready"));

    const classes = screen.getByRole("table", { name: "Lớp sẽ được tạo (4)" });
    expect(within(classes).getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0].textContent)).toEqual([
      "6A1",
      "6A2",
      "7A1",
      "8A1",
    ]);
    expect(within(classes).getByText("Nháp")).toBeInTheDocument();
    const schedules = screen.getByRole("table", { name: "Lịch học sẽ được tạo (8)" });
    expect(within(schedules).getAllByRole("row")).toHaveLength(9);
    expect(within(schedules).getByText("Chủ nhật")).toBeInTheDocument();
    expect(within(schedules).getAllByText("từ 02/11/2026").length).toBeGreaterThan(0);
    expect(screen.getByText(/Đã có và khớp, được dùng lại/)).toHaveTextContent("Đã có và khớp, được dùng lại (không tạo trùng): 2 lớp · 2 lịch học.");

    fireEvent.click(screen.getByRole("tab", { name: /Lịch học/ }));
    expect(screen.getByRole("table", { name: "10 dòng lịch học trong lô" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Thứ [1-7]\b/);
  });

  it("says what the commit does, truthfully", () => {
    renderPage(getClassBatchPreviewDetail("ready"));

    const panel = commitPanel();
    expect(panel).not.toBeNull();
    expect(panel).toHaveTextContent(
      "Tạo 4 lớp mới và 8 lịch học mới trong năm học 2026-2027. Lớp mới nhận trạng thái ghi trong file (mặc định Đang hoạt động); lịch học có hiệu lực từ ngày ghi trong file. Không tạo buổi học nào.",
    );
    expect(panel).toHaveTextContent("Cả lô ghi trong một lần: nếu máy chủ từ chối thì không ghi gì.");
  });

  it("gates the commit on the reason, the checkbox and the exact phrase, then sends what the server schema accepts", async () => {
    const detail = getClassBatchPreviewDetail("ready");
    const { commit } = renderPage(detail);

    expect(CLASS_IMPORT_COMMIT_PHRASE).toBe("IMPORT LOP LICH");
    const reason = screen.getByLabelText("Lý do nhập");
    expect(reason).toHaveValue("Nhập lớp và lịch học đầu năm học 2026-2027");
    expect(commitButton()).toBeDisabled();
    expect(commitButton()).toHaveAccessibleDescription("Đánh dấu ô xác nhận.");

    fireEvent.click(checkbox());
    expect(commitButton()).toHaveAccessibleDescription("Gõ đúng cụm IMPORT LOP LICH.");

    fireEvent.change(phrase(), { target: { value: "import lop lich" } });
    expect(phrase()).toHaveValue("import lop lich");
    expect(phrase().className).not.toMatch(/\buppercase\b/);
    expect(commitButton()).toBeDisabled();

    fireEvent.change(phrase(), { target: { value: "IMPORT LOP LICH " } });
    expect(commitButton()).toBeEnabled();
    expect(screen.getByText("Đã gõ đúng cụm xác nhận")).toBeInTheDocument();

    fireEvent.change(reason, { target: { value: "   " } });
    expect(commitButton()).toBeDisabled();
    expect(commitButton()).toHaveAccessibleDescription("Nhập lý do nhập.");
    fireEvent.change(reason, { target: { value: "  Nhập lớp học kỳ 1  " } });

    await act(async () => {
      fireEvent.click(commitButton());
    });

    expect(commit).toHaveBeenCalledTimes(1);
    const payload = commit.mock.calls[0][0] as unknown;
    expect(payload).toEqual({
      batch_id: CLASS_IMPORT_PREVIEW_BATCH_ID,
      confirmation_checked: true,
      confirmation_text: "IMPORT LOP LICH",
      reason: "Nhập lớp học kỳ 1",
    });
    expect(commitClassScheduleImportBatchSchema.safeParse(payload).success).toBe(true);

    expect(await screen.findByText("Đã nhập lớp và lịch học.")).toBeInTheDocument();
    expect(within(header()).getByText("Đã nhập")).toBeInTheDocument();
    expect(commitPanel()).toBeNull();
    expect(stepStates()).toEqual(["done", "done", "done", "done", "done"]);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the commit disabled while the batch counts conflicts or invalid rows", () => {
    renderPage(withBatch(getClassBatchPreviewDetail("ready"), { schedule_invalid_count: 1 }));

    fireEvent.click(checkbox());
    fireEvent.change(phrase(), { target: { value: "IMPORT LOP LICH" } });

    expect(commitButton()).toBeDisabled();
    expect(commitButton()).toHaveAccessibleDescription("Còn 1 dòng xung đột hoặc không hợp lệ.");
    expect(screen.getByText("Còn 1 dòng xung đột hoặc không hợp lệ")).toBeInTheDocument();
  });

  it("shows a refused commit inline and does not refresh", async () => {
    const commit = vi.fn(async () => ({ code: "database_error" as const, message: "Batch này đã được import trước đó.", ok: false as const }));
    renderPage(getClassBatchPreviewDetail("ready"), commit as never);
    fireEvent.click(checkbox());
    fireEvent.change(phrase(), { target: { value: "IMPORT LOP LICH" } });
    fireEvent.click(commitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Batch này đã được import trước đó.");
    expect(within(header()).getByText("Chờ xác nhận nhập")).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("says the result is unknown and reloads the batch when the connection drops", async () => {
    const commit = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    renderPage(getClassBatchPreviewDetail("ready"), commit as never);
    fireEvent.click(checkbox());
    fireEvent.change(phrase(), { target: { value: "IMPORT LOP LICH" } });
    fireEvent.click(commitButton());

    expect(await screen.findByRole("alert")).toHaveTextContent("Không rõ kết quả. Mở lại trang lô để kiểm tra trước khi thử lại.");
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("falls back to the real commit action without overrides", async () => {
    const detail = getClassBatchPreviewDetail("ready");
    vi.mocked(realActions.commitClassScheduleImportBatchAction).mockResolvedValue({ data: committedRecord(detail.batch), ok: true });
    render(<ClassScheduleBatchDetailPage detail={detail} />);
    fireEvent.click(checkbox());
    fireEvent.change(phrase(), { target: { value: "IMPORT LOP LICH" } });
    fireEvent.click(commitButton());

    await waitFor(() => expect(realActions.commitClassScheduleImportBatchAction).toHaveBeenCalledTimes(1));
  });
});

describe("ClassScheduleBatchDetailPage: other statuses", () => {
  it("explains a batch that cannot be committed and shows no commit panel", () => {
    renderPage(getClassBatchPreviewDetail("previewed"));

    expect(within(header()).getByText("Không nhập được")).toBeInTheDocument();
    expect(stepStates()).toEqual(["done", "done", "done", "done", "current"]);
    expect(screen.getByText("Lô này không nhập được")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Lô này không nhập được. Còn 4 dòng xung đột hoặc không hợp lệ. Lô đã tạo không sửa được và cùng một file không tạo lại được lô: sửa file Excel rồi tạo lô mới từ file đã sửa.",
    );
    expect(commitPanel()).toBeNull();
    expect(screen.queryByRole("button", { name: "Nhập lớp & lịch học" })).toBeNull();
    expect(screen.queryByRole("table", { name: /sẽ được tạo/ })).toBeNull();

    const chips = screen.getByRole("group", { name: "Lọc dòng cần xem" });
    expect(within(chips).getByRole("button", { name: "Cần xem2", pressed: true })).toBeInTheDocument();
  });

  it("shows a committed batch with every step done, the commit time and the class links", () => {
    const detail = getClassBatchPreviewDetail("committed");
    renderPage(detail);

    expect(within(header()).getByText("Đã nhập")).toBeInTheDocument();
    expect(stepStates()).toEqual(["done", "done", "done", "done", "done"]);
    expect(screen.getByText("Đã nhập lúc 19/10/2026 10:15")).toBeInTheDocument();
    expect(factValue("Nhập lúc")).toHaveTextContent("19/10/2026 10:15");
    expect(factValue("Người nhập")).toHaveTextContent("Tài khoản d0000000…");
    expect(screen.getByText("Đã nhập lớp và lịch học.")).toBeInTheDocument();
    expect(commitPanel()).toBeNull();

    const table = screen.getByRole("table", { name: "6 dòng lớp học trong lô" });
    expect(within(table).getAllByText("Đã nhập")).toHaveLength(6);
    const firstClass = detail.classRows[0];
    expect(within(table).getByRole("link", { name: "Mở lớp 6A1" })).toHaveAttribute("href", `/classes/${firstClass.resolved_class_id}`);
    expect(within(table).getAllByRole("link")).toHaveLength(6);
  });

  it("marks a staged row without a class id as 'Chưa có'", () => {
    renderPage(getClassBatchPreviewDetail("ready"));
    const table = screen.getByRole("table", { name: "6 dòng lớp học trong lô" });

    expect(within(table).getAllByText("Chưa có")).toHaveLength(4);
    expect(within(table).getByRole("link", { name: "Mở lớp 9A1" })).toHaveAttribute("href", "/classes/c1a55000-0000-4000-8000-000000000009");
  });

  // Value: protects=the "Mở lớp" links default to the real class page /classes/<id> and follow an injected `classHref` (called with the staged row's class id) when one is passed;
  // fails_when=the default route changes, the page ignores `classHref` (the /dev preview would leave /dev again) or calls it with another id;
  // why_new=the `classHref` prop is new (the target was hard-coded, so /dev/imports class-batch links opened real class pages);
  // seam=none (props only); no_claim=does not prove the /dev preview passes a /dev target (dev-imports-class-preview.test.tsx) or that the class page exists
  it("links each staged class to /classes/<id> by default and to an injected classHref otherwise", () => {
    const detail = getClassBatchPreviewDetail("committed");
    const firstClass = detail.classRows[0];
    render(<ClassScheduleBatchDetailPage detail={detail} />);
    const defaultLinks = within(screen.getByRole("table", { name: "6 dòng lớp học trong lô" })).getAllByRole("link");
    expect(defaultLinks.map((link) => link.getAttribute("href"))).toEqual(detail.classRows.map((row) => `/classes/${row.resolved_class_id}`));
    cleanup();

    const classHref = vi.fn((classId: string) => `/dev/class?state=active&id=${classId}`);
    render(<ClassScheduleBatchDetailPage classHref={classHref} detail={detail} />);
    const table = screen.getByRole("table", { name: "6 dòng lớp học trong lô" });
    expect(within(table).getByRole("link", { name: "Mở lớp 6A1" })).toHaveAttribute("href", `/dev/class?state=active&id=${firstClass.resolved_class_id}`);
    expect(classHref).toHaveBeenCalledWith(firstClass.resolved_class_id);
    for (const link of within(table).getAllByRole("link")) expect(link.getAttribute("href")).toMatch(/^\/dev\/class\?/);
  });

  it.each([
    { label: "Đã từ chối", status: "rejected" },
    { label: "Trạng thái chưa hỗ trợ: archived", status: "archived" },
  ])("names the $status status in words and offers no commit", ({ label, status }) => {
    renderPage(withBatch(getClassBatchPreviewDetail("ready"), { status: status as ClassScheduleImportBatchRecord["status"] }));

    expect(within(header()).getByText(label)).toBeInTheDocument();
    expect(commitPanel()).toBeNull();
  });

  it("prints times in Vietnam time across the date line", () => {
    renderPage(withBatch(getClassBatchPreviewDetail("ready"), { created_at: "2026-10-18T17:30:00.000Z" }));

    expect(factValue("Tạo lô lúc")).toHaveTextContent("19/10/2026 00:30");
  });

  it("replaces the local copy when the server sends a new detail", () => {
    const ready = getClassBatchPreviewDetail("ready");
    const { rerender } = renderPage(ready);
    expect(within(header()).getByText("Chờ xác nhận nhập")).toBeInTheDocument();

    rerender(<ClassScheduleBatchDetailPage detail={getClassBatchPreviewDetail("committed")} />);

    expect(within(header()).getByText("Đã nhập")).toBeInTheDocument();
    expect(commitPanel()).toBeNull();
  });
});
