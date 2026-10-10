"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FormProvider,
  useForm,
  useWatch,
  type FieldErrors,
  type FieldPath,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { checkGuardianDuplicate, checkStudentDuplicate } from "../duplicate-check";
import { enrollmentChecklistItems } from "../mock-form-data";
import {
  studentFormSchema,
  type StudentFormValues,
} from "../student-form-schema";
import {
  studentFormSteps,
  type StudentFormMode,
  type StudentFormPermissionSet,
  type StudentFormStepId,
} from "../student-form-types";
import { AcquisitionInfoSection } from "./acquisition-info-section";
import { CommunicationGroupSection } from "./communication-group-section";
import { DuplicateWarningPanel } from "./duplicate-warning-panel";
import { EnrollmentChecklistSection } from "./enrollment-checklist-section";
import { EnrollmentInfoSection } from "./enrollment-info-section";
import { GuardianInfoSection } from "./guardian-info-section";
import { StudentBasicInfoSection } from "./student-basic-info-section";
import { StudentFormActions } from "./student-form-actions";
import { StudentFormReview } from "./student-form-review";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";

interface StudentFormProps {
  cancelHref: string;
  defaultValues: StudentFormValues;
  mode: StudentFormMode;
  permissions: StudentFormPermissionSet;
}

const stepFields: Record<StudentFormStepId, Array<keyof StudentFormValues>> = {
  enrollment: [
    "mainClassId",
    "registeredMode",
    "feeArea",
    "currentUnitPrice",
    "discountPercent",
    "bonusSessions",
    "expectedOfficialStartDate",
    "classOverrideReason",
    "customFeeReason",
  ],
  guardian: [
    "guardianFullName",
    "guardianPhone",
    "guardianRelationship",
    "guardianEmail",
  ],
  review: [
    "paymentReceived",
    "sourceConfirmed",
    "saleConfirmed",
    "classSelected",
    "modeConfirmed",
    "feeConfirmed",
    "assistantSessionsConfirmed",
    "accountantTransactionConfirmed",
    "officialStartDateEntered",
    "communicationGroupReady",
    "lifecycleStatus",
  ],
  source: [
    "leadSourceId",
    "partnerName",
    "saleOwnerId",
    "recordedAt",
    "communicationGroupStatus",
    "communicationGroupName",
    "communicationGroupLink",
    "communicationGroupCreatedAt",
    "communicationGroupCreatedBy",
  ],
  student: [
    "fullName",
    "birthYear",
    "currentGrade",
    "provinceName",
    "learningLevel",
  ],
};

