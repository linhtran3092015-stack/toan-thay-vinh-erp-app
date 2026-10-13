"use server";

import { z } from "zod";

import { searchClassEnrollmentCandidates, type ClassEnrollmentCandidate } from "@/features/classes/detail/class-detail-data";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedMessage } from "@/lib/permissions/labels";

/** Shortest query the class enroll dialog sends to the server. */
const MIN_QUERY_LENGTH = 2;

export type EnrollmentCandidateSearchResult =
  | { candidates: ClassEnrollmentCandidate[]; status: "success"; truncated: boolean }
  | { message: string; status: "error" };

const querySchema = z.string().trim().min(MIN_QUERY_LENGTH).max(100);

/**
 * Server-side search for the class enroll dialog: the page only ships the first
 * candidates, typing searches all students without enrollment history. Same
 * permissions as the route uses to offer enrolment: students.view and
 * students.manage_status.
 */
export async function searchEnrollmentCandidatesAction(query: string): Promise<EnrollmentCandidateSearchResult> {
  const parsed = querySchema.safeParse(query);

  if (!parsed.success) {
    return { message: `Nhập ít nhất ${MIN_QUERY_LENGTH} ký tự để tìm học sinh.`, status: "error" };
  }

  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return { message: "Không thể xác minh quyền thao tác. Vui lòng đăng nhập lại hoặc thử lại.", status: "error" };
  }

  for (const permission of ["students.view", "students.manage_status"] as const) {
    if (!permissionResult.permissions.includes(permission)) {
      return { message: permissionDeniedMessage(permission), status: "error" };
    }
  }

  const result = await searchClassEnrollmentCandidates(parsed.data);

  if (!result) {
    return { message: "Chưa tìm được học sinh, thử lại.", status: "error" };
  }

  return { candidates: result.candidates, status: "success", truncated: result.truncated };
}
