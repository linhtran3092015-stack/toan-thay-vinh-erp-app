import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { mockClasses } from "../mock-form-data";
import {
  formatCurrency,
  getClassById,
  getClassMismatch,
  getMatchingClasses,
  getStandardFee,
} from "../helpers";
import type { StudentFormValues } from "../student-form-schema";
import {
  describedBy,
  fieldControlClass,
  FieldShell,
  getFieldError,
  textAreaControlClass,
} from "./form-controls";

export function EnrollmentInfoSection() {
  const {
    formState: { errors },
    register,
    setValue,
    watch,
  } = useFormContext<StudentFormValues>();
  const currentGrade = watch("currentGrade");
  const registeredMode = watch("registeredMode");
  const feeArea = watch("feeArea");
  const currentUnitPrice = watch("currentUnitPrice");
  const mainClassId = watch("mainClassId");
  const standardFee = getStandardFee(registeredMode, feeArea);
  const matchingClasses = getMatchingClasses(Number(currentGrade));
  const otherClasses = mockClasses.filter(
    (classItem) => classItem.grade !== Number(currentGrade),
  );
  const selectedClass = getClassById(mainClassId);
  const mismatchedClass = getClassMismatch(mainClassId, Number(currentGrade));
  const isCustomFee = Number(currentUnitPrice) !== standardFee;

  useEffect(() => {
    if (selectedClass) {
      setValue("learningLevel", selectedClass.learningLevel, {
        shouldDirty: false,
      });
      if (selectedClass.mode !== "hybrid") {
        setValue("registeredMode", selectedClass.mode, {
          shouldDirty: false,
        });
      }
    }
  }, [selectedClass, setValue]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lớp và học phí</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FieldShell id="registeredMode" label="Hình thức học" required>
            <select
              className={fieldControlClass()}
              id="registeredMode"
              {...register("registeredMode")}
            >
              <option value="offline">Offline</option>
              <option value="online">Online</option>
            </select>
          </FieldShell>

          <FieldShell
            hint={`Phí chuẩn hiện tại: ${formatCurrency(standardFee)}/buổi.`}
            id="feeArea"
            label="Khu vực áp dụng phí"
          >
            <select
              className={fieldControlClass()}
              id="feeArea"
              {...register("feeArea")}
            >
              <option value="hanoi_hcm">Hà Nội / TP.HCM</option>
              <option value="province">Tỉnh khác</option>
            </select>
          </FieldShell>

          <FieldShell
            error={getFieldError(errors, "mainClassId")}
            id="mainClassId"
            label="Lớp chính"
          >
            <select
              aria-describedby={describedBy(
                "mainClassId",
                getFieldError(errors, "mainClassId"),
              )}
              className={fieldControlClass(getFieldError(errors, "mainClassId"))}
              id="mainClassId"
              {...register("mainClassId")}
            >
              <option value="">Chưa chọn lớp</option>
              <optgroup label={`Lớp phù hợp khối ${currentGrade}`}>
                {matchingClasses.map((classItem) => (
                  <option key={classItem.id} value={classItem.id}>
                    {classItem.name} · Mức {classItem.learningLevel} ·{" "}
                    {classItem.mode === "hybrid"
                      ? "Hybrid"
                      : classItem.mode === "online"
                        ? "Online"
                        : "Offline"}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Lớp khác để kiểm tra override mock">
                {otherClasses.map((classItem) => (
                  <option key={classItem.id} value={classItem.id}>
                    {classItem.name} · Khối {classItem.grade}
                  </option>
                ))}
              </optgroup>
            </select>
          </FieldShell>

          <FieldShell id="learningLevelEnrollment" label="Mức lớp">
            <select
              className={fieldControlClass()}
              id="learningLevelEnrollment"
              {...register("learningLevel")}
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="CLC">CLC</option>
            </select>
          </FieldShell>

          <FieldShell
            error={getFieldError(errors, "currentUnitPrice")}
            hint="Đơn vị là đồng/buổi theo chính sách đã chốt."
            id="currentUnitPrice"
            label="Học phí theo buổi"
          >
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                aria-describedby={describedBy(
                  "currentUnitPrice",
                  getFieldError(errors, "currentUnitPrice"),
                  "Đơn vị là đồng/buổi theo chính sách đã chốt.",
                )}
                className={fieldControlClass(
                  getFieldError(errors, "currentUnitPrice"),
                )}
                id="currentUnitPrice"
                inputMode="numeric"
                type="number"
                {...register("currentUnitPrice", { valueAsNumber: true })}
              />
              <Button
                className="min-h-11 whitespace-nowrap"
                onClick={() =>
                  setValue("currentUnitPrice", standardFee, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                variant="outline"
              >
                Áp dụng phí chuẩn
              </Button>
            </div>
          </FieldShell>

          <FieldShell
            error={getFieldError(errors, "discountPercent")}
            id="discountPercent"
            label="Ưu đãi (%)"
          >
            <input
              aria-describedby={describedBy(
                "discountPercent",
                getFieldError(errors, "discountPercent"),
              )}
              className={fieldControlClass(getFieldError(errors, "discountPercent"))}
              id="discountPercent"
              inputMode="numeric"
              max={100}
              min={0}
              type="number"
              {...register("discountPercent", { valueAsNumber: true })}
            />
          </FieldShell>

          <FieldShell
            error={getFieldError(errors, "bonusSessions")}
            id="bonusSessions"
            label="Số buổi tặng"
          >
            <input
              aria-describedby={describedBy(
                "bonusSessions",
                getFieldError(errors, "bonusSessions"),
              )}
              className={fieldControlClass(getFieldError(errors, "bonusSessions"))}
              id="bonusSessions"
              inputMode="numeric"
              min={0}
              type="number"
              {...register("bonusSessions", { valueAsNumber: true })}
            />
          </FieldShell>

          <FieldShell
            error={getFieldError(errors, "expectedOfficialStartDate")}
            id="expectedOfficialStartDate"
            label="Ngày dự kiến học chính"
          >
            <input
              aria-describedby={describedBy(
                "expectedOfficialStartDate",
                getFieldError(errors, "expectedOfficialStartDate"),
              )}
              className={fieldControlClass(
                getFieldError(errors, "expectedOfficialStartDate"),
              )}
              id="expectedOfficialStartDate"
              type="date"
              {...register("expectedOfficialStartDate")}
            />
          </FieldShell>
        </div>

        {selectedClass ? (
          <div className="grid gap-3 rounded-lg border border-info-border bg-info-bg p-4 text-sm leading-6 text-ink md:grid-cols-2">
            <div>
              <p className="font-semibold text-info">Lịch học mock</p>
              <p>{selectedClass.schedule.scheduleText}</p>
              <p>Giáo viên: {selectedClass.schedule.teacherName}</p>
            </div>
            <div>
              <p>Phòng: {selectedClass.schedule.roomName}</p>
              {selectedClass.schedule.classInUrl ? (
                <p>
                  ClassIn:{" "}
                  <span className="font-semibold text-info">
                    {selectedClass.schedule.classInUrl}
                  </span>
                </p>
              ) : (
                <p>ClassIn: Không áp dụng cho lớp offline</p>
              )}
            </div>
          </div>
        ) : null}

        {mismatchedClass ? (
          <FieldShell
            error={getFieldError(errors, "classOverrideReason")}
            hint={`Lớp ${mismatchedClass.name} thuộc khối ${mismatchedClass.grade}, khác khối ${currentGrade}.`}
            id="classOverrideReason"
            label="Lý do chọn lớp khác khối"
            required
          >
            <textarea
              aria-describedby={describedBy(
                "classOverrideReason",
                getFieldError(errors, "classOverrideReason"),
                `Lớp ${mismatchedClass.name} thuộc khối ${mismatchedClass.grade}, khác khối ${currentGrade}.`,
              )}
              className={textAreaControlClass(
                getFieldError(errors, "classOverrideReason"),
              )}
              id="classOverrideReason"
              {...register("classOverrideReason")}
            />
          </FieldShell>
        ) : null}

        {isCustomFee ? (
          <FieldShell
            error={getFieldError(errors, "customFeeReason")}
            hint={`Chính sách chuẩn đang là ${formatCurrency(standardFee)}/buổi.`}
            id="customFeeReason"
            label="Lý do học phí khác chính sách"
            required
          >
            <textarea
              aria-describedby={describedBy(
                "customFeeReason",
                getFieldError(errors, "customFeeReason"),
                `Chính sách chuẩn đang là ${formatCurrency(standardFee)}/buổi.`,
              )}
              className={textAreaControlClass(
                getFieldError(errors, "customFeeReason"),
              )}
              id="customFeeReason"
              {...register("customFeeReason")}
            />
          </FieldShell>
        ) : null}
      </CardContent>
    </Card>
  );
}
