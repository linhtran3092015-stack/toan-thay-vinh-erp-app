"use server";

import { z } from "zod";

import { searchClassEnrollmentCandidates, type ClassEnrollmentCandidate } from "@/features/classes/detail/class-detail-data";
import {
  ENROLLMENT_SEARCH_FAILED_MESSAGE,
  ENROLLMENT_SEARCH_MAX_LENGTH,
  ENROLLMENT_SEARCH_MIN_LENGTH,
} from "@/features/classes/detail/class-detail-models";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedMessage } from "@/lib/permissions/labels";

export type EnrollmentCandidateSearchResult =
  | { candidates: ClassEnrollmentCandidate[]; status: "success"; truncated: boolean }
  | { message: string; status: "error" };

const querySchema = z
  .string({ message: "Từ khóa tìm kiếm không hợp lệ." })
  .trim()
  .min(ENROLLMENT_SEARCH_MIN_LENGTH, `Nhập ít nhất ${ENROLLMENT_SEARCH_MIN_LENGTH} ký tự để tìm học sinh.`)
  .max(ENROLLMENT_SEARCH_MAX_LENGTH, `Từ khóa tìm kiếm tối đa ${ENROLLMENT_SEARCH_MAX_LENGTH} ký tự.`);

/**
 * Server-side search for the class enroll dialog: the page only ships the first
 * candidates, typing searches all students without enrollment history. Same
 * permissions as the route uses to offer enrolment: students.view and
 * students.manage_status.
 */
export async function searchEnrollmentCandidatesAction(query: string): Promise<EnrollmentCandidateSearchResult> {
  const parsed = querySchema.safeParse(query);

  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Từ khóa tìm kiếm không hợp lệ.", status: "error" };
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
    return { message: ENROLLMENT_SEARCH_FAILED_MESSAGE, status: "error" };
  }

  return { candidates: result.candidates, status: "success", truncated: result.truncated };
}
