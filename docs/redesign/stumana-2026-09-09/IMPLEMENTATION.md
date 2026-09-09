# Thương hiệu & Giao diện — Trang web công khai

Phạm vi chốt ngày 09/09/2026: chỉnh giao diện ERP hiện có và thêm hai mục cài đặt tham khảo Stumana; không mở rộng module nghiệp vụ.

## Đã viết mã

- Giao diện ERP mặc định đỏ ấm #B83C30, nền sáng ấm, bo mềm, dùng font Be Vietnam Pro hiện có. Giữ điều hướng và quyền nghiệp vụ hiện tại.
- `/settings/branding`: logo, favicon, mô tả, màu website, bảng màu ERP mặc định và bo góc. Lựa chọn màu cá nhân lưu trên trình duyệt, không theo tài khoản trên nhiều máy.
- `/settings/website`: tối đa 12 trang, mỗi trang 20 khối giới thiệu/nội dung/ảnh/liên hệ; sắp xếp khối, đường dẫn, menu đầu/cuối, liên kết, font và hiệu ứng nhẹ, xem trước.
- Lưu nháp riêng với bản đăng. Đăng và ngừng công khai cần xác nhận trong giao diện. Kiểm tra phiên bản tránh ghi đè đồng thời.
- `/site` mở trang đầu của bản đã đăng; `/site/[slug]` chỉ đọc bản đã đăng. Thông tin công khai do quản trị nhập, không truy vấn danh sách học viên hay tài chính.
- Xem cần `settings.view`; sửa/đăng cần `settings.manage`, kiểm tra tại giao diện, server action và hàm cơ sở dữ liệu. Ghi nhật ký thay đổi.
- Ảnh PNG/JPEG/WebP tối đa 250 KB/ảnh, lưu inline; toàn bộ cấu hình giới hạn dung lượng. Chưa có kho media, tên miền riêng, AI tạo trang hay tự đồng bộ danh mục lớp học.
- Màu thương hiệu trong lần này áp dụng website; chưa nối vào email, thanh toán hoặc chứng từ.

## Kiểm tra và triển khai

ESLint đạt cho toàn bộ tệp mã mới và tệp mã đã chỉnh trong phạm vi này.

10 kiểm tra unit/component đạt trong thư mục kiểm tra tạm với dependencies cài riêng (các phiên bản trong khoảng package.json). Bao phủ nội dung không hợp lệ, liên kết nguy hiểm, trùng đường dẫn, tương phản màu, quyền ghi, xung đột phiên bản, chỉ đăng bản đã lưu, lưu lần đầu và xác nhận đăng. Đây chưa phải kiểm thử tích hợp cơ sở dữ liệu.

Thư viện và một số tệp dự án trên máy có trạng thái dataless, khiến kiểm tra TypeScript toàn dự án chưa hoàn tất. Docker chưa chạy, nên chưa chạy kiểm thử SQL hay áp dụng migration `20260909140000_branding_public_website.sql`. Chưa xác minh giao diện thực tế sau đăng nhập hoặc build production.

Trước triển khai: hoàn tất tải các tệp dự án về máy, chạy typecheck/lint/build; áp dụng migration trên cơ sở dữ liệu phát triển rồi kiểm tra quyền viewer/manager/anonymous, lưu nháp, đăng, sửa nháp không đổi bản công khai, xung đột và ngừng công khai. Sau đó kiểm tra màn hình desktop/mobile và dark mode. Chưa triển khai hay đăng nội dung công khai trong phiên làm việc này.
