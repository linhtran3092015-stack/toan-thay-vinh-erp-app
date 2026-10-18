// Value: protects=the /dev/lists payment-requests preview is inert and truthful per role: "Hủy phiếu" runs the preview stub and never the real cancelPaymentRequestAction (the preview runs on localhost where .env.local may point at production); filter writes stay on /dev/lists with the preview's own params; the owner gets create, cancel and profile links, the accountant cancel only (no students.view), a teaching assistant the route's own denial; "capped" names the 1000-row cap and "empty" stays inside the frame; the fixtures stay faithful to what the database writes;
// fails_when=the dialog stops accepting the injected action, the preview stops passing previewPaymentRequestActions or basePath, a new action reachable from the list ships without a stub, a role leaks another role's controls, or the fixtures invent an expired row or a paidAt on an unpaid request;
// why_new=step 14c adds a payment-requests view to /dev/lists whose cancel dialog writes payment requests;
// seam=the finance actions module is mocked so any real call is observable; next/navigation offers useRouter and a useSearchParams carrying the preview URL; the body has no AppShell (the controller wraps it); no_claim=the /dev/lists page wiring, AppShell navigation and the production 404 (dev-lists-preview.test.tsx)
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cappedPaymentRequestFixtures, paymentRequestFixtures } from "@/app/dev/lists/payment-request-fixtures";
import { paymentRequestPreviewNow, PaymentRequestsPreviewBody, previewPaymentRequestActions } from "@/app/dev/lists/payment-requests-preview";
import * as financeActions from "@/features/finance/actions/finance-actions";
import { isPaymentRequestOverdue } from "@/features/finance/payment-request-directory-models";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
const search = vi.hoisted(() => ({ value: "view=payment-requests" }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(search.value),
}));
vi.mock("@/features/finance/actions/finance-actions", () => ({
  allocatePaymentAction: vi.fn(),
  cancelPaymentRequestAction: vi.fn(),
  createPaymentRequestAction: vi.fn(),
  setFinanceOrderReviewAction: vi.fn(),
}));

const STUB = "Bản xem trước không ghi dữ liệu.";
const TABLE = "Danh sách yêu cầu thanh toán";

