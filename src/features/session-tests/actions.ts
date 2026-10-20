"use server";

import { z } from "zod";

import {
  ANSWER_KEY_LIMITS,
  answerKeyToStored,
  type AnswerKey,
} from "@/features/session-tests/answer-key";
import { AI_KEY_MISSING_MESSAGE } from "@/features/session-tests/status";
import { SESSION_TEST_BUCKET } from "@/features/session-tests/storage";
import { getAnthropicApiKey } from "@/lib/env";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedMessage } from "@/lib/permissions/labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

/**
 * "Bài kiểm tra" actions on the session page (AI grading phase 2). Each one checks the
 * permission here for a clear message, and the database checks it again.
 */

export type SessionTestActionResult = { message: string; ok: boolean };

export type CreateSessionTestResult = { message: string; ok: false } | { ok: true; testId: string };

export type RegisterAssetsResult =
  | { message: string; ok: false }
  | { added: number; message: string; ok: true; skipped: number };

export type ConfirmKeyResult = { message: string; ok: false } | { message: string; ok: true; version: number };

const MANAGE = "ai_grading.manage_tests";
const CONFIRM = "ai_grading.confirm_key";

async function requirePermissions(codes: string[]): Promise<string | null> {
  const permissions = await getDatabasePermissions();
  if (!permissions.ok) return "Không thể xác minh quyền. Vui lòng thử lại.";
  const missing = codes.find((code) => !permissions.permissions.includes(code as (typeof permissions.permissions)[number]));
  return missing ? permissionDeniedMessage(missing) : null;
}

const RPC_MESSAGES: Record<string, string> = {
  AI_GRADING_CONFIRM_KEY_PERMISSION_DENIED: permissionDeniedMessage(CONFIRM),
  AI_GRADING_MANAGE_TESTS_PERMISSION_DENIED: permissionDeniedMessage(MANAGE),
  AI_GRADING_VIEW_PERMISSION_DENIED: permissionDeniedMessage("ai_grading.view"),
  AUTHENTICATION_REQUIRED: "Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.",
  REASON_REQUIRED: "Nhập lý do sửa đáp án đã chốt.",
  REASON_TOO_LONG: `Lý do tối đa ${ANSWER_KEY_LIMITS.reasonLength} ký tự.`,
  SESSION_NOT_FOUND: "Không tìm thấy buổi học.",
  SESSION_TEST_ALREADY_CONFIRMED: "Đáp án đã được chốt. Tải lại trang để xem bản mới nhất.",
  SESSION_TEST_ASSET_NOT_FOUND: "Trang này đã bị bỏ. Tải lại trang.",
  SESSION_TEST_ASSET_OBJECT_MISSING: "Ảnh chưa tải lên xong. Vui lòng thử lại.",
  SESSION_TEST_ASSETS_INVALID: "Ảnh tải lên không hợp lệ. Vui lòng thử lại.",
  SESSION_TEST_EXTRACTION_ACTIVE: "Đề này đang chờ AI đọc.",
  SESSION_TEST_EXTRACTION_NOT_QUEUED: "Không còn lượt AI đọc đề nào đang chờ.",
  SESSION_TEST_KEY_EMPTY: "Đáp án chưa có câu nào.",
  SESSION_TEST_KEY_FINAL_ANSWER_MISSING: "Câu nào cũng cần đáp án cuối.",
  SESSION_TEST_KEY_INVALID: "Đáp án không hợp lệ. Kiểm tra lại các ô.",
  SESSION_TEST_KEY_LABEL_DUPLICATE: "Số câu bị trùng.",
  SESSION_TEST_KEY_LABEL_INVALID: `Câu nào cũng cần số câu (tối đa ${ANSWER_KEY_LIMITS.labelLength} ký tự).`,
  SESSION_TEST_KEY_POINTS_INVALID: "Điểm mỗi câu từ 0,25 đến 10, theo bước 0,25.",
  SESSION_TEST_KEY_POINTS_MISSING: "Câu nào cũng cần điểm.",
  SESSION_TEST_KEY_TEXT_TOO_LONG: "Có ô nhập quá dài. Rút gọn rồi lưu lại.",
  SESSION_TEST_KEY_TOO_MANY_QUESTIONS: `Mỗi đề tối đa ${ANSWER_KEY_LIMITS.questions} câu.`,
  SESSION_TEST_KEY_TOTAL_NOT_TEN: "Tổng điểm các câu phải bằng 10.",
  SESSION_TEST_KEY_UNCHANGED: "Đáp án không khác bản đang dùng.",
  SESSION_TEST_NO_PAGES: "Tải ít nhất một trang ảnh đề trước.",
  SESSION_TEST_NOT_FOUND: "Không tìm thấy đề của buổi này. Tải lại trang.",
  SESSION_TEST_PAGE_ORDER_INVALID: "Danh sách trang vừa thay đổi. Tải lại trang rồi sắp xếp lại.",
  SESSION_TEST_SESSION_CLOSED: "Buổi học đã khóa hoặc đã hủy nên không sửa đề được nữa.",
  SESSION_TEST_SOURCE_NOT_ELIGIBLE: "Chỉ dùng lại được đề của buổi cùng ngày, cùng khối.",
  SESSION_TEST_SOURCE_NOT_FOUND: "Đề này không còn ở trạng thái đã chốt. Tải lại trang.",
  SESSION_TEST_TOO_MANY_PAGES: "Mỗi đề tối đa 20 trang ảnh.",
  SESSION_TEST_VERSION_CONFLICT: "Đáp án vừa được người khác chốt hoặc sửa. Tải lại trang để xem bản mới nhất.",
};

