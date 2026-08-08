"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.generated";

import {
  commitClassScheduleImportBatchSchema,
  createClassScheduleImportBatchSchema,
  dryRunClassScheduleImportSchema,
} from "./schemas";
import type {
  ClassScheduleImportActionResult,
  ClassScheduleImportBatchRecord,
  CommitClassScheduleImportBatchInput,
  CreateClassScheduleImportBatchInput,
  DryRunClassScheduleImportInput,
  DryRunClassScheduleImportResult,
} from "./types";

export async function dryRunClassScheduleImportAction(
  input: DryRunClassScheduleImportInput
): Promise<ClassScheduleImportActionResult<DryRunClassScheduleImportResult>> {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        code: "session_required",
        message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
        ok: false,
      };
    }

    // Permission check via RPC
    const { data: hasPerm, error: permError } = await supabase.rpc("has_permission", {
      required_permission: "imports.classes",
    });

    if (permError || !hasPerm) {
      return {
        code: "forbidden",
        message: "Bạn không có quyền thực hiện kiểm tra dry-run import lớp học & lịch học (imports.classes).",
        ok: false,
      };
    }

    // Validate payload schema
    const parsed = dryRunClassScheduleImportSchema.safeParse(input);
    if (!parsed.success) {
      return {
        code: "invalid_request",
        fieldErrors: parsed.error.flatten().fieldErrors,
        message: "Dữ liệu đầu vào không hợp lệ.",
        ok: false,
      };
    }

    // Call ONLY dry_run_class_schedule_import RPC
    const { data, error } = await supabase.rpc("dry_run_class_schedule_import", {
      p_academic_year_code: parsed.data.academic_year_code,
      p_classes: parsed.data.classes as unknown as Json,
      p_schedules: parsed.data.schedules as unknown as Json,
    });

    if (error) {
      return {
        code: "database_error",
        message: `Lỗi kiểm tra dữ liệu từ cơ sở dữ liệu: ${error.message}`,
        ok: false,
      };
    }

    if (!data) {
      return {
        code: "invalid_response",
        message: "Cơ sở dữ liệu không trả về kết quả kiểm tra dry-run.",
        ok: false,
      };
    }

    const typedResult = data as unknown as DryRunClassScheduleImportResult;

    return {
      data: typedResult,
      ok: true,
    };
  } catch (err) {
    return {
      code: "database_error",
      message: `Đã xảy ra lỗi không xác định: ${err instanceof Error ? err.message : String(err)}`,
      ok: false,
    };
  }
}

export async function createClassScheduleImportBatchAction(
  input: CreateClassScheduleImportBatchInput
): Promise<ClassScheduleImportActionResult<ClassScheduleImportBatchRecord>> {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        code: "session_required",
        message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
        ok: false,
      };
    }

    // Permission check via RPC
    const { data: hasPerm, error: permError } = await supabase.rpc("has_permission", {
      required_permission: "imports.classes",
    });

    if (permError || !hasPerm) {
      return {
        code: "forbidden",
        message: "Bạn không có quyền thực hiện tạo batch import lớp học & lịch học (imports.classes).",
        ok: false,
      };
    }

    // Validate payload schema
    const parsed = createClassScheduleImportBatchSchema.safeParse(input);
    if (!parsed.success) {
      return {
        code: "invalid_request",
        fieldErrors: parsed.error.flatten().fieldErrors,
        message: "Dữ liệu đầu vào không hợp lệ. Vui lòng kiểm tra lý do và xác nhận.",
        ok: false,
      };
    }

    // Pre-check for duplicate SHA to provide existing batch ID if available
    const { data: existingBatch } = await supabase
      .from("class_schedule_import_batches")
      .select("id, status")
      .eq("source_sha256", parsed.data.source_sha256.trim().toLowerCase())
      .maybeSingle();

    if (existingBatch) {
      return {
        code: "conflict",
        existingBatchId: existingBatch.id,
        message: "File này đã được tạo batch trước đó.",
        ok: false,
      };
    }

    // Call ONLY create_class_schedule_import_batch RPC
    const { data, error } = await supabase.rpc("create_class_schedule_import_batch", {
      p_academic_year_code: parsed.data.academic_year_code,
      p_classes: parsed.data.classes as unknown as Json,
      p_reason: parsed.data.reason.trim(),
      p_schedules: parsed.data.schedules as unknown as Json,
      p_source_filename: parsed.data.source_filename.trim(),
      p_source_sha256: parsed.data.source_sha256.trim().toLowerCase(),
    });

    if (error) {
      if (
        error.message.includes("duplicate") ||
        error.message.includes("source_sha256") ||
        error.message.includes("already exists") ||
        error.code === "23505"
      ) {
        return {
          code: "conflict",
          message: "File này đã được tạo batch trước đó.",
          ok: false,
        };
      }

      return {
        code: "database_error",
        message: `Lỗi tạo batch từ cơ sở dữ liệu: ${error.message}`,
        ok: false,
      };
    }

    if (!data) {
      return {
        code: "invalid_response",
        message: "Cơ sở dữ liệu không trả về thông tin batch vừa tạo.",
        ok: false,
      };
    }

    const typedRecord = data as unknown as ClassScheduleImportBatchRecord;

    revalidatePath("/imports/classes");

    return {
      data: typedRecord,
      ok: true,
    };
  } catch (err) {
    return {
      code: "database_error",
      message: `Đã xảy ra lỗi không xác định: ${err instanceof Error ? err.message : String(err)}`,
      ok: false,
    };
  }
}

