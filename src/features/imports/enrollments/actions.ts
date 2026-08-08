"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

import type {
  EnrollmentImportDryRunResult,
  EnrollmentImportRawRow,
} from "./types";

export interface DryRunActionResponse {
  success: boolean;
  error?: string;
  data?: EnrollmentImportDryRunResult;
}

export async function dryRunStudentEnrollmentImportAction(
  academicYearCode: string,
  rows: EnrollmentImportRawRow[]
): Promise<DryRunActionResponse> {
  const supabase = await createSupabaseServerClient();

  // 1. Check Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Yêu cầu đăng nhập để thực hiện tính năng này." };
  }

  // 2. Payload validation
  if (!academicYearCode || !academicYearCode.trim()) {
    return { success: false, error: "Mã năm học không được để trống." };
  }

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: "Danh sách dòng dữ liệu import không được để trống." };
  }

  if (rows.length > 1000) {
    return { success: false, error: "Số lượng dòng import tối đa là 1000 dòng." };
  }

  // 3. Call Dry-Run RPC ONLY
  try {
    const { data, error } = await supabase.rpc("dry_run_student_enrollment_import", {
      p_academic_year_code: academicYearCode.trim(),
      p_rows: rows as unknown as Json,
    });

    if (error) {
      return {
        success: false,
        error: `Lỗi kiểm tra Dry-Run: ${error.message || "Giao dịch thất bại."}`,
      };
    }

    return {
      success: true,
      data: data as unknown as EnrollmentImportDryRunResult,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định khi thực hiện Dry-Run.";
    return {
      success: false,
      error: message,
    };
  }
}
