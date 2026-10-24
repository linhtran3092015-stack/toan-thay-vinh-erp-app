/**
 * Suggests a Zalo "sổ liên lạc" group for each student from the group's current
 * name on ZaloCRM. Pure so it can be unit-tested; the bulk link page runs it on
 * the server and staff confirm every suggestion before anything is saved.
 */

import { normalizeVietnamPhoneNumber } from "@/lib/phone";
import { normalizeSearchText } from "@/lib/search";

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

/** Why a group was suggested, strongest first. `student_name_loose` matched only after dropping tone marks. */
export type MatchReason = "student_code" | "student_name" | "student_name_loose" | "guardian_phone" | "guardian_name";

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
  student_name_loose: 45,
};

/** The bulk link page saves this many links per server action call (stays well inside the function time limit). */
export const MAX_BULK_ZALO_LINKS = 25;

/** A "sổ liên lạc" group is the family plus a few staff; a bigger group is a class or broadcast group and is never pre-ticked. */
export const MAX_SURE_GROUP_MEMBERS = 15;
/** Pairs below this never block another student's group. */
const STRONG_SCORE = REASON_SCORE.student_name;
const MAX_CANDIDATES = 5;

/** Lower case, no Vietnamese tone marks, đ → d, words separated by single spaces. */
export function normalizeForMatch(value: string): string {
  return normalizeSearchText(value).replace(/[^a-z0-9]+/g, " ").trim();
}

/** Lower case with tone marks kept (Hùng and Hưng stay different), words separated by single spaces. */
function normalizeExact(value: string): string {
  return value.normalize("NFC").toLocaleLowerCase("vi").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Vietnamese mobile numbers in a free-text name, as 0xxxxxxxxx ("+84 912.345.678" → "0912345678"). */
export function extractPhones(value: string): string[] {
  const found = new Set<string>();
  // Digits may be split by single spaces, dots or dashes; a longer digit run on either side is not a phone.
  for (const match of value.matchAll(/(?<!\d)(?:\+?84|0)((?:[\s.\-]?\d){9})(?!\d)/g)) {
    const phone = normalizeVietnamPhoneNumber(`0${match[1].replace(/\D/g, "")}`);
    if (phone.isValid) found.add(phone.normalized);
  }
  return [...found];
}

/** A guardian's phone in any stored format ("84912…", "0912 345 678", "+84 …") → 0xxxxxxxxx, or null. */
export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const phone = normalizeVietnamPhoneNumber(value);
  return phone.isValid ? phone.normalized : null;
}

/** " a b " so a whole-word search is one `includes`. */
function padded(value: string): string {
  return value ? ` ${value} ` : "";
}

interface PreparedStudent {
  code: string;
  exactName: string;
  foldedName: string;
  guardianNames: string[];
  id: string;
  phones: Set<string>;
}

interface PreparedGroup {
  exact: string;
  folded: string;
  group: MatchGroup;
  phones: Set<string>;
}

function prepareStudent(student: MatchStudent): PreparedStudent {
  const exactName = normalizeExact(student.fullName);
  const foldedName = normalizeForMatch(student.fullName);
  return {
    code: padded(normalizeForMatch(student.publicCode)),
    // A one-word name ("An") would match far too many groups.
    exactName: exactName.includes(" ") ? padded(exactName) : "",
    foldedName: foldedName.includes(" ") ? padded(foldedName) : "",
    guardianNames: student.guardians
      .map((guardian) => normalizeForMatch(guardian.fullName))
      .filter((name) => name.includes(" "))
      .map(padded),
    id: student.id,
    phones: new Set(student.guardians.flatMap((guardian) => guardian.phones)),
  };
}

