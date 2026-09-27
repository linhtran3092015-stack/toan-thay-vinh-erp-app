import type { PayslipEmployeeInfo } from "@/features/payroll/payslip/types";

function getInitials(name: string | null | undefined): string {
  if (!name || !name.trim()) return "NV";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NV";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0] || "";
  const last = parts[parts.length - 1][0] || "";
  return (first + last).toUpperCase() || "NV";
}

export function PayslipEmployeeCard({
  employee,
}: {
  employee: PayslipEmployeeInfo;
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-surface-base p-4 shadow-xs">
      <div className="flex items-start gap-3.5">
        {/* Avatar */}
        {employee.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={employee.displayName}
            className="h-14 w-14 shrink-0 rounded-full border-2 border-border-subtle object-cover"
            src={employee.avatarUrl}
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-action-primary/10 font-bold text-action-primary">
            <span className="text-base">{getInitials(employee.displayName)}</span>
          </div>
        )}

        {/* Name & Position */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-text-strong sm:text-lg">
            {employee.displayName}
          </h3>
          <p className="text-xs font-semibold text-action-primary">
            {employee.positionLabel}
          </p>
        </div>
      </div>

      {/* Attributes Grid */}
      <dl className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border-subtle pt-3 text-xs">
        {employee.employeeCode ? (
          <div>
            <dt className="text-text-muted">Mã nhân sự</dt>
            <dd className="font-semibold text-text-strong tabular-nums">
              {employee.employeeCode}
            </dd>
          </div>
        ) : null}

        <div>
          <dt className="text-text-muted">Vị trí</dt>
          <dd className="font-semibold text-text-strong">
            {employee.positionLabel}
          </dd>
        </div>

        {employee.bankAccount ? (
          <>
            <div>
              <dt className="text-text-muted">Số tài khoản</dt>
              <dd className="font-semibold text-text-strong tabular-nums">
                {employee.bankAccount.accountNumberMasked}
              </dd>
            </div>
            <div>
              <dt className="text-text-muted">Ngân hàng</dt>
              <dd className="truncate font-semibold text-text-strong">
                {employee.bankAccount.bankName}
              </dd>
            </div>
          </>
        ) : null}
      </dl>
    </div>
  );
}
