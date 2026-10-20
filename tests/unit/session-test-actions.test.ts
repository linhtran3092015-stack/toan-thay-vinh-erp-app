// Value: protects=the "Bài kiểm tra" server actions and loader: permission gates (manage_tests, confirm_key, both for reuse) before any database call, "AI đọc đề" refused with "Chưa cấu hình khóa AI — nhập đáp án tay" while ANTHROPIC_API_KEY is unset, keys sent to the RPC in the stored snake_case shape, database error codes mapped to Vietnamese, uploads the database did not record (duplicates or a failed RPC) deleted from Storage, a removed page's photo deleted only when no reused test still shows it, and the loader signing photo links and skipping the reuse list for viewers who cannot reuse;
// fails_when=an action reaches the RPC without its permission, AI reading is queued without a key, a camelCase key reaches the database, a version conflict shows the generic error, orphan uploads stay in the bucket, a shared photo is deleted from under another session, or a page without a signed link breaks the card;
// why_new=new server actions and loader for phase 2;
// seam=Supabase client and permission loader mocked; no_claim=does not prove the RPCs or Storage policies (pgTAP and the Storage smoke test cover them)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabasePermissions: vi.fn(),
  server: vi.fn(),
}));

vi.mock("@/lib/permissions/database-permissions", () => ({
  getCachedDatabasePermissions: mocks.getDatabasePermissions,
  getDatabasePermissions: mocks.getDatabasePermissions,
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));

import {
  confirmSessionTestKeyAction,
  copySessionTestKeyAction,
  registerSessionTestAssetsAction,
  removeSessionTestAssetAction,
  requestSessionTestKeyExtractionAction,
  saveSessionTestDraftAction,
} from "@/features/session-tests/actions";
import { getSessionTestState } from "@/features/session-tests/data";
import { permissionDeniedMessage } from "@/lib/permissions/labels";

const testId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const sourceId = "33333333-3333-4333-8333-333333333333";
const pathA = `${testId}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg`;
const pathB = `${testId}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg`;
const allowed = { ok: true, permissions: ["ai_grading.view", "ai_grading.manage_tests", "ai_grading.confirm_key"] };

function client(rpc: (name: string, args: Record<string, unknown>) => { data: unknown; error: unknown }) {
  const bucket = {
    createSignedUrls: vi.fn(async (paths: string[]) => ({ data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}` })), error: null })),
    remove: vi.fn(async () => ({ data: [], error: null })),
  };
  const fake = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => rpc(name, args)),
    storage: { from: vi.fn(() => bucket) },
  };
  mocks.server.mockResolvedValue(fake);
  return { bucket, fake };
}

const key = {
  questions: [
    { acceptedEquivalents: ["7"], finalAnswer: "7 cm", label: "16", maxPoints: 10, promptText: "", solutionSteps: ["BM = 14 : 2 = 7 (cm)"] },
  ],
};

beforeEach(() => {
  mocks.getDatabasePermissions.mockResolvedValue(allowed);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("permission gates", () => {
  it("checks manage_tests before saving a draft", async () => {
    mocks.getDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["ai_grading.view"] });
    const { fake } = client(() => ({ data: null, error: null }));
    expect(await saveSessionTestDraftAction({ answerKey: key, testId })).toEqual({
      message: permissionDeniedMessage("ai_grading.manage_tests"),
      ok: false,
    });
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("checks confirm_key before confirming", async () => {
    mocks.getDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["ai_grading.manage_tests"] });
    const { fake } = client(() => ({ data: null, error: null }));
    const result = await confirmSessionTestKeyAction({ answerKey: key, expectedVersion: 0, testId });
    expect(result).toEqual({ message: permissionDeniedMessage("ai_grading.confirm_key"), ok: false });
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("needs both permissions to reuse a test", async () => {
    mocks.getDatabasePermissions.mockResolvedValue({ ok: true, permissions: ["ai_grading.confirm_key"] });
    const { fake } = client(() => ({ data: null, error: null }));
    const result = await copySessionTestKeyAction({ expectedVersion: 0, sessionId, sourceTestId: sourceId });
    expect(result.ok).toBe(false);
    expect(fake.rpc).not.toHaveBeenCalled();
  });
});

describe("confirmSessionTestKeyAction", () => {
  it("sends the stored shape and the version being edited", async () => {
    const { fake } = client(() => ({ data: [{ answer_key_version: 1, confirmed_at: "2026-10-20T10:00:00Z" }], error: null }));
    const result = await confirmSessionTestKeyAction({ answerKey: key, expectedVersion: 0, testId, title: "Đề lớp 3" });
    expect(fake.rpc).toHaveBeenCalledWith("confirm_session_test_key", {
      p_answer_key: {
        questions: [
          { accepted_equivalents: ["7"], final_answer: "7 cm", label: "16", max_points: 10, prompt_text: "", solution_steps: ["BM = 14 : 2 = 7 (cm)"] },
        ],
      },
      p_expected_version: 0,
      p_marking_guide: "",
      p_reason: undefined,
      p_test_id: testId,
      p_title: "Đề lớp 3",
    });
    expect(result).toEqual({ message: "Đã chốt đáp án. AI sẽ chấm bài theo đáp án này.", ok: true, version: 1 });
  });

  it("explains a version conflict and a total that is not 10", async () => {
    client(() => ({ data: null, error: { message: "SESSION_TEST_VERSION_CONFLICT" } }));
    expect((await confirmSessionTestKeyAction({ answerKey: key, expectedVersion: 1, reason: "Sửa", testId })).ok).toBe(false);
    expect(await confirmSessionTestKeyAction({ answerKey: key, expectedVersion: 1, reason: "Sửa", testId })).toEqual({
      message: "Đáp án vừa được người khác chốt hoặc sửa. Tải lại trang để xem bản mới nhất.",
      ok: false,
    });
    client(() => ({ data: null, error: { message: "SESSION_TEST_KEY_TOTAL_NOT_TEN" } }));
    expect(await confirmSessionTestKeyAction({ answerKey: key, expectedVersion: 0, testId })).toEqual({
      message: "Tổng điểm các câu phải bằng 10.",
      ok: false,
    });
  });
});

describe("requestSessionTestKeyExtractionAction", () => {
  it("refuses while no Claude API key is configured", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { fake } = client(() => ({ data: "run", error: null }));
    expect(await requestSessionTestKeyExtractionAction({ testId })).toEqual({ message: "Chưa cấu hình khóa AI — nhập đáp án tay", ok: false });
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("queues a run once the key exists", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test-not-real");
    const { fake } = client(() => ({ data: "run-1", error: null }));
    const result = await requestSessionTestKeyExtractionAction({ testId });
    expect(fake.rpc).toHaveBeenCalledWith("request_session_test_key_extraction", { p_test_id: testId });
    expect(result.ok).toBe(true);
  });
});

describe("registerSessionTestAssetsAction", () => {
  const assets = [
    { height: 1932, mimeType: "image/jpeg", sha256: "a".repeat(64), storagePath: pathA, width: 2576 },
    { height: 1932, mimeType: "image/jpeg", sha256: "b".repeat(64), storagePath: pathB, width: 2576 },
  ];

  it("deletes the upload of a duplicate page", async () => {
    const { bucket } = client(() => ({
      data: [
        { added: true, asset_id: "x", page_no: 1, storage_path: pathA },
        { added: false, asset_id: "y", page_no: 1, storage_path: pathB },
      ],
      error: null,
    }));
    const result = await registerSessionTestAssetsAction({ assets, testId });
    expect(result).toEqual({ added: 1, message: "Đã thêm 1 trang ảnh đề. 1 ảnh trùng trang đã có nên bỏ qua.", ok: true, skipped: 1 });
    expect(bucket.remove).toHaveBeenCalledWith([pathB]);
  });

  it("deletes every upload when the database refuses them", async () => {
    const { bucket } = client(() => ({ data: null, error: { message: "SESSION_TEST_SESSION_CLOSED" } }));
    const result = await registerSessionTestAssetsAction({ assets, testId });
    expect(result).toEqual({ message: "Buổi học đã khóa hoặc đã hủy nên không sửa đề được nữa.", ok: false });
    expect(bucket.remove).toHaveBeenCalledWith([pathA, pathB]);
  });

  it("refuses a path outside the test folder before calling the database", async () => {
    const { fake } = client(() => ({ data: [], error: null }));
    const result = await registerSessionTestAssetsAction({
      assets: [{ ...assets[0], storagePath: `${sourceId}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg` }],
      testId,
    });
    expect(result.ok).toBe(false);
    expect(fake.rpc).not.toHaveBeenCalled();
  });
});

describe("removeSessionTestAssetAction", () => {
  it("keeps a photo another session still shows", async () => {
    const { bucket } = client(() => ({ data: [{ still_referenced: true, storage_path: pathA }], error: null }));
    expect((await removeSessionTestAssetAction({ assetId: sourceId })).ok).toBe(true);
    expect(bucket.remove).not.toHaveBeenCalled();
  });

  it("deletes a photo nothing uses any more", async () => {
    const { bucket } = client(() => ({ data: [{ still_referenced: false, storage_path: pathA }], error: null }));
    await removeSessionTestAssetAction({ assetId: sourceId });
    expect(bucket.remove).toHaveBeenCalledWith([pathA]);
  });
});

describe("getSessionTestState", () => {
  const row = {
    answer_key: { questions: [{ final_answer: "54", label: "13", max_points: 10 }] },
    answer_key_version: 1,
    assets: [
      { height: 1932, id: "44444444-4444-4444-8444-444444444444", mime_type: "image/jpeg", page_no: 1, sha256: "a".repeat(64), storage_path: pathA, width: 2576 },
    ],
    class_session_id: sessionId,
    confirmed_at: "2026-10-20T10:00:00Z",
    confirmed_by_name: "Cô Ngọc",
    extraction: null,
    id: testId,
    marking_guide: null,
    source: null,
    status: "key_confirmed",
    title: null,
    updated_at: "2026-10-20T10:00:00Z",
  };

  it("signs photo links and skips the reuse list for a session that cannot change", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { bucket, fake } = client((name) => (name === "get_session_test" ? { data: row, error: null } : { data: [], error: null }));
    const result = await getSessionTestState({ canConfirm: true, canManage: true, editable: false, sessionId });
    expect(bucket.createSignedUrls).toHaveBeenCalledWith([pathA], 900);
    expect(fake.rpc).not.toHaveBeenCalledWith("list_session_test_sources", expect.anything());
    expect(result.ok && result.data.test?.assets[0].url).toBe(`https://signed/${pathA}`);
    expect(result.ok && result.data.aiConfigured).toBe(false);
    expect(result.ok && result.data.test?.answerKey.questions[0]).toEqual({
      acceptedEquivalents: [],
      finalAnswer: "54",
      label: "13",
      maxPoints: 10,
      promptText: "",
      solutionSteps: [],
    });
  });

  it("keeps the page when Storage does not sign it", async () => {
    const { bucket } = client((name) => (name === "get_session_test" ? { data: row, error: null } : { data: [], error: null }));
    bucket.createSignedUrls.mockResolvedValueOnce({ data: null, error: { message: "boom" } } as never);
    const result = await getSessionTestState({ canConfirm: true, canManage: true, editable: true, sessionId });
    expect(result.ok && result.data.test?.assets[0].url).toBeNull();
  });

  it("returns null for a session without a test", async () => {
    client(() => ({ data: null, error: null }));
    const result = await getSessionTestState({ canConfirm: false, canManage: false, editable: true, sessionId });
    expect(result).toMatchObject({ data: { sources: [], test: null }, ok: true });
  });
});
