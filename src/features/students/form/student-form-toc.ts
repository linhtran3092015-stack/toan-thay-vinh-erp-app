import type { FormTocItem, FormTocTone } from "@/components/patterns/form-with-toc";
import type { StudentProfileFormMode } from "@/features/students/form/student-profile-form-helpers";
import type { StudentProfileFormValues } from "@/features/students/form/student-profile-form-schema";

/*
 * Pure model of the student form's long-page layout (design 17a): which
 * section holds which field, in on-screen order, the table-of-contents status
 * of each section and the field names the save bar shows. No React, no RHF:
 * the form passes its current values and the names of the fields in error.
 */

export type StudentFormFieldName = keyof StudentProfileFormValues;

export type StudentFormSectionId = "ho-so" | "phu-huynh" | "xac-nhan" | "ly-do";

export interface StudentFormSection {
  id: StudentFormSectionId;
  /** Section heading, also the table-of-contents label. */
  title: string;
  /** Editable fields of the section, in on-screen (DOM) order. */
  fields: readonly StudentFormFieldName[];
  /** Fields marked * in the section. */
  required: readonly StudentFormFieldName[];
}

/**
 * Sections in page order. "xac-nhan" exists only while an exact duplicate is
 * shown (its single reason is then required). Read-only fields of the edit
 * mode (code, status) and the hidden ids are not counted.
 */
export const STUDENT_FORM_SECTIONS: readonly StudentFormSection[] = [
  {
    fields: [
      "fullName",
      "nickname",
      "birthYear",
      "currentGrade",
      "learningLevel",
      "registeredMode",
      "provinceName",
      "learningGoal",
      "internalNote",
    ],
    id: "ho-so",
    required: ["fullName", "birthYear", "currentGrade", "learningLevel", "registeredMode"],
    title: "Hồ sơ",
  },
  {
    fields: ["guardianFullName", "guardianRelationship", "guardianPhone", "guardianZalo", "guardianEmail", "guardianNote"],
    id: "phu-huynh",
    required: ["guardianFullName", "guardianRelationship", "guardianPhone"],
    title: "Phụ huynh chính",
  },
  {
    fields: ["duplicateOverrideReason"],
    id: "xac-nhan",
    required: ["duplicateOverrideReason"],
    title: "Xác nhận tiếp tục lưu",
  },
  {
    fields: ["reason"],
    id: "ly-do",
    required: ["reason"],
    title: "Lý do thao tác",
  },
];

/** Every editable field in on-screen order (the order of the sections, then of their fields). */
export const STUDENT_FORM_FIELD_ORDER: readonly StudentFormFieldName[] = STUDENT_FORM_SECTIONS.flatMap(
  (section) => section.fields,
);

/**
 * Names the save bar shows for changed or invalid fields. Same words as the
 * labels on screen; guardian contact fields say "phụ huynh" because the bar
 * shows them without their section.
 */
const FIELD_SUMMARY_LABELS: Record<Exclude<StudentFormFieldName, "reason">, string> = {
  birthYear: "Năm sinh",
  currentGrade: "Khối hiện tại",
  duplicateOverrideReason: "Lý do vẫn tạo hoặc cập nhật hồ sơ",
  fullName: "Họ và tên",
  guardianEmail: "Email phụ huynh",
  guardianFullName: "Họ tên phụ huynh",
  guardianNote: "Ghi chú phụ huynh",
  guardianPhone: "Số điện thoại phụ huynh",
  guardianRelationship: "Quan hệ với học viên",
  guardianZalo: "Zalo phụ huynh",
  internalNote: "Ghi chú nội bộ",
  learningGoal: "Mục tiêu học tập",
  learningLevel: "Mức học tập",
  nickname: "Tên thường gọi",
  provinceName: "Tỉnh/thành phố",
  publicCode: "Mã học viên",
  registeredMode: "Hình thức đăng ký",
  studentId: "Mã học viên",
};

export function getStudentFormFieldLabel(name: StudentFormFieldName, mode: StudentProfileFormMode): string {
  if (name === "reason") return mode === "create" ? "Lý do tạo hồ sơ" : "Lý do cập nhật hồ sơ";
  return FIELD_SUMMARY_LABELS[name];
}

export function isStudentFormFieldName(name: string): name is StudentFormFieldName {
  return name === "reason" || Object.hasOwn(FIELD_SUMMARY_LABELS, name);
}

/** Field names in on-screen order; names outside the sections (hidden ids) go last. */
export function sortStudentFormFields(names: Iterable<string>): StudentFormFieldName[] {
  const rank = (name: StudentFormFieldName) => {
    const index = STUDENT_FORM_FIELD_ORDER.indexOf(name);
    return index === -1 ? STUDENT_FORM_FIELD_ORDER.length : index;
  };
  return Array.from(new Set(names))
    .filter(isStudentFormFieldName)
    .sort((left, right) => rank(left) - rank(right));
}

/** A field counts as filled when it holds a non-blank string or a finite number (a cleared number input is NaN). */
export function isStudentFormValueFilled(value: unknown): boolean {
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return Number.isFinite(value);
  return false;
}

export interface StudentFormSectionStatus {
  status: string;
  tone: FormTocTone;
}

/**
 * Table-of-contents status of one section:
 * - any field in error → "{n} lỗi" (danger);
 * - a section with required fields → "{filled}/{total}" over all its fields,
 *   success once every required field is filled, muted before;
 * - a section without required fields → "tùy chọn" (muted).
 */
export function getStudentFormSectionStatus(
  section: Pick<StudentFormSection, "fields" | "required">,
  values: Partial<Record<StudentFormFieldName, unknown>>,
  errorFields: ReadonlySet<string>,
): StudentFormSectionStatus {
  const errorCount = section.fields.filter((name) => errorFields.has(name)).length;
  if (errorCount > 0) return { status: `${errorCount} lỗi`, tone: "danger" };
  if (section.required.length === 0) return { status: "tùy chọn", tone: "muted" };

  const filled = section.fields.filter((name) => isStudentFormValueFilled(values[name])).length;
  const complete = section.required.every((name) => isStudentFormValueFilled(values[name]));
  return { status: `${filled}/${section.fields.length}`, tone: complete ? "success" : "muted" };
}

/** Items for `FormWithToc`, in page order; "xac-nhan" only while its section is shown. */
export function getStudentFormTocItems({
  errorFields,
  showDuplicateConfirmation,
  values,
}: {
  errorFields: ReadonlySet<string>;
  showDuplicateConfirmation: boolean;
  values: Partial<Record<StudentFormFieldName, unknown>>;
}): FormTocItem[] {
  return STUDENT_FORM_SECTIONS.filter((section) => section.id !== "xac-nhan" || showDuplicateConfirmation).map(
    (section) => ({
      id: section.id,
      label: section.title,
      ...getStudentFormSectionStatus(section, values, errorFields),
    }),
  );
}
