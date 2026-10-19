import { normalizeStudentName } from "@/features/grading-submissions/matching";
import { formatTime } from "@/lib/datetime";

/**
 * Student list the Apps Script form shows for one birth year (plan §4.2). Only what the form
 * needs leaves the ERP: code, name, given name and today's sessions. A duplicate full name gets
 * the last 4 digits of the primary parent phone (masked in SQL, owner decision 18/10/2026).
 */

export interface GradingRosterRow {
  fullName: string;
  guardianPhoneLast4: string | null;
  nickname: string | null;
  publicCode: string;
  sessions: { classCode: string; endTime: string; id: string; startTime: string }[];
}

export interface GradingRosterSession {
  classCode: string;
  endTime: string;
  id: string;
  label: string;
  startTime: string;
}

export interface GradingRosterEntry {
  code: string;
  fullName: string;
  /** Name the Sheet's "Tên" column and comments use: nickname, else the last word. */
  givenName: string;
  /** Dropdown text; duplicates carry "(PH ***1234)". */
  label: string;
  sessions: GradingRosterSession[];
}

const collator = new Intl.Collator("vi");

export function lastNameWord(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  return words[words.length - 1] ?? "";
}

export function maskedPhoneHint(last4: string | null): string | null {
  return last4 && /^\d{4}$/.test(last4) ? `PH ***${last4}` : null;
}

export function buildGradingRoster(rows: readonly GradingRosterRow[]): GradingRosterEntry[] {
  const nameCounts = new Map<string, number>();
  for (const row of rows) {
    const key = normalizeStudentName(row.fullName);
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }

  const entries = rows.map((row) => {
    const fullName = row.fullName.trim();
    const duplicate = (nameCounts.get(normalizeStudentName(fullName)) ?? 0) > 1;
    const phoneHint = maskedPhoneHint(row.guardianPhoneLast4);
    const entry: GradingRosterEntry = {
      code: row.publicCode,
      fullName,
      givenName: row.nickname?.trim() || lastNameWord(fullName),
      label: duplicate ? withHint(fullName, [phoneHint ?? row.publicCode]) : fullName,
      sessions: row.sessions.map((session) => ({
        classCode: session.classCode,
        endTime: formatTime(session.endTime),
        id: session.id,
        label: `${session.classCode} · ${formatTime(session.startTime)}–${formatTime(session.endTime)}`,
        startTime: formatTime(session.startTime),
      })),
    };
    return { entry, phoneHint };
  });

  // Two namesakes whose parents share the last 4 digits still need telling apart.
  const labelCounts = new Map<string, number>();
  for (const { entry } of entries) labelCounts.set(entry.label, (labelCounts.get(entry.label) ?? 0) + 1);
  for (const { entry, phoneHint } of entries) {
    if (phoneHint && (labelCounts.get(entry.label) ?? 0) > 1) {
      entry.label = withHint(entry.fullName, [phoneHint, entry.code]);
    }
  }

  return entries
    .map(({ entry }) => entry)
    .sort(
      (left, right) =>
        collator.compare(lastNameWord(left.fullName), lastNameWord(right.fullName)) ||
        collator.compare(left.fullName, right.fullName) ||
        left.code.localeCompare(right.code),
    );
}

function withHint(fullName: string, hints: string[]): string {
  return `${fullName} (${hints.join(", ")})`;
}
