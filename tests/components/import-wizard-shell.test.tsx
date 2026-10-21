// Value: protects=the shared import wizard shell (design 17c) the four import pages build on: the frame (h1 + context line, the labelled Stepper with exactly one current step, one column per step at xl, an odd count's last step without a doubled rule, body, action bar); the file step (a real labelled file input that keyboard focus reaches, the limits wired as its description, a drop zone that really takes a dropped file, file facts with the short SHA-256 and the full value in title, "Chọn file khác" as reset or as the picker, the error inside the card as an alert wired to the input, a reading skeleton without an input); the summary strip (labelled counts in vi-VN figures, each tone's colour token, a column per cell); the review table ("Cần xem n" errors-first by default, "Tất cả n" in file order, counts, tints always with words, "Hợp lệ" badges, fallback words, the tint kept on hover, one rendering per container width (measured on mount, so a narrow container never starts as the table), the cap caption, the in-frame empty text); the action bar (consequence text, "← step" back button named "Quay lại bước …", the reason under the bar wired to the primary);
// fails_when=a second current step or an empty context line appears, the file input loses its label/accept/description or is hidden from keyboard focus, a drop is ignored or a dragged state sticks, a reset leaves an unlabelled input behind, the error leaves the card or stops being an alert, a summary value loses its separator or tone, "Cần xem" stops being the default while rows need review or does not fall back to "Tất cả" when none do, a flagged row shows colour without words, the table and the cards render together (a row text found twice), the cap caption is missing or shown without a cap, the empty text renders twice or outside a frame, the reason is not linked to the primary, or a shell file picks up next/navigation, outline-none, legacy tokens, raw hex or raw Tailwind palette colours;
// why_new=step 15b adds src/features/imports/components (no shared import UI existed: each page had its own stepper, file card, tiles and tables);
// seam=none for the components (pure, prop-driven); ResizeObserver (and once getBoundingClientRect) is stubbed per test to report a container width (jsdom has no layout), and restored after;
// no_claim=does not prove any import page's steps, counts, copy or gating (each lane's page tests), the server actions, or the visual layout (no CSS in jsdom)
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Stepper } from "@/components/patterns/stepper";
import { Button } from "@/components/ui/button";
import { ImportActionBar } from "@/features/imports/components/import-action-bar";
import { ImportFileStep } from "@/features/imports/components/import-file-step";
import {
  IMPORT_REVIEW_TABLE_MIN_WIDTH,
  ImportReviewTable,
  type ImportReviewColumn,
  type ImportRowSeverity,
} from "@/features/imports/components/import-review-table";
import { ImportSummaryStrip } from "@/features/imports/components/import-summary-strip";
import { ImportWizardFrame, importStepperClassName } from "@/features/imports/components/import-wizard-frame";

const originalResizeObserver = globalThis.ResizeObserver;

afterEach(() => {
  cleanup();
  globalThis.ResizeObserver = originalResizeObserver;
});

