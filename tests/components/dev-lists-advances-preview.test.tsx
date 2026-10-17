// Value: protects=the /dev/lists advances preview is inert and truthful per role: the request, review and approve dialogs run the preview's stubs and never the real salary advance server actions (the preview runs on localhost where .env.local may point at production); the owner sees both decision stages but not on their own request, the accountant only reviews, a teaching assistant only sees their own rows; "capped" equals "normal" and "empty" stays inside the frame;
// fails_when=a dialog stops accepting an injected action and falls back to requestSalaryAdvanceAction, reviewSalaryAdvanceAction or approveSalaryAdvanceAction, the preview stops passing previewAdvanceActions, a new advance action ships without a stub, or a role leaks another role's controls or rows;
// why_new=step 14b adds an advances view to /dev/lists whose dialogs write salary advances;
// seam=the advance actions module is mocked so any real call is observable; next/navigation only provides useRouter (the page uses no URL state); the body has no AppShell (the controller wraps it); no_claim=the /dev/lists page wiring, AppShell navigation and the production 404 (dev-lists-preview.test.tsx)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { advancePreviewEntries, advancePreviewPeople } from "@/app/dev/lists/advance-fixtures";
import { AdvancesPreviewBody, previewAdvanceActions } from "@/app/dev/lists/advances-preview";
import * as advanceActions from "@/features/advances/actions/advance-actions";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/features/advances/actions/advance-actions", () => ({
  approveSalaryAdvanceAction: vi.fn(),
  requestSalaryAdvanceAction: vi.fn(),
  reviewSalaryAdvanceAction: vi.fn(),
}));

const STUB = "Bản xem trước không ghi dữ liệu.";
const TABLE = "Danh sách yêu cầu tạm ứng lương";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function expectNothingReal() {
  for (const action of Object.values(advanceActions)) {
    expect(action).not.toHaveBeenCalled();
  }
  expect(router.refresh).not.toHaveBeenCalled();
}

async function expectStubAndClose(dialogName: string) {
  const dialog = screen.getByRole("dialog", { name: dialogName });
  expect(await within(dialog).findByText(STUB)).toBeInTheDocument();
  const cancel = within(dialog).getByRole("button", { name: "Hủy" });
  await waitFor(() => expect(cancel).toBeEnabled());
  fireEvent.click(cancel);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
}

const tableRows = () => within(screen.getByRole("table", { name: TABLE })).getAllByRole("row").slice(1);

