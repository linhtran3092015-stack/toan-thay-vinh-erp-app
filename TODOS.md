# TODOS

## Học sinh

### Thêm trạng thái "withdrawn" vào danh sách trạng thái hợp lệ của loader

**What:** Thêm `"withdrawn"` vào `lifecycleStatuses` trong `src/features/students/data.ts` và thêm test loader có một học sinh đã nghỉ.

**Why:** Loader trả `invalid_student_data` cho cả trang khi gặp trạng thái lạ. Chỉ cần một học sinh bị "Nghỉ học (kết thúc ghi danh)" là `/students` lỗi với mọi nhân viên, và hồ sơ của em đó cũng lỗi.

**Context:** RPC `end_student_enrollment` (migration `20261013090100_phase2a_end_enrollment_withdrawn_close_class.sql`, có từ v0.6.16.0) ghi `lifecycle_status = 'withdrawn'`, nhưng danh sách trạng thái trong `data.ts` vẫn chỉ có 9 giá trị cũ. Lỗi đã có trên main nên sửa bằng hotfix riêng từ main (nhánh `fix/withdrawn-lifecycle-status`). Chip "Đã nghỉ" trên `/students` chỉ hoạt động sau khi sửa. Adversarial review lượt /ship 3 phát hiện.

**Effort:** S
**Priority:** P0
**Depends on:** None

### Tô màu banner và dòng "Còn nợ" ở tab Thanh toán theo 2 mức

**What:** Trong `student-payments-tab.tsx` (khoảng dòng 152), banner `ResultBanner` và dòng "Còn nợ" dùng `payments.overdue`: quá hạn thì danger, còn hạn thì warning.

**Why:** Ô KPI Công nợ và danh sách `/students` đã chia 2 mức, riêng tab Thanh toán vẫn tô đỏ mọi khoản nợ, nên cùng một học sinh hiện vàng ở ô KPI nhưng đỏ trong tab.

**Context:** Quy tắc quá hạn là yêu cầu `pending` quá 14 ngày (`PAYMENT_REQUEST_OVERDUE_DAYS`), giống RPC dashboard `payments_overdue`. `summarizePaymentRequests` đã trả `overdue`.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Test render cho ô Công nợ trên hồ sơ và cố định đồng hồ trong fixture

**What:** Fixture `payments` trong `tests/components/student-profile-presentation.test.tsx` truyền `{ now }` cố định. Thêm test dạng bảng cho 2 trường hợp quá hạn và còn hạn, kiểm tra hint " · có yêu cầu quá hạn" và class `text-danger` hoặc `text-warning`.

**Why:** Hiện chưa có test nào render nhánh quá hạn của ô KPI. Fixture lại phụ thuộc đồng hồ thật: yêu cầu ngày 27/09 thành quá hạn sau 11/10. Nếu điều kiện ternary trong `student-profile-page.tsx:321` bị đảo, CI vẫn xanh.

**Context:** Unit test `summarizePaymentRequests` đã khóa giá trị boolean; còn thiếu phần biến boolean đó thành hint và màu.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Dòng phụ cột Lớp trên `/students` bị cắt mà không có title

**What:** Thêm `title` (hoặc cho xuống dòng) cho span "Khối · ban · hình thức" trong `student-table.tsx` (khoảng dòng 109).

**Why:** Cột Lớp rộng 150px, nội dung còn 126px. "Khối 12 · CLC · Trực tuyến" rộng 146px nên bị cắt thành "…" và không có cách nào đọc được trên desktop.

**Context:** Tên lớp và tên phụ huynh đã có `title`, chỉ dòng phụ này thiếu. Đo trên Browser pane tại 1366px khi QA lượt /ship 3.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Chip lọc nhanh "Nợ buổi" và "Công nợ quá hạn" trên `/students`

**What:** Thêm hai chip lọc nhanh dựa trên cột số dư buổi và cột công nợ.

**Why:** Thiết kế 06 có hai chip này để nhân viên tài chính lọc nhanh học sinh cần nhắc.

**Context:** Hiện cột số liệu tải riêng (`getStudentDirectoryMetrics`) sau danh sách, nên chip cần lọc theo dữ liệu số liệu đã tải hoặc thêm điều kiện ở máy chủ. Hoãn theo quyết định D7.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Cân nhắc tính `partially_paid` vào quy tắc quá hạn

