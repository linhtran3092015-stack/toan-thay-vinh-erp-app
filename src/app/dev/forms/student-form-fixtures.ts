import type { StudentDuplicateLinkedStudent } from "@/features/students/form/student-form-action-types";
import { getStudentProfileFormDefaults } from "@/features/students/form/student-profile-form-helpers";
import type { StudentProfileFormValues } from "@/features/students/form/student-profile-form-schema";
import type { SuccessfulDuplicateLookup } from "@/features/students/form/components/student-profile-sections";

import { FORMS_PREVIEW_TODAY, type StudentFormsPreviewState } from "./forms-preview-params";

/*
 * Fixtures of the /dev/forms student views (design 17a), on the fixed clock
 * FORMS_PREVIEW_TODAY. Names, codes and phones are invented; ids are fixed
 * v4 UUIDs so the edit form's hidden id passes the schema.
 */

const previewYear = Number(FORMS_PREVIEW_TODAY.slice(0, 4));

export const STUDENT_FORM_PREVIEW_STUDENT_ID = "5f0c2a8e-3b1d-4c6e-9a7f-2d4b6c8e0a13";
export const STUDENT_FORM_PREVIEW_LIFECYCLE_STATUS = "active";

/** /students/new defaults (birth year from the preview clock, not the machine's). */
export const studentFormPreviewCreateDefaults: StudentProfileFormValues = {
  ...getStudentProfileFormDefaults("create"),
  birthYear: previewYear - 13,
};

/** /students/[id]/edit defaults: a student with a primary guardian. */
export const studentFormPreviewEditDefaults: StudentProfileFormValues = {
  birthYear: 2012,
  currentGrade: 8,
  duplicateOverrideReason: "",
  fullName: "Phạm Minh Khang",
  guardianEmail: "hoa.tran@example.com",
  guardianFullName: "Trần Thị Hoa",
  guardianNote: "Gọi sau 18:00.",
  guardianPhone: "0912345678",
  guardianRelationship: "Mẹ",
  guardianZalo: "0912345678",
  internalNote: "",
  learningGoal: "Ôn thi vào lớp 10 chuyên Toán.",
  learningLevel: "B",
  nickname: "Khang",
  provinceName: "Hà Nội",
  publicCode: "TV-2025-00042",
  reason: "",
  registeredMode: "offline",
  studentId: STUDENT_FORM_PREVIEW_STUDENT_ID,
};

/** The guardian phone both duplicate states use. */
export const STUDENT_FORM_PREVIEW_DUPLICATE_PHONE = "0905123456";

const linkedQuang: StudentDuplicateLinkedStudent = {
  birthYear: 2013,
  fullName: "Lý Nhật Quang",
  id: "8b6e2f1a-0c4d-4e7b-a1f3-5d9c2b7e4a60",
  isExactDuplicate: false,
  lifecycleStatus: "active",
  publicCode: "TV-2024-00088",
};

const linkedAn: StudentDuplicateLinkedStudent = {
  birthYear: 2016,
  fullName: "Lý Minh An",
  id: "c3d7a9e2-6f1b-4a8c-b5e0-7a2d4f6c8b91",
  isExactDuplicate: false,
  lifecycleStatus: "trial_completed",
  publicCode: "TV-2026-00102",
};

const existingGuardian = {
  fullName: "Nguyễn Thị Thu",
  id: "e1f4b8c2-9a3d-4b6e-8c7f-0d2a5b9e3c14",
  phone: STUDENT_FORM_PREVIEW_DUPLICATE_PHONE,
};

/** state=duplicate: the typed student already exists under this guardian (same name, birth year and phone). */
export const studentFormPreviewExactDuplicateLookup: SuccessfulDuplicateLookup = {
  guardian: { ...existingGuardian, children: [{ ...linkedQuang, isExactDuplicate: true }, linkedAn] },
  hasExactStudentDuplicate: true,
  ok: true,
};

/** state=sibling: the phone belongs to the parent of two other students. */
export const studentFormPreviewSiblingLookup: SuccessfulDuplicateLookup = {
  guardian: { ...existingGuardian, children: [linkedQuang, linkedAn] },
  hasExactStudentDuplicate: false,
  ok: true,
};

