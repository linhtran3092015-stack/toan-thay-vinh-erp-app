/**
 * Suggests a Zalo "sổ liên lạc" group for each student from the group's current
 * name on ZaloCRM. Pure so it can be unit-tested; the bulk link page runs it on
 * the server and staff confirm every suggestion before anything is saved.
 */

export interface MatchStudent {
  fullName: string;
  guardians: { fullName: string; phones: string[] }[];
  id: string;
  publicCode: string;
}

export interface MatchGroup {
  externalThreadId: string;
  groupMembersCount: number | null;
  groupName: string | null;
  zaloAccountId: string;
}

/** Why a group was suggested, strongest first. */
export type MatchReason = "student_code" | "student_name" | "guardian_phone" | "guardian_name";

export interface GroupCandidate {
  group: MatchGroup;
  reasons: MatchReason[];
  score: number;
}

/**
 * `sure`: one best group that no other student ties for; pre-ticked.
 * `ambiguous`: candidates exist but staff must pick (namesakes, siblings sharing a phone, weak match).
 * `none`: nothing in the group names points at this student.
 */
export type MatchConfidence = "sure" | "ambiguous" | "none";

export interface StudentGroupMatch {
  candidates: GroupCandidate[];
  confidence: MatchConfidence;
  studentId: string;
  /** The pre-selected group for `sure` rows. */
  suggestion: GroupCandidate | null;
}

const REASON_SCORE: Record<MatchReason, number> = {
  guardian_name: 25,
  guardian_phone: 40,
  student_code: 100,
  student_name: 60,
};

/** The bulk link page saves this many links per server action call (stays well inside the function time limit). */
export const MAX_BULK_ZALO_LINKS = 25;

/** A suggestion is only pre-ticked when it rests on the student's own name or code. */
export const SURE_MIN_SCORE = REASON_SCORE.student_name;
const MAX_CANDIDATES = 5;

/** Lower case, no Vietnamese tone marks, đ → d, words separated by single spaces. */
export function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Vietnamese mobile numbers in a free-text name, as 0xxxxxxxxx ("+84 912.345.678" → "0912345678"). */
export function extractPhones(value: string): string[] {
  const compact = value.replace(/[\s.\-()]/g, "");
  const found = new Set<string>();
  for (const match of compact.matchAll(/(?:\+?84|0)(\d{9})(?!\d)/g)) found.add(`0${match[1]}`);
  return [...found];
}

/** Any phone format ("84912…", "0912 345 678", "+84 …") → 0xxxxxxxxx, or null. */
export function normalizePhone(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  if (/^84\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^0\d{9}$/.test(digits)) return digits;
  return null;
}

function containsWords(haystack: string, needle: string): boolean {
  return needle.length > 0 && ` ${haystack} `.includes(` ${needle} `);
}

function scoreGroup(student: MatchStudent, groupName: string, groupPhones: Set<string>): GroupCandidate["reasons"] {
  const reasons: MatchReason[] = [];
  const code = normalizeForMatch(student.publicCode);
  if (code && containsWords(groupName, code)) reasons.push("student_code");
  const name = normalizeForMatch(student.fullName);
  // A one-word name ("An") would match far too many groups.
  if (name.includes(" ") && containsWords(groupName, name)) reasons.push("student_name");
  if (student.guardians.some((guardian) => guardian.phones.some((phone) => groupPhones.has(phone)))) reasons.push("guardian_phone");
  if (
    student.guardians.some((guardian) => {
      const guardianName = normalizeForMatch(guardian.fullName);
      return guardianName.includes(" ") && containsWords(groupName, guardianName);
    })
  ) {
    reasons.push("guardian_name");
  }
  return reasons;
}

interface Pair {
  group: MatchGroup;
  reasons: MatchReason[];
  score: number;
  studentId: string;
}

/**
 * Scores every student against every group name, then assigns `sure` pairs
 * greedily from the highest score down. A tie at the top (two students on one
 * group, or one student on two groups) blocks both sides, so a namesake never
 * gets a group by luck; a guardian phone in the name breaks such ties.
 */
export function matchStudentsToGroups(students: MatchStudent[], groups: MatchGroup[]): StudentGroupMatch[] {
  const prepared = groups.map((group) => {
    const raw = group.groupName ?? "";
    return { group, name: normalizeForMatch(raw), phones: new Set(extractPhones(raw)) };
  });

  const pairs: Pair[] = [];
  const pairsByStudent = new Map<string, Pair[]>();
  for (const student of students) {
    const own: Pair[] = [];
    for (const entry of prepared) {
      if (!entry.name && entry.phones.size === 0) continue;
      const reasons = scoreGroup(student, entry.name, entry.phones);
      if (reasons.length === 0) continue;
      const score = reasons.reduce((sum, reason) => sum + REASON_SCORE[reason], 0);
      own.push({ group: entry.group, reasons, score, studentId: student.id });
    }
    own.sort((a, b) => b.score - a.score);
    pairsByStudent.set(student.id, own);
    pairs.push(...own);
  }

  const assigned = new Map<string, Pair>();
  const takenGroups = new Set<string>();
  const blockedStudents = new Set<string>();
  const blockedGroups = new Set<string>();
  const sorted = pairs.filter((pair) => pair.score >= SURE_MIN_SCORE).sort((a, b) => b.score - a.score);
  for (const pair of sorted) {
    const threadId = pair.group.externalThreadId;
    if (assigned.has(pair.studentId) || takenGroups.has(threadId)) continue;
    if (blockedStudents.has(pair.studentId) || blockedGroups.has(threadId)) continue;
    const rivals = sorted.filter(
      (other) =>
        other !== pair &&
        other.score === pair.score &&
        !assigned.has(other.studentId) &&
        !takenGroups.has(other.group.externalThreadId) &&
        (other.studentId === pair.studentId || other.group.externalThreadId === threadId),
    );
    if (rivals.length > 0) {
      for (const tied of [pair, ...rivals]) {
        blockedStudents.add(tied.studentId);
        blockedGroups.add(tied.group.externalThreadId);
      }
      continue;
    }
    assigned.set(pair.studentId, pair);
    takenGroups.add(threadId);
  }

  return students.map((student) => {
    const sure = assigned.get(student.id);
    if (sure) {
      const suggestion = { group: sure.group, reasons: sure.reasons, score: sure.score };
      return { candidates: [suggestion], confidence: "sure" as const, studentId: student.id, suggestion };
    }
    const candidates = (pairsByStudent.get(student.id) ?? [])
      .filter((pair) => !takenGroups.has(pair.group.externalThreadId))
      .slice(0, MAX_CANDIDATES)
      .map(({ group, reasons, score }) => ({ group, reasons, score }));
    return {
      candidates,
      confidence: candidates.length > 0 ? ("ambiguous" as const) : ("none" as const),
      studentId: student.id,
      suggestion: null,
    };
  });
}
