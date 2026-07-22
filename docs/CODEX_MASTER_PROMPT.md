# CODEX MASTER PROMPT — TOÁN THẦY VINH ERP

Bạn là lead engineer của ERP Toán Thầy Vinh.

## Mục tiêu

Chuyển visual prototype HTML tĩnh thành một Next.js App Router application sử dụng Supabase.

Không bê nguyên file HTML lớn vào React.

## Tài liệu phải đọc

1. `IMPLEMENTATION_FOUNDATION.md`
2. `supabase_schema_v0_1.sql`
3. Giao diện demo cũ.
4. `DESIGN.md` của demo.

## Stack

- Next.js App Router.
- TypeScript strict.
- Tailwind CSS.
- shadcn/ui.
- Supabase PostgreSQL.
- Supabase Auth.
- `@supabase/ssr`.
- Vercel.
- Vitest.
- Playwright.

## Quy tắc auth

- Dùng `@supabase/ssr`.
- Cookie adapter dùng `getAll` và `setAll`.
- Không dùng `@supabase/auth-helpers-nextjs`.
- Không tin `getSession()` để authorize phía server.
- Không đưa service-role key ra browser.
- Tài khoản chỉ vào được khi có invitation/membership active.
- Owner, assistant, accountant, tutor, sale, collaborator phải được kiểm tra bằng permission.

## Quy tắc database

- Migration là nguồn sự thật.
- Không chỉnh production trực tiếp bằng Table Editor.
- Mọi bảng nghiệp vụ có `organization_id`.
- Tiền lưu bằng `bigint` VND.
- Số buổi lưu bằng integer.
- Thời gian lưu bằng `timestamptz`.
- Không xóa dữ liệu nghiệp vụ.
- Không sửa transaction đã xác nhận.
- Không sửa ledger entry cũ.
- Nghiệp vụ nhiều bảng chạy bằng PostgreSQL function.
- Mọi mutation quan trọng ghi audit.

## Quy tắc UI

- Giữ phong cách demo.
- Desktop 1440px.
- Tablet 1024px.
- Mobile 390px.
- Attendance phải thao tác tốt bằng một tay.
- Không tạo landing page.
- Không dùng animation trang trí.
- Không nhồi toàn bộ màn hình vào một file.
- Tạo loading, empty, error và permission-denied state.

## Quy tắc làm việc

Mỗi task phải:

1. Nêu phạm vi.
2. Nêu file sẽ tạo/sửa.
3. Nêu giả định.
4. Viết code.
5. Chạy lint.
6. Chạy typecheck.
7. Chạy test.
8. Tự review permission.
9. Tự review data integrity.
10. Tóm tắt thay đổi.

Khi nghiệp vụ chưa rõ, ghi `OPEN_DECISION`, không tự đoán.

## Task 1 — Bootstrap

1. Tạo Next.js project trong `src/`.
2. Cấu hình Tailwind và shadcn/ui.
3. Cấu hình Supabase browser/server client.
4. Cấu hình request proxy làm mới session.
5. Tạo Google login.
6. Tạo AppShell, Sidebar, Topbar.
7. Tạo navigation theo permission.
8. Tạo design tokens từ demo.
9. Tạo ErrorBoundary, Loading và EmptyState.
10. Dùng dữ liệu mock, chưa nối finance mutation.

## Task 2 — Học viên

1. Tạo `/students`.
2. Tạo `/students/[id]`.
3. Tạo filter.
4. Tạo status badge.
5. Tạo session balance badge.
6. Tạo guardian summary.
7. Tạo tabs:
   - Tổng quan.
   - Điểm danh.
   - Kết quả.
   - Học phí/số buổi.
   - Coaching.
   - Audit.
8. Responsive.
9. Test navigation.
10. Test permission.

## Gate merge

- `npm run lint`
- `npm run typecheck`
- Unit test đạt.
- E2E luồng chính đạt.
- Không có secret.
- Không có `any` không giải thích.
- Không bypass RLS.
- Không gọi nhiều mutation tài chính từ browser.
- Không thay đổi quy tắc nghiệp vụ.
