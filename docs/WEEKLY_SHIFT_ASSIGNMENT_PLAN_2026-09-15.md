# Phân công lịch theo tuần

## Yêu cầu và phạm vi

Người dùng yêu cầu lập kế hoạch và triển khai bảng phân công độc lập từng tuần, tiện thay đổi theo lịch trợ giảng chốt và xem lại tuần cũ. Đã chọn B và xác nhận tiếp tục kế hoạch, triển khai trực tiếp, bỏ bước office-hours.

- Tuần thứ Hai đến Chủ nhật, tính ngày hiện tại theo Asia/Ho_Chi_Minh.
- Bộ chọn ngày trong tuần, tuần trước/sau, tuần hiện tại; URL giữ tuần đang xem.
- Thêm/đổi/bỏ một ca của một nhân sự trong ngày. Mỗi tuần độc lập.
- Tuần tương lai bắt đầu trống. Lịch lặp cũ được giữ đến hết tuần chuyển đổi; vẫn xem lại lịch cũ theo khoảng hiệu lực.
- Không sửa ngày đã qua hoặc ngày đã có chấm công. Giữ ID lịch cũ và tham chiếu chấm công.
- Giữ quyền timekeeping.view để xem, staff.manage để sửa; kiểm tra lại trong database.
- Không thêm bước duyệt/chốt mới, lịch đăng ký rảnh hoặc gửi thông báo.

## Kế hoạch thực hiện

- [x] Khảo sát schema, RPC, route, giao diện, kiểm thử và hướng dẫn Next.js cài trong dự án.
- [x] Migration thêm phạm vi tuần vào bảng lịch hiện có, truy vấn tuần, lưu/cancel nguyên tử, xử lý lịch cũ và chọn ca chấm công.
- [x] Server action và kiểm tra dữ liệu; giao diện phân công theo tuần và tích hợp route.
- [x] Kiểm thử hành vi ngày/tuần, quyền, lỗi lưu, cách ly hai tuần, lịch sử, ca qua đêm; lint/typecheck.
- [x] Rà soát diff và ghi kết quả thực tế.

## Rà soát kỹ thuật

### Kiến trúc

Tái sử dụng staff_shift_assignments, work_shifts, audit trigger và time_entries FK. Không dựng hệ thống lịch thứ hai. Thêm week_start nullable để phân biệt lịch tuần và dữ liệu lặp cũ. Một hàng tuần đại diện một ngày làm việc; ngày hiệu lực là ngày thực tế. Hàng hủy giữ lại để không khôi phục nhầm lịch lặp cũ. Truy vấn lịch sử không lọc mất ca đã ngừng dùng hoặc nhân sự đã nghỉ.

Luồng chấm công dùng chung hàm chọn ca theo ngày, ưu tiên lịch tuần (kể cả đã hủy), xử lý ngày bắt đầu ca qua đêm. Lưu lịch và check-in cùng khóa theo nhân sự để không sửa ca trong lúc check-in.

### Chất lượng mã

Tách phần lịch tuần khỏi component trang chấm công đang có nhiều chức năng. Tái sử dụng thành phần Button/Dialog/ResultBanner, schema Zod và helper ngày Việt Nam. Kiểm tra response RPC; lỗi tải khác trạng thái trống. Optimistic concurrency bằng ID + updated_at để tránh ghi đè giữa hai quản lý. Trigger phiên bản dùng clock_timestamp và tăng tối thiểu 1 microsecond, vì now() giữ nguyên trong một transaction.

### Kiểm thử

```
Chọn ngày -> chuẩn hóa thứ Hai -> route -> RPC tuần -> bảng lịch
  | ngày sai / qua năm / Chủ nhật          | quyền / lịch sử / trống
Lưu ca -> validate -> quyền -> khóa nhân sự -> kiểm tra phiên bản -> ghi + audit
  | dữ liệu sai       | bị từ chối          | trùng / lỗi / đã chấm công
Check-in -> cùng khóa -> chọn ca theo ngày bắt đầu -> time_entries FK
  | tuần khác / lịch hủy / ca qua đêm / lịch lặp cũ
```

