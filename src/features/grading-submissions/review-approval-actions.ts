"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { kickGradingWorker } from "@/features/ai-grading/kick";
import { getGradingCommentPhrases } from "@/features/ai-grading/phrases-data";
import { draftComment, initialVerdicts } from "@/features/ai-grading/review-draft";
import { getSessionGradingSubmissions } from "@/features/grading-submissions/data";
import { answerKeyFromStored, storedAnswerKeySchema } from "@/features/session-tests/answer-key";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedMessage } from "@/lib/permissions/labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Phase 3b: approve an AI-graded submission into the session result, tick "Tích cực tương tác",
 * ask the AI to grade again, skip a paper (grade it by hand), and approve every green paper of a
 * session at once. The database recomputes the score and checks every rule again.
 */

export type ReviewActionResult = { message: string; ok: boolean };
export type BulkApproveResult = { approved: number; failed: number; message: string; ok: boolean; skipped: number };

const verdict = z.enum(["correct", "incorrect", "missing"]);
const uuid = z.string().uuid();
const PRESENT = new Set(["present", "additional_study"]);

async function requireReview(withResults: boolean): Promise<string | null> {
  const permissions = await getDatabasePermissions();
  if (!permissions.ok) return "Không thể xác minh quyền. Vui lòng thử lại.";
  if (!permissions.permissions.includes("ai_grading.review")) return permissionDeniedMessage("ai_grading.review");
  if (withResults && !permissions.permissions.includes("results.manage")) return permissionDeniedMessage("results.manage");
  return null;
}

function rpcErrorMessage(error: { message: string }): string {
  const known: Record<string, string> = {
    ABSENT_STUDENT_CANNOT_HAVE_SESSION_RESULT: "Em đang bị điểm danh vắng. Sửa điểm danh (có mặt hoặc học thêm) rồi duyệt lại.",
    AI_GRADING_REVIEW_PERMISSION_DENIED: permissionDeniedMessage("ai_grading.review"),
    AUTHENTICATION_REQUIRED: "Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.",
    CLASS_SESSION_IS_CANCELLED: "Buổi học đã hủy.",
    CLASS_SESSION_IS_LOCKED: "Buổi học đã khóa, không ghi điểm được nữa.",
    GRADING_FEEDBACK_INVALID: "Nhận xét không được để trống và tối đa 1.200 ký tự.",
    GRADING_KEY_NOT_CONFIRMED: "Đề của buổi chưa chốt đáp án.",
    GRADING_KEY_VERSION_CHANGED: "Đáp án vừa được sửa. Tải lại trang để duyệt theo đáp án mới.",
    GRADING_REASON_TOO_LONG: "Lý do tối đa 500 ký tự.",
    GRADING_SKIP_REASON_REQUIRED: "Nhập lý do bỏ qua (tối đa 500 ký tự).",
    GRADING_SUBMISSION_ALREADY_APPROVED: "Bài đã được duyệt. Tải lại trang.",
    GRADING_SUBMISSION_NOT_CURRENT: "Bài này không còn là lần nộp được tính. Tải lại trang.",
    GRADING_SUBMISSION_NOT_FOUND: "Không tìm thấy bài nộp. Tải lại trang.",
    GRADING_VERDICTS_INVALID: "Thiếu kết quả của một số câu. Tải lại trang rồi thử lại.",
    RESULTS_MANAGE_PERMISSION_DENIED: permissionDeniedMessage("results.manage"),
    RESULT_REQUIRES_STARTED_SESSION: "Buổi học chưa bắt đầu, chưa ghi kết quả được.",
    SESSION_ATTENDANCE_NOT_FOUND: "Em chưa được điểm danh ở buổi này. Điểm danh trước rồi duyệt.",
  };
  for (const [code, text] of Object.entries(known)) if (error.message.includes(code)) return text;
  return "Không thể thực hiện thao tác. Vui lòng thử lại.";
}

