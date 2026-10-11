import type {
  CreateStudentActionInput,
  StudentWriteFields,
  UpdateStudentActionInput,
} from "@/features/students/form/student-form-action-types";
import type { StudentProfileFormValues } from "@/features/students/form/student-profile-form-schema";
import type { StudentDetailReadModel } from "@/features/students/read-models";
import type { StudentLifecycleStatus } from "@/types/domain";

export type StudentProfileFormMode = "create" | "edit";

export function getStudentProfileFormDefaults(
  mode: StudentProfileFormMode,
  detail?: StudentDetailReadModel,
): StudentProfileFormValues {
  if (mode === "edit" && detail) {
    const guardian = detail.primaryGuardian;

    return {
      birthYear: detail.birthYear,
      currentGrade: detail.currentGrade,
      duplicateOverrideReason: "",
      fullName: detail.fullName,
      guardianEmail: guardian?.email ?? "",
      guardianFullName: guardian?.fullName ?? "",
      guardianNote: guardian?.notes ?? "",
      guardianPhone: guardian?.phone ?? "",
      guardianRelationship: guardian?.relationship ?? "",
      guardianZalo: guardian?.zalo ?? "",
      internalNote: detail.internalNotes ?? "",
      learningGoal: detail.learningGoal ?? "",
      learningLevel: detail.learningLevel ?? "A",
      nickname: detail.nickname ?? "",
      provinceName: detail.provinceCity ?? "",
      publicCode: detail.publicCode,
      reason: "",
      registeredMode: detail.registeredMode ?? "offline",
      studentId: detail.id,
    };
  }

  return {
    birthYear: new Date().getFullYear() - 13,
    currentGrade: 7,
    duplicateOverrideReason: "",
    fullName: "",
    guardianEmail: "",
    guardianFullName: "",
    guardianNote: "",
    guardianPhone: "",
    guardianRelationship: "",
    guardianZalo: "",
    internalNote: "",
    learningGoal: "",
    learningLevel: "A",
    nickname: "",
    provinceName: "",
    publicCode: "",
    reason: "",
    registeredMode: "offline",
    studentId: "",
  };
}

export function toStudentWriteFields(
  values: StudentProfileFormValues,
): StudentWriteFields {
  return {
    birthYear: values.birthYear,
    currentGrade: values.currentGrade,
    duplicateOverrideReason:
      values.duplicateOverrideReason,
    fullName: values.fullName,
    guardianEmail: values.guardianEmail,
    guardianFullName: values.guardianFullName,
    guardianNote: values.guardianNote,
    guardianPhone: values.guardianPhone,
    guardianRelationship: values.guardianRelationship,
    guardianZalo: values.guardianZalo,
    internalNote: values.internalNote,
    learningGoal: values.learningGoal,
    learningLevel: values.learningLevel,
    nickname: values.nickname,
    provinceName: values.provinceName,
    reason: values.reason,
    registeredMode: values.registeredMode,
  };
}

export function toCreateStudentActionInput(
  values: StudentProfileFormValues,
): CreateStudentActionInput {
  return toStudentWriteFields(values);
}

export function toUpdateStudentActionInput(
  values: StudentProfileFormValues,
): UpdateStudentActionInput {
  return {
    ...toStudentWriteFields(values),
    studentId: values.studentId,
  };
}

export function getStudentLifecycleStatusLabel(
  status: StudentLifecycleStatus | string,
): string {
  const labels: Record<StudentLifecycleStatus, string> = {
    active: "Đang học",
    completed: "Hoàn thành",
    interested: "Đang quan tâm",
    pending_enrollment_confirmation: "Chờ xác nhận nhập học",
    reserved: "Bảo lưu",
    resumed: "Quay lại học",
    trial_booked: "Đã đặt lịch học thử",
    trial_completed: "Đã học thử",
    waiting_class: "Chờ chọn lớp",
    withdrawn: "Đã nghỉ",
  };

  return Object.hasOwn(labels, status)
    ? labels[status as StudentLifecycleStatus]
    : `Trạng thái chưa hỗ trợ: ${status}`;
}
