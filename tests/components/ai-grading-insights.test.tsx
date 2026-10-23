// Value: protects=the checks added after the first live week of AI grading: a question most papers got wrong is spelled out next to the key (with the wrong answer most students share), "Duyệt N bài xanh" asks once more while such a warning stands, the queue page flags those sessions and papers handed in again after approval, and the owner's 30-day table shows how often each reviewer changed the AI's result;
// fails_when=the warning line drops the count, share or common answer, bulk approval runs straight through a key warning or cannot be confirmed, the queue badges disappear, or the stats table miscounts the change rate or the total row;
// why_new=AI grading insights (v0.34); seam=bulk action injected, router mocked; no_claim=the SQL counts behind each number (pgTAP ai-grading-insights)
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { AiGradingQueuePage } from "@/features/ai-grading/components/ai-grading-queue-page";
import { ReviewerStatsCard } from "@/features/ai-grading/components/reviewer-stats";
import type { AiGradingQueueSession } from "@/features/ai-grading/queue";
import { changeRate, reviewerStatsRowSchema, totalReviewerStats, type ReviewerStats } from "@/features/ai-grading/review-stats";
import { ApproveGreenButton } from "@/features/grading-submissions/components/approve-green-button";
import { KeyWarnings, keyWarningLine } from "@/features/session-tests/components/key-warnings";
import type { SessionTestKeyWarning } from "@/features/session-tests/types";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const SESSION = "11111111-1111-4111-8111-111111111111";

const warning: SessionTestKeyWarning = { commonAnswer: "41", commonAnswerCount: 6, keyAnswer: "42", label: "15", papers: 11, wrong: 9 };

describe("key warnings", () => {
  it("spells out the share of wrong papers and the answer most of them gave", () => {
    expect(keyWarningLine(warning)).toBe("Câu 15: 9/11 bài sai (82%); 6 em cùng ghi “41”, đáp án đang chốt “42”.");
    expect(keyWarningLine({ ...warning, commonAnswer: null, commonAnswerCount: null, keyAnswer: null })).toBe("Câu 15: 9/11 bài sai (82%).");
  });

  it("tells key editors to fix the key and everyone else to ask, and shows nothing without warnings", () => {
    const { rerender } = render(<KeyWarnings canEdit warnings={[warning]} />);
    expect(screen.getByText("Kiểm tra lại đáp án")).toBeTruthy();
    expect(screen.getByText(/bấm Sửa đáp án: AI chấm lại các bài chưa duyệt/)).toBeTruthy();
    expect(screen.getByText(keyWarningLine(warning))).toBeTruthy();
    rerender(<KeyWarnings canEdit={false} warnings={[warning]} />);
    expect(screen.getByText(/Báo người chốt đáp án kiểm tra lại/)).toBeTruthy();
    rerender(<KeyWarnings canEdit warnings={[]} />);
    expect(screen.queryByText("Kiểm tra lại đáp án")).toBeNull();
  });
});

