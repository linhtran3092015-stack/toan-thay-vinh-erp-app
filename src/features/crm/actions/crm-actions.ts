"use server";

import { revalidatePath } from "next/cache";

import type {
  AddCaseNoteInput,
  BookTrialInput,
  ChangeCaseStatusInput,
  CompleteFollowUpInput,
  ConvertStudentInput,
  RecordTrialResultInput,
  CreateCrmCaseInput,
  CrmActionFieldErrors,
  CrmActionResultState,
  TransferLeadInput,
} from "@/features/crm/forms/crm-action-types";
import {
  addCaseNoteSchema,
  bookTrialSchema,
  changeCaseStatusSchema,
  completeFollowUpSchema,
  convertStudentSchema,
  createCrmCaseSchema,
  recordTrialResultSchema,
  transferLeadSchema,
} from "@/features/crm/forms/crm-schemas";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";

type CreateCrmCaseRpcArgs = Database["public"]["Functions"]["create_crm_case"]["Args"];
type BookTrialRpcArgs = Database["public"]["Functions"]["book_crm_trial_session"]["Args"];

function createErrorState(
  message: string,
  fieldErrors?: CrmActionFieldErrors,
): CrmActionResultState {
  return {
    fieldErrors,
    message,
    status: "error",
  };
}

function getCrmRpcErrorMessage(message: string): string {
  const knownMessages: Record<string, string> = {
    AUTHENTICATION_REQUIRED:
      "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",

    CRM_CASE_ALREADY_CONVERTED:
      "CRM Case này đã được chuyển thành học viên chính thức trước đó.",

    CRM_CASE_ID_REQUIRED:
      "Thiếu mã CRM case cần thao tác.",

    CRM_CASE_DROPPED:
      "Lead đã dừng. Mở lại lead trước khi chuyển đổi.",

    CRM_NOTE_HAS_NO_FOLLOW_UP:
      "Ghi chú này không có hẹn theo dõi.",

    CRM_NOTE_NOT_FOUND:
      "Không tìm thấy ghi chú.",

    CRM_NOTE_REQUIRED:
      "Vui lòng nhập nội dung ghi chú.",

    CRM_STATUS_REASON_REQUIRED:
      "Vui lòng nhập lý do (3–1000 ký tự).",

    CRM_STATUS_TRANSITION_INVALID:
      "Trạng thái hiện tại của lead không cho phép chuyển đổi này.",

    CRM_TARGET_STATUS_INVALID:
      "Trạng thái đích không hợp lệ.",

    CRM_TRIAL_BOOKING_NOT_FOUND:
      "Không tìm thấy lịch học thử.",

    CRM_TRIAL_RESULT_ALREADY_RECORDED:
      "Kết quả của lịch học thử này đã được ghi nhận.",

    CRM_TRIAL_RESULT_INVALID:
      "Kết quả học thử không hợp lệ.",

    REGISTERED_MODE_INVALID:
      "Hình thức học chính thức phải là online hoặc offline.",

    CRM_CASE_NOT_FOUND:
      "Không tìm thấy CRM case trong hệ thống.",

    CRM_TRANSFER_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền chuyển giao lead (crm.transfer).",

    CRM_UPDATE_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền cập nhật CRM (crm.update).",

    ENROLLMENT_CHECKLIST_INCOMPLETE:
      "Cần hoàn tất đủ 10 tiêu chí checklist trước khi chuyển thành học viên chính thức.",

    GUARDIAN_FULL_NAME_REQUIRED:
      "Bắt buộc nhập họ tên phụ huynh.",

    GUARDIAN_PHONE_REQUIRED:
      "Bắt buộc nhập số điện thoại phụ huynh.",

    INVALID_LEAD_SOURCE_CODE:
      "Mã nguồn lead không hợp lệ hoặc đã ngừng hoạt động.",

    LEAD_TRANSFER_REASON_REQUIRED:
      "Bắt buộc nhập lý do chuyển giao lead.",

    NEW_SALE_OWNER_ID_REQUIRED:
      "Thiếu mã sale owner mới cần chuyển giao.",

    NEW_SALE_OWNER_MUST_BE_DIFFERENT:
      "Nhân sự Sale mới phải khác nhân sự Sale hiện tại.",

    STUDENTS_CONFIRM_OFFICIAL_PERMISSION_DENIED:
      "Tài khoản hiện tại không có quyền xác nhận học viên chính thức (students.confirm_official).",

    STUDENT_FULL_NAME_REQUIRED:
      "Bắt buộc nhập họ tên học viên.",
  };

  for (const [dbMsg, userMsg] of Object.entries(knownMessages)) {
    if (message.includes(dbMsg)) {
      return userMsg;
    }
  }

  return "Không thể xử lý thao tác CRM. Vui lòng thử lại sau.";
}

