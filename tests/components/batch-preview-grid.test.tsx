// Value: protects=BatchPreviewGrid (design 17b): each chip IS its draft's checkbox named "Chọn buổi học ngày dd/mm/yyyy" (plus "lúc HH:MM" when a date holds two slots), chips read "T3 03/11" and state their condition in words tied to the checkbox (đã có, đã qua, nghỉ, ngoài hiệu lực), holiday and out-of-window chips cannot be ticked, the grid is one tab stop moved by arrow keys/Home/End that skip blocked chips, the header states "{n} buổi sẽ tạo · {d} ngày nghỉ bỏ qua · {k} trùng buổi đã có (bỏ qua)" plus the pinned "Đã chọn: x / n buổi", the empty state stays inside the card, and the caption says the duplicate check covers the newest 300 sessions and the server re-checks;
// fails_when=a chip stops being the checkbox or loses the pinned label prefix, two chips share a name, a state is shown by colour only, a blocked chip can be ticked, Tab walks every chip, arrows land on a blocked chip, the summary counts drift from the props, or the caption over-claims the duplicate check;
// why_new=step 15a adds the grid component (B2);
// seam=rows come from the real buildBatchPreviewRows/summarizeBatchPreview over hand-made drafts; jsdom has no grid layout, so ArrowDown moves one chip (column count 1); no_claim=visual layout (6/4/3 columns), the workspace wiring (batch-session-creation.test.tsx)
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildBatchPreviewRows, summarizeBatchPreview } from "@/features/sessions/batch-preview-models";
import type { BatchScheduleOption } from "@/features/sessions/batch-calculation";
import { BatchPreviewGrid } from "@/features/sessions/components/batch-preview-grid";
import type { BatchSessionDraftItem } from "@/features/sessions/forms/session-batch-schema";

afterEach(() => {
  cleanup();
});

function draft(sessionDate: string, weekday: number, overrides: Partial<BatchSessionDraftItem> = {}): BatchSessionDraftItem {
  return {
    componentCode: null,
    endTime: "19:30",
    id: `d-${sessionDate}-${overrides.startTime ?? "17:30"}`,
    learningMode: "offline",
    meetingUrl: null,
    notes: "Buổi",
    roomName: null,
    scheduleTemplateId: "tpl",
    selected: true,
    sessionDate,
    sessionKind: "regular",
    sessionNumber: 1,
    startTime: "17:30",
    statusConflict: "none",
    weekday,
    weekdayLabel: "Thứ",
    ...overrides,
  };
}

const schedule: BatchScheduleOption = {
  classId: "cls",
  componentCode: null,
  effectiveFrom: "2026-10-01",
  effectiveTo: null,
  endTime: "19:30:00",
  id: "tpl",
  learningMode: "offline",
  meetingUrl: null,
  roomName: null,
  startTime: "17:30:00",
  weekday: 2,
};

const drafts = [
  draft("2026-09-29", 2), // before the template window → ngoài hiệu lực
  draft("2026-10-13", 2, { statusConflict: "past" }), // đã qua, still selected
  draft("2026-10-20", 2),
  draft("2026-10-27", 2, { selected: false, statusConflict: "duplicate" }), // đã có
  draft("2026-11-03", 2), // holiday → nghỉ
  draft("2026-11-10", 2, { selected: false }), // unticked by hand
  draft("2026-11-17", 2, { id: "d-early", startTime: "07:30" }),
  draft("2026-11-17", 2), // two slots on one date
];

function renderGrid(options: { drafts?: BatchSessionDraftItem[]; holidays?: string[] } = {}) {
  const holidays = options.holidays ?? ["2026-11-03", "2026-12-25"];
  const rows = buildBatchPreviewRows(options.drafts ?? drafts, { holidays, schedules: [schedule] });
  const summary = summarizeBatchPreview(rows, holidays);
  const onToggle = vi.fn();
  const onToggleAll = vi.fn();
  render(<BatchPreviewGrid onToggle={onToggle} onToggleAll={onToggleAll} rows={rows} summary={summary} />);
  return { onToggle, onToggleAll };
}

const chips = () => screen.getAllByLabelText(/^Chọn buổi học ngày/) as HTMLInputElement[];

