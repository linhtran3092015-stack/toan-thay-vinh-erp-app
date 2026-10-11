"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SepayAllocationReversalResult =
  | { message: string; ok: false }
  | { message: string; ok: true; payrollMonthsToRecalculate: string[] };

const inputSchema = z.object({
  reason: z.string().trim().min(3, "Lý do phải có ít nhất 3 ký tự.").max(1000, "Lý do tối đa 1000 ký tự."),
  transactionId: z.string().uuid(),
});

const resultSchema = z.object({
  payroll_months_to_recalculate: z.array(z.string()).default([]),
  reversed_amount_vnd: z.coerce.number(),
  status: z.literal("success"),
  student_count: z.coerce.number().int(),
});

function errorMessage(message: string): string {
  if (message.includes("PAYMENTS_MANAGE_PERMISSION_DENIED")) return "Tài khoản hiện tại không có quyền đảo phân bổ.";
  if (message.includes("TRANSACTION_NOT_ALLOCATED")) return "Giao dịch này chưa được khớp hoặc phân bổ nên không có gì để đảo.";
  if (message.includes("ALLOCATION_NOT_FOUND")) return "Không tìm thấy dòng tiền hay lô buổi của giao dịch này.";
  if (message.includes("ALLOCATION_LOCKED_BY_APPROVED_PAYROLL")) {
    return "Tháng tiền về đã có kỳ lương được duyệt. Mở lại kỳ lương đó trước khi đảo phân bổ.";
  }
  if (message.includes("TRANSACTION_NOT_FOUND")) return "Không tìm thấy giao dịch.";
  if (message.includes("REASON_REQUIRED")) return "Vui lòng nhập lý do đảo phân bổ (3–1000 ký tự).";
  return "Không thể đảo phân bổ. Vui lòng tải lại trang và thử lại.";
}

function formatMonth(value: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(value);
  return match ? `${match[2]}/${match[1]}` : value;
}

export async function reverseSepayAllocationAction(input: {
  reason: string;
  transactionId: string;
}): Promise<SepayAllocationReversalResult> {
  const permissions = await getDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("payments.manage")) {
    return { message: "Tài khoản hiện tại không có quyền đảo phân bổ.", ok: false };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.", ok: false };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("reverse_sepay_allocation", {
    p_reason: parsed.data.reason,
    p_sepay_transaction_id: parsed.data.transactionId,
  });
  if (error) return { message: errorMessage(error.message), ok: false };

  const result = resultSchema.safeParse(data);
  if (!result.success) {
    return { message: "Đã đảo phân bổ nhưng không đọc được kết quả. Vui lòng tải lại trang.", ok: false };
  }

  revalidatePath("/finance/sepay");
  revalidatePath("/finance/payment-requests");
  revalidatePath("/finance/orders");
  revalidatePath("/finance");
  revalidatePath("/students");
  revalidatePath("/commissions");
  revalidatePath("/payroll");

  const months = result.data.payroll_months_to_recalculate.map(formatMonth);
  const amount = new Intl.NumberFormat("vi-VN").format(result.data.reversed_amount_vnd);
  const base = `Đã đảo phân bổ ${amount} ₫ của ${result.data.student_count} học sinh. Giao dịch quay về hàng đợi chưa khớp.`;
  return {
    message: months.length > 0
      ? `${base} Kỳ lương tháng ${months.join(", ")} đang nháp cần "Tính lại".`
      : base,
    ok: true,
    payrollMonthsToRecalculate: months,
  };
}