/** Every observed element reports `width` at once, like a real observer's first report after layout. */
function stubContainerWidth(width: number) {
  const observers: Array<{ callback: ResizeObserverCallback; elements: Element[] }> = [];
  class FakeResizeObserver {
    private readonly entry: { callback: ResizeObserverCallback; elements: Element[] };
    constructor(callback: ResizeObserverCallback) {
      this.entry = { callback, elements: [] };
      observers.push(this.entry);
    }
    observe(element: Element) {
      this.entry.elements.push(element);
      this.entry.callback([{ contentRect: { width } as DOMRectReadOnly, target: element } as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {
      this.entry.elements.length = 0;
    }
  }
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  return {
    resize(nextWidth: number) {
      for (const observer of observers) {
        for (const element of observer.elements) {
          observer.callback([{ contentRect: { width: nextWidth } as DOMRectReadOnly, target: element } as ResizeObserverEntry], {} as ResizeObserver);
        }
      }
    },
  };
}

describe("ImportWizardFrame", () => {
  const steps = [
    { state: "done" as const, title: "Tải mẫu & chọn file" },
    { state: "done" as const, title: "Ánh xạ cột" },
    { state: "current" as const, title: "Kiểm tra dòng" },
    { state: "upcoming" as const, title: "Xác nhận nhập" },
  ];

  it("stacks the header with its context line, the stepper, the step body and the action bar", () => {
    const { container } = render(
      <ImportWizardFrame
        actionBar={<div data-testid="bar">bar</div>}
        context="hoc-sinh-khoi-6-7.xlsx · 48 dòng"
        headerActions={<a href="/dev/imports">Danh sách lô</a>}
        stepperLabel="Các bước nhập học sinh"
        steps={steps}
        title="Nhập học sinh từ file"
      >
        <p>Thân bước</p>
      </ImportWizardFrame>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Nhập học sinh từ file" })).toBeInTheDocument();
    expect(screen.getByText("hoc-sinh-khoi-6-7.xlsx · 48 dòng").tagName).toBe("P");
    expect(screen.getByRole("link", { name: "Danh sách lô" })).toBeInTheDocument();

    const list = screen.getByRole("list", { name: "Các bước nhập học sinh" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items.filter((item) => item.getAttribute("aria-current") === "step")).toEqual([items[2]]);
    expect(items[2]).toHaveTextContent("Đang ở bước này: 3. Kiểm tra dòng");
    // Four steps keep the Stepper's own four columns.
    expect(list.className).not.toMatch(/xl:grid-cols-\d!/);

    // Order: header, stepper, body, bar.
    const frame = container.firstElementChild as HTMLElement;
    expect([...frame.children].map((child) => child.tagName)).toEqual(["HEADER", "OL", "DIV", "DIV"]);
    expect(frame.children[2]).toHaveTextContent("Thân bước");
    expect(frame.children[3]).toBe(screen.getByTestId("bar"));
  });

  it("renders no empty context line and gives a five-step pipeline five columns at xl", () => {
    const { container } = render(
      <ImportWizardFrame
        stepperLabel="Các bước nhập lớp"
        steps={[...steps, { state: "upcoming", title: "Tạo lô" }]}
        title="Nhập lớp và lịch học"
      >
        <p>Thân bước</p>
      </ImportWizardFrame>,
    );

    expect(container.querySelector("header p")).toBeNull();
    expect(screen.getByRole("list", { name: "Các bước nhập lớp" }).className).toContain("xl:grid-cols-5!");
  });

  // Value: protects=importStepperClassName: four steps add nothing to the shared Stepper; an odd count (3, 5) gets its xl columns plus the last-step fixes (no right rule, both columns from sm to below xl); six get only their columns; the frame applies exactly these classes;
  // fails_when=a 4-step import stepper picks up any extra class, the odd-count overrides go missing (a doubled right edge at xl, a lone step beside an empty cell from sm) or leak onto even counts, or the frame stops using the helper;
  // why_new=five-step steppers (classes wizard and batch page) inherited the Stepper's four-step border rules; the helper is new and shared by the frame and the class batch page;
  // seam=none (pure helper + render); no_claim=does not prove the rendered borders (no CSS in jsdom; the compiled !important order was checked by hand) or touch stepper.tsx
  it("adds nothing for four steps and fixes the last step of an odd count", () => {
    const oddLastStep = ["[&>li:last-child]:border-r-0!", "sm:[&>li:last-child]:col-span-2", "xl:[&>li:last-child]:col-span-1"];
    expect(importStepperClassName(4)).toBeUndefined();
    expect(importStepperClassName(5)?.split(" ")).toEqual(["xl:grid-cols-5!", ...oddLastStep]);
    expect(importStepperClassName(3)?.split(" ")).toEqual(["xl:grid-cols-3!", ...oddLastStep]);
    expect(importStepperClassName(6)).toBe("xl:grid-cols-6!");

    // Four steps: the frame's list carries exactly the shared Stepper's own classes.
    render(<Stepper label="Stepper dùng chung" steps={steps} />);
    render(
      <ImportWizardFrame stepperLabel="Bốn bước" steps={steps} title="Bốn bước">
        <p>Thân bước</p>
      </ImportWizardFrame>,
    );
    expect(screen.getByRole("list", { name: "Bốn bước" }).className).toBe(screen.getByRole("list", { name: "Stepper dùng chung" }).className);

    render(
      <ImportWizardFrame stepperLabel="Năm bước" steps={[...steps, { state: "upcoming", title: "Tạo lô" }]} title="Năm bước">
        <p>Thân bước</p>
      </ImportWizardFrame>,
    );
    const fiveSteps = screen.getByRole("list", { name: "Năm bước" }).className.split(" ");
    for (const name of ["xl:grid-cols-5!", ...oddLastStep]) expect(fiveSteps).toContain(name);
  });
});

describe("ImportFileStep", () => {
  const limitsText = "Chỉ nhận .xlsx, tối đa 5 MB và 500 dòng dữ liệu.";
  const accept = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  function renderFileStep(props: Partial<Parameters<typeof ImportFileStep>[0]> = {}) {
    const onFileSelected = vi.fn();
    const utils = render(
      <ImportFileStep
        accept={accept}
        inputId="student-import-file"
        label="Chọn file Excel"
        limitsText={limitsText}
        onFileSelected={onFileSelected}
        {...props}
      />,
    );
    return { ...utils, onFileSelected };
  }

  const workbook = () => new File(["x"], "hoc-sinh.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

  it("offers a real, labelled, keyboard-focusable file input described by the limits", () => {
    const { onFileSelected } = renderFileStep();
    const input = screen.getByLabelText("Chọn file Excel") as HTMLInputElement;

    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("id", "student-import-file");
    expect(input).toHaveAttribute("accept", accept);
    expect(input).toHaveAccessibleDescription(limitsText);
    expect(input).not.toBeDisabled();
    input.focus();
    expect(input).toHaveFocus();
    // The visible label is the button and shows the focus ring of the input before it.
    const label = screen.getByText("Chọn file Excel");
    expect(label.tagName).toBe("LABEL");
    expect(label.className).toContain("peer-focus-visible:outline-2");

    const file = workbook();
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileSelected).toHaveBeenCalledTimes(1);
    expect(onFileSelected).toHaveBeenCalledWith(file);
    // Cleared so the same (fixed) file can be chosen again.
    expect(input.value).toBe("");
    expect(screen.getByText("Kéo thả file vào khung này hoặc")).toBeInTheDocument();
  });

  it("takes a dropped file and shows the dragged state only while dragging", () => {
    const { onFileSelected } = renderFileStep();
    const zone = screen.getByTestId("student-import-file-dropzone");
    const file = workbook();

    fireEvent.dragOver(zone, { dataTransfer: { dropEffect: "none", files: [] } });
    expect(zone).toHaveAttribute("data-dragging", "true");
    fireEvent.dragLeave(zone, { relatedTarget: document.body });
    expect(zone).not.toHaveAttribute("data-dragging");

    fireEvent.dragEnter(zone, { dataTransfer: { dropEffect: "none", files: [] } });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onFileSelected).toHaveBeenCalledWith(file);
    expect(zone).not.toHaveAttribute("data-dragging");

    fireEvent.drop(zone, { dataTransfer: { files: [] } });
    expect(onFileSelected).toHaveBeenCalledTimes(1);
  });

  it("shows the file facts with a short SHA-256 and resets through 'Chọn file khác'", () => {
    const sha256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const onReset = vi.fn();
    const { container } = renderFileStep({ file: { name: "hoc-sinh-khoi-6-7.xlsx", rows: 1234, sha256, sheet: "HocSinh" }, onReset });

    const facts = container.querySelector("dl") as HTMLElement;
    expect([...facts.querySelectorAll("dt")].map((term) => term.textContent)).toEqual(["Tên file", "Trang tính", "Số dòng", "SHA-256"]);
    expect(within(facts).getByText("hoc-sinh-khoi-6-7.xlsx")).toBeInTheDocument();
    expect(within(facts).getByText("HocSinh")).toBeInTheDocument();
    expect(within(facts).getByText("1.234")).toBeInTheDocument();
    expect(within(facts).getByText("0123456789ab…")).toHaveAttribute("title", sha256);

    fireEvent.click(screen.getByRole("button", { name: "Chọn file khác" }));
    expect(onReset).toHaveBeenCalledTimes(1);
    // No input without its visible label (and no drop zone) while a file is set.
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByText("Kéo thả file vào khung này hoặc")).toBeNull();
  });

  it("opens the picker from 'Chọn file khác' when the feature has no reset", () => {
    const { onFileSelected } = renderFileStep({ file: { name: "lop.xlsx", rows: 12 } });
    const input = screen.getByLabelText("Chọn file khác");

    expect(input).toHaveAttribute("type", "file");
    expect(screen.queryByText("Trang tính")).toBeNull();
    expect(screen.queryByText("SHA-256")).toBeNull();
    const file = workbook();
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it("keeps a read error inside the card as an alert that describes the input", () => {
    const { container } = renderFileStep({
      error: "File phải có đúng một trang tính.",
      templateAction: <button type="button">Tải file mẫu .xlsx</button>,
    });
    const alert = screen.getByRole("alert");

    expect(alert).toHaveTextContent("Không dùng được file này. File phải có đúng một trang tính.");
    expect(container.firstElementChild?.contains(alert)).toBe(true);
    expect(screen.getByLabelText("Chọn file Excel")).toHaveAccessibleDescription(`${limitsText} Không dùng được file này. File phải có đúng một trang tính.`);
    expect(screen.getByRole("button", { name: "Tải file mẫu .xlsx" })).toBeInTheDocument();
  });

  it("holds the card's shape with a skeleton while reading, without an input", () => {
    const { container } = renderFileStep({ isReading: true });
    const status = screen.getByRole("status");

    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Đang đọc file…");
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByTestId("student-import-file-dropzone")).toBeNull();
  });
});

describe("ImportSummaryStrip", () => {
  it("lists labelled counts in vi-VN figures with each tone's colour and one column per cell", () => {
    render(
      <ImportSummaryStrip
        cells={[
          { label: "Tổng dòng", value: 1248 },
          { label: "Hợp lệ", tone: "success", value: 1243 },
          { label: "Cảnh báo (vẫn nhập được)", tone: "warning", value: 3 },
          { label: "Lỗi (phải sửa trong file)", tone: "danger", value: 2 },
          { label: "Không thay đổi", tone: "muted", value: 0 },
        ]}
        label="Kết quả kiểm tra"
      />,
    );
    const strip = screen.getByLabelText("Kết quả kiểm tra");

    expect(strip.tagName).toBe("DL");
    expect(strip.style.getPropertyValue("--import-summary-cells")).toBe("5");
    const terms = within(strip).getAllByRole("term");
    const values = within(strip).getAllByRole("definition");
    expect(terms.map((term) => term.textContent)).toEqual([
      "Tổng dòng",
      "Hợp lệ",
      "Cảnh báo (vẫn nhập được)",
      "Lỗi (phải sửa trong file)",
      "Không thay đổi",
    ]);
    expect(values.map((value) => value.textContent)).toEqual(["1.248", "1.243", "3", "2", "0"]);
    expect(values.map((value) => value.className.match(/text-(text-strong|success|warning|danger|text-muted)\b/)?.[1])).toEqual([
      "text-strong",
      "success",
      "warning",
      "danger",
      "text-muted",
    ]);
    for (const value of values) expect(value.className).toContain("tabular-nums");
  });
});

type ReviewRow = { message: string | null; name: string; row: number; severity: ImportRowSeverity };

const reviewRows: ReviewRow[] = [
  { message: "Phụ huynh đã có trong hệ thống và sẽ được dùng lại.", name: "Lý Gia Hân", row: 23, severity: "warning" },
  { message: null, name: "Đào Thu Trang", row: 1, severity: "valid" },
  { message: "Năm sinh phải gồm 4 chữ số.", name: "Nguyễn Văn", row: 7, severity: "error" },
  { message: "Không thay đổi số dư.", name: "Bùi Khánh Vy", row: 3, severity: "neutral" },
  { message: null, name: "Trần Thu Hà", row: 19, severity: "error" },
  { message: null, name: "Hoàng Nhật Minh", row: 2, severity: "valid" },
];

const reviewColumns: ImportReviewColumn<ReviewRow>[] = [
  { header: "Dòng", hideInCard: true, key: "row", render: (row) => row.row, width: "60px" },
  { header: "Họ tên", key: "name", render: (row) => <span className="font-semibold">{row.name}</span> },
  { align: "right", header: "Năm sinh", key: "year", render: (row) => 2000 + row.row },
];

function renderReview(props: Partial<Parameters<typeof ImportReviewTable<ReviewRow>>[0]> = {}) {
  return render(
    <ImportReviewTable<ReviewRow>
      caption="Kết quả kiểm tra 6 dòng"
      cardTitle={(row) => `Dòng ${row.row}`}
      columns={reviewColumns}
      getRowIssue={(row) => row.message}
      getRowKey={(row) => String(row.row)}
      getRowSeverity={(row) => row.severity}
      rows={reviewRows}
      {...props}
    />,
  );
}

const chipGroup = () => screen.getByRole("group", { name: "Lọc dòng cần xem" });
const bodyRows = () => within(screen.getByRole("table", { name: "Kết quả kiểm tra 6 dòng" })).getAllByRole("row").slice(1);
const firstCells = () => bodyRows().map((row) => within(row).getAllByRole("cell")[0].textContent);

describe("ImportReviewTable", () => {
  it("opens on 'Cần xem' with errors first, then warnings, and counts both chips", () => {
    renderReview();

    expect(within(chipGroup()).getByRole("button", { name: "Cần xem3", pressed: true })).toBeInTheDocument();
    expect(within(chipGroup()).getByRole("button", { name: "Tất cả6", pressed: false })).toBeEnabled();
    expect(firstCells()).toEqual(["7", "19", "23"]);
    expect(screen.queryByText("Đào Thu Trang")).toBeNull();
  });

  it("switches to every row in file order on 'Tất cả' and back", () => {
    renderReview();

    fireEvent.click(within(chipGroup()).getByRole("button", { name: "Tất cả6" }));
    expect(within(chipGroup()).getByRole("button", { name: "Tất cả6", pressed: true })).toBeInTheDocument();
    expect(firstCells()).toEqual(["23", "1", "7", "3", "19", "2"]);

    fireEvent.click(within(chipGroup()).getByRole("button", { name: "Cần xem3" }));
    expect(firstCells()).toEqual(["7", "19", "23"]);
  });

  it("pairs every tint with words: messages, screen-reader severity, 'Hợp lệ' badges and fallbacks", () => {
    renderReview();
    fireEvent.click(within(chipGroup()).getByRole("button", { name: "Tất cả6" }));
    const [warning, valid, error, neutral, errorWithoutText] = bodyRows();

    expect(error.className).toContain("bg-danger-bg");
    // The tint holds under the pointer (beats TableRow's hover:bg-table-row-hover).
    expect(error.className).toContain("hover:bg-danger-bg!");
    expect(error.className).toContain("h-14");
    expect(within(error).getByText("Năm sinh phải gồm 4 chữ số.").className).toBe("");
    expect(within(error).getAllByRole("cell").at(-1)).toHaveTextContent(/^Lỗi: Năm sinh phải gồm 4 chữ số\.$/);

    expect(warning.className).toContain("bg-warning-bg");
    expect(warning.className).toContain("hover:bg-warning-bg!");
    expect(within(warning).getAllByRole("cell").at(-1)).toHaveTextContent(/^Cảnh báo: Phụ huynh đã có trong hệ thống và sẽ được dùng lại\.$/);

    expect(valid.className).not.toMatch(/bg-(danger|warning)-bg/);
    expect(valid.className).toContain("h-12");
    expect(within(valid).getByText("Hợp lệ").className).toContain("bg-success-bg");

    expect(within(neutral).getAllByRole("cell").at(-1)).toHaveTextContent(/^Không thay đổi số dư\.$/);
    expect(neutral.className).not.toMatch(/bg-(danger|warning)-bg/);

    // An error without a message still says what it is.
    expect(within(errorWithoutText).getAllByRole("cell").at(-1)).toHaveTextContent(/^Lỗi: Lỗi$/);
    expect(screen.getAllByText("Hợp lệ")).toHaveLength(2);
  });

  it("renders the header, widths and right-aligned figures from the columns plus the issue column", () => {
    renderReview({ issueHeader: "Thông báo" });
    const headers = within(screen.getByRole("table")).getAllByRole("columnheader");

    expect(headers.map((header) => header.textContent)).toEqual(["Dòng", "Họ tên", "Năm sinh", "Thông báo"]);
    expect(headers[0]).toHaveStyle({ width: "60px" });
    expect(headers[2].className).toContain("text-right");
    expect(within(bodyRows()[0]).getAllByRole("cell")[2].className).toContain("tabular-nums");
  });

  it("defaults to 'Tất cả' and disables 'Cần xem 0' when nothing needs review", () => {
    renderReview({ chips: { allLabel: "Mọi dòng", needsReviewLabel: "Cần xử lý" }, rows: reviewRows.filter((row) => row.severity === "valid" || row.severity === "neutral") });

    expect(within(chipGroup()).getByRole("button", { name: "Mọi dòng3", pressed: true })).toBeInTheDocument();
    expect(within(chipGroup()).getByRole("button", { name: "Cần xử lý0" })).toBeDisabled();
    expect(firstCells()).toEqual(["1", "3", "2"]);
  });

  it("renders the table only, so each row's text is found once, when there is no layout", () => {
    renderReview();
    fireEvent.click(within(chipGroup()).getByRole("button", { name: "Tất cả6" }));

    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(screen.queryByRole("list", { name: "Kết quả kiểm tra 6 dòng" })).toBeNull();
    for (const row of reviewRows) expect(screen.getByText(row.name)).toBeInTheDocument();
  });

  it("switches to stacked cards below the container rule and back, never both", () => {
    const observer = stubContainerWidth(IMPORT_REVIEW_TABLE_MIN_WIDTH - 1);
    renderReview();

    expect(screen.queryByRole("table")).toBeNull();
    const list = screen.getByRole("list", { name: "Kết quả kiểm tra 6 dòng" });
    const cards = within(list).getAllByRole("listitem");
    expect(cards.map((card) => card.getAttribute("data-severity"))).toEqual(["error", "error", "warning"]);
    expect(cards[0]).toHaveTextContent("Dòng 7");
    expect(within(cards[0]).getByText("Nguyễn Văn")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Năm sinh phải gồm 4 chữ số.")).toBeInTheDocument();
    expect(cards[0].className).toContain("bg-danger-bg");
    // The "Dòng" column repeats the card title, so it is left out of the card.
    expect([...cards[0].querySelectorAll("dt")].map((term) => term.textContent)).toEqual(["Họ tên", "Năm sinh"]);
    expect(screen.getAllByText("Dòng 7")).toHaveLength(1);

    fireEvent.click(within(chipGroup()).getByRole("button", { name: "Tất cả6" }));
    expect(within(screen.getByRole("list", { name: "Kết quả kiểm tra 6 dòng" })).getAllByText("Hợp lệ")).toHaveLength(2);
    for (const row of reviewRows) expect(screen.getByText(row.name)).toBeInTheDocument();

    act(() => observer.resize(IMPORT_REVIEW_TABLE_MIN_WIDTH));
    expect(screen.getByRole("table", { name: "Kết quả kiểm tra 6 dòng" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Kết quả kiểm tra 6 dòng" })).toBeNull();

    // An unlaid-out container (width 0) keeps the current rendering.
    act(() => observer.resize(0));
    expect(screen.getByRole("table", { name: "Kết quả kiểm tra 6 dòng" })).toBeInTheDocument();
  });

  // Value: protects=a narrow container (375px phone) mounts straight into the stacked cards from the layout effect's own measure, and the observer is still attached for later resizes;
  // fails_when=the layout waits for a ResizeObserver report again (a narrow client mount commits and paints the 1040px table first, then swaps to cards);
  // why_new=review fix: the hook only switched in the observer callback, which React renders after the first paint;
  // seam=Element.prototype.getBoundingClientRect stubbed to a 375px box and a ResizeObserver that never reports, both restored after; no_claim=does not prove browser paint timing (jsdom has no paint), only that the first committed result of the mount is the cards
  it("mounts a narrow container straight into the cards without waiting for the observer", () => {
    const observe = vi.fn();
    class SilentResizeObserver {
      observe = observe;
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = SilentResizeObserver as unknown as typeof ResizeObserver;
    const rect = vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockReturnValue({ bottom: 600, height: 600, left: 0, right: 375, top: 0, width: 375, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);

    try {
      renderReview();

      expect(screen.queryByRole("table")).toBeNull();
      const cards = within(screen.getByRole("list", { name: "Kết quả kiểm tra 6 dòng" })).getAllByRole("listitem");
      expect(cards.map((card) => card.getAttribute("data-severity"))).toEqual(["error", "error", "warning"]);
      expect(observe).toHaveBeenCalledTimes(1);
    } finally {
      rect.mockRestore();
    }
  });

  it("caps the rows of the active chip and says so in the frame footer", () => {
    renderReview({ maxRows: 2 });

    expect(firstCells()).toEqual(["7", "19"]);
    expect(screen.getByText("Hiển thị 2/3 dòng")).toBeInTheDocument();

    fireEvent.click(within(chipGroup()).getByRole("button", { name: "Tất cả6" }));
    expect(firstCells()).toEqual(["23", "1"]);
    expect(screen.getByText("Hiển thị 2/6 dòng")).toBeInTheDocument();
  });

  it("shows the cap caption under the cards too, and no caption without a cap", () => {
    stubContainerWidth(600);
    const { unmount } = renderReview({ maxRows: 1 });
    expect(screen.getByText("Hiển thị 1/3 dòng")).toBeInTheDocument();
    unmount();

    renderReview({ maxRows: 50 });
    expect(screen.queryByText(/^Hiển thị/)).toBeNull();
  });

  it("puts the empty text once inside a frame, without chips", () => {
    const { container } = renderReview({ emptyText: "File không có dòng dữ liệu.", rows: [] });

    expect(screen.getAllByText("File không có dòng dữ liệu.")).toHaveLength(1);
    expect(screen.getByText("File không có dòng dữ liệu.").closest(".rounded-lg")).not.toBeNull();
    expect(screen.queryByRole("group", { name: "Lọc dòng cần xem" })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });
});

describe("ImportActionBar", () => {
  it("states the consequence, goes back by the previous step's name and links the reason to the primary", () => {
    const onBack = vi.fn();
    render(
      <ImportActionBar
        back={{ label: "Ánh xạ cột", onClick: onBack }}
        primary={
          <Button aria-describedby="imp-why" disabled>
            Xác nhận nhập 46 học sinh
          </Button>
        }
        reason="Bật khi không còn dòng lỗi."
        reasonId="imp-why"
        text="Còn 2 lỗi. Sửa file Excel rồi chọn lại file."
      />,
    );

    expect(screen.getByText("Còn 2 lỗi. Sửa file Excel rồi chọn lại file.")).toBeInTheDocument();
    const back = screen.getByRole("button", { name: "Quay lại bước Ánh xạ cột" });
    expect(back).toHaveTextContent("←Quay lại bước Ánh xạ cột");
    expect(within(back).getByText("←")).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);

    const primary = screen.getByRole("button", { name: "Xác nhận nhập 46 học sinh" });
    expect(primary).toBeDisabled();
    expect(primary).toHaveAccessibleDescription("Bật khi không còn dòng lỗi.");
    expect(screen.getByText("Bật khi không còn dòng lỗi.")).toHaveAttribute("id", "imp-why");
  });

  it("works with a Button's own disabledReason, a disabled back and no reason line", () => {
    render(
      <ImportActionBar
        back={{ disabled: true, label: "Kiểm tra dòng", onClick: vi.fn() }}
        primary={
          <Button disabled disabledReason="Cần một lô đã tạo.">
            Xác nhận ghi danh
          </Button>
        }
        text="Ghi danh sẽ được ghi một lần cho cả lô."
      />,
    );

    expect(screen.getByRole("button", { name: "Quay lại bước Kiểm tra dòng" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Xác nhận ghi danh" })).toHaveAccessibleDescription("Cần một lô đã tạo.");
    expect(screen.getAllByText("Cần một lô đã tạo.")).toHaveLength(1);
  });

  it("renders without a back button", () => {
    render(<ImportActionBar primary={<Button>Kiểm tra 48 dòng</Button>} text="Kiểm tra không ghi dữ liệu." />);

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Quay lại/ })).toBeNull();
  });
});

describe("import shell sources", () => {
  const files = [
    "src/features/imports/components/import-wizard-frame.tsx",
    "src/features/imports/components/import-file-step.tsx",
    "src/features/imports/components/import-summary-strip.tsx",
    "src/features/imports/components/import-review-table.tsx",
    "src/features/imports/components/import-action-bar.tsx",
    "src/features/imports/components/import-labels.ts",
  ];

  it("stay on the design tokens and off next/navigation", () => {
    const forbidden =
      /outline-none|focus:ring|focus-visible:ring|\b(text-ink[\w-]*|border-hairline[\w-]*|bg-surface-[12]|bg-canvas|shadow-card|font-display|bg-white|text-primary|bg-primary)\b|#[0-9a-fA-F]{3,8}\b/;
    const rawPalette =
      /\b(?:text|bg|border|ring|fill|stroke|from|via|to|divide|outline|decoration|accent|caret|shadow)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(forbidden);
      expect(source, file).not.toMatch(rawPalette);
      expect(source, file).not.toMatch(/next\/navigation|\balert\(|toLocaleString|new Intl\.DateTimeFormat/);
    }
  });
});