describe("Duyệt N bài xanh", () => {
  const ok = { approved: 4, failed: 0, message: "Đã duyệt 4 bài.", ok: true, skipped: 0 };

  it("approves at once when the key has no warning", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ok);
    render(<ApproveGreenButton action={action} count={4} sessionId={SESSION} />);
    await user.click(screen.getByRole("button", { name: "Duyệt 4 bài xanh" }));
    expect(action).toHaveBeenCalledWith({ sessionId: SESSION });
    expect(await screen.findByText("Đã duyệt 4 bài.")).toBeTruthy();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("asks once more while a question looks mis-keyed, and can be called off", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ok);
    render(<ApproveGreenButton action={action} count={4} keyWarning={keyWarningLine(warning)} sessionId={SESSION} />);
    await user.click(screen.getByRole("button", { name: "Duyệt 4 bài xanh" }));
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByText("Đáp án có thể chốt nhầm")).toBeTruthy();
    expect(screen.getByText(/Câu 15: 9\/11 bài sai/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Để kiểm tra đáp án" }));
    expect(screen.queryByText("Đáp án có thể chốt nhầm")).toBeNull();
    expect(action).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Duyệt 4 bài xanh" }));
    await user.click(screen.getByRole("button", { name: "Vẫn duyệt 4 bài" }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Đã duyệt 4 bài.")).toBeTruthy();
  });
});

describe("queue page flags", () => {
  it("flags a session with a suspect key and papers handed in again after approval", () => {
    const session: AiGradingQueueSession = {
      answerKeyVersion: 1,
      approved: 3,
      autoLockAt: null,
      classCode: "7A",
      className: "Toán 7A",
      endTime: "19:30:00",
      grading: 0,
      greenPending: 5,
      id: SESSION,
      lockedAt: null,
      redPending: 0,
      resubmittedPending: 2,
      sessionDate: "2026-10-22",
      sessionStatus: "completed",
      skipped: 0,
      startTime: "18:00:00",
      submissions: 10,
      suspectQuestions: 1,
      testStatus: "key_confirmed",
      waitingKey: 0,
      yellowPending: 2,
    };
    render(<AiGradingQueuePage range={{ from: "2026-10-16", to: "2026-10-22" }} sessions={[session]} stage="review" today={null} />);
    const card = screen.getByRole("listitem");
    expect(within(card).getByText("Kiểm tra đáp án: 1 câu hơn 70% bài sai")).toBeTruthy();
    expect(within(card).getByText("2 nộp lại sau khi duyệt")).toBeTruthy();
  });
});

describe("reviewer stats", () => {
  const rows: ReviewerStats[] = [
    reviewerStatsRowSchema.parse({
      approved: 60, blank: 5, changed_green: 0, changed_papers: 3, changed_questions: 4, compared: 55, green: 40,
      last_reviewed_at: "2026-10-22T14:00:00Z", praise_bonus: 20, red: 0, reviewer_id: "33333333-3333-4333-8333-333333333333",
      reviewer_name: "Cô Lan", yellow: 20,
    }),
    reviewerStatsRowSchema.parse({
      approved: 20, blank: 0, changed_green: 1, changed_papers: 1, changed_questions: 1, compared: 20, green: 18,
      last_reviewed_at: null, praise_bonus: 2, red: 0, reviewer_id: "44444444-4444-4444-8444-444444444444",
      reviewer_name: null, yellow: 2,
    }),
  ];

  it("rates changes and sums every reviewer", () => {
    expect(changeRate(3, 55)).toBe("3/55 (5%)");
    expect(changeRate(0, 0)).toBe("–");
    expect(rows[1].reviewerName).toBe("Nhân sự");
    expect(totalReviewerStats(rows)).toEqual({
      approved: 80, blank: 5, changedGreen: 1, changedPapers: 4, changedQuestions: 5, compared: 75, green: 58, praiseBonus: 22, red: 0, yellow: 22,
    });
  });

  it("shows one row per reviewer, a total row and the summary line", () => {
    render(<ReviewerStatsCard result={{ ok: true, rows }} />);
    expect(screen.getByText((_, element) => element?.tagName === "P" && (element.textContent ?? "").startsWith("Đã duyệt")).textContent).toBe(
      "Đã duyệt 80 bài. Trợ giảng sửa kết quả AI ở 4/75 (5%) bài có làm, trong đó 1 bài xanh; 5 bài nộp trống chấm tay.",
    );
    const table = screen.getByRole("table");
    const lines = within(table).getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent));
    expect(lines[0].slice(0, 8)).toEqual(["Cô Lan", "60", "40 · 20 · 0", "3/55 (5%)", "0/40 (0%)", "4", "5", "20"]);
    expect(lines[2].slice(0, 8)).toEqual(["Tổng", "80", "58 · 22 · 0", "4/75 (5%)", "1/58 (2%)", "5", "5", "22"]);
  });

  it("says when nothing was approved and when the stats could not load", () => {
    const { rerender } = render(<ReviewerStatsCard result={{ ok: true, rows: [] }} />);
    expect(screen.getByText("Chưa có bài nào được duyệt.")).toBeTruthy();
    rerender(<ReviewerStatsCard result={{ error: "Không tải được thống kê duyệt bài.", ok: false }} />);
    expect(screen.getByText("Không tải được thống kê duyệt bài.")).toBeTruthy();
  });
});
