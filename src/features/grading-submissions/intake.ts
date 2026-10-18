import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  matchGradingSubmission,
  type GradingMatchResult,
  type SessionCandidate,
  type StudentCandidate,
} from "@/features/grading-submissions/matching";
import type { ParsedGradingSubmission } from "@/features/grading-submissions/payload";
import { buildGradingRoster, type GradingRosterEntry } from "@/features/grading-submissions/roster";
import { getVietnamToday } from "@/lib/datetime";
import type { Database, Json } from "@/types/database.generated";

type ServiceClient = SupabaseClient<Database>;

/** PostgREST needs the key present; generated arg types do not mark SQL nulls. */
function sqlNull<T>(value: T | null): T {
  return value as T;
}

const studentCandidateSchema = z.object({
  birth_year: z.number().int(),
  candidate_source: z.enum(["birth_year", "code"]),
  full_name: z.string(),
  public_code: z.string(),
  student_id: z.string().uuid(),
});

const sessionCandidateSchema = z.object({
  attendance_status: z.string().nullable(),
  class_code: z.string(),
  class_level: z.string().nullable(),
  class_session_id: z.string().uuid(),
  end_time: z.string(),
  on_roster: z.boolean(),
  session_date: z.string(),
  start_time: z.string(),
});

const recordResultSchema = z.object({
  counts_for_score: z.boolean(),
  inserted: z.boolean(),
  match_status: z.enum(["matched", "needs_review", "ignored"]),
  submission_id: z.string().uuid(),
});

export type GradingIntakeResult =
  | { duplicate: boolean; match: GradingMatchResult; matchStatus: string; ok: true; submissionId: string }
  /** "rejected": the database refused the data itself (a resend would fail the same way). */
  | { error: string; kind: "failed" | "rejected"; ok: false };

// check_violation, not_null_violation, string_data_right_truncation, character_not_in_repertoire, untranslatable_character
const DATA_ERROR_CODES = new Set(["23514", "23502", "22001", "22021", "22P05"]);

