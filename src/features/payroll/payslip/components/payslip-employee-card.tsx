import type { PayslipEmployeeInfo, PayslipPeriodInfo } from "@/features/payroll/payslip/types";

/**
 * Employee, period and masked bank account as one definition list (design 8b).
 * The account number arrives already masked from the loader.
 */
export function PayslipEmployeeCard({
  employee,
  period,
}: {
  employee: PayslipEmployeeInfo;
  period: PayslipPeriodInfo;
}) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-y border-border-row py-3 text-secondary">
      <dt className="text-text-muted">Nhân sự</dt>
      <dd className="min-w-0 break-words text-text-strong">
        <span className="font-semibold">{employee.displayName}</span>
        {employee.employeeCode ? (
          <>
            {" · "}
            <span className="tabular-nums">{employee.employeeCode}</span>
          </>
        ) : null}
        {" · "}
        <span>{employee.positionLabel}</span>
      </dd>

      <dt className="text-text-muted">Kỳ tính</dt>
      <dd className="tabular-nums text-text-default">
        {period.periodStartDate} – {period.periodEndDate}
      </dd>

      <dt className="text-text-muted">Ngày trả lương</dt>
      <dd className="tabular-nums text-text-default">{period.payDateFormatted}</dd>

      <dt className="text-text-muted">Tài khoản</dt>
      <dd className="min-w-0 break-words text-text-default">
        {employee.bankAccount ? (
          <>
            <span>{employee.bankAccount.bankName}</span>{" "}
            <span className="tabular-nums">{employee.bankAccount.accountNumberMasked}</span>
            {employee.bankAccount.accountHolderName ? (
              <span className="text-text-muted"> · {employee.bankAccount.accountHolderName}</span>
            ) : null}
          </>
        ) : (
          <span className="text-text-muted">Chưa có tài khoản nhận lương</span>
        )}
      </dd>
    </dl>
  );
}
