import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdvanceListPage } from "@/features/advances/advance-list-page";
import { RequestSalaryAdvanceDialog } from "@/features/advances/components/request-salary-advance-dialog";
import { SalaryAdvanceDecisionDialog } from "@/features/advances/components/salary-advance-decision-dialog";
import type { SalaryAdvanceDashboardEntry } from "@/features/advances/read-models";

const actions = vi.hoisted(() => ({
  approveSalaryAdvanceAction: vi.fn(),
  requestSalaryAdvanceAction: vi.fn(),
  reviewSalaryAdvanceAction: vi.fn(),
}));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/advances/actions/advance-actions", () => actions);

const advance = (overrides: Partial<SalaryAdvanceDashboardEntry> = {}): SalaryAdvanceDashboardEntry => ({
  amountVnd: 125_000,
  approvalNote: null,
  approvedAt: null,
  approvedByDisplayName: null,
  deductedAt: null,
  deductionPayrollPeriodId: null,
  deductionPeriodMonth: "2026-09-01",
  id: "11111111-1111-4111-8111-111111111111",
  rejectedAt: null,
  rejectedByDisplayName: null,
  rejectionReason: null,
  requestNote: "Chi phí đi lại",
  requestedAt: "2026-08-11T08:00:00.000Z",
  reviewNote: null,
  reviewedAt: null,
  reviewedByDisplayName: null,
  staffDisplayName: "Nguyễn Minh An",
  staffEmployeeCode: "NS-001",
  staffId: "22222222-2222-4222-8222-222222222222",
  status: "requested",
  ...overrides,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Advances presentation", () => {
  it("renders supplied records in server order, all known textual statuses, and no unsupported aggregate", () => {
    const entries = [
      advance({ id: "requested", requestNote: "Yêu cầu đầu tiên", status: "requested" }),
      advance({ id: "review", requestNote: "Yêu cầu thứ hai", status: "review" }),
      advance({ id: "approved", requestNote: "Yêu cầu thứ ba", status: "approved" }),
      advance({ id: "rejected", requestNote: "Yêu cầu thứ tư", status: "rejected" }),
      advance({ id: "deducted", requestNote: "Yêu cầu thứ năm", status: "deducted" }),
    ];

    render(<AdvanceListPage canApprove canRequest canReview entries={entries} />);

    const table = screen.getByRole("table", { name: "Danh sách yêu cầu tạm ứng lương" });
    const text = table.textContent ?? "";
    expect(text.indexOf("Yêu cầu đầu tiên")).toBeLessThan(text.indexOf("Yêu cầu thứ hai"));
    expect(text.indexOf("Yêu cầu thứ hai")).toBeLessThan(text.indexOf("Yêu cầu thứ ba"));
    expect(screen.getAllByText("Chờ đối soát")).not.toHaveLength(0);
    expect(screen.getAllByText("Chờ phê duyệt")).not.toHaveLength(0);
    expect(screen.getAllByText("Đã phê duyệt")).not.toHaveLength(0);
    expect(screen.getAllByText("Đã từ chối")).not.toHaveLength(0);
    expect(screen.getAllByText("Đã khấu trừ")).not.toHaveLength(0);
    expect(screen.queryByText("Chờ khấu trừ")).not.toBeInTheDocument();
  });

  it("fails closed for ordinary and prototype-property raw statuses without lifecycle decisions", () => {
    render(<AdvanceListPage
      canApprove
      canRequest={false}
      canReview
      entries={[
        advance({ id: "ordinary-unknown", status: "archived_for_audit" }),
        advance({ id: "prototype-unknown", status: "constructor" }),
      ]}
    />);

    expect(screen.getAllByText("Trạng thái chưa hỗ trợ: archived_for_audit")).not.toHaveLength(0);
    expect(screen.getAllByText("Trạng thái chưa hỗ trợ: constructor")).not.toHaveLength(0);
    expect(screen.getAllByText("Không thể diễn giải trạng thái này.")).not.toHaveLength(0);
    expect(screen.queryByText("Chờ đối soát")).not.toBeInTheDocument();
    expect(screen.queryByText("Chờ phê duyệt")).not.toBeInTheDocument();
    expect(screen.queryByText("Đã phê duyệt")).not.toBeInTheDocument();
    expect(screen.queryByText("Đã từ chối")).not.toBeInTheDocument();
    expect(screen.queryByText("Đã khấu trừ")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đối soát" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Phê duyệt" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /từ chối/i })).not.toBeInTheDocument();
  });

  it("keeps lifecycle controls constrained to direct status and independent permissions", () => {
    const entries = [
      advance({ id: "requested", status: "requested" }),
      advance({ id: "review", status: "review" }),
      advance({ id: "approved", status: "approved" }),
      advance({ id: "rejected", status: "rejected" }),
      advance({ id: "deducted", status: "deducted" }),
    ];

    const { rerender } = render(<AdvanceListPage canApprove={false} canRequest={false} canReview entries={entries} />);
    expect(screen.getAllByRole("button", { name: "Đối soát" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Phê duyệt" })).not.toBeInTheDocument();

    rerender(<AdvanceListPage canApprove canRequest={false} canReview={false} entries={entries} />);
    expect(screen.queryByRole("button", { name: "Đối soát" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Phê duyệt" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /khấu trừ/i })).not.toBeInTheDocument();
  });

  it("uses the approved 1200/1202 container contract without client financial aggregation", () => {
    render(<AdvanceListPage canApprove={false} canRequest={false} canReview={false} entries={[advance()]} />);

    expect(screen.getByRole("table", { name: "Danh sách yêu cầu tạm ứng lương" }).closest(".salary-advance-directory-work-area")).not.toBeNull();
    expect(screen.getByRole("list", { name: "Danh sách yêu cầu tạm ứng lương" })).toBeInTheDocument();
    const globals = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    const source = readFileSync(resolve(process.cwd(), "src/features/advances/advance-list-page.tsx"), "utf8");
    expect(globals).toMatch(/\.salary-advance-directory-work-area\s*\{\s*container-type: inline-size/);
    expect(globals).toMatch(/@container \(min-width: 1202px\)[\s\S]*\.salary-advance-directory-table/);
    expect(source).toContain('min-w-[1200px]');
    expect(source).not.toContain(".reduce(");
    expect(source).not.toContain("approvedAmount");
    expect(source).not.toMatch(/lg:(block|hidden)/);
  });
});

describe("Salary Advance dialogs", () => {
  it("serializes the exact request payload and protects an unresolved request before refresh", async () => {
    const pending = deferred<{ message: string; status: "success" }>();
    actions.requestSalaryAdvanceAction.mockReturnValueOnce(pending.promise);
    render(<RequestSalaryAdvanceDialog />);

    const trigger = screen.getByRole("button", { name: "Yêu cầu tạm ứng" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Yêu cầu tạm ứng lương" });
    fireEvent.change(screen.getByLabelText("Số tiền (VND)"), { target: { value: "125000" } });
    fireEvent.change(screen.getByLabelText("Kỳ khấu trừ"), { target: { value: "2026-09" } });
    fireEvent.change(screen.getByLabelText("Lý do tạm ứng"), { target: { value: "Chi phí đi lại" } });
    const submit = within(dialog).getByRole("button", { name: "Gửi yêu cầu" });
    fireEvent.click(submit);

    await waitFor(() => expect(actions.requestSalaryAdvanceAction).toHaveBeenCalledWith({
      amountVnd: 125000,
      deductionPeriodMonth: "2026-09-01",
      requestNote: "Chi phí đi lại",
    }));
    expect(dialog).toHaveTextContent("Đang gửi yêu cầu…");
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    fireEvent.click(submit);
    expect(actions.requestSalaryAdvanceAction).toHaveBeenCalledOnce();

    pending.resolve({ message: "Đã gửi.", status: "success" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  });

  it("associates returned request field errors and restores dismissal after an error", async () => {
    actions.requestSalaryAdvanceAction.mockResolvedValueOnce({
      fieldErrors: {
        amountVnd: ["Số tiền không hợp lệ."],
        deductionPeriodMonth: ["Kỳ khấu trừ không hợp lệ."],
        requestNote: ["Lý do không hợp lệ."],
      },
      message: "Vui lòng kiểm tra lại yêu cầu.",
      status: "error",
    });
    render(<RequestSalaryAdvanceDialog />);

    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu tạm ứng" }));
    const dialog = screen.getByRole("dialog", { name: "Yêu cầu tạm ứng lương" });
    fireEvent.change(screen.getByLabelText("Số tiền (VND)"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Kỳ khấu trừ"), { target: { value: "2026-09" } });
    fireEvent.change(screen.getByLabelText("Lý do tạm ứng"), { target: { value: "Lý do" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Gửi yêu cầu" }));
    await screen.findByRole("alert");

    for (const [label, message] of [
      ["Số tiền (VND)", "Số tiền không hợp lệ."],
      ["Kỳ khấu trừ", "Kỳ khấu trừ không hợp lệ."],
      ["Lý do tạm ứng", "Lý do không hợp lệ."],
    ]) {
      const field = screen.getByLabelText(label);
      expect(field).toHaveAttribute("aria-invalid", "true");
      const error = document.getElementById(field.getAttribute("aria-describedby")?.split(" ").at(-1) ?? "");
      expect(error).toHaveTextContent(message);
    }

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("preserves exact Review and Reject payloads", async () => {
    const pending = deferred<{ message: string; status: "success" }>();
    actions.reviewSalaryAdvanceAction
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce({ message: "Đã từ chối.", status: "success" });
    render(<SalaryAdvanceDecisionDialog advance={advance()} stage="review" />);

    fireEvent.click(screen.getByRole("button", { name: "Đối soát" }));
    let dialog = screen.getByRole("dialog", { name: "Đối soát yêu cầu tạm ứng" });
    fireEvent.change(screen.getByLabelText("Ghi chú"), { target: { value: "Đủ thông tin" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Chuyển bước phê duyệt" }));
    await waitFor(() => expect(actions.reviewSalaryAdvanceAction).toHaveBeenLastCalledWith({
      decision: "review",
      note: "Đủ thông tin",
      salaryAdvanceId: advance().id,
    }));
    expect(dialog).toHaveTextContent("Đang xử lý đối soát…");
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(actions.reviewSalaryAdvanceAction).toHaveBeenCalledOnce();
    pending.resolve({ message: "Đã đối soát.", status: "success" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Đối soát" }));
    dialog = screen.getByRole("dialog", { name: "Đối soát yêu cầu tạm ứng" });
    fireEvent.change(screen.getByLabelText("Quyết định"), { target: { value: "rejected" } });
    fireEvent.change(screen.getByLabelText("Lý do từ chối"), { target: { value: "Thiếu chứng từ" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Từ chối yêu cầu" }));
    await waitFor(() => expect(actions.reviewSalaryAdvanceAction).toHaveBeenLastCalledWith({
      decision: "rejected",
      note: "Thiếu chứng từ",
      salaryAdvanceId: advance().id,
    }));
  });

  it("preserves exact Approve and Reject payloads", async () => {
    actions.approveSalaryAdvanceAction
      .mockResolvedValueOnce({ message: "Đã phê duyệt.", status: "success" })
      .mockResolvedValueOnce({ message: "Đã từ chối.", status: "success" });
    render(<SalaryAdvanceDecisionDialog advance={advance({ status: "review" })} stage="approve" />);

    fireEvent.click(screen.getByRole("button", { name: "Phê duyệt" }));
    let dialog = screen.getByRole("dialog", { name: "Phê duyệt yêu cầu tạm ứng" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Phê duyệt tạm ứng" }));
    await waitFor(() => expect(actions.approveSalaryAdvanceAction).toHaveBeenLastCalledWith({
      decision: "approved",
      note: "",
      salaryAdvanceId: advance().id,
    }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Phê duyệt" }));
    dialog = screen.getByRole("dialog", { name: "Phê duyệt yêu cầu tạm ứng" });
    fireEvent.change(screen.getByLabelText("Quyết định"), { target: { value: "rejected" } });
    fireEvent.change(screen.getByLabelText("Lý do từ chối"), { target: { value: "Không phù hợp" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Từ chối yêu cầu" }));
    await waitFor(() => expect(actions.approveSalaryAdvanceAction).toHaveBeenLastCalledWith({
      decision: "rejected",
      note: "Không phù hợp",
      salaryAdvanceId: advance().id,
    }));
  });

  it("unlocks a returned decision error, associates its note error, and locks safely again on retry", async () => {
    const retry = deferred<{ message: string; status: "success" }>();
    actions.approveSalaryAdvanceAction
      .mockResolvedValueOnce({
        fieldErrors: { note: ["Cần nêu lý do từ chối."] },
        message: "Cần nêu lý do từ chối.",
        status: "error",
      })
      .mockReturnValueOnce(retry.promise);
    render(<SalaryAdvanceDecisionDialog advance={advance({ status: "review" })} stage="approve" />);

    const trigger = screen.getByRole("button", { name: "Phê duyệt" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Phê duyệt yêu cầu tạm ứng" });
    fireEvent.change(screen.getByLabelText("Quyết định"), { target: { value: "rejected" } });
    fireEvent.change(screen.getByLabelText("Lý do từ chối"), { target: { value: "Thiếu dữ liệu" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Từ chối yêu cầu" }));
    await screen.findByRole("alert");
    const note = screen.getByLabelText("Lý do từ chối");
    expect(note).toHaveAttribute("aria-invalid", "true");
    expect(document.getElementById(note.getAttribute("aria-describedby") ?? "")).toHaveTextContent("Cần nêu lý do từ chối.");

    fireEvent.click(within(dialog).getByRole("button", { name: "Từ chối yêu cầu" }));
    await waitFor(() => expect(actions.approveSalaryAdvanceAction).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    retry.resolve({ message: "Đã phê duyệt.", status: "success" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(trigger).toHaveFocus();
  });
});
