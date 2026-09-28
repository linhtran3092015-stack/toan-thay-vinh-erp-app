"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { allocationRequestSchema, manualAllocationSchema, type AllocationStudent, type AllocationDetail, type ManualAllocationInput } from "./manual-allocation-schema";

type Result<T> = { ok: true; data: T } | { ok: false; message: string };
async function canAllocate() {
  const result = await getDatabasePermissions();
  return result.ok && (result.permissions.includes("sepay.allocate") || result.permissions.includes("payments.manage"));
}
function allocationError(message: string): string {
  const messages: Record<string, string> = {
    TRANSACTION_ALREADY_RECONCILED: "Giao dịch đã được xử lý. Vui lòng tải lại để xem kết quả.",
    TRANSACTION_HAS_FINANCIAL_EFFECTS: "Giao dịch đã được ghi nhận tiền hoặc số buổi; không thể phân bổ thêm.",
    SEPAY_ACCOUNT_PURPOSE_UNRESOLVED: "Cần xác định tài khoản nhận Tuyển mới/Tái phí trước khi phân bổ.",
    STUDENT_HAS_OPEN_PAYMENT_REQUEST: "Học sinh đã có yêu cầu thanh toán chưa hoàn tất. Hãy chọn yêu cầu đó để tránh ghi nhận trùng công nợ.",
    PAYMENT_REQUEST_NOT_AVAILABLE: "Yêu cầu đã thay đổi hoặc đã được thanh toán. Vui lòng tìm lại học sinh.",
    PAYMENT_REQUEST_ALLOCATION_MISMATCH: "Tiền và số buổi phải khớp yêu cầu đã chọn. Chưa hỗ trợ thanh toán một phần trong thao tác này.",
    ACCOUNT_PURPOSE_TOPUP_TYPE_MISMATCH: "Yêu cầu thanh toán không cùng loại Tuyển mới/Tái phí với tài khoản nhận.",
    ALLOCATION_TOTAL_MUST_MATCH_TRANSACTION: "Tổng tiền phân bổ phải bằng số tiền giao dịch.",
    STUDENT_PRIMARY_GUARDIAN_NOT_FOUND: "Học sinh chưa có phụ huynh chính. Vui lòng cập nhật hồ sơ trước.",
    STUDENT_NOT_FOUND: "Học sinh không tồn tại hoặc không còn hoạt động.",
    TRANSACTION_NOT_INBOUND: "Chỉ phân bổ học phí từ giao dịch tiền vào.",
    DUPLICATE_ALLOCATION_STUDENT: "Mỗi học sinh chỉ được phân bổ một lần trong giao dịch.",
    SEPAY_ALLOCATE_PERMISSION_DENIED: "Tài khoản không có quyền phân bổ học phí.",
  };
  return Object.entries(messages).find(([key]) => message.includes(key))?.[1]
    ?? "Không thể phân bổ học phí. Vui lòng tải lại và kiểm tra dữ liệu.";
}
export async function searchAllocationStudentsAction(query: string): Promise<Result<AllocationStudent[]>> {
  if (!(await canAllocate())) return { ok: false, message: "Tài khoản không có quyền phân bổ học phí." };
  const parsed = z.string().trim().min(2).max(100).safeParse(query);
  if (!parsed.success) return { ok: false, message: "Nhập từ 2 đến 100 ký tự để tìm học sinh." };
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("search_sepay_allocation_students", { p_search: parsed.data });
    if (error) return { ok: false, message: "Không tải được học sinh. Vui lòng thử lại." };
    const students = (data ?? []).map((s) => ({
      id: s.student_id, name: s.student_name, publicCode: s.student_code, birthYear: s.birth_year,
      guardianName: s.guardian_name, guardianPhone: s.guardian_phone,
      requests: z.array(allocationRequestSchema).parse(s.pending_requests),
    }));
    return { ok: true, data: students };
  } catch { return { ok: false, message: "Không tải được học sinh. Vui lòng thử lại." }; }
}
export async function allocateSepayTuitionAction(input: ManualAllocationInput): Promise<Result<null>> {
  if (!(await canAllocate())) return { ok: false, message: "Tài khoản không có quyền phân bổ học phí." };
  const parsed = manualAllocationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  try {
    const client = await createSupabaseServerClient();
    const { error } = await client.rpc("allocate_sepay_tuition_manually", {
      p_sepay_transaction_id: parsed.data.transactionId, p_reason: parsed.data.reason,
      p_allocations: parsed.data.allocations.map((row) => ({
        student_id: row.studentId, payment_request_id: row.paymentRequestId,
        allocated_amount_vnd: row.amountVnd, allocated_sessions: row.sessions, bonus_sessions: row.bonusSessions,
      })),
    });
    if (error) return { ok: false, message: allocationError(error.message) };
    for (const path of ["/finance", "/finance/sepay", "/finance/orders", "/finance/payment-requests", "/finance/session-ledger", "/finance/tuition-periods"]) revalidatePath(path);
    for (const row of parsed.data.allocations) revalidatePath(`/students/${row.studentId}`);
    return { ok: true, data: null };
  } catch { return { ok: false, message: "Chưa xác nhận được kết quả. Hãy tải lại giao dịch trước khi thử lại để tránh ghi nhận trùng." }; }
}
export async function getAllocationDetailsAction(transactionId: string): Promise<Result<AllocationDetail[]>> {
  const permissions = await getDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("sepay.view")) return { ok: false, message: "Không có quyền xem giao dịch." };
  if (!z.string().uuid().safeParse(transactionId).success) return { ok: false, message: "Giao dịch không hợp lệ." };
  try {
    const client = await createSupabaseServerClient();
    const { data, error } = await client.rpc("get_sepay_allocation_details", { p_sepay_transaction_id: transactionId });
    return error ? { ok: false, message: "Không tải được chi tiết phân bổ." } : { ok: true, data: data ?? [] };
  } catch { return { ok: false, message: "Không tải được chi tiết phân bổ." }; }
}
