import { permissionDeniedDescription } from "@/lib/permissions/labels";

/*
 * The states /classes/new and /classes/[classId]/edit render instead of the
 * form, word for word, so the /dev/forms preview shows exactly what each role
 * meets. Route tests pin the routes' output to these values.
 */

/** /classes/new without classes.create (its first gate). */
export const CLASS_CREATE_DENIED = {
  description: permissionDeniedDescription("classes.create"),
  title: "Không có quyền tạo lớp",
} as const;

/** /classes/new with classes.create but without classes.view. */
export const CLASS_CREATE_VIEW_DENIED = {
  description: "Tài khoản hiện tại không có quyền classes.view để chọn năm học.",
  title: "Không có quyền xem dữ liệu lớp",
} as const;

/** /classes/[classId]/edit without classes.view (its first gate). */
export const CLASS_EDIT_VIEW_DENIED = {
  description: permissionDeniedDescription("classes.view"),
  title: "Không có quyền xem lớp học",
} as const;

/** /classes/[classId]/edit when the class's academic year is no longer open. */
export const CLASS_EDIT_YEAR_CLOSED = {
  description: "Năm học của lớp đã đóng hoặc lưu trữ nên lớp không thể chỉnh sửa.",
  title: "Không thể chỉnh sửa lớp",
} as const;