export interface StudentFormPreviewFixture {
  defaultValues: StudentProfileFormValues;
  draft?: Partial<StudentProfileFormValues>;
  duplicateLookup?: SuccessfulDuplicateLookup;
  lifecycleStatus?: string;
  validate?: boolean;
}

const createDraft: Partial<StudentProfileFormValues> = {
  currentGrade: 8,
  fullName: "Nguyễn Gia Hân",
  guardianFullName: "Đỗ Thị Lan",
  guardianPhone: "0987654321",
  guardianRelationship: "Mẹ",
  learningLevel: "B",
  reason: "Phụ huynh đăng ký tư vấn qua Zalo.",
};

const createFixtures: Record<StudentFormsPreviewState, StudentFormPreviewFixture> = {
  clean: { defaultValues: studentFormPreviewCreateDefaults },
  dirty: { defaultValues: studentFormPreviewCreateDefaults, draft: createDraft },
  duplicate: {
    defaultValues: studentFormPreviewCreateDefaults,
    draft: {
      ...createDraft,
      birthYear: 2013,
      fullName: "Lý Nhật Quang",
      guardianFullName: "Nguyễn Thị Thu",
      guardianPhone: STUDENT_FORM_PREVIEW_DUPLICATE_PHONE,
    },
    duplicateLookup: studentFormPreviewExactDuplicateLookup,
  },
  // One invalid field (a 9-digit phone); everything required is filled.
  error: { defaultValues: studentFormPreviewCreateDefaults, draft: { ...createDraft, guardianPhone: "0905 123 45" }, validate: true },
  sibling: {
    defaultValues: studentFormPreviewCreateDefaults,
    draft: {
      ...createDraft,
      birthYear: previewYear - 11,
      currentGrade: 6,
      fullName: "Lý Gia Hân",
      guardianEmail: "thu.nguyen@example.com",
      guardianFullName: "Nguyễn Thu",
      guardianPhone: "0905 123 456",
    },
    duplicateLookup: studentFormPreviewSiblingLookup,
  },
};

const editFixtures: Record<StudentFormsPreviewState, Omit<StudentFormPreviewFixture, "defaultValues" | "lifecycleStatus">> = {
  clean: {},
  dirty: { draft: { currentGrade: 9, learningGoal: "Ôn thi vào lớp 10 chuyên Toán, ưu tiên hình học.", reason: "Cập nhật theo xác nhận của phụ huynh." } },
  duplicate: {
    draft: {
      birthYear: 2013,
      fullName: "Lý Nhật Quang",
      guardianPhone: STUDENT_FORM_PREVIEW_DUPLICATE_PHONE,
      reason: "Ghép hồ sơ nhập trùng.",
    },
    duplicateLookup: studentFormPreviewExactDuplicateLookup,
  },
  error: { draft: { guardianPhone: "0912 345 67", reason: "Sửa số điện thoại phụ huynh." }, validate: true },
  sibling: {
    draft: { guardianPhone: STUDENT_FORM_PREVIEW_DUPLICATE_PHONE, reason: "Đổi phụ huynh chính theo yêu cầu của gia đình." },
    duplicateLookup: studentFormPreviewSiblingLookup,
  },
};

export function getStudentFormPreviewFixture(
  mode: "create" | "edit",
  state: StudentFormsPreviewState,
): StudentFormPreviewFixture {
  if (mode === "create") return createFixtures[state];
  return {
    ...editFixtures[state],
    defaultValues: studentFormPreviewEditDefaults,
    lifecycleStatus: STUDENT_FORM_PREVIEW_LIFECYCLE_STATUS,
  };
}

/** The lookup the preview's duplicate stub answers per state (only duplicate and sibling find a guardian). */
export function getStudentFormPreviewLookup(state: StudentFormsPreviewState): SuccessfulDuplicateLookup | null {
  if (state === "duplicate") return studentFormPreviewExactDuplicateLookup;
  if (state === "sibling") return studentFormPreviewSiblingLookup;
  return null;
}
