"use server";

import { z } from "zod";

import { getClassTuitionPeriod, getClassTuitionView } from "@/features/classes/detail/class-tuition-data";
import { CLASS_TUITION_PERMISSIONS, type ClassTuitionViewResult } from "@/features/classes/detail/class-tuition-models";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { permissionDeniedMessage } from "@/lib/permissions/labels";

const inputSchema = z.object({
  classId: z.string().uuid(),
  periodId: z.string().uuid(),
});

/**
 * Loads another period for the class tuition tab (the page ships only the
 * default one). Read-only: payment requests are still created by locking the
 * period on its own page.
 */
export async function loadClassTuitionPeriodAction(classId: string, periodId: string): Promise<ClassTuitionViewResult> {
  const parsed = inputSchema.safeParse({ classId, periodId });

  if (!parsed.success) {
    return { message: "Kỳ thu không hợp lệ.", status: "error" };
  }

  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return { message: "Không thể xác minh quyền thao tác. Vui lòng đăng nhập lại hoặc thử lại.", status: "error" };
  }

  for (const permission of CLASS_TUITION_PERMISSIONS) {
    if (!permissionResult.permissions.includes(permission)) {
      return { message: permissionDeniedMessage(permission), status: "error" };
    }
  }

  const period = await getClassTuitionPeriod(parsed.data.periodId);

  if (!period) {
    return { message: "Không tìm thấy kỳ thu này.", status: "error" };
  }

  const view = await getClassTuitionView(parsed.data.classId, period, {
    canViewPayments: permissionResult.permissions.includes("payments.view"),
  });

  return view ? { status: "success", view } : { message: "Chưa tải được học phí của kỳ này, thử lại.", status: "error" };
}
