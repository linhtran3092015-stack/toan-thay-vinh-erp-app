import {
  cancelSessionTestKeyExtractionAction,
  confirmSessionTestKeyAction,
  copyLessonPagesAction,
  copySessionTestKeyAction,
  createSessionTestAction,
  registerLessonPagesAction,
  registerSessionTestAssetsAction,
  removeLessonPageAction,
  removeSessionTestAssetAction,
  reorderSessionTestAssetsAction,
  requestSessionTestKeyExtractionAction,
  saveSessionTestDraftAction,
} from "@/features/session-tests/actions";
import { prepareTestImage, type PreparedTestImage } from "@/features/session-tests/image-resize";
import { SESSION_TEST_BUCKET } from "@/features/session-tests/storage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type UploadPageResult = { message: string; ok: false } | { ok: true };

/** What the "Bài kiểm tra" card calls; the dev preview and tests pass stand-ins. */
export interface SessionTestActions {
  cancelExtraction: typeof cancelSessionTestKeyExtractionAction;
  confirm: typeof confirmSessionTestKeyAction;
  copy: typeof copySessionTestKeyAction;
  /** "Ảnh bài giảng": reuse, record and remove slides. Absent in stand-ins written before slides. */
  copyLessonPages?: typeof copyLessonPagesAction;
  create: typeof createSessionTestAction;
  /** Shrinks and re-encodes one photo in the browser. */
  prepareImage: (file: File) => Promise<PreparedTestImage>;
  registerAssets: typeof registerSessionTestAssetsAction;
  registerLessonPages?: typeof registerLessonPagesAction;
  removeAsset: typeof removeSessionTestAssetAction;
  removeLessonPage?: typeof removeLessonPageAction;
  reorderAssets: typeof reorderSessionTestAssetsAction;
  requestExtraction: typeof requestSessionTestKeyExtractionAction;
  saveDraft: typeof saveSessionTestDraftAction;
  /** Uploads one prepared photo straight to Storage with the signed-in user's session. */
  uploadPage: (path: string, image: PreparedTestImage) => Promise<UploadPageResult>;
}

async function uploadPageFromBrowser(path: string, image: PreparedTestImage): Promise<UploadPageResult> {
  try {
    const { error } = await getSupabaseBrowserClient()
      .storage.from(SESSION_TEST_BUCKET)
      .upload(path, image.blob, { cacheControl: "3600", contentType: image.mimeType, upsert: false });
    if (error) return { message: "Không tải được ảnh lên. Kiểm tra mạng rồi thử lại.", ok: false };
    return { ok: true };
  } catch {
    return { message: "Không tải được ảnh lên. Kiểm tra mạng rồi thử lại.", ok: false };
  }
}

export const sessionTestServerActions: SessionTestActions = {
  cancelExtraction: cancelSessionTestKeyExtractionAction,
  confirm: confirmSessionTestKeyAction,
  copy: copySessionTestKeyAction,
  copyLessonPages: copyLessonPagesAction,
  create: createSessionTestAction,
  prepareImage: (file) => prepareTestImage(file),
  registerAssets: registerSessionTestAssetsAction,
  registerLessonPages: registerLessonPagesAction,
  removeAsset: removeSessionTestAssetAction,
  removeLessonPage: removeLessonPageAction,
  reorderAssets: reorderSessionTestAssetsAction,
  requestExtraction: requestSessionTestKeyExtractionAction,
  saveDraft: saveSessionTestDraftAction,
  uploadPage: uploadPageFromBrowser,
};
