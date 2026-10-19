import { normalizeSearchText } from "@/lib/search";

/**
 * Matches a form submission to a student and a class session (plan §4.3). Pure: the webhook
 * loads the candidates from the database, this module decides. Anything not certain goes to
 * "Bài nộp chưa ghép" (needs_review) instead of guessing.
 */

export type MatchIssue =
  | "birth_year_mismatch"
  | "claimed_session_mismatch"
  | "multiple_sessions"
  | "no_session_today"
  | "outside_window"
  | "student_ambiguous"
  | "student_code_unknown"
  | "student_not_found";

export type StudentMatchMethod = "name_birth_year" | "student_code";
export type SessionMatchMethod = "attendance" | "claimed_session" | "class_option" | "time_window";

export interface StudentCandidate {
  birthYear: number;
  fullName: string;
  publicCode: string;
  /** "code": the student with the submitted ERP code; "birth_year": an active enrollment of that birth year. */
  source: "birth_year" | "code";
  studentId: string;
}

export interface SessionCandidate {
  attendanceStatus: string | null;
  classCode: string;
  classLevel: string | null;
  classSessionId: string;
  endTime: string;
  onRoster: boolean;
  sessionDate: string;
  startTime: string;
}

export interface GradingMatchInput {
  birthYear: number;
  claimedClassSessionId: string | null;
  classOption: string | null;
  fullName: string;
  studentCode: string | null;
  submittedAt: Date;
}

export interface GradingMatchResult {
  classSessionId: string | null;
  issues: MatchIssue[];
  matchStatus: "matched" | "needs_review";
  sessionMethod: SessionMatchMethod | null;
  studentId: string | null;
  studentMethod: StudentMatchMethod | null;
}

/** A session accepts submissions from 15 minutes before it starts until 3 hours after it ends. */
export const SUBMISSION_WINDOW_BEFORE_MINUTES = 15;
export const SUBMISSION_WINDOW_AFTER_MINUTES = 180;

const VIETNAM_OFFSET = "+07:00";
const PRESENT_STATUSES = new Set(["additional_study", "present"]);

/** Accent-, case- and spacing-insensitive full name ("Nguyễn  Đức" → "nguyen duc"). */
export function normalizeStudentName(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, " ");
}

export function matchStudent(
  input: Pick<GradingMatchInput, "birthYear" | "fullName" | "studentCode">,
  candidates: readonly StudentCandidate[],
): { issues: MatchIssue[]; method: StudentMatchMethod | null; studentId: string | null } {
  const issues: MatchIssue[] = [];

  if (input.studentCode) {
    const byCode = candidates.find((candidate) => candidate.source === "code" && candidate.publicCode === input.studentCode);
    if (byCode) {
      if (byCode.birthYear !== input.birthYear) issues.push("birth_year_mismatch");
      return { issues, method: "student_code", studentId: byCode.studentId };
    }
    issues.push("student_code_unknown");
  }

  const wanted = normalizeStudentName(input.fullName);
  const byName = new Map<string, StudentCandidate>();
  for (const candidate of candidates) {
    if (
      candidate.source === "birth_year" &&
      candidate.birthYear === input.birthYear &&
      normalizeStudentName(candidate.fullName) === wanted
    ) {
      byName.set(candidate.studentId, candidate);
    }
  }

  if (byName.size === 1) {
    const [only] = byName.values();
    return { issues, method: "name_birth_year", studentId: only.studentId };
  }

  issues.push(byName.size === 0 ? "student_not_found" : "student_ambiguous");
  return { issues, method: null, studentId: null };
}

export interface ClassOptionHint {
  level: "A" | "B" | "CLC";
  /** "1" for CLC1; null when the option does not name a numbered class. */
  suffix: string | null;
}

/**
 * The old form's "lớp hôm nay" options ("A - Nâng cao - Thầy Vinh", "CLC1 - Từ cơ bản…").
 * Only a tie-break: the option is unreliable (plan §1.1). "Con không rõ" / "Khác" give nothing.
 */
export function parseClassOption(option: string | null): ClassOptionHint | null {
  const match = option?.trim().toUpperCase().match(/^(A|B|CLC)(\d*)(?=\s|-|$)/);
  if (!match) return null;
  return { level: match[1] as ClassOptionHint["level"], suffix: match[2] || null };
}

/** Class codes look like `{grade}{level}[number]`: 7A, 8B, 7CLC1. */
export function classMatchesOption(candidate: Pick<SessionCandidate, "classCode" | "classLevel">, hint: ClassOptionHint): boolean {
  if (candidate.classLevel !== hint.level) return false;
  if (hint.level !== "CLC" || !hint.suffix) return true;
  const numbered = candidate.classCode.toUpperCase().match(/CLC(\d*)$/);
  return !numbered || numbered[1] === "" || numbered[1] === hint.suffix;
}

