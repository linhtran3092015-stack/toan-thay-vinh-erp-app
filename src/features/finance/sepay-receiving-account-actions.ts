"use server";

import { revalidatePath } from "next/cache";

import { getDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ReceivingAccountActionResult = { message: string; ok: boolean };

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
}): Promise<ReceivingAccountActionResult> {
  const permissions = await getDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("settings.sepay_receiving_accounts.manage")) return denied();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_sepay_receiving_account_version", {
    p_account_display_name: input.accountDisplayName.trim(),
    p_account_number: input.accountNumber.trim(),
    p_bank_code: input.bankCode.trim(),
    p_effective_from: input.effectiveFrom,
    p_purpose: input.purpose,
    p_reason: input.reason.trim(),
  });
  if (error) return { message: "Không thể lưu phiên bản tài khoản. Kiểm tra ngày hiệu lực, định danh hoặc lý do.", ok: false };
  revalidatePath("/finance/receiving-accounts");
  return { message: "Đã tạo phiên bản tài khoản nhận SePay.", ok: true };
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
