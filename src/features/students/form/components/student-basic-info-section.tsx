import { useFormContext } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  describedBy,
  fieldControlClass,
  FieldShell,
  getFieldError,
  textAreaControlClass,
} from "./form-controls";
import type { StudentFormValues } from "../student-form-schema";
import { formLifecycleStatusOptions } from "../student-form-types";

interface StudentBasicInfoSectionProps {
  mode: "create" | "edit";
}

export function StudentBasicInfoSection({
  mode,
}: StudentBasicInfoSectionProps) {
  const {
    formState: { errors },
    register,
  } = useFormContext<StudentFormValues>();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông tin học viên</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {mode === "edit" ? (
          <FieldShell id="publicCode" label="Mã học viên">
            <input
              className={fieldControlClass(undefined, "font-mono font-semibold")}
              id="publicCode"
              readOnly
              {...register("publicCode")}
            />
          </FieldShell>
        ) : (
          <div className="rounded-lg border border-info-border bg-info-bg p-4 text-sm leading-6 text-info">
            Mã học viên sẽ được cấp khi hồ sơ được xác nhận chính thức.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <FieldShell
            error={getFieldError(errors, "fullName")}
            id="fullName"
            label="Họ và tên"
            required
          >
            <input
              aria-describedby={describedBy(
                "fullName",
                getFieldError(errors, "fullName"),
              )}
              className={fieldControlClass(getFieldError(errors, "fullName"))}
              id="fullName"
              {...register("fullName")}
            />
          </FieldShell>

          <FieldShell id="nickname" label="Tên thường gọi">
            <input
              className={fieldControlClass()}
              id="nickname"
              {...register("nickname")}
            />
          </FieldShell>

          <FieldShell
            error={getFieldError(errors, "birthYear")}
            id="birthYear"
            label="Năm sinh"
            required
          >
            <input
              aria-describedby={describedBy(
                "birthYear",
                getFieldError(errors, "birthYear"),
              )}
              className={fieldControlClass(getFieldError(errors, "birthYear"))}
              id="birthYear"
              inputMode="numeric"
              type="number"
              {...register("birthYear", { valueAsNumber: true })}
            />
          </FieldShell>

          <FieldShell
            error={getFieldError(errors, "currentGrade")}
            id="currentGrade"
            label="Khối hiện tại"
            required
          >
            <select
              aria-describedby={describedBy(
                "currentGrade",
                getFieldError(errors, "currentGrade"),
              )}
              className={fieldControlClass(getFieldError(errors, "currentGrade"))}
              id="currentGrade"
              {...register("currentGrade", { valueAsNumber: true })}
            >
              {Array.from({ length: 12 }).map((_, index) => {
                const grade = index + 1;

                return (
                  <option key={grade} value={grade}>
                    Khối {grade}
                  </option>
                );
              })}
            </select>
          </FieldShell>

          <FieldShell
            error={getFieldError(errors, "lifecycleStatus")}
            id="lifecycleStatus"
            label="Trạng thái hồ sơ"
            required
          >
            <select
              aria-describedby={describedBy(
                "lifecycleStatus",
                getFieldError(errors, "lifecycleStatus"),
              )}
              className={fieldControlClass(
                getFieldError(errors, "lifecycleStatus"),
              )}
              id="lifecycleStatus"
              {...register("lifecycleStatus")}
            >
              {formLifecycleStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FieldShell>

          <FieldShell id="provinceName" label="Tỉnh/thành phố">
            <input
              className={fieldControlClass()}
              id="provinceName"
              {...register("provinceName")}
            />
          </FieldShell>

          <FieldShell id="learningLevel" label="Mức A/B/CLC">
            <select
              className={fieldControlClass()}
              id="learningLevel"
              {...register("learningLevel")}
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="CLC">CLC</option>
            </select>
          </FieldShell>
        </div>

        <FieldShell id="learningGoal" label="Mục tiêu học tập">
          <textarea
            className={textAreaControlClass()}
            id="learningGoal"
            {...register("learningGoal")}
          />
        </FieldShell>

        <FieldShell id="internalNote" label="Ghi chú nội bộ">
          <textarea
            className={textAreaControlClass()}
            id="internalNote"
            {...register("internalNote")}
          />
        </FieldShell>
      </CardContent>
    </Card>
  );
}
