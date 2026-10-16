// Value: protects=the /grading-credits list contract: scope badge, grader column and filter only with view_all, Vietnam-month bucketing at the 1 Oct 00:00 boundary, the default current month, an exact total vs "ít nhất N (trong {limit} tín chỉ mới nhất)", "Mở kết quả buổi" only with sessions.view, and in-frame empty / filtered-empty states with a reset; fails_when=a non-owner sees other graders, the filter bar stretches Tháng like a search box, the month follows the server timezone, a cut total is shown as exact, a link renders without sessions.view, or an empty list collapses to a bare page empty state; why_new=the page was a server component with no tests; seam=none (props only, no router); no_claim=the RPC scope/limit and the real container-query switch between table and cards (jsdom renders both layouts)
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GradingCreditListPage } from "@/features/grading-credits/grading-credit-list-page";
import type { GradingCreditDashboardEntry } from "@/features/grading-credits/read-models";

afterEach(cleanup);

function entry(
  id: string,
  creditedAt: string,
  overrides: Partial<GradingCreditDashboardEntry> = {},
): GradingCreditDashboardEntry {
  return {
    classCode: "6A",
    className: "Toán 6A",
    classSessionId: `session-${id}`,
    creditUnits: 1,
    creditedAt,
    graderDisplayName: "Trần Thu Hà",
    graderId: "grader-1",
    id,
    sessionDate: "2026-10-05",
    sessionResultId: `result-${id}`,
    studentFullName: "Nguyễn Minh An",
    studentId: `student-${id}`,
    studentPublicCode: "HS0001",
    ...overrides,
  };
}

// a: October. b: 2026-09-30T17:30Z = 1 Oct 00:30 in Vietnam, so October. c: 30 Sep 23:59 in Vietnam, so September.
const october = entry("a", "2026-10-12T03:00:00Z", { studentFullName: "Nguyễn Minh An", studentPublicCode: "HS0001" });
const boundaryOctober = entry("b", "2026-09-30T17:30:00Z", {
  classCode: "7B",
  className: "Toán 7B",
  graderDisplayName: "Phạm Lan",
  graderId: "grader-2",
  sessionDate: "2026-09-29",
  studentFullName: "Lê Hoàng Bảo",
  studentPublicCode: "HS0002",
});
const boundarySeptember = entry("c", "2026-09-30T16:59:00Z", {
  studentFullName: "Võ Thanh Dương",
  studentPublicCode: "HS0003",
});
const entries = [october, boundaryOctober, boundarySeptember];

const today = "2026-10-16";

function renderPage(
  props: Partial<React.ComponentProps<typeof GradingCreditListPage>> = {},
) {
  return render(
    <GradingCreditListPage
      canViewAll
      canViewSessions
      entries={entries}
      today={today}
      {...props}
    />,
  );
}

const table = () => screen.getByRole("table");
const bodyRows = () => within(table()).getAllByRole("row").slice(1);
const totalText = () => screen.getAllByTestId("grading-credit-total")[0];
const selectValue = (testId: string) => (screen.getByTestId(testId) as HTMLSelectElement).value;

describe("GradingCreditListPage header and scope", () => {
  it("shows the scope badge for view_all and for own credits", () => {
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Tín chỉ chấm bài" })).toBeInTheDocument();
    expect(screen.getByText("Phạm vi: toàn bộ")).toBeInTheDocument();
    cleanup();

    renderPage({ canViewAll: false });
    expect(screen.getByText("Phạm vi: của tôi")).toBeInTheDocument();
    expect(screen.queryByText("Phạm vi: toàn bộ")).not.toBeInTheDocument();
  });

  it("does not describe the total as the payroll grading quantity", () => {
    renderPage();
    expect(screen.getByText(/không phải số lượng chấm bài tính lương/)).toBeInTheDocument();
    expect(screen.queryByText(/quỹ chấm bài/i)).not.toBeInTheDocument();
  });
});

describe("GradingCreditListPage grader column and filter", () => {
  it("shows the Người chấm column and filter only with view_all", () => {
    renderPage();
    expect(within(table()).getByRole("columnheader", { name: "Người chấm" })).toBeInTheDocument();
    expect(screen.getByTestId("desktop-credit-grader")).toBeInTheDocument();
    expect(within(table()).getByText("Phạm Lan")).toBeInTheDocument();
    cleanup();

    renderPage({ canViewAll: false });
    expect(screen.queryByRole("columnheader", { name: "Người chấm" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("desktop-credit-grader")).not.toBeInTheDocument();
    // The b row has another grader; without view_all neither the table nor the cards print it.
    expect(screen.queryByText("Phạm Lan")).not.toBeInTheDocument();
  });

  it("lays the desktop filters out as equal peer tracks, one fewer without view_all", () => {
    renderPage();
    const bar = () => screen.getByRole("region", { name: "Bộ lọc tín chỉ chấm bài" });
    expect(bar().style.gridTemplateColumns).toBe("repeat(3, minmax(180px, 280px)) auto");
    cleanup();

    renderPage({ canViewAll: false });
    expect(bar().style.gridTemplateColumns).toBe("repeat(2, minmax(180px, 280px)) auto");
  });

  it("narrows the rows to one grader and updates the total", () => {
    renderPage();
    fireEvent.change(screen.getByTestId("desktop-credit-grader"), { target: { value: "grader-2" } });

    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]).toHaveTextContent("Lê Hoàng Bảo");
    expect(totalText()).toHaveTextContent(/^Tổng tín chỉ \(tháng 10\/2026, theo bộ lọc\): 1$/);
  });
});

