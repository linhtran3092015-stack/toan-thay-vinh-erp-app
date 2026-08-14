"use server";

import { revalidatePath } from "next/cache";

import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TuitionActionResult = { message: string; status: "error" | "success" };

function failure(message: string): TuitionActionResult {
  return { message, status: "error" };
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
    return failure(error.message.includes("TUITION_PERIOD_BLOCKERS")
      ? "Preview còn dữ liệu chặn khóa. Hãy hoàn thiện đơn giá hoặc nguồn học viên."
      : "Không thể khóa kỳ thu. Không có dữ liệu nào được khóa một phần.");
  }
  revalidatePath("/finance/tuition-periods");
  revalidatePath("/finance/payment-requests");
  return { message: "Đã khóa kỳ thu và tạo yêu cầu tái phí hợp lệ.", status: "success" };
}

export async function publishTuitionTemplateAction(input:{announcement:string;centerDisplayName:string;footer:string;reason:string;title:string}):Promise<TuitionActionResult>{const p=await getDatabasePermissions();if(!p.ok||!p.permissions.includes("settings.receipts.manage"))return failure("Không có quyền quản lý mẫu phiếu.");const s=await createSupabaseServerClient();const {error}=await s.rpc("publish_tuition_receipt_template_version",{p_code:"TUITION_NOTICE_DEFAULT",p_name:"Phiếu học phí mặc định",p_content:{announcement:input.announcement,center_display_name:input.centerDisplayName,footer:input.footer,show_qr:true,title:input.title},p_reason:input.reason});if(error)return failure("Không thể xuất bản phiên bản mẫu.");revalidatePath("/finance/tuition-periods/templates");return {status:"success",message:"Đã xuất bản phiên bản mẫu mới."};}
export async function reissueTuitionItemAction(itemId:string,amountVnd:number,reason:string):Promise<TuitionActionResult>{const p=await getDatabasePermissions();if(!p.ok||!p.permissions.includes("tuition_periods.adjust"))return failure("Không có quyền điều chỉnh Phiếu học phí.");const s=await createSupabaseServerClient();const {error}=await s.rpc("reissue_tuition_collection_item",{p_original_item_id:itemId,p_payable_amount_vnd:amountVnd,p_reason:reason});if(error)return failure("Không thể phát hành lại phiếu. Phiếu gốc vẫn không bị thay đổi.");revalidatePath("/finance/tuition-periods");return {status:"success",message:"Đã tạo phiếu thay thế và giữ nguyên lịch sử phiếu gốc."};}
