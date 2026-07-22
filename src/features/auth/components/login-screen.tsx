import { GoogleSignInButton } from "@/features/auth/components/google-sign-in-button";

interface LoginScreenProps {
  configured: boolean;
  errorMessage?: string;
  nextPath: string;
}

export function LoginScreen({
  configured,
  errorMessage,
  nextPath,
}: LoginScreenProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10 sm:px-6">
      <section className="w-full max-w-[420px] rounded-lg border border-hairline bg-white p-6 shadow-card sm:p-8">
        <div className="mb-7 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
            TV
          </span>
          <span>
            <span className="block text-sm font-bold text-primary">
              TOÁN THẦY VINH
            </span>
            <span className="mt-0.5 block text-xs text-ink-muted">
              Hệ thống quản trị trung tâm
            </span>
          </span>
        </div>

        <h1 className="text-2xl font-bold text-ink">Đăng nhập hệ thống</h1>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Dành cho nhân sự đã được trung tâm cấp quyền truy cập.
        </p>

        {errorMessage ? (
          <div
            className="mt-5 rounded-md border border-danger-border bg-danger-bg px-4 py-3 text-sm leading-6 text-danger"
            role="alert"
          >
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6">
          <GoogleSignInButton configured={configured} nextPath={nextPath} />
        </div>

        <p className="mt-6 border-t border-hairline pt-5 text-xs leading-5 text-ink-muted">
          Chỉ sử dụng tài khoản Google thuộc danh sách được phê duyệt.
        </p>
      </section>
    </main>
  );
}
