import { useFormContext } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enrollmentChecklistItems } from "../mock-form-data";
import { getMissingChecklistLabels } from "../helpers";
import type { StudentFormValues } from "../student-form-schema";
import type { StudentFormPermissionSet } from "../student-form-types";
import { getFieldError } from "./form-controls";

interface EnrollmentChecklistSectionProps {
  permissions: StudentFormPermissionSet;
}

export function EnrollmentChecklistSection({
  permissions,
}: EnrollmentChecklistSectionProps) {
  const {
    formState: { errors },
    register,
    watch,
  } = useFormContext<StudentFormValues>();
  const values = watch();
  const missingChecklistLabels = getMissingChecklistLabels(values);
  const wantsActive = values.lifecycleStatus === "active";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checklist nhập học</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {wantsActive && missingChecklistLabels.length > 0 ? (
          <div
            className="rounded-lg border border-warning-border bg-warning-bg p-4 text-sm leading-6 text-warning"
            role="alert"
          >
            <p className="font-semibold">
              Chưa thể chuyển hồ sơ sang Đang học.
            </p>
            <p className="mt-1 text-ink">
              Cần hoàn tất: {missingChecklistLabels.join(", ")}.
            </p>
          </div>
        ) : null}

        <div className="grid gap-3">
          {enrollmentChecklistItems.map((item) => {
            const isAccountingItem =
              item.id === "accountantTransactionConfirmed";
            const isDisabled =
              isAccountingItem && !permissions.canAccountantConfirm;
            const error = getFieldError(errors, item.id);

            return (
              <label
                className={`flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm leading-6 ${
                  error
                    ? "border-danger bg-danger-bg"
                    : "border-hairline bg-surface-2"
                } ${isDisabled ? "opacity-70" : ""}`}
                key={item.id}
              >
                <input
                  aria-describedby={error ? `${item.id}-error` : undefined}
                  className="mt-1 h-5 w-5 rounded border-hairline accent-primary"
                  disabled={isDisabled}
                  type="checkbox"
                  {...register(item.id)}
                />
                <span className="min-w-0">
                  <span className="font-semibold text-ink">{item.label}</span>
                  {isDisabled ? (
                    <span className="block text-xs text-ink-muted">
                      Chỉ tài khoản có quyền kế toán mới được xác nhận mục này.
                    </span>
                  ) : null}
                  {error ? (
                    <span
                      className="block text-xs font-semibold text-danger"
                      id={`${item.id}-error`}
                    >
                      {error}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