Unit tests cho chuẩn hóa tuần và server action. Component tests cho điều hướng, lịch sử, form và lỗi. SQL integration tests cho cách ly hai tuần, quyền, stale write, hủy và chọn ca. Docker không chạy; đã chạy bộ SQL trên PostgreSQL 14 tạm qua Unix socket, có 35 assertion và thêm hai session ghi đồng thời. Schema lịch, audit và RPC check-in lấy trực tiếp từ migration; auth/evidence/watchdog dùng fixture tối thiểu, nên chưa thay thế kiểm thử toàn bộ Supabase/RLS và browser có đăng nhập.

### Hiệu năng

Lọc đúng tuần ở database, index staff/week/day; không tải toàn bộ lịch sử xuống client. Không thêm thư viện hay dịch vụ. Một mutation xử lý một ô lịch trong transaction.

## Lưu ý triển khai

Phải áp dụng migration trước ứng dụng. Không tự đẩy lên production trong lượt triển khai local. Các thay đổi GPS/chấm công có sẵn trong working tree thuộc công việc khác; chỉ chỉnh những đoạn tích hợp cần thiết và giữ nguyên phần còn lại.

## Kết quả kiểm chứng

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- 8 file Vitest liên quan: 43/43 PASS.
- `node scripts/test-weekly-schedule-db.mjs`: PASS, gồm migration, kiểm thử SQL và hai session ghi cùng lúc. Database tạm tự dừng và xóa sau khi chạy.
- `git diff --check`: PASS.
- `npm run build`: PASS (2026-09-16), exit 0; `/timekeeping` là dynamic route. Đã sửa lỗi PageProps phát hiện ở lần build trước. Có log DYNAMIC_SERVER_USAGE ở các route dùng cookie trong bước dò dựng tĩnh; không chặn build.
- Chưa áp dụng migration vào database thật, chưa deploy hoặc kiểm thử browser có đăng nhập.

## Ghi nhớ cho lần sau

- Với Next.js 16, không đặt `= {}` cho tham số hàm page: bộ kiểm tra route sinh lúc production build có thể coi FirstArg là union với undefined và từ chối PageProps, dù typecheck trước khi sinh route types đã qua.

- `set_updated_at()` hiện dùng `now()`, không đổi trong một transaction. Khóa optimistic cho lịch tuần dùng trigger riêng với `clock_timestamp()` và tăng tối thiểu 1 microsecond; cần kiểm thử bằng hai session thật.
- Có hai luồng chọn lịch lúc check-in: `check_in_time_entry` và `request_attendance_exception` (nếu đã cài). Cả hai cần dùng cùng resolver ngày bắt đầu ca, kể cả Chủ nhật qua thứ Hai.
- Hủy lịch tuần phải giữ hàng hủy và chọn hàng đó trước khi lọc active; nếu lọc active sớm thì lịch lặp cũ sẽ xuất hiện lại.
- Ghi nhớ được lưu tại tài liệu này vì đường dẫn logger chuẩn của bản gstack đang thiếu.

## GSTACK REVIEW REPORT

| Runs | Status | Findings |
| --- | --- | --- |
| Scope/architecture/code quality/tests/performance | Reviewed locally | Tái sử dụng bảng lịch; bảo vệ lịch sử; khóa chung với check-in; đọc theo tuần |
| Outside voice | Missing coverage | Bản skill gọi Codex trong chính host Codex; không chạy tiến trình ngoài |
| gstack preamble/telemetry | Unavailable | Đường dẫn ~/.claude/skills/gstack không tồn tại |
| Implementation/validation | Passed focused checks | 43 Vitest tests; 35 SQL assertions và 2-session race; lint/typecheck/build PASS |

VERDICT: DONE_WITH_CONCERNS cho triển khai mã nguồn. Kiểm thử phạm vi tính năng đã qua; chưa có outside voice và kiểm thử Supabase/browser có đăng nhập. Migration chưa áp dụng lên database thật.
NO UNRESOLVED DECISIONS
