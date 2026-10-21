// Value: protects=the "Bài kiểm tra" card on the session page: the chưa có / chờ chốt / đã chốt status line, photo upload (a test is created first, HEIC refused with its hint, duplicates skipped, each photo shrunk then uploaded to {test_id}/{uuid}.jpg and recorded), moving and removing pages with an inline confirmation, the manual key editor (live total that must reach 10, field errors, "Chia đều", draft save creating the test, confirm with version 0), editing a confirmed key (unchanged/no-reason blocked, next version + reason sent), "AI đọc đề" disabled with "Chưa cấu hình khóa AI — nhập đáp án tay" until a key exists, "Dùng đề có sẵn" (reason required over a confirmed key) and read-only viewers/closed sessions;
// fails_when=a HEIC file reaches the decoder, uploads go to a path the Storage policy refuses, a page is removed without confirmation, the confirm button opens before the total is 10 or stays closed after, the wrong version or no reason is sent when editing a confirmed key, AI reading can be queued without a key, a reuse over a confirmed key skips the reason, or viewers without manage_tests see edit controls;
// why_new=new client UI for AI grading phase 2;
// seam=server actions, image codec and Storage upload replaced by stand-ins, router mocked; no_claim=does not prove the server actions, SQL, Storage policies or real image resizing
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import type { AnswerKey } from "@/features/session-tests/answer-key";
import type { SessionTestActions } from "@/features/session-tests/components/session-test-actions";
import { SessionTestCard } from "@/features/session-tests/components/session-test-card";
import { HEIC_REFUSED_MESSAGE } from "@/features/session-tests/image-resize";
import type { SessionTestAsset, SessionTestDetail, SessionTestSource, SessionTestState } from "@/features/session-tests/types";

const sessionId = "11111111-1111-4111-8111-111111111111";
const testId = "22222222-2222-4222-8222-222222222222";

function asset(pageNo: number, sha: string): SessionTestAsset {
  return {
    height: 1932,
    id: `asset-${pageNo}`,
    mimeType: "image/jpeg",
    pageNo,
    sha256: sha.repeat(64),
    storagePath: `${testId}/page-${pageNo}.jpg`,
    url: `https://signed.example/page-${pageNo}.jpg`,
    width: 2576,
  };
}

const fullKey: AnswerKey = {
  questions: ["13", "14", "15", "16", "17"].map((label) => ({
    acceptedEquivalents: [],
    finalAnswer: `đáp án ${label}`,
    label,
    maxPoints: 2,
    promptText: "",
    solutionSteps: [],
  })),
};

const draftKey: AnswerKey = {
  questions: [
    { acceptedEquivalents: [], finalAnswer: "54", label: "13", maxPoints: 2, promptText: "", solutionSteps: [] },
    { acceptedEquivalents: [], finalAnswer: "8", label: "14", maxPoints: 2, promptText: "", solutionSteps: [] },
    { acceptedEquivalents: [], finalAnswer: "", label: "15", maxPoints: null, promptText: "", solutionSteps: [] },
  ],
};

function detail(overrides: Partial<SessionTestDetail> = {}): SessionTestDetail {
  return {
    answerKey: draftKey,
    answerKeyVersion: 0,
    assets: [asset(1, "a"), asset(2, "b")],
    classSessionId: sessionId,
    confirmedAt: null,
    confirmedByName: null,
    extraction: null,
    id: testId,
    markingGuide: null,
    source: null,
    status: "key_review",
    title: null,
    updatedAt: "2026-10-20T10:00:00Z",
    ...overrides,
  };
}

const confirmedDetail = detail({
  answerKey: fullKey,
  answerKeyVersion: 2,
  confirmedAt: "2026-10-20T12:52:00Z",
  confirmedByName: "Cô Ngọc",
  status: "key_confirmed",
  title: "Đề lớp 3",
});

const source: SessionTestSource = {
  answerKey: fullKey,
  answerKeyVersion: 1,
  classCode: "3B",
  className: "Toán 3B",
  classSessionId: "33333333-3333-4333-8333-333333333333",
  confirmedAt: "2026-10-20T08:00:00Z",
  confirmedByName: "Thầy Hùng",
  endTime: "16:30:00",
  markingGuide: null,
  pageCount: 1,
  startTime: "15:00:00",
  testId: "44444444-4444-4444-8444-444444444444",
  title: "Đề lớp 3 ngày 17/10",
};

function state(overrides: Partial<SessionTestState> = {}): SessionTestState {
  return {
    aiConfigured: false,
    canConfirm: true,
    canManage: true,
    editable: true,
    sessionId,
    sources: [],
    test: detail(),
    ...overrides,
  };
}