export async function commitClassScheduleImportBatchAction(
  input: CommitClassScheduleImportBatchInput
): Promise<ClassScheduleImportActionResult<ClassScheduleImportBatchRecord>> {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        code: "session_required",
        message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
        ok: false,
      };
    }

    // Permission check via RPC
    const { data: hasPerm, error: permError } = await supabase.rpc("has_permission", {
      required_permission: "imports.classes",
    });

    if (permError || !hasPerm) {
      return {
        code: "forbidden",
        message: "Bạn không có quyền thực hiện import lớp học & lịch học (imports.classes).",
        ok: false,
      };
    }

    // Validate payload schema
    const parsed = commitClassScheduleImportBatchSchema.safeParse(input);
    if (!parsed.success) {
      return {
        code: "invalid_request",
        fieldErrors: parsed.error.flatten().fieldErrors,
        message: "Dữ liệu đầu vào không hợp lệ. Vui lòng tích chọn xác nhận và nhập chính xác văn bản xác nhận.",
        ok: false,
      };
    }

    // Call ONLY commit_class_schedule_import_batch RPC
    const { data, error } = await supabase.rpc("commit_class_schedule_import_batch", {
      p_batch_id: parsed.data.batch_id,
      p_reason: parsed.data.reason.trim(),
    });

    if (error) {
      let friendlyMessage = `Lỗi thực thi import: ${error.message}`;

      if (error.message.includes("BATCH_ALREADY_COMMITTED")) {
        friendlyMessage = "Batch này đã được import trước đó.";
      } else if (error.message.includes("BATCH_NOT_READY_TO_COMMIT")) {
        friendlyMessage = "Batch chưa ở trạng thái sẵn sàng để import hoặc còn lỗi xung đột.";
      } else if (error.message.includes("BATCH_HAS_UNRESOLVED_CONFLICTS")) {
        friendlyMessage = "Batch chứa dòng dữ liệu bị xung đột hoặc không hợp lệ. Không thể import.";
      } else if (error.message.includes("CLASS_CODE_CREATED_SINCE_DRY_RUN")) {
        friendlyMessage = "Mã lớp học đã được tạo trong hệ thống kể từ lần dry-run gần nhất. Xung đột dữ liệu.";
      } else if (error.message.includes("SCHEDULE_SLOT_CREATED_SINCE_DRY_RUN")) {
        friendlyMessage = "Lịch học đã được tạo trong hệ thống kể từ lần dry-run gần nhất. Xung đột slot lịch.";
      } else if (error.message.includes("TARGET_ACADEMIC_YEAR_INVALID")) {
        friendlyMessage = "Năm học mục tiêu không hợp lệ hoặc đã bị lưu trữ (archived).";
      }

      return {
        code: "database_error",
        message: friendlyMessage,
        ok: false,
      };
    }

    if (!data) {
      return {
        code: "invalid_response",
        message: "Cơ sở dữ liệu không trả về kết quả sau khi ghi batch.",
        ok: false,
      };
    }

    const typedRecord = data as unknown as ClassScheduleImportBatchRecord;

    revalidatePath("/imports/classes");
    revalidatePath(`/imports/classes/${parsed.data.batch_id}`);
    revalidatePath("/classes");

    return {
      data: typedRecord,
      ok: true,
    };
  } catch (err) {
    return {
      code: "database_error",
      message: `Đã xảy ra lỗi không xác định: ${err instanceof Error ? err.message : String(err)}`,
      ok: false,
    };
  }
}
