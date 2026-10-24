// Value: protects=the /dev/payroll preview is inert: the dashboard, the per-staff daily dialog it opens, the ledger and the payslip run on the preview's fixture transport and never fetch /api/payroll/*, open a Supabase realtime channel or call a payroll server action (the preview runs on localhost where .env.local may point at production);
// fails_when=a payroll estimate component stops accepting the injected transport and falls back to fetch + getSupabaseBrowserClient, the preview stops passing previewPayrollTransports, the payslip PDF action becomes a live link, or a previewed control reaches payroll-actions;
// why_new=step 8 adds a preview of screens backed by a polling, realtime live estimate;
// seam=global fetch, the Supabase browser client and the payroll actions module are mocked so any real call is observable; AppShell is replaced by its children (the shell is not under test); no_claim=does not prove stubs cover controls added later or that /dev is unreachable in production (public-coaching-route-access covers the layout gate)
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PayrollPreview, previewPayrollTransports } from "@/app/dev/payroll/payroll-preview";
import * as payrollActions from "@/features/payroll/actions/payroll-actions";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

vi.mock("next/navigation", () => ({ usePathname: () => "/dev/payroll", useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }), useSearchParams: () => null }));
vi.mock("@/components/layout/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: vi.fn() }));
vi.mock("@/features/payroll/actions/payroll-actions", () => ({
  addPayrollManualLineAction: vi.fn(),
  approvePayrollPeriodAction: vi.fn(),
  closePayrollFeedbackAction: vi.fn(),
  createPayrollDraftAction: vi.fn(),
  createPayrollImportBatchAction: vi.fn(),
  decidePayrollImportBatchAction: vi.fn(),
  markPayrollPeriodPaidAction: vi.fn(),
  recalculatePayrollAction: vi.fn(),
  reopenPayrollPeriodAction: vi.fn(),
  reopenPayrollToDraftAction: vi.fn(),
  resetPayrollDraftAction: vi.fn(),
  resolvePayrollCorrectionAction: vi.fn(),
  submitPayrollCorrectionAction: vi.fn(),
  submitPayrollForReviewAction: vi.fn(),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function expectNothingReal() {
  expect(fetchMock).not.toHaveBeenCalled();
  expect(getSupabaseBrowserClient).not.toHaveBeenCalled();
  for (const action of Object.values(payrollActions)) {
    expect(action).not.toHaveBeenCalled();
  }
}

describe("/dev/payroll preview", () => {
  it("loads the dashboard and the daily dialog from fixtures only", async () => {
    const load = vi.spyOn(previewPayrollTransports.normal, "load");
    const subscribe = vi.spyOn(previewPayrollTransports.normal, "subscribe");
    render(<PayrollPreview role="owner" state="normal" view="dashboard" />);

    expect(screen.getByRole("heading", { level: 1, name: "Quỹ lương tháng 10/2026" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem kỳ 09/2026 chờ duyệt" })).toHaveAttribute("href", "/payroll");
    // Fixture mirrors the RPC: Đức has no rate on any day, Lan on some days,
    // Thảo has no position (issue only, no statement).
    expect(screen.getAllByText("Chưa tính được")).toHaveLength(1);
    expect(screen.getByText("Chưa đủ dữ liệu · Thiếu mức lương ngày")).toBeInTheDocument();
    expect(screen.getByTestId("staff-without-position")).toHaveTextContent("1 nhân sự có chấm công nhưng chưa có vị trí tính lương");
    expect(screen.queryByText("Đặng Phương Thảo")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Làm mới tổng quan lương tạm tính" }));
    fireEvent.click(screen.getByRole("button", { name: "Xem lương theo ngày của Trần Thanh Tùng" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByTestId("daily-row-2026-10-08")).toBeInTheDocument();
    expect(within(dialog).getByRole("status")).toHaveTextContent("1 ca chờ xác minh");
    fireEvent.click(within(dialog).getByRole("button", { name: "Làm mới lương theo ngày" }));

    await waitFor(() => expect(load.mock.calls.some(([endpoint]) => String(endpoint).startsWith("/api/payroll/staff-estimate"))).toBe(true));
    expect(load.mock.calls.some(([endpoint]) => String(endpoint).startsWith("/api/payroll/owner-estimate"))).toBe(true);
    expect(subscribe).toHaveBeenCalled();
    expectNothingReal();
  });

  it("keeps the error state inert and inside the frame", async () => {
    const load = vi.spyOn(previewPayrollTransports.errors, "load");
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<PayrollPreview role="owner" state="errors" view="dashboard" />);

    expect(await screen.findByText("Chưa tải được tổng quan lương tạm tính")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
    await waitFor(() => expect(load.mock.calls.length).toBeGreaterThanOrEqual(2));
    expectNothingReal();
  });

  it("denies the owner dashboard to accountant and staff like the route", () => {
    render(<PayrollPreview role="accountant" state="normal" view="dashboard" />);
    expect(screen.getByText("Không có quyền xem Dashboard lương")).toBeInTheDocument();
    cleanup();
    render(<PayrollPreview role="staff" state="normal" view="dashboard" />);
    expect(screen.getByText("Không có quyền xem Dashboard lương")).toBeInTheDocument();
    expectNothingReal();
  });

  it("renders the ledger and payslip views without a live PDF link", () => {
    render(<PayrollPreview role="staff" state="normal" view="ledger" />);
    expect(screen.getByRole("heading", { name: "Lương theo ngày · Trần Thanh Tùng" })).toBeInTheDocument();
    expect(screen.getByTestId("daily-row-2026-10-12")).toHaveTextContent("Chưa tính");
    expect(screen.queryByRole("link", { name: /Hồ sơ nhân sự/ })).not.toBeInTheDocument();
    cleanup();

    render(<PayrollPreview role="owner" state="normal" view="payslip" />);
    expect(screen.getByText("THÁNG 09/2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xuất PDF/ })).toBeDisabled();
    expect(screen.queryByRole("link", { name: /Xuất PDF/ })).not.toBeInTheDocument();
    expectNothingReal();
  });

  // Value: protects=the `payslip-piecework` preview shows an operations payslip with the "Lương khoán" block (amount added and its explanation) and each "Điều chỉnh" with its note, and stays as inert as the other views;
  // fails_when=PayrollPreview drops the `payslip-piecework` branch (nothing renders), PayslipView ignores the `piecework` flag (the ordinary payslip renders with no Lương khoán), the fixture loses its correction notes, or the view's PDF action becomes a live link or anything fetches / calls a payroll action;
  // why_new=the view is new in this change and no test rendered it;
  // seam=same mocks as the file header (fetch, Supabase browser client, payroll actions, AppShell); no_claim=does not prove page.tsx accepts `?view=payslip-piecework` (only the client preview is rendered)
  it("renders the piecework payslip view with lương khoán, notes and no live PDF link", () => {
    render(<PayrollPreview role="owner" state="normal" view="payslip-piecework" />);

    const piecework = screen.getByRole("region", { name: "Lương khoán" });
    expect(within(piecework).getByRole("heading", { name: "Lương khoán" }).nextElementSibling?.textContent).toBe("490.000 VND");
    expect(piecework).toHaveTextContent(
      "Lương khoán đạt 2.700.000 VND. Phần đến 85% lương cứng (2.600.000 VND × 85% = 2.210.000 VND) đã được trả trong lương cứng; phần vượt 490.000 VND được cộng thêm.",
    );
    const adjustments = screen.getByRole("region", { name: "Điều chỉnh" });
    expect(within(adjustments).getByText("Phụ cấp điện thoại 10 ca × 15.000")).toBeInTheDocument();
    expect(within(adjustments).getByText("Trả lại phần công online tính nhầm thành offline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Xuất PDF/ })).toBeDisabled();
    expect(screen.queryByRole("link", { name: /Xuất PDF/ })).not.toBeInTheDocument();
    expectNothingReal();
  });
});