**What:** Quyết định có coi yêu cầu `partially_paid` quá 14 ngày là quá hạn hay không, rồi sửa đồng thời RPC dashboard `payments_overdue` và `src/features/students/student-directory-metrics.ts`.

**Why:** Hiện chỉ `pending` mới tính quá hạn, nên một yêu cầu trả một phần từ 3 tháng trước vẫn hiện vàng.

**Context:** Quyết định D6: giữ giống dashboard cho tới khi sửa cả hai nơi cùng lúc.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Hồ sơ học sinh tải dữ liệu theo kiểu thác nước

**What:** Cho các truy vấn độc lập trên `src/app/(app)/students/[studentId]/page.tsx` chạy song song, hoặc stream từng khối.

**Why:** Các feed (điểm danh, thanh toán, buổi tới, sổ buổi) chờ nhau nên trang hồ sơ mở chậm hơn cần thiết.

**Context:** Phát hiện ở review lượt /ship 3, vòng 1.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Thẻ Chăm sóc trên dashboard không còn stream

**What:** Khôi phục `Suspense`/stream cho `src/features/student-care/dashboard-card.tsx`.

**Why:** Thẻ mới chặn render cả dashboard cho tới khi dữ liệu chăm sóc tải xong.

**Context:** Hoãn ở review vòng 1.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Feed buổi tới: RLS `classes.view` và khung hiệu lực của lớp thành phần

**What:** Kiểm tra feed "Buổi tới" trên hồ sơ khi người xem thiếu `classes.view`, và giới hạn buổi của lớp thành phần theo khoảng hiệu lực của liên kết lớp ghép.

**Why:** RLS có thể làm ô "Buổi tới" trống mà không báo lý do; buổi của lớp thành phần ngoài khung hiệu lực có thể bị tính.

**Context:** `src/features/students/detail/student-activity-data.ts`. Hoãn ở review vòng 1.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Lịch sử điểm danh trên hồ sơ cần thêm quyền `sessions.view` và `results.view`

**What:** Gate tab Điểm danh và ô chuyên cần trên hồ sơ bằng đủ các quyền mà dữ liệu cần, giống cột chuyên cần trên `/students` (cần `attendance.view` và `sessions.view`).

**Why:** Hiện chỉ gate bằng `attendance.view`, nên vai trò thiếu `sessions.view` hoặc `results.view` thấy lỗi hoặc dữ liệu thiếu thay vì "Không có quyền".

**Context:** Hoãn ở review vòng 1.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Cửa sổ chuyên cần trên hồ sơ lấy theo `marked_at` thay vì ngày buổi học

**What:** Đổi truy vấn ở `student-activity-data.ts` (khoảng dòng 360) sang sắp theo ngày buổi học (cần sắp theo bảng nhúng hoặc RPC).

**Why:** Với học sinh có hơn 200 dòng điểm danh, một loạt sửa điểm danh trễ cho buổi cũ đẩy các buổi gần đây ra khỏi cửa sổ, nên tỉ lệ và lịch sử không còn khớp với "N buổi gần nhất".

**Context:** Adversarial review lượt /ship 3, mức Low.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Phân trang offset có thể bỏ sót dòng

**What:** Chuyển phân trang của các loader danh sách và số liệu sang keyset (theo `id` hoặc `created_at`).

**Why:** Nếu có dòng được thêm hoặc xoá giữa hai trang thì offset có thể bỏ sót hoặc lặp dòng; số liệu đã khử trùng theo id nhưng vẫn có thể thiếu.

**Context:** `src/features/students/data.ts`. Hoãn ở review vòng 1.

**Effort:** M
**Priority:** P3
**Depends on:** None

## Buổi học

### Server action theo lô cho "Có mặt cho tất cả chưa chọn"

**What:** Thay vòng lặp gọi RPC từng học sinh trong `session-attendance-management.tsx` bằng một server action theo lô.

**Why:** Lớp đông thì mark-all gọi nhiều lượt mạng nối tiếp, chậm và dễ dừng giữa chừng.

**Context:** Quy tắc tiếp tục/dừng hiện tại đã được chủ dự án duyệt; bản theo lô phải giữ báo cáo chính xác từng em.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Mark-all coi `SESSION_ATTENDANCE_ALREADY_EXISTS` là lỗi

**What:** Trong vòng lặp mark-all, đếm mã `SESSION_ATTENDANCE_ALREADY_EXISTS` là "đã ghi" thay vì thất bại.

