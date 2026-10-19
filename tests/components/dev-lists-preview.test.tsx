// Value: protects=the /dev/lists preview of design 16 (sessions, learning results, grading credits) renders the real list pages from fixtures with a fixed clock (16/10/2026 12:00), keeps every URL write on the History API and on /dev/lists itself (the router is never called and the address never becomes /sessions, so neither a click nor a reload reaches the production-backed route), gives the shell the real route as previewPathname, gates links and columns by the role's permissions (owner vs TA), covers the capped (a full lock-queue page: notice and N+ panel naming the same cap, the newest completed session without queue facts) and empty states, keeps the queue panel's "Lọc danh sách" on /dev/lists (pressing "Chờ khóa" there), falls back on unknown params and 404s in production;
// fails_when=the sessions list goes back to router.replace/push or writes /sessions?… from the preview, a fixture drifts so a state (lock queue readiness, overdue captions, cancelled reason, online link, Vietnam-month credit) disappears, the panel link leaves the preview, state=capped stops showing the partial queue (or its notice and panel disagree on the cap), the TA gets lock actions, class/student links or the grader column, the empty sessions view loses its table frame, the param whitelist stops falling back, or the production guard is removed;
// why_new=step 14a adds the sessions, results and credits views to /dev/lists; step 14b adds advances, staff and commissions (their bodies are covered by dev-lists-{advances,staff,commissions}-preview tests) and the accountant role; step 14c adds finance-orders, session-ledger and payment-requests (bodies covered by dev-lists-{finance-orders,session-ledger,payment-requests}-preview tests) and the accountant's finance grants on those views only; step 14d adds notifications, audit and reports (bodies covered by dev-lists-{notifications,audit,reports}-preview tests), the notifications.view/reports.view grants every role holds on those views, and the bell count taken from the notifications fixture;
// seam=next/navigation is mocked (notFound throws a marker, the router is spied, search params are a settable string, `view=sessions` in the sessions cases); AppShell is replaced by a marked wrapper exposing its props; window.history is spied; no_claim=does not prove the real routes' loaders or that /dev is unreachable in production at the proxy (public-coaching-route-access covers that gate)
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ListsPreview, type ListsPreviewRole, type ListsPreviewState, type ListsPreviewView } from "@/app/dev/lists/lists-preview";
import DevListsPage from "@/app/dev/lists/page";

const router = vi.hoisted(() => ({ back: vi.fn(), forward: vi.fn(), prefetch: vi.fn(), push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
const search = vi.hoisted(() => ({ value: "" }));
const shellProps = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  usePathname: () => "/dev/lists",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(search.value),
}));
vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children, ...props }: { children: ReactNode } & Record<string, unknown>) => {
    shellProps.last = props;
    return <div data-testid="app-shell">{children}</div>;
  },
}));

function renderPreview(view: ListsPreviewView, role: ListsPreviewRole = "owner", state: ListsPreviewState = "normal") {
  return render(<ListsPreview role={role} state={state} view={view} />);
}

const sessionList = () => screen.getByRole("list", { name: "Danh sách buổi học" });
const sessionTable = () => screen.getByRole("table", { name: "Danh sách buổi học" });

let replaceState: ReturnType<typeof vi.spyOn>;
let pushState: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  shellProps.last = null;
  search.value = "";
  replaceState = vi.spyOn(window.history, "replaceState");
  pushState = vi.spyOn(window.history, "pushState");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("/dev/lists page", () => {
  it("answers 404 in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(DevListsPage({ searchParams: Promise.resolve({ view: "sessions" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("whitelists view, role and state and falls back on anything else", async () => {
    const valid = (await DevListsPage({ searchParams: Promise.resolve({ role: "ta", state: "capped", view: "credits" }) })) as ReactElement<Record<string, unknown>>;
    expect(valid.props).toEqual({ role: "ta", state: "capped", view: "credits" });

    const fallback = (await DevListsPage({ searchParams: Promise.resolve({ role: "admin", state: ["empty", "normal"], view: "orders" }) })) as ReactElement<Record<string, unknown>>;
    expect(fallback.props).toEqual({ role: "owner", state: "empty", view: "students" });

    for (const view of ["advances", "staff", "commissions"] as const) {
      const step14b = (await DevListsPage({ searchParams: Promise.resolve({ role: "accountant", view }) })) as ReactElement<Record<string, unknown>>;
      expect(step14b.props).toEqual({ role: "accountant", state: "normal", view });
    }

    for (const view of ["finance-orders", "session-ledger", "payment-requests"] as const) {
      const step14c = (await DevListsPage({ searchParams: Promise.resolve({ role: "accountant", state: "capped", view }) })) as ReactElement<Record<string, unknown>>;
      expect(step14c.props).toEqual({ role: "accountant", state: "capped", view });
    }

    for (const view of ["notifications", "audit", "reports"] as const) {
      const step14d = (await DevListsPage({ searchParams: Promise.resolve({ role: "ta", state: "empty", view }) })) as ReactElement<Record<string, unknown>>;
      expect(step14d.props).toEqual({ role: "ta", state: "empty", view });
    }
  });
});

