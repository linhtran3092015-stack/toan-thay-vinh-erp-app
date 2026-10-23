// Value: protects=Cài đặt → Chấm bài AI and the AI line on each submission: the owner changes model, effort, double check, tiebreak, key model and the daily budget and saves exactly that; other viewers see the same status read-only; a bad budget blocks saving; a pause shows its reason and only the owner can resume; each submission shows "đang chấm", green/yellow with the AI score, or red "chấm tay";
// fails_when=the save sends stale or partial settings, a non-owner gets enabled controls, a decimal budget is saved, the pause banner hides its reason, or a red paper shows a score;
// why_new=phase 3a settings page and submission summary; seam=server actions injected; no_claim=the RPC validation (pgTAP) or the worker
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AiGradingSettingsPanel, type AiGradingSettingsActions } from "@/features/ai-grading/components/ai-grading-settings";
import { AI_GRADING_DEFAULTS, type AiGradingOverview } from "@/features/ai-grading/settings";
import { SubmissionAiSummary } from "@/features/grading-submissions/components/submission-ai-summary";
import type { SubmissionAi } from "@/features/grading-submissions/data";

afterEach(cleanup);

function overview(extra: Partial<AiGradingOverview> = {}): AiGradingOverview {
  return {
    dailySpend: [
      { costUsd: 0.5, date: "2026-10-20", runs: 60 },
      { costUsd: 0.42, date: "2026-10-21", runs: 48 },
    ],
    failedToday: 1,
    gradedToday: 24,
    keysReadToday: 2,
    pauseReason: null,
    pausedUntil: null,
    queued: 3,
    running: 1,
    settings: { ...AI_GRADING_DEFAULTS, enabled: true },
    spentMonthUsd: 12.5,
    spentTodayUsd: 0.42,
    ...extra,
  };
}

function actions(): AiGradingSettingsActions & { resume: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> } {
  return {
    resume: vi.fn(async () => ({ message: "Đã cho chạy lại.", ok: true })),
    save: vi.fn(async () => ({ message: "Đã lưu. Chấm bài AI đang bật.", ok: true })),
  };
}

