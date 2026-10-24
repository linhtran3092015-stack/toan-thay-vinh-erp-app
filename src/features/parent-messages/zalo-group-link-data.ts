import "server-only";

import {
  matchStudentsToGroups,
  normalizePhone,
  type GroupCandidate,
  type MatchStudent,
  type StudentGroupMatch,
} from "@/features/parent-messages/zalo-group-matching";
import { getSystemSettings, getZaloCenterAccountId } from "@/features/settings/system-settings-data";
import { compareStudentNames } from "@/lib/student-order";
import { fetchAllPages } from "@/lib/supabase/fetch-all-pages";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isZaloCrmConfigured, listAllZaloGroupsCached, listZaloAccounts, type ZaloCrmAccount } from "@/lib/zalo-crm";

/** Students who attend sessions now; only they get absence and comment messages. */
const STUDYING_STATUSES = ["active", "resumed"] as const;

/** Each line of the "Kết nối ZaloCRM" checklist on the bulk link page. */
export interface ZaloConnectionStatus {
  /** Nick chosen in Cài đặt → Chung, as ZaloCRM reports it (null when not found there). */
  centerAccount: ZaloCrmAccount | null;
  centerAccountId: string;
  centerAccountName: string;
  /** ZALOCRM_BASE_URL and ZALOCRM_API_KEY are set on the server. */
  configured: boolean;
  /** Why ZaloCRM could not be read (wrong key, server down). */
  crmError: string | null;
  groupsError: string | null;
  /** Groups actually read (after dropping duplicates); fewer than `groupsTotal` when truncated. */
  groupsListed: number | null;
  groupsTotal: number | null;
  groupsTruncated: boolean;
  linkedStudents: number;
  studyingStudents: number;
}

export interface ZaloLinkStudent {
  birthYear: number;
  classCodes: string[];
  fullName: string;
  /** Empty without guardians.view: names and phones still feed the matching on the server. */
  guardianSummary: string;
  id: string;
  publicCode: string;
}

export interface ZaloGroupLinkWorkspace {
  matches: StudentGroupMatch[];
  status: ZaloConnectionStatus;
  /** Unlinked studying students, in the given-name order used on every student list. */
  students: ZaloLinkStudent[];
}

export type ZaloGroupLinkWorkspaceResult = { data: ZaloGroupLinkWorkspace; ok: true } | { error: string; ok: false };

interface StudentRow {
  birth_year: number;
  full_name: string;
  id: string;
  lifecycle_status: string;
  public_code: string;
  zalo_group_thread_id: string | null;
}

/**
 * Everything the bulk link page needs. Groups are matched against every
 * student: unlinked studying students get rows, all others (linked, reserved,
 * withdrawn) compete as rivals so a namesake's group is never pre-ticked.
 */
