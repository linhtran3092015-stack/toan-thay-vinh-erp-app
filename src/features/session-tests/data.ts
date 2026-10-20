import "server-only";

import { z } from "zod";

import type { GradingDataResult } from "@/features/grading-submissions/data";
import { answerKeyFromStored, storedAnswerKeySchema } from "@/features/session-tests/answer-key";
import { SESSION_TEST_BUCKET } from "@/features/session-tests/storage";
import type { SessionTestDetail, SessionTestSource, SessionTestState } from "@/features/session-tests/types";
import { getAnthropicApiKey } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Signed photo links live 15 minutes; the card asks for fresh ones when a link expires. */
const SIGNED_URL_SECONDS = 15 * 60;

const runStatusSchema = z.enum(["queued", "running", "succeeded", "failed", "cancelled"]);

const testSchema = z.object({
  answer_key: storedAnswerKeySchema,
  answer_key_version: z.number().int(),
  assets: z.array(
    z.object({
      height: z.number().int(),
      id: z.string().uuid(),
      mime_type: z.string(),
      page_no: z.number().int(),
      sha256: z.string(),
      storage_path: z.string(),
      width: z.number().int(),
    }),
  ),
  class_session_id: z.string().uuid(),
  confirmed_at: z.string().nullable(),
  confirmed_by_name: z.string().nullable(),
  extraction: z
    .object({
      created_at: z.string(),
      error_code: z.string().nullable(),
      finished_at: z.string().nullable(),
      id: z.string().uuid(),
      status: runStatusSchema,
    })
    .nullable(),
  id: z.string().uuid(),
  marking_guide: z.string().nullable(),
  source: z
    .object({
      class_code: z.string(),
      class_session_id: z.string().uuid(),
      start_time: z.string(),
      test_id: z.string().uuid(),
    })
    .nullable(),
  status: z.enum(["draft", "key_review", "key_confirmed"]),
  title: z.string().nullable(),
  updated_at: z.string(),
});

const sourceRowSchema = z.object({
  answer_key: storedAnswerKeySchema,
  answer_key_version: z.number().int(),
  class_code: z.string(),
  class_name: z.string(),
  class_session_id: z.string().uuid(),
  confirmed_at: z.string().nullable(),
  confirmed_by_name: z.string().nullable(),
  end_time: z.string(),
  marking_guide: z.string().nullable(),
  page_count: z.number().int(),
  start_time: z.string(),
  test_id: z.string().uuid(),
  title: z.string().nullable(),
});

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function signAssetUrls(supabase: ServerClient, paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  try {
    const { data, error } = await supabase.storage.from(SESSION_TEST_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (error || !data) return new Map();
    return new Map(data.flatMap((entry) => (entry.path && entry.signedUrl ? [[entry.path, entry.signedUrl] as const] : [])));
  } catch {
    return new Map();
  }
}

async function loadTest(supabase: ServerClient, sessionId: string): Promise<GradingDataResult<SessionTestDetail | null>> {
  const { data, error } = await supabase.rpc("get_session_test", { p_class_session_id: sessionId });
  if (error) return { error: "Không tải được đề kiểm tra của buổi học.", ok: false };
  if (data === null) return { data: null, ok: true };
  const parsed = testSchema.safeParse(data);
  if (!parsed.success) return { error: "Dữ liệu đề kiểm tra không hợp lệ.", ok: false };
  const row = parsed.data;
  const urls = await signAssetUrls(supabase, row.assets.map((asset) => asset.storage_path));
  return {
    data: {
      answerKey: answerKeyFromStored(row.answer_key),
      answerKeyVersion: row.answer_key_version,
      assets: row.assets.map((asset) => ({
        height: asset.height,
        id: asset.id,
        mimeType: asset.mime_type,
        pageNo: asset.page_no,
        sha256: asset.sha256,
        storagePath: asset.storage_path,
        url: urls.get(asset.storage_path) ?? null,
        width: asset.width,
      })),
      classSessionId: row.class_session_id,
      confirmedAt: row.confirmed_at,
      confirmedByName: row.confirmed_by_name,
      extraction: row.extraction
        ? {
            createdAt: row.extraction.created_at,
            errorCode: row.extraction.error_code,
            finishedAt: row.extraction.finished_at,
            id: row.extraction.id,
            status: row.extraction.status,
          }
        : null,
      id: row.id,
      markingGuide: row.marking_guide,
      source: row.source
        ? {
            classCode: row.source.class_code,
            classSessionId: row.source.class_session_id,
            startTime: row.source.start_time,
            testId: row.source.test_id,
          }
        : null,
      status: row.status,
      title: row.title,
      updatedAt: row.updated_at,
    },
    ok: true,
  };
}

async function loadSources(supabase: ServerClient, sessionId: string): Promise<GradingDataResult<SessionTestSource[]>> {
  const { data, error } = await supabase.rpc("list_session_test_sources", { p_class_session_id: sessionId });
  if (error) return { error: "Không tải được đề có sẵn cùng ngày.", ok: false };
  const parsed = z.array(sourceRowSchema).safeParse(data ?? []);
  if (!parsed.success) return { error: "Dữ liệu đề có sẵn không hợp lệ.", ok: false };
  return {
    data: parsed.data.map((row) => ({
      answerKey: answerKeyFromStored(row.answer_key),
      answerKeyVersion: row.answer_key_version,
      classCode: row.class_code,
      className: row.class_name,
      classSessionId: row.class_session_id,
      confirmedAt: row.confirmed_at,
      confirmedByName: row.confirmed_by_name,
      endTime: row.end_time,
      markingGuide: row.marking_guide,
      pageCount: row.page_count,
      startTime: row.start_time,
      testId: row.test_id,
      title: row.title,
    })),
    ok: true,
  };
}

/**
 * Everything the "Bài kiểm tra" card needs: the test (or null), signed photo links, the
 * confirmed tests of the same date and grade it could reuse, and whether the AI key exists.
 */
export async function getSessionTestState(input: {
  canConfirm: boolean;
  canManage: boolean;
  editable: boolean;
  sessionId: string;
}): Promise<GradingDataResult<SessionTestState>> {
  try {
    const supabase = await createSupabaseServerClient();
    const canReuse = input.canManage && input.canConfirm && input.editable;
    const [test, sources] = await Promise.all([
      loadTest(supabase, input.sessionId),
      canReuse ? loadSources(supabase, input.sessionId) : Promise.resolve({ data: [], ok: true as const }),
    ]);
    if (!test.ok) return test;
    if (!sources.ok) return sources;
    return {
      data: {
        aiConfigured: getAnthropicApiKey() !== null,
        canConfirm: input.canConfirm,
        canManage: input.canManage,
        editable: input.editable,
        sessionId: input.sessionId,
        sources: sources.data,
        test: test.data,
      },
      ok: true,
    };
  } catch {
    return { error: "Không tải được đề kiểm tra của buổi học.", ok: false };
  }
}
