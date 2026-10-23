import "server-only";

import { z } from "zod";

import type { GradingDataResult } from "@/features/grading-submissions/data";
import { answerKeyFromStored, storedAnswerKeySchema } from "@/features/session-tests/answer-key";
import { SESSION_TEST_BUCKET } from "@/features/session-tests/storage";
import type { SessionTestAsset, SessionTestDetail, SessionTestLessonSource, SessionTestSource, SessionTestState } from "@/features/session-tests/types";
import { getAnthropicApiKey } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Signed photo links live 15 minutes; the card asks for fresh ones when a link expires. */
const SIGNED_URL_SECONDS = 15 * 60;

const runStatusSchema = z.enum(["queued", "running", "succeeded", "failed", "cancelled"]);

const pageSchema = z.object({
  height: z.number().int(),
  id: z.string().uuid(),
  mime_type: z.string(),
  page_no: z.number().int(),
  sha256: z.string(),
  storage_path: z.string(),
  width: z.number().int(),
});

const testSchema = z.object({
  answer_key: storedAnswerKeySchema,
  answer_key_version: z.number().int(),
  assets: z.array(pageSchema),
  class_session_id: z.string().uuid(),
  confirmed_at: z.string().nullable(),
  confirmed_by_name: z.string().nullable(),
  extraction: z
    .object({
      created_at: z.string(),
      error_code: z.string().nullable(),
      finished_at: z.string().nullable(),
      id: z.string().uuid(),
      outcome: z.string().nullable().optional(),
      status: runStatusSchema,
      warnings: z.array(z.string()).optional().catch([]),
    })
    .nullable(),
  id: z.string().uuid(),
  key_warnings: z
    .array(
      z.object({
        common_answer: z.string().nullable().catch(null),
        common_answer_count: z.number().int().nullable().catch(null),
        key_answer: z.string().nullable().catch(null),
        label: z.string(),
        papers: z.number().int(),
        wrong: z.number().int(),
      }),
    )
    .optional()
    .catch([]),
  lesson_pages: z.array(pageSchema).optional().catch([]),
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
  const lessonRows = row.lesson_pages ?? [];
  const urls = await signAssetUrls(supabase, [...row.assets, ...lessonRows].map((asset) => asset.storage_path));
  const toAsset = (asset: z.infer<typeof pageSchema>): SessionTestAsset => ({
    height: asset.height,
    id: asset.id,
    mimeType: asset.mime_type,
    pageNo: asset.page_no,
    sha256: asset.sha256,
    storagePath: asset.storage_path,
    url: urls.get(asset.storage_path) ?? null,
    width: asset.width,
  });
  return {
    data: {
      answerKey: answerKeyFromStored(row.answer_key),
      answerKeyVersion: row.answer_key_version,
      assets: row.assets.map(toAsset),
      classSessionId: row.class_session_id,
      confirmedAt: row.confirmed_at,
      confirmedByName: row.confirmed_by_name,
      extraction: row.extraction
        ? {
            createdAt: row.extraction.created_at,
            errorCode: row.extraction.error_code,
            finishedAt: row.extraction.finished_at,
            id: row.extraction.id,
            outcome: row.extraction.outcome ?? null,
            status: row.extraction.status,
            warnings: row.extraction.warnings ?? [],
          }
        : null,
      id: row.id,
      keyWarnings: (row.key_warnings ?? []).map((warning) => ({
        commonAnswer: warning.common_answer,
        commonAnswerCount: warning.common_answer_count,
        keyAnswer: warning.key_answer,
        label: warning.label,
        papers: warning.papers,
        wrong: warning.wrong,
      })),
      lessonPages: lessonRows.map(toAsset),
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

const lessonSourceSchema = z.object({
  class_code: z.string(),
  class_name: z.string(),
  class_session_id: z.string().uuid(),
  page_count: z.number().int(),
  session_date: z.string(),
  start_time: z.string(),
  test_id: z.string().uuid(),
});

async function loadLessonSources(supabase: ServerClient, sessionId: string): Promise<SessionTestLessonSource[]> {
  // Optional helper list: a failure only hides the "Dùng slide của buổi khác" choices.
  const { data, error } = await supabase.rpc("list_session_lesson_sources", { p_class_session_id: sessionId });
  if (error) return [];
  const parsed = z.array(lessonSourceSchema).safeParse(data ?? []);
  if (!parsed.success) return [];
  return parsed.data.map((row) => ({
    classCode: row.class_code,
    className: row.class_name,
    classSessionId: row.class_session_id,
    pageCount: row.page_count,
    sessionDate: row.session_date,
    startTime: row.start_time,
    testId: row.test_id,
  }));
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
    const [test, sources, lessonSources] = await Promise.all([
      loadTest(supabase, input.sessionId),
      canReuse ? loadSources(supabase, input.sessionId) : Promise.resolve({ data: [], ok: true as const }),
      input.canManage && input.editable ? loadLessonSources(supabase, input.sessionId) : Promise.resolve([]),
    ]);
    if (!test.ok) return test;
    if (!sources.ok) return sources;
    return {
      data: {
        aiConfigured: getAnthropicApiKey() !== null,
        canConfirm: input.canConfirm,
        canManage: input.canManage,
        editable: input.editable,
        lessonSources,
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
