"use server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { careCommandSchema } from "./models";

const errors:Record<string,string>={
  STUDENT_CARE_PERMISSION_DENIED:"Anh/chị không có quyền thực hiện thao tác này.",
  STUDENT_CARE_STALE_VERSION:"Công việc vừa được người khác cập nhật. Tải lại trang trước khi thao tác.",
  STUDENT_CARE_ALREADY_CLAIMED:"Công việc đã có người nhận.",STUDENT_CARE_NOT_YOUR_TASK:"Chỉ người phụ trách hoặc chủ trung tâm được xử lý.",
  STUDENT_CARE_CLAIM_FIRST:"Hãy nhận công việc trước khi xử lý.",STUDENT_CARE_TASK_CLOSED:"Công việc đã kết thúc.",
  STUDENT_CARE_SUCCESSFUL_CONTACT_REQUIRED:"Cần chọn một lần trao đổi thành công, đủ nội dung trước khi hoàn thành.",
  STUDENT_CARE_CONTACT_CHECKLIST_REQUIRED:"Cần ghi điểm tiến bộ, khó khăn, hướng hỗ trợ, kết quả và lịch theo dõi tiếp.",
  STUDENT_CARE_FOLLOWUP_REQUIRED:"Cần ghi lý do và ngày giờ theo dõi tiếp.",STUDENT_CARE_FOLLOWUP_MUST_BE_FUTURE:"Ngày hẹn theo dõi phải ở tương lai.",
  STUDENT_CARE_ASSIGNEE_OR_REASON_REQUIRED:"Cần chọn người phụ trách hợp lệ và ghi lý do.",STUDENT_CARE_CONTACT_WRONG_PERIOD:"Lần trao đổi này diễn ra trước kỳ Coaching.",
  STUDENT_CARE_CONTACT_INVALID:"Kiểm tra lại thời gian, đối tượng, kênh và nội dung liên hệ.",STUDENT_CARE_COACHING_INVALID:"Phiếu Coaching phải thuộc cùng học viên và anh/chị có quyền xem.",
};
export async function mutateCare(input:unknown):Promise<{ok:boolean;message:string}> {
  const permission=await getDatabasePermissions();
  if(!permission.ok||!permission.permissions.includes("student_care.handle")) return {ok:false,message:"Không có quyền xử lý chăm sóc học viên."};
  const parsed=careCommandSchema.safeParse(input);
  if(!parsed.success) return {ok:false,message:"Thông tin chưa hợp lệ. Kiểm tra lại các trường và thử lại."};
  try {
    const client=await createSupabaseServerClient();
    const {error}=await client.rpc("mutate_student_care",{p_command:parsed.data});
    if(error) return {ok:false,message:errors[error.message]??(error.code==="23505"?"Lần liên hệ này đã được ghi nhận cho một kỳ Coaching.":"Không lưu được công việc. Vui lòng tải lại và thử lại.")};
    revalidatePath("/student-care","layout");revalidatePath("/");revalidatePath("/notifications");revalidatePath("/coaching");
    if(parsed.data.student_id) revalidatePath(`/students/${parsed.data.student_id}`);
    return {ok:true,message:"Đã lưu cập nhật chăm sóc học viên."};
  } catch {return {ok:false,message:"Chưa xác nhận được kết quả lưu. Có thể thử lại an toàn."};}
}
