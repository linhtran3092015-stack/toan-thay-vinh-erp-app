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

export interface SessionGradingSubmission {
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
});

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
        answerText: row.answer_text,
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
