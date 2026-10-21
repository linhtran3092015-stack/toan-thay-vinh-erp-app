// Value: protects=the TA's approval step on the session page: the panel starts from the AI verdicts, previews score/bonus/rank like the database, regenerates the draft comment when a verdict or the bonus changes (until the TA types their own), sends exactly what is shown, asks for a reason before replacing a hand-typed score, blocks approval for an absent student, saves the bonus tick before approval, and skips only with a reason;
// fails_when=a flipped verdict is not sent, the preview disagrees with what is saved, the draft keeps a stale bonus line, a hand-typed score is overwritten without a reason, an absent student can be approved, or the bonus tick is lost before approval;
// why_new=phase 3b review panel; seam=server actions injected, router mocked; no_claim=the SQL approval (pgTAP ai-grading-review)
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { DEFAULT_COMMENT_PHRASES } from "@/features/ai-grading/comment";
import { SubmissionReviewPanel, type ReviewActions, type ReviewContext } from "@/features/grading-submissions/components/submission-review-panel";
import type { SessionGradingSubmission, SubmissionReview } from "@/features/grading-submissions/data";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const SESSION = "11111111-1111-4111-8111-111111111111";
const STUDENT = "22222222-2222-4222-8222-222222222222";

function actions(): ReviewActions & Record<keyof ReviewActions, ReturnType<typeof vi.fn>> {
  return {
    approve: vi.fn(async () => ({ message: "Đã duyệt: điểm 9.", ok: true })),
    regrade: vi.fn(async () => ({ message: "Đã xếp lượt AI chấm lại.", ok: true })),
    setPraise: vi.fn(async () => ({ message: "Đã tick.", ok: true })),
    skip: vi.fn(async () => ({ message: "Đã bỏ qua.", ok: true })),
  } as never;
}

function context(bundle: ReviewActions, extra: Partial<ReviewContext> = {}): ReviewContext {
  return {
    actions: bundle,
    bands: [
      { label: "Tiến bộ ít", minScore: 0 },
      { label: "Tiến bộ vừa", minScore: 5 },
      { label: "Tiến bộ", minScore: 8 },
      { label: "Tiến bộ nhiều", minScore: 9 },
      { label: "Rất tiến bộ", minScore: 10 },
    ],
    canReview: true,
    canWriteResults: true,
    editable: true,
    key: {
      questions: [
        { acceptedEquivalents: [], finalAnswer: "x = 54", label: "13", maxPoints: 5, promptText: "", solutionSteps: [] },
        { acceptedEquivalents: [], finalAnswer: "x = 8", label: "14", maxPoints: 5, promptText: "", solutionSteps: [] },
      ],
    },
    keyVersion: 1,
    phrases: DEFAULT_COMMENT_PHRASES,
    sessionId: SESSION,
    ...extra,
  };
}

function submission(review: Partial<SubmissionReview> = {}): SessionGradingSubmission {
  return {
    ai: {
      color: "green",
      confidence: "high",
      flags: [],
      gradedAt: "2026-10-21T12:00:00Z",
      keyVersion: 1,
      questions: [
        { errorLocation: "dòng 1", extractedFinalAnswer: "18", label: "13", noteForParent: "", reasonForTeacher: "Sai", verdict: "incorrect" },
        { errorLocation: "", extractedFinalAnswer: "8", label: "14", noteForParent: "", reasonForTeacher: "Đúng", verdict: "correct" },
      ],
      rawScore: 5,
      state: "graded",
    },
    answerText: "13. 18\n14. 8",
    answerTruncated: false,
    attemptNo: 1,
    countsForScore: true,
    id: "sub-1",
    issues: [],
    review: {
      attendanceStatus: "present",
      feedbackText: null,
      finalScore: null,
      finalVerdicts: null,
      keyVersion: null,
      messageStatus: null,
      note: null,
      paperScore: null,
      praiseBonus: false,
      rankLabel: null,
      result: null,
      reviewedAt: null,
      reviewedByName: null,
      status: "pending",
      ...review,
    },
    sessionMatchMethod: "claimed_session",
    studentCode: "TV-1",
    studentId: STUDENT,
    studentMatchMethod: "student_code",
    studentName: "Học Sinh A",
    submittedAt: "2026-10-21T11:30:00Z",
  };
}

