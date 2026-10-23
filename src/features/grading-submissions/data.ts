import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface UnmatchedGradingSubmission {
  answerText: string;
  answerTruncated: boolean;
  claimedBirthYear: number;
  claimedClassOption: string | null;
  claimedClassOptionOther: string | null;
  /** The session picked on the form (untrusted; the matcher checks it). */
  claimedClassSessionId: string | null;
  claimedFullName: string;
  claimedSessionLabel: string | null;
  claimedStudentCode: string | null;
  id: string;
  issues: string[];
  receivedAt: string;
  /** Set when the student was found but the session was not. */
  student: { fullName: string; id: string; publicCode: string } | null;
  submittedAt: string;
}

/** A submission marked "Bỏ qua (bài rác)"; who/when/why come from the latest ignore audit row. */
export interface IgnoredGradingSubmission extends UnmatchedGradingSubmission {
  /** Null when the row was ignored without an audit row (fixed by hand in SQL). */
  ignored: { at: string; byName: string | null; reason: string | null } | null;
}

/**
 * AI grading of a submission (phase 3a). state: not_counted (an older attempt), grading (queued or
 * running), waiting_key (no confirmed key, or not graded on the current key yet), graded, failed.
 */
export type SubmissionAiState = "not_counted" | "grading" | "waiting_key" | "graded" | "failed";

export interface SubmissionAiQuestion {
  errorLocation: string;
  extractedFinalAnswer: string;
  label: string;
  noteForParent: string;
  reasonForTeacher: string;
  verdict: "correct" | "incorrect" | "missing";
}

export interface SubmissionAi {
  color: "green" | "yellow" | "red" | null;
  confidence: "high" | "medium" | "low" | null;
  flags: string[];
  gradedAt: string | null;
  keyVersion: number | null;
  questions: SubmissionAiQuestion[];
  /** Sum of the points of the questions marked correct (not rounded, no bonus). */
  rawScore: number | null;
  state: SubmissionAiState;
}

/** Review of a submission (phase 3b). */
export interface SubmissionReview {
  /** Attendance of the student in this session (null when not marked yet). */
  attendanceStatus: string | null;
  feedbackText: string | null;
  finalScore: number | null;
  finalVerdicts: Record<string, "correct" | "incorrect" | "missing"> | null;
  keyVersion: number | null;
  /** Latest Zalo comment message status of the session result (queued, sent, ...). */
  messageStatus: string | null;
  note: string | null;
  paperScore: number | null;
  praiseBonus: boolean;
  rankLabel: string | null;
  /** The student's current session result, whoever wrote it. */
  result: { comment: string | null; fromThisSubmission: boolean; id: string; testScore: number | null } | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  status: "pending" | "approved" | "skipped";
}

export interface SessionGradingSubmission {
  /** Absent in fixtures written before phase 3a. */
  ai?: SubmissionAi;
  /** Absent in fixtures written before phase 3b. */
  review?: SubmissionReview;
  answerText: string;
  answerTruncated: boolean;
  attemptNo: number | null;
  countsForScore: boolean;
  id: string;
  issues: string[];
  sessionMatchMethod: string | null;
  studentCode: string;
  studentId: string;
  studentMatchMethod: string | null;
  studentName: string;
  submittedAt: string;
}

export type GradingDataResult<T> = { data: T; ok: true } | { error: string; ok: false };

const unmatchedRowSchema = z.object({
  answer_text: z.string(),
  answer_truncated: z.boolean(),
  claimed_birth_year: z.number().int(),
  claimed_class_option: z.string().nullable(),
  claimed_class_option_other: z.string().nullable(),
  claimed_class_session_id: z.string().uuid().nullable(),
  claimed_full_name: z.string(),
  claimed_session_label: z.string().nullable(),
  claimed_student_code: z.string().nullable(),
  match_issues: z.array(z.string()),
  received_at: z.string(),
  student_full_name: z.string().nullable(),
  student_id: z.string().uuid().nullable(),
  student_public_code: z.string().nullable(),
  submission_id: z.string().uuid(),
  submitted_at: z.string(),
});

