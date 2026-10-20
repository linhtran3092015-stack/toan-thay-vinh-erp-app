import { permissionDeniedDescription } from "@/lib/permissions/labels";

/*
 * The denials /students/new and /students/[studentId]/edit render instead of
 * the form, word for word, so the /dev/forms preview shows exactly what each
 * role meets. Route tests pin the routes' output to these values.
 */

/** /students/new without students.create. */
export const STUDENT_CREATE_DENIED = {
  description: permissionDeniedDescription("students.create"),
  title: "Không có quyền tạo học viên",
} as const;

/** /students/[studentId]/edit without students.view and students.update both. */
export const STUDENT_EDIT_DENIED = {
  description: "Tài khoản hiện tại cần có cả quyền students.view và students.update.",
  title: "Không có quyền chỉnh sửa học viên",
} as const;
