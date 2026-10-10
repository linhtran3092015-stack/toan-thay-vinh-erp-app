import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-md rounded-lg border border-border-subtle bg-surface-base p-8 text-center shadow-card">
        <p className="text-caption font-semibold uppercase tracking-wide text-text-muted">
          Lỗi 404
        </p>
        <h1 className="mt-2 text-page-title font-semibold text-text-strong">
          Không tìm thấy trang
        </h1>
        <p className="mt-3 text-body text-text-muted">
          Đường dẫn không tồn tại hoặc đã bị di chuyển. Vui lòng kiểm tra lại
          hoặc quay về trang chính.
        </p>
        <Link
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md border border-action-primary bg-action-primary px-4 text-control font-semibold text-text-on-primary hover:bg-action-primary-hover"
          href="/"
        >
          Về trang chính
        </Link>
      </div>
    </main>
  );
}
