"use server";

import { revalidatePath } from "next/cache";

import type {
  LockSessionActionInput,
  ResultActionFieldErrors,
  RecordSessionResultActionInput,
  SessionLockActionState,
  SessionResultActionState,
  UpdateSessionResultActionInput,
} from "@/features/sessions/forms/result-action-types";
import {
  lockSessionSchema,
  recordSessionResultSchema,
  updateSessionResultSchema,
} from "@/features/sessions/forms/result-form-schema";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";

type UpdateResultRpcArgs =
  Database["public"]["Functions"]["update_session_result"]["Args"];

function createResultErrorState(
  message: string,
  fieldErrors?: ResultActionFieldErrors,
): SessionResultActionState {
  return {
    fieldErrors,
    message,
    status: "error",
  };
}

function createLockErrorState(
  message: string,
  fieldErrors?: ResultActionFieldErrors,
): SessionLockActionState {
  return {
    fieldErrors,
    message,
    status: "error",
  };
}

async function getPermissionError(
  permission:
    | "results.manage"
    | "sessions.lock",
): Promise<string | null> {
  const permissionResult =
    await getDatabasePermissions();

  if (!permissionResult.ok) {
    return "Không thể xác minh quyền thao tác. Vui lòng đăng nhập lại hoặc thử lại.";
  }

  if (
    !permissionResult.permissions.includes(
      permission,
    )
  ) {
    return `Tài khoản hiện tại không có quyền ${permission}.`;
  }

  return null;
}

function revalidateSessionRoutes(
  sessionId: string,
): void {
  revalidatePath("/sessions");
  revalidatePath(
    `/sessions/${sessionId}`,
  );
}

function getResultLockRpcErrorMessage(
  message: string,
): string {
  const knownMessages: Record<
    string,
    string
  > = {
    ABSENT_STUDENT_CANNOT_HAVE_SESSION_RESULT:
      "Chỉ học viên có mặt hoặc học thêm mới được nhập kết quả.",

    AUTHENTICATION_REQUIRED:
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",

    CLASS_SESSION_ALREADY_LOCKED:
      "Buổi học đã được khóa trước đó.",

    CLASS_SESSION_ID_REQUIRED:
      "Thiếu mã buổi học cần thao tác.",

    CLASS_SESSION_IS_LOCKED:
      "Buổi học đã khóa nên không thể thay đổi kết quả.",

    CLASS_SESSION_LOCK_REQUIRES_ATTENDANCE:
      "Buổi học chưa có dữ liệu điểm danh nên chưa thể khóa.",

    CLASS_SESSION_LOCK_REQUIRES_FULL_ATTENDANCE:
      "Chưa điểm danh đầy đủ roster của buổi học.",

    CLASS_SESSION_LOCK_REQUIRES_RESULTS:
      "Mọi học viên có mặt hoặc học thêm phải có điểm kiểm tra trước khi khóa.",

    CLASS_SESSION_MUST_BE_COMPLETED_BEFORE_LOCK:
      "Phải hoàn thành buổi học trước khi khóa.",

    CLASS_SESSION_NOT_FOUND:
      "Không tìm thấy buổi học cần thao tác.",

    LOCKED_CLASS_SESSION_IS_IMMUTABLE:
      "Buổi học đã khóa và không thể thay đổi.",

    NOTEBOOK_SCORE_INVALID:
      "Điểm vở phải nằm trong khoảng từ 0 đến 10.",

    NOTEBOOK_SCORE_NOT_ALLOWED:
      "Không được nhập điểm vở khi vở chưa nộp hoặc không yêu cầu.",

    NOTEBOOK_STATUS_INVALID:
      "Trạng thái nộp vở không hợp lệ.",

    CLASS_SESSION_NOT_STARTED_YET:
      "Chưa đến thời gian bắt đầu buổi học.",

    ONLY_COMPLETED_SESSION_CAN_BE_LOCKED:
      "Chỉ buổi học đã hoàn thành mới có thể khóa.",

    RESULTS_MANAGE_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền quản lý kết quả.",

    RESULT_REQUIRES_STARTED_SESSION:
      "Chỉ có thể nhập kết quả sau khi buổi học đã bắt đầu.",

    SESSION_ATTENDANCE_NOT_FOUND:
      "Học viên chưa có dữ liệu điểm danh trong buổi học.",

    SESSION_ATTENDANCE_INCOMPLETE_FOR_LOCK:
      "Chưa điểm danh đầy đủ học viên trong danh sách lớp.",

    SESSION_HAS_NO_ELIGIBLE_ROSTER:
      "Lớp chưa có học viên ghi danh nên không thể khóa buổi học.",

    SESSION_RESET_WINDOW_CLOSED:
      "Đã qua thời gian bắt đầu buổi học nên không thể đặt lại trạng thái.",

    SESSION_LOCK_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền khóa buổi học.",

    SESSION_LOCK_REASON_REQUIRED:
      "Bắt buộc nhập lý do khóa buổi học.",

    SESSION_RESULT_ALREADY_EXISTS:
      "Học viên đã có kết quả trong buổi học này.",

    SESSION_RESULT_ID_REQUIRED:
      "Thiếu mã kết quả cần cập nhật.",

    SESSION_RESULT_NOT_FOUND:
      "Không tìm thấy kết quả cần cập nhật.",

    SESSION_RESULT_NO_CHANGES:
      "Thông tin kết quả mới không có thay đổi.",

    SESSION_RESULT_UPDATE_REASON_REQUIRED:
      "Bắt buộc nhập lý do cập nhật kết quả.",

    STUDENT_ID_REQUIRED:
      "Thiếu mã học viên cần nhập kết quả.",

    SUBMITTED_NOTEBOOK_REQUIRES_SCORE:
      "Vở đã nộp phải có điểm vở.",

    TEST_SCORE_INVALID:
      "Điểm kiểm tra phải nằm trong khoảng từ 0 đến 10.",
  };

  for (
    const [databaseMessage, userMessage]
    of Object.entries(knownMessages)
  ) {
    if (message.includes(databaseMessage)) {
      return userMessage;
    }
  }

  return "Không thể xử lý kết quả buổi học. Dữ liệu chưa được thay đổi.";
}

