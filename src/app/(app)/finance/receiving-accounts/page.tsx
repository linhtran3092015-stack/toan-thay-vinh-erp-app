import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { SepayReceivingAccountManagement, type ReceivingAccountVersionView } from "@/features/finance/sepay-receiving-account-management";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SepayReceivingAccountsPage() {
  const permissions = await getCachedDatabasePermissions();
  if (!permissions.ok || !permissions.permissions.includes("settings.sepay_receiving_accounts.manage")) return <PermissionDeniedState title="Không có quyền quản lý tài khoản nhận" description="Yêu cầu quyền settings.sepay_receiving_accounts.manage." />;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("sepay_receiving_account_versions").select("id,purpose,bank_code,account_number,account_display_name,effective_from,effective_to").order("purpose").order("effective_from", { ascending: false });
  const versions: ReceivingAccountVersionView[] = (data ?? []).flatMap((version) => version.purpose === "new_enrollment" || version.purpose === "renewal" ? [{ accountDisplayName: version.account_display_name, accountNumber: version.account_number, bankCode: version.bank_code, effectiveFrom: version.effective_from, effectiveTo: version.effective_to, id: version.id, purpose: version.purpose as ReceivingAccountVersionView["purpose"] }] : []);
  return <main className="grid gap-5"><div><h1 className="text-page-title font-semibold">Tài khoản nhận SePay</h1><p className="mt-1 text-secondary text-text-muted">Quản lý metadata công khai theo phiên bản hiệu lực. Secret tích hợp vẫn chỉ nằm trong ENV.</p></div><SepayReceivingAccountManagement versions={versions} /></main>;
}