**Why:** Nếu máy khác vừa điểm danh một em giữa chừng, banner báo em đó "chưa ghi được" dù thật ra đã ghi, khiến giáo viên bấm thử lại hoặc sửa không cần thiết.

**Context:** `session-attendance-management.tsx` khoảng dòng 254–277. Adversarial review lượt /ship 3. Nên làm cùng server action theo lô.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Kết quả mark-all trên điện thoại nằm ngoài tầm nhìn

**What:** Cuộn tới hoặc ghim banner kết quả mark-all trên màn hình hẹp.

**Why:** Trên điện thoại, banner hiện phía trên danh sách nên người dùng không thấy em nào chưa ghi được.

**Context:** Hoãn ở review vòng 1.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Nút khoá buổi bị vô hiệu khi thiếu `attendance.view`

**What:** Cho khung khoá buổi nêu lý do cụ thể (thiếu quyền xem điểm danh) hoặc tính điều kiện khoá mà không cần quyền đó.

**Why:** Người có quyền khoá buổi nhưng thiếu `attendance.view` thấy nút khoá bị vô hiệu mà không hiểu vì sao.

**Context:** `src/features/sessions/components/session-lock-actions.tsx`. Hoãn ở review vòng 1.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Tên truy cập (label-in-name) của nút trạng thái điểm danh

**What:** Đảm bảo `aria-label` của các nút trong `attendance-status-group.tsx` bắt đầu bằng đúng chữ hiển thị.

**Why:** Người dùng điều khiển bằng giọng nói gọi theo chữ trên nút sẽ không kích hoạt được (WCAG 2.5.3).

**Context:** Hoãn ở review vòng 1.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Thống nhất cách ẩn tên học sinh ở trang buổi học

**What:** Dùng chung `getParticipantDisplayName` cho 4 file buổi học còn lại và ô tìm trong danh sách học sinh của buổi.

**Why:** Bảng người tham gia đã ẩn tên thành "Học viên N" khi thiếu quyền, nhưng các chỗ khác vẫn có thể hiện tên thật hoặc tìm được theo tên.

**Context:** Hoãn theo quyết định D7.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Đồng bộ từ "Offline/Online" sang "Tại lớp/Trực tuyến" trên trang buổi học

**What:** Dùng `formatLearningMode` (`src/lib/format.ts`) cho các bảng điểm danh và kết quả của trang buổi học.

**Why:** Đầu trang đã hiện "Tại lớp" nhưng bảng vẫn hiện "Offline", nên cùng một trang dùng hai từ khác nhau.

**Context:** QA lượt /ship 3 thấy 19 chỗ "Offline" trên `/dev/session?state=pending`.

**Effort:** S
**Priority:** P2
**Depends on:** None

### `session_results` có thể chạm giới hạn 1000 dòng

**What:** Phân trang hoặc giới hạn truy vấn `session_results` theo buổi hoặc học sinh.

**Why:** PostgREST mặc định trả tối đa 1000 dòng, nên dữ liệu vượt mức sẽ bị cắt mà không báo.

**Context:** Hoãn ở review vòng 1.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Link "Hoàn buổi" cần cả quyền `session_ledger.view`

**What:** Chỉ hiện link "Hoàn buổi" ở khung khoá buổi khi người xem có thêm `session_ledger.view`.

**Why:** Người thiếu quyền bấm link sẽ vào trang báo không có quyền.

**Context:** Hoãn ở review vòng 1.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Giao diện

### Restyle EmptyState theo thiết kế

**What:** Làm lại component EmptyState theo file thiết kế (minh hoạ, tiêu đề, mô tả, thao tác chính).

**Why:** Trạng thái rỗng vẫn dùng kiểu cũ, lệch với bộ thành phần mới.

**Context:** Deferred from plan: ~/Downloads/design_handoff_erp_stumana_redesign/HANDOFF.md (mục duy nhất NOT DONE của bước 1–5a).

**Effort:** M
**Priority:** P1
**Depends on:** None

### Tooltip của sidebar thu gọn bị cắt ở md–xl

**What:** Render tooltip của rail 72px qua portal để không bị container cắt.

**Why:** Ở độ rộng md–xl, tooltip tên mục bị cắt nên người dùng không biết biểu tượng là mục gì.

**Context:** `src/components/layout/sidebar.tsx`.

**Effort:** S
**Priority:** P1
**Depends on:** None

### Token màu chữ accent cho dark mode