function rpcErrorMessage(error: { message: string }): string {
  return RPC_MESSAGES[error.message.trim()] ?? "Không thể thực hiện thao tác. Vui lòng thử lại.";
}

const uuid = z.string().uuid();

const answerKeySchema = z.object({
  questions: z
    .array(
      z.object({
        acceptedEquivalents: z.array(z.string().max(ANSWER_KEY_LIMITS.equivalentLength)).max(ANSWER_KEY_LIMITS.equivalents),
        finalAnswer: z.string().max(ANSWER_KEY_LIMITS.finalAnswerLength),
        label: z.string().trim().min(1).max(ANSWER_KEY_LIMITS.labelLength),
        maxPoints: z.number().nullable(),
        promptText: z.string().max(ANSWER_KEY_LIMITS.promptLength),
        solutionSteps: z.array(z.string().max(ANSWER_KEY_LIMITS.stepLength)).max(ANSWER_KEY_LIMITS.steps),
      }),
    )
    .max(ANSWER_KEY_LIMITS.questions),
});

const keyContentSchema = z.object({
  answerKey: answerKeySchema,
  markingGuide: z.string().max(ANSWER_KEY_LIMITS.markingGuideLength).nullish(),
  testId: uuid,
  title: z.string().max(ANSWER_KEY_LIMITS.titleLength).nullish(),
});

function storedKey(key: AnswerKey): Json {
  return answerKeyToStored(key) as unknown as Json;
}

/** Creates the draft test of a session (before its first photo). Returns the existing one if any. */
export async function createSessionTestAction(input: { sessionId: string }): Promise<CreateSessionTestResult> {
  const denied = await requirePermissions([MANAGE]);
  if (denied) return { message: denied, ok: false };
  const parsed = z.object({ sessionId: uuid }).safeParse(input);
  if (!parsed.success) return { message: "Buổi học không hợp lệ.", ok: false };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_session_test", { p_class_session_id: parsed.data.sessionId });
  if (error || typeof data !== "string") return { message: error ? rpcErrorMessage(error) : "Không tạo được đề.", ok: false };
  return { ok: true, testId: data };
}

const pathPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif)$/;

/**
 * Records photos the browser already uploaded to Storage as the last pages of the test. A photo
 * that duplicates an existing page is not added and its upload is deleted again.
 */