export async function getZaloGroupLinkWorkspace({
  includeGuardianDetails,
}: {
  /** guardians.view: show guardian names and phones in the table. */
  includeGuardianDetails: boolean;
}): Promise<ZaloGroupLinkWorkspaceResult> {
  const supabase = await createSupabaseServerClient();
  const [settings, centerAccountId] = await Promise.all([getSystemSettings(), getZaloCenterAccountId()]);
  const configured = isZaloCrmConfigured();

  const [studentsResult, guardianLinksResult, guardiansResult, enrollmentsResult, classesResult] = await Promise.all([
    fetchAllPages<StudentRow>((from, to) =>
      supabase
        .from("students")
        .select("id, public_code, full_name, birth_year, lifecycle_status, zalo_group_thread_id")
        .order("id")
        .range(from, to),
    ),
    fetchAllPages<{ guardian_id: string; id: string; is_primary: boolean; student_id: string }>((from, to) =>
      supabase.from("student_guardians").select("id, student_id, guardian_id, is_primary").is("ended_at", null).order("id").range(from, to),
    ),
    fetchAllPages<{ full_name: string; id: string; normalized_phone: string | null; phone: string; zalo: string | null }>((from, to) =>
      supabase.from("guardians").select("id, full_name, phone, normalized_phone, zalo").order("id").range(from, to),
    ),
    fetchAllPages<{ class_id: string; id: string; student_id: string }>((from, to) =>
      supabase.from("student_enrollments").select("id, student_id, class_id").eq("status", "active").is("effective_to", null).order("id").range(from, to),
    ),
    fetchAllPages<{ code: string; id: string }>((from, to) => supabase.from("classes").select("id, code").order("id").range(from, to)),
  ]);
  if (studentsResult.error || guardianLinksResult.error || guardiansResult.error || enrollmentsResult.error || classesResult.error) {
    return { error: "Không tải được danh sách học sinh và phụ huynh.", ok: false };
  }

  const allStudents = studentsResult.data ?? [];
  const studyingStatuses: readonly string[] = STUDYING_STATUSES;
  const studying = allStudents.filter((row) => studyingStatuses.includes(row.lifecycle_status));
  // Groups already linked to any student (studying or not) cannot be offered again.
  const linkedThreads = new Set(allStudents.map((row) => row.zalo_group_thread_id).filter((id): id is string => Boolean(id)));
  const guardiansById = new Map((guardiansResult.data ?? []).map((row) => [row.id, row]));
  const classCodeById = new Map((classesResult.data ?? []).map((row) => [row.id, row.code]));

  const guardiansByStudent = new Map<string, { fullName: string; isPrimary: boolean; phones: string[] }[]>();
  for (const link of guardianLinksResult.data ?? []) {
    const guardian = guardiansById.get(link.guardian_id);
    if (!guardian) continue;
    const phones = [...new Set([guardian.normalized_phone, guardian.phone, guardian.zalo].map(normalizePhone).filter((phone): phone is string => Boolean(phone)))];
    const list = guardiansByStudent.get(link.student_id) ?? [];
    list.push({ fullName: guardian.full_name, isPrimary: link.is_primary, phones });
    guardiansByStudent.set(link.student_id, list);
  }
  const classCodesByStudent = new Map<string, Set<string>>();
  for (const enrollment of enrollmentsResult.data ?? []) {
    const code = classCodeById.get(enrollment.class_id);
    if (!code) continue;
    const codes = classCodesByStudent.get(enrollment.student_id) ?? new Set<string>();
    codes.add(code);
    classCodesByStudent.set(enrollment.student_id, codes);
  }

  const unlinked = studying
    .filter((row) => !row.zalo_group_thread_id)
    .sort((left, right) => compareStudentNames(left.full_name, right.full_name));
  const students: ZaloLinkStudent[] = unlinked.map((row) => {
    const guardians = [...(guardiansByStudent.get(row.id) ?? [])].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
    return {
      birthYear: row.birth_year,
      classCodes: [...(classCodesByStudent.get(row.id) ?? [])].sort(),
      fullName: row.full_name,
      guardianSummary: includeGuardianDetails
        ? guardians.map((guardian) => [guardian.fullName, guardian.phones[0]].filter(Boolean).join(" · ")).join("; ")
        : "",
      id: row.id,
      publicCode: row.public_code,
    };
  });

  const status: ZaloConnectionStatus = {
    centerAccount: null,
    centerAccountId,
    centerAccountName: settings["zalo.center_account_name"].trim(),
    configured,
    crmError: null,
    groupsError: null,
    groupsListed: null,
    groupsTotal: null,
    groupsTruncated: false,
    linkedStudents: studying.length - unlinked.length,
    studyingStudents: studying.length,
  };
  if (!configured) return { data: { matches: [], status, students }, ok: true };

  const accounts = await listZaloAccounts();
  if (!accounts.ok) {
    status.crmError = accounts.error;
    return { data: { matches: [], status, students }, ok: true };
  }
  status.centerAccount = accounts.data.find((account) => account.id === centerAccountId) ?? null;
  // Same gate as checklist step 3: no groups (and no table) until the center nick is in ZaloCRM and connected.
  if (!centerAccountId || status.centerAccount?.status !== "connected") return { data: { matches: [], status, students }, ok: true };

  const groups = await listAllZaloGroupsCached(centerAccountId);
  if (!groups.ok) {
    status.groupsError = groups.error;
    return { data: { matches: [], status, students }, ok: true };
  }
  status.groupsListed = groups.data.groups.length;
  status.groupsTotal = groups.data.total;
  status.groupsTruncated = groups.data.truncated;

  const toMatchStudent = (row: StudentRow): MatchStudent => ({
    fullName: row.full_name,
    guardians: (guardiansByStudent.get(row.id) ?? []).map(({ fullName, phones }) => ({ fullName, phones })),
    id: row.id,
    publicCode: row.public_code,
  });
  const unlinkedIds = new Set(unlinked.map((row) => row.id));
  const rivals = allStudents.filter((row) => !unlinkedIds.has(row.id)).map(toMatchStudent);
  const freeGroups = groups.data.groups
    .filter((group) => !linkedThreads.has(group.externalThreadId))
    .map(({ externalThreadId, groupMembersCount, groupName, zaloAccountId }) => ({ externalThreadId, groupMembersCount, groupName, zaloAccountId }));
  let matches = matchStudentsToGroups(unlinked.map(toMatchStudent), freeGroups, rivals);
  if (!includeGuardianDetails) {
    // Guardian names and phones still steer the matching, but the page never learns which group matched a guardian.
    const strip = (candidate: GroupCandidate) => ({ ...candidate, reasons: candidate.reasons.filter((reason) => !reason.startsWith("guardian_")) });
    matches = matches.map((match) => ({ ...match, candidates: match.candidates.map(strip), suggestion: match.suggestion && strip(match.suggestion) }));
  }
  return { data: { matches, status, students }, ok: true };
}