export async function createCrmCaseAction(
  input: CreateCrmCaseInput,
): Promise<CrmActionResultState> {
  const permissionResult = await getDatabasePermissions();
  if (!permissionResult.ok || !permissionResult.permissions.includes("crm.update")) {
    return createErrorState("Tài khoản hiện tại không có quyền crm.update.");
  }

  const parsed = createCrmCaseSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin lead.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const rpcArgs = {
      p_birth_year: parsed.data.birthYear,
      p_discount_notes: parsed.data.discountNotes ?? null,
      p_expected_grade: parsed.data.expectedGrade,
      p_expected_level: parsed.data.expectedLevel ?? null,
      p_expected_mode: parsed.data.expectedMode ?? null,
      p_expected_tuition_fee_vnd: parsed.data.expectedTuitionFeeVnd ?? null,
      p_full_name: parsed.data.fullName,
      p_guardian_full_name: parsed.data.guardianFullName,
      p_guardian_phone: parsed.data.guardianPhone,
      p_lead_source_code: parsed.data.leadSourceCode,
      p_notes: parsed.data.notes ?? null,
      p_province_city: parsed.data.provinceCity ?? null,
      p_sale_owner_id: parsed.data.saleOwnerId ?? null,
    } as unknown as CreateCrmCaseRpcArgs;

    const { data, error } = await supabase.rpc("create_crm_case", rpcArgs);

    if (error) {
      return createErrorState(getCrmRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về CRM case vừa tạo.");
    }

    revalidatePath("/crm");

    return {
      id: data.id,
      message: `Đã tạo lead thành công với mã ${data.public_code}.`,
      status: "success",
    };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống CRM. Vui lòng thử lại.");
  }
}

export async function transferLeadAction(
  input: TransferLeadInput,
): Promise<CrmActionResultState> {
  const permissionResult = await getDatabasePermissions();
  if (!permissionResult.ok || !permissionResult.permissions.includes("crm.transfer")) {
    return createErrorState("Tài khoản hiện tại không có quyền crm.transfer.");
  }

  const parsed = transferLeadSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin chuyển giao lead.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("transfer_crm_case_lead", {
      p_crm_case_id: parsed.data.crmCaseId,
      p_new_sale_owner_id: parsed.data.newSaleOwnerId,
      p_reason: parsed.data.reason,
    });

    if (error) {
      return createErrorState(getCrmRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về dữ liệu sau khi chuyển giao.");
    }

    revalidatePath("/crm");
    revalidatePath(`/crm/${data.id}`);

    return {
      id: data.id,
      message: "Đã chuyển giao lead cho nhân sự Sale mới thành công.",
      status: "success",
    };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống chuyển giao lead.");
  }
}