const ignoredRowSchema = unmatchedRowSchema.extend({
  ignore_reason: z.string().nullable(),
  ignored_at: z.string().nullable(),
  ignored_by_name: z.string().nullable(),
});

const sessionRowSchema = z.object({
  answer_text: z.string(),
  answer_truncated: z.boolean(),
  attempt_no: z.number().int().nullable(),
  counts_for_score: z.boolean(),
  match_issues: z.array(z.string()),
  session_match_method: z.string().nullable(),
  student_full_name: z.string(),
  student_id: z.string().uuid(),
  student_match_method: z.string().nullable(),
  student_public_code: z.string(),
  submission_id: z.string().uuid(),
  submitted_at: z.string(),
  ai_state: z.enum(["not_counted", "grading", "waiting_key", "graded", "failed"]).catch("waiting_key"),
  ai_color: z.enum(["green", "yellow", "red"]).nullable().catch(null),
  ai_raw_score: z.coerce.number().nullable().catch(null),
  ai_question_results: z
    .array(
      z.object({
        error_location: z.string().catch(""),
        extracted_final_answer: z.string().catch(""),
        label: z.string(),
        note_for_parent: z.string().catch(""),
        reason_for_teacher: z.string().catch(""),
        verdict: z.enum(["correct", "incorrect", "missing"]),
      }),
    )
    .nullable()
    .catch(null),
  ai_flags: z.array(z.string()).nullable().catch(null),
  ai_confidence: z.enum(["high", "medium", "low"]).nullable().catch(null),
  ai_answer_key_version: z.number().int().nullable().catch(null),
  ai_graded_at: z.string().nullable().catch(null),
  review_status: z.enum(["pending", "approved", "skipped"]).catch("pending"),
  praise_bonus: z.boolean().catch(false),
  final_question_verdicts: z.record(z.string(), z.enum(["correct", "incorrect", "missing"])).nullable().catch(null),
  paper_score: z.number().int().nullable().catch(null),
  final_score: z.number().int().nullable().catch(null),
  rank_label: z.string().nullable().catch(null),
  feedback_text: z.string().nullable().catch(null),
  review_answer_key_version: z.number().int().nullable().catch(null),
  reviewed_at: z.string().nullable().catch(null),
  reviewed_by_name: z.string().nullable().catch(null),
  review_note: z.string().nullable().catch(null),
  attendance_status: z.string().nullable().catch(null),
  result_id: z.string().uuid().nullable().catch(null),
  result_test_score: z.coerce.number().nullable().catch(null),
  result_comment: z.string().nullable().catch(null),
  result_from_this_submission: z.boolean().nullable().catch(null),
  message_status: z.string().nullable().catch(null),
});

function toSubmissionReview(row: z.infer<typeof sessionRowSchema>): SubmissionReview {
  return {
    attendanceStatus: row.attendance_status,
    feedbackText: row.feedback_text,
    finalScore: row.final_score,
    finalVerdicts: row.final_question_verdicts,
    keyVersion: row.review_answer_key_version,
    messageStatus: row.message_status,
    note: row.review_note,
    paperScore: row.paper_score,
    praiseBonus: row.praise_bonus,
    rankLabel: row.rank_label,
    result: row.result_id
      ? { comment: row.result_comment, fromThisSubmission: row.result_from_this_submission === true, id: row.result_id, testScore: row.result_test_score }
      : null,
    reviewedAt: row.reviewed_at,
    reviewedByName: row.reviewed_by_name,
    status: row.review_status,
  };
}

function toSubmissionAi(row: z.infer<typeof sessionRowSchema>): SubmissionAi {
  return {
    color: row.ai_color,
    confidence: row.ai_confidence,
    flags: row.ai_flags ?? [],
    gradedAt: row.ai_graded_at,
    keyVersion: row.ai_answer_key_version,
    questions: (row.ai_question_results ?? []).map((question) => ({
      errorLocation: question.error_location,
      extractedFinalAnswer: question.extracted_final_answer,
      label: question.label,
      noteForParent: question.note_for_parent,
      reasonForTeacher: question.reason_for_teacher,
      verdict: question.verdict,
    })),
    rawScore: row.ai_raw_score,
    state: row.ai_state,
  };
}