/** Loads candidates, matches (plan §4.3) and records one submission. Idempotent on externalId. */
export async function ingestGradingSubmission(
  supabase: ServiceClient,
  submission: ParsedGradingSubmission,
): Promise<GradingIntakeResult> {
  const { payload } = submission;
  const submittedAt = new Date(payload.submittedAt);
  const submittedOn = getVietnamToday(submittedAt);

  const students = await supabase.rpc("get_grading_student_candidates", {
    p_birth_year: payload.birthYear,
    p_on: submittedOn,
    p_student_code: sqlNull(payload.studentCode),
  });
  if (students.error) return { error: "student_candidates_failed", kind: "failed", ok: false };
  const studentRows = z.array(studentCandidateSchema).safeParse(students.data ?? []);
  if (!studentRows.success) return { error: "student_candidates_invalid", kind: "failed", ok: false };
  const studentCandidates: StudentCandidate[] = studentRows.data.map((row) => ({
    birthYear: row.birth_year,
    fullName: row.full_name,
    publicCode: row.public_code,
    source: row.candidate_source,
    studentId: row.student_id,
  }));

  const input = {
    birthYear: payload.birthYear,
    claimedClassSessionId: payload.classSessionId,
    classOption: payload.classOption,
    fullName: payload.fullName,
    studentCode: payload.studentCode,
    submittedAt,
  };
  let match = matchGradingSubmission(input, studentCandidates, []);

  if (match.studentId) {
    const sessions = await supabase.rpc("get_grading_session_candidates", {
      p_on: submittedOn,
      p_student_id: match.studentId,
    });
    if (sessions.error) return { error: "session_candidates_failed", kind: "failed", ok: false };
    const sessionRows = z.array(sessionCandidateSchema).safeParse(sessions.data ?? []);
    if (!sessionRows.success) return { error: "session_candidates_invalid", kind: "failed", ok: false };
    const sessionCandidates: SessionCandidate[] = sessionRows.data.map((row) => ({
      attendanceStatus: row.attendance_status,
      classCode: row.class_code,
      classLevel: row.class_level,
      classSessionId: row.class_session_id,
      endTime: row.end_time,
      onRoster: row.on_roster,
      sessionDate: row.session_date,
      startTime: row.start_time,
    }));
    match = matchGradingSubmission(input, studentCandidates, sessionCandidates);
  }

  const recorded = await supabase.rpc("record_grading_submission", {
    p_answer_text: submission.answerText,
    p_answer_truncated: submission.answerTruncated,
    p_claimed_birth_year: payload.birthYear,
    p_claimed_class_option: sqlNull(payload.classOption),
    p_claimed_class_option_other: sqlNull(payload.classOptionOther),
    p_claimed_class_session_id: sqlNull(payload.classSessionId),
    p_claimed_full_name: payload.fullName,
    p_claimed_student_code: sqlNull(payload.studentCode),
    p_class_session_id: sqlNull(match.classSessionId),
    p_external_id: payload.externalId,
    p_match_issues: match.issues,
    p_match_status: match.matchStatus,
    p_raw_payload: submission.rawPayload as Json,
    p_session_match_method: sqlNull(match.sessionMethod),
    p_student_id: sqlNull(match.studentId),
    p_student_match_method: sqlNull(match.studentMethod),
    p_submitted_at: submittedAt.toISOString(),
  });
  if (recorded.error) {
    return DATA_ERROR_CODES.has(recorded.error.code ?? "")
      ? { error: `record_rejected_${recorded.error.code}`, kind: "rejected", ok: false }
      : { error: "record_failed", kind: "failed", ok: false };
  }
  const row = z.array(recordResultSchema).safeParse(recorded.data ?? []);
  if (!row.success || row.data.length !== 1) return { error: "record_invalid", kind: "failed", ok: false };

  return {
    duplicate: !row.data[0].inserted,
    match,
    matchStatus: row.data[0].match_status,
    ok: true,
    submissionId: row.data[0].submission_id,
  };
}

const rosterRowSchema = z.object({
  full_name: z.string(),
  guardian_phone_last4: z.string().nullable(),
  nickname: z.string().nullable(),
  public_code: z.string(),
  sessions: z.array(
    z.object({ class_code: z.string(), end_time: z.string(), id: z.string().uuid(), start_time: z.string() }),
  ),
  student_id: z.string().uuid(),
});

const birthYearRowSchema = z.object({ birth_year: z.number().int(), student_count: z.number().int() });

export async function loadGradingFormBirthYears(
  supabase: ServiceClient,
  on: string,
): Promise<{ birthYears: number[]; ok: true } | { ok: false }> {
  const { data, error } = await supabase.rpc("get_grading_form_birth_years", { p_on: on });
  if (error) return { ok: false };
  const parsed = z.array(birthYearRowSchema).safeParse(data ?? []);
  if (!parsed.success) return { ok: false };
  return { birthYears: parsed.data.map((row) => row.birth_year), ok: true };
}

export async function loadGradingFormRoster(
  supabase: ServiceClient,
  birthYear: number,
  on: string,
): Promise<{ ok: true; students: GradingRosterEntry[] } | { ok: false }> {
  const { data, error } = await supabase.rpc("get_grading_form_roster", { p_birth_year: birthYear, p_on: on });
  if (error) return { ok: false };
  const parsed = z.array(rosterRowSchema).safeParse(data ?? []);
  if (!parsed.success) return { ok: false };
  return {
    ok: true,
    students: buildGradingRoster(
      parsed.data.map((row) => ({
        fullName: row.full_name,
        guardianPhoneLast4: row.guardian_phone_last4,
        nickname: row.nickname,
        publicCode: row.public_code,
        sessions: row.sessions.map((session) => ({
          classCode: session.class_code,
          endTime: session.end_time,
          id: session.id,
          startTime: session.start_time,
        })),
      })),
    ),
  };
}
