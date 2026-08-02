"use server";

import { revalidatePath } from "next/cache";

import type {
  AddCoachingNoteActionInput,
  AdvanceCoachingStatusActionInput,
  CoachingManagementActionState,
  CreateCoachingRecordActionInput,
} from "@/features/coaching/forms/coaching-action-types";
import {
  addCoachingNoteSchema,
  advanceCoachingStatusSchema,
  createCoachingRecordSchema,
} from "@/features/coaching/forms/coaching-schemas";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function createErrorState(
  message: string,
  fieldErrors?: CoachingManagementActionState["fieldErrors"],
): CoachingManagementActionState {
  return { fieldErrors, message, status: "error" };
}

async function getPermissionError(): Promise<string | null> {
  const permissionResult = await getDatabasePermissions();

  if (!permissionResult.ok) {
    return "Không thể xác minh quyền quản lý Coaching. Vui lòng đăng nhập lại hoặc thử lại.";
  }

  if (!permissionResult.permissions.includes("coaching.manage")) {
    return "Tài khoản hiện tại không có quyền coaching.manage.";
  }

  return null;
}

function getRpcErrorMessage(message: string): string {
  const knownMessages: Record<string, string> = {
    AUTHENTICATION_REQUIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    COACHING_ACTOR_PROFILE_NOT_FOUND: "Không tìm thấy hồ sơ người đang thao tác.",
    COACHING_ASSIGNEE_NOT_ELIGIBLE:
      "Người phụ trách phải là chủ trung tâm hoặc trợ lý đang hoạt động.",
    COACHING_ASSIGNEE_REQUIRED: "Bắt buộc chọn người phụ trách.",
    COACHING_CAMPAIGN_NAME_INVALID: "Tên đợt coaching không hợp lệ.",
    COACHING_CLOSE_OUTCOME_REQUIRED: "Bắt buộc ghi kết quả trước khi đóng phiếu.",
    COACHING_CLOSE_TRANSITION_INVALID:
      "Chỉ phiếu đang xử lý mới có thể được đóng.",
    COACHING_MANAGE_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền quản lý Coaching.",
    COACHING_NOTE_INVALID: "Ghi chú Coaching không hợp lệ.",
    COACHING_OUTCOME_INVALID: "Kết quả Coaching không hợp lệ.",
    COACHING_PRIORITY_INVALID: "Mức ưu tiên Coaching không hợp lệ.",
    COACHING_REASON_INVALID: "Lý do theo dõi không hợp lệ.",
    COACHING_RECORD_CLOSED: "Phiếu Coaching đã đóng và không thể thay đổi.",
    COACHING_RECORD_ID_REQUIRED: "Thiếu mã phiếu Coaching.",
    COACHING_RECORD_NOT_FOUND: "Không tìm thấy phiếu Coaching.",
    COACHING_REVIEW_DATE_IN_PAST: "Ngày xem lại không thể nằm trong quá khứ.",
    COACHING_START_NOTE_REQUIRED: "Bắt buộc ghi nội dung bắt đầu xử lý.",
    COACHING_START_TRANSITION_INVALID:
      "Chỉ phiếu đang mở mới có thể bắt đầu xử lý.",
    COACHING_STUDENT_ID_REQUIRED: "Bắt buộc chọn học viên.",
    COACHING_STUDENT_NOT_FOUND: "Không tìm thấy học viên đã chọn.",
    COACHING_TARGET_STATUS_INVALID: "Trạng thái Coaching không hợp lệ.",
  };

  for (const [databaseMessage, userMessage] of Object.entries(knownMessages)) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  return "Không thể cập nhật Coaching. Dữ liệu chưa được thay đổi.";
}

function revalidateCoachingRoutes(coachingRecordId?: string): void {
  revalidatePath("/coaching");

  if (coachingRecordId) {
    revalidatePath(`/coaching/${coachingRecordId}`);
  }
}

export async function createCoachingRecordAction(
  input: CreateCoachingRecordActionInput,
): Promise<CoachingManagementActionState> {
  const permissionError = await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = createCoachingRecordSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin phiếu Coaching.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_coaching_record", {
      p_assistant_owner_id: parsed.data.assistantOwnerId,
      p_campaign_name: parsed.data.campaignName,
      p_priority: parsed.data.priority,
      p_reason: parsed.data.reason,
      p_review_at: parsed.data.reviewAt || undefined,
      p_student_id: parsed.data.studentId,
    });

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message));
    }

    if (!data?.[0]?.id) {
      return createErrorState("Database không trả về phiếu Coaching vừa tạo.");
    }

    revalidateCoachingRoutes(data[0].id);

    return {
      message: "Đã tạo phiếu Coaching.",
      redirectTo: `/coaching/${data[0].id}`,
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống Coaching. Vui lòng thử lại.",
    );
  }
}

export async function addCoachingNoteAction(
  input: AddCoachingNoteActionInput,
): Promise<CoachingManagementActionState> {
  const permissionError = await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = addCoachingNoteSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại ghi chú Coaching.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("add_coaching_note", {
      p_coaching_record_id: parsed.data.coachingRecordId,
      p_note: parsed.data.note,
    });

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message));
    }

    if (!data?.[0]?.id) {
      return createErrorState("Database không trả về ghi chú vừa tạo.");
    }

    revalidateCoachingRoutes(parsed.data.coachingRecordId);
    return { message: "Đã thêm ghi chú Coaching.", status: "success" };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống Coaching. Vui lòng thử lại.",
    );
  }
}

export async function advanceCoachingStatusAction(
  input: AdvanceCoachingStatusActionInput,
): Promise<CoachingManagementActionState> {
  const permissionError = await getPermissionError();

  if (permissionError) {
    return createErrorState(permissionError);
  }

  const parsed = advanceCoachingStatusSchema.safeParse(input);

  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại nội dung chuyển trạng thái.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("advance_coaching_status", {
      p_coaching_record_id: parsed.data.coachingRecordId,
      p_note: parsed.data.note || undefined,
      p_outcome: parsed.data.outcome || undefined,
      p_target_status: parsed.data.targetStatus,
    });

    if (error) {
      return createErrorState(getRpcErrorMessage(error.message));
    }

    if (!data?.[0]?.id) {
      return createErrorState("Database không trả về sự kiện vừa tạo.");
    }

    revalidateCoachingRoutes(parsed.data.coachingRecordId);
    return {
      message:
        parsed.data.targetStatus === "closed"
          ? "Đã đóng phiếu Coaching."
          : "Phiếu Coaching đã chuyển sang trạng thái đang xử lý.",
      status: "success",
    };
  } catch {
    return createErrorState(
      "Không thể kết nối tới hệ thống Coaching. Vui lòng thử lại.",
    );
  }
}
