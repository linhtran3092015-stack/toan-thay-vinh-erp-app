// Value: protects=the "Ảnh bài giảng" part of the "Bài kiểm tra" card: TAs upload the teacher's slides (a test is created first, each slide shrunk and uploaded to {test_id}/{uuid}.jpg then recorded), reuse the slides of a same-grade session that week, remove one only after confirming; "AI đọc đề" says whether it will read slides; the key editor and view carry "Phương pháp của thầy" and saving a draft sends it with the key; viewers see slides but no controls;
// fails_when=slides upload to a path the Storage policy refuses, reuse sends the wrong test, a slide is removed without confirmation, the teacher's methods are dropped on save or not shown, or viewers get upload/reuse/remove controls;
// why_new=lesson slides for AI grading (owner pilot 23/10/2026); seam=server actions, image codec and Storage upload replaced by stand-ins, router mocked; no_claim=the SQL (pgTAP session-test-lesson-pages) and the worker prompt (ai-grading-worker)
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import type { AnswerKey } from "@/features/session-tests/answer-key";
import type { SessionTestActions } from "@/features/session-tests/components/session-test-actions";
import { SessionTestCard } from "@/features/session-tests/components/session-test-card";
import type { SessionTestAsset, SessionTestDetail, SessionTestState } from "@/features/session-tests/types";

const sessionId = "11111111-1111-4111-8111-111111111111";
const testId = "22222222-2222-4222-8222-222222222222";
const sourceTestId = "33333333-3333-4333-8333-333333333333";
const METHODS = "Dạng Tổng – Hiệu, PP Sơ đồ đoạn thẳng: Bé = (T − H) : 2";

function page(id: string, sha: string): SessionTestAsset {
  return { height: 2000, id, mimeType: "image/jpeg", pageNo: 1, sha256: sha.repeat(64), storagePath: `${testId}/${id}.jpg`, url: `https://signed.example/${id}.jpg`, width: 702 };
}

const key: AnswerKey = {
  questions: [{ acceptedEquivalents: [], finalAnswer: "60", label: "2", maxPoints: 10, promptText: "", solutionSteps: [] }],
};

function detail(overrides: Partial<SessionTestDetail> = {}): SessionTestDetail {
  return {
    answerKey: key,
    answerKeyVersion: 0,
    assets: [{ ...page("test-page", "a"), storagePath: `${testId}/test-page.jpg` }],
    classSessionId: sessionId,
    confirmedAt: null,
    confirmedByName: null,
    extraction: null,
    id: testId,
    lessonPages: [],
    markingGuide: null,
    source: null,
    status: "key_review",
    title: null,
    updatedAt: "2026-10-23T10:00:00Z",
    ...overrides,
  };
}

function state(overrides: Partial<SessionTestState> = {}): SessionTestState {
  return { aiConfigured: true, canConfirm: true, canManage: true, editable: true, lessonSources: [], sessionId, sources: [], test: detail(), ...overrides };
}

function makeActions(): SessionTestActions {
  return {
    cancelExtraction: vi.fn(async () => ({ message: "", ok: true })),
    confirm: vi.fn(async () => ({ message: "", ok: true as const, version: 1 })),
    copy: vi.fn(async () => ({ message: "", ok: true })),
    copyLessonPages: vi.fn(async () => ({ message: "Đã dùng 2 ảnh bài giảng của buổi đó.", ok: true })),
    create: vi.fn(async () => ({ ok: true as const, testId })),
    prepareImage: vi.fn(async () => ({ blob: new Blob(["jpeg"], { type: "image/jpeg" }), height: 2000, mimeType: "image/jpeg" as const, sha256: "c".repeat(64), width: 702 })),
    registerAssets: vi.fn(async () => ({ added: 1, message: "", ok: true as const, skipped: 0 })),
    registerLessonPages: vi.fn(async () => ({ added: 1, message: "Đã thêm 1 ảnh bài giảng.", ok: true as const, skipped: 0 })),
    removeAsset: vi.fn(async () => ({ message: "", ok: true })),
    removeLessonPage: vi.fn(async () => ({ message: "Đã bỏ ảnh bài giảng.", ok: true })),
    reorderAssets: vi.fn(async () => ({ message: "", ok: true })),
    requestExtraction: vi.fn(async () => ({ message: "", ok: true })),
    saveDraft: vi.fn(async () => ({ message: "Đã lưu nháp đáp án.", ok: true })),
    uploadPage: vi.fn(async () => ({ ok: true as const })),
  };
}

function renderCard(testState: SessionTestState, actions = makeActions()) {
  render(<SessionTestCard actions={actions} result={{ data: testState, ok: true }} />);
  return actions;
}

const lessonSection = () => screen.getByRole("region", { name: /Ảnh bài giảng/ });