function makeActions(overrides: Partial<SessionTestActions> = {}): SessionTestActions {
  return {
    cancelExtraction: vi.fn(async () => ({ message: "Đã hủy lượt AI đọc đề.", ok: true })),
    confirm: vi.fn(async () => ({ message: "Đã chốt đáp án. AI sẽ chấm bài theo đáp án này.", ok: true as const, version: 1 })),
    copy: vi.fn(async () => ({ message: "Đã dùng đề có sẵn và chốt đáp án cho buổi này.", ok: true })),
    create: vi.fn(async () => ({ ok: true as const, testId })),
    prepareImage: vi.fn(async () => ({
      blob: new Blob(["jpeg"], { type: "image/jpeg" }),
      height: 1932,
      mimeType: "image/jpeg" as const,
      sha256: "c".repeat(64),
      width: 2576,
    })),
    registerAssets: vi.fn(async () => ({ added: 1, message: "Đã thêm 1 trang ảnh đề.", ok: true as const, skipped: 0 })),
    removeAsset: vi.fn(async () => ({ message: "Đã bỏ trang ảnh.", ok: true })),
    reorderAssets: vi.fn(async () => ({ message: "Đã đổi thứ tự trang.", ok: true })),
    requestExtraction: vi.fn(async () => ({ message: "Đã xếp lượt AI đọc đề.", ok: true })),
    saveDraft: vi.fn(async () => ({ message: "Đã lưu nháp đáp án.", ok: true })),
    uploadPage: vi.fn(async () => ({ ok: true as const })),
    ...overrides,
  };
}

function renderCard(testState: SessionTestState, actions = makeActions()) {
  render(<SessionTestCard actions={actions} result={{ data: testState, ok: true }} />);
  return actions;
}

const question = (label: string) => screen.getByRole("group", { name: `Câu ${label}` });

beforeEach(() => {
  router.refresh.mockClear();
});

afterEach(cleanup);

describe("status line", () => {
  it("shows chưa có when the session has no test", () => {
    renderCard(state({ test: null }));
    expect(screen.getByText("Chưa có đề", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("Chưa có đề. Tải ảnh đề rồi nhập đáp án từng câu.")).toBeInTheDocument();
  });

  it("shows chờ chốt with pages, questions and the running total", () => {
    renderCard(state());
    expect(screen.getByText("Chờ chốt đáp án")).toBeInTheDocument();
    expect(screen.getByText("2 trang ảnh · 3 câu · tổng 4/10 điểm. Chưa chốt nên AI chưa chấm bài.")).toBeInTheDocument();
  });

  it("shows đã chốt with the version and who confirmed it", () => {
    renderCard(state({ test: confirmedDetail }));
    expect(screen.getByText("Đã chốt đáp án")).toBeInTheDocument();
    expect(screen.getByText(/^Phiên bản 2 · chốt bởi Cô Ngọc lúc/)).toBeInTheDocument();
  });

  it("shows a load error inside the card", () => {
    render(<SessionTestCard actions={makeActions()} result={{ error: "Không tải được đề kiểm tra của buổi học.", ok: false }} />);
    expect(screen.getByText("Không tải được đề kiểm tra")).toBeInTheDocument();
  });
});

describe("photo pages", () => {
  it("creates the test, refuses HEIC, shrinks and uploads the rest, then records them", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const actions = renderCard(state({ test: null }));
    const heic = new File(["heic"], "IMG_0001.HEIC", { type: "image/heic" });
    const jpeg = new File(["jpeg"], "trang-1.jpg", { type: "image/jpeg" });

    await user.upload(screen.getByTestId("session-test-file-input"), [heic, jpeg]);

    await waitFor(() => expect(actions.registerAssets).toHaveBeenCalled());
    expect(actions.create).toHaveBeenCalledWith({ sessionId });
    expect(actions.prepareImage).toHaveBeenCalledTimes(1);
    expect(actions.prepareImage).toHaveBeenCalledWith(jpeg);
    const [path] = vi.mocked(actions.uploadPage).mock.calls[0];
    expect(path).toMatch(new RegExp(`^${testId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.jpg$`));
    expect(actions.registerAssets).toHaveBeenCalledWith({
      assets: [{ height: 1932, mimeType: "image/jpeg", sha256: "c".repeat(64), storagePath: path, width: 2576 }],
      testId,
    });
    const banner = await screen.findByText("Đã thêm 1 trang ảnh đề.");
    expect(banner.closest("[role]")).toHaveTextContent(`IMG_0001.HEIC: ${HEIC_REFUSED_MESSAGE}`);
    expect(router.refresh).toHaveBeenCalled();
  });

  it("skips a photo that is already a page", async () => {
    const user = userEvent.setup();
    const actions = renderCard(
      state(),
      makeActions({
        prepareImage: vi.fn(async () => ({ blob: new Blob(["x"]), height: 1, mimeType: "image/jpeg" as const, sha256: "a".repeat(64), width: 1 })),
      }),
    );
    await user.upload(screen.getByTestId("session-test-file-input"), new File(["x"], "lai.jpg", { type: "image/jpeg" }));
    expect(await screen.findByText("Chưa thêm được ảnh nào.")).toBeInTheDocument();
    expect(screen.getByText("lai.jpg: trùng với một trang đã có, bỏ qua.")).toBeInTheDocument();
    expect(actions.uploadPage).not.toHaveBeenCalled();
    expect(actions.registerAssets).not.toHaveBeenCalled();
  });

  it("moves a page and saves the new order", async () => {
    const user = userEvent.setup();
    const actions = renderCard(state());
    await user.click(screen.getByRole("button", { name: "Đưa trang 1 xuống sau" }));
    await waitFor(() => expect(actions.reorderAssets).toHaveBeenCalledWith({ assetIds: ["asset-2", "asset-1"], testId }));
    expect(screen.getAllByRole("img").map((image) => image.getAttribute("src"))).toEqual([
      "https://signed.example/page-2.jpg",
      "https://signed.example/page-1.jpg",
    ]);
  });

  it("asks before removing a page", async () => {
    const user = userEvent.setup();
    const actions = renderCard(state());
    await user.click(screen.getByRole("button", { name: "Bỏ trang 2" }));
    expect(actions.removeAsset).not.toHaveBeenCalled();
    const confirmBox = screen.getByRole("group", { name: "Bỏ trang 2" });
    expect(confirmBox).toHaveTextContent("Bỏ trang 2 khỏi đề? Các trang sau dồn lên.");
    await user.click(within(confirmBox).getByRole("button", { name: "Bỏ trang" }));
    await waitFor(() => expect(actions.removeAsset).toHaveBeenCalledWith({ assetId: "asset-2" }));
    expect(await screen.findByText("Đã bỏ trang ảnh.")).toBeInTheDocument();
  });
});