afterEach(() => {
  cleanup();
  search.value = "view=payment-requests";
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function expectNothingReal() {
  for (const action of Object.values(financeActions)) {
    expect(action).not.toHaveBeenCalled();
  }
  expect(router.refresh).not.toHaveBeenCalled();
}

const tableRows = () => within(screen.getByRole("table", { name: TABLE })).getAllByRole("row").slice(1);

describe("/dev/lists payment-requests preview", () => {
  it("stubs every finance action the payment-request list can reach", () => {
    // The list's own modules, not this file's mock keys: a new action imported there fails here until it gets a stub.
    const root = join(process.cwd(), "src/features/finance");
    const files = [
      join(root, "payment-request-directory.tsx"),
      ...readdirSync(join(root, "components"))
        .filter((name) => /^payment-request-(table|filters|cancel-dialog)\.tsx$/.test(name))
        .map((name) => join(root, "components", name)),
    ];
    expect(files).toHaveLength(4);
    const reachable = new Set<string>();
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@\/features\/finance\/actions\/finance-actions"/g)) {
        for (const name of match[1].split(",").map((part) => part.trim()).filter(Boolean)) reachable.add(name.replace(/Action$/, ""));
      }
    }
    expect([...reachable]).toEqual(["cancelPaymentRequest"]);
    expect(Object.keys(previewPaymentRequestActions).sort()).toEqual([...reachable].sort());
  });

  it("fixtures follow what the database writes: four statuses, no expired, paidAt only when paid, newest first", () => {
    expect(paymentRequestFixtures.length).toBeGreaterThanOrEqual(25);
    const statuses = new Set(paymentRequestFixtures.map((row) => row.status));
    expect([...statuses].sort()).toEqual(["cancelled", "paid", "partially_paid", "pending"]);
    for (const row of [...paymentRequestFixtures, ...cappedPaymentRequestFixtures]) {
      expect(row.status).not.toBe("expired");
      expect(row.paidAt !== null).toBe(row.status === "paid");
      if (row.status === "cancelled" || row.status === "pending") expect(row.paidAmountVnd).toBe(0);
      expect(row.calculatedUnitPriceVnd).toBe(Math.round(row.expectedAmountVnd / row.purchasedSessions));
      expect(row.publicCode).toMatch(/^PAY-\d{6}-[0-9A-F]{12}$/);
      expect(row.transferCode.endsWith(` ${row.publicCode}`)).toBe(true);
    }
    expect(paymentRequestFixtures.some((row) => row.status === "partially_paid" && row.paidAmountVnd > 0 && row.paidAmountVnd < row.expectedAmountVnd)).toBe(true);
    expect(paymentRequestFixtures.some((row) => row.status === "paid" && row.paidAmountVnd > row.expectedAmountVnd)).toBe(true);
    expect(paymentRequestFixtures.some((row) => row.bonusSessions > 0)).toBe(true);
    expect(paymentRequestFixtures.some((row) => isPaymentRequestOverdue(row, Date.parse(paymentRequestPreviewNow)))).toBe(true);
    expect(cappedPaymentRequestFixtures).toHaveLength(1000);
    for (const set of [paymentRequestFixtures, cappedPaymentRequestFixtures]) {
      const created = set.map((row) => row.createdAt);
      expect(created).toEqual([...created].sort((a, b) => b.localeCompare(a)));
      expect(new Set(set.map((row) => row.id)).size).toBe(set.length);
      expect(new Set(set.map((row) => row.publicCode)).size).toBe(set.length);
    }
  });

  it("owner: create, cancel and profile links; Còn, Thừa and the 14-day caption on real-looking rows", () => {
    render(<PaymentRequestsPreviewBody role="owner" state="normal" />);

    const total = paymentRequestFixtures.length;
    expect(screen.getByText(`${total}/${total} yêu cầu trong danh sách đã tải`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tạo yêu cầu" })).toHaveAttribute("href", "/finance/payment-requests/new");
    expect(screen.getAllByRole("link", { name: /^Mở hồ sơ học viên / })[0]).toHaveAttribute("href", expect.stringMatching(/^\/students\/d1000000-/));
    expect(screen.getAllByRole("button", { name: /^Hủy phiếu thu PAY-/ }).length).toBeGreaterThan(0);
    const pending = paymentRequestFixtures.filter((row) => row.status === "pending").length;
    expect(within(screen.getByRole("group", { name: "Lọc nhanh yêu cầu thanh toán" })).getByRole("button", { name: `Chờ thanh toán${pending}` })).toBeInTheDocument();
    expect(screen.getAllByText(`1–20 trong ${total} yêu cầu`)).toHaveLength(2);
    expect(tableRows()).toHaveLength(20);
    expect(screen.getAllByText("Thừa 100.000 ₫").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Còn 1.600.000 ₫").length).toBeGreaterThan(0);
    // On the fixture clock one pending request on page 1 is older than 14 days (table + card); the one
    // created 13 days 23 hours earlier is not (it would be on the wall clock: the preview passes its `now`).
    expect(screen.getAllByText("chờ quá 14 ngày")).toHaveLength(2);
    // Nothing writes `expired`: no such badge and no chip (the status select keeps its option).
    expect(within(screen.getByRole("table", { name: TABLE })).queryByText("Hết hạn")).not.toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Lọc nhanh yêu cầu thanh toán" })).queryByRole("button", { name: /Hết hạn/ })).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("navigation", { name: "Phân trang yêu cầu thanh toán (danh sách gọn)" })).getByRole("button", { name: "2" }));
    expect(router.push).toHaveBeenLastCalledWith("/dev/lists?view=payment-requests&page=2", { scroll: false });
    expect(screen.getAllByText(`21–${total} trong ${total} yêu cầu`)).toHaveLength(2);
  });

  it("owner: Hủy phiếu answers from the stub and nothing real runs", async () => {
    const cancel = vi.spyOn(previewPaymentRequestActions, "cancelPaymentRequest");
    render(<PaymentRequestsPreviewBody role="owner" state="normal" />);

    const trigger = screen.getAllByRole("button", { name: /^Hủy phiếu thu PAY-/ })[0];
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Lý do hủy"), { target: { value: "Thử bản xem trước" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận hủy" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(STUB);
    // A refusal never shows the page's success notice.
    expect(screen.queryByText(/^Đã hủy phiếu thu/)).not.toBeInTheDocument();
    expect(cancel).toHaveBeenCalledWith({ reason: "Thử bản xem trước", requestId: expect.stringMatching(/^e1000000-/) });
    const keep = within(dialog).getByRole("button", { name: "Giữ phiếu" });
    await waitFor(() => expect(keep).toBeEnabled());
    fireEvent.click(keep);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expectNothingReal();
  });

  it("keeps filter writes on /dev/lists with the preview's own params", () => {
    search.value = "view=payment-requests&role=accountant&state=normal";
    render(<PaymentRequestsPreviewBody role="accountant" state="normal" />);

    const paid = paymentRequestFixtures.filter((row) => row.status === "paid").length;
    fireEvent.click(within(screen.getByRole("group", { name: "Lọc nhanh yêu cầu thanh toán" })).getByRole("button", { name: `Đã thanh toán${paid}` }));
    expect(router.replace).toHaveBeenLastCalledWith("/dev/lists?view=payment-requests&role=accountant&state=normal&status=paid", { scroll: false });
    expect(tableRows()).toHaveLength(paid);
  });

  it("accountant: cancel yes, no create (the create page needs students.view), no profile links", () => {
    render(<PaymentRequestsPreviewBody role="accountant" state="normal" />);

    expect(screen.getByRole("table", { name: TABLE })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Tạo yêu cầu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Mở hồ sơ học viên/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Hủy phiếu thu PAY-/ }).length).toBeGreaterThan(0);
  });

  it.each(["normal", "capped", "empty"] as const)("teaching assistant (%s): the route's own denial, no list", (state) => {
    render(<PaymentRequestsPreviewBody role="ta" state={state} />);

    expect(screen.getByRole("heading", { name: "Không có quyền xem yêu cầu thanh toán" })).toBeInTheDocument();
    expect(screen.getByText(/xem thanh toán/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("capped: the header says the list only holds the newest 1000", () => {
    render(<PaymentRequestsPreviewBody role="owner" state="capped" />);

    expect(screen.getByText("1000/1000 yêu cầu trong danh sách đã tải · chỉ gồm 1.000 yêu cầu mới nhất")).toBeInTheDocument();
    expect(screen.getAllByText("1–20 trong 1000 yêu cầu")).toHaveLength(2);
  });

  it.each(["owner", "accountant"] as const)("empty (%s) keeps the empty state inside the frame", (role) => {
    render(<PaymentRequestsPreviewBody role={role} state="empty" />);

    expect(screen.getByRole("table", { name: TABLE })).toBeInTheDocument();
    expect(screen.getAllByText("Chưa có yêu cầu thanh toán")).toHaveLength(2);
    expect(screen.queryByRole("group", { name: "Lọc nhanh yêu cầu thanh toán" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Tóm tắt danh sách yêu cầu đang tải" })).not.toBeInTheDocument();
  });
});
