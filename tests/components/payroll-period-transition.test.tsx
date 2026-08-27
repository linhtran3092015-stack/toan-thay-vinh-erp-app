import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PayrollPeriodTransitionAction } from "@/features/payroll/components/payroll-period-transition-action";
import { PayrollPage } from "@/features/payroll/payroll-page";
import type { PayrollPeriodRead } from "@/features/payroll/read-models";

const actions = vi.hoisted(() => ({
  approvePayrollPeriodAction: vi.fn(),
  submitPayrollForReviewAction: vi.fn(),
}));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/payroll/actions/payroll-actions", () => actions);

const payrollPeriodId = "11111111-1111-4111-8111-111111111111";

const period = (overrides: Partial<PayrollPeriodRead> = {}): PayrollPeriodRead => ({
  blockingIssueCount: 0,
  currentRevision: 1,
  feedbackClosedAt: "2026-05-20T00:00:00Z",
  feedbackOpenedAt: "2026-05-15T00:00:00Z",
  id: payrollPeriodId,
  lastCalculatedAt: "2026-05-20T08:30:00Z",
  payDate: "2026-05-28",
  periodMonth: "2026-04-01",
  pendingCorrectionCount: 0,
  statements: [],
  status: "draft",
  ...overrides,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

function transitionLabels(transition: "approve" | "review") {
  return transition === "review"
    ? {
      confirm: "Gửi đối soát",
      pending: "Đang gửi đối soát…",
      trigger: "Gửi đối soát",
    }
    : {
      confirm: "Duyệt và khóa",
      pending: "Đang duyệt và khóa…",
      trigger: "Duyệt & khóa",
    };
}

function renderTransition(transition: "approve" | "review") {
  render(
    <PayrollPeriodTransitionAction
      payrollPeriodId={payrollPeriodId}
      periodMonth="2026-04-01"
      transition={transition}
    />,
  );
  const labels = transitionLabels(transition);
  fireEvent.click(screen.getByRole("button", { name: labels.trigger }));
  return {
    dialog: screen.getByRole("dialog"),
    labels,
  };
}

function mockTransitionAction(
  transition: "approve" | "review",
  result: Promise<{ message: string; status: "error" | "success" }> | { message: string; status: "error" | "success" },
) {
  if (transition === "review") {
    actions.submitPayrollForReviewAction.mockReturnValueOnce(result);
    return;
  }

  actions.approvePayrollPeriodAction.mockReturnValueOnce(result);
}

function expectExactPayload(transition: "approve" | "review") {
  const action = transition === "review"
    ? actions.submitPayrollForReviewAction
    : actions.approvePayrollPeriodAction;
  expect(action.mock.calls[0]?.[0]).toEqual({ payrollPeriodId });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Payroll 2 period transition composition", () => {
  it("uses only exact status and independent transition permissions, including an empty draft", () => {
    render(
      <PayrollPage
        canApprove={false}
        canManage={false}
        canReconcile
        periods={[period(), period({ id: "review", status: "review" })]}
      />,
    );

    expect(screen.getByRole("button", { name: "Gửi đối soát" })).toBeInTheDocument();
    expect(screen.getAllByText("Chưa có bảng lương nhân sự trong kỳ này.")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Duyệt & khóa" })).not.toBeInTheDocument();

    cleanup();
    render(
      <PayrollPage
        canApprove={false}
        canManage
        canReconcile={false}
        periods={[period()]}
      />,
    );
    expect(screen.queryByRole("button", { name: "Gửi đối soát" })).not.toBeInTheDocument();

    cleanup();
    render(
      <PayrollPage
        canApprove
        canManage={false}
        canReconcile={false}
        periods={[
          period({ id: "review", status: "review" }),
          period({ id: "approved", status: "approved" }),
          period({ id: "unknown", status: "archived" }),
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Duyệt & khóa" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gửi đối soát" })).not.toBeInTheDocument();
    expect(screen.getByText("Trạng thái chưa hỗ trợ: archived")).toBeInTheDocument();
  });

  it("keeps the visible stored status unchanged after a stale server error", async () => {
    actions.submitPayrollForReviewAction.mockResolvedValueOnce({
      message: "Kỳ lương không còn ở trạng thái nháp.",
      status: "error",
    });
    render(
      <PayrollPage
        canApprove={false}
        canManage={false}
        canReconcile
        periods={[period()]}
      />,
    );

    const periodSection = screen.getByRole("heading", { name: "tháng 4 năm 2026" }).closest("section")!;
    expect(within(periodSection).getByText("Nháp")).toBeInTheDocument();
    fireEvent.click(within(periodSection).getByRole("button", { name: "Gửi đối soát" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Gửi đối soát" }));

    await screen.findByRole("alert");
    expect(within(periodSection).getByText("Nháp")).toBeInTheDocument();
    expect(
      within(periodSection).getAllByRole("button", {
        name: "Gửi đối soát",
      })[0],
    ).toBeInTheDocument();
  });
});

describe.each(["review", "approve"] as const)("Payroll 2 %s transition dialog", (transition) => {
  it("uses the exact payload, communicates the real transition, and protects the unresolved mutation", async () => {
    const pending = deferred<{ message: string; status: "success" }>();
    mockTransitionAction(transition, pending.promise);
    const { dialog, labels } = renderTransition(transition);

    expect(dialog).toHaveTextContent("tháng 4 năm 2026");
    expect(dialog).toHaveTextContent(transition === "review" ? "Nháp" : "Chờ đối soát");
    expect(dialog).toHaveTextContent(transition === "review" ? "Chờ đối soát" : "Đã duyệt & khóa");
    fireEvent.click(within(dialog).getByRole("button", { name: labels.confirm }));

    await waitFor(() => expectExactPayload(transition));
    expect(dialog).toHaveTextContent(labels.pending);
    expect(
      within(dialog).getByRole("button", { name: labels.pending }),
    ).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.mouseDown(dialog.parentElement!);
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));

    const action = transition === "review"
      ? actions.submitPayrollForReviewAction
      : actions.approvePayrollPeriodAction;
    expect(action).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    pending.resolve({ message: "Đã cập nhật kỳ lương.", status: "success" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("unlocks a returned server error immediately, retains the authoritative status, and safely retries", async () => {
    const retry = deferred<{ message: string; status: "success" }>();
    mockTransitionAction(transition, { message: "Kỳ lương không còn ở trạng thái phù hợp.", status: "error" });
    mockTransitionAction(transition, retry.promise);

    const { dialog, labels } = renderTransition(transition);
    fireEvent.click(within(dialog).getByRole("button", { name: labels.confirm }));
    await screen.findByRole("alert");
    expect(dialog).toHaveTextContent("Kỳ lương không còn ở trạng thái phù hợp.");

    fireEvent.click(within(dialog).getByRole("button", { name: labels.confirm }));
    await waitFor(() => expectExactPayload(transition));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    retry.resolve({ message: "Đã cập nhật kỳ lương.", status: "success" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("restores Escape, backdrop, and Cancel dismissal after an error", async () => {
    mockTransitionAction(transition, { message: "Kỳ lương không còn ở trạng thái phù hợp.", status: "error" });
    mockTransitionAction(transition, { message: "Kỳ lương không còn ở trạng thái phù hợp.", status: "error" });
    mockTransitionAction(transition, { message: "Kỳ lương không còn ở trạng thái phù hợp.", status: "error" });
    const labels = transitionLabels(transition);

    let rendered = renderTransition(transition);
    fireEvent.click(within(rendered.dialog).getByRole("button", { name: labels.confirm }));
    await screen.findByRole("alert");
    fireEvent.keyDown(rendered.dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: labels.trigger }));
    rendered = { dialog: screen.getByRole("dialog"), labels };
    fireEvent.click(await within(rendered.dialog).findByRole("button", { name: labels.confirm }));
    await screen.findByRole("alert");
    fireEvent.mouseDown(rendered.dialog.parentElement!);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: labels.trigger }));
    rendered = { dialog: screen.getByRole("dialog"), labels };
    fireEvent.click(await within(rendered.dialog).findByRole("button", { name: labels.confirm }));
    await screen.findByRole("alert");
    fireEvent.click(within(rendered.dialog).getByRole("button", { name: "Hủy" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
