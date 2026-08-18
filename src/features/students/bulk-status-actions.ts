"use server";

import { revalidatePath } from "next/cache";

import type { StudentLifecycleStatus } from "@/types/domain";
import { isSupabaseConfigured } from "@/lib/env";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  type BulkStudentStatusActionResult,
  executeBulkStudentStatusInputSchema,
  type ExecuteBulkStudentStatusInput,
  previewBulkStudentStatusInputSchema,
  type PreviewBulkStudentStatusInput,
} from "./bulk-status-types";

async function requireManageStatusPermission(): Promise<{
  code: string;
  message: string;
  ok: false;
} | null> {
  try {
    const permResult = await getDatabasePermissions();
    if (!permResult.ok) {
      return {
        code: "permission_error",
        message: "Không thể xác minh quyền người dùng.",
        ok: false,
      };
    }
    if (!permResult.permissions.includes("students.manage_status")) {
      return {
        code: "forbidden",
        message:
          "Bạn không có quyền chuyển trạng thái học viên (`students.manage_status`).",
        ok: false,
      };
    }
    return null;
  } catch {
    return {
      code: "permission_error",
      message: "Không thể xác minh quyền người dùng.",
      ok: false,
    };
  }
}

export async function previewBulkStudentStatusTransitionAction(
  input: PreviewBulkStudentStatusInput,
): Promise<
  BulkStudentStatusActionResult<{
    count: number;
    sourceStatus: StudentLifecycleStatus;
  }>
> {
  const parsed = previewBulkStudentStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      code: "invalid_request",
      message: "Thông tin xem trước không hợp lệ.",
      ok: false,
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      code: "configuration_missing",
      message: "Chưa cấu hình Supabase.",
      ok: false,
    };
  }

  try {
    const permFailure = await requireManageStatusPermission();
    if (permFailure) return permFailure;

    const supabase = await createSupabaseServerClient();
    const { sourceStatus, studentIds } = parsed.data;

    let query = supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("lifecycle_status", sourceStatus);

    if (studentIds && studentIds.length > 0) {
      query = query.in("id", studentIds);
    }

    const { count, error } = await query;

    if (error) {
      return {
        code: "query_failed",
        message: `Không thể đếm số lượng học sinh xem trước: ${error.message}`,
        ok: false,
      };
    }

    return {
      data: {
        count: count ?? 0,
        sourceStatus,
      },
      ok: true,
    };
  } catch (err) {
    const sysMsg = err instanceof Error ? err.message : "Lỗi không xác định";
    return {
      code: "system_error",
      message: `Hệ thống gặp lỗi khi xem trước: ${sysMsg}`,
      ok: false,
    };
  }
}

export async function executeBulkStudentStatusTransitionAction(
  input: ExecuteBulkStudentStatusInput,
): Promise<
  BulkStudentStatusActionResult<{
    affectedCount: number;
    sourceStatus: StudentLifecycleStatus;
    targetStatus: StudentLifecycleStatus;
  }>
> {
  const parsed = executeBulkStudentStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message;
    return {
      code: "invalid_request",
      message: firstIssue ?? "Thông tin thực thi không hợp lệ.",
      ok: false,
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      code: "configuration_missing",
      message: "Chưa cấu hình Supabase.",
      ok: false,
    };
  }

  try {
    const permFailure = await requireManageStatusPermission();
    if (permFailure) return permFailure;

    const supabase = await createSupabaseServerClient();
    const { expectedCount, reason, sourceStatus, studentIds, targetStatus } =
      parsed.data;

    const { data, error } = await supabase.rpc(
      "bulk_transition_student_lifecycle_status" as never,
      {
        p_expected_count: expectedCount,
        p_reason: reason || null,
        p_source_status: sourceStatus,
        p_student_ids: studentIds && studentIds.length > 0 ? studentIds : null,
        p_target_status: targetStatus,
      } as never,
    );

    if (error) {
      return {
        code: "rpc_failed",
        message: error.message,
        ok: false,
      };
    }

    const resultRecord = data as {
      affected_count?: number;
      source_status?: string;
      target_status?: string;
    } | null;

    revalidatePath("/students");

    return {
      data: {
        affectedCount: Number(resultRecord?.affected_count ?? 0),
        sourceStatus: (resultRecord?.source_status ??
          sourceStatus) as StudentLifecycleStatus,
        targetStatus: (resultRecord?.target_status ??
          targetStatus) as StudentLifecycleStatus,
      },
      ok: true,
    };
  } catch (err) {
    const sysMsg = err instanceof Error ? err.message : "Lỗi không xác định";
    return {
      code: "system_error",
      message: `Hệ thống gặp lỗi khi chuyển trạng thái hàng loạt: ${sysMsg}`,
      ok: false,
    };
  }
}