describe("GradingCreditListPage Vietnam month", () => {
  it("defaults to the current Vietnam month and buckets the 1 Oct 00:30 credit into October", () => {
    renderPage();

    expect(selectValue("desktop-credit-month")).toBe("2026-10");
    const rows = bodyRows();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Nguyễn Minh An");
    // The timestamp renders in Vietnam time, not the host timezone.
    expect(rows[1]).toHaveTextContent("Lê Hoàng Bảo");
    expect(rows[1]).toHaveTextContent("00:30 01/10/2026");
    expect(within(table()).queryByText("Võ Thanh Dương")).not.toBeInTheDocument();
  });

  it("puts the 23:59 credit of 30 Sep in September and lists months newest first", () => {
    renderPage();
    const monthSelect = screen.getByTestId("desktop-credit-month");
    expect(within(monthSelect).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Tất cả",
      "Tháng 10/2026",
      "Tháng 09/2026",
    ]);

    fireEvent.change(monthSelect, { target: { value: "2026-09" } });
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]).toHaveTextContent("Võ Thanh Dương");
    expect(bodyRows()[0]).toHaveTextContent("23:59 30/09/2026");
  });

  it("falls back to Tất cả when no credit falls in the current month", () => {
    renderPage({ today: "2026-11-02" });

    expect(selectValue("desktop-credit-month")).toBe("all");
    expect(bodyRows()).toHaveLength(3);
    expect(totalText()).toHaveTextContent(/^Tổng tín chỉ: 3$/);
  });
});

describe("GradingCreditListPage total", () => {
  it("is exact when fewer credits than the limit were loaded", () => {
    renderPage();

    expect(totalText()).toHaveTextContent(/^Tổng tín chỉ \(tháng 10\/2026\): 2$/);
    expect(totalText()).not.toHaveTextContent("ít nhất");
  });

  it("is exact for a month that starts after the oldest loaded credit, and a lower bound otherwise", () => {
    // limit === loaded rows: the list may be cut at the oldest credit (30 Sep 23:59).
    renderPage({ limit: 3 });

    expect(totalText()).toHaveTextContent(/^Tổng tín chỉ \(tháng 10\/2026\): 2$/);

    fireEvent.change(screen.getByTestId("desktop-credit-month"), { target: { value: "2026-09" } });
    expect(totalText()).toHaveTextContent(
      /^Tổng tín chỉ \(tháng 09\/2026\): ít nhất 1 \(trong 3 tín chỉ mới nhất\)$/,
    );

    fireEvent.change(screen.getByTestId("desktop-credit-month"), { target: { value: "all" } });
    expect(totalText()).toHaveTextContent(/^Tổng tín chỉ: ít nhất 3 \(trong 3 tín chỉ mới nhất\)$/);
  });

  it("shows the same total above the narrow card list", () => {
    renderPage({ limit: 3 });
    fireEvent.change(screen.getByTestId("desktop-credit-month"), { target: { value: "all" } });

    const totals = screen.getAllByTestId("grading-credit-total");
    expect(totals).toHaveLength(2);
    expect(totals[1]).toHaveTextContent(totals[0].textContent ?? "");
  });
});

describe("GradingCreditListPage session link", () => {
  it("links each credit to its session only with sessions.view", () => {
    renderPage();

    expect(within(table()).getByRole("columnheader", { name: "Thao tác" })).toBeInTheDocument();
    const tableLinks = within(table()).getAllByRole("link", { name: /^Mở kết quả buổi/ });
    expect(tableLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/sessions/session-a",
      "/sessions/session-b",
    ]);
    expect(tableLinks[0]).toHaveTextContent("Mở kết quả buổi");

    const cards = screen.getByRole("list", { name: "Danh sách tín chỉ chấm bài" });
    expect(within(cards).getAllByRole("listitem")).toHaveLength(2);
    expect(within(cards).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/sessions/session-a",
      "/sessions/session-b",
    ]);
  });

  it("renders no link, no action column and unlinked cards without sessions.view", () => {
    renderPage({ canViewSessions: false });

    expect(screen.queryAllByRole("link")).toEqual([]);
    expect(screen.queryByRole("columnheader", { name: "Thao tác" })).not.toBeInTheDocument();
    const cards = screen.getByRole("list", { name: "Danh sách tín chỉ chấm bài" });
    expect(within(cards).getAllByRole("listitem")).toHaveLength(2);
  });

  it("defaults to no link when the permission prop is omitted", () => {
    renderPage({ canViewSessions: undefined });

    expect(screen.queryAllByRole("link")).toEqual([]);
  });
});

