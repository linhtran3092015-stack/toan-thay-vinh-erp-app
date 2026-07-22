import { useFormContext } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeVietnamPhone } from "../helpers";
import type { StudentFormValues } from "../student-form-schema";
import {
  describedBy,
  fieldControlClass,
  FieldShell,
  getFieldError,
  textAreaControlClass,
} from "./form-controls";

export function GuardianInfoSection() {
  const {
    formState: { errors },
    register,
    watch,
  } = useFormContext<StudentFormValues>();
  const phoneInfo = normalizeVietnamPhone(watch("guardianPhone"));
  const phoneError = getFieldError(errors, "guardianPhone");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông tin phụ huynh</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FieldShell
            error={getFieldError(errors, "guardianFullName")}
            id="guardianFullName"
            label="Họ tên phụ huynh"
            required
          >
            <input
              aria-describedby={describedBy(
                "guardianFullName",
                getFieldError(errors, "guardianFullName"),
              )}
              className={fieldControlClass(
                getFieldError(errors, "guardianFullName"),
              )}
              id="guardianFullName"
              {...register("guardianFullName")}
            />
          </FieldShell>

          <FieldShell
            error={phoneError}
            hint={phoneInfo.warning}
            id="guardianPhone"
            label="Số điện thoại"
            required
          >
            <input
              aria-describedby={describedBy(
                "guardianPhone",
                phoneError,
                phoneInfo.warning,
              )}
              className={fieldControlClass(phoneError)}
              id="guardianPhone"
              inputMode="tel"
              type="tel"
              {...register("guardianPhone")}
            />
          </FieldShell>

          <FieldShell
            error={getFieldError(errors, "guardianRelationship")}
            id="guardianRelationship"
            label="Quan hệ với học sinh"
            required
          >
            <select
              aria-describedby={describedBy(
                "guardianRelationship",
                getFieldError(errors, "guardianRelationship"),
              )}
              className={fieldControlClass(
                getFieldError(errors, "guardianRelationship"),
              )}
              id="guardianRelationship"
              {...register("guardianRelationship")}
            >
              <option value="">Chọn quan hệ</option>
              <option value="Mẹ">Mẹ</option>
              <option value="Bố">Bố</option>
              <option value="Người giám hộ">Người giám hộ</option>
              <option value="Khác">Khác</option>
            </select>
          </FieldShell>

          <FieldShell id="guardianZalo" label="Zalo">
            <input
              className={fieldControlClass()}
              id="guardianZalo"
              {...register("guardianZalo")}
            />
          </FieldShell>

          <FieldShell
            error={getFieldError(errors, "guardianEmail")}
            id="guardianEmail"
            label="Email"
          >
            <input
              aria-describedby={describedBy(
                "guardianEmail",
                getFieldError(errors, "guardianEmail"),
              )}
              className={fieldControlClass(getFieldError(errors, "guardianEmail"))}
              id="guardianEmail"
              type="email"
              {...register("guardianEmail")}
            />
          </FieldShell>
        </div>

        <FieldShell id="guardianNote" label="Ghi chú">
          <textarea
            className={textAreaControlClass()}
            id="guardianNote"
            {...register("guardianNote")}
          />
        </FieldShell>
      </CardContent>
    </Card>
  );
}