export async function registerSessionTestAssetsAction(input: {
  assets: Array<{ height: number; mimeType: string; sha256: string; storagePath: string; width: number }>;
  testId: string;
}): Promise<RegisterAssetsResult> {
  const denied = await requirePermissions([MANAGE]);
  if (denied) return { message: denied, ok: false };
  const parsed = z
    .object({
      assets: z
        .array(
          z.object({
            height: z.number().int().min(1).max(10000),
            mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
            sha256: z.string().regex(/^[0-9a-f]{64}$/),
            storagePath: z.string().regex(pathPattern),
            width: z.number().int().min(1).max(10000),
          }),
        )
        .min(1)
        .max(20),
      testId: uuid,
    })
    .safeParse(input);
  if (!parsed.success || parsed.data.assets.some((asset) => !asset.storagePath.startsWith(`${parsed.data.testId}/`))) {
    return { message: "Ảnh tải lên không hợp lệ. Vui lòng thử lại.", ok: false };
  }

  const supabase = await createSupabaseServerClient();
  const paths = parsed.data.assets.map((asset) => asset.storagePath);
  const { data, error } = await supabase.rpc("add_session_test_assets", {
    p_assets: parsed.data.assets.map((asset) => ({
      height: asset.height,
      mime_type: asset.mimeType,
      sha256: asset.sha256,
      storage_path: asset.storagePath,
      width: asset.width,
    })) as unknown as Json,
    p_test_id: parsed.data.testId,
  });
  if (error) {
    // Nothing was recorded; the uploads are orphans (Storage only deletes unreferenced photos).
    await supabase.storage.from(SESSION_TEST_BUCKET).remove(paths);
    return { message: rpcErrorMessage(error), ok: false };
  }

  const rows = data ?? [];
  const added = rows.filter((row) => row.added).length;
  const orphaned = paths.filter((path) => !rows.some((row) => row.added && row.storage_path === path));
  if (orphaned.length > 0) await supabase.storage.from(SESSION_TEST_BUCKET).remove(orphaned);
  const skipped = paths.length - added;
  return {
    added,
    message:
      added === 0
        ? "Ảnh đã có trong đề, không thêm trang mới."
        : `Đã thêm ${added} trang ảnh đề.${skipped > 0 ? ` ${skipped} ảnh trùng trang đã có nên bỏ qua.` : ""}`,
    ok: true,
    skipped,
  };
}

/** Removes a page; the photo is deleted from Storage unless a reused test still shows it. */
export async function removeSessionTestAssetAction(input: { assetId: string }): Promise<SessionTestActionResult> {
  const denied = await requirePermissions([MANAGE]);
  if (denied) return { message: denied, ok: false };
  const parsed = z.object({ assetId: uuid }).safeParse(input);
  if (!parsed.success) return { message: "Trang không hợp lệ.", ok: false };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("remove_session_test_asset", { p_asset_id: parsed.data.assetId });
  if (error) return { message: rpcErrorMessage(error), ok: false };
  const removed = data?.[0];
  if (removed && !removed.still_referenced) {
    await supabase.storage.from(SESSION_TEST_BUCKET).remove([removed.storage_path]);
  }
  return { message: "Đã bỏ trang ảnh.", ok: true };
}

export async function reorderSessionTestAssetsAction(input: { assetIds: string[]; testId: string }): Promise<SessionTestActionResult> {
  const denied = await requirePermissions([MANAGE]);
  if (denied) return { message: denied, ok: false };
  const parsed = z.object({ assetIds: z.array(uuid).min(1).max(20), testId: uuid }).safeParse(input);
  if (!parsed.success) return { message: "Thứ tự trang không hợp lệ.", ok: false };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reorder_session_test_assets", {
    p_asset_ids: parsed.data.assetIds,
    p_test_id: parsed.data.testId,
  });
  if (error) return { message: rpcErrorMessage(error), ok: false };
  return { message: "Đã đổi thứ tự trang.", ok: true };
}

export async function saveSessionTestDraftAction(input: {
  answerKey: AnswerKey;
  markingGuide?: string | null;
  testId: string;
  title?: string | null;
}): Promise<SessionTestActionResult> {
  const denied = await requirePermissions([MANAGE]);
  if (denied) return { message: denied, ok: false };
  const parsed = keyContentSchema.safeParse(input);
  if (!parsed.success) return { message: "Đáp án không hợp lệ. Kiểm tra lại các ô.", ok: false };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_session_test_draft", {
    p_answer_key: storedKey(parsed.data.answerKey),
    p_marking_guide: parsed.data.markingGuide ?? "",
    p_test_id: parsed.data.testId,
    p_title: parsed.data.title ?? "",
  });
  if (error) return { message: rpcErrorMessage(error), ok: false };
  return { message: "Đã lưu nháp đáp án. Đáp án chưa dùng để chấm cho tới khi được chốt.", ok: true };
}

/**
 * Confirms the key. expectedVersion is the version the user was editing (0 before the first
 * confirmation); editing a confirmed key needs a reason and creates the next version.
 */