export function sessionWindow(candidate: Pick<SessionCandidate, "endTime" | "sessionDate" | "startTime">): { endMs: number; startMs: number } {
  const start = Date.parse(`${candidate.sessionDate}T${withSeconds(candidate.startTime)}${VIETNAM_OFFSET}`);
  const end = Date.parse(`${candidate.sessionDate}T${withSeconds(candidate.endTime)}${VIETNAM_OFFSET}`);
  return {
    endMs: end + SUBMISSION_WINDOW_AFTER_MINUTES * 60_000,
    startMs: start - SUBMISSION_WINDOW_BEFORE_MINUTES * 60_000,
  };
}

function withSeconds(time: string): string {
  return /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
}

function isInWindow(candidate: SessionCandidate, submittedMs: number): boolean {
  const { endMs, startMs } = sessionWindow(candidate);
  return submittedMs >= startMs && submittedMs <= endMs;
}

/**
 * Candidates are the student's non-cancelled sessions on the submission's Vietnam date (roster,
 * combined classes or attendance). Order: the session picked on the form, then the time window,
 * then attendance, then the class option.
 */
export function matchSession(
  input: Pick<GradingMatchInput, "claimedClassSessionId" | "classOption" | "submittedAt">,
  candidates: readonly SessionCandidate[],
): { classSessionId: string | null; issues: MatchIssue[]; method: SessionMatchMethod | null } {
  const issues: MatchIssue[] = [];
  const submittedMs = input.submittedAt.getTime();

  if (input.claimedClassSessionId) {
    const claimed = candidates.find((candidate) => candidate.classSessionId === input.claimedClassSessionId);
    if (claimed) {
      if (!isInWindow(claimed, submittedMs)) issues.push("outside_window");
      return { classSessionId: claimed.classSessionId, issues, method: "claimed_session" };
    }
    issues.push("claimed_session_mismatch");
  }

  if (candidates.length === 0) {
    issues.push("no_session_today");
    return { classSessionId: null, issues, method: null };
  }

  const inWindow = candidates.filter((candidate) => isInWindow(candidate, submittedMs));
  if (inWindow.length === 0) {
    issues.push("outside_window");
    return { classSessionId: null, issues, method: null };
  }
  if (inWindow.length === 1) {
    return { classSessionId: inWindow[0].classSessionId, issues, method: "time_window" };
  }

  const attended = inWindow.filter((candidate) => candidate.attendanceStatus !== null && PRESENT_STATUSES.has(candidate.attendanceStatus));
  if (attended.length === 1) {
    return { classSessionId: attended[0].classSessionId, issues, method: "attendance" };
  }

  const hint = parseClassOption(input.classOption);
  if (hint) {
    const pool = attended.length > 1 ? attended : inWindow;
    const byOption = pool.filter((candidate) => classMatchesOption(candidate, hint));
    if (byOption.length === 1) {
      return { classSessionId: byOption[0].classSessionId, issues, method: "class_option" };
    }
  }

  issues.push("multiple_sessions");
  return { classSessionId: null, issues, method: null };
}

export function matchGradingSubmission(
  input: GradingMatchInput,
  studentCandidates: readonly StudentCandidate[],
  sessionCandidates: readonly SessionCandidate[],
): GradingMatchResult {
  const student = matchStudent(input, studentCandidates);
  if (!student.studentId) {
    return {
      classSessionId: null,
      issues: student.issues,
      matchStatus: "needs_review",
      sessionMethod: null,
      studentId: null,
      studentMethod: null,
    };
  }

  const session = matchSession(input, sessionCandidates);
  return {
    classSessionId: session.classSessionId,
    issues: [...student.issues, ...session.issues],
    matchStatus: session.classSessionId ? "matched" : "needs_review",
    sessionMethod: session.method,
    studentId: student.studentId,
    studentMethod: student.method,
  };
}

/** Vietnamese labels for the review screens. */
export const MATCH_ISSUE_LABELS: Record<MatchIssue, string> = {
  birth_year_mismatch: "Năm sinh trên form khác hồ sơ",
  claimed_session_mismatch: "Buổi chọn trên form không có em này",
  multiple_sessions: "Có nhiều buổi phù hợp",
  no_session_today: "Không có buổi học trong ngày",
  outside_window: "Nộp ngoài giờ buổi học",
  student_ambiguous: "Trùng họ tên, chưa biết em nào",
  student_code_unknown: "Mã học sinh không có trong ERP",
  student_not_found: "Không tìm thấy học sinh",
};

export function matchIssueLabel(issue: string): string {
  return (MATCH_ISSUE_LABELS as Record<string, string>)[issue] ?? issue;
}