**What:** Thêm token chữ accent riêng cho dark mode trong `src/app/globals.css`.

**Why:** Màu xanh rêu dùng làm chữ trên nền tối không đủ tương phản.

**Context:** Hoãn ở review vòng 1.

**Effort:** S
**Priority:** P2
**Depends on:** None

### `aria-current` trùng trong ngăn kéo menu điện thoại

**What:** Chỉ đặt `aria-current="page"` cho đúng một mục trong ngăn kéo.

**Why:** Trình đọc màn hình báo hai mục cùng là trang hiện tại.

**Context:** Hoãn ở review vòng 1.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Trả focus khi bấm Esc ở menu tài khoản

**What:** Khi đóng menu tài khoản bằng Esc, trả focus về nút mở menu.

**Why:** Focus bị mất nên người dùng bàn phím phải tab lại từ đầu trang.

**Context:** `src/features/auth/components/auth-user-menu.tsx`. Hoãn ở review vòng 1.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Trường hợp hiếm với `localQueries` ở `/classes`

**What:** Xử lý trường hợp URL "đến trễ" trùng với một query đã gõ trước đó trong `class-list-page.tsx`.

**Why:** Hiếm khi xảy ra, nhưng có thể ghi đè ô tìm bằng giá trị cũ.

**Context:** Hoãn ở review vòng 1.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Dữ liệu và quyền

### Thu hẹp RLS cho mức học phí và nguồn tuyển sinh

**What:** Viết migration thu hẹp chính sách đọc của `student_tuition_rate_versions` và `student_acquisition_source_assignments` theo cùng điều kiện với tab Thanh toán (`payments.view`, `session_ledger.view`, `students.manage_tuition_rates`, `students.correct_acquisition_source`).

**Why:** Bản 0.7.0.0 chỉ ẩn mức phí ở giao diện và khâu tải dữ liệu. Trợ giảng vẫn đọc được trực tiếp qua API Supabase.

**Context:** Quyết định D5. Nhánh redesign không có thay đổi schema nên tách thành migration riêng.

**Effort:** M
**Priority:** P1
**Depends on:** None

### RPC hoặc view tổng hợp cho cột chuyên cần

**What:** Thay việc đọc từng trang `session_attendance` join `class_sessions` trong `getStudentDirectoryMetrics` bằng RPC hoặc view tổng hợp theo học sinh.

**Why:** Trung tâm lớn thì cột chuyên cần phải đọc nhiều trang nối tiếp, làm `/students` chậm.

**Context:** Quyết định D3. Có thể làm cùng mục RLS initplan bên dưới.

**Effort:** M
**Priority:** P2
**Depends on:** None

### RLS dạng initplan `(select has_permission(...))`

**What:** Bọc các lời gọi `has_permission()` trong chính sách RLS bằng `(select ...)` để Postgres tính một lần mỗi truy vấn.

**Why:** Hiện hàm được gọi trên từng dòng, tốn CPU khi đọc bảng lớn.

**Context:** Quyết định D3.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Lưu sẵn số dư buổi

**What:** Lưu số dư buổi đã tính sẵn (bảng hoặc materialized view cập nhật theo sổ buổi) thay vì tính lại mỗi lần đọc `student_session_balances`.

**Why:** Cột số dư buổi và ô KPI đọc view tính toán, chậm dần khi sổ buổi lớn lên.

**Context:** Quyết định D3.

**Effort:** L
**Priority:** P2
**Depends on:** None

## Dọn code

### Gói rút gọn code sau redesign

**What:** Làm một lượt các gợi ý rút gọn đã hoãn: dùng chung một hàm kiểm tra quá hạn cho `summarizePaymentRequests` và `summarizeDirectoryDebt`; một hàm định dạng số buổi có dấu "−" trong `src/lib/format.ts`; bỏ re-export chỉ phục vụ test trong `ledger-data.ts`; một predicate `canSeeTuition(permissions)` dùng chung cho route và trang hồ sơ; xoá các export không còn dùng mà review đã ghi nhận (ví dụ trong `students/detail/types.ts`).

**Why:** Mỗi chỗ trùng lặp là một chỗ có thể lệch nhau. Riêng điều kiện xem học phí lệch nhau thì dữ liệu học phí có thể lọt xuống client.

**Context:** Quyết định D7 và các gợi ý mức advisory của review lượt /ship 3.

**Effort:** M
**Priority:** P2
**Depends on:** None

## Completed