describe("/dev/lists advances preview", () => {
  it("covers every salary advance action with a stub", () => {
    // The real module's exports, not this file's mock keys, so a new server action fails here until it gets a stub.
    const source = readFileSync(join(process.cwd(), "src/features/advances/actions/advance-actions.ts"), "utf8");
    const realActions = Array.from(source.matchAll(/export async function (\w+)Action/g), (match) => match[1]);
    expect(realActions.length).toBeGreaterThan(0);
    expect(Object.keys(previewAdvanceActions).sort()).toEqual(realActions.sort());
  });

  it("fixtures cover every status, a payroll-linked deduction, reasons, unknown status and a null code", () => {
    const statuses = new Set(advancePreviewEntries.map((entry) => entry.status));
    for (const status of ["requested", "review", "approved", "deducted", "rejected"]) expect(statuses).toContain(status);
    expect([...statuses].some((status) => !["requested", "review", "approved", "deducted", "rejected"].includes(status))).toBe(true);
    expect(advancePreviewEntries.some((entry) => entry.status === "deducted" && entry.deductionPayrollPeriodId)).toBe(true);
    expect(advancePreviewEntries.some((entry) => entry.status === "rejected" && entry.rejectionReason)).toBe(true);
    expect(advancePreviewEntries.some((entry) => entry.staffEmployeeCode === null)).toBe(true);
    expect(advancePreviewEntries.some((entry) => entry.requestNote.length > 120)).toBe(true);
    const requested = advancePreviewEntries.map((entry) => entry.requestedAt);
    expect(requested).toEqual([...requested].sort((a, b) => b.localeCompare(a)));
  });

  it("owner: both stages on other people's requests, own request set apart, payroll links", () => {
    render(<AdvancesPreviewBody role="owner" state="normal" />);

    expect(screen.getByText(`${advancePreviewEntries.length} đơn · 5 chờ đối soát · 3 chờ phê duyệt`)).toBeInTheDocument();
    const chips = screen.getByRole("group", { name: "Lọc nhanh tạm ứng" });
    // 4 requested (own excluded) + 3 reviewed.
    expect(within(chips).getByRole("button", { name: "Cần xử lý7" })).toBeInTheDocument();
    // The own request is still at review: full text once in the table (sr-only) and once on the card.
    expect(screen.getAllByText("Đơn của bạn · cần người khác đối soát")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Đối soát" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Phê duyệt" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Mở kỳ lương 09/2026" })[0]).toHaveAttribute(
      "href",
      "/payroll#payroll-period-b2000000-0000-4000-8000-000000202609",
    );
    expect(screen.getAllByText(`1–20 trong ${advancePreviewEntries.length} đơn`)).toHaveLength(2);
    expect(screen.getAllByText("Trạng thái chưa hỗ trợ: cancelled_by_migration")).not.toHaveLength(0);
  });

  it("owner: request, review, approve and reject all answer from the stubs", async () => {
    render(<AdvancesPreviewBody role="owner" state="normal" />);

    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu tạm ứng" }));
    fireEvent.change(screen.getByLabelText("Số tiền (VND)"), { target: { value: "500000" } });
    fireEvent.change(screen.getByLabelText("Lý do tạm ứng"), { target: { value: "Thử bản xem trước" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Gửi yêu cầu" }));
    await expectStubAndClose("Yêu cầu tạm ứng lương");

    fireEvent.click(screen.getAllByRole("button", { name: "Đối soát" })[0]);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Chuyển bước phê duyệt" }));
    await expectStubAndClose("Đối soát yêu cầu tạm ứng");

    fireEvent.click(screen.getAllByRole("button", { name: "Phê duyệt" })[0]);
    const approveDialog = screen.getByRole("dialog", { name: "Phê duyệt yêu cầu tạm ứng" });
    fireEvent.change(within(approveDialog).getByLabelText("Quyết định"), { target: { value: "rejected" } });
    fireEvent.change(within(approveDialog).getByLabelText("Lý do từ chối"), { target: { value: "Thử từ chối" } });
    fireEvent.click(within(approveDialog).getByRole("button", { name: "Từ chối yêu cầu" }));
    await expectStubAndClose("Phê duyệt yêu cầu tạm ứng");

    expectNothingReal();
  });

  it("accountant: reviews only, never their own request, payroll link like every payroll.view holder", async () => {
    const review = vi.spyOn(previewAdvanceActions, "reviewSalaryAdvance");
    render(<AdvancesPreviewBody role="accountant" state="normal" />);

    expect(within(screen.getByRole("group", { name: "Lọc nhanh tạm ứng" })).getByRole("button", { name: "Cần xử lý4" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Phê duyệt" })).not.toBeInTheDocument();
    // Every role holds payroll.view in the migrations, so the deducted rows link to their period.
    expect(screen.getAllByRole("link", { name: "Mở kỳ lương 09/2026" }).length).toBeGreaterThan(0);
    // The own request is still at review: full text once in the table (sr-only) and once on the card.
    expect(screen.getAllByText("Đơn của bạn · cần người khác đối soát")).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: "Đối soát" })[0]);
    const dialog = screen.getByRole("dialog", { name: "Đối soát yêu cầu tạm ứng" });
    fireEvent.change(within(dialog).getByLabelText("Quyết định"), { target: { value: "rejected" } });
    fireEvent.change(within(dialog).getByLabelText("Lý do từ chối"), { target: { value: "Thiếu chứng từ" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Từ chối yêu cầu" }));
    await expectStubAndClose("Đối soát yêu cầu tạm ứng");
    expect(review).toHaveBeenCalledWith({ decision: "rejected", note: "Thiếu chứng từ", salaryAdvanceId: expect.any(String) });
    expectNothingReal();
  });

  it("teaching assistant: own rows only, no decisions, no staff search", () => {
    render(<AdvancesPreviewBody role="ta" state="normal" />);

    const own = advancePreviewEntries.filter((entry) => entry.staffId === advancePreviewPeople.ta.id);
    expect(tableRows()).toHaveLength(own.length);
    for (const row of tableRows()) expect(row).toHaveTextContent(advancePreviewPeople.ta.name);
    expect(screen.getByText(`${own.length} đơn của bạn · 2 đang chờ duyệt`)).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Lọc nhanh tạm ứng" })).getByRole("button", { name: "Đang chờ2" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(Đối soát|Phê duyệt)$/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tìm nhân sự")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yêu cầu tạm ứng" })).toBeInTheDocument();
  });

  it("capped renders the same rows as normal (the dashboard RPC has no limit)", () => {
    const { unmount } = render(<AdvancesPreviewBody role="owner" state="normal" />);
    const normal = tableRows().map((row) => row.textContent);
    unmount();

    render(<AdvancesPreviewBody role="owner" state="capped" />);
    expect(tableRows().map((row) => row.textContent)).toEqual(normal);
  });

  it.each(["owner", "accountant", "ta"] as const)("empty (%s) keeps the empty state inside the frame", (role) => {
    render(<AdvancesPreviewBody role={role} state="empty" />);

    expect(screen.getByRole("table", { name: TABLE })).toBeInTheDocument();
    expect(screen.getAllByText("Chưa có yêu cầu tạm ứng")).toHaveLength(2);
    expect(screen.queryByRole("group", { name: "Lọc nhanh tạm ứng" })).not.toBeInTheDocument();
  });
});
