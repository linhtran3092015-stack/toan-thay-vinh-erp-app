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

export interface CreateBatchActionResponse {
  success: boolean;
  error?: string;
  data?: {
    batch: Record<string, unknown>;
    dry_run: EnrollmentImportDryRunResult;
  };
}

export interface CommitBatchActionResponse {
  success: boolean;
  error?: string;
  data?: {
    batch_id: string;
    status: string;
    committed_new_count: number;
    reused_matching_count: number;
    committed_at: string;
  };
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

export async function createStudentEnrollmentImportBatchAction(
  sourceFilename: string,
  sourceSha256: string,
  reason: string,
  academicYearCode: string,
  rows: EnrollmentImportRawRow[]
): Promise<CreateBatchActionResponse> {
  const supabase = await createSupabaseServerClient();

  // 1. Check Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Yêu cầu đăng nhập để thực hiện tính năng này." };
  }

  // 2. Validation
  if (!sourceFilename || !sourceFilename.trim()) {
    return { success: false, error: "Tên file nguồn không được để trống." };
  }

  if (!sourceSha256 || !sourceSha256.trim()) {
    return { success: false, error: "Mã SHA-256 không được để trống." };
  }

  if (!reason || !reason.trim()) {
    return { success: false, error: "Lý do tạo batch không được để trống." };
  }

  if (!academicYearCode || !academicYearCode.trim()) {
    return { success: false, error: "Mã năm học không được để trống." };
  }

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return { success: false, error: "Danh sách dòng dữ liệu không được để trống." };
  }

  if (rows.length > 1000) {
    return { success: false, error: "Số lượng dòng import tối đa là 1000 dòng." };
  }

  // 3. Call Create Batch RPC ONLY (DO NOT COMMIT)
  try {
    const { data, error } = await supabase.rpc("create_student_enrollment_import_batch", {
      p_source_filename: sourceFilename.trim(),
      p_source_sha256: sourceSha256.trim().toLowerCase(),
      p_reason: reason.trim(),
      p_academic_year_code: academicYearCode.trim(),
      p_rows: rows as unknown as Json,
    });

    if (error) {
      return {
        success: false,
        error: `Lỗi tạo Batch staging: ${error.message || "Giao dịch tạo batch thất bại."}`,
      };
    }

    return {
      success: true,
      data: data as unknown as { batch: Record<string, unknown>; dry_run: EnrollmentImportDryRunResult },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định khi tạo Batch staging.";
    return {
      success: false,
      error: message,
    };
  }
}

export async function commitStudentEnrollmentImportBatchAction(
  batchId: string,
  reason: string
): Promise<CommitBatchActionResponse> {
  const supabase = await createSupabaseServerClient();

  // 1. Check Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Yêu cầu đăng nhập để thực hiện tính năng này." };
  }

  // 2. Validation
  if (!batchId || !batchId.trim()) {
    return { success: false, error: "Batch ID không được để trống." };
  }

  if (!reason || !reason.trim()) {
    return { success: false, error: "Lý do commit ghi danh không được để trống." };
  }

  // 3. Call Commit RPC EXACTLY ONCE
  try {
    const { data, error } = await supabase.rpc("commit_student_enrollment_import_batch", {
      p_batch_id: batchId.trim(),
      p_reason: reason.trim(),
    });

    if (error) {
      return {
        success: false,
        error: `Lỗi Commit ghi danh: ${error.message || "Giao dịch commit thất bại."}`,
      };
    }

    return {
      success: true,
      data: data as unknown as {
        batch_id: string;
        status: string;
        committed_new_count: number;
        reused_matching_count: number;
        committed_at: string;
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định khi commit batch ghi danh.";
    return {
      success: false,
      error: message,
    };
  }
}
