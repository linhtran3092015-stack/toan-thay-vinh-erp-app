import type { StudentDetail } from "@/features/students/detail/types";
import { normalizeVietnamPhoneNumber } from "@/lib/phone";
import type { PermissionCode, StudentLifecycleStatus } from "@/types/domain";
import {
  enrollmentChecklistItems,
  mockClasses,
  mockLeadSources,
  mockSaleOwners,
} from "./mock-form-data";
import type { StudentFormValues } from "./student-form-schema";
import {
  formLifecycleStatusOptions,
  type CommunicationGroupStatus,
  type FeeArea,
  type MockClass,
  type PhoneNormalizationResult,
  type StudentFormMode,
  type StudentFormPermissionSet,
} from "./student-form-types";

export function normalizeVietnamPhone(value: string): PhoneNormalizationResult {
  const { compact, isValid, normalized } = normalizeVietnamPhoneNumber(value);

  if (!value.trim()) {
    return {
      isValid: false,
      normalized,
      warning: "Vui lòng nhập số điện thoại phụ huynh.",
    };
  }

  if (!isValid) {
    return {
      isValid: false,
      normalized,
      warning:
        "Số điện thoại cần là số Việt Nam hợp lệ, ví dụ 0901234125 hoặc +84901234125.",
    };
  }

  if (compact !== normalized) {
    return {
      isValid: true,
      normalized,
      warning: `Số sẽ được kiểm tra theo dạng chuẩn hóa ${normalized}; dữ liệu gốc vẫn hiển thị trên form.`,
    };
  }

  return { isValid: true, normalized };
}

export function getStandardFee(
  registeredMode: StudentFormValues["registeredMode"],
  feeArea: StudentFormValues["feeArea"],
): number {
  if (registeredMode === "offline") {
    return 140000;
  }

  return feeArea === "hanoi_hcm" ? 100000 : 70000;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(value) + "đ";
}

export function getMatchingClasses(grade: number): MockClass[] {
  return mockClasses.filter((classItem) => classItem.grade === grade);
}

export function getClassById(classId: string): MockClass | undefined {
  return mockClasses.find((classItem) => classItem.id === classId);
}

export function getClassMismatch(
  classId: string,
  grade: number,
): MockClass | undefined {
  const selectedClass = getClassById(classId);

  if (!selectedClass || selectedClass.grade === grade) {
    return undefined;
  }

  return selectedClass;
}

export function getStatusLabel(status: StudentLifecycleStatus): string {
  return (
    formLifecycleStatusOptions.find((option) => option.value === status)?.label ??
    status
  );
}

export function getSourceLabel(sourceId: string): string {
  return mockLeadSources.find((source) => source.id === sourceId)?.label ?? "-";
}

export function getSaleOwnerName(saleOwnerId: string): string {
  return mockSaleOwners.find((sale) => sale.id === saleOwnerId)?.name ?? "-";
}

export function getCommunicationStatusLabel(
  status: CommunicationGroupStatus,
): string {
  const labels: Record<CommunicationGroupStatus, string> = {
    created: "Đã tạo",
    not_created: "Chưa tạo",
    not_required: "Không yêu cầu",
    pending: "Đang chờ",
  };

  return labels[status];
}

export function getMissingChecklistLabels(values: StudentFormValues): string[] {
  return enrollmentChecklistItems
    .filter((item) => !values[item.id])
    .map((item) => item.label);
}

