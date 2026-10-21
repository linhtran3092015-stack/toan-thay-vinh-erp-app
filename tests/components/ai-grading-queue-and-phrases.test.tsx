// Value: protects=the "Chấm bài AI" queue (sessions grouped by how far their papers got, sessions about to lock flagged, a bad date range falling back to the last 7 days) and the owner's phrase editor (saves every slot in order, refuses an empty slot or blank phrase, read-only for others) plus the 30-day spend bars;
// fails_when=a session with green/yellow/red papers is not under "Cần duyệt", a locking session is not flagged, a 3-month range reaches the database, a slot can be emptied, blank phrases are sent, or viewers can edit;
// why_new=phase 3c queue page and settings; seam=save action injected; no_claim=the SQL queue counts and phrase validation (pgTAP ai-grading-queue-settings)
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AiGradingQueuePage } from "@/features/ai-grading/components/ai-grading-queue-page";
import { PhraseLibraryEditor } from "@/features/ai-grading/components/phrase-library-editor";
import { SpendHistory } from "@/features/ai-grading/components/spend-history";
import { DEFAULT_COMMENT_PHRASES, type PhraseSlot } from "@/features/ai-grading/comment";
import { defaultQueueRange, parseQueueRange, queueStage, type AiGradingQueueSession } from "@/features/ai-grading/queue";

afterEach(cleanup);

function session(extra: Partial<AiGradingQueueSession>): AiGradingQueueSession {
  return {
    answerKeyVersion: 1,
    approved: 0,
    autoLockAt: null,
    classCode: "3A",
    className: "Lớp 3A",
    endTime: "19:30:00",
    grading: 0,
    greenPending: 0,
    id: "11111111-1111-4111-8111-111111111111",
    lockedAt: null,
    redPending: 0,
    sessionDate: "2026-10-20",
    sessionStatus: "completed",
    skipped: 0,
    startTime: "18:00:00",
    submissions: 0,
    testStatus: "key_confirmed",
    waitingKey: 0,
    yellowPending: 0,
    ...extra,
  };
}

describe("queue helpers", () => {
  it("defaults to the last 7 days and clamps bad ranges", () => {
    expect(defaultQueueRange("2026-10-21")).toEqual({ from: "2026-10-15", to: "2026-10-21" });
    expect(parseQueueRange({ from: "2026-10-01", to: "2026-10-10" }, "2026-10-21")).toEqual({ from: "2026-10-01", to: "2026-10-10" });
    expect(parseQueueRange({ from: "2026-07-01", to: "2026-10-10" }, "2026-10-21")).toEqual({ from: "2026-10-15", to: "2026-10-21" });
    expect(parseQueueRange({ from: "2026-10-10", to: "2026-10-01" }, "2026-10-21")).toEqual({ from: "2026-10-15", to: "2026-10-21" });
    expect(parseQueueRange({ from: "hôm qua" }, "2026-10-21")).toEqual({ from: "2026-10-15", to: "2026-10-21" });
  });

  it("puts a session where its papers are", () => {
    expect(queueStage(session({ submissions: 0 }))).toBe("no_submissions");
    expect(queueStage(session({ submissions: 3, yellowPending: 1 }))).toBe("review");
    expect(queueStage(session({ grading: 2, submissions: 3, waitingKey: 1 }))).toBe("in_progress");
    expect(queueStage(session({ approved: 2, skipped: 1, submissions: 3 }))).toBe("done");
  });
});

