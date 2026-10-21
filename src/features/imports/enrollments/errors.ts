const KNOWN_DATABASE_ERRORS: Array<{
  databaseCode: string;
  message: string;
}> = [
  {
    databaseCode: "AUTHENTICATION_REQUIRED",
    message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  },
  {
    databaseCode: "IMPORTS_ENROLLMENTS_PERMISSION_DENIED",
    message: "Tài khoản hiện tại không có quyền import ghi danh học viên.",
  },
  {
    databaseCode: "ENROLLMENT_IMPORT_ACADEMIC_YEAR_NOT_FOUND",
    message: "Không tìm thấy năm học đã chọn.",
  },
  {
    databaseCode: "STUDENT_ENROLLMENT_IMPORT_MAXIMUM_1000_ROWS",
    message: "Mỗi lần chỉ được import tối đa 1000 dòng.",
  },
  {
    databaseCode: "STUDENT_ENROLLMENT_IMPORT_SHA_ALREADY_EXISTS",
    message:
      "File này đã được dùng để tạo batch trước đó. Kiểm tra lớp của học viên trước khi import lại; nếu cần sửa, hãy lưu file với nội dung mới.",
  },
  {
    databaseCode: "STUDENT_ENROLLMENT_IMPORT_BATCH_NOT_FOUND",
    message:
      "Không tìm thấy batch staging để commit. Hãy chọn lại file, chạy Dry-Run và tạo batch trước khi commit.",
  },
  {
    databaseCode: "STUDENT_ENROLLMENT_IMPORT_BATCH_ALREADY_COMMITTED",
    message: "Batch này đã được commit trước đó, học viên đã được ghi danh.",
  },
  {
    databaseCode: "STUDENT_ENROLLMENT_IMPORT_BATCH_NOT_READY",
    message:
      "Batch không ở trạng thái sẵn sàng commit (còn dòng xung đột hoặc không hợp lệ).",
  },
  {
    databaseCode: "STUDENT_ENROLLMENT_IMPORT_REVALIDATION_FAILED",
    message:
      "Học viên hoặc lớp đã thay đổi sau khi tạo batch. Hãy chọn lại file và chạy Dry-Run lại.",
  },
];

export function describeEnrollmentImportDatabaseError(
  databaseMessage: string | null | undefined,
  fallback: string,
): string {
  if (!databaseMessage) {
    return fallback;
  }

  const knownError = KNOWN_DATABASE_ERRORS.find(({ databaseCode }) =>
    databaseMessage.includes(databaseCode),
  );

  return knownError?.message ?? databaseMessage;
}