describe("answer key editor", () => {
  it("keeps Chốt đáp án closed until the total is exactly 10, then confirms version 0", async () => {
    const user = userEvent.setup();
    const actions = renderCard(state());
    // Re-query each time: the button gains or loses its reason wrapper as the key changes.
    const confirm = () => screen.getByRole("button", { name: "Chốt đáp án" });
    expect(confirm()).toBeDisabled();
    expect(confirm()).toHaveAccessibleDescription("Câu 15 chưa có điểm.");

    await user.type(within(question("15")).getByLabelText("Điểm"), "5");
    expect(confirm()).toHaveAccessibleDescription("Câu 15 chưa có đáp án cuối.");
    await user.type(within(question("15")).getByLabelText("Đáp án cuối"), "257");
    expect(confirm()).toHaveAccessibleDescription("Tổng điểm đang là 9, còn thiếu 1 điểm để đủ 10.");
    await user.clear(within(question("15")).getByLabelText("Điểm"));
    await user.type(within(question("15")).getByLabelText("Điểm"), "6");
    expect(screen.getByText(/đủ 10 điểm/)).toBeInTheDocument();
    expect(confirm()).toBeEnabled();

    await user.click(confirm());
    await waitFor(() => expect(actions.confirm).toHaveBeenCalled());
    expect(actions.confirm).toHaveBeenCalledWith({
      answerKey: { questions: [draftKey.questions[0], draftKey.questions[1], { ...draftKey.questions[2], finalAnswer: "257", maxPoints: 6 }] },
      expectedVersion: 0,
      markingGuide: null,
      reason: null,
      testId,
      title: null,
    });
    expect(await screen.findByText("Đã chốt đáp án. AI sẽ chấm bài theo đáp án này.")).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("blocks saving when two questions share a label", async () => {
    const user = userEvent.setup();
    renderCard(state());
    const label = within(question("14")).getByLabelText("Câu số");
    await user.clear(label);
    await user.type(label, "13");
    expect(screen.getByText("Số câu bị trùng với câu khác.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu nháp" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Chốt đáp án" })).toHaveAccessibleDescription("Sửa các ô đang báo lỗi trước.");
  });

  it("adds numbered questions, splits 10 points evenly and saves a draft after creating the test", async () => {
    const user = userEvent.setup();
    const actions = renderCard(state({ test: null }));
    for (let index = 0; index < 4; index += 1) await user.click(screen.getByRole("button", { name: "Thêm câu" }));
    expect(screen.getAllByRole("group", { name: /^Câu \d$/ }).map((group) => group.getAttribute("aria-label") ?? group.querySelector("legend")?.textContent)).toEqual([
      "Câu 1",
      "Câu 2",
      "Câu 3",
      "Câu 4",
      "Câu 5",
    ]);
    await user.click(screen.getByRole("button", { name: "Chia đều 10 điểm (2 điểm/câu)" }));
    expect(screen.getAllByLabelText("Điểm").map((input) => (input as HTMLInputElement).value)).toEqual(["2", "2", "2", "2", "2"]);

    await user.click(screen.getByRole("button", { name: "Lưu nháp" }));
    await waitFor(() => expect(actions.saveDraft).toHaveBeenCalled());
    expect(actions.create).toHaveBeenCalledWith({ sessionId });
    expect(vi.mocked(actions.saveDraft).mock.calls[0][0]).toMatchObject({ testId, title: null });
    expect(vi.mocked(actions.saveDraft).mock.calls[0][0].answerKey.questions).toHaveLength(5);
    expect(await screen.findByText("Đã lưu nháp đáp án.")).toBeInTheDocument();
  });

  it("edits a confirmed key as the next version with a reason", async () => {
    const user = userEvent.setup();
    const actions = renderCard(state({ test: confirmedDetail }), makeActions({
      confirm: vi.fn(async () => ({ message: "Đã lưu đáp án phiên bản 3.", ok: true as const, version: 3 })),
    }));
    expect(screen.queryByRole("button", { name: "Chốt đáp án" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sửa đáp án" }));

    const save = () => screen.getByRole("button", { name: "Lưu phiên bản 3" });
    expect(save()).toHaveAccessibleDescription("Đáp án chưa thay đổi so với bản đang dùng.");
    const answer = within(question("13")).getByLabelText("Đáp án cuối");
    await user.clear(answer);
    await user.type(answer, "55");
    expect(save()).toHaveAccessibleDescription("Nhập lý do sửa đáp án đã chốt.");
    await user.type(screen.getByLabelText("Lý do sửa đáp án đã chốt"), "Đề in sai số");
    expect(save()).toBeEnabled();
    await user.click(save());

    await waitFor(() => expect(actions.confirm).toHaveBeenCalled());
    expect(vi.mocked(actions.confirm).mock.calls[0][0]).toMatchObject({ expectedVersion: 2, reason: "Đề in sai số", testId, title: "Đề lớp 3" });
    expect(vi.mocked(actions.confirm).mock.calls[0][0].answerKey.questions[0].finalAnswer).toBe("55");
    expect(await screen.findByText("Đã lưu đáp án phiên bản 3.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sửa đáp án" })).toBeInTheDocument();
  });
});

describe("AI đọc đề", () => {
  it("stays disabled with the missing-key message while no Claude key is configured", () => {
    const actions = renderCard(state());
    const button = screen.getByRole("button", { name: "AI đọc đề" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Chưa cấu hình khóa AI — nhập đáp án tay");
    expect(actions.requestExtraction).not.toHaveBeenCalled();
  });

  it("needs a photo first", () => {
    renderCard(state({ aiConfigured: true, test: detail({ assets: [] }) }));
    expect(screen.getByRole("button", { name: "AI đọc đề" })).toHaveAccessibleDescription("Tải ít nhất một trang ảnh đề trước.");
  });

  it("queues a reading once configured and lets a waiting one be cancelled", async () => {
    const user = userEvent.setup();
    const actions = renderCard(state({ aiConfigured: true }));
    await user.click(screen.getByRole("button", { name: "AI đọc đề" }));
    await waitFor(() => expect(actions.requestExtraction).toHaveBeenCalledWith({ testId }));
    expect(await screen.findByText("Đã xếp lượt AI đọc đề.")).toBeInTheDocument();
  });

  // Value: protects=the TA sees the AI's draft as soon as "AI đọc đề" finishes; fails_when=the editor keeps the empty draft it opened with after the server wrote the AI's questions (the 21/10 production report); why_new=the editor only remounted on a new confirmed version; seam=rerender with the refreshed server state; no_claim=the worker or the SQL that applies the draft
  it("loads the AI draft into the editor when a reading finishes", () => {
    const empty = detail({ answerKey: { questions: [] }, extraction: { createdAt: "2026-10-21T12:44:37Z", errorCode: null, finishedAt: null, id: "run-1", status: "running" } });
    const { rerender } = render(<SessionTestCard actions={makeActions()} result={{ data: state({ aiConfigured: true, test: empty }), ok: true }} />);
    expect(screen.getAllByRole("group", { name: /^Câu / })).toHaveLength(1);

    const read = detail({
      answerKey: draftKey,
      extraction: { createdAt: "2026-10-21T12:44:37Z", errorCode: null, finishedAt: "2026-10-21T12:45:05Z", id: "run-1", outcome: "applied", status: "succeeded", warnings: ["Câu 15 khó đọc"] },
      title: "LT 10 (Miền B)",
      updatedAt: "2026-10-21T12:45:05Z",
    });
    rerender(<SessionTestCard actions={makeActions()} result={{ data: state({ aiConfigured: true, test: read }), ok: true }} />);
    expect(screen.getAllByRole("group", { name: /^Câu / })).toHaveLength(3);
    expect(within(question("13")).getByLabelText("Đáp án cuối")).toHaveValue("54");
    expect(screen.getByText("Câu 15 khó đọc")).toBeInTheDocument();
  });

  it("shows a waiting run with a cancel button", async () => {
    const user = userEvent.setup();
    const actions = renderCard(
      state({
        aiConfigured: true,
        test: detail({ extraction: { createdAt: "2026-10-20T10:05:00Z", errorCode: null, finishedAt: null, id: "run-1", status: "queued" } }),
      }),
    );
    expect(screen.getByText(/^Đang chờ AI đọc đề · yêu cầu lúc/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI đọc đề" })).toHaveAccessibleDescription("Đề này đang chờ AI đọc.");
    await user.click(screen.getByRole("button", { name: "Hủy lượt đọc" }));
    await waitFor(() => expect(actions.cancelExtraction).toHaveBeenCalledWith({ testId }));
  });

  it("is hidden once the key is confirmed", () => {
    renderCard(state({ aiConfigured: true, test: confirmedDetail }));
    expect(screen.queryByRole("button", { name: "AI đọc đề" })).not.toBeInTheDocument();
  });
});

describe("Dùng đề có sẵn", () => {
  it("reuses a confirmed test of the same day and grade", async () => {
    const user = userEvent.setup();
    const actions = renderCard(state({ sources: [source], test: null }));
    expect(screen.getByText(/Dùng đề sẽ chép đáp án và ảnh đề rồi chốt luôn/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dùng đề 3B" }));
    await waitFor(() =>
      expect(actions.copy).toHaveBeenCalledWith({ expectedVersion: 0, reason: null, sessionId, sourceTestId: source.testId }),
    );
    expect(await screen.findByText("Đã dùng đề có sẵn và chốt đáp án cho buổi này.")).toBeInTheDocument();
  });

  it("needs a reason to replace a key this session already confirmed", async () => {
    const user = userEvent.setup();
    const actions = renderCard(state({ sources: [source], test: confirmedDetail }));
    await user.click(screen.getByText("Thay bằng đề có sẵn của buổi khác"));
    expect(screen.getByRole("button", { name: "Dùng đề 3B" })).toHaveAccessibleDescription("Nhập lý do thay đáp án đang dùng.");
    await user.type(screen.getByLabelText("Lý do thay đáp án đang dùng"), "Lớp dùng chung đề với 3B");
    await user.click(screen.getByRole("button", { name: "Dùng đề 3B" }));
    await waitFor(() =>
      expect(actions.copy).toHaveBeenCalledWith({
        expectedVersion: 2,
        reason: "Lớp dùng chung đề với 3B",
        sessionId,
        sourceTestId: source.testId,
      }),
    );
  });
});

describe("read-only", () => {
  it("shows a viewer the key and photos without edit controls", () => {
    renderCard(state({ canConfirm: false, canManage: false, sources: [source], test: confirmedDetail }));
    expect(screen.getByText("Câu 13")).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Sửa đáp án" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("session-test-file-input")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dùng đề/ })).not.toBeInTheDocument();
  });

  it("locks a closed session's test", () => {
    renderCard(state({ editable: false }));
    expect(screen.getByText(/Buổi học đã khóa hoặc đã hủy nên đề chỉ để xem\./)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chốt đáp án" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đưa trang 1 xuống sau" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "AI đọc đề" })).not.toBeInTheDocument();
  });
});
