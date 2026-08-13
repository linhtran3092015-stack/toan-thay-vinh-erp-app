import { ErrorState } from "@/components/shared/error-state";
import { PermissionDeniedState } from "@/components/shared/permission-denied-state";
import { SepayTransactionHistory } from "@/features/finance/components/sepay-transaction-history";
import { getSepayTransactionsResult } from "@/features/finance/data";
import { parseSepayAccountPurposeFilter } from "@/features/finance/sepay-transaction-url-state";
import { getCachedDatabasePermissions } from "@/lib/permissions/database-permissions";

interface SepayTransactionsPageProps {
  searchParams: Promise<{ accountPurpose?: string | string[] }>;
}

export default async function SepayTransactionsPage({ searchParams }: SepayTransactionsPageProps) {
  const permissionResult = await getCachedDatabasePermissions();

  if (!permissionResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được quyền truy cập Giao dịch SePay."
        title="Không tải được quyền truy cập"
      />
    );
  }

  if (!permissionResult.permissions.includes("sepay.view")) {
    return (
      <PermissionDeniedState
        description="Tài khoản hiện tại không có quyền sepay.view."
        title="Không có quyền xem Giao dịch SePay"
      />
    );
  }

  const accountPurposeFilter = parseSepayAccountPurposeFilter(
    (await searchParams).accountPurpose,
  );
  const transactionsResult = await getSepayTransactionsResult(accountPurposeFilter);
  if (!transactionsResult.ok) {
    return (
      <ErrorState
        description="Hệ thống chưa tải được lịch sử giao dịch SePay. Vui lòng thử lại sau."
        title="Không tải được giao dịch SePay"
      />
    );
  }

  return (
    <SepayTransactionHistory
      accountPurposeFilter={accountPurposeFilter}
      transactions={transactionsResult.data}
    />
  );
}
