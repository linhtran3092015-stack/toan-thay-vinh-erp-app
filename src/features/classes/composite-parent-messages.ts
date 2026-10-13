/**
 * One wording per composite-parent ("lớp ghép") rejection from the database
 * triggers, shared by every action that can hit them so the owner reads the
 * same explanation on every screen.
 */
export const compositeParentRpcMessages = {
  COMPOSITE_PARENT_CANNOT_HAVE_CLASS_SESSION: "Lớp ghép không có buổi học riêng. Hãy tạo buổi trên lớp thành phần.",
  COMPOSITE_PARENT_CANNOT_HAVE_SCHEDULE_TEMPLATE: "Lớp ghép không có lịch cố định riêng; lịch học nằm ở các lớp thành phần.",
} as const;