describe("GradingCreditListPage empty states", () => {
  it("renders the frame with an in-frame empty state when there is no data", () => {
    renderPage({ entries: [] });

    expect(screen.getByRole("heading", { level: 1, name: "Tín chỉ chấm bài" })).toBeInTheDocument();
    expect(bodyRows()).toEqual([]);
    expect(within(table()).getAllByRole("columnheader").length).toBeGreaterThanOrEqual(5);
    const frame = table().parentElement as HTMLElement;
    expect(within(frame).getByText("Chưa có tín chỉ chấm bài")).toBeInTheDocument();
    expect(screen.queryByTestId("grading-credit-total")).not.toBeInTheDocument();
    expect(screen.getByTestId("desktop-credit-month")).toBeDisabled();
  });

  it("explains a filtered-empty list and resets every filter from the empty state", () => {
    renderPage();
    fireEvent.change(screen.getByTestId("desktop-credit-class"), { target: { value: "7B" } });
    fireEvent.change(screen.getByTestId("desktop-credit-month"), { target: { value: "2026-09" } });

    expect(bodyRows()).toEqual([]);
    const frame = table().parentElement as HTMLElement;
    expect(within(frame).getByText("Không có tín chỉ khớp bộ lọc")).toBeInTheDocument();
    expect(totalText()).toHaveTextContent(/^Tổng tín chỉ \(tháng 09\/2026, theo bộ lọc\): 0$/);

    fireEvent.click(within(frame).getByRole("button", { name: "Xóa lọc" }));

    expect(selectValue("desktop-credit-month")).toBe("all");
    expect(selectValue("desktop-credit-class")).toBe("all");
    expect(bodyRows()).toHaveLength(3);
  });

  it("clears the active filters from the filter bar", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /^Xóa lọc \(1\)$/ }));
    expect(selectValue("desktop-credit-month")).toBe("all");
    expect(bodyRows()).toHaveLength(3);
  });
});

describe("GradingCreditListPage pagination", () => {
  const many = Array.from({ length: 25 }, (_, index) =>
    entry(`row-${index}`, `2026-10-${String(10 + (index % 5)).padStart(2, "0")}T03:00:00Z`, {
      studentFullName: `Học sinh ${index + 1}`,
    }),
  );

  it("shows 20 rows per page and returns to page 1 when a filter changes", () => {
    renderPage({ entries: many });
    const frameNav = () => screen.getByRole("navigation", { name: "Phân trang tín chỉ chấm bài" });

    expect(bodyRows()).toHaveLength(20);
    expect(frameNav()).toHaveTextContent("1–20 trong 25 tín chỉ");

    fireEvent.click(within(frameNav()).getByRole("button", { name: "Sau" }));
    expect(bodyRows()).toHaveLength(5);
    expect(frameNav()).toHaveTextContent("21–25 trong 25 tín chỉ");

    fireEvent.change(screen.getByTestId("desktop-credit-month"), { target: { value: "all" } });
    expect(bodyRows()).toHaveLength(20);
    expect(frameNav()).toHaveTextContent("1–20 trong 25 tín chỉ");
  });

  it("also paginates the compact card list", () => {
    renderPage({ entries: many });

    const compactNav = screen.getByRole("navigation", { name: "Phân trang tín chỉ chấm bài (danh sách gọn)" });
    fireEvent.click(within(compactNav).getByRole("button", { name: "Sau" }));
    const cards = screen.getByRole("list", { name: "Danh sách tín chỉ chấm bài" });
    expect(within(cards).getAllByRole("listitem")).toHaveLength(5);
  });
});

describe("GradingCreditListPage filter sheet", () => {
  it("opens the same filters in the narrow sheet and clears them there", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Bộ lọc, 1 đang áp dụng" }));
    const sheet = screen.getByRole("dialog", { name: "Bộ lọc" });
    expect(within(sheet).getByText("1 bộ lọc đang áp dụng")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Xem 2 tín chỉ" })).toBeInTheDocument();
    expect(within(sheet).getByTestId("mobile-credit-grader")).toBeInTheDocument();

    fireEvent.click(within(sheet).getByTestId("mobile-credit-reset-filters"));
    expect(within(sheet).getByText("Lọc danh sách tín chỉ chấm bài hiện có")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Xem 3 tín chỉ" })).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(3);
  });

  it("hides the grader field in the sheet without view_all", () => {
    renderPage({ canViewAll: false });

    fireEvent.click(screen.getByRole("button", { name: "Bộ lọc, 1 đang áp dụng" }));
    const sheet = screen.getByRole("dialog", { name: "Bộ lọc" });
    expect(within(sheet).getByTestId("mobile-credit-month")).toBeInTheDocument();
    expect(within(sheet).queryByTestId("mobile-credit-grader")).not.toBeInTheDocument();
  });
});
