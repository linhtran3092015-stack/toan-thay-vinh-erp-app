import type { AuthErrorCode } from "@/features/auth/types";

const authErrorMessages: Record<AuthErrorCode, string> = {
  auth_configuration_missing:
    "Hệ thống đăng nhập chưa được cấu hình đầy đủ. Vui lòng liên hệ quản trị viên.",
  oauth_callback_failed:
    "Không thể hoàn tất đăng nhập Google. Vui lòng thử lại.",
  session_expired: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  signout_failed:
    "Không thể đăng xuất hoàn toàn. Vui lòng thử lại hoặc đóng trình duyệt.",
  unauthorized_email:
    "Tài khoản Google này chưa được cấp quyền truy cập hệ thống.",
};

export function getAuthErrorMessage(code?: string): string | undefined {
  if (!code || !(code in authErrorMessages)) {
    return undefined;
  }

  return authErrorMessages[code as AuthErrorCode];
}