export async function bookTrialAction(
  input: BookTrialInput,
): Promise<CrmActionResultState> {
  const permissionResult = await getDatabasePermissions();
  if (!permissionResult.ok || !permissionResult.permissions.includes("crm.update")) {
    return createErrorState("Tài khoản hiện tại không có quyền crm.update.");
  }

  const parsed = bookTrialSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại thông tin lịch học thử.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const rpcArgs = {
      p_class_session_id: parsed.data.classSessionId ?? null,
      p_crm_case_id: parsed.data.crmCaseId,
      p_learning_mode: parsed.data.learningMode,
      p_sale_notes: parsed.data.saleNotes ?? null,
      p_trial_date: parsed.data.trialDate,
    } as unknown as BookTrialRpcArgs;

    const { data, error } = await supabase.rpc("book_crm_trial_session", rpcArgs);

    if (error) {
      return createErrorState(getCrmRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về dữ liệu sau khi đặt lịch học thử.");
    }

    revalidatePath("/crm");
    revalidatePath(`/crm/${parsed.data.crmCaseId}`);

    return {
      id: data.id,
      message: "Đã đặt lịch học thử miễn phí cho lead thành công.",
      status: "success",
    };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống đặt lịch học thử.");
  }
}

export async function convertStudentAction(
  input: ConvertStudentInput,
): Promise<CrmActionResultState> {
  const permissionResult = await getDatabasePermissions();
  if (!permissionResult.ok || !permissionResult.permissions.includes("students.confirm_official")) {
    return createErrorState("Tài khoản hiện tại không có quyền students.confirm_official.");
  }

  const parsed = convertStudentSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState(
      "Vui lòng kiểm tra lại checklist và thông tin nhập học.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("convert_crm_case_to_official_student", {
      p_checklist_items: {
        item_10_communication_group_ready: parsed.data.checklistItems.item10CommunicationGroupReady,
        item_1_payment_received: parsed.data.checklistItems.item1PaymentReceived,
        item_2_source_confirmed: parsed.data.checklistItems.item2SourceConfirmed,
        item_3_sale_confirmed: parsed.data.checklistItems.item3SaleConfirmed,
        item_4_class_selected: parsed.data.checklistItems.item4ClassSelected,
        item_5_mode_confirmed: parsed.data.checklistItems.item5ModeConfirmed,
        item_6_fee_confirmed: parsed.data.checklistItems.item6FeeConfirmed,
        item_7_assistant_sessions_confirmed: parsed.data.checklistItems.item7AssistantSessionsConfirmed,
        item_8_accountant_transaction_confirmed: parsed.data.checklistItems.item8AccountantTransactionConfirmed,
        item_9_official_start_date_entered: parsed.data.checklistItems.item9OfficialStartDateEntered,
      },
      p_class_id: parsed.data.classId,
      p_crm_case_id: parsed.data.crmCaseId,
      p_official_start_date: parsed.data.officialStartDate,
      p_registered_mode: parsed.data.registeredMode,
    });

    if (error) {
      return createErrorState(getCrmRpcErrorMessage(error.message));
    }

    if (!data?.id) {
      return createErrorState("Database không trả về thông tin học viên chính thức sau khi chuyển đổi.");
    }

    revalidatePath("/crm");
    revalidatePath(`/crm/${parsed.data.crmCaseId}`);
    revalidatePath("/students");
    revalidatePath(`/students/${data.id}`);

    return {
      id: data.id,
      message: `Đã chuyển đổi lead thành Học viên Chính thức thành công! (Mã: ${data.public_code})`,
      status: "success",
    };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống chuyển đổi học viên.");
  }
}

async function requireCrmUpdatePermission(): Promise<string | null> {
  const permissions = await getDatabasePermissions();
  if (!permissions.ok) return "Không thể xác minh quyền CRM. Vui lòng thử lại.";
  if (!permissions.permissions.includes("crm.update")) {
    return "Tài khoản hiện tại không có quyền cập nhật CRM (crm.update).";
  }
  return null;
}

function revalidateCase(crmCaseId: string): void {
  revalidatePath("/crm");
  revalidatePath(`/crm/${crmCaseId}`);
}