function toUnmatchedSubmission(row: z.infer<typeof unmatchedRowSchema>): UnmatchedGradingSubmission {
  return {
    answerText: row.answer_text,
    answerTruncated: row.answer_truncated,
    claimedBirthYear: row.claimed_birth_year,
    claimedClassOption: row.claimed_class_option,
    claimedClassOptionOther: row.claimed_class_option_other,
    claimedClassSessionId: row.claimed_class_session_id,
    claimedFullName: row.claimed_full_name,
    claimedSessionLabel: row.claimed_session_label,
    claimedStudentCode: row.claimed_student_code,
    id: row.submission_id,
    issues: row.match_issues,
    receivedAt: row.received_at,
    student:
      row.student_id && row.student_full_name && row.student_public_code
        ? { fullName: row.student_full_name, id: row.student_id, publicCode: row.student_public_code }
        : null,
    submittedAt: row.submitted_at,
  };
}

export async function getUnmatchedGradingSubmissions(limit = 200): Promise<GradingDataResult<UnmatchedGradingSubmission[]>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("list_unmatched_grading_submissions", { p_limit: limit });
    if (error) return { error: "Không tải được bài nộp chưa ghép.", ok: false };
    const parsed = z.array(unmatchedRowSchema).safeParse(data ?? []);
    if (!parsed.success) return { error: "Dữ liệu bài nộp không hợp lệ.", ok: false };
    return { data: parsed.data.map(toUnmatchedSubmission), ok: true };
  } catch {
    return { error: "Không tải được bài nộp chưa ghép.", ok: false };
  }
}

/** Submissions marked junk, most recently ignored first. */
export async function getIgnoredGradingSubmissions(limit = 200): Promise<GradingDataResult<IgnoredGradingSubmission[]>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("list_ignored_grading_submissions", { p_limit: limit });
    if (error) return { error: "Không tải được bài đã bỏ qua.", ok: false };
    const parsed = z.array(ignoredRowSchema).safeParse(data ?? []);
    if (!parsed.success) return { error: "Dữ liệu bài nộp không hợp lệ.", ok: false };
    return {
      data: parsed.data.map((row) => ({
        ...toUnmatchedSubmission(row),
        ignored: row.ignored_at ? { at: row.ignored_at, byName: row.ignored_by_name, reason: row.ignore_reason } : null,
      })),
      ok: true,
    };
  } catch {
    return { error: "Không tải được bài đã bỏ qua.", ok: false };
  }
}

export async function getSessionGradingSubmissions(sessionId: string): Promise<GradingDataResult<SessionGradingSubmission[]>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_session_grading_submissions", { p_class_session_id: sessionId });
    if (error) return { error: "Không tải được bài nộp của buổi học.", ok: false };
    const parsed = z.array(sessionRowSchema).safeParse(data ?? []);
    if (!parsed.success) return { error: "Dữ liệu bài nộp không hợp lệ.", ok: false };
    return {
      data: parsed.data.map((row) => ({
        ai: toSubmissionAi(row),
        answerText: row.answer_text,
        review: toSubmissionReview(row),
        answerTruncated: row.answer_truncated,
        attemptNo: row.attempt_no,
        countsForScore: row.counts_for_score,
        id: row.submission_id,
        issues: row.match_issues,
        sessionMatchMethod: row.session_match_method,
        studentCode: row.student_public_code,
        studentId: row.student_id,
        studentMatchMethod: row.student_match_method,
        studentName: row.student_full_name,
        submittedAt: row.submitted_at,
      })),
      ok: true,
    };
  } catch {
    return { error: "Không tải được bài nộp của buổi học.", ok: false };
  }
}
