import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LearningResultsSkeleton } from "@/features/learning-results/components/learning-results-skeleton";
import { LearningResultsPage } from "@/features/learning-results/learning-results-page";
import {
  LEARNING_RESULTS_LIMIT,
  type LearningResultDirectoryItem,
} from "@/features/learning-results/read-models";

afterEach(cleanup);

function makeItem(
  overrides: Partial<LearningResultDirectoryItem> = {},
): LearningResultDirectoryItem {
  return {
    classCode: "9A",
    classGrade: 9,
    classId: "class-9a",
    classLevel: "A",
    className: "Toán 9A",
    classSessionId: "session-1",
    currentGrade: 9,
    gradedAt: "2026-10-15T01:30:00Z",
    lockedAt: null,
    notebookScore: 8,
    notebookStatus: "submitted",
    resultComment: "Làm bài cẩn thận.",
    resultId: "result-1",
    sessionDate: "2026-10-14",
    sessionStatus: "completed",
    studentCode: "HS0001",
    studentId: "student-1",
    studentName: "Nguyễn Minh An",
    testScore: 7.5,
    ...overrides,
  };
}

/** One row per interesting state, ids and names distinct so each can be found. */
const items: LearningResultDirectoryItem[] = [
  makeItem(),
  makeItem({
    classSessionId: "session-2",
    gradedAt: null,
    resultComment: null,
    resultId: "result-2",
    studentCode: "HS0002",
    studentId: "student-2",
    studentName: "Trần Bảo Châu",
    testScore: null,
  }),
  makeItem({
    classSessionId: "session-3",
    notebookScore: null,
    notebookStatus: "not_submitted",
    resultId: "result-3",
    studentCode: "HS0003",
    studentId: "student-3",
    studentName: "Lê Quốc Dũng",
    testScore: 4,
  }),
  makeItem({
    classCode: "8B",
    classGrade: 8,
    classId: "class-8b",
    className: "Toán 8B",
    classSessionId: "session-4",
    lockedAt: "2026-10-20T00:00:00Z",
    notebookScore: null,
    notebookStatus: "not_required",
    resultComment: null,
    resultId: "result-4",
    sessionDate: "2026-10-10",
    studentCode: "HS0004",
    studentId: "student-4",
    studentName: "Phạm Thu Hà",
    testScore: 9,
  }),
  makeItem({
    classCode: "8B",
    classGrade: 8,
    classId: "class-8b",
    className: "Toán 8B",
    classSessionId: "session-5",
    notebookScore: 3.5,
    resultId: "result-5",
    sessionDate: "2026-10-09",
    studentCode: "HS0005",
    studentId: "student-5",
    studentName: "Đỗ Gia Huy",
    testScore: 6,
  }),
];

const permissions = { canViewSessions: true, canViewStudents: true };

function renderPage(
  props: Partial<React.ComponentProps<typeof LearningResultsPage>> = {},
) {
  return render(
    <LearningResultsPage {...permissions} items={items} {...props} />,
  );
}

const tableRows = () =>
  within(
    screen.getByRole("table", { name: "Danh sách kết quả học tập" }),
  )
    .getAllByRole("row")
    .slice(1);
const chip = (label: string, count: number) =>
  new RegExp(`^${label}\\s?${count}$`);
const chipGroup = () =>
  screen.getByRole("group", { name: "Lọc nhanh kết quả" });
/** The 13px context line under the title (the narrow list repeats the count, so scope to the header). */
const headerLine = () =>
  within(
    screen.getByRole("heading", { level: 1 }).closest("header") as HTMLElement,
  ).getByText(/kết quả/);
const cards = () =>
  within(
    screen.getByRole("list", { name: "Danh sách kết quả học tập" }),
  ).queryAllByRole("listitem");