export function getDefaultStudentFormValues(
  mode: StudentFormMode,
  detail?: StudentDetail,
): StudentFormValues {
  if (!detail) {
    return {
      accountantTransactionConfirmed: false,
      assistantSessionsConfirmed: false,
      birthYear: 2013,
      bonusSessions: 0,
      classOverrideReason: "",
      classSelected: false,
      communicationGroupCreatedAt: "",
      communicationGroupCreatedBy: "",
      communicationGroupLink: "",
      communicationGroupName: "",
      communicationGroupNote: "",
      communicationGroupReady: false,
      communicationGroupStatus: "not_created",
      currentGrade: 7,
      currentUnitPrice: 140000,
      customFeeReason: "",
      discountPercent: 0,
      duplicateOverrideReason: "",
      expectedOfficialStartDate: "",
      feeArea: "hanoi_hcm",
      feeConfirmed: false,
      fullName: "",
      guardianEmail: "",
      guardianFullName: "",
      guardianLinkMode: "new",
      guardianNote: "",
      guardianPhone: "",
      guardianRelationship: "",
      guardianZalo: "",
      internalNote: "",
      leadSourceId: "mma",
      learningGoal: "",
      learningLevel: "A",
      lifecycleStatus: "interested",
      mainClassId: "",
      modeConfirmed: false,
      nickname: "",
      officialStartDateEntered: false,
      partnerName: "MMA Hà Nội",
      paymentReceived: false,
      profileCreatedAt: "2026-07-22",
      publicCode: "",
      recordedAt: "2026-07-22",
      registeredMode: "offline",
      saleConfirmed: false,
      saleOwnerId: "sale-le-thu-trang",
      sourceConfirmed: false,
      sourceNote: "",
      studentId: "",
      provinceName: "Hà Nội",
    };
  }

  const student = detail.student;
  const selectedClass = mockClasses.find(
    (classItem) =>
      classItem.name === student.mainClassName &&
      classItem.grade === student.currentGrade,
  );
  const leadSource = mockLeadSources.find(
    (source) => source.label === detail.admissionSource.sourceName,
  );
  const saleOwner = mockSaleOwners.find(
    (sale) => sale.name === detail.admissionSource.saleOwnerName,
  );
  const communicationStatus: CommunicationGroupStatus =
    detail.communicationGroup.status === "created" ? "created" : "not_created";
  const feeArea = getFeeAreaFromProvince(detail.provinceName);

  return {
    accountantTransactionConfirmed: student.lifecycleStatus === "active",
    assistantSessionsConfirmed: student.lifecycleStatus === "active",
    birthYear: student.birthYear,
    bonusSessions: detail.summary.totalBonusSessions,
    classOverrideReason: "",
    classSelected: Boolean(selectedClass),
    communicationGroupCreatedAt:
      detail.communicationGroup.createdAt === "-" ? "" : toInputDate(detail.communicationGroup.createdAt),
    communicationGroupCreatedBy:
      detail.communicationGroup.createdBy === "-" ? "" : detail.communicationGroup.createdBy,
    communicationGroupLink:
      communicationStatus === "created"
        ? "https://zalo.me/g/ph-toan-thay-vinh"
        : "",
    communicationGroupName: detail.communicationGroup.groupName,
    communicationGroupNote: detail.communicationGroup.note,
    communicationGroupReady: communicationStatus === "created",
    communicationGroupStatus: communicationStatus,
    currentGrade: student.currentGrade,
    currentUnitPrice: detail.summary.currentUnitPrice,
    customFeeReason:
      detail.summary.currentUnitPrice === getStandardFee(student.registeredMode, feeArea)
        ? ""
        : "Giữ nguyên đơn giá đã chốt trên hồ sơ hiện tại.",
    discountPercent: 0,
    duplicateOverrideReason: "",
    expectedOfficialStartDate: toInputDate(detail.officialStartDate),
    feeArea,
    feeConfirmed: student.lifecycleStatus === "active",
    fullName: student.fullName,
    guardianEmail: detail.guardian.email,
    guardianFullName: detail.guardian.fullName,
    guardianLinkMode: "existing",
    guardianNote: "",
    guardianPhone: detail.guardian.phone,
    guardianRelationship: detail.guardian.relationship,
    guardianZalo: detail.guardian.zalo,
    internalNote: "",
    leadSourceId: leadSource?.id ?? "other",
    learningGoal: detail.learningGoal,
    learningLevel: student.learningLevel,
    lifecycleStatus: student.lifecycleStatus,
    mainClassId: selectedClass?.id ?? "",
    modeConfirmed: student.lifecycleStatus === "active",
    nickname: student.nickname,
    officialStartDateEntered: Boolean(detail.officialStartDate),
    partnerName: detail.admissionSource.partnerName,
    paymentReceived: student.lifecycleStatus === "active",
    profileCreatedAt: toInputDate(detail.admissionSource.recordedAt),
    publicCode: student.publicCode,
    recordedAt: toInputDate(detail.admissionSource.recordedAt),
    registeredMode: student.registeredMode,
    saleConfirmed: student.lifecycleStatus === "active",
    saleOwnerId: saleOwner?.id ?? "sale-le-thu-trang",
    sourceConfirmed: student.lifecycleStatus === "active",
    sourceNote: "",
    studentId: student.id,
    provinceName: detail.provinceName,
  };
}

export function getFeeAreaFromProvince(provinceName: string): FeeArea {
  const normalized = normalizeText(provinceName);

  return normalized.includes("ha noi") ||
    normalized.includes("hanoi") ||
    normalized.includes("ho chi minh") ||
    normalized.includes("tp hcm") ||
    normalized.includes("tphcm")
    ? "hanoi_hcm"
    : "province";
}

export function buildFormPermissions(
  permissions: PermissionCode[],
): StudentFormPermissionSet {
  return {
    canAccountantConfirm: permissions.includes("sepay.accountant_confirm"),
    canCreate: permissions.includes("students.create"),
    canEdit: permissions.includes("students.update"),
    canManageSale: permissions.includes("crm.transfer"),
    canManageSource: permissions.includes("crm.update"),
  };
}

export function toInputDate(value: string): string {
  if (!value || value === "-") {
    return "";
  }

  const ddmmyyyy = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  }

  return value;
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
