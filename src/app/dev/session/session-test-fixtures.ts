import type { SessionTestActions } from "@/features/session-tests/components/session-test-actions";
import { prepareTestImage } from "@/features/session-tests/image-resize";
import type { SessionTestDetail, SessionTestSource, SessionTestState } from "@/features/session-tests/types";

export type SessionTestPreviewState = "none" | "pending" | "confirmed" | "ai";

/** A page drawn as SVG (img-src allows data: URLs), so the preview needs no Storage. */
function pagePhoto(pageNo: number, lines: string[]): string {
  const text = lines
    .map((line, index) => `<text x="60" y="${190 + index * 70}" font-size="34" fill="#2b3444">${line}</text>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200"><rect width="900" height="1200" fill="#fdfcf8"/><text x="60" y="110" font-size="40" font-weight="700" fill="#2b3444">BÀI KIỂM TRA SỰ TIẾN BỘ · Trang ${pageNo}</text>${text}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const assets: SessionTestDetail["assets"] = [
  {
    height: 1200,
    id: "asset-1",
    mimeType: "image/jpeg",
    pageNo: 1,
    sha256: "a".repeat(64),
    storagePath: "preview/1.jpg",
    url: pagePhoto(1, ["Câu 13. Tìm x biết x : 6 = 9", "Câu 14. Tính 56 : 7", "Câu 15. Tính 125 + 132"]),
    width: 900,
  },
  {
    height: 1200,
    id: "asset-2",
    mimeType: "image/jpeg",
    pageNo: 2,
    sha256: "b".repeat(64),
    storagePath: "preview/2.jpg",
    url: pagePhoto(2, ["Câu 16. Cho BC = 14 cm, M là trung điểm BC.", "Tính BM.", "Câu 17. Chu vi hình vuông 48 cm. Tính cạnh."]),
    width: 900,
  },
];

const confirmedKey: SessionTestDetail["answerKey"] = {
  questions: [
    { acceptedEquivalents: ["x = 54"], finalAnswer: "54", label: "13", maxPoints: 2, promptText: "Tìm x biết x : 6 = 9", solutionSteps: ["x = 9 × 6", "x = 54"] },
    { acceptedEquivalents: [], finalAnswer: "8", label: "14", maxPoints: 2, promptText: "Tính 56 : 7", solutionSteps: ["56 : 7 = 8"] },
    { acceptedEquivalents: [], finalAnswer: "257", label: "15", maxPoints: 2, promptText: "", solutionSteps: [] },
    { acceptedEquivalents: ["7"], finalAnswer: "7 cm", label: "16", maxPoints: 2, promptText: "", solutionSteps: ["BM = 14 : 2 = 7 (cm)"] },
    { acceptedEquivalents: ["12"], finalAnswer: "12 cm", label: "17", maxPoints: 2, promptText: "", solutionSteps: ["Cạnh = 48 : 4 = 12 (cm)"] },
  ],
};

const base: SessionTestDetail = {
  answerKey: { questions: [] },
  answerKeyVersion: 0,
  assets: [],
  classSessionId: "11111111-1111-4111-8111-111111111111",
  confirmedAt: null,
  confirmedByName: null,
  extraction: null,
  id: "22222222-2222-4222-8222-222222222222",
  markingGuide: null,
  source: null,
  status: "draft",
  title: null,
  updatedAt: "2026-10-12T12:40:00Z",
};

const sources: SessionTestSource[] = [
  {
    answerKey: confirmedKey,
    answerKeyVersion: 1,
    classCode: "L-9B26",
    className: "Toán 9B tối 2-4-6",
    classSessionId: "33333333-3333-4333-8333-333333333333",
    confirmedAt: "2026-10-12T11:05:00Z",
    confirmedByName: "Cô Lê Bích Ngọc",
    endTime: "19:00:00",
    markingGuide: "Thiếu đơn vị cm vẫn tính đúng.",
    pageCount: 2,
    startTime: "17:30:00",
    testId: "44444444-4444-4444-8444-444444444444",
    title: "Đề lớp 9 ngày 12/10",
  },
];

export function buildSessionTestState(state: SessionTestPreviewState, locked: boolean): SessionTestState {
  const shared = { aiConfigured: state === "ai", canConfirm: true, canManage: true, editable: !locked, sessionId: base.classSessionId };
  if (state === "none") return { ...shared, sources, test: null };
  if (state === "confirmed") {
    return {
      ...shared,
      sources,
      test: {
        ...base,
        answerKey: confirmedKey,
        answerKeyVersion: 2,
        assets,
        confirmedAt: "2026-10-12T12:52:00Z",
        confirmedByName: "Cô Lê Bích Ngọc",
        markingGuide: "Thiếu đơn vị cm vẫn tính đúng.",
        status: "key_confirmed",
        title: "Đề lớp 9 ngày 12/10",
      },
    };
  }
  return {
    ...shared,
    sources: state === "ai" ? [] : sources,
    test: {
      ...base,
      answerKey: { questions: confirmedKey.questions.slice(0, 3).map((question, index) => (index === 2 ? { ...question, finalAnswer: "", maxPoints: null } : question)) },
      assets,
      extraction:
        state === "ai" ? { createdAt: "2026-10-12T12:45:00Z", errorCode: null, finishedAt: null, id: "run-1", status: "queued" } : null,
      status: "key_review",
    },
  };
}

const wait = () => new Promise((resolve) => setTimeout(resolve, 400));
const PREVIEW = "Bản xem trước không ghi dữ liệu.";

/** Every action answers after a short wait without writing anything. */
export const previewSessionTestActions: SessionTestActions = {
  cancelExtraction: async () => (await wait(), { message: PREVIEW, ok: true }),
  confirm: async () => (await wait(), { message: PREVIEW, ok: false }),
  copy: async () => (await wait(), { message: PREVIEW, ok: false }),
  create: async () => (await wait(), { message: PREVIEW, ok: false }),
  prepareImage: (file) => prepareTestImage(file),
  registerAssets: async () => (await wait(), { message: PREVIEW, ok: false }),
  removeAsset: async () => (await wait(), { message: PREVIEW, ok: false }),
  reorderAssets: async () => (await wait(), { message: PREVIEW, ok: false }),
  requestExtraction: async () => (await wait(), { message: PREVIEW, ok: false }),
  saveDraft: async () => (await wait(), { message: PREVIEW, ok: false }),
  uploadPage: async () => (await wait(), { message: PREVIEW, ok: false }),
};