describe("AiGradingSettingsPanel", () => {
  it("lets the owner change the models and budget and saves exactly those values", async () => {
    const user = userEvent.setup();
    const bundle = actions();
    render(<AiGradingSettingsPanel actions={bundle} apiKeyConfigured canManage cronConfigured={false} overview={overview()} />);

    expect(screen.getByText("Đã có khóa Claude API")).toBeTruthy();
    expect(screen.getByText("Chưa có CRON_SECRET: chỉ chạy khi có việc")).toBeTruthy();
    expect(screen.getByText("0,42 USD / 20,00 USD")).toBeTruthy();

    await user.selectOptions(screen.getByLabelText("Model chấm bài"), "claude-sonnet-5-5");
    await user.selectOptions(screen.getByLabelText("Mức suy luận khi chấm"), "high");
    await user.selectOptions(screen.getByLabelText("Model trọng tài"), "off");
    const budget = screen.getByLabelText("Trần chi phí ngày");
    await user.clear(budget);
    await user.type(budget, "35");
    await user.click(screen.getByRole("button", { name: "Lưu cài đặt" }));

    expect(bundle.save).toHaveBeenCalledWith({
      dailyBudgetUsd: 35,
      doubleCheck: true,
      enabled: true,
      gradeEffort: "high",
      gradeModel: "claude-sonnet-5-5",
      keyModel: "claude-opus-5-5",
      tiebreakModel: "off",
    });
    expect(await screen.findByText("Đã lưu. Chấm bài AI đang bật.")).toBeTruthy();
  });

  it("refuses a budget that is not a whole number from 1 to 200", async () => {
    const user = userEvent.setup();
    const bundle = actions();
    render(<AiGradingSettingsPanel actions={bundle} apiKeyConfigured canManage cronConfigured overview={overview()} />);
    const budget = screen.getByLabelText("Trần chi phí ngày");
    await user.clear(budget);
    await user.type(budget, "12.5");
    expect(screen.getByText("Nhập số nguyên từ 1 đến 200.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Lưu cài đặt" }) as HTMLButtonElement).disabled).toBe(true);
    expect(bundle.save).not.toHaveBeenCalled();
  });

  it("is read-only for viewers without settings.manage", () => {
    render(<AiGradingSettingsPanel actions={actions()} apiKeyConfigured={false} canManage={false} cronConfigured overview={overview()} />);
    expect(screen.getByText("Chỉ đọc")).toBeTruthy();
    expect(screen.getByText("Chưa có ANTHROPIC_API_KEY trên máy chủ")).toBeTruthy();
    expect((screen.getByLabelText("Model chấm bài") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText("Bật chấm bài AI") as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Lưu cài đặt" })).toBeNull();
  });

  it("shows why the queue is paused and lets only the owner resume", async () => {
    const user = userEvent.setup();
    const bundle = actions();
    const paused = overview({ pauseReason: "credit_exhausted", pausedUntil: "2026-10-21T13:00:00Z" });
    const { unmount } = render(<AiGradingSettingsPanel actions={bundle} apiKeyConfigured canManage cronConfigured overview={paused} />);
    expect(screen.getByText("Chấm bài AI đang tạm dừng")).toBeTruthy();
    expect(screen.getByText(/Hết tín dụng API/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Chạy lại ngay" }));
    expect(bundle.resume).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Đã cho chạy lại.")).toBeTruthy();
    unmount();

    render(<AiGradingSettingsPanel actions={bundle} apiKeyConfigured canManage={false} cronConfigured overview={paused} />);
    expect(screen.queryByRole("button", { name: "Chạy lại ngay" })).toBeNull();
  });
});

function ai(extra: Partial<SubmissionAi>): SubmissionAi {
  return { color: null, confidence: null, flags: [], gradedAt: null, keyVersion: null, questions: [], rawScore: null, state: "waiting_key", ...extra };
}

describe("SubmissionAiSummary", () => {
  it("shows the grading state, the AI score and each question", async () => {
    const { rerender } = render(<SubmissionAiSummary ai={ai({ state: "grading" })} />);
    expect(screen.getByText("AI đang chấm")).toBeTruthy();
    rerender(<SubmissionAiSummary ai={ai({ state: "waiting_key" })} />);
    expect(screen.getByText("Chưa chấm AI")).toBeTruthy();
    rerender(<SubmissionAiSummary ai={ai({ color: "red", state: "failed" })} />);
    expect(screen.getByText("AI không chấm được · chấm tay")).toBeTruthy();

    rerender(
      <SubmissionAiSummary
        ai={ai({
          color: "yellow",
          flags: ["ambiguous_notation"],
          questions: [
            { errorLocation: "", extractedFinalAnswer: "54", label: "13", noteForParent: "", reasonForTeacher: "Đúng đáp án", verdict: "correct" },
            { errorLocation: "dòng 2", extractedFinalAnswer: "9", label: "14", noteForParent: "", reasonForTeacher: "Sai phép chia", verdict: "incorrect" },
          ],
          rawScore: 7.5,
          state: "graded",
        })}
      />,
    );
    expect(screen.getByText("AI: 7,5 điểm · cần trợ giảng xem")).toBeTruthy();
    expect(screen.getByText("Ký hiệu có thể hiểu hai cách")).toBeTruthy();
    expect(screen.getByText(/1\/2 câu đúng/)).toBeTruthy();
    const details = screen.getByText("Kết quả AI từng câu").closest("details")!;
    expect(within(details).getByText('Câu 14: Sai · em ghi "9"')).toBeTruthy();
    expect(within(details).getByText("Chỗ sai: dòng 2")).toBeTruthy();
  });

  it("hides older attempts", () => {
    const { container } = render(<SubmissionAiSummary ai={ai({ state: "not_counted" })} />);
    expect(container.textContent).toBe("");
  });
});
