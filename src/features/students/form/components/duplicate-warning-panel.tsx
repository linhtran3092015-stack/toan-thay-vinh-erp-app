import { useFormContext } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudentFormValues } from "../student-form-schema";
import type {
  GuardianDuplicateResult,
  StudentDuplicateResult,
} from "../student-form-types";
import {
  describedBy,
  FieldShell,
  getFieldError,
  textAreaControlClass,
} from "./form-controls";

interface DuplicateWarningPanelProps {
  guardianDuplicate: GuardianDuplicateResult | null;
  mode: "create" | "edit";
  studentDuplicate: StudentDuplicateResult | null;
}

export function DuplicateWarningPanel({
  guardianDuplicate,
  mode,
  studentDuplicate,
}: DuplicateWarningPanelProps) {
  const {
    formState: { errors },
    register,
  } = useFormContext<StudentFormValues>();

  if (!guardianDuplicate && !studentDuplicate) {
    return null;
  }

  return (
    <Card className="border-warning-border bg-warning-bg shadow-none">
      <CardHeader>
        <CardTitle>Cảnh báo trùng thông tin</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm leading-6">
        {guardianDuplicate ? (
          <div className="grid gap-3">
            <div>
              <p className="font-semibold text-warning">
                Phụ huynh này đã có hồ sơ trong hệ thống.
              </p>
              <p className="text-ink">
                SĐT chuẩn hóa: {guardianDuplicate.normalizedPhone} · Phụ
                huynh: {guardianDuplicate.guardianName}
              </p>
            </div>
            <div className="grid gap-2">
              {guardianDuplicate.children.map((child) => (
                <div
                  className="rounded-md border border-warning-border bg-white px-3 py-2"
                  key={child.id}
                >
                  <p className="font-semibold text-ink">{child.fullName}</p>
                  <p className="text-xs text-ink-muted">
                    {child.publicCode} · {child.className} · {child.statusLabel}
                  </p>
                </div>
              ))}
            </div>
            <fieldset className="grid gap-2">
              <legend className="text-sm font-semibold text-ink-muted">
                Cách xử lý phụ huynh
              </legend>
              <label className="flex min-h-11 items-center gap-3 rounded-md border border-warning-border bg-white px-3 py-2">
                <input
                  className="h-5 w-5 accent-primary"
                  type="radio"
                  value="existing"
                  {...register("guardianLinkMode")}
                />
                Dùng phụ huynh hiện có
              </label>
              <label className="flex min-h-11 items-center gap-3 rounded-md border border-warning-border bg-white px-3 py-2">
                <input
                  className="h-5 w-5 accent-primary"
                  type="radio"
                  value="new"
                  {...register("guardianLinkMode")}
                />
                Tạo phụ huynh mới trong hồ sơ mock
              </label>
            </fieldset>
          </div>
        ) : null}

        {studentDuplicate ? (
          <div className="grid gap-3">
            <div>
              <p className="font-semibold text-warning">
                Có học viên gần trùng thông tin.
              </p>
              <p className="text-ink">
                Cảnh báo này không chặn hoàn toàn, nhưng cần ghi rõ lý do nếu
                vẫn tạo hồ sơ mới.
              </p>
            </div>
            <div className="grid gap-2">
              {studentDuplicate.candidates.map((candidate) => (
                <div
                  className="rounded-md border border-warning-border bg-white px-3 py-2"
                  key={candidate.id}
                >
                  <p className="font-semibold text-ink">
                    {candidate.fullName} · {candidate.publicCode}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {candidate.className} · {candidate.reason}
                  </p>
                </div>
              ))}
            </div>

            {mode === "create" ? (
              <FieldShell
                error={getFieldError(errors, "duplicateOverrideReason")}
                id="duplicateOverrideReason"
                label="Lý do tiếp tục tạo hồ sơ"
                required
              >
                <textarea
                  aria-describedby={describedBy(
                    "duplicateOverrideReason",
                    getFieldError(errors, "duplicateOverrideReason"),
                  )}
                  className={textAreaControlClass(
                    getFieldError(errors, "duplicateOverrideReason"),
                  )}
                  id="duplicateOverrideReason"
                  {...register("duplicateOverrideReason")}
                />
              </FieldShell>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
