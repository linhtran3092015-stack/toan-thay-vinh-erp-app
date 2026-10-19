import { z } from "zod";

import {
  matchGradingSubmission,
  sessionWindow,
  type GradingMatchResult,
  type SessionCandidate,
  type StudentCandidate,
} from "@/features/grading-submissions/matching";
import { normalizeSearchText } from "@/lib/search";

/**
 * "Bài nộp chưa ghép" write side (Giai đoạn 1b): the candidates list_grading_match_candidates
 * returns for one submission, the "Ghép lại tự động" plan built from them with the same matcher
 * the webhook uses, and the picker's filter/sort. Pure: the server actions do the I/O.
 */

export interface MatchCandidateStudent {
  birthYear: number;
  /** Has an active enrollment on the submission's Vietnam date (the matcher's name candidates). */
  enrolledOnDay: boolean;
  fullName: string;
  id: string;
  lifecycleStatus: string;
  nickname: string | null;
  publicCode: string;
  /** Non-cancelled sessions that day with the student on the roster (combined classes too) or in attendance. */
  sessions: SessionCandidate[];
}

const candidateSessionSchema = z.object({
  attendance_status: z.string().nullable(),
  class_code: z.string(),
  class_level: z.string().nullable(),
  class_session_id: z.string().uuid(),
  end_time: z.string(),
  on_roster: z.boolean(),
  session_date: z.string(),
  start_time: z.string(),
});

export const matchCandidateRowSchema = z.object({
  birth_year: z.number().int(),
  enrolled_on_day: z.boolean(),
  full_name: z.string(),
  lifecycle_status: z.string(),
  nickname: z.string().nullable(),
  public_code: z.string(),
  sessions: z.array(candidateSessionSchema),
  student_id: z.string().uuid(),
});

export type MatchCandidateRow = z.infer<typeof matchCandidateRowSchema>;

export function toMatchCandidates(rows: readonly MatchCandidateRow[]): MatchCandidateStudent[] {
  return rows.map((row) => ({
    birthYear: row.birth_year,
    enrolledOnDay: row.enrolled_on_day,
    fullName: row.full_name,
    id: row.student_id,
    lifecycleStatus: row.lifecycle_status,
    nickname: row.nickname,
    publicCode: row.public_code,
    sessions: row.sessions.map((session) => ({
      attendanceStatus: session.attendance_status,
      classCode: session.class_code,
      classLevel: session.class_level,
      classSessionId: session.class_session_id,
      endTime: session.end_time,
      onRoster: session.on_roster,
      sessionDate: session.session_date,
      startTime: session.start_time,
    })),
  }));
}

/** What the form claimed, as list_unmatched_grading_submissions returns it. */
export interface RematchSubmission {
  claimedBirthYear: number;
  claimedClassOption: string | null;
  claimedClassSessionId: string | null;
  claimedFullName: string;
  claimedStudentCode: string | null;
  id: string;
  submittedAt: string;
}

/** One element of rematch_grading_submissions(p_decisions). */
export interface RematchDecision {
  class_session_id: string | null;
  match_issues: string[];
  session_match_method: string | null;
  student_id: string | null;
  student_match_method: string | null;
  submission_id: string;
}

/**
 * Re-runs the webhook's matcher on today's data: the candidates stand in for
 * get_grading_student_candidates ("code" = the student with the claimed code, any status;
 * "birth_year" = an active enrollment that day with the claimed birth year) and
 * get_grading_session_candidates (the matched student's sessions that day).
 */
export function planGradingRematch(
  submission: RematchSubmission,
  candidates: readonly MatchCandidateStudent[],
): { decision: RematchDecision; result: GradingMatchResult } {
  const studentCode = submission.claimedStudentCode?.trim().toUpperCase() || null;
  const studentCandidates: StudentCandidate[] = [];
  for (const candidate of candidates) {
    const base = { birthYear: candidate.birthYear, fullName: candidate.fullName, publicCode: candidate.publicCode, studentId: candidate.id };
    if (studentCode && candidate.publicCode === studentCode) studentCandidates.push({ ...base, source: "code" });
    if (candidate.enrolledOnDay && candidate.birthYear === submission.claimedBirthYear) {
      studentCandidates.push({ ...base, source: "birth_year" });
    }
  }

  const input = {
    birthYear: submission.claimedBirthYear,
    claimedClassSessionId: submission.claimedClassSessionId,
    classOption: submission.claimedClassOption,
    fullName: submission.claimedFullName,
    studentCode,
    submittedAt: new Date(submission.submittedAt),
  };
  const studentOnly = matchGradingSubmission(input, studentCandidates, []);
  const sessions = studentOnly.studentId
    ? (candidates.find((candidate) => candidate.id === studentOnly.studentId)?.sessions ?? [])
    : [];
  const result = studentOnly.studentId ? matchGradingSubmission(input, studentCandidates, sessions) : studentOnly;

  return {
    decision: {
      class_session_id: result.classSessionId,
      match_issues: result.issues,
      session_match_method: result.sessionMethod,
      student_id: result.studentId,
      student_match_method: result.studentMethod,
      submission_id: submission.id,
    },
    result,
  };
}