describe("SubmissionReviewPanel", () => {
  it("previews the score, follows verdict and bonus changes in the draft, and approves what is shown", async () => {
    const user = userEvent.setup();
    const bundle = actions();
    render(<SubmissionReviewPanel context={context(bundle)} submission={submission()} />);
    await user.click(screen.getByRole("button", { name: "Xem và duyệt" }));

    expect(screen.getByRole("status").textContent).toBe("Điểm bài làm 5 · Tiến bộ vừa");
    const comment = screen.getByLabelText("Nhận xét gửi phụ huynh") as HTMLTextAreaElement;
    expect(comment.value.split("\n")[0]).toBe('Con làm đúng 1/2 câu. Câu 13: con ghi "18", đáp án đúng là x = 54 (sai ở dòng 1).');

    await user.click(screen.getByRole("checkbox", { name: "Tích cực tương tác (+1)" }));
    expect(screen.getByRole("status").textContent).toBe("Điểm bài làm 5 · cộng 1 → 6 · Tiến bộ vừa");
    expect(comment.value.split("\n")[0]).toBe("Hôm nay con được cộng 1 điểm vì tích cực tương tác (điểm bài làm 5, sau khi cộng là 6).");
    // The editor is open, so the tick is saved with the approval, not separately.
    expect(bundle.setPraise).not.toHaveBeenCalled();

    await user.click(screen.getByRole("radio", { name: "Đúng", checked: false }));
    expect(screen.getByRole("status").textContent).toBe("Điểm bài làm 10 · đã 10 điểm, chỉ khen tích cực · Rất tiến bộ");

    await user.click(screen.getByRole("button", { name: "Duyệt và ghi điểm" }));
    expect(bundle.approve).toHaveBeenCalledWith({
      expectedKeyVersion: 1,
      feedbackText: comment.value,
      praiseBonus: true,
      reason: null,
      sessionId: SESSION,
      submissionId: "sub-1",
      verdicts: { "13": "correct", "14": "correct" },
    });
    expect(await screen.findByText("Đã duyệt: điểm 9.")).toBeTruthy();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("keeps the TA's own comment and needs a reason to replace a hand-typed score", async () => {
    const user = userEvent.setup();
    const bundle = actions();
    render(
      <SubmissionReviewPanel
        context={context(bundle)}
        submission={submission({ result: { comment: "Tay", fromThisSubmission: false, id: "r1", testScore: 7 } })}
      />,
    );
    expect(screen.getByText("Đã có điểm nhập tay 7")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Xem và duyệt" }));
    const comment = screen.getByLabelText("Nhận xét gửi phụ huynh");
    await user.clear(comment);
    await user.type(comment, "Con cố gắng hơn nhé.");
    await user.click(screen.getByRole("checkbox", { name: "Tích cực tương tác (+1)" }));
    expect((comment as HTMLTextAreaElement).value).toBe("Con cố gắng hơn nhé.");

    const approve = screen.getByRole("button", { name: "Duyệt và ghi điểm" }) as HTMLButtonElement;
    expect(approve.disabled).toBe(true);
    await user.type(screen.getByLabelText("Lý do thay điểm nhập tay 7"), "Chấm theo đáp án");
    // A button with a disabled reason renders differently, so look it up again.
    const enabled = screen.getByRole("button", { name: "Duyệt và ghi điểm" }) as HTMLButtonElement;
    expect(enabled.disabled).toBe(false);
    await user.click(enabled);
    expect(bundle.approve).toHaveBeenCalledWith(expect.objectContaining({ feedbackText: "Con cố gắng hơn nhé.", reason: "Chấm theo đáp án" }));
  });

  it("blocks approval for a student not marked present", async () => {
    const user = userEvent.setup();
    render(<SubmissionReviewPanel context={context(actions())} submission={submission({ attendanceStatus: "unexcused_absence" })} />);
    await user.click(screen.getByRole("button", { name: "Xem và duyệt" }));
    expect((screen.getByRole("button", { name: "Duyệt và ghi điểm" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("saves the bonus tick right away before review, and skips only with a reason", async () => {
    const user = userEvent.setup();
    const bundle = actions();
    render(<SubmissionReviewPanel context={context(bundle)} submission={submission()} />);
    await user.click(screen.getByRole("checkbox", { name: "Tích cực tương tác (+1)" }));
    expect(bundle.setPraise).toHaveBeenCalledWith({ praise: true, sessionId: SESSION, submissionId: "sub-1" });

    await user.click(screen.getByRole("button", { name: "Bỏ qua" }));
    const confirm = screen.getByRole("button", { name: "Xác nhận bỏ qua" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await user.type(screen.getByLabelText("Lý do bỏ qua"), "Làm trên giấy");
    await user.click(confirm);
    expect(bundle.skip).toHaveBeenCalledWith({ reason: "Làm trên giấy", sessionId: SESSION, submissionId: "sub-1" });
  });

  it("shows an approved paper, a changed key and a sent message, and hides tools for viewers", () => {
    const approved = submission({
      feedbackText: "Con làm tốt.",
      finalScore: 9,
      finalVerdicts: { "13": "correct", "14": "incorrect" },
      keyVersion: 1,
      messageStatus: "sent",
      paperScore: 8,
      rankLabel: "Tiến bộ nhiều",
      reviewedAt: "2026-10-21T12:30:00Z",
      reviewedByName: "Cô Ngọc",
      status: "approved",
    });
    const { unmount } = render(<SubmissionReviewPanel context={context(actions(), { keyVersion: 2 })} submission={approved} />);
    expect(screen.getByText("Đã duyệt: 9 điểm (đã cộng 1) · Tiến bộ nhiều")).toBeTruthy();
    expect(screen.getByText("Đáp án đã đổi sau khi duyệt")).toBeTruthy();
    expect(screen.getByText("Tin Zalo đã gửi")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Duyệt lại" })).toBeTruthy();
    unmount();

    render(<SubmissionReviewPanel context={context(actions(), { canReview: false })} submission={submission()} />);
    expect(screen.queryByRole("button", { name: "Xem và duyệt" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