describe("AiGradingQueuePage", () => {
  const sessions = [
    session({ autoLockAt: "2026-10-21T20:00:00Z", greenPending: 2, id: "a", redPending: 1, submissions: 5, yellowPending: 1 }),
    session({ classCode: "4B", grading: 3, id: "b", submissions: 3, testStatus: "key_confirmed" }),
    session({ approved: 4, classCode: "5C", id: "c", submissions: 4 }),
  ];

  it("lists sessions to review with their counts and flags the one locking soon", () => {
    render(
      <AiGradingQueuePage
        now="2026-10-21T12:00:00Z"
        range={{ from: "2026-10-15", to: "2026-10-21" }}
        sessions={sessions}
        stage="review"
        today={{ approved: 4, graded: 12, green: 9, red: 1, yellow: 2 }}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Lọc theo trạng thái" });
    expect(within(nav).getByRole("link", { name: "Cần duyệt (1)" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: "Đang chấm / chờ đáp án (1)" }).getAttribute("href")).toBe("/ai-grading?from=2026-10-15&to=2026-10-21&stage=in_progress");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("2 xanh chờ duyệt")).toBeTruthy();
    expect(screen.getByText("1 đỏ (chấm tay)")).toBeTruthy();
    expect(screen.getByText(/^Tự khóa lúc/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mở buổi để duyệt 4 bài" }).getAttribute("href")).toBe("/sessions/a");
    expect(screen.getByText("12")).toBeTruthy();
  });

  it("shows an empty state when nothing waits", () => {
    render(<AiGradingQueuePage range={{ from: "2026-10-15", to: "2026-10-21" }} sessions={[sessions[2]]} stage="review" today={null} />);
    expect(screen.getByText("Không có buổi nào")).toBeTruthy();
  });
});

describe("PhraseLibraryEditor", () => {
  it("saves every slot in order, trimmed, and refuses blank phrases", async () => {
    const user = userEvent.setup();
    const save = vi.fn<(phrases: Array<{ slot: PhraseSlot; text: string }>) => Promise<{ message: string; ok: boolean }>>(async () => ({
      message: "Đã lưu 17 câu mẫu.",
      ok: true,
    }));
    render(<PhraseLibraryEditor canManage initial={DEFAULT_COMMENT_PHRASES} save={save} />);
    const wishes = screen.getByRole("group", { name: /Ý 4 · Lời chúc/ });
    await user.click(within(wishes).getByRole("button", { name: "Thêm câu" }));
    expect((screen.getByRole("button", { name: "Lưu câu mẫu" }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(within(wishes).getByLabelText("Ý 4 · Lời chúc, câu 4"), "  Thầy chúc con học vui.  ");
    await user.click(screen.getByRole("button", { name: "Lưu câu mẫu" }));

    expect(save).toHaveBeenCalledTimes(1);
    const sent = save.mock.calls[0][0];
    expect(sent).toHaveLength(17);
    expect(sent.filter((phrase) => phrase.slot === "y4").map((phrase) => phrase.text).at(-1)).toBe("Thầy chúc con học vui.");
    expect(await screen.findByText("Đã lưu 17 câu mẫu.")).toBeTruthy();
  });

  it("keeps at least one phrase per slot and is read-only for viewers", () => {
    const { unmount } = render(<PhraseLibraryEditor canManage initial={DEFAULT_COMMENT_PHRASES} save={vi.fn()} />);
    const firstSlot = screen.getByRole("group", { name: /Ý 1 · Đúng hết/ });
    expect((within(firstSlot).getByRole("button", { name: /Xóa ý 1 · đúng hết, câu 1/ }) as HTMLButtonElement).disabled).toBe(true);
    unmount();
    render(<PhraseLibraryEditor canManage={false} initial={DEFAULT_COMMENT_PHRASES} />);
    expect(screen.queryByRole("button", { name: "Lưu câu mẫu" })).toBeNull();
    expect((screen.getByLabelText("Ý 4 · Lời chúc, câu 1") as HTMLTextAreaElement).disabled).toBe(true);
  });
});

describe("SpendHistory", () => {
  it("sums the 30 days and names the busiest one", () => {
    render(
      <SpendHistory
        budgetUsd={20}
        days={[
          { costUsd: 0.5, date: "2026-10-19", runs: 40 },
          { costUsd: 1.75, date: "2026-10-20", runs: 120 },
          { costUsd: 0, date: "2026-10-21", runs: 0 },
        ]}
      />,
    );
    expect(screen.getByText(/30 ngày qua:/).textContent).toBe("30 ngày qua: 2,25 USD cho 160 lượt · cao nhất 1,75 USD ngày 20/10.");
    expect(screen.getByRole("img", { name: "Chi phí từng ngày" }).children).toHaveLength(3);
  });
});
