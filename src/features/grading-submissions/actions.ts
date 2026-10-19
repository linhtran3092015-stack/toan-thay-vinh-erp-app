"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUnmatchedGradingSubmissions } from "@/features/grading-submissions/data";
import {
  matchCandidateRowSchema,
  planGradingRematch,
  rematchSummaryMessage,
  summarizeRematch,
  toMatchCandidates,
  type MatchCandidateStudent,
  type RematchDecision,
  type RematchSummary,
} from "@/features/grading-submissions/review";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedMessage } from "@/lib/permissions/labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

/**
 * Actions on "Bài nộp chưa ghép". All of them reuse ai_grading.view: the four roles that see the
 * queue (owner, both managers, TAs) are the ones who clear it. The database checks it again.
 */

export type GradingReviewActionResult = { message: string; ok: boolean };

export type GradingMatchCandidatesResult =
  | { message: string; ok: false }
  | { ok: true; students: MatchCandidateStudent[] };

export type GradingRematchResult =
  | { message: string; ok: false }
  | { message: string; ok: true; summary: RematchSummary };

const PAGE_PATH = "/grading-submissions";
/** Same window as the page: the 200 most recent unmatched submissions. */
const REMATCH_LIMIT = 200;
const REMATCH_CONCURRENCY = 4;

async function requireReviewPermission(): Promise<string | null> {
  const permissions = await getDatabasePermissions();
  if (!permissions.ok) return "Không thể xác minh quyền. Vui lòng thử lại.";
  if (!permissions.permissions.includes("ai_grading.view")) return permissionDeniedMessage("ai_grading.view");
  return null;
}

function rpcErrorMessage(error: { message: string }): string {
  const known: Record<string, string> = {
    AI_GRADING_VIEW_PERMISSION_DENIED: permissionDeniedMessage("ai_grading.view"),
    AUTHENTICATION_REQUIRED: "Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.",
    GRADING_MATCH_QUERY_INVALID: "Từ khóa tìm kiếm tối đa 100 ký tự.",
    GRADING_MATCH_TARGET_REQUIRED: "Chọn học sinh và buổi học.",
    GRADING_REMATCH_DECISIONS_INVALID: "Không ghép lại được. Vui lòng thử lại.",
    GRADING_SESSION_NOT_ELIGIBLE:
      "Học sinh không có trong buổi này (theo danh sách lớp hoặc điểm danh) vào ngày nộp. Nếu em học bù hoặc học thêm, điểm danh em vào buổi đó trước.",
    GRADING_SUBMISSION_NOT_FOUND: "Không tìm thấy bài nộp. Tải lại trang.",
    GRADING_SUBMISSION_NOT_IGNORED: "Bài này không còn ở danh sách đã bỏ qua. Tải lại trang để xem danh sách mới.",
    GRADING_SUBMISSION_NOT_PENDING: "Bài này đã được ghép hoặc bỏ qua. Tải lại trang để xem danh sách mới.",
    REASON_REQUIRED: "Vui lòng nhập lý do bỏ qua.",
    REASON_TOO_LONG: "Ghi chú tối đa 500 ký tự.",
    STUDENT_NOT_FOUND: "Không tìm thấy học sinh.",
  };
  for (const [code, text] of Object.entries(known)) if (error.message.includes(code)) return text;
  return "Không thể thực hiện thao tác. Vui lòng thử lại.";
}

const submissionIdSchema = z.string().uuid();

async function loadCandidates(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  submissionId: string,
  query: string | null,
): Promise<GradingMatchCandidatesResult> {
  const { data, error } = await supabase.rpc("list_grading_match_candidates", {
    p_limit: query ? 30 : 300,
    p_query: query ?? undefined,
    p_submission_id: submissionId,
  });
  if (error) return { message: rpcErrorMessage(error), ok: false };
  const parsed = z.array(matchCandidateRowSchema).safeParse(data ?? []);
  if (!parsed.success) return { message: "Dữ liệu học sinh không hợp lệ.", ok: false };
  return { ok: true, students: toMatchCandidates(parsed.data) };
}

/**
 * Students to match one submission with, each with their sessions on the submission's Vietnam
 * date. No query: the claimed birth year (plus the student with the claimed code). A query
 * searches by name, nickname or code among students enrolled or scheduled that day.
 */
export async function loadGradingMatchCandidatesAction(input: {
  query?: string | null;
  submissionId: string;
}): Promise<GradingMatchCandidatesResult> {
  const denied = await requireReviewPermission();
  if (denied) return { message: denied, ok: false };
  const parsed = z
    .object({ query: z.string().trim().max(100).nullish(), submissionId: submissionIdSchema })
    .safeParse(input);
  if (!parsed.success) return { message: "Từ khóa tìm kiếm tối đa 100 ký tự.", ok: false };
  const query = parsed.data.query || null;
  if (query && query.length < 2) return { message: "Nhập ít nhất 2 ký tự để tìm học sinh.", ok: false };

  try {
    const supabase = await createSupabaseServerClient();
    return await loadCandidates(supabase, parsed.data.submissionId, query);
  } catch {
    return { message: "Không tải được danh sách học sinh. Vui lòng thử lại.", ok: false };
  }
}

