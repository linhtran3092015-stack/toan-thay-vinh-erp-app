import { permissionDeniedDescription } from "@/lib/permissions/labels";

/*
 * The denials /sessions/batch renders instead of the workspace, word for
 * word, so the /dev/forms preview shows exactly what each role meets. The
 * route test pins the route's output to these values.
 */

/** Without sessions.manage (the route's first gate). */
export const BATCH_SESSIONS_MANAGE_DENIED = {
  description: permissionDeniedDescription("sessions.manage"),
  title: "Không có quyền quản lý buổi học",
} as const;

/** With sessions.manage but without classes.view (e.g. a teaching assistant). */
export const BATCH_CLASSES_VIEW_DENIED = {
  description: "Tài khoản hiện tại cần quyền classes.view để chọn lớp học và xem thời khóa biểu.",
  title: "Không có quyền xem lớp học",
} as const;