function scoreGroup(student: PreparedStudent, group: PreparedGroup): MatchReason[] {
  const reasons: MatchReason[] = [];
  if (student.code && group.folded.includes(student.code)) reasons.push("student_code");
  if (student.exactName && group.exact.includes(student.exactName)) reasons.push("student_name");
  else if (student.foldedName && group.folded.includes(student.foldedName)) reasons.push("student_name_loose");
  if (group.phones.size > 0 && [...student.phones].some((phone) => group.phones.has(phone))) reasons.push("guardian_phone");
  if (student.guardianNames.some((name) => group.folded.includes(name))) reasons.push("guardian_name");
  return reasons;
}

/**
 * Only the student's own code, own name with tone marks, or own name without
 * tone marks plus a guardian phone can pre-tick a group, and never a large one.
 * Guardian evidence alone (siblings share it) never does.
 */
function canBeSure(pair: Pair): boolean {
  const members = pair.group.groupMembersCount;
  if (members !== null && members > MAX_SURE_GROUP_MEMBERS) return false;
  const has = (reason: MatchReason) => pair.reasons.includes(reason);
  return has("student_code") || has("student_name") || (has("student_name_loose") && has("guardian_phone"));
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
 * gets a group by luck; a guardian phone in the name breaks such ties. A
 * stronger pair that cannot be sure (guardian evidence only) blocks its group
 * and student too.
 *
 * `rivals` are students who get no row (already linked, reserved, withdrawn):
 * they compete for groups, so a group named after a former student with the
 * same name is never handed to the current one.
 */
export function matchStudentsToGroups(students: MatchStudent[], groups: MatchGroup[], rivals: MatchStudent[] = []): StudentGroupMatch[] {
  const prepared: PreparedGroup[] = groups
    .map((group) => {
      const raw = group.groupName ?? "";
      return { exact: padded(normalizeExact(raw)), folded: padded(normalizeForMatch(raw)), group, phones: new Set(extractPhones(raw)) };
    })
    .filter((entry) => entry.folded || entry.phones.size > 0);

  const pairs: Pair[] = [];
  const pairsByStudent = new Map<string, Pair[]>();
  const pairsByGroup = new Map<string, Pair[]>();
  for (const student of [...students, ...rivals].map(prepareStudent)) {
    const own: Pair[] = [];
    for (const entry of prepared) {
      const reasons = scoreGroup(student, entry);
      if (reasons.length === 0) continue;
      const score = reasons.reduce((sum, reason) => sum + REASON_SCORE[reason], 0);
      const pair = { group: entry.group, reasons, score, studentId: student.id };
      own.push(pair);
      const onGroup = pairsByGroup.get(entry.group.externalThreadId) ?? [];
      onGroup.push(pair);
      pairsByGroup.set(entry.group.externalThreadId, onGroup);
    }
    own.sort((a, b) => b.score - a.score);
    pairsByStudent.set(student.id, own);
    pairs.push(...own);
  }

  const assigned = new Map<string, Pair>();
  const takenGroups = new Set<string>();
  const blockedStudents = new Set<string>();
  const blockedGroups = new Set<string>();
  const block = (pair: Pair) => {
    blockedStudents.add(pair.studentId);
    blockedGroups.add(pair.group.externalThreadId);
  };
  for (const pair of pairs.filter((candidate) => candidate.score >= STRONG_SCORE).sort((a, b) => b.score - a.score)) {
    const threadId = pair.group.externalThreadId;
    if (takenGroups.has(threadId)) continue;
    if (assigned.has(pair.studentId)) {
      // The group names a student who already has a better one: not safe to hand to anyone else.
      blockedGroups.add(threadId);
      continue;
    }
    if (blockedStudents.has(pair.studentId) || blockedGroups.has(threadId)) continue;
    const tied = [...(pairsByStudent.get(pair.studentId) ?? []), ...(pairsByGroup.get(threadId) ?? [])].filter(
      (other) =>
        other !== pair &&
        other.score === pair.score &&
        !assigned.has(other.studentId) &&
        !takenGroups.has(other.group.externalThreadId),
    );
    if (tied.length > 0 || !canBeSure(pair)) {
      block(pair);
      tied.forEach(block);
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
