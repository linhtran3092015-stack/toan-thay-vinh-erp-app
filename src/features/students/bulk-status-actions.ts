"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { StudentLifecycleStatus } from "@/types/domain";
import { isSupabaseConfigured } from "@/lib/env";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const studentLifecycleStatusSchema = z.enum([
  "active",
  "completed",
  "interested",
  "pending_enrollment_confirmation",
  "reserved",
  "resumed",
  "trial_booked",
  "trial_completed",
  "waiting_class",
]);

export const previewBulkStudentStatusInputSchema = z.object({
  sourceStatus: studentLifecycleStatusSchema,
  studentIds: z.array(z.string().uuid()).optional(),
});

export type PreviewBulkStudentStatusInput = z.infer<
  typeof previewBulkStudentStatusInputSchema
>;

export const executeBulkStudentStatusInputSchema = z.object({
  expectedCount: z.number().int().min(0),
  reason: z.string().trim().max(500).optional(),
  sourceStatus: studentLifecycleStatusSchema,
  studentIds: z.array(z.string().uuid()).optional(),
  targetStatus: studentLifecycleStatusSchema,
}).refine((data) => data.sourceStatus !== data.targetStatus, {
  message: "Trạng thái đích phải khác trạng thái nguồn.",
  path: ["targetStatus"],
});

export type ExecuteBulkStudentStatusInput = z.infer<
  typeof executeBulkStudentStatusInputSchema
>;

export type BulkStudentStatusActionResult<T> =
  | { data: T; ok: true }
  | { code: string; message: string; ok: false };

async function requireManageStatusPermission(): Promise<{ code: string; message: string; ok: false } | null> {
  const permResult = await getCachedDatabasePermissions();
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
      message: "Bạn không có quyền chuyển trạng thái học viên (`students.manage_status`).",
      ok: false,
    };
  }
  return null;
}

export async function previewBulkStudentStatusTransitionAction(
  input: PreviewBulkStudentStatusInput,
): Promise<
  BulkStudentStatusActionResult<{
    count: number;
    sourceStatus: StudentLifecycleStatus;
  }>
> {
  const permFailure = await requireManageStatusPermission();
  if (permFailure) return permFailure;

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
    const supabase = await createSupabaseServerClient();
    const { sourceStatus, studentIds } = parsed.data;

    let query = supabase
      .from("students")
      .select("*", { count: "exact", head: true })
      .eq("lifecycle_status", sourceStatus);

    if (studentIds && studentIds.length > 0) {
      query = query.in("id", studentIds);
    }

    const { count, error } = await query;

    if (error) {
      return {
        code: "query_failed",
        message: "Không thể đếm số lượng học sinh xem trước.",
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
  } catch {
    return {
      code: "system_error",
      message: "Hệ thống gặp lỗi khi xem trước.",
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
  const permFailure = await requireManageStatusPermission();
  if (permFailure) return permFailure;

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
        sourceStatus: (resultRecord?.source_status ?? sourceStatus) as StudentLifecycleStatus,
        targetStatus: (resultRecord?.target_status ?? targetStatus) as StudentLifecycleStatus,
      },
      ok: true,
    };
  } catch {
    return {
      code: "system_error",
      message: "Hệ thống gặp lỗi khi chuyển trạng thái hàng loạt.",
      ok: false,
    };
  }
}
