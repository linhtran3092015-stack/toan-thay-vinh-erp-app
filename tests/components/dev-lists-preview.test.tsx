// Value: protects=the /dev/lists preview of design 16 (sessions, learning results, grading credits) renders the real list pages from fixtures with a fixed clock (16/10/2026 12:00), keeps every URL write on the History API and on /dev/lists itself (the router is never called and the address never becomes /sessions, so neither a click nor a reload reaches the production-backed route), gives the shell the real route as previewPathname, gates links and columns by the role's permissions (owner vs TA), covers the capped (a full lock-queue page: notice and N+ panel naming the same cap, the newest completed session without queue facts) and empty states, keeps the queue panel's "Lọc danh sách" on /dev/lists (pressing "Chờ khóa" there), falls back on unknown params and 404s in production;
// fails_when=the sessions list goes back to router.replace/push or writes /sessions?… from the preview, a fixture drifts so a state (lock queue readiness, overdue captions, cancelled reason, online link, Vietnam-month credit) disappears, the panel link leaves the preview, state=capped stops showing the partial queue (or its notice and panel disagree on the cap), the TA gets lock actions, class/student links or the grader column, the empty sessions view loses its table frame, the param whitelist stops falling back, or the production guard is removed;
// why_new=step 14a adds the sessions, results and credits views to /dev/lists;
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