const approveSchema = z.object({
  expectedKeyVersion: z.number().int().min(1),
  feedbackText: z.string().trim().min(1, "Nhận xét không được để trống.").max(1200, "Nhận xét tối đa 1.200 ký tự."),
  praiseBonus: z.boolean(),
  reason: z.string().trim().max(500, "Lý do tối đa 500 ký tự.").nullish(),
  sessionId: uuid,
  submissionId: uuid,
  verdicts: z.record(z.string(), verdict),
});

export async function approveGradingSubmissionAction(input: z.input<typeof approveSchema>): Promise<ReviewActionResult> {
  const denied = await requireReview(true);
  if (denied) return { message: denied, ok: false };
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Dữ liệu duyệt không hợp lệ.", ok: false };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("approve_grading_submission", {
    p_expected_key_version: parsed.data.expectedKeyVersion,
    p_feedback_text: parsed.data.feedbackText,
    p_praise_bonus: parsed.data.praiseBonus,
    p_reason: parsed.data.reason || undefined,
    p_submission_id: parsed.data.submissionId,
    p_verdicts: parsed.data.verdicts,
  });
  if (error) return { message: rpcErrorMessage(error), ok: false };
  revalidatePath(`/sessions/${parsed.data.sessionId}`);
  const row = Array.isArray(data) ? data[0] : null;
  return {
    message: row ? `Đã duyệt: điểm ${row.final_score}${row.final_score !== row.paper_score ? ` (bài làm ${row.paper_score}, đã cộng 1)` : ""}, ${row.rank_label}.` : "Đã duyệt.",
    ok: true,
  };
}

export async function setPraiseBonusAction(input: { praise: boolean; sessionId: string; submissionId: string }): Promise<ReviewActionResult> {
  const denied = await requireReview(false);
  if (denied) return { message: denied, ok: false };
  const parsed = z.object({ praise: z.boolean(), sessionId: uuid, submissionId: uuid }).safeParse(input);
  if (!parsed.success) return { message: "Bài nộp không hợp lệ.", ok: false };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_grading_praise_bonus", { p_praise: parsed.data.praise, p_submission_id: parsed.data.submissionId });
  if (error) return { message: rpcErrorMessage(error), ok: false };
  revalidatePath(`/sessions/${parsed.data.sessionId}`);
  return { message: parsed.data.praise ? "Đã tick tích cực tương tác (+1)." : "Đã bỏ tick tích cực tương tác.", ok: true };
}

export async function regradeGradingSubmissionAction(input: { sessionId: string; submissionId: string }): Promise<ReviewActionResult> {
  const denied = await requireReview(false);
  if (denied) return { message: denied, ok: false };
  const parsed = z.object({ sessionId: uuid, submissionId: uuid }).safeParse(input);
  if (!parsed.success) return { message: "Bài nộp không hợp lệ.", ok: false };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("regrade_grading_submission", { p_submission_id: parsed.data.submissionId });
  if (error) return { message: rpcErrorMessage(error), ok: false };
  kickGradingWorker("regrade");
  revalidatePath(`/sessions/${parsed.data.sessionId}`);
  return { message: "Đã xếp lượt AI chấm lại. Kết quả buổi đã ghi giữ nguyên cho tới khi duyệt lại.", ok: true };
}

export async function skipGradingSubmissionAction(input: { reason: string; sessionId: string; submissionId: string }): Promise<ReviewActionResult> {
  const denied = await requireReview(false);
  if (denied) return { message: denied, ok: false };
  const parsed = z
    .object({ reason: z.string().trim().min(1, "Nhập lý do bỏ qua.").max(500, "Lý do tối đa 500 ký tự."), sessionId: uuid, submissionId: uuid })
    .safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.", ok: false };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("skip_grading_submission", { p_reason: parsed.data.reason, p_submission_id: parsed.data.submissionId });
  if (error) return { message: rpcErrorMessage(error), ok: false };
  revalidatePath(`/sessions/${parsed.data.sessionId}`);
  return { message: "Đã bỏ qua bài này; trợ giảng chấm tay ở phần kết quả bên dưới.", ok: true };
}

