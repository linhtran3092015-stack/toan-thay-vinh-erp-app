import {
  cancelSessionTestKeyExtractionAction,
  confirmSessionTestKeyAction,
  copySessionTestKeyAction,
  createSessionTestAction,
  registerSessionTestAssetsAction,
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
  create: typeof createSessionTestAction;
  /** Shrinks and re-encodes one photo in the browser. */
  prepareImage: (file: File) => Promise<PreparedTestImage>;
  registerAssets: typeof registerSessionTestAssetsAction;
  removeAsset: typeof removeSessionTestAssetAction;
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
  create: createSessionTestAction,
  prepareImage: (file) => prepareTestImage(file),
  registerAssets: registerSessionTestAssetsAction,
  removeAsset: removeSessionTestAssetAction,
  reorderAssets: reorderSessionTestAssetsAction,
  requestExtraction: requestSessionTestKeyExtractionAction,
  saveDraft: saveSessionTestDraftAction,
  uploadPage: uploadPageFromBrowser,
};