export function StudentForm({
  cancelHref,
  defaultValues,
  mode,
  permissions,
}: StudentFormProps) {
  const router = useRouter();
  const form = useForm<StudentFormValues>({
    defaultValues,
    mode: "onBlur",
    resolver: zodResolver(studentFormSchema),
  });
  const [activeStepId, setActiveStepId] = useState<StudentFormStepId>("student");
  const [reviewValues, setReviewValues] = useState<StudentFormValues | null>(
    null,
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isUnsavedDialogOpen, setIsUnsavedDialogOpen] = useState(false);
  const activeStepIndex = studentFormSteps.findIndex(
    (step) => step.id === activeStepId,
  );
  const watchedFormValues = useWatch({ control: form.control });
  const watchedValues = {
    ...defaultValues,
    ...watchedFormValues,
  } as StudentFormValues;
  const guardianDuplicate = checkGuardianDuplicate(watchedValues.guardianPhone);
  const studentDuplicate =
    mode === "create" ? checkStudentDuplicate(watchedValues) : null;

  const handleNext = async () => {
    const isCurrentStepValid = await validateCurrentStep();

    if (!isCurrentStepValid) {
      return;
    }

    setActiveStepId(studentFormSteps[activeStepIndex + 1].id);
  };

  const handleBack = () => {
    if (activeStepIndex > 0) {
      setActiveStepId(studentFormSteps[activeStepIndex - 1].id);
    }
  };

  const handleStepClick = async (stepId: StudentFormStepId) => {
    const nextStepIndex = studentFormSteps.findIndex((step) => step.id === stepId);

    if (nextStepIndex <= activeStepIndex) {
      setActiveStepId(stepId);
      return;
    }

    const isValid = await validateCurrentStep();

    if (isValid) {
      setActiveStepId(stepId);
    }
  };

  const handleCancel = () => {
    if (form.formState.isDirty) {
      setIsUnsavedDialogOpen(true);
      return;
    }

    router.push(cancelHref);
  };

  const handleMockAction = (label: string) => {
    setToastMessage(`${label}: thao tác mock, chưa ghi dữ liệu thật.`);
    window.setTimeout(() => setToastMessage(null), 2400);
  };

  const validateCurrentStep = async () => {
    const currentFields = stepFields[activeStepId];

    await form.trigger(currentFields as Array<FieldPath<StudentFormValues>>, {
      shouldFocus: true,
    });

    const invalidField = currentFields.find(
      (fieldName) => form.getFieldState(fieldName).invalid,
    );

    if (invalidField) {
      form.setFocus(invalidField as FieldPath<StudentFormValues>);
      return false;
    }

    return true;
  };

  const handleValidSubmit = (values: StudentFormValues) => {
    const duplicateResult =
      mode === "create" ? checkStudentDuplicate(values) : null;

    if (duplicateResult && !values.duplicateOverrideReason.trim()) {
      form.setError("duplicateOverrideReason", {
        message: "Cần nhập lý do nếu vẫn tạo hồ sơ khi có cảnh báo trùng.",
        type: "manual",
      });
      setActiveStepId("guardian");
      window.setTimeout(() => form.setFocus("duplicateOverrideReason"), 0);
      return;
    }

    setReviewValues(values);
  };

  const handleInvalidSubmit = (errors: FieldErrors<StudentFormValues>) => {
    const firstError = Object.keys(errors)[0] as
      | FieldPath<StudentFormValues>
      | undefined;

    if (!firstError) {
      return;
    }

    const hasChecklistError = enrollmentChecklistItems.some(
      (item) => errors[item.id],
    );
    setActiveStepId(
      hasChecklistError ? "review" : getStepIdForField(firstError),
    );
    window.setTimeout(() => form.setFocus(firstError), 0);
  };

  const handleReviewConfirm = () => {
    const savedValues = reviewValues;

    if (savedValues) {
      form.reset(savedValues);
    }

    setReviewValues(null);
    setToastMessage(
      "Đã mô phỏng lưu hồ sơ. Chưa có dữ liệu nào được ghi vào database.",
    );
    window.setTimeout(() => setToastMessage(null), 3200);
  };

  return (
    <FormProvider {...form}>
      <form
        className="mx-auto grid w-full max-w-[1100px] gap-4"
        onSubmit={form.handleSubmit(handleValidSubmit, handleInvalidSubmit)}
      >
        <div className="grid gap-3">
          <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">
                {mode === "create" ? "Tạo hồ sơ mock" : "Chỉnh sửa hồ sơ mock"}
              </p>
              <h1 className="text-2xl font-bold text-ink md:text-3xl">
                {mode === "create" ? "Thêm học viên" : watchedValues.fullName}
              </h1>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                Form này chỉ kiểm tra luồng nghiệp vụ bằng dữ liệu mock, không
                tạo database và không ghi API.
              </p>
            </div>
            <Button
              className="min-h-11 self-start md:self-auto"
              onClick={handleCancel}
              variant="outline"
            >
              Về danh sách
            </Button>
          </div>

          <ol className="grid gap-2 md:grid-cols-5">
            {studentFormSteps.map((step, index) => {
              const isActive = step.id === activeStepId;
              const isDone = index < activeStepIndex;

              return (
                <li key={step.id}>
                  <button
                    className={cn(
                      "flex min-h-11 w-full items-center gap-2 rounded-md border px-3 text-left text-sm font-semibold transition",
                      isActive
                        ? "border-primary bg-primary text-white"
                        : isDone
                          ? "border-success-border bg-success-bg text-success"
                          : "border-hairline bg-surface-1 text-ink-muted hover:border-border-focus hover:text-ink",
                    )}
                    onClick={() => handleStepClick(step.id)}
                    type="button"
                  >
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-pill bg-white/20 text-xs">
                      {step.shortLabel}
                    </span>
                    <span className="min-w-0 truncate">{step.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {activeStepId === "student" ? (
          <StudentBasicInfoSection mode={mode} />
        ) : null}
        {activeStepId === "guardian" ? <GuardianInfoSection /> : null}
        {activeStepId === "enrollment" ? <EnrollmentInfoSection /> : null}
        {activeStepId === "source" ? (
          <div className="grid gap-4">
            <AcquisitionInfoSection
              mode={mode}
              onMockAction={handleMockAction}
              permissions={permissions}
            />
            <CommunicationGroupSection />
          </div>
        ) : null}
        {activeStepId === "review" ? (
          <EnrollmentChecklistSection permissions={permissions} />
        ) : null}

        <DuplicateWarningPanel
          guardianDuplicate={guardianDuplicate}
          mode={mode}
          studentDuplicate={studentDuplicate}
        />

        <StudentFormActions
          currentStepIndex={activeStepIndex}
          isLastStep={activeStepId === "review"}
          onBack={handleBack}
          onCancel={handleCancel}
          onNext={handleNext}
          totalSteps={studentFormSteps.length}
        />
      </form>

      {reviewValues ? (
        <StudentFormReview
          onClose={() => setReviewValues(null)}
          onConfirm={handleReviewConfirm}
          values={reviewValues}
        />
      ) : null}

      {isUnsavedDialogOpen ? (
        <UnsavedChangesDialog
          onConfirmLeave={() => router.push(cancelHref)}
          onStay={() => setIsUnsavedDialogOpen(false)}
        />
      ) : null}

      {toastMessage ? (
        <div
          className="fixed bottom-4 left-4 right-4 z-[95] rounded-lg border border-hairline bg-ink px-4 py-3 text-sm font-semibold text-white shadow-modal md:left-auto md:w-[420px]"
          role="status"
        >
          {toastMessage}
        </div>
      ) : null}
    </FormProvider>
  );
}

function getStepIdForField(fieldName: string): StudentFormStepId {
  const entry = Object.entries(stepFields).find(([, fields]) =>
    fields.includes(fieldName as keyof StudentFormValues),
  );

  return entry ? (entry[0] as StudentFormStepId) : "review";
}