/**
 * "Duyệt các bài xanh": every counted green paper of the session, graded on the current key, not
 * reviewed yet, whose student is marked present. Uses the AI verdicts, the ticked bonus and the
 * phrase-library draft comment. Papers with a hand-entered score are left for one-by-one review.
 */
export async function approveGreenSubmissionsAction(input: { sessionId: string }): Promise<BulkApproveResult> {
  const empty = { approved: 0, failed: 0, skipped: 0 };
  const denied = await requireReview(true);
  if (denied) return { ...empty, message: denied, ok: false };
  const parsedInput = z.object({ sessionId: uuid }).safeParse(input);
  if (!parsedInput.success) return { ...empty, message: "Buổi học không hợp lệ.", ok: false };
  const sessionId = parsedInput.data.sessionId;

  const supabase = await createSupabaseServerClient();
  const [{ data: test, error: testError }, submissions, phrases] = await Promise.all([
    supabase.rpc("get_session_test", { p_class_session_id: sessionId }),
    getSessionGradingSubmissions(sessionId),
    getGradingCommentPhrases(),
  ]);
  const testRow = test as { answer_key?: unknown; answer_key_version?: number; status?: string } | null;
  if (testError || !testRow || testRow.status !== "key_confirmed" || !submissions.ok) {
    return { ...empty, message: "Không tải được đề hoặc bài nộp của buổi.", ok: false };
  }
  const storedKey = storedAnswerKeySchema.safeParse(testRow.answer_key);
  if (!storedKey.success) return { ...empty, message: "Đáp án của buổi không đọc được.", ok: false };
  const key = answerKeyFromStored(storedKey.data);
  const keyVersion = testRow.answer_key_version ?? 0;

  let approved = 0;
  let failed = 0;
  let skipped = 0;
  let lastError = "";
  for (const submission of submissions.data) {
    if (!submission.countsForScore || !submission.ai || !submission.review) continue;
    const eligible =
      submission.ai.state === "graded" &&
      submission.ai.color === "green" &&
      submission.ai.keyVersion === keyVersion &&
      submission.review.status === "pending" &&
      submission.review.attendanceStatus !== null &&
      PRESENT.has(submission.review.attendanceStatus) &&
      !(submission.review.result && !submission.review.result.fromThisSubmission && submission.review.result.testScore !== null);
    if (!eligible) {
      if (submission.ai.state === "graded" && submission.review.status === "pending") skipped += 1;
      continue;
    }
    const aiQuestions = submission.ai.questions.map((question) => ({ ...question }));
    const verdicts = initialVerdicts(key, aiQuestions);
    const praise = submission.review.praiseBonus;
    const feedbackText = draftComment({ aiQuestions, key, phrases, praise, seed: `${submission.studentId}:${sessionId}`, verdicts });
    const { error } = await supabase.rpc("approve_grading_submission", {
      p_expected_key_version: keyVersion,
      p_feedback_text: feedbackText,
      p_praise_bonus: praise,
      p_submission_id: submission.id,
      p_verdicts: verdicts,
    });
    if (error) {
      failed += 1;
      lastError = rpcErrorMessage(error);
    } else {
      approved += 1;
    }
  }
  if (approved > 0) revalidatePath(`/sessions/${sessionId}`);
  const parts = [`Đã duyệt ${approved} bài xanh.`];
  if (skipped > 0) parts.push(`${skipped} bài khác cần duyệt từng bài (vàng, chưa điểm danh, hoặc đã có điểm nhập tay).`);
  if (failed > 0) parts.push(`${failed} bài chưa duyệt được: ${lastError}`);
  return { approved, failed, message: parts.join(" "), ok: failed === 0, skipped };
}