export async function matchGradingSubmissionAction(input: {
  classSessionId: string;
  reason?: string | null;
  studentId: string;
  submissionId: string;
}): Promise<GradingReviewActionResult> {
  const denied = await requireReviewPermission();
  if (denied) return { message: denied, ok: false };
  const parsed = z
    .object({
      classSessionId: z.string().uuid(),
      reason: z.string().trim().max(500).nullish(),
      studentId: z.string().uuid(),
      submissionId: submissionIdSchema,
    })
    .safeParse(input);
  if (!parsed.success) return { message: "Chọn học sinh và buổi học (ghi chú tối đa 500 ký tự).", ok: false };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("match_grading_submission", {
    p_class_session_id: parsed.data.classSessionId,
    p_reason: parsed.data.reason || undefined,
    p_student_id: parsed.data.studentId,
    p_submission_id: parsed.data.submissionId,
  });
  if (error) return { message: rpcErrorMessage(error), ok: false };

  revalidatePath(PAGE_PATH);
  revalidatePath(`/sessions/${parsed.data.classSessionId}`);
  const attempt = Array.isArray(data) ? data[0] : null;
  const attemptNote = attempt && attempt.attempt_no > 1 ? ` Đây là lần nộp ${attempt.attempt_no}${attempt.counts_for_score ? ", lần này được tính" : ", lần nộp sau mới được tính"}.` : "";
  return { message: `Đã ghép bài vào buổi học.${attemptNote}`, ok: true };
}

export async function ignoreGradingSubmissionAction(input: { reason: string; submissionId: string }): Promise<GradingReviewActionResult> {
  const denied = await requireReviewPermission();
  if (denied) return { message: denied, ok: false };
  const parsed = z.object({ reason: z.string().trim().min(2).max(500), submissionId: submissionIdSchema }).safeParse(input);
  if (!parsed.success) return { message: "Vui lòng nhập lý do bỏ qua (2–500 ký tự).", ok: false };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("ignore_grading_submission", {
    p_reason: parsed.data.reason,
    p_submission_id: parsed.data.submissionId,
  });
  if (error) return { message: rpcErrorMessage(error), ok: false };

  revalidatePath(PAGE_PATH);
  return { message: "Đã bỏ qua bài (bài rác).", ok: true };
}

/** Undoes "Bỏ qua (bài rác)": the submission goes back to the review queue as it was. */
export async function restoreGradingSubmissionAction(input: { reason?: string | null; submissionId: string }): Promise<GradingReviewActionResult> {
  const denied = await requireReviewPermission();
  if (denied) return { message: denied, ok: false };
  const parsed = z.object({ reason: z.string().trim().max(500).nullish(), submissionId: submissionIdSchema }).safeParse(input);
  if (!parsed.success) return { message: "Ghi chú tối đa 500 ký tự.", ok: false };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("restore_grading_submission", {
    p_reason: parsed.data.reason || undefined,
    p_submission_id: parsed.data.submissionId,
  });
  if (error) return { message: rpcErrorMessage(error), ok: false };

  revalidatePath(PAGE_PATH);
  return { message: "Đã khôi phục bài về danh sách chờ ghép.", ok: true };
}

/**
 * "Ghép lại tự động": re-runs the webhook's matcher over the unmatched submissions with today's
 * data (students created or sessions scheduled after the submission arrived). The database
 * re-checks every result before writing it; anything still uncertain stays for review.
 */
export async function rematchGradingSubmissionsAction(): Promise<GradingRematchResult> {
  const denied = await requireReviewPermission();
  if (denied) return { message: denied, ok: false };

  const pending = await getUnmatchedGradingSubmissions(REMATCH_LIMIT);
  if (!pending.ok) return { message: pending.error, ok: false };
  if (pending.data.length === 0) {
    const summary = summarizeRematch([], 0, 0);
    return { message: rematchSummaryMessage(summary), ok: true, summary };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const decisions: RematchDecision[] = [];
    let failed = 0;
    const queue = [...pending.data];
    const workers = Array.from({ length: Math.min(REMATCH_CONCURRENCY, queue.length) }, async () => {
      for (let submission = queue.shift(); submission; submission = queue.shift()) {
        const candidates = await loadCandidates(supabase, submission.id, null);
        if (!candidates.ok) {
          failed += 1;
          continue;
        }
        decisions.push(planGradingRematch(submission, candidates.students).decision);
      }
    });
    await Promise.all(workers);

    if (decisions.length === 0) {
      return { message: "Không tải được danh sách học sinh để ghép lại. Vui lòng thử lại.", ok: false };
    }

    const { data, error } = await supabase.rpc("rematch_grading_submissions", { p_decisions: decisions as unknown as Json });
    if (error) return { message: rpcErrorMessage(error), ok: false };
    const rows = z
      .array(z.object({ outcome: z.string(), submission_id: z.string().uuid() }))
      .safeParse(data ?? []);
    if (!rows.success) return { message: "Không đọc được kết quả ghép lại. Tải lại trang.", ok: false };

    const summary = summarizeRematch(rows.data.map((row) => row.outcome), pending.data.length, failed);
    if (summary.matched > 0 || summary.updated > 0) {
      revalidatePath(PAGE_PATH);
      const matchedIds = new Set(rows.data.filter((row) => row.outcome === "matched").map((row) => row.submission_id));
      for (const decision of decisions) {
        if (decision.class_session_id && matchedIds.has(decision.submission_id)) revalidatePath(`/sessions/${decision.class_session_id}`);
      }
    }
    return { message: rematchSummaryMessage(summary), ok: true, summary };
  } catch {
    return { message: "Không ghép lại được. Vui lòng thử lại.", ok: false };
  }
}
