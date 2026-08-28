import type {
  EmployeeInfoBlockSettings,
  PayslipBrandingConfig,
} from "@/features/payroll/payslip-template/types";
import type { PayslipEmployeeInfo } from "@/features/payroll/payslip/types";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface PayslipEmployeeCardProps {
  blockSettings?: EmployeeInfoBlockSettings;
  branding?: Partial<PayslipBrandingConfig>;
  employee: PayslipEmployeeInfo;
}

export function PayslipEmployeeCard({
  blockSettings = {},
  branding = {},
  employee,
}: PayslipEmployeeCardProps) {
  const showAvatar = blockSettings.showAvatar !== false;
  const showEmployeeCode = blockSettings.showEmployeeCode !== false;
  const showPosition = blockSettings.showPosition !== false;
  const showDepartment = blockSettings.showDepartment !== false;
  const showJoinedDate = blockSettings.showJoinedDate !== false;
  const showBankInfo = blockSettings.showBankInfo !== false;

  return (
    <div
      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
      style={{
        backgroundColor: branding.accentColor ? `${branding.accentColor}33` : "white",
      }}
    >
      <div className="flex items-start gap-3.5">
        {/* Avatar */}
        {showAvatar ? (
          employee.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={employee.displayName}
              className="h-14 w-14 shrink-0 rounded-full border-2 border-slate-200 object-cover"
              src={employee.avatarUrl}
            />
          ) : (
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full font-bold text-white shadow-xs"
              style={{ backgroundColor: branding.primaryColor || "#1e3a8a" }}
            >
              <span className="text-base">{getInitials(employee.displayName)}</span>
            </div>
          )
        ) : null}

        {/* Name & Position */}
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-base font-bold sm:text-lg"
            style={{ color: branding.primaryColor || "#0f172a" }}
          >
            {employee.displayName}
          </h3>
          {showPosition ? (
            <p
              className="text-xs font-semibold"
              style={{ color: branding.secondaryColor || "#3b82f6" }}
            >
              {employee.positionLabel}
            </p>
          ) : null}
        </div>
      </div>

      {/* Attributes Grid */}
      <dl className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-xs">
        {showEmployeeCode && employee.employeeCode ? (
          <div>
            <dt className="text-slate-500">Mã nhân sự</dt>
            <dd className="font-semibold text-slate-900 tabular-nums">
              {employee.employeeCode}
            </dd>
          </div>
        ) : null}

        {showPosition ? (
          <div>
            <dt className="text-slate-500">Vị trí</dt>
            <dd className="font-semibold text-slate-900">
              {employee.positionLabel}
            </dd>
          </div>
        ) : null}

        {showDepartment && employee.department ? (
          <div>
            <dt className="text-slate-500">Bộ phận</dt>
            <dd className="font-semibold text-slate-900 truncate">
              {employee.department}
            </dd>
          </div>
        ) : null}

        {showJoinedDate && employee.joinedAt ? (
          <div>
            <dt className="text-slate-500">Ngày vào làm</dt>
            <dd className="font-semibold text-slate-900 tabular-nums">
              {employee.joinedAt}
            </dd>
          </div>
        ) : null}

        {showBankInfo && employee.bankAccount ? (
          <>
            <div>
              <dt className="text-slate-500">Số tài khoản</dt>
              <dd className="font-semibold text-slate-900 tabular-nums">
                {employee.bankAccount.accountNumberMasked}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Ngân hàng</dt>
              <dd className="truncate font-semibold text-slate-900">
                {employee.bankAccount.bankName}
              </dd>
            </div>
          </>
        ) : null}
      </dl>
    </div>
  );
}