export async function recordSessionResultAction(
  input: RecordSessionResultActionInput,
): Promise<SessionResultActionState> {
  const permissionError =
    await getPermissionError(
      "results.manage",
    );

  if (permissionError) {
    return createResultErrorState(
      permissionError,
    );
  }

  const parsed =
    recordSessionResultSchema.safeParse(
      input,
    );

  if (!parsed.success) {
    return createResultErrorState(
      "Vui lòng kiểm tra lại thông tin kết quả.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } =
      await supabase.rpc(
        "record_session_result",
        {
          p_class_session_id:
            parsed.data.classSessionId,
          p_comment:
            parsed.data.comment,
          p_notebook_score:
            parsed.data.notebookScore,
          p_notebook_status:
            parsed.data.notebookStatus,
          p_student_id:
            parsed.data.studentId,
          p_test_score:
            parsed.data.testScore,
        },
      );

    if (error) {
      return createResultErrorState(
        getResultLockRpcErrorMessage(
          error.message,
        ),
      );
    }

    if (
      !data?.id ||
      !data.class_session_id
    ) {
      return createResultErrorState(
        "Database không trả về kết quả vừa tạo.",
      );
    }

    revalidateSessionRoutes(
      data.class_session_id,
    );

    return {
      classSessionId:
        data.class_session_id,
      message:
        "Đã ghi nhận kết quả buổi học.",
      resultId: data.id,
      status: "success",
    };
  } catch {
    return createResultErrorState(
      "Không thể kết nối tới hệ thống kết quả. Vui lòng thử lại.",
    );
  }
}

export async function updateSessionResultAction(
  input: UpdateSessionResultActionInput,
): Promise<SessionResultActionState> {
  const permissionError =
    await getPermissionError(
      "results.manage",
    );

  if (permissionError) {
    return createResultErrorState(
      permissionError,
    );
  }

  const parsed =
    updateSessionResultSchema.safeParse(
      input,
    );

  if (!parsed.success) {
    return createResultErrorState(
      "Vui lòng kiểm tra lại thông tin cập nhật kết quả.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    /*
     * Generated types hiện coi hai tham số
     * numeric bắt buộc là number, trong khi
     * PostgreSQL RPC chấp nhận null. Cast này
     * chỉ điều chỉnh type ở client; runtime vẫn
     * gửi null đúng theo chữ ký SQL.
     */
    const rpcArgs = {
      p_comment:
        parsed.data.comment ?? "",
      p_notebook_score:
        parsed.data.notebookScore ??
        null,
      p_notebook_status:
        parsed.data.notebookStatus,
      p_reason:
        parsed.data.reason,
      p_session_result_id:
        parsed.data.resultId,
      p_test_score:
        parsed.data.testScore ??
        null,
    } as unknown as UpdateResultRpcArgs;

    const { data, error } =
      await supabase.rpc(
        "update_session_result",
        rpcArgs,
      );

    if (error) {
      return createResultErrorState(
        getResultLockRpcErrorMessage(
          error.message,
        ),
      );
    }

    if (
      !data?.id ||
      !data.class_session_id
    ) {
      return createResultErrorState(
        "Database không trả về kết quả sau khi cập nhật.",
      );
    }

    revalidateSessionRoutes(
      data.class_session_id,
    );

    return {
      classSessionId:
        data.class_session_id,
      message:
        "Đã cập nhật kết quả buổi học.",
      resultId: data.id,
      status: "success",
    };
  } catch {
    return createResultErrorState(
      "Không thể kết nối tới hệ thống kết quả. Vui lòng thử lại.",
    );
  }
}

export async function lockSessionAction(
  input: LockSessionActionInput,
): Promise<SessionLockActionState> {
  const permissionError =
    await getPermissionError(
      "sessions.lock",
    );

  if (permissionError) {
    return createLockErrorState(
      permissionError,
    );
  }

  const parsed =
    lockSessionSchema.safeParse(input);

  if (!parsed.success) {
    return createLockErrorState(
      "Vui lòng kiểm tra lại lý do khóa buổi học.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase =
      await createSupabaseServerClient();

    const { data, error } =
      await supabase.rpc(
        "lock_class_session",
        {
          p_class_session_id:
            parsed.data.sessionId,
          p_reason:
            parsed.data.reason,
        },
      );

    if (error) {
      return createLockErrorState(
        getResultLockRpcErrorMessage(
          error.message,
        ),
      );
    }

    if (!data?.id) {
      return createLockErrorState(
        "Database không trả về buổi học sau khi khóa.",
      );
    }

    revalidateSessionRoutes(data.id);

    return {
      message:
        "Đã khóa buổi học. Dữ liệu không thể thay đổi thêm.",
      sessionId: data.id,
      status: "success",
    };
  } catch {
    return createLockErrorState(
      "Không thể kết nối tới hệ thống khóa buổi học. Vui lòng thử lại.",
    );
  }
}
