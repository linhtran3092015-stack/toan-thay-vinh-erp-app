"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ReceivingAccountActionResult = { message: string; ok: boolean };

const optionalUuidSchema = z.union([z.literal(""), z.string().uuid()]);

function denied(): ReceivingAccountActionResult {
  return { message: "Không có quyền quản lý tài khoản nhận SePay.", ok: false };
}

export async function createSepayReceivingAccountVersionAction(input: {
  accountDisplayName: string;
  accountNumber: string;
  bankCode: string;
  effectiveFrom: string;
  purpose: "new_enrollment" | "renewal";
  reason: string;
  sepayBankAccountId?: string;
}): Promise<ReceivingAccountActionResult> {
  const permissions = await getDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("settings.sepay_receiving_accounts.manage")) return denied();
  const apiIdentity = optionalUuidSchema.safeParse(input.sepayBankAccountId?.trim() ?? "");
  if (!apiIdentity.success) {
    return { message: "ID tài khoản SePay API phải là UUID hợp lệ.", ok: false };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_sepay_receiving_account_version", {
    p_account_display_name: input.accountDisplayName.trim(),
    p_account_number: input.accountNumber.trim(),
    p_bank_code: input.bankCode.trim(),
    p_effective_from: input.effectiveFrom,
    p_purpose: input.purpose,
    p_reason: input.reason.trim(),
    p_sepay_bank_account_id: apiIdentity.data || undefined,
  });
  if (error) return { message: "Không thể lưu phiên bản tài khoản. Kiểm tra ngày hiệu lực, định danh hoặc lý do.", ok: false };
  revalidatePath("/finance/receiving-accounts");
  return { message: "Đã tạo phiên bản tài khoản nhận SePay.", ok: true };
}

export async function setSepayReceivingAccountApiIdentityAction(
  accountVersionId: string,
  sepayBankAccountId: string,
  reason: string,
): Promise<ReceivingAccountActionResult> {
  const permissions = await getDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("settings.sepay_receiving_accounts.manage")) return denied();

  const parsed = z.object({
    accountVersionId: z.string().uuid(),
    reason: z.string().trim().min(1),
    sepayBankAccountId: z.string().trim().uuid(),
  }).safeParse({ accountVersionId, reason, sepayBankAccountId });
  if (!parsed.success) {
    return { message: "Vui lòng nhập đúng ID tài khoản SePay API và lý do thay đổi.", ok: false };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_sepay_receiving_account_api_identity", {
    p_account_version_id: parsed.data.accountVersionId,
    p_reason: parsed.data.reason,
    p_sepay_bank_account_id: parsed.data.sepayBankAccountId,
  });
  if (error) {
    return { message: "Không thể gắn ID tài khoản SePay API. Kiểm tra ID có đang được dùng trùng thời gian hay không.", ok: false };
  }

  revalidatePath("/finance/receiving-accounts");
  revalidatePath("/finance/sepay");
  return { message: "Đã gắn ID tài khoản SePay API.", ok: true };
}

export async function retireSepayReceivingAccountVersionAction(
  accountVersionId: string,
  effectiveTo: string,
  reason: string,
): Promise<ReceivingAccountActionResult> {
  const permissions = await getDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("settings.sepay_receiving_accounts.manage")) return denied();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("retire_sepay_receiving_account_version", {
    p_account_version_id: accountVersionId,
    p_effective_to: effectiveTo,
    p_reason: reason.trim(),
  });
  if (error) return { message: "Không thể kết thúc hiệu lực tài khoản. Kiểm tra ngày và lý do.", ok: false };
  revalidatePath("/finance/receiving-accounts");
  return { message: "Đã kết thúc hiệu lực phiên bản tài khoản.", ok: true };
}
