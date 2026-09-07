"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SepayReconciliationCandidateReadModel } from "@/features/finance/read-models";

export type SepayReconciliationActionResult = { message: string; ok: boolean };
export type SepayCandidateSearchResult =
  | { candidates: SepayReconciliationCandidateReadModel[]; ok: true }
  | { message: string; ok: false };

const baseSchema = z.object({
  reason: z.string().trim().min(3, "Lý do phải có ít nhất 3 ký tự."),
  transactionId: z.string().uuid(),
});

async function canReconcile(): Promise<boolean> {
  const permissions = await getDatabasePermissions();
  return permissions.ok && (
    permissions.permissions.includes("sepay.sync_history.manage")
    || permissions.permissions.includes("sepay.allocate")
    || permissions.permissions.includes("payments.manage")
  );
}

function errorMessage(message: string): string {
  if (message.includes("AMOUNT_MISMATCH")) return "Số tiền giao dịch không bằng số tiền yêu cầu thanh toán.";
  if (message.includes("ACCOUNT_PURPOSE_TOPUP_TYPE_MISMATCH")) return "Tài khoản nhận không đúng loại Tuyển mới/Tái phí của yêu cầu thanh toán.";
  if (message.includes("TRANSACTION_IDENTITY_CONFLICT_OWNER_REQUIRED")) return "Chỉ Chủ trung tâm có thể kết thúc đối soát giao dịch trùng nhận diện.";
  if (message.includes("TRANSACTION_IDENTITY_CONFLICT_LOCKED")) return "Giao dịch đang trùng nhận diện và phải xử lý xung đột trước.";
  if (message.includes("TRANSACTION_ALREADY_RECONCILED")) return "Giao dịch này đã được đối soát trước đó.";
  if (message.includes("PAYMENT_REQUEST_NOT_AVAILABLE")) return "Yêu cầu thanh toán không còn ở trạng thái chờ hoặc thiếu học viên.";
  if (message.includes("TRANSACTION_NOT_INBOUND")) return "Chỉ giao dịch tiền vào mới được khớp học phí.";
  return "Không thể hoàn tất đối soát. Vui lòng tải lại dữ liệu và kiểm tra lựa chọn.";
}

export async function searchSepayReconciliationCandidatesAction(input: {
  query: string;
  transactionId: string;
}): Promise<SepayCandidateSearchResult> {
  if (!(await canReconcile())) {
    return { message: "Tài khoản hiện tại không có quyền đối soát SePay.", ok: false };
  }

  const parsed = z.object({
    query: z.string().trim().min(2, "Nhập ít nhất 2 ký tự để tìm kiếm.").max(100),
    transactionId: z.string().uuid(),
  }).safeParse(input);
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Từ khóa tìm kiếm không hợp lệ.", ok: false };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("search_sepay_reconciliation_candidates", {
    p_limit: 50,
    p_search: parsed.data.query,
    p_sepay_transaction_id: parsed.data.transactionId,
  });
  if (error) return { message: errorMessage(error.message), ok: false };

  return {
    candidates: (data ?? []).flatMap((request): SepayReconciliationCandidateReadModel[] => {
      if (request.topup_type !== "new" && request.topup_type !== "renewal") return [];
      return [{
        expectedAmountVnd: Number(request.expected_amount_vnd),
        id: request.request_id,
        publicCode: request.public_code,
        studentFullName: request.student_full_name,
        topupType: request.topup_type,
      }];
    }),
    ok: true,
  };
}

export async function resolveSepayHistoricalTransactionAction(input: {
  reason: string;
  resolution: "already_accounted" | "ignored";
  transactionId: string;
}): Promise<SepayReconciliationActionResult> {
  if (!(await canReconcile())) {
    return { message: "Tài khoản hiện tại không có quyền đối soát SePay.", ok: false };
  }

  const parsed = baseSchema.extend({
    resolution: z.enum(["already_accounted", "ignored"]),
  }).safeParse(input);
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Dữ liệu đối soát không hợp lệ.", ok: false };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("resolve_sepay_historical_transaction", {
    p_reason: parsed.data.reason,
    p_resolution: parsed.data.resolution,
    p_sepay_transaction_id: parsed.data.transactionId,
  });
  if (error) return { message: errorMessage(error.message), ok: false };

  revalidatePath("/finance/sepay");
  return {
    message: parsed.data.resolution === "already_accounted"
      ? "Đã đánh dấu giao dịch là đã hạch toán trước đây. Không phát sinh học phí mới."
      : "Đã bỏ qua giao dịch và lưu lý do.",
    ok: true,
  };
}

export async function matchSepayHistoricalTransactionAction(input: {
  paymentRequestId: string;
  reason: string;
  transactionId: string;
}): Promise<SepayReconciliationActionResult> {
  if (!(await canReconcile())) {
    return { message: "Tài khoản hiện tại không có quyền đối soát SePay.", ok: false };
  }

  const parsed = baseSchema.extend({ paymentRequestId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Dữ liệu đối soát không hợp lệ.", ok: false };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(
    "match_sepay_historical_transaction_to_payment_request",
    {
      p_payment_request_id: parsed.data.paymentRequestId,
      p_reason: parsed.data.reason,
      p_sepay_transaction_id: parsed.data.transactionId,
    },
  );
  if (error) return { message: errorMessage(error.message), ok: false };

  revalidatePath("/finance/sepay");
  revalidatePath("/finance/payment-requests");
  revalidatePath("/finance/orders");
  revalidatePath("/finance");
  return { message: "Đã khớp giao dịch với yêu cầu thanh toán và ghi nhận học phí.", ok: true };
}