function manyItems(count: number): LearningResultDirectoryItem[] {
  return Array.from({ length: count }, (_, index) =>
    makeItem({
      resultId: `result-${index}`,
      studentCode: `HS${String(index).padStart(4, "0")}`,
      studentId: `student-${index}`,
      studentName: `Học sinh ${String(index + 1).padStart(3, "0")}`,
    }),
  );
}

describe("Learning results directory (design 16a)", () => {
  it("shows the title, the loaded count and the quick chips with counts", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Kết quả học tập" }),
    ).toBeInTheDocument();
    expect(headerLine()).toHaveTextContent(/^5 kết quả$/);
    expect(screen.queryByText(/kết quả mới nhất/)).not.toBeInTheDocument();

    const chips = within(chipGroup());
    expect(chips.getByRole("button", { name: chip("Tất cả", 5) })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(chips.getByRole("button", { name: chip("Chưa có điểm", 1) })).toBeEnabled();
    expect(chips.getByRole("button", { name: chip("Dưới 5", 1) })).toBeEnabled();
    expect(chips.getByRole("button", { name: chip("Vở chưa nộp", 1) })).toBeEnabled();
    // result-3 (not submitted, 4), result-5 (notebook 3.5) and result-3's test score
    expect(chips.getByRole("button", { name: chip("Cần chú ý", 2) })).toBeEnabled();
    expect(tableRows()).toHaveLength(5);
  });

  it("counts Dưới 5 over scores only: a missing score is not below 5", () => {
    renderPage();

    const chips = within(chipGroup());
    fireEvent.click(chips.getByRole("button", { name: chip("Dưới 5", 1) }));

    expect(tableRows()).toHaveLength(1);
    expect(tableRows()[0]).toHaveTextContent("Lê Quốc Dũng");
    expect(tableRows().map((row) => row.textContent).join("")).not.toContain(
      "Trần Bảo Châu",
    );
    expect(
      chips.getByRole("button", { name: chip("Dưới 5", 1) }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("narrows to Chưa có điểm, Vở chưa nộp and Cần chú ý rows", () => {
    renderPage();
    const chips = within(chipGroup());

    fireEvent.click(chips.getByRole("button", { name: chip("Chưa có điểm", 1) }));
    expect(tableRows()).toHaveLength(1);
    expect(tableRows()[0]).toHaveTextContent("Trần Bảo Châu");

    fireEvent.click(chips.getByRole("button", { name: chip("Vở chưa nộp", 1) }));
    expect(tableRows()).toHaveLength(1);
    expect(tableRows()[0]).toHaveTextContent("Lê Quốc Dũng");

    fireEvent.click(chips.getByRole("button", { name: chip("Cần chú ý", 2) }));
    expect(tableRows().map((row) => row.textContent)).toEqual([
      expect.stringContaining("Lê Quốc Dũng"),
      expect.stringContaining("Đỗ Gia Huy"),
    ]);

    fireEvent.click(chips.getByRole("button", { name: chip("Tất cả", 5) }));
    expect(tableRows()).toHaveLength(5);
  });

  it("combines the filter bar with the chips and recounts the chips", () => {
    renderPage();

    fireEvent.change(screen.getByTestId("desktop-result-class"), {
      target: { value: "class-8b" },
    });
    // Counts follow the class filter but ignore the chip's own filter.
    const chips = within(chipGroup());
    expect(chips.getByRole("button", { name: chip("Tất cả", 2) })).toBeInTheDocument();
    expect(chips.getByRole("button", { name: chip("Chưa có điểm", 0) })).toBeDisabled();
    expect(chips.getByRole("button", { name: chip("Dưới 5", 0) })).toBeDisabled();
    expect(chips.getByRole("button", { name: chip("Cần chú ý", 1) })).toBeEnabled();
    expect(headerLine()).toHaveTextContent("5 kết quả · 2 khớp bộ lọc");

    fireEvent.click(chips.getByRole("button", { name: chip("Cần chú ý", 1) }));
    expect(tableRows()).toHaveLength(1);
    expect(tableRows()[0]).toHaveTextContent("Đỗ Gia Huy");

    // Filter-bar notebook select mirrors the Vở chưa nộp chip and clears the other chip.
    fireEvent.change(screen.getByTestId("desktop-result-class"), {
      target: { value: "" },
    });
    fireEvent.click(within(chipGroup()).getByRole("button", { name: chip("Tất cả", 5) }));
    fireEvent.change(screen.getByTestId("desktop-result-notebook"), {
      target: { value: "not_submitted" },
    });
    expect(
      within(chipGroup()).getByRole("button", { name: chip("Vở chưa nộp", 1) }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(chipGroup()).getByRole("button", { name: chip("Cần chú ý", 2) }),
    ).toHaveAttribute("aria-pressed", "false");

    // A score filter on top of the notebook filter matches no single chip.
    fireEvent.change(screen.getByTestId("desktop-result-score"), {
      target: { value: "scored" },
    });
    expect(
      within(chipGroup())
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-pressed") === "true"),
    ).toHaveLength(0);
    expect(tableRows()).toHaveLength(1);
  });

  it("searches name, code and class ignoring accents, and filters by class grade and dates", () => {
    renderPage();

    fireEvent.change(screen.getByTestId("desktop-result-search"), {
      target: { value: "do gia" },
    });
    expect(tableRows()).toHaveLength(1);
    expect(tableRows()[0]).toHaveTextContent("Đỗ Gia Huy");

    fireEvent.change(screen.getByTestId("desktop-result-search"), {
      target: { value: "hs0003" },
    });
    expect(tableRows()[0]).toHaveTextContent("Lê Quốc Dũng");

    fireEvent.change(screen.getByTestId("desktop-result-search"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByTestId("desktop-result-grade"), {
      target: { value: "8" },
    });
    expect(tableRows()).toHaveLength(2);

    fireEvent.change(screen.getByTestId("desktop-result-date-from"), {
      target: { value: "2026-10-10" },
    });
    expect(tableRows()).toHaveLength(1);
    expect(tableRows()[0]).toHaveTextContent("Phạm Thu Hà");

    fireEvent.change(screen.getByTestId("desktop-result-date-to"), {
      target: { value: "2026-10-09" },
    });
    expect(screen.getAllByText("Không có kết quả khớp bộ lọc")).not.toHaveLength(0);
  });

  it("offers only Có điểm and Chưa có điểm as plain score states plus the chip mirrors", () => {
    renderPage();

    const select = within(screen.getByTestId("desktop-result-score"));
    expect(select.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Tất cả",
      "Có điểm",
      "Chưa có điểm",
      "Dưới 5",
      "Cần chú ý",
    ]);

    fireEvent.change(screen.getByTestId("desktop-result-score"), {
      target: { value: "scored" },
    });
    expect(tableRows()).toHaveLength(4);
    expect(tableRows().map((row) => row.textContent).join("")).not.toContain(
      "Trần Bảo Châu",
    );
  });

  it("pages 20 rows at a time in the frame and the card list", () => {
    renderPage({ items: manyItems(45) });

    expect(headerLine()).toHaveTextContent(/^45 kết quả$/);
    expect(tableRows()).toHaveLength(20);
    expect(cards()).toHaveLength(20);
    const frameNav = screen.getByRole("navigation", {
      name: "Phân trang kết quả học tập",
    });
    expect(frameNav).toHaveTextContent("1–20 trong 45 kết quả");
    expect(
      screen.getByRole("navigation", {
        name: "Phân trang kết quả học tập (danh sách gọn)",
      }),
    ).toHaveTextContent("1–20 trong 45 kết quả");

    fireEvent.click(within(frameNav).getByRole("button", { name: "Sau" }));
    expect(tableRows()[0]).toHaveTextContent("Học sinh 021");
    expect(frameNav).toHaveTextContent("21–40 trong 45 kết quả");

    fireEvent.click(within(frameNav).getByRole("button", { name: "3" }));
    expect(tableRows()).toHaveLength(5);
    expect(frameNav).toHaveTextContent("41–45 trong 45 kết quả");
  });

  it("returns to page 1 when a filter changes", () => {
    renderPage({ items: manyItems(45) });
    const frameNav = screen.getByRole("navigation", {
      name: "Phân trang kết quả học tập",
    });
    fireEvent.click(within(frameNav).getByRole("button", { name: "3" }));
    expect(tableRows()).toHaveLength(5);

    fireEvent.change(screen.getByTestId("desktop-result-search"), {
      target: { value: "Học sinh 0" },
    });
    expect(tableRows()).toHaveLength(20);
    expect(tableRows()[0]).toHaveTextContent("Học sinh 001");
  });

  it("says the newest 500 were loaded only when the cap was reached", () => {
    const view = renderPage({ items: manyItems(LEARNING_RESULTS_LIMIT) });
    expect(
      screen.getByText(/500 kết quả mới nhất \(giới hạn tải\)/),
    ).toBeInTheDocument();
    view.unmount();

    renderPage({ items: manyItems(LEARNING_RESULTS_LIMIT - 1) });
    expect(screen.queryByText(/kết quả mới nhất/)).not.toBeInTheDocument();
  });

  it("links the student only with students.view and the session only with sessions.view", () => {
    const view = renderPage();

    const row = () => tableRows()[0];
    expect(
      within(row()).getByRole("link", { name: "Nguyễn Minh An" }),
    ).toHaveAttribute("href", "/students/student-1");
    expect(
      within(row()).getByRole("link", {
        name: "Mở buổi học 14/10/2026 lớp 9A của Nguyễn Minh An",
      }),
    ).toHaveAttribute("href", "/sessions/session-1");
    // The date itself is the link; there is no separate "Mở buổi" caption.
    expect(
      within(row()).getByRole("link", {
        name: "Mở buổi học 14/10/2026 lớp 9A của Nguyễn Minh An",
      }),
    ).toHaveTextContent(/^14\/10\/2026$/);
    expect(within(row()).queryByText("Mở buổi")).not.toBeInTheDocument();
    view.unmount();

    const noLinks = renderPage({ canViewSessions: false, canViewStudents: false });
    expect(within(tableRows()[0]).queryAllByRole("link")).toHaveLength(0);
    expect(within(tableRows()[0]).getByText("Nguyễn Minh An")).toBeInTheDocument();
    expect(within(tableRows()[0]).getByText("14/10/2026")).toBeInTheDocument();
    noLinks.unmount();

    renderPage({ canViewSessions: false });
    expect(
      within(tableRows()[0]).getByRole("link", { name: "Nguyễn Minh An" }),
    ).toBeInTheDocument();
    // Without sessions.view the date is plain text, not a link.
    expect(within(tableRows()[0]).getByText("14/10/2026")).toBeInTheDocument();
    expect(
      within(tableRows()[0]).queryByRole("link", { name: /Mở buổi học/ }),
    ).not.toBeInTheDocument();
  });

  it("makes each card link to the session, else the student, else nothing", () => {
    const view = renderPage();
    expect(cards()).toHaveLength(5);
    expect(
      within(cards()[0]).getByRole("link", {
        name: "Mở buổi học 14/10/2026 lớp 9A của Nguyễn Minh An",
      }),
    ).toHaveAttribute("href", "/sessions/session-1");
    view.unmount();

    const studentOnly = renderPage({ canViewSessions: false });
    expect(
      within(cards()[0]).getByRole("link", {
        name: "Mở hồ sơ học viên Nguyễn Minh An",
      }),
    ).toHaveAttribute("href", "/students/student-1");
    studentOnly.unmount();

    renderPage({ canViewSessions: false, canViewStudents: false });
    expect(cards()).toHaveLength(5);
    expect(within(cards()[0]).queryAllByRole("link")).toHaveLength(0);
    expect(cards()[0]).toHaveTextContent("Nguyễn Minh An");
  });

  it("renders scores, notebook badges, comment, graded time in Vietnam time and the lock state", () => {
    renderPage();
    const [first, missing, notSubmitted, locked, lowNotebook] = tableRows();

    // 2026-10-15T01:30:00Z is 08:30 in Vietnam, whatever the machine's zone is.
    expect(first).toHaveTextContent("7,5");
    expect(within(first).getByText("Đã nộp")).toBeInTheDocument();
    expect(first).toHaveTextContent("8");
    expect(first).toHaveTextContent("08:30 15/10/2026");
    expect(within(first).getByText("Làm bài cẩn thận.")).toHaveAttribute(
      "title",
      "Làm bài cẩn thận.",
    );
    expect(within(first).getByText("Chưa khóa")).toBeInTheDocument();
    expect(within(first).queryByText("Đã khóa")).not.toBeInTheDocument();
    expect(first).toHaveTextContent("HS0001");
    expect(first).toHaveTextContent("9A · K9 · A");

    // No test score and never graded: a dash named "Chưa có điểm", em dash for time and comment.
    expect(within(missing).getByText("Chưa có điểm")).toHaveClass("sr-only");
    expect(within(missing).getByTitle("Chưa có điểm")).toHaveTextContent("—");
    expect(within(missing).getAllByText("—")).toHaveLength(3);

    // Under 5 is announced, not only coloured; unsubmitted notebook has no score.
    expect(within(notSubmitted).getByText("4")).toHaveClass("text-danger");
    expect(notSubmitted).toHaveTextContent("4 (dưới chuẩn)");
    expect(within(notSubmitted).getByText("Chưa nộp")).toBeInTheDocument();

    expect(within(locked).getByText("Không yêu cầu")).toBeInTheDocument();
    expect(within(locked).getByText("Đã khóa")).toBeInTheDocument();
    expect(within(locked).queryByText("Chưa khóa")).not.toBeInTheDocument();

    expect(lowNotebook).toHaveTextContent("3,5 (dưới chuẩn)");
  });

  it("describes a card with the band badge and the notebook state", () => {
    renderPage();
    const [good, missing, low, , lowNotebook] = cards();

    expect(good).toHaveTextContent("Nguyễn Minh An");
    expect(within(good).getByText("Đạt 7,5/10")).toBeInTheDocument();
    expect(good).toHaveTextContent("Toán 9A · 14/10/2026");
    expect(within(good).getByText("Đã nộp vở")).toBeInTheDocument();
    expect(good).toHaveTextContent("8/10");

    expect(within(missing).getByText("Chưa có điểm")).toBeInTheDocument();
    expect(within(low).getByText("Dưới chuẩn 4/10")).toBeInTheDocument();
    expect(within(low).getByText("Chưa nộp vở")).toBeInTheDocument();
    expect(within(lowNotebook).getByText("Đạt 6/10")).toBeInTheDocument();
    expect(within(cards()[3]).getByText("Tốt 9/10")).toBeInTheDocument();
    expect(within(cards()[3]).getByText("Không yêu cầu vở")).toBeInTheDocument();
  });

  it("renders the frame with an in-frame empty state when nothing was loaded", () => {
    renderPage({ items: [] });

    expect(headerLine()).toHaveTextContent(/^0 kết quả$/);
    expect(
      screen.getByRole("table", { name: "Danh sách kết quả học tập" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Chưa có kết quả học tập")).not.toHaveLength(0);
    expect(screen.queryByText("Không có kết quả khớp bộ lọc")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xóa lọc" })).not.toBeInTheDocument();
    expect(
      within(chipGroup()).getByRole("button", { name: chip("Tất cả", 0) }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByRole("navigation", { name: "Phân trang kết quả học tập" }),
    ).not.toBeInTheDocument();
  });

  it("shows a filtered-empty state whose reset restores every row", () => {
    renderPage();

    fireEvent.change(screen.getByTestId("desktop-result-search"), {
      target: { value: "không có ai tên thế" },
    });

    const table = screen.getByRole("table", { name: "Danh sách kết quả học tập" });
    const frame = table.parentElement as HTMLElement;
    expect(within(frame).getByText("Không có kết quả khớp bộ lọc")).toBeInTheDocument();
    expect(within(frame).queryByText("Chưa có kết quả học tập")).not.toBeInTheDocument();
    expect(tableRows()).toHaveLength(0);
    expect(
      screen.queryByRole("list", { name: "Danh sách kết quả học tập" }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(frame).getByRole("button", { name: "Xóa lọc" }));
    expect(tableRows()).toHaveLength(5);
    expect(screen.queryByText("Không có kết quả khớp bộ lọc")).not.toBeInTheDocument();
  });

  it("clears every filter with Xóa lọc (n)", () => {
    renderPage();
    fireEvent.change(screen.getByTestId("desktop-result-grade"), { target: { value: "8" } });
    fireEvent.change(screen.getByTestId("desktop-result-search"), { target: { value: "ha" } });

    const reset = screen.getByRole("button", { name: /^Xóa lọc \(2\)$/ });
    fireEvent.click(reset);

    expect(tableRows()).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /^Xóa lọc \(/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("desktop-result-grade")).toHaveValue("");
  });

  it("opens the same filters in the narrow sheet and counts them on the trigger", () => {
    renderPage();

    const trigger = screen.getByRole("button", { name: "Bộ lọc" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Bộ lọc" });
    expect(within(dialog).getByText("Lọc danh sách kết quả học tập hiện có")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("mobile-result-grade"), { target: { value: "8" } });
    fireEvent.change(screen.getByTestId("mobile-result-notebook"), {
      target: { value: "not_submitted" },
    });
    expect(within(dialog).getByText("2 bộ lọc đang áp dụng")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Xem 0 kết quả" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bộ lọc, 2 đang áp dụng" })).toHaveTextContent(
      "Bộ lọc · 2",
    );

    fireEvent.click(screen.getByTestId("mobile-result-reset-filters"));
    expect(within(dialog).getByText("Lọc danh sách kết quả học tập hiện có")).toBeInTheDocument();
    expect(tableRows()).toHaveLength(5);
  });

  it("searches from the inline narrow-width field too", () => {
    renderPage();

    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm kết quả học tập" }), {
      target: { value: "chau" },
    });
    expect(tableRows()).toHaveLength(1);
    expect(cards()).toHaveLength(1);
    expect(screen.getByTestId("desktop-result-search")).toHaveValue("chau");
  });

  it("gives the date columns a floor that shows a full date", () => {
    renderPage();

    const bar = screen.getByRole("region", { name: "Bộ lọc kết quả học tập" });
    const track = String.raw`minmax\([^)]*\)`;
    const date = String.raw`minmax\(148px[^)]*\)`;
    // Search (180px floor), lớp, khối, từ ngày, đến ngày, vở, tình trạng điểm, reset.
    expect(bar.style.gridTemplateColumns).toMatch(
      new RegExp(
        `^minmax\\(180px[^)]*\\) ${track} ${track} ${date} ${date} ${track} ${track} auto$`,
      ),
    );
  });

  it("uses 56px rows for the two-line cells and a 32px date link", () => {
    renderPage();

    const [first] = tableRows();
    expect(first).toHaveClass("h-14");
    expect(first).not.toHaveClass("h-12");
    expect(
      within(first).getByRole("link", {
        name: "Mở buổi học 14/10/2026 lớp 9A của Nguyễn Minh An",
      }),
    ).toHaveClass("h-8", "inline-flex");
    // Captions use the 12/16 caption role, not a 14px line-height override.
    expect(within(first).getByText("HS0001").className).not.toMatch(/leading-/);
  });

  it("makes the quick chips 44px targets on phones", () => {
    renderPage();

    expect(chipGroup()).toHaveClass("max-md:[&_button]:h-11");
  });

  describe("capped load window", () => {
    /** 500 rows, the oldest one on 2026-09-02, the rest on 2026-10-14. */
    function cappedItems(): LearningResultDirectoryItem[] {
      return manyItems(LEARNING_RESULTS_LIMIT).map((row, index) =>
        index === LEARNING_RESULTS_LIMIT - 1
          ? { ...row, sessionDate: "2026-09-02" }
          : row,
      );
    }
    const notice = () => screen.queryByRole("status");
    const setDate = (key: "from" | "to", value: string) =>
      fireEvent.change(screen.getByTestId(`desktop-result-date-${key}`), {
        target: { value },
      });

    it("warns when the chosen start date is on or before the oldest loaded day", () => {
      renderPage({ items: cappedItems() });
      expect(notice()).not.toBeInTheDocument();

      setDate("from", "2026-08-01");
      expect(notice()).toHaveTextContent(
        "Khoảng ngày đang chọn vượt quá 500 kết quả mới nhất đã tải; từ 02/09/2026 trở về trước có thể thiếu kết quả.",
      );
      // The loaded rows in range still list; the notice does not replace them.
      expect(tableRows()).toHaveLength(20);

      // The oldest loaded day can be cut partway by the cap, so starting on it is still incomplete.
      setDate("from", "2026-09-02");
      expect(notice()).toHaveTextContent(/từ 02\/09\/2026 trở về trước có thể thiếu kết quả/);

      // Starting after the oldest loaded day is inside the window.
      setDate("from", "2026-09-03");
      expect(notice()).not.toBeInTheDocument();
    });

    it("warns when only an end date is chosen, whichever side of the oldest loaded day it falls on", () => {
      renderPage({ items: cappedItems() });

      // Older than every loaded row, beside the filtered-empty state.
      setDate("to", "2026-08-01");
      expect(notice()).toHaveTextContent(/từ 02\/09\/2026 trở về trước có thể thiếu kết quả/);
      expect(tableRows()).toHaveLength(0);

      // Newer than the oldest loaded day: with no start date the range still reaches back past the cap.
      setDate("to", "2026-10-20");
      expect(notice()).toHaveTextContent(/từ 02\/09\/2026 trở về trước có thể thiếu kết quả/);
      expect(tableRows()).toHaveLength(20);

      // A start date after the oldest loaded day bounds the range from below again.
      setDate("from", "2026-10-01");
      expect(notice()).not.toBeInTheDocument();
    });

    it("leaves the chip counts off while the notice shows, and brings them back after", () => {
      renderPage({ items: cappedItems() });
      const chips = () => within(chipGroup());

      // Without a date range the counts are exact, and an empty chip is disabled.
      expect(chips().getByRole("button", { name: chip("Tất cả", 500) })).toBeEnabled();
      expect(chips().getByRole("button", { name: chip("Chưa có điểm", 0) })).toBeDisabled();

      setDate("from", "2026-08-01");
      expect(notice()).toBeInTheDocument();
      for (const label of ["Tất cả", "Cần chú ý", "Dưới 5", "Vở chưa nộp", "Chưa có điểm"]) {
        // The accessible name is the bare label: no number, and no chip disabled for a count it does not show.
        expect(chips().getByRole("button", { name: label })).toBeEnabled();
      }

      setDate("from", "2026-09-03");
      expect(notice()).not.toBeInTheDocument();
      expect(chips().getByRole("button", { name: chip("Tất cả", 499) })).toBeEnabled();
      expect(chips().getByRole("button", { name: chip("Chưa có điểm", 0) })).toBeDisabled();
    });

    it("says the range is older than the loaded results when the notice and an empty list coincide", () => {
      renderPage({ items: cappedItems() });

      setDate("to", "2026-08-01");
      expect(notice()).toBeInTheDocument();
      expect(tableRows()).toHaveLength(0);
      expect(screen.getAllByText("Không có kết quả trong phần đã tải")).not.toHaveLength(0);
      expect(
        screen.getAllByText(
          "Khoảng ngày đang chọn vượt quá 500 kết quả mới nhất; kết quả cũ hơn chưa được tải.",
        ),
      ).not.toHaveLength(0);
      expect(screen.queryByText("Không có kết quả khớp bộ lọc")).not.toBeInTheDocument();
      expect(screen.queryByText(/Nới rộng điều kiện/)).not.toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Xóa lọc" })).not.toHaveLength(0);
    });

    it("keeps the ordinary empty state for a filter that empties the list without a date range", () => {
      renderPage({ items: cappedItems() });

      fireEvent.change(screen.getByTestId("desktop-result-search"), {
        target: { value: "không có học sinh nào tên vậy" },
      });
      expect(notice()).not.toBeInTheDocument();
      expect(tableRows()).toHaveLength(0);
      expect(screen.getAllByText("Không có kết quả khớp bộ lọc")).not.toHaveLength(0);
      expect(screen.getAllByText(/Nới rộng điều kiện/)).not.toHaveLength(0);
      expect(screen.queryByText("Không có kết quả trong phần đã tải")).not.toBeInTheDocument();
    });

    it("drops the notice when the filters are cleared", () => {
      renderPage({ items: cappedItems() });
      setDate("from", "2026-08-01");
      expect(notice()).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /^Xóa lọc \(1\)$/ }));
      expect(notice()).not.toBeInTheDocument();
    });

    it("stays silent when the load was not capped", () => {
      renderPage({ items: cappedItems().slice(1) });

      setDate("from", "2026-08-01");
      expect(notice()).not.toBeInTheDocument();
    });
  });

  it("keeps the loading skeleton's geometry: narrow search placeholder, 98px bar, 44px phone chips", () => {
    const { container } = render(<LearningResultsSkeleton />);

    expect(container.querySelector('[class*="h-[98px]"]')).toBeInTheDocument();
    expect(container.querySelector('[class*="h-[90px]"]')).not.toBeInTheDocument();
    expect(
      container.querySelector('[class~="h-11"][class*="@min-[1072px]:hidden"]'),
    ).toBeInTheDocument();
    expect(container.querySelector('[class*="max-md:h-11"]')).toBeInTheDocument();
  });

  it("uses the shared focus outline, never a ring or outline-none", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const roots = [
      join(process.cwd(), "src/features/learning-results"),
      join(process.cwd(), "src/features/learning-results/components"),
    ];

    for (const root of roots) {
      for (const file of readdirSync(root).filter((name) => /\.tsx?$/.test(name))) {
        const source = readFileSync(join(root, file), "utf8");
        expect(source, file).not.toMatch(/outline-none|focus-visible:ring|focus-ring/);
      }
    }
  });

  it("uses no legacy alias tokens and no raw colours in the learning-results sources", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const roots = [
      join(process.cwd(), "src/features/learning-results"),
      join(process.cwd(), "src/features/learning-results/components"),
    ];
    const legacy =
      /\b(text-ink[\w-]*|border-hairline[\w-]*|bg-surface-[12]|bg-canvas|shadow-card|font-display)\b|#[0-9a-fA-F]{3,8}\b/;

    for (const root of roots) {
      for (const file of readdirSync(root).filter((name) => /\.tsx?$/.test(name))) {
        expect(readFileSync(join(root, file), "utf8"), file).not.toMatch(legacy);
      }
    }
  });
});