beforeEach(() => router.refresh.mockClear());
afterEach(cleanup);

describe("Ảnh bài giảng", () => {
  it("creates the test, uploads a slide under its folder and records it", async () => {
    const user = userEvent.setup();
    const actions = renderCard(state({ test: null }));
    const slide = new File(["jpeg"], "slide-toan4.jpg", { type: "image/jpeg" });

    await user.upload(screen.getByTestId("session-test-lesson-input"), slide);

    await waitFor(() => expect(actions.registerLessonPages).toHaveBeenCalled());
    expect(actions.create).toHaveBeenCalledWith({ sessionId });
    const [path] = vi.mocked(actions.uploadPage).mock.calls[0];
    expect(path).toMatch(new RegExp(`^${testId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.jpg$`));
    expect(actions.registerLessonPages).toHaveBeenCalledWith({
      pages: [{ height: 2000, mimeType: "image/jpeg", sha256: "c".repeat(64), storagePath: path, width: 702 }],
      testId,
    });
    expect(await screen.findByText("Đã thêm 1 ảnh bài giảng.")).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("reuses the slides of a same-grade session that week", async () => {
    const user = userEvent.setup();
    const actions = renderCard(
      state({ lessonSources: [{ classCode: "4CLC1", className: "Toán 4 CLC1", classSessionId: "s2", pageCount: 2, sessionDate: "2026-10-21", startTime: "18:00:00", testId: sourceTestId }] }),
    );
    const source = within(lessonSection()).getByText(/4CLC1 · 21\/10 18:00 · 2 ảnh/).closest("li")!;
    await user.click(within(source as HTMLElement).getByRole("button", { name: "Dùng slide này" }));
    await waitFor(() => expect(actions.copyLessonPages).toHaveBeenCalledWith({ sourceTestId, testId }));
    expect(await screen.findByText("Đã dùng 2 ảnh bài giảng của buổi đó.")).toBeInTheDocument();
  });

  it("removes a slide only after confirming, and AI đọc đề says it will read it", async () => {
    const user = userEvent.setup();
    const actions = renderCard(state({ test: detail({ lessonPages: [page("slide-1", "d")] }) }));
    expect(screen.getByText(/AI đọc kèm 1 ảnh bài giảng/)).toBeInTheDocument();

    await user.click(within(lessonSection()).getByRole("button", { name: "Bỏ ảnh bài giảng 1" }));
    expect(actions.removeLessonPage).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("group", { name: "Bỏ ảnh bài giảng 1" })).getByRole("button", { name: "Bỏ ảnh" }));
    await waitFor(() => expect(actions.removeLessonPage).toHaveBeenCalledWith({ pageId: "slide-1" }));
  });

  it("says AI reads without slides when there are none", () => {
    renderCard(state());
    expect(screen.getByText("Chưa có ảnh bài giảng: AI tự giải theo cách thông thường.")).toBeInTheDocument();
  });

  it("shows slides to viewers without controls, and nothing when there are none", () => {
    renderCard(state({ canConfirm: false, canManage: false, test: detail({ lessonPages: [page("slide-1", "d")] }) }));
    expect(within(lessonSection()).getByRole("img", { name: "Ảnh bài giảng 1" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tải ảnh bài giảng" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Bỏ ảnh bài giảng 1" })).toBeNull();
    cleanup();
    renderCard(state({ canConfirm: false, canManage: false }));
    expect(screen.queryByRole("region", { name: /Ảnh bài giảng/ })).toBeNull();
  });
});

describe("Phương pháp của thầy", () => {
  it("is edited with the draft key and saved with it", async () => {
    const user = userEvent.setup();
    const actions = renderCard(state({ test: detail({ answerKey: { ...key, methods: METHODS } }) }));
    const field = screen.getByLabelText("Phương pháp của thầy (tùy chọn)");
    expect(field).toHaveValue(METHODS);
    await user.type(field, "\nKý hiệu: T là Tổng, H là Hiệu.");
    await user.click(screen.getByRole("button", { name: "Lưu nháp" }));
    await waitFor(() => expect(actions.saveDraft).toHaveBeenCalled());
    expect(vi.mocked(actions.saveDraft).mock.calls[0][0].answerKey.methods).toBe(`${METHODS}\nKý hiệu: T là Tổng, H là Hiệu.`);
  });

  it("is shown with a confirmed key", () => {
    renderCard(
      state({
        test: detail({
          answerKey: { ...key, methods: METHODS },
          answerKeyVersion: 1,
          confirmedAt: "2026-10-23T10:00:00Z",
          confirmedByName: "Cô Lan",
          status: "key_confirmed",
        }),
      }),
    );
    expect(screen.getByText("Phương pháp của thầy")).toBeInTheDocument();
    expect(screen.getByText(METHODS)).toBeInTheDocument();
  });
});