export async function recordTrialResultAction(input: RecordTrialResultInput): Promise<CrmActionResultState> {
  const permissionError = await requireCrmUpdatePermission();
  if (permissionError) return createErrorState(permissionError);
  const parsed = recordTrialResultSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState("Vui lòng kiểm tra lại kết quả học thử.", parsed.error.flatten().fieldErrors);
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("record_crm_trial_result", {
      p_booking_id: parsed.data.bookingId,
      p_result: parsed.data.result,
      p_sale_notes: parsed.data.saleNotes ?? undefined,
      p_teacher_feedback: parsed.data.teacherFeedback ?? undefined,
    });
    if (error) return createErrorState(getCrmRpcErrorMessage(error.message));
    revalidateCase(parsed.data.crmCaseId);
    revalidatePath("/students");
    return {
      id: data.id,
      message: parsed.data.result === "attended"
        ? "Đã ghi nhận học sinh đến học thử. Lead chuyển sang Đã học thử."
        : "Đã ghi nhận kết quả học thử.",
      status: "success",
    };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống CRM. Vui lòng thử lại.");
  }
}

export async function changeCaseStatusAction(input: ChangeCaseStatusInput): Promise<CrmActionResultState> {
  const permissionError = await requireCrmUpdatePermission();
  if (permissionError) return createErrorState(permissionError);
  const parsed = changeCaseStatusSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState("Vui lòng kiểm tra lại thông tin.", parsed.error.flatten().fieldErrors);
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("advance_crm_case_status", {
      p_crm_case_id: parsed.data.crmCaseId,
      p_reason: parsed.data.reason ?? undefined,
      p_target_status: parsed.data.targetStatus,
    });
    if (error) return createErrorState(getCrmRpcErrorMessage(error.message));
    revalidateCase(parsed.data.crmCaseId);
    revalidatePath("/students");
    revalidatePath("/finance/payment-requests");
    const messages: Record<ChangeCaseStatusInput["targetStatus"], string> = {
      dropped: "Đã dừng lead và lưu lý do.",
      interested: "Đã mở lại lead.",
      pending_enrollment_confirmation: "Lead chuyển sang Chờ xác nhận nhập học. Hồ sơ học sinh tạm đã sẵn sàng để lập phiếu thu tuyển mới.",
    };
    return { id: data.id, message: messages[parsed.data.targetStatus], status: "success" };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống CRM. Vui lòng thử lại.");
  }
}

export async function addCaseNoteAction(input: AddCaseNoteInput): Promise<CrmActionResultState> {
  const permissionError = await requireCrmUpdatePermission();
  if (permissionError) return createErrorState(permissionError);
  const parsed = addCaseNoteSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState("Vui lòng kiểm tra lại ghi chú.", parsed.error.flatten().fieldErrors);
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("add_crm_case_note", {
      p_crm_case_id: parsed.data.crmCaseId,
      p_follow_up_at: parsed.data.followUpAt ?? undefined,
      p_note: parsed.data.note,
    });
    if (error) return createErrorState(getCrmRpcErrorMessage(error.message));
    revalidateCase(parsed.data.crmCaseId);
    return { id: data.id, message: parsed.data.followUpAt ? "Đã lưu ghi chú và hẹn theo dõi." : "Đã lưu ghi chú.", status: "success" };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống CRM. Vui lòng thử lại.");
  }
}

export async function completeFollowUpAction(input: CompleteFollowUpInput): Promise<CrmActionResultState> {
  const permissionError = await requireCrmUpdatePermission();
  if (permissionError) return createErrorState(permissionError);
  const parsed = completeFollowUpSchema.safeParse(input);
  if (!parsed.success) {
    return createErrorState("Ghi chú không hợp lệ.", parsed.error.flatten().fieldErrors);
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("complete_crm_follow_up", { p_note_id: parsed.data.noteId });
    if (error) return createErrorState(getCrmRpcErrorMessage(error.message));
    revalidateCase(parsed.data.crmCaseId);
    return { id: data.id, message: "Đã đánh dấu hẹn theo dõi là xong.", status: "success" };
  } catch {
    return createErrorState("Không thể kết nối tới hệ thống CRM. Vui lòng thử lại.");
  }
}