describe("BatchPreviewGrid", () => {
  it("renders one checkbox chip per draft with unique pinned-format names and words for every state", () => {
    renderGrid();

    const list = screen.getByRole("list", { name: "Các buổi học trong bảng xem trước" });
    expect(within(list).getAllByRole("checkbox")).toHaveLength(8);
    expect(chips().map((input) => input.getAttribute("aria-label"))).toEqual([
      "Chọn buổi học ngày 29/09/2026",
      "Chọn buổi học ngày 13/10/2026",
      "Chọn buổi học ngày 20/10/2026",
      "Chọn buổi học ngày 27/10/2026",
      "Chọn buổi học ngày 03/11/2026",
      "Chọn buổi học ngày 10/11/2026",
      "Chọn buổi học ngày 17/11/2026 lúc 07:30",
      "Chọn buổi học ngày 17/11/2026 lúc 17:30",
    ]);

    const chipOf = (label: string) => screen.getByLabelText(label).closest("label")!;
    expect(chipOf("Chọn buổi học ngày 20/10/2026")).toHaveTextContent(/^T3 20\/10$/);
    expect(chipOf("Chọn buổi học ngày 29/09/2026")).toHaveTextContent("T3 29/09ngoài hiệu lực");
    expect(chipOf("Chọn buổi học ngày 13/10/2026")).toHaveTextContent("T3 13/10đã qua");
    expect(chipOf("Chọn buổi học ngày 27/10/2026")).toHaveTextContent("T3 27/10đã có");
    expect(chipOf("Chọn buổi học ngày 03/11/2026")).toHaveTextContent("T3 03/11nghỉ");
    expect(chipOf("Chọn buổi học ngày 17/11/2026 lúc 07:30")).toHaveTextContent("T3 17/1107:30");

    // The state word is the checkbox's description, not colour alone.
    expect(screen.getByLabelText("Chọn buổi học ngày 27/10/2026")).toHaveAccessibleDescription("đã có");
    expect(screen.getByLabelText("Chọn buổi học ngày 03/11/2026")).toHaveAccessibleDescription("nghỉ");
    expect(screen.getByLabelText("Chọn buổi học ngày 29/09/2026")).toHaveAccessibleDescription("ngoài hiệu lực");
  });

  it("ticks what the request carries and blocks holiday and out-of-window chips", () => {
    const { onToggle } = renderGrid();
    const checked = chips().filter((input) => input.checked).map((input) => input.getAttribute("aria-label"));
    expect(checked).toEqual([
      "Chọn buổi học ngày 13/10/2026",
      "Chọn buổi học ngày 20/10/2026",
      "Chọn buổi học ngày 17/11/2026 lúc 07:30",
      "Chọn buổi học ngày 17/11/2026 lúc 17:30",
    ]);
    expect(screen.getByLabelText("Chọn buổi học ngày 03/11/2026")).toBeDisabled();
    expect(screen.getByLabelText("Chọn buổi học ngày 29/09/2026")).toBeDisabled();
    expect(screen.getByLabelText("Chọn buổi học ngày 27/10/2026")).toBeEnabled();

    fireEvent.click(screen.getByLabelText("Chọn buổi học ngày 27/10/2026"));
    expect(onToggle).toHaveBeenCalledWith("d-2026-10-27-17:30");
    fireEvent.click(screen.getByLabelText("Chọn buổi học ngày 03/11/2026"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("states the summary, the pinned selection count and the duplicate-check caption", () => {
    const { onToggleAll } = renderGrid();

    expect(screen.getByText(/buổi sẽ tạo/)).toHaveTextContent(
      "4 buổi sẽ tạo · 1 ngày nghỉ bỏ qua · 1 trùng buổi đã có (bỏ qua) · 1 buổi ngoài thời gian hiệu lực của lịch (bỏ qua) · 1 buổi ngày đã qua",
    );
    expect(screen.getByText(/Đã chọn:/)).toHaveTextContent("Đã chọn: 4 / 8 buổi");
    expect(screen.getByText(/^Từ/)).toHaveTextContent("Từ 29/09/2026 đến 17/11/2026");
    expect(screen.getByText("Kiểm tra trùng trên 300 buổi gần nhất của lớp; máy chủ kiểm tra lại khi tạo.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Chọn tất cả" }));
    expect(onToggleAll).toHaveBeenCalledOnce();
  });

  it("is one tab stop moved by arrows, Home and End, skipping blocked chips", () => {
    renderGrid();
    const inputs = chips();
    expect(inputs.filter((input) => input.tabIndex === 0)).toEqual([inputs[1]]);

    inputs[1].focus();
    fireEvent.keyDown(inputs[1], { key: "ArrowRight" });
    expect(document.activeElement).toBe(inputs[2]);
    // The roving tab stop follows focus.
    expect(inputs.filter((input) => input.tabIndex === 0)).toEqual([inputs[2]]);

    fireEvent.keyDown(inputs[2], { key: "ArrowRight" });
    expect(document.activeElement).toBe(inputs[3]);
    // 03/11 is a holiday: the next move skips it.
    fireEvent.keyDown(inputs[3], { key: "ArrowDown" });
    expect(document.activeElement).toBe(inputs[5]);
    fireEvent.keyDown(inputs[5], { key: "ArrowLeft" });
    expect(document.activeElement).toBe(inputs[3]);
    fireEvent.keyDown(inputs[3], { key: "End" });
    expect(document.activeElement).toBe(inputs[7]);
    // Home lands on the first chip that can take focus (29/09 is out of window).
    fireEvent.keyDown(inputs[7], { key: "Home" });
    expect(document.activeElement).toBe(inputs[1]);
    fireEvent.keyDown(inputs[1], { key: "ArrowUp" });
    expect(document.activeElement).toBe(inputs[1]);
  });

  it("keeps the empty state and the caption in the card", () => {
    renderGrid({ drafts: [], holidays: [] });
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByText("Chưa có buổi học nào được tính toán.")).toBeInTheDocument();
    expect(screen.getByText(/Đã chọn:/)).toHaveTextContent("Đã chọn: 0 / 0 buổi");
    expect(screen.queryByRole("button", { name: /Chọn tất cả|Bỏ chọn tất cả/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Kiểm tra trùng trên 300 buổi gần nhất/)).toBeInTheDocument();
  });

  it("offers to clear when every choosable chip is ticked", () => {
    renderGrid({ drafts: [draft("2026-10-20", 2), draft("2026-10-27", 2)], holidays: [] });
    expect(screen.getByRole("button", { name: "Bỏ chọn tất cả" })).toBeInTheDocument();
    expect(screen.getByText(/buổi sẽ tạo/)).toHaveTextContent("2 buổi sẽ tạo · 0 ngày nghỉ bỏ qua · 0 trùng buổi đã có (bỏ qua)");
  });
});