export async function confirmSessionTestKeyAction(input: {
  answerKey: AnswerKey;
  expectedVersion: number;
  markingGuide?: string | null;
  reason?: string | null;
  testId: string;
  title?: string | null;
}): Promise<ConfirmKeyResult> {
  const denied = await requirePermissions([CONFIRM]);
  if (denied) return { message: denied, ok: false };
  const parsed = keyContentSchema
    .extend({
      expectedVersion: z.number().int().min(0),
      reason: z.string().trim().max(ANSWER_KEY_LIMITS.reasonLength).nullish(),
    })
    .safeParse(input);
  if (!parsed.success) return { message: "Đáp án không hợp lệ. Kiểm tra lại các ô.", ok: false };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("confirm_session_test_key", {
    p_answer_key: storedKey(parsed.data.answerKey),
    p_expected_version: parsed.data.expectedVersion,
    p_marking_guide: parsed.data.markingGuide ?? "",
    p_reason: parsed.data.reason || undefined,
    p_test_id: parsed.data.testId,
    p_title: parsed.data.title ?? "",
  });
  if (error) return { message: rpcErrorMessage(error), ok: false };
  const version = data?.[0]?.answer_key_version ?? parsed.data.expectedVersion + 1;
  return {
    message:
      version > 1
        ? `Đã lưu đáp án phiên bản ${version}. Bài đã chấm theo bản cũ sẽ được báo để chấm lại.`
        : "Đã chốt đáp án. AI sẽ chấm bài theo đáp án này.",
    ok: true,
    version,
  };
}

/** "Dùng đề có sẵn": copies a confirmed key of the same date and grade and confirms it here. */
export async function copySessionTestKeyAction(input: {
  expectedVersion: number;
  reason?: string | null;
  sessionId: string;
  sourceTestId: string;
}): Promise<SessionTestActionResult> {
  const denied = await requirePermissions([MANAGE, CONFIRM]);
  if (denied) return { message: denied, ok: false };
  const parsed = z
    .object({
      expectedVersion: z.number().int().min(0),
      reason: z.string().trim().max(ANSWER_KEY_LIMITS.reasonLength).nullish(),
      sessionId: uuid,
      sourceTestId: uuid,
    })
    .safeParse(input);
  if (!parsed.success) return { message: `Lý do tối đa ${ANSWER_KEY_LIMITS.reasonLength} ký tự.`, ok: false };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("copy_session_test_key", {
    p_class_session_id: parsed.data.sessionId,
    p_expected_version: parsed.data.expectedVersion,
    p_reason: parsed.data.reason || undefined,
    p_source_test_id: parsed.data.sourceTestId,
  });
  if (error) return { message: rpcErrorMessage(error), ok: false };
  const copiedPages = data?.[0]?.copied_pages ?? 0;
  return {
    message: `Đã dùng đề có sẵn và chốt đáp án cho buổi này.${copiedPages > 0 ? ` Đã kèm ${copiedPages} trang ảnh đề.` : ""}`,
    ok: true,
  };
}

/**
 * "AI đọc đề": queues an extract_key run (Claude Opus 5.5, effort high). Refused while
 * ANTHROPIC_API_KEY is not configured; the background worker that runs it comes in phase 3.
 */
export async function requestSessionTestKeyExtractionAction(input: { testId: string }): Promise<SessionTestActionResult> {
  const denied = await requirePermissions([MANAGE]);
  if (denied) return { message: denied, ok: false };
  if (getAnthropicApiKey() === null) return { message: AI_KEY_MISSING_MESSAGE, ok: false };
  const parsed = z.object({ testId: uuid }).safeParse(input);
  if (!parsed.success) return { message: "Đề không hợp lệ.", ok: false };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("request_session_test_key_extraction", { p_test_id: parsed.data.testId });
  if (error) return { message: rpcErrorMessage(error), ok: false };
  return { message: "Đã xếp lượt AI đọc đề. Đáp án đề xuất sẽ hiện ở đây để trợ giảng kiểm tra và chốt.", ok: true };
}

export async function cancelSessionTestKeyExtractionAction(input: { testId: string }): Promise<SessionTestActionResult> {
  const denied = await requirePermissions([MANAGE]);
  if (denied) return { message: denied, ok: false };
  const parsed = z.object({ testId: uuid }).safeParse(input);
  if (!parsed.success) return { message: "Đề không hợp lệ.", ok: false };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_session_test_key_extraction", { p_test_id: parsed.data.testId });
  if (error) return { message: rpcErrorMessage(error), ok: false };
  return { message: "Đã hủy lượt AI đọc đề.", ok: true };
}