describe("/dev/lists sessions view (design 16b)", () => {
  // The preview's own query, as /dev/lists?view=sessions is opened.
  beforeEach(() => {
    search.value = "view=sessions";
  });

  it("passes the real route to the shell and renders every fixture state", () => {
    renderPreview("sessions");

    expect(shellProps.last?.previewPathname).toBe("/sessions");
    expect(within(sessionList()).getAllByRole("listitem")).toHaveLength(20);

    const table = sessionTable();
    // Lock queue readiness only where the queue has an item; overdue captions from the fixed clock.
    expect(within(table).getAllByText("Sẵn sàng khóa")).toHaveLength(1);
    expect(within(table).getByText("Thiếu 2 điểm danh")).toBeInTheDocument();
    expect(within(table).getByText("Không có học sinh")).toBeInTheDocument();
    expect(within(table).getByText("Chưa bắt đầu")).toBeInTheDocument();
    expect(within(table).getByText("Chưa hoàn thành")).toBeInTheDocument();
    expect(within(table).getByText(/Thầy Vinh đi tập huấn/)).toBeInTheDocument();
    expect(within(table).getAllByText("Online · có link").length).toBeGreaterThan(0);
    expect(within(table).getByText("16/18")).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: /^Khóa buổi học/ })).toHaveAttribute("href", "/sessions/s-lockable");
    // The newest completed session is in the queue too (one roster student unmarked): no full-queue notice.
    const newest = within(table).getByRole("link", { name: "Điểm danh buổi học Thứ 5, 15/10/2026 lớp L-7BO26" }).closest("tr") as HTMLElement;
    expect(newest).toHaveTextContent("Thiếu 1 điểm danh");
    expect(newest).toHaveTextContent("11/12");
    expect(screen.queryByText(/Hàng đợi khóa có từ/)).not.toBeInTheDocument();
  });

  it("keeps the panel's Lọc danh sách on the preview, where it presses Chờ khóa with its number", () => {
    const first = renderPreview("sessions");
    expect(screen.getByRole("link", { name: "Lọc danh sách" })).toHaveAttribute("href", "/dev/lists?view=sessions&status=completed&lock=unlocked&to=2026-10-16");
    first.unmount();

    search.value = "view=sessions&status=completed&lock=unlocked&to=2026-10-16";
    renderPreview("sessions");
    expect(screen.getByRole("button", { name: /^Chờ khóa\s?4$/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(sessionList()).getAllByRole("listitem")).toHaveLength(4);
  });

  it("renders a full lock queue for state=capped: the notice, N+ in the panel, no facts for the session the page cut", () => {
    renderPreview("sessions", "owner", "capped");
    // The notice and the panel name the same cap (the preview's 3), not the route's 500.
    expect(screen.getByRole("status")).toHaveTextContent("Hàng đợi khóa có từ 3 buổi trở lên");
    expect(screen.getByRole("heading", { name: /buổi đã hoàn thành chưa khóa/ })).toHaveTextContent("3+ buổi đã hoàn thành chưa khóa");
    // The link keeps the preview's state, so the list it opens is the same capped fixture.
    expect(screen.getByRole("link", { name: "Lọc danh sách" })).toHaveAttribute("href", "/dev/lists?view=sessions&state=capped&status=completed&lock=unlocked&to=2026-10-16");
    const cut = within(sessionTable()).getByRole("link", { name: "Mở buổi học Thứ 5, 15/10/2026 lớp L-7BO26" }).closest("tr") as HTMLElement;
    expect(cut).toHaveTextContent("11 đã ghi");
    expect(cut).not.toHaveTextContent(/Thiếu \d+ điểm danh|Sẵn sàng khóa/);
    // Its attendance is unknown, so "Chưa điểm danh" carries no number.
    expect(screen.getByRole("button", { name: "Chưa điểm danh" })).toBeEnabled();
  });

  it("writes chip state through the History API on /dev/lists and never calls the router", () => {
    renderPreview("sessions");

    // Paging pushes a history entry; filters replace it. Both keep view=sessions and stay on /dev/lists.
    fireEvent.click(screen.getAllByRole("button", { name: /^Sau|Trang sau/ })[0]);
    expect(pushState).toHaveBeenCalledWith(null, "", "/dev/lists?view=sessions&page=2");

    fireEvent.click(screen.getByRole("button", { name: /^Tuần này/ }));

    expect(replaceState).toHaveBeenCalledWith(null, "", "/dev/lists?view=sessions&from=2026-10-12&to=2026-10-18");
    const written = [...pushState.mock.calls, ...replaceState.mock.calls].map((call) => String(call[2]));
    expect(written.length).toBeGreaterThan(0);
    expect(written.filter((href) => !href.startsWith("/dev/lists?"))).toEqual([]);
    expect(screen.getByText("Tuần 12–18/10/2026 · 9 buổi · 4 chưa điểm danh · 4 chờ khóa")).toBeInTheDocument();
    expect(within(sessionList()).getAllByRole("listitem")).toHaveLength(9);
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("gives a TA no lock action, no class links and no create buttons", () => {
    renderPreview("sessions", "ta");

    const table = sessionTable();
    expect(within(table).queryByRole("link", { name: /^Khóa buổi học/ })).not.toBeInTheDocument();
    expect(within(table).getAllByRole("link", { name: /^Điểm danh buổi học/ }).length).toBeGreaterThan(0);
    expect(within(table).queryAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/classes/"))).toHaveLength(0);
    expect(screen.queryByRole("link", { name: "Tạo buổi học" })).not.toBeInTheDocument();
  });

  it("renders the empty state inside the table frame, without the queue panel", () => {
    renderPreview("sessions", "owner", "empty");
    expect(screen.queryByText(/đã hoàn thành chưa khóa/)).not.toBeInTheDocument();
    expect(sessionTable().parentElement).toHaveTextContent("Chưa có buổi học");
    expect(screen.queryByRole("list", { name: "Danh sách buổi học" })).not.toBeInTheDocument();
  });
});

describe("/dev/lists results view (design 16a)", () => {
  it("links students and sessions for the owner only", () => {
    const owner = renderPreview("results");
    expect(shellProps.last?.previewPathname).toBe("/learning-results");
    const ownerTable = screen.getByRole("table", { name: "Danh sách kết quả học tập" });
    expect(within(ownerTable).getAllByRole("link").some((link) => link.getAttribute("href")?.startsWith("/students/"))).toBe(true);
    owner.unmount();

    renderPreview("results", "ta");
    const taTable = screen.getByRole("table", { name: "Danh sách kết quả học tập" });
    const taLinks = within(taTable).queryAllByRole("link");
    expect(taLinks.some((link) => link.getAttribute("href")?.startsWith("/students/"))).toBe(false);
    expect(taLinks.some((link) => link.getAttribute("href")?.startsWith("/sessions/"))).toBe(true);
  });

  it("says when the 500-row cap was reached and renders the empty frame", () => {
    const capped = renderPreview("results", "owner", "capped");
    expect(screen.getByText(/500 kết quả mới nhất \(giới hạn tải\)/)).toBeInTheDocument();
    capped.unmount();

    renderPreview("results", "owner", "empty");
    expect(screen.getAllByText("Chưa có kết quả học tập").length).toBeGreaterThan(0);
  });
});

describe("/dev/lists credits view (design 16a)", () => {
  it("defaults to the Vietnam month of 16/10/2026 and counts the 00:30 credit in October", () => {
    renderPreview("credits");
    expect(shellProps.last?.previewPathname).toBe("/grading-credits");
    expect(screen.getByText("Phạm vi: toàn bộ")).toBeInTheDocument();
    expect(screen.getAllByTestId("grading-credit-total")[0]).toHaveTextContent("Tổng tín chỉ (tháng 10/2026): 18");
    expect(screen.getByRole("columnheader", { name: "Người chấm" })).toBeInTheDocument();
  });

  it("shows a TA only their own credits without the grader column", () => {
    renderPreview("credits", "ta");
    expect(screen.getByText("Phạm vi: của tôi")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Người chấm" })).not.toBeInTheDocument();
    expect(screen.getAllByTestId("grading-credit-total")[0]).toHaveTextContent("Tổng tín chỉ (tháng 10/2026): 10");
  });

  // Value: protects=only the owner (grading_credits.view_all) sees every grader's credits; the accountant gets the own-scope list like the TA; fails_when=the credits pick falls back to everyone's rows for any role other than "ta" (canViewAll false over everyone's credits: 18 instead of 10); why_new=step 14b added the accountant role and the old `role === "ta"` branch let it fall through to every grader's credits; seam=AppShell wrapper (permissions read from its props); no_claim=the real /grading-credits route, which denies the accountant (no grading_credits.view)
  it("shows the accountant only own-scope credits without the grader column", () => {
    renderPreview("credits", "accountant");
    expect(shellProps.last?.permissions).not.toContain("grading_credits.view_all");
    expect(screen.getByText("Phạm vi: của tôi")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Người chấm" })).not.toBeInTheDocument();
    expect(screen.getAllByTestId("grading-credit-total")[0]).toHaveTextContent("Tổng tín chỉ (tháng 10/2026): 10");
  });

  it("only claims a lower bound when the loaded rows fill the limit", () => {
    renderPreview("credits", "owner", "capped");
    fireEvent.change(screen.getByTestId("desktop-credit-month"), { target: { value: "all" } });
    expect(screen.getAllByTestId("grading-credit-total")[0]).toHaveTextContent("ít nhất 24 (trong 24 tín chỉ mới nhất)");
  });

  it("renders the in-frame empty state", () => {
    renderPreview("credits", "owner", "empty");
    expect(screen.getAllByText("Chưa có tín chỉ chấm bài").length).toBeGreaterThan(0);
  });
});

describe("/dev/lists step 14b views (design 16a, 16c)", () => {
  it("renders the advances, staff and commissions pages with the real route as previewPathname", () => {
    const advances = renderPreview("advances");
    expect(shellProps.last?.previewPathname).toBe("/advances");
    expect(screen.getByRole("table", { name: "Danh sách yêu cầu tạm ứng lương" })).toBeInTheDocument();
    advances.unmount();

    const staff = renderPreview("staff");
    expect(shellProps.last?.previewPathname).toBe("/staff");
    expect(screen.getByRole("table", { name: "Danh sách nhân sự" })).toBeInTheDocument();
    staff.unmount();

    renderPreview("commissions");
    expect(shellProps.last?.previewPathname).toBe("/commissions");
    expect(screen.getByRole("table", { name: "Danh sách doanh thu đủ điều kiện hoa hồng" })).toBeInTheDocument();
  });

  // Value: protects=the TA shell holds advances.request, advances.view and payroll.view like every role in the migrations, matching the advances preview's TA flags (canRequest, canViewPayroll), and still no review/approve or view_all; fails_when=the TA permission list drops one of them (the shell nav would hide /advances while the body offers "Yêu cầu tạm ứng") or gains a reviewer/manager code; why_new=step 14b's advances view assumed these codes but taPermissions predated it; seam=AppShell wrapper (permissions read from its props); no_claim=the real nav rules (navigation.test.ts)
  it("gives the TA shell the advance and payroll permissions every role holds", () => {
    renderPreview("advances", "ta");
    const permissions = shellProps.last?.permissions as string[];
    expect(permissions).toEqual(expect.arrayContaining(["advances.request", "advances.view", "payroll.view"]));
    for (const code of ["advances.review", "advances.owner_approve", "grading_credits.view_all", "staff.view"]) {
      expect(permissions).not.toContain(code);
    }
    expect(screen.getByRole("button", { name: "Yêu cầu tạm ứng" })).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /^(Đối soát|Phê duyệt)$/ })).toHaveLength(0);
  });

  it("signs the advances owner and the accountant in as the fixture people, with the accountant's narrow permissions", () => {
    const owner = renderPreview("advances");
    expect(shellProps.last?.authUser).toMatchObject({ displayName: "Nguyễn Văn Vinh" });
    owner.unmount();

    renderPreview("advances", "accountant");
    expect(shellProps.last?.authUser).toMatchObject({ displayName: "Lê Thu Hằng" });
    expect(shellProps.last?.permissions).toEqual(["advances.request", "advances.review", "advances.view", "payroll.view"]);
    // The accountant reviews but never approves.
    expect(screen.queryAllByRole("button", { name: "Phê duyệt" })).toHaveLength(0);
    expect(screen.getAllByRole("button", { name: "Đối soát" }).length).toBeGreaterThan(0);
  });
});

describe("/dev/lists step 14c views (design 16a finance rows)", () => {
  it("renders the orders, ledger and payment-request pages with the real route as previewPathname", () => {
    const orders = renderPreview("finance-orders");
    expect(shellProps.last?.previewPathname).toBe("/finance/orders");
    expect(screen.getByRole("table", { name: "Danh sách đơn hàng tài chính" })).toBeInTheDocument();
    orders.unmount();

    const ledger = renderPreview("session-ledger");
    expect(shellProps.last?.previewPathname).toBe("/finance/session-ledger");
    expect(screen.getByRole("table", { name: "Danh sách mục sổ cái số buổi mới nhất" })).toBeInTheDocument();
    ledger.unmount();

    renderPreview("payment-requests");
    expect(shellProps.last?.previewPathname).toBe("/finance/payment-requests");
    expect(screen.getByRole("table", { name: "Danh sách yêu cầu thanh toán" })).toBeInTheDocument();
  });

  // Value: protects=the accountant shell on the finance views holds the finance grants the migrations give that role (so the shell nav shows the Tài chính pages the body renders) and still lacks students.view, guardians.view, sessions.view and session_ledger.reverse, while the advances view keeps its exact four codes; fails_when=previewPermissions stops depending on the view (finance codes leak into the advances pin or vanish from the finance views) or grants a name/session/reversal code; why_new=step 14c adds finance views whose accountant needs finance codes; seam=AppShell wrapper (permissions read from its props); no_claim=the production permission matrix (the owner can edit it in Cài đặt)
  it("gives the accountant finance grants on the finance views only", () => {
    for (const view of ["finance-orders", "session-ledger", "payment-requests"] as const) {
      const rendered = renderPreview(view, "accountant");
      const permissions = shellProps.last?.permissions as string[];
      expect(permissions).toEqual(
        expect.arrayContaining(["advances.review", "finance.view", "payments.manage", "payments.view", "session_ledger.view"]),
      );
      for (const code of ["guardians.view", "session_ledger.reverse", "sessions.view", "students.view"]) {
        expect(permissions).not.toContain(code);
      }
      rendered.unmount();
    }

    renderPreview("advances", "accountant");
    expect(shellProps.last?.permissions).toEqual(["advances.request", "advances.review", "advances.view", "payroll.view"]);
  });

  it("shows the routes' own denial to the TA, who holds no finance codes", () => {
    const orders = renderPreview("finance-orders", "ta");
    expect(screen.getByText("Không có quyền xem Đơn hàng")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    orders.unmount();

    const ledger = renderPreview("session-ledger", "ta");
    expect(screen.getByText("Không có quyền xem Sổ cái số buổi")).toBeInTheDocument();
    ledger.unmount();

    renderPreview("payment-requests", "ta");
    expect(screen.getByText("Không có quyền xem yêu cầu thanh toán")).toBeInTheDocument();
    for (const code of ["finance.view", "payments.view", "session_ledger.view"]) {
      expect(shellProps.last?.permissions as string[]).not.toContain(code);
    }
  });
});

describe("/dev/lists step 14d views (design 16a system rows)", () => {
  it("renders the notifications, audit and reports pages with the real route as previewPathname", () => {
    const notifications = renderPreview("notifications");
    expect(shellProps.last?.previewPathname).toBe("/notifications");
    expect(screen.getByRole("list", { name: "Danh sách thông báo" })).toBeInTheDocument();
    notifications.unmount();

    const audit = renderPreview("audit");
    expect(shellProps.last?.previewPathname).toBe("/audit");
    expect(screen.getByRole("heading", { level: 1, name: "Nhật ký hệ thống" })).toBeInTheDocument();
    expect(screen.getAllByRole("table").length).toBeGreaterThan(0);
    audit.unmount();

    renderPreview("reports");
    expect(shellProps.last?.previewPathname).toBe("/reports");
    expect(screen.getByRole("heading", { level: 1, name: "Báo cáo & Xuất dữ liệu" })).toBeInTheDocument();
  });

  // Value: protects=the TA and accountant shells on the system views hold notifications.view and reports.view (every app role does per migrations) but never audit.view, while their other views keep the earlier exact sets, and the bell shows the notifications fixture's own unread total; fails_when=the system grants leak into another view (the advances accountant pin) or vanish from these views (the shell nav would hide pages the body renders), audit.view reaches a non-owner, or the bell keeps a hard-coded count that disagrees with the page header; why_new=step 14d adds three views whose non-owner roles need these codes; seam=AppShell wrapper (permissions and unreadNotificationCount read from its props); no_claim=the production permission matrix (the owner can edit it in Cài đặt)
  it("grants notifications and reports, never audit, to the TA and the accountant on the system views only", () => {
    for (const role of ["ta", "accountant"] as const) {
      for (const view of ["notifications", "audit", "reports"] as const) {
        const rendered = renderPreview(view, role);
        const permissions = shellProps.last?.permissions as string[];
        expect(permissions).toEqual(expect.arrayContaining(["notifications.view", "reports.view"]));
        expect(permissions).not.toContain("audit.view");
        rendered.unmount();
      }
    }

    const owner = renderPreview("audit");
    expect(shellProps.last?.permissions as string[]).toContain("audit.view");
    owner.unmount();

    renderPreview("advances", "accountant");
    expect(shellProps.last?.permissions).toEqual(["advances.request", "advances.review", "advances.view", "payroll.view"]);
  });

  // Value: protects=the reports and audit bodies decide from the same permission codes the shell gets (one source, preview-permissions.ts): a reports card shows exactly when the shell holds its module view, and "empty" drops those views from both; fails_when=a body keeps its own copy of the role sets again (the nav and the cards could disagree) or the empty state leaves module views in the shell; why_new=review cycle 1 (testing + maintainability) found the reports body hand-copied the controller's sets; seam=AppShell wrapper (permissions read from its props); no_claim=the production permission matrix
  it("gives the reports and audit bodies the shell's own permission codes", () => {
    for (const role of ["owner", "ta", "accountant"] as const) {
      for (const state of ["normal", "empty"] as const) {
        const rendered = renderPreview("reports", role, state);
        const shell = shellProps.last?.permissions as string[];
        const cards = screen.queryAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
        expect(cards.includes("Danh sách buổi học")).toBe(shell.includes("sessions.view"));
        expect(cards.includes("Danh sách học viên")).toBe(shell.includes("students.view"));
        if (state === "empty") {
          expect(shell.filter((code) => ["crm.view", "sessions.view", "staff.view", "students.view"].includes(code))).toEqual([]);
        }
        rendered.unmount();
      }
    }
  });

  it("shows the audit route's own denial to the TA and the accountant", () => {
    for (const role of ["ta", "accountant"] as const) {
      const rendered = renderPreview("audit", role);
      expect(screen.getByText("Không có quyền xem nhật ký hệ thống")).toBeInTheDocument();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      rendered.unmount();
    }
  });

  it("passes the notifications fixture's unread total to the bell on that view only", () => {
    const empty = renderPreview("notifications", "owner", "empty");
    expect(shellProps.last?.unreadNotificationCount).toBe(0);
    empty.unmount();

    const normal = renderPreview("notifications");
    const count = shellProps.last?.unreadNotificationCount as number;
    expect(count).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(`^${count} chưa đọc`))).toBeInTheDocument();
    normal.unmount();

    renderPreview("students");
    expect(shellProps.last?.unreadNotificationCount).toBe(4);
  });
});