export type RematchOutcome = "invalid" | "matched" | "skipped" | "unchanged" | "updated";

export interface RematchSummary {
  /** Submissions whose candidates could not be loaded (left as they were). */
  failed: number;
  invalid: number;
  matched: number;
  skipped: number;
  total: number;
  unchanged: number;
  updated: number;
}

export function summarizeRematch(outcomes: readonly string[], total: number, failed: number): RematchSummary {
  const summary: RematchSummary = { failed, invalid: 0, matched: 0, skipped: 0, total, unchanged: 0, updated: 0 };
  for (const outcome of outcomes) {
    if (outcome === "matched" || outcome === "updated" || outcome === "unchanged" || outcome === "skipped" || outcome === "invalid") {
      summary[outcome] += 1;
    }
  }
  return summary;
}

export function rematchSummaryMessage(summary: RematchSummary): string {
  if (summary.total === 0) return "Không có bài nào đang chờ ghép.";
  const pending = summary.total - summary.matched - summary.skipped;
  const parts = [
    summary.matched > 0 ? `Đã ghép thêm ${summary.matched} bài.` : "Chưa ghép thêm được bài nào.",
    pending > 0 ? `${pending} bài vẫn cần chọn tay.` : null,
    summary.updated > 0 ? `${summary.updated} bài có thông tin mới (học sinh hoặc cảnh báo).` : null,
    summary.failed > 0 ? `${summary.failed} bài chưa kiểm tra được, thử lại sau.` : null,
  ];
  return parts.filter(Boolean).join(" ");
}

/** Accent-insensitive filter: every typed word must appear in the name, nickname or code ("pham huy", "00098"). */
export function filterMatchCandidates(students: readonly MatchCandidateStudent[], query: string): MatchCandidateStudent[] {
  const words = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...students];
  return students.filter((student) => {
    const haystack = normalizeSearchText(`${student.fullName} ${student.nickname ?? ""} ${student.publicCode}`);
    return words.every((word) => haystack.includes(word));
  });
}

const collator = new Intl.Collator("vi", { sensitivity: "base" });

function givenName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] ?? fullName;
}

/** The claimed birth year first, then students with a session that day, then by given name like the form. */
export function sortMatchCandidates(students: readonly MatchCandidateStudent[], claimedBirthYear: number): MatchCandidateStudent[] {
  return [...students].sort(
    (left, right) =>
      Number(right.birthYear === claimedBirthYear) - Number(left.birthYear === claimedBirthYear) ||
      Number(right.sessions.length > 0) - Number(left.sessions.length > 0) ||
      collator.compare(givenName(left.fullName), givenName(right.fullName)) ||
      collator.compare(left.fullName, right.fullName) ||
      left.publicCode.localeCompare(right.publicCode),
  );
}

/** Whether the submission falls in the session's window (15 minutes before start to 3 hours after end). */
export function isWithinSubmissionWindow(session: SessionCandidate, submittedAt: string): boolean {
  const submittedMs = Date.parse(submittedAt);
  const { endMs, startMs } = sessionWindow(session);
  return submittedMs >= startMs && submittedMs <= endMs;
}

/**
 * The session to preselect: the only one, else the only one in the time window, else the one
 * the form claimed. Null when the choice is not obvious.
 */
export function suggestSessionId(
  sessions: readonly SessionCandidate[],
  submittedAt: string,
  claimedClassSessionId: string | null,
): string | null {
  if (sessions.length === 1) return sessions[0].classSessionId;
  const inWindow = sessions.filter((session) => isWithinSubmissionWindow(session, submittedAt));
  if (inWindow.length === 1) return inWindow[0].classSessionId;
  return sessions.find((session) => session.classSessionId === claimedClassSessionId)?.classSessionId ?? null;
}
