"use server";

import { revalidatePath } from "next/cache";

import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

export type TuitionActionResult = { message: string; status: "error" | "success" };

function failure(message: string): TuitionActionResult {
  return { message, status: "error" };
}

const periodRatesSchema = z.object({
  periodId: z.string().uuid(), studentIds: z.array(z.string().uuid()).min(1).max(500),
  unitPriceVnd: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), reason: z.string().trim().min(3).max(1000),
});

export async function setTuitionPeriodRatesAction(input: z.input<typeof periodRatesSchema>): Promise<TuitionActionResult> {
  const permissions = await getDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("students.manage_tuition_rates") || !permissions.permissions.includes("tuition_periods.view")) return failure("Không có quyền bổ sung đơn giá học phí.");
  const parsed = periodRatesSchema.safeParse(input);
  if (!parsed.success) return failure("Chọn từ 1 đến 500 học viên, nhập đơn giá nguyên dương và căn cứ áp dụng ít nhất 3 ký tự.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_tuition_period_student_rates", {
    p_period_id: parsed.data.periodId, p_student_ids: parsed.data.studentIds,
    p_unit_price_vnd: parsed.data.unitPriceVnd, p_reason: parsed.data.reason,
  });
  if (error) return failure(error.message.includes("TUITION_RATE_SELECTION_STALE")
    ? "Dữ liệu đã thay đổi hoặc học viên đã có đơn giá. Vui lòng tải lại và chọn các học viên còn thiếu giá."
    : "Không thể lưu đơn giá. Kỳ phải còn nháp và tất cả học viên được chọn phải còn thiếu giá. Không có đơn giá nào được lưu một phần.");
  revalidatePath("/finance/tuition-periods", "layout");
  revalidatePath("/students/[studentId]", "page");
  return { status: "success", message: `Đã bổ sung đơn giá cho ${new Set(parsed.data.studentIds).size} học viên. Kiểm tra lại kỳ thu trước khi khóa và tạo yêu cầu thanh toán.` };
}

const periodSourcesSchema = z.object({
  periodId: z.string().uuid(),
  leadSourceId: z.string().uuid(),
  reason: z.string().trim().min(3).max(1000),
  studentIds: z.array(z.string().uuid()).min(1).max(500),
});

export async function setTuitionPeriodSourcesAction(input: z.input<typeof periodSourcesSchema>): Promise<TuitionActionResult> {
  const permissions = await getDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("students.correct_acquisition_source") || !permissions.permissions.includes("tuition_periods.view")) {
    return failure("Không có quyền hiệu chỉnh nguồn học viên.");
  }
  const parsed = periodSourcesSchema.safeParse(input);
  if (!parsed.success) return failure("Chọn từ 1 đến 500 học viên, chọn nguồn hợp lệ và lý do ít nhất 3 ký tự.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_tuition_period_student_sources", {
    p_period_id: parsed.data.periodId,
    p_lead_source_id: parsed.data.leadSourceId,
    p_reason: parsed.data.reason,
    p_student_ids: parsed.data.studentIds,
  });
  if (error) return failure(error.message.includes("TUITION_SOURCE_SELECTION_STALE")
    ? "Thông tin nguồn đã thay đổi. Tải lại và chọn học viên còn thiếu nguồn."
    : "Không thể lưu nguồn. Kỳ phải còn nháp, nguồn phải đang hoạt động và học viên phải còn thiếu nguồn. Không có dòng nào được lưu một phần.");
  revalidatePath("/finance/tuition-periods", "layout");
  revalidatePath("/students/[studentId]", "page");
  return { status: "success", message: `Đã cập nhật nguồn tuyển sinh cho ${new Set(parsed.data.studentIds).size} học viên.` };
}

export async function createTuitionPeriodAction(input: {
  dueOn?: string;
  endsOn: string;
  name: string;
  startsOn: string;
}): Promise<TuitionActionResult> {
  const permissions = await getDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("tuition_periods.manage")) {
    return failure("Tài khoản hiện tại không có quyền tạo kỳ thu học phí.");
  }
  if (!input.name.trim() || !input.startsOn || !input.endsOn) {
    return failure("Cần nhập tên, ngày bắt đầu và ngày kết thúc kỳ thu.");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_tuition_collection_period", {
    p_due_on: input.dueOn || undefined,
    p_ends_on: input.endsOn,
    p_name: input.name.trim(),
    p_receipt_template_version_id: undefined,
    p_starts_on: input.startsOn,
  });
  if (error) return failure("Không thể tạo kỳ thu. Hãy kiểm tra khoảng ngày và quyền truy cập.");
  revalidatePath("/finance/tuition-periods");
  return { message: "Đã tạo kỳ thu nháp.", status: "success" };
}

export async function lockTuitionPeriodAction(periodId: string): Promise<TuitionActionResult> {
  const permissions = await getDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("tuition_periods.lock")) {
    return failure("Tài khoản hiện tại không có quyền khóa kỳ thu học phí.");
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("lock_tuition_collection_period", { p_period_id: periodId });
  if (error) {
    if (error.message.includes("TUITION_PERIOD_EMPTY")) return failure("Chưa có buổi học đủ điều kiện trong kỳ. Kiểm tra lịch học và ghi danh trước khi khóa.");
    return failure(error.message.includes("TUITION_PERIOD_BLOCKERS")
      ? "Cần bổ sung đơn giá, nguồn hoặc phụ huynh chính. Mở chi tiết kỳ thu để xem từng học viên."
      : "Không thể khóa kỳ thu. Không có dữ liệu nào được khóa một phần.");
  }
  revalidatePath("/finance/tuition-periods");
  revalidatePath(`/finance/tuition-periods/${periodId}`);
  revalidatePath("/finance/payment-requests");
  return { message: "Đã khóa kỳ thu và tạo yêu cầu tái phí hợp lệ.", status: "success" };
}

export async function publishTuitionTemplateAction(input:{announcement:string;centerDisplayName:string;footer:string;reason:string;title:string}):Promise<TuitionActionResult>{const p=await getDatabasePermissions();if(!p.ok||!p.permissions.includes("settings.receipts.manage"))return failure("Không có quyền quản lý mẫu phiếu.");const s=await createSupabaseServerClient();const {error}=await s.rpc("publish_tuition_receipt_template_version",{p_code:"TUITION_NOTICE_DEFAULT",p_name:"Phiếu học phí mặc định",p_content:{announcement:input.announcement,center_display_name:input.centerDisplayName,footer:input.footer,show_qr:true,title:input.title},p_reason:input.reason});if(error)return failure("Không thể xuất bản phiên bản mẫu.");revalidatePath("/finance/tuition-periods/templates");return {status:"success",message:"Đã xuất bản phiên bản mẫu mới."};}
export async function reissueTuitionItemAction(itemId:string,amountVnd:number,reason:string):Promise<TuitionActionResult>{const p=await getDatabasePermissions();if(!p.ok||!p.permissions.includes("tuition_periods.adjust"))return failure("Không có quyền điều chỉnh Phiếu học phí.");const s=await createSupabaseServerClient();const {error}=await s.rpc("reissue_tuition_collection_item",{p_original_item_id:itemId,p_payable_amount_vnd:amountVnd,p_reason:reason});if(error)return failure("Không thể phát hành lại phiếu. Phiếu gốc vẫn không bị thay đổi.");revalidatePath("/finance/tuition-periods");return {status:"success",message:"Đã tạo phiếu thay thế và giữ nguyên lịch sử phiếu gốc."};}
