# TODOS

## Học sinh

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

**Context:** `src/features/students/data.ts`. Hoãn ở review vòng 1. Review v0.33.0.0: một số truy vấn đọc theo trang còn không có `ORDER BY` (trong `students/data.ts`: `student_enrollments`, `classes`, `student_guardians`, `guardians`; trong `classes/data.ts`: enrollments), lịch lớp chỉ sắp theo `weekday, start_time`. Với 734 học sinh các bảng phụ huynh và ghi danh đã quá một trang 500 dòng, nên có thể lặp hoặc thiếu dòng giữa hai trang. Từ v0.33.0.0 các loader này dùng chung `fetchAllPages` (`src/lib/supabase/fetch-all-pages.ts`), hàm yêu cầu thứ tự kết thúc bằng cột duy nhất. Bước nhanh: thêm `.order("id")` vào từng truy vấn; sau đó khử trùng theo id hoặc chuyển sang keyset.

**Effort:** M
**Priority:** P2
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

### Ô "học thêm" báo khi chỉ đang hiện 100 em

**What:** Trong `session-attendance-management.tsx` (khoảng dòng 856), ô chọn học sinh học thêm chỉ hiện `.slice(0, 100)`; thêm dòng "Đang hiện 100/N học viên khớp, gõ tên hoặc mã để thu hẹp" như `SearchHint` của hộp thoại thêm học sinh vào lớp, và câu báo khi tìm không ra ai.

**Why:** Từ v0.33.0.0 ô này tải đủ ~567 học sinh đang học và xếp theo tên, nên khi chưa gõ gì chỉ thấy các tên A đến khoảng D; trợ giảng dễ tưởng các em khác không có.

**Context:** Giới hạn 100 có từ trước; loader `getAdditionalStudyCandidates` giờ đọc đủ qua `fetchAllPages`. Nhãn đang bắt đầu bằng mã ("TTV-… – Tên · Khối"), cân nhắc đưa tên lên trước.

**Effort:** S
**Priority:** P2
**Depends on:** None

## Lớp học

### Chặn ở database cho hủy buổi hàng loạt

**What:** Migration cho `cancel_class_session` (hoặc một RPC hủy hàng loạt riêng) nhận trạng thái mong đợi và từ chối buổi `in_progress` khi gọi từ hủy hàng loạt; đồng thời kiểm quyền "chỉ chủ trung tâm" (`sessions.manage` + `classes.manage_schedule`) ngay trong database.

**Why:** `cancelClassSessionsAction` đọc lại từng buổi ngay trước khi hủy (D9) nên cửa sổ race chỉ còn một round trip, nhưng chưa đóng hẳn: RPC vẫn hủy được buổi giáo viên vừa bấm Bắt đầu. Quy tắc chỉ chủ hủy hàng loạt (D3) cũng mới chặn ở server action.

**Context:** RPC ở `supabase/migrations/20260725120000_session_lifecycle_workflows.sql` khóa dòng `for update` rồi chỉ kiểm `locked_at`; trạng thái `in_progress` được chấp nhận. Comment trong `session-lifecycle-actions.ts` trỏ tới mục này.

**Effort:** M
**Priority:** P1
**Depends on:** None

### Tạo yêu cầu thanh toán theo lớp

**What:** RPC khóa kỳ thu (hoặc tạo yêu cầu thanh toán) cho riêng một lớp, rồi thêm nút "Tạo yêu cầu thanh toán" hàng loạt vào tab Học phí của trang lớp như thiết kế 03.

**Why:** Hiện chỉ khóa được cả kỳ (áp cho mọi lớp) ở trang kỳ thu; tab Học phí của lớp chỉ xem và dẫn sang trang đó (quyết định của anh ở bước 5b đợt 2).

**Context:** Phiếu học phí (`tuition_collection_items`) gộp mọi lớp của học sinh trong một kỳ, nên khóa theo lớp phải tách phiếu hoặc khóa từng học sinh. `lock_tuition_collection_period` trong `supabase/migrations/20261012130100_tuition_period_cutoff_balance_and_overlap.sql`.

**Effort:** L
**Priority:** P2
**Depends on:** Quyết định nghiệp vụ của chủ trung tâm (phiếu theo lớp hay theo học sinh)

### Tab Học phí của lớp cần cả sessions.view và students.view

**What:** Cho người có `tuition_periods.view` nhưng thiếu `sessions.view` hoặc `students.view` (ví dụ kế toán) vẫn xem được tab Học phí: đọc dòng phiếu theo lớp mà không cần đọc `class_sessions`, lấy tên từ `tuition_collection_items.student_snapshot`.

**Why:** Kỳ đã khóa phải đọc buổi của lớp để tách phần tiền của lớp, và tên học sinh đi qua RLS của `students`, nên tab đang ẩn với vai trò thiếu một trong hai quyền.

**Context:** `CLASS_TUITION_PERMISSIONS` trong `src/features/classes/detail/class-tuition-models.ts`; có thể thêm `class_id` vào snapshot dòng phiếu khi khóa kỳ, hoặc một RPC đọc theo lớp.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Giảm dữ liệu tải sẵn của trang lớp

**What:** Tải tab Học phí và ma trận Kết quả khi người dùng mở tab (hoặc nén ô ma trận), thay vì dựng sẵn ở server mỗi lần mở trang lớp.

**Why:** Trang lớp giờ đọc thêm kỳ thu (preview của kỳ chưa khóa tính trên toàn trung tâm) và gửi ma trận điểm tới 400 buổi × số học sinh cho mọi lần xem.

**Context:** `tuitionPromise` trong `src/app/(app)/classes/[classId]/page.tsx`; `buildClassResultMatrix` trong `class-roster-models.ts`. Đổi kỳ đã dùng server action `loadClassTuitionPeriodAction`.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Chặn ở database cho chuyển lớp / bảo lưu từ dữ liệu cũ

**What:** Thêm tham số `p_expected_enrollment_id` vào RPC `transfer_student_class` và `reserve_student_enrollment`, từ chối khi ghi danh đang hoạt động của học sinh không phải ghi danh đó.

**Why:** Hai RPC tự chọn "ghi danh đang hoạt động duy nhất" của học sinh. Server action giờ đọc lại và so sánh (`getStaleEnrollmentError`) nhưng vẫn còn cửa sổ một round trip; chặn trong RPC mới đóng hẳn.

**Context:** `src/features/students/enrollment/student-enrollment-actions.ts`; RPC ở `supabase/migrations/20260723085911_student_enrollment_workflows.sql`. Phát hiện ở review đối kháng /ship bước 5b đợt 2.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Index student_enrollments theo class_id

**What:** Migration `create index student_enrollments_class_idx on public.student_enrollments (class_id, id);`.

**Why:** Tab Học sinh và tab Học phí đọc mọi ghi danh của lớp (mọi trạng thái) mỗi lần mở trang lớp; index hiện có chỉ là partial (`status='active' and effective_to is null`), nên các lượt đọc này quét cả bảng.

**Context:** `loadClassEnrollments` trong `src/features/classes/detail/class-detail-data.ts`. Phát hiện ở review /ship bước 5b đợt 2 (performance).

**Effort:** S
**Priority:** P3
**Depends on:** None

### Tải danh sách lớp chuyển đến khi mở hộp thoại

**What:** Đọc lớp đích của "Chuyển lớp" (tab Học sinh) qua server action khi mở hộp thoại, hoặc bằng một truy vấn nhẹ (id, mã, tên, khối, mức của lớp active), thay vì `getClassDirectory` đầy đủ mỗi lần mở trang lớp.

**Why:** Người có `students.transfer_class` hiện tải cả danh bạ lớp (kèm lịch, năm học) trên mọi lần xem trang lớp đang hoạt động.

**Context:** `getTransferClassOptions` trong `src/features/students/enrollment/student-enrollment-data.ts`, gọi từ `src/app/(app)/classes/[classId]/page.tsx`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Tab Học phí: kỳ nháp và kỳ đã khóa tính phần của lớp khác nhau

**What:** Với kỳ đã khóa, chỉ tính dòng phiếu có ngày học nằm trong khoảng ghi danh của học sinh ở lớp này (thêm `session_date` của dòng và `effective_from/to` của ghi danh), cho khớp với kỳ nháp (preview lọc theo `enrollment_class_id`).

**Why:** Học sinh chuyển giữa lớp thành phần và lớp ghép trong kỳ có thể bị tính buổi ở cả hai trang lớp sau khi khóa kỳ.

**Context:** `loadLockedRows` trong `src/features/classes/detail/class-tuition-data.ts`. Red team review /ship bước 5b đợt 2.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Mô hình dữ liệu giáo viên/trợ giảng theo lớp hoặc buổi

**What:** Thêm phân công GV/TG theo lớp và theo buổi (đổi giáo viên một buổi), làm khối Đội ngũ trên trang lớp.

**Why:** Thiết kế trang lớp có khối Đội ngũ và thao tác đổi giáo viên, nhưng database chưa có quan hệ phân công.

**Context:** Cần migration và quyết định nghiệp vụ (phân công mặc định theo lớp, ghi đè theo buổi?).

**Effort:** L
**Priority:** P2
**Depends on:** Quyết định nghiệp vụ của chủ trung tâm

### Dời lịch hàng loạt

**What:** Thao tác dời nhiều buổi cùng lúc từ tab Buổi học (như hủy hàng loạt).

**Why:** Hiện chỉ dời được từng buổi ở trang buổi học.

**Context:** Có thể dùng lại `BulkActionBar`, cách chọn buổi và mẫu server action `cancelClassSessionsAction` (giới hạn 40, kiểm quyền và đọc lại trên server).

**Effort:** M
**Priority:** P2
**Depends on:** None

### Số liệu lớp ghép: bỏ dấu "học thêm" của học sinh chỉ thuộc lớp thành phần

**What:** Với buổi của lớp thành phần trên trang lớp cha, chỉ giữ dòng điểm danh có `student_enrollment_id` thuộc lớp cha trước khi tính tally và kết quả.

**Why:** Roster đã lọc theo học sinh lớp cha (D1), nhưng dấu `additional_study` của học sinh chỉ thuộc lớp thành phần vẫn bị đếm là "học thêm", làm lệch số học thêm và mẫu số Kết quả.

**Context:** `fillSessionFeeds` trong `class-detail-data.ts`; `tallyClassSessionAttendance` và `getTalliedStudents` trong `class-detail-models.ts`. Phát hiện ở pass đối kháng của lần ship v0.8.0.0 (D19).

**Effort:** S
**Priority:** P2
**Depends on:** None

### Học sinh ghi danh ở cả lớp cha lẫn lớp thành phần bị loại khỏi roster buổi thành phần

**What:** Xác định cách tính khi một học sinh có ghi danh ở cả hai lớp, rồi sửa bộ lọc roster buổi thành phần trên trang lớp cha.

**Why:** Em đó hiện không được tính ở buổi của lớp thành phần khi xem từ lớp cha.

**Context:** Bộ lọc `entry.enrollment_class_id === classId` trong `fillSessionFeeds`.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Danh sách ghi danh có cả học sinh đã nghỉ hoặc đã hoàn thành

**What:** Quyết định có cho ghi danh học sinh `withdrawn`/`completed` chưa từng ghi danh hay không; nếu không, lọc theo `lifecycle_status` trong `getClassEnrollmentCandidates` và `searchClassEnrollmentCandidates`.

**Why:** `enroll_student_in_class` đặt lại `lifecycle_status = 'active'`, nên ghi danh nhầm sẽ tự kích hoạt lại một em đã nghỉ.

**Context:** `class-detail-data.ts` (truy vấn ứng viên); D19.

**Effort:** S
**Priority:** P2
**Depends on:** Quyết định nghiệp vụ của chủ trung tâm

### Hiệu năng tải trang lớp

**What:** Tải 500 ứng viên ghi danh khi mở hộp thoại thay vì lúc tải trang; gọi RPC roster bằng worker pool thay vì từng đợt 8; đếm kết quả bằng aggregate phía server; bỏ lần đọc `class_component_links` thứ hai; cân nhắc `maxDuration` hoặc đo p95 cho hủy 40 buổi kèm render lại trang.

**Why:** Trang lớp là trang nặng nhất: tối đa 40 RPC roster, đọc phân trang điểm danh/kết quả và danh sách ứng viên mỗi lần tải.

**Context:** `src/app/(app)/classes/[classId]/page.tsx`, `class-detail-data.ts`, `src/features/classes/data.ts`.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Index cho tìm học sinh và đọc ghi danh theo lớp

**What:** Migration thêm index trigram (`pg_trgm`) cho `students.full_name` và index không-partial `student_enrollments(class_id)`.

**Why:** Tìm ghi danh dùng `ilike` trên tên; đọc ghi danh theo lớp không có index phù hợp khi bảng lớn.

**Context:** `searchClassEnrollmentCandidates` trong `class-detail-data.ts`. `ilike` của PostgREST phân biệt dấu, nên client vẫn gộp kết quả lọc không dấu (`normalizeRosterSearch`).

**Effort:** S
**Priority:** P3
**Depends on:** None

### Số thứ tự buổi (B#) ổn định

**What:** Tính số thứ tự buổi ở server (hoặc lưu sẵn) để B# không đổi khi danh sách bị cắt ở 400 buổi hay khi hủy buổi.

**Why:** `orderClassSessions` đánh số trên tập đã tải, nên lớp hơn 400 buổi hoặc vừa hủy buổi sẽ thấy B# thay đổi.

**Context:** `class-detail-models.ts`.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Lớp chỉ có liên kết lớp ghép bắt đầu sau

**What:** Cho phép tạo lịch cố định kết thúc trước ngày liên kết bắt đầu (database đã cho phép), thay vì ẩn toàn bộ nút tạo lịch.

**Why:** Hiện cứ có liên kết chưa kết thúc là UI ẩn tạo lịch, kể cả khi lịch nằm trọn trước liên kết.

**Context:** Trigger `validate_component_parent_schedule`; `ClassScheduleSection` dùng `componentClasses` (D1).

**Effort:** S
**Priority:** P3
**Depends on:** None

### Trang sửa lớp lỗi khi đọc liên kết lớp ghép bị lỗi thoáng qua

**What:** Để `/classes/[id]/edit` không phụ thuộc vào lần đọc `class_component_links` (trang chi tiết vẫn fail-closed).

**Why:** `getClassDetail` giờ trả `component_links_query_failed` cho mọi trang dùng nó, kể cả trang sửa lớp vốn không cần dữ liệu này.

**Context:** `src/features/classes/data.ts`; D19.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Chỉ nhận đường dẫn http/https cho ClassIn và phòng học trực tuyến

**What:** Giới hạn `optionalUrlSchema` (class form, schedule form, session meetingUrl) về giao thức `http`/`https`.

**Why:** `z.url()` nhận cả `javascript:`/`data:`. React 19 chặn `javascript:` trong `href` nên rủi ro thấp, nhưng nên chặn từ khâu nhập.

**Context:** `class-form-schema.ts`, `class-schedule-form-schema.ts`; chỗ hiển thị ở `class-schedule-section.tsx` và `class-overview-tab.tsx`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Test còn thiếu cho trang lớp

**What:** Test chặn quá 40 buổi ở hộp thoại hủy (client); chip lọc, trang mở đầu và phân trang tab Buổi học; test trình duyệt cho container query 864px (bảng hay danh sách thẻ, nút 44px).

**Why:** Các nhánh này chỉ được kiểm bằng tay hoặc ở server.

**Context:** `tests/components/class-detail-workspace.test.tsx`; jsdom không áp CSS nên phần bố cục cần Playwright.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Ô thêm học sinh vào lớp cắt theo họ khi quá giới hạn

**What:** `queryEnrollmentCandidates` (`class-detail-data.ts`) lấy tối đa 500 em (50 khi tìm) theo `full_name` rồi mới xếp theo tên. Xếp theo tên ngay trong truy vấn (RPC hoặc cột khóa tên) trước khi cắt, và xếp lại một lần cả danh sách gộp trong `class-enroll-dialog.tsx`.

**Why:** Khi bị cắt, hộp thoại hiện các em có họ đứng đầu bảng chữ cái nhưng trông như danh sách A–Z theo tên; kết quả tìm từ server nối sau kết quả tại chỗ thành hai đoạn xếp riêng.

**Context:** Hộp thoại đã có cờ `truncated` và gợi ý gõ để tìm; số học sinh chưa từng ghi danh hiện nhỏ hơn 500 nên chưa xảy ra.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Giao diện

### Nút cỡ md 40px trên điện thoại

**What:** Đưa nút cỡ `md` lên 44px trên màn hình cảm ứng trong toàn app.

**Why:** Mục tiêu chạm tối thiểu 44px; hiện nút md cao 40px.

**Context:** `src/components/ui/button.tsx`; ảnh hưởng mọi trang.

**Effort:** S
**Priority:** P3
**Depends on:** None

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

### Ô chọn học sinh có ô tìm khi tạo yêu cầu thanh toán và tạo coaching

**What:** `payment-request-create-form.tsx` (khoảng dòng 65) và `create-coaching-dialog.tsx` (khoảng dòng 167) là `<select>` thường, giờ chứa ~570–720 em. Thêm ô lọc theo tên, mã, SĐT phụ huynh (hoặc combobox), và với coaching đưa tên lên trước mã ("Nguyễn Văn An (HS0452)").

**Why:** Danh sách đã xếp theo tên nhưng nhãn coaching bắt đầu bằng mã nên không nhìn ra thứ tự; gõ phím tắt nhảy theo mã chứ không theo tên; trên điện thoại là một bánh xe rất dài.

**Context:** Từ v0.33.0.0 hai ô này tải đủ mọi học sinh (trước đây cắt 500 em theo họ). Ô học thêm trong buổi học đã có ô tìm, có thể dùng lại cách làm đó.

**Effort:** M
**Priority:** P2
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

### Cảnh báo "N người sẽ mất quyền" trên ma trận phân quyền

**What:** Khi bỏ tick một quyền của vai trò trên `/settings/permissions`, hiện cảnh báo warning "N người sẽ mất quyền X khi lưu" trong hộp thoại lý do (thiết kế 9b).

**Why:** Thu hồi quyền ảnh hưởng ngay từ lần tải trang kế tiếp của mọi người giữ vai trò đó; Owner hiện không thấy số người bị ảnh hưởng trước khi lưu.

**Context:** Bước 9 của redesign bỏ khối này vì trang chưa đọc danh bạ nhân sự. Cần đọc `user_role_assignments` (hoặc `getStaffDirectory({ includeRoles: true })`, cần `staff.view`) và tính người mất quyền theo hợp các vai trò (một người còn vai trò khác có quyền đó thì không mất).

**Effort:** M
**Priority:** P2
**Depends on:** None

### Thống nhất quy tắc xếp tên giữa app (JS) và SQL

**What:** `src/lib/student-order.ts` dùng `Intl.Collator("vi", { numeric: true })` và `trim()` (bỏ mọi khoảng trắng); SQL trong `get_student_care_students` dùng `collate "vi-x-icu"` (không numeric) và `btrim()` (chỉ bỏ dấu cách). Bỏ `numeric: true` hoặc tạo collation ICU có `kn`, và chuẩn hóa khoảng trắng trong SQL; thêm một bộ tên mẫu dùng chung cho test JS và test SQL.

**Why:** Tên có số ("HS 2" và "HS 10") xếp khác nhau giữa trang Chăm sóc và các danh sách khác; tên kết thúc bằng khoảng trắng lạ (tab, NBSP) có khóa tên rỗng trong SQL nên đứng đầu.

**Context:** Khóa SQL đã kiểm tra trên PG17 Supabase: NBSP giữa các chữ cho kết quả giống JS; chỉ khác ở số và khoảng trắng lạ ở cuối. Rất hiếm với dữ liệu thật.

**Effort:** S
**Priority:** P3
**Depends on:** None

### `fetchAllPages` đọc 1000 dòng mỗi trang

**What:** `FETCH_PAGE_SIZE` trong `src/lib/supabase/fetch-all-pages.ts` là 500 nên ô chọn ~570–720 em cần 2 lượt đọc nối tiếp. Cân nhắc 1000 (bằng `max_rows` của PostgREST) sau khi xác nhận `max_rows` trên production.

**Why:** Bớt một lượt gọi mạng cho trang buổi học, tạo yêu cầu thanh toán và coaching.

**Context:** Giữ 500 vì điều kiện dừng là "trang ngắn hơn kích thước trang": nếu `max_rows` trên production nhỏ hơn kích thước trang thì sẽ âm thầm thiếu dòng. Kiểm tra `max_rows` trước khi tăng.

**Effort:** S
**Priority:** P4
**Depends on:** None

## Dọn code

### Gói rút gọn code sau redesign

**What:** Làm một lượt các gợi ý rút gọn đã hoãn: dùng chung một hàm kiểm tra quá hạn cho `summarizePaymentRequests` và `summarizeDirectoryDebt`; một hàm định dạng số buổi có dấu "−" trong `src/lib/format.ts`; bỏ re-export chỉ phục vụ test trong `ledger-data.ts`; một predicate `canSeeTuition(permissions)` dùng chung cho route và trang hồ sơ; xoá các export không còn dùng mà review đã ghi nhận (ví dụ trong `students/detail/types.ts`).

**Why:** Mỗi chỗ trùng lặp là một chỗ có thể lệch nhau. Riêng điều kiện xem học phí lệch nhau thì dữ liệu học phí có thể lọt xuống client.

**Context:** Quyết định D7 và các gợi ý mức advisory của review lượt /ship 3.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Rút gọn code trang chi tiết lớp

**What:** Dùng lại hàm bỏ dấu có sẵn thay vì `normalizeRosterSearch` riêng; debounce tìm kiếm bằng `useEffect`; bỏ nhánh query rỗng không bao giờ chạy; gộp `createBulkCancelErrorState` với `createErrorState`; bỏ bản sao map trong `getTalliedStudents`; bỏ ref giả `clearFocusRefs`; dùng chung bảng tên thứ (`VIETNAMESE_WEEKDAY_NAMES`) thay cho `weekdayNames` trong `class-schedule-section.tsx`.

**Why:** Các bản trùng có thể lệch nhau theo thời gian.

**Context:** Gợi ý advisory của các lượt review khi ship v0.7.0.0 và v0.8.0.0 (D7, D11).

**Effort:** S
**Priority:** P3
**Depends on:** None

### Dời các thành phần dùng chung khỏi module học sinh

**What:** Chuyển `FieldShell`, `fieldControlClass`, `textAreaControlClass`, `describedBy` (đang ở `features/students/form/components/form-controls`) và `ProfilePanel`/`PanelNotice` sang `components/patterns` hoặc `components/ui`; chuyển kiểu `ClassDetailWorkspace`, `ClassEnrollmentCandidate` khỏi file server-only `class-detail-data.ts` sang `class-detail-models.ts`.

**Why:** Trang lớp import nội bộ form học sinh, nên sửa style form học sinh sẽ đổi luôn 3 màn hình lớp. Kiểu dữ liệu dùng ở client đang nằm trong file `server-only`; chỉ cần một import giá trị là build client hỏng.

**Context:** Gợi ý advisory của review khi ship v0.8.0.0.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Test flaky khi chạy cả suite

**What:** Ổn định `tests/components/advances-management.test.tsx` (assert focus), `tests/components/legacy-consequential-dialogs.test.tsx` (thu hồi lời mời) và các test tìm học sinh ghi danh dùng debounce 300ms bằng timer thật (`class-detail-workspace.test.tsx`).

**Why:** Thỉnh thoảng fail khi chạy cả suite song song nhưng chạy riêng thì đạt (legacy-consequential-dialogs: 5/5 khi chạy riêng, 1 lần fail trong cả suite ngày 2026-10-13), làm CI đỏ vô cớ.

**Context:** Hướng sửa: `vi.useFakeTimers({ shouldAdvanceTime: true })` cho debounce; tìm nguyên nhân phụ thuộc thời gian ở 2 file còn lại thay vì nới timeout (D10).

**Effort:** S
**Priority:** P2
**Depends on:** None

### Phần chấm bài dùng hàm xếp tên chung

**What:** `grading-submissions/roster.ts` (`lastNameWord`) và `grading-submissions/review.ts` (`givenName`, collator `sensitivity: "base"`) tự xếp theo tên; chuyển sang `givenNameOf` / `compareStudentNames` trong `src/lib/student-order.ts`, giữ các tiêu chí phụ (năm sinh, có buổi, mã).

**Why:** Danh sách gợi ý ghép bài bỏ qua dấu thanh nên "Anh" và "Ánh" có thể đứng khác thứ tự so với các danh sách khác.

**Context:** Hàm chung có từ v0.33.0.0; phần chấm bài vừa ship ở v0.30–0.32 nên tách PR riêng.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Preview `/dev/class` và `/dev/lists` theo đúng thứ tự trang thật

**What:** `src/app/dev/class/class-preview.tsx` (khoảng dòng 232) vẫn sort `fullName.localeCompare(..., "vi")`; đổi sang `compareStudentNames`. `/dev/lists` view students dùng mảng fixture tự xếp; áp `compareStudentsByGradeThenName`.

**Why:** Preview là nơi review giao diện trên dữ liệu mẫu; hiện nó hiện thứ tự theo họ, khác trang thật từ v0.33.0.0.

**Context:** Chỉ ảnh hưởng trang dev, không ảnh hưởng production.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Viết gọn `orderWithinSessions` bằng `Map.groupBy`

**What:** `src/features/learning-results/data.ts` tự dựng Map thứ hạng buổi và comparator hai khóa; có thể viết `[...Map.groupBy(rows, (r) => r.classSessionId).values()].flatMap((g) => sortByStudentName(g, (r) => r.studentName))`.

**Why:** Ngắn hơn và không sort tại chỗ mảng đầu vào.

**Context:** Hành vi giữ nguyên (Map giữ thứ tự buổi xuất hiện đầu tiên); có test `learning-results-directory-order.test.ts`.

**Effort:** S
**Priority:** P4
**Depends on:** None

## Tài chính · SePay

### Xác nhận hàng loạt gợi ý trên tab Cần xử lý

**What:** Cân nhắc đưa nút "Xác nhận N dòng tin cậy cao" vào tab Cần xử lý nếu kế toán cần.

**Why:** Bước 7 đợt 2 chỉ để nút này và panel đồng bộ lịch sử ở tab Tất cả giao dịch, theo thiết kế 7c.

**Context:** `sepay-transactions-screen.tsx`, `sepay-allocation-suggestions.tsx`; cần chủ trung tâm xác nhận.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Tab theo trạng thái và số đếm toàn hàng đợi

**What:** Đếm giao dịch theo match_status bằng truy vấn đếm để chip luôn có số, cả khi hàng đợi dài hơn một trang; cân nhắc tab "Khớp tự động hôm nay".

**Why:** Chip trạng thái hiện chỉ xuất hiện khi cả hàng đợi nằm gọn một trang.

**Context:** `getSepayTransactionsResult` trả `reviewCount` duy nhất.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Trạng thái webhook SePay và nhập sao kê thủ công

**What:** Hiện thời điểm nhận webhook gần nhất (cảnh báo khi im lặng quá lâu) và luồng nhập sao kê thủ công như thiết kế 7c.

**Why:** Không có dữ liệu sức khỏe webhook hay luồng nhập sao kê trong ERP.

**Context:** Thiết kế `07-tai-chinh.dc.html` khung 7c.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Tìm học sinh khi phân bổ SePay cắt 30 kết quả theo họ

**What:** RPC `search_sepay_allocation_students` lấy `order by s.full_name, s.id limit 30` rồi app mới xếp 30 em đó theo tên. Cho RPC xếp theo tên (cùng biểu thức với `get_student_care_students`) trước khi `limit 30`, hoặc trả cờ "còn nữa" để UI nhắc gõ thêm.

**Why:** Khi tìm một từ rộng (ví dụ "an"), danh sách trông như đủ A–Z nhưng thiếu các em có họ đứng sau em thứ 30.

**Context:** Thứ tự theo tên trong app có từ v0.33.0.0 (`manual-allocation-actions.ts`). Cần migration mới; giữ nguyên chữ ký hàm.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Tài chính · Kỳ thu

### Học sinh học nhiều lớp trên trang kỳ thu

**What:** Hiện đủ các lớp của học sinh trên dòng phiếu (từ dòng phiếu theo buổi) hoặc ghi rõ "lớp chính"; bộ lọc theo lớp tính cả lớp thứ hai.

**Why:** Lúc khóa kỳ chỉ lưu tên lớp đầu tiên theo ngày học; lọc theo lớp bỏ sót học sinh ở lớp kia và tổng còn lại theo lớp bị thiếu.

**Context:** `tuition-period-detail.tsx`; `lock_tuition_collection_period` gom tên lớp bằng array_agg theo session_date.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Gộp số liệu danh sách kỳ thu

**What:** Tính tổng phải thu / đã thu / còn lại theo kỳ bằng một truy vấn tổng hợp (RPC hoặc view) thay vì đọc mọi phiếu của mọi kỳ đã khóa.

**Why:** Số truy vấn và số dòng tăng theo số kỳ (khoảng 12 kỳ mỗi năm).

**Context:** `getTuitionPeriodSummaries` trong `src/features/tuition/period-summary-data.ts`; cần migration.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Thứ tự phân trang khi đọc phiếu kỳ thu

**What:** Sắp xếp theo `created_at, id` hoặc đọc lại phiếu bị phát hành lại trong lúc phân trang.

**Why:** Phát hành lại đúng lúc đang đọc kỳ trên 1000 phiếu có thể làm dòng hiện "Đã hủy/hết hạn" thay vì phiếu thay thế (tạm thời).

**Context:** `loadPeriodItems` trong `period-summary-data.ts`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Dùng chung phần dựng trang kỳ thu cho preview

**What:** Tách view kỳ đã khóa / kỳ nháp thành component client-safe dùng chung cho trang thật và `/dev/tuition`.

**Why:** Preview đang chép lại cách trang dựng stepper và số liệu, dễ lệch khi trang đổi.

**Context:** `src/app/dev/tuition/tuition-preview.tsx`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Hai lần render sau khi khóa kỳ trên trang chi tiết

**What:** Hiện thông báo khóa thành công mà không cần `router.replace(?locked=1)` sau `revalidatePath`.

**Why:** Khóa kỳ làm trang render phía server hai lần (đọc lại toàn bộ phiếu).

**Context:** `TuitionPeriodPageLockPanel`; một lần mỗi kỳ nên chấp nhận được.

**Effort:** S
**Priority:** P4
**Depends on:** None

### Bảng kiểm tra kỳ thu xếp lại toàn bộ mỗi lần gõ ô tìm

**What:** Trong `tuition-readiness-table.tsx`, memo `visible` phụ thuộc `normalizedQuery` nên mỗi phím lại sort cả danh sách bằng `compareStudentNames` (~12–16 ms với ~570 em). Sort một lần (blocker trước, rồi theo tên) trong memo riêng theo `[students, labels, studentDetails]`, memo `visible` chỉ lọc.

**Why:** Gõ nhanh ô tìm trên kỳ thu lớn hơi khựng; file đã tránh tính lại nhãn "không phải mỗi phím" nhưng sort thì chưa.

**Context:** Thứ tự theo tên có từ v0.33.0.0. Lọc giữ nguyên thứ tự nên tách sort ra không đổi kết quả.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Trang chủ

### Kiểm tra quyền `classes.view` của trợ giảng trên production

**What:** Xem trên production vai trò trợ giảng (và quản lý vận hành) có `classes.view` chưa; nếu chưa, cấp qua Cài đặt hoặc migration.

**Why:** Dữ liệu khởi tạo chỉ cấp `classes.view` cho chủ trung tâm. RLS bảng `classes` cần quyền này, nên thiếu nó thì buổi học về không có lớp và các khối buổi học trên trang chủ (và trang Buổi học) báo "Chưa tải được".

**Context:** `hasHiddenClass` trong `src/features/dashboard/home-data.ts` biến lớp bị ẩn thành lỗi có thể thấy. Đã thử chặn feed theo `classes.view` rồi bỏ vì có thể giấu cả lịch của trợ giảng.

**Effort:** S
**Priority:** P1
**Depends on:** None

### Gộp kiểm tra sĩ số của các buổi hôm nay

**What:** Thay vòng gọi `resolve_class_session_roster` từng buổi (tối đa 40, 8 buổi một lúc) bằng một RPC tổng hợp sĩ số theo danh sách buổi.

**Why:** Trang chủ là trang đầu tiên của mọi nhân sự; thời gian tải tăng theo số buổi trong ngày.

**Context:** RPC lô `resolve_class_session_rosters` đang bị thu quyền với `authenticated`; cần migration. `fillRosters` ở `home-data.ts`.

**Effort:** M
**Priority:** P2
**Depends on:** None

### RPC đếm kết quả thiếu cho hàng đợi buổi chờ khóa

**What:** Cho `get_unlocked_completed_sessions` (hoặc RPC anh em) trả thêm số học sinh có mặt mà chưa có kết quả.

**Why:** `loadMissingResults` đang đọc toàn bộ điểm danh và kết quả của tối đa 200 buổi mỗi lần tải trang chủ của trợ giảng.

**Context:** `src/features/dashboard/home-data.ts`.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Stream các khối nặng của trang chủ

**What:** Tách các khối nặng (lịch hôm nay, kết quả thiếu, chuyên cần tuần, học phí) thành server component riêng trong `Suspense`, và cho phần Phân tích không làm chạy lại các khối khi đổi tháng.

**Why:** Trang chủ chờ mọi nguồn xong mới hiển thị; đổi tháng ở Phân tích chạy lại toàn bộ.

**Context:** `src/app/(app)/page.tsx`, `getDashboardHomeReadModel`.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Tổng hợp giao dịch SePay chưa khớp bằng một truy vấn

**What:** Đếm, cộng tiền và lấy giao dịch cũ nhất trong database thay vì đọc 500 dòng.

**Why:** Tổng hiện là cận dưới ("+") khi tồn hơn 500 giao dịch.

**Context:** `loadSepayBacklog` trong `home-data.ts`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Link "buổi quá giờ chưa xong điểm danh" dẫn tới đúng tập buổi

**What:** Thêm bộ lọc "cần điểm danh" phía server cho `/sessions` rồi trỏ link của mục tổng hợp vào đó.

**Why:** Link hiện là `/sessions?lock=unlocked&to=<hôm nay>`, hiện rộng hơn tập được đếm và bị giới hạn 300 dòng phía client.

**Context:** `buildNeedsAction` trong `src/features/dashboard/home-models.ts`.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Kiểu chung cho mã việc chờ duyệt và link điều chỉnh công

**What:** Xuất union type cho id của `AttentionItem` từ `src/features/dashboard/data.ts`, dùng cho `attentionRules`; sửa link `timekeeping-adj` trong `mapAttention` từ `/payroll` sang `/timekeeping`.

**Why:** Đổi tên id ở một bên làm mục biến mất khỏi danh sách việc mà không lỗi biên dịch.

**Context:** `attentionRules` ở `home-models.ts`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Phần Phân tích của trợ giảng hiện số 0

**What:** Ẩn ô hoạt động nổi bật khi RPC trả null vì thiếu quyền, hoặc không hiện Phân tích ở bố cục trợ giảng.

**Why:** `mapOperationalHighlights` đổi null thành 0 nên trợ giảng thấy số 0 như số thật (có từ trước bước 6).

**Context:** `src/features/dashboard/data.ts`, `dashboard-page.tsx`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Không che lỗi đọc điểm danh và lỗi hàng đợi

**What:** Khi người xem có `attendance.view` mà đọc điểm danh lỗi, báo khối lỗi thay vì hiện "—"; đưa thông điệp lỗi của hàng đợi chờ khóa vào log `DASHBOARD_FEED_FAILED`.

**Why:** Lỗi thật hiện ra như thiếu quyền; log hàng đợi hiện chỉ có tên feed.

**Context:** `fillRosters` và `getUnlockedSessionQueueResult(...).catch` trong `home-data.ts`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Dọn các class màu chết trên `<Link>`

**What:** Luật toàn cục `a { color: inherit }` (không nằm trong layer) thắng mọi utility của Tailwind v4, nên khoảng 45 class `text-*` trên `<Link>` không có tác dụng. Rà từng chỗ: bỏ class hoặc thêm `!` nếu cần màu đó.

**Why:** Đưa luật vào `@layer base` đã thử ở bước 6 và làm hỏng tương phản dark mode của chip module; cần rà tay.

**Context:** `src/app/globals.css`; nút đã có `!` trong `src/components/ui/button.tsx`.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Khoảng chờ trước khi buổi đang học bị coi là quá giờ

**What:** Cân nhắc 15–30 phút sau giờ kết thúc trước khi buổi `in_progress` được tính là "chưa hoàn thành".

**Why:** Buổi 19:30–21:30 thành việc tồn đúng 21:30, trước khi nhân sự kịp bấm hoàn thành.

**Context:** `hasSessionEnded` dùng chung ở `class-detail-models.ts`.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Bảng lương

### Số liệu đầu trang Dashboard lương lệch với số tạm tính trực tiếp

**What:** Lấy tiêu đề, nhãn trạng thái và dải số liệu từ cùng một nguồn với khối tạm tính trực tiếp (hoặc ghi rõ thời điểm chụp số liệu).

**Why:** Đầu trang dùng snapshot máy chủ lúc tải trang, còn khối tạm tính tự làm mới mỗi 30 giây; sau vài lần làm mới hai chỗ có thể khác nhau.

**Context:** `src/features/payroll/dashboard/overview-model.ts`, `owner-live-estimate-overview.tsx`. Cùng nhóm: hai lần làm mới chồng nhau có thể ghi đè kết quả mới bằng kết quả cũ (`use-payroll-live-estimate.ts`, đã có từ trước bước 8).

**Effort:** M
**Priority:** P3
**Depends on:** None

### Số ca chờ xác minh ở Dashboard khác ở sổ lương theo ngày

**What:** Thống nhất cách đếm ca chờ xác minh giữa RPC tổng hợp của chủ trung tâm và sổ lương từng nhân sự; đọc ca và dòng lương trong cùng một truy vấn để không bị lệch thời điểm.

**Why:** Dashboard đếm bằng SQL, sổ lương đếm từ danh sách ca phía client; ca và dòng lương còn được đọc ở hai thời điểm khác nhau.

**Context:** `get_owner_payroll_estimate`, `build_staff_payroll_estimate` (supabase/migrations), `src/features/payroll/estimate/daily-breakdown.ts`. Cần migration.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Tháng đã duyệt: các trường hợp sổ lương hiển thị chưa khớp phiếu

**What:** Xử lý các trường hợp: tháng đã duyệt nhưng không có phiếu lương thì đang rơi về tạm tính; phút công đã chốt khác phút của ca hiện tại; kỳ cũ có dòng lương không gắn id ca nên ca chuyển sang chờ xác minh sau khi duyệt bị ghi "Chưa tính · chưa xác minh".

**Why:** Người xem có thể thấy nhãn hoặc số phút không khớp số tiền đã chốt trên phiếu.

**Context:** `daily-breakdown.ts` (nhánh `approved`, khoảng dòng 160), RPC ước tính lương. Một phần cần SQL.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Phút "đã tính tiền" và "công ghi nhận" chưa khớp phút đã trả

**What:** Cộng phút của dòng lương công không đến từ ca chấm công (ví dụ dữ liệu chấm công nhập từ Excel) vào phút đã tính tiền; hoặc để RPC trả về số phút đã trả.

**Why:** Những ngày có dòng lương từ dữ liệu nhập vẫn hiện tiền nhưng ghi "Chưa có phút công", và đầu sổ đếm thiếu phút đã tính tiền.

**Context:** `daily-breakdown.ts` (cộng phút từ ca, cộng tiền từ mọi dòng công), `payroll-daily-breakdown-table.tsx`. Ngày chỉ có ca online còn hiện đơn giá "—".

**Effort:** S
**Priority:** P3
**Depends on:** None

### Phiếu lương: các điểm hiển thị còn lại

**What:** "Thực nhận" âm nhưng số bằng chữ ghi "Không đồng chẵn"; loader tài khoản ngân hàng nuốt lỗi; `avatar_url` vẫn được truy vấn nhưng không dùng.

**Why:** Số bằng chữ sai dấu dễ gây hiểu nhầm; lỗi tải tài khoản bị giấu thành "chưa có tài khoản".

**Context:** `src/features/payroll/payslip/*`. Cả ba có từ trước bước 8.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Dashboard lương: các điểm giao diện còn lại

**What:** Nút chính dẫn về `/payroll` thay vì mở đúng kỳ chờ duyệt; "Tổng cộng" bảng theo vị trí đếm nhân sự khác bảng nhân sự; tiêu đề "Phân tích" bọc các `h2` (cấp tiêu đề); số trong dải số liệu 28px (đang theo token DESIGN.md); người không có `finance.view` không thấy lý do vì sao dải số liệu thiếu "Thực thu sau hoàn"; chuyển sang tháng hiện tại bằng điều hướng client nên vẫn thấy số tháng cũ (rỗng) cho tới khi tải xong.

**Why:** Mỗi điểm nhỏ, nhưng cộng lại làm Dashboard lương kém rõ ràng.

**Context:** `overview-model.ts`, `payroll-position-summary-table.tsx`, `payroll-dashboard-page.tsx`, `owner-live-estimate-overview.tsx`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Realtime lương báo "đã kết nối" khi đăng ký kênh thất bại

**What:** Thêm hậu tố riêng mỗi lần mount vào tên kênh realtime và báo `CHANNEL_ERROR` trong nhánh `catch`.

**Why:** Mở lại nhanh hộp thoại của cùng nhân sự (hoặc StrictMode khi dev) có thể khiến đăng ký kênh ném lỗi; lỗi bị nuốt và huy hiệu vẫn ghi đã kết nối. Làm mới 30 giây che bớt vấn đề.

**Context:** `src/features/payroll/estimate/use-payroll-live-estimate.ts` (transport mặc định). Có từ trước bước 8.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Cài đặt

### Lưu phân quyền nhiều vai trò: ghi đè và lưu dở

**What:** Thêm RPC lưu theo lô (một giao dịch cho mọi vai trò, có kiểm phiên bản) thay cho việc gọi `set_role_permissions` lần lượt từng vai trò; tạm thời có thể ép tải lại quyền ngay trước khi mở hộp thoại lý do, và lưu vai trò chỉ thêm quyền trước vai trò chỉ bớt quyền.

**Why:** `set_role_permissions` thay cả danh sách quyền và không kiểm phiên bản, nên một bản nháp mở lâu có thể ghi đè thay đổi của Owner khác. Lưu lần lượt không có rollback: chuyển một quyền từ vai trò A sang B mà B lưu lỗi thì không vai trò nào giữ quyền đó cho tới khi thử lại (banner có nêu tên vai trò lỗi). Một lần lưu lỗi sau khi người dùng đã rời trang thì trang không báo được.

**Context:** `src/features/settings/permission-matrix-page.tsx` (`saveAll`), `supabase/migrations/20260802223000_settings_account_rbac_management.sql`. Cần migration.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Quyền đã tắt làm vai trò không lưu được

**What:** Lọc `role_permissions` theo quyền đang hoạt động khi đọc ma trận (`src/features/settings/data.ts`) hoặc cho RPC bỏ qua quyền đã tắt; số "n quyền" trên thẻ vai trò cũng chỉ đếm quyền đang hoạt động.

**Why:** Trang gửi cả danh sách quyền đã cấp, kể cả quyền đã tắt; RPC kiểm quyền đang hoạt động nên mọi lần lưu vai trò đó đều lỗi mà người dùng không gỡ được (quyền đã tắt bị ẩn).

**Context:** Hiện chưa xảy ra trên dữ liệu thật (chưa tắt quyền nào). Kèm theo: đọc `role_permissions` chưa phân trang, sẽ cắt ở 1000 dòng.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Cài đặt Chung chưa lấy lại giá trị từ máy chủ

**What:** Sau khi lưu, dùng giá trị máy chủ trả về (đã trim) làm mốc; khi trang tải lại mà form không có thay đổi thì nhận giá trị mới (giống trình sửa Thương hiệu). Chuẩn hóa xuống dòng cho ô một dòng (bỏ `\n`, `\r` đơn) khi so sánh.

**Why:** Hủy hiện trả về bản lưu cục bộ, thay đổi từ nơi khác không hiện ra và lần lưu sau ghi đè; giá trị lưu có ký tự xuống dòng trong ô một dòng làm form luôn báo "1 thay đổi chưa lưu".

**Context:** `src/features/settings/system-settings-form.tsx` (`saved`, `lf`). Kèm: sửa form trong lúc đang lưu rồi rời trang thì giá trị mới nằm trên route ẩn nhưng không được tính là thay đổi; form chưa khóa ô trong lúc lưu.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Ma trận phân quyền: các điểm nhỏ còn lại

**What:** Xóa banner lỗi khi bản nháp của vai trò lỗi đã được bỏ tay; bỏ bản nháp của vai trò vừa bị tắt (`pruneDraft` theo vai trò đang hoạt động); hộp thoại "Đang lưu phân quyền" đổi nội dung khi lần lưu kết thúc trong lúc hộp thoại đang mở; bấm lại mục lục đang mở không hỏi bỏ thay đổi; chỉ nhận dữ liệu tải lại có phiên bản mới hơn (trình sửa website và ma trận).

**Why:** Mỗi điểm hiếm gặp nhưng làm người dùng hiểu sai trạng thái lưu.

**Context:** `permission-matrix-page.tsx`, `settings/components/leave-guard.tsx`, `settings-toc.tsx`, `website/editor.tsx`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Giao diện cài đặt: phần còn lại sau bước 9

**What:** Dựng lại chế độ Trang web công khai (còn dùng `brand-panel`/`brand-field` cũ) bằng `SettingsCard`; gộp `LeaveConfirmDialog` với `UnsavedChangesDialog` của form học sinh; tối ưu render lưới phân quyền (memo hàng, `useDeferredValue` cho ô tìm) và trình sửa (bỏ `JSON.stringify` mỗi phím gõ); dùng `ui/field` cho `TextInputField`/`TextAreaField` và ô lý do; tìm quyền gập "đ" thành "d"; dấu thay đổi từng ô trong danh sách vai trò trên điện thoại; chip màu cá nhân theo dõi thay đổi từ tab khác; `--save-bar-h` khi có hai thanh lưu.

**Why:** Nợ giao diện và hiệu năng được hoãn trong review bước 9.

**Context:** `src/features/website/editor.tsx`, `appearance.tsx`, `src/features/settings/**`, `src/components/patterns/sticky-save-bar.tsx`.

**Effort:** M
**Priority:** P3
**Depends on:** None

## CRM

### Xác minh ngày áp migration phase 2b cho mốc ngày đổi trạng thái

**What:** Kiểm (chỉ đọc) ngày migration `20261013100000_phase2b_crm_closed_loop` được áp trên production (bảng `supabase_migrations.schema_migrations` hoặc giá trị `status_changed_at` lặp nhiều nhất trong `crm_cases`), rồi chỉnh `CRM_STATUS_TRACKING_SINCE` nếu cần.

**Why:** Cột `status_changed_at` có `default now()` và không backfill, nên lead cũ mang giờ áp migration. Trang coi giá trị là "không rõ" khi lead tạo và đổi trạng thái trước 14/10 mà hai mốc khác nhau. Nếu migration được áp từ 14/10 trở đi, lead cũ sẽ hiện "· N ngày" và ngày nhập học sai.

**Context:** `src/features/crm/crm-presentation.ts` (`getTrustedStatusChangedAt`). Máy dev không phân giải được host Supabase nên chưa kiểm được.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Đặt lịch học thử kéo lead "Chờ xác nhận nhập học" lùi trạng thái

**What:** Ẩn "Đặt lịch học thử" khi lead đã ở "Chờ xác nhận nhập học" (hoặc cho RPC từ chối), và để `book_crm_trial_session` cập nhật `status_changed_at`.

**Why:** RPC đặt `status = 'trial_booked'` mà không kiểm trạng thái hiện tại; một cú bấm đưa lead đang chờ nhập học về "Đã đặt học thử" trong khi hồ sơ học sinh tạm vẫn còn. Có từ trước bước 10.

**Context:** `supabase/migrations/20260726153000_crm_workflows.sql:332`, `getCrmDetailActions` (`bookTrial`). Sửa RPC cần migration.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Lỗi tải học thử / lịch sử / checklist bị nuốt trên trang lead

**What:** Trả cờ lỗi theo từng phần từ `getCrmCaseDetail` và hiện dòng báo lỗi thay vì vẽ từ mảng rỗng.

**Why:** Truy vấn học thử lỗi thì vòng đời ghi hai bước học thử là "không qua bước này" và checklist ghi "Chưa khởi tạo", là khẳng định sai.

**Context:** `src/features/crm/data.ts` (`getCrmCaseDetail`).

**Effort:** S
**Priority:** P2
**Depends on:** None

### Vòng đời: bước "Chờ xác nhận nhập học" và ngày học thử của lead quay vòng

**What:** (1) Quyết định cách hiện bước "Chờ xác nhận nhập học" cho lead chuyển đổi thẳng từ trạng thái trước (chưa có cột ghi lại bước này). (2) Bước học thử hiện tại lấy ngày từ lần đặt/ghi kết quả mới nhất thay vì lần đầu.

**Why:** RPC chuyển đổi nhận mọi trạng thái mở, nên lead cũ hiện bước chờ là "đã xong"; lead lỡ học thử rồi đặt lại vẫn ghi ngày lần đặt đầu.

**Context:** `src/features/crm/crm-presentation.ts` (`deriveCrmLifecycle`). Cần owner chọn cách hiện cho (1).

**Effort:** S
**Priority:** P3
**Depends on:** None

### Bộ lọc nguồn cũ và ký tự đại diện trong tìm kiếm

**What:** Chỉ tính `?source=` là đang lọc khi mã nằm trong danh sách nguồn đang hoạt động; thoát `%` và `_`, bỏ `*` trong từ khóa tìm kiếm.

**Why:** Bookmark có nguồn đã tắt làm danh sách bị lọc (thường rỗng) trong khi ô chọn ghi "Tất cả"; tìm "_" hoặc "%" khớp mọi lead nhưng vẫn hiện là đang lọc.

**Context:** `src/features/crm/components/crm-filters.tsx`, `src/features/crm/crm-directory-url-state.ts` (`sanitizeCrmSearchTerm`).

**Effort:** S
**Priority:** P3
**Depends on:** None

### Trang lead: nút cỡ nhỏ trên điện thoại và hàng nút đầu trang ở 768–900px

**What:** Nút "Đánh dấu Đã dừng…", "Mở lại", "Đặt lịch học thử", "Ghi kết quả", "Lưu ghi chú" dùng cỡ md (≥40px) trên điện thoại; hàng nút đầu trang được xuống dòng dưới tiêu đề tới mốc lg.

**Why:** Cỡ sm (32px) dưới mức chạm 44px trong DESIGN.md; ở 768–900px nhóm nút `shrink-0` chiếm gần hết bề ngang. Có từ trước, chưa sửa ở bước 10.

**Context:** `src/features/crm/components/crm-detail-view.tsx`, `crm-case-status-dialog.tsx` (`triggerSize`).

**Effort:** S
**Priority:** P3
**Depends on:** None

### Thống nhất từ ngữ CRM

**What:** Chọn một từ cho mỗi khái niệm ("học sinh" thay "học viên", viết thường "lead" giữa câu) trên trang lead, hộp thoại và danh sách; cập nhật test có khẳng định nhãn.

**Why:** Trang đang lẫn "học viên"/"học sinh" và "Lead"/"lead".

**Context:** `src/features/crm/components/*`, test trong `tests/components/crm-*`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Hiệu năng trang CRM

**What:** Debounce ô tìm kiếm (~300ms); lọc embed `crm_trial_bookings` chỉ lấy buổi "scheduled"; chạy song song các truy vấn con của `getCrmCaseDetail` và truy vấn lớp đang mở ở trang lead.

**Why:** Mỗi lần tải `/crm` gửi 11 truy vấn song song, và gõ mỗi ký tự lại tải lại; trang lead chạy 5–6 truy vấn nối tiếp.

**Context:** `src/features/crm/data.ts`, `src/features/crm/components/crm-filters.tsx`, `src/app/(app)/crm/[caseId]/page.tsx`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Dọn nhỏ sau bước 10

**What:** Đưa `getInitials` vào `src/lib`; gộp bảng nhãn trạng thái (`crmStatusLabels` và `crmStatusMeta`); dùng chung bộ định dạng dd/mm; cân nhắc đưa `ProfilePanel`/`MetaList` vào `components/patterns` (đã có 2 nơi dùng); cho `CrmTable` nhận gốc đường dẫn để preview `/dev/crm` không mở trang `/crm/<id>` thật; cắt chuỗi theo ký tự đầy đủ (`Array.from`) cho lý do dừng và từ khóa tìm kiếm; hiện đủ lý do dừng cho trình đọc màn hình trong danh sách (hiện chỉ có ở `title`).

**Why:** Gợi ý của review, không ảnh hưởng hành vi hiện tại.

**Context:** `src/features/crm/**`, `src/app/dev/crm/crm-preview.tsx`.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Chăm sóc học sinh

### "Nhận việc" trên hàng đợi không báo kết quả và làm mất focus

**What:** Giữ kết quả nhận việc thành công của hàng đợi ở ngoài dòng (banner trạng thái dưới đầu trang `/student-care`, có thể focus), hoặc chuyển focus sang link "Mở" mới của dòng. Sửa luôn chú thích "the result stays right under the button" trong `CareActionForm`.

**Why:** Nhận việc thành công thì dòng render lại với link "Mở", form nhận việc và dòng `role=status` biến mất, focus rơi về `body`. Người dùng bàn phím và trình đọc màn hình không biết đã nhận được chưa; khi đang lọc "Chưa giao", dòng biến mất hẳn mà không có xác nhận nào. Trang chi tiết đã xử lý đúng trường hợp này (banner dưới đầu trang).

**Context:** `src/features/student-care/components/care-task-table.tsx:128` (RowAction, `trailing` ở dòng 208), `care-queue-view.tsx`, mẫu cần theo: `care-detail-view.tsx` (`keepSuccess`). Phát hiện ở review ràng buộc bước 11a (đã xác minh).

**Effort:** S
**Priority:** P2
**Depends on:** None

### Banner kết quả trên trang công việc không hiện vòng focus

**What:** Bỏ `outline-none` hoặc dùng `focus-visible:outline-solid` cho khung banner nhận focus sau nhận việc / hoàn thành / ngoại lệ. Thêm vòng focus chuẩn (2px `--border-focus`) cho ba link mới trên trang công việc: "Xem công việc liên quan" trong dòng thời gian và hai link phiếu Coaching.

**Why:** Trong Tailwind v4, `outline-none` đặt `--tw-outline-style: none` còn `focus-visible:outline-2` chỉ đọc biến đó, nên vòng focus không bao giờ hiện. Người dùng bàn phím không thấy focus đang ở đâu. Ba link kia rơi về vòng focus mặc định của trình duyệt, khác mọi link khác trong cùng file.

**Context:** `src/features/student-care/components/care-detail-view.tsx:140`, `care-detail-sections.tsx:381,401,414`.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Danh sách thẻ trên điện thoại: nút 32px và kết quả nhận việc làm hẹp thẻ

**What:** Dưới danh sách thẻ dùng `Pagination variant="standalone"` (44px trên điện thoại) và cho nút "Nhận việc" chiều cao chạm 44px; đưa form nhận việc ra khỏi khe `trailing` (hoặc giới hạn độ rộng dòng kết quả) để thông báo lỗi không ép thẻ bên cạnh về gần 0.

**Why:** DESIGN.md yêu cầu vùng chạm 44px trên điện thoại; hiện nút Trước/số trang/Sau và "Nhận việc" đều 32px. Khe `trailing` là cột `shrink-0`, nên một thông báo từ chối dài làm thẻ học sinh co lại.

**Context:** `care-task-table.tsx:88,130,208`, `care-students-table.tsx:95`, `care-queue-nav.tsx:68` (CarePager luôn `variant="frame"`), `src/components/patterns/pagination.tsx`.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Màu huy hiệu và dải bộ tự sinh lệch design 13a

**What:** Theo markup 13a: "Đang theo dõi" dùng tone info (như "Đang xử lý"), "Chưa giao" dùng warning (kèm nền ấm cho dòng quá hạn chưa giao), "bằng chứng đã thay đổi" dùng neutral, dải bộ tự sinh khỏe dùng nền success. Quyết định lại tone của bộ tự sinh "tạm dừng" (hiện là danger, DESIGN.md dành danger cho lỗi). Tên học sinh trong hai bảng dùng `text-text-strong!` vì `a { color: inherit }` không lớp trong globals.css thắng utility.

**Why:** Mọi việc theo dõi định kỳ đang mang huy hiệu cảnh báo màu cam; việc chưa giao lại xám như "Chưa bắt đầu" nên không nổi bật; tên học sinh hiện màu chữ thường thay vì chữ đậm nhất. Chú thích trong code còn ghi sai là theo 13a.

**Context:** `src/features/student-care/student-care-presentation.ts:38` (`careStatusTones`, test `tests/unit/student-care-presentation.test.ts:69` đang khóa tone cũ), `care-task-table.tsx:123,157`, `care-students-table.tsx`, `generator-status-bar.tsx:56`. Design: `13-cham-soc-va-coaching.dc.html` frame 13a.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Dải bộ tự sinh được đọc lại mỗi phút

**What:** Chỉ để tiêu đề và câu "chưa có nghĩa là học sinh ổn" trong vùng `role=alert`; đưa giờ chạy gần nhất ra ngoài vùng live (hoặc `aria-hidden` như thời gian tương đối).

**Why:** Worker chạy mỗi phút và cập nhật `last_success_at`, nên giờ hiển thị đổi mỗi phút và trình đọc màn hình đọc lại cả cảnh báo mỗi lần làm mới, dù thời gian tương đối đã được ẩn.

**Context:** `src/features/student-care/components/generator-status-bar.tsx:89`; cron `run_student_care_worker` (`* * * * *`).

**Effort:** S
**Priority:** P2
**Depends on:** None

### Số đếm trên chip và đầu trang không khớp danh sách

**What:** Chip "Cảnh báo sớm" đếm cảnh báo đang mở nhưng khi bấm lại lọc mọi trạng thái: hoặc lọc thêm trạng thái đang mở, hoặc ghi "n đang mở". Đầu trang đặt "Tháng MM/YYYY" trước mọi con số dù chỉ Coaching tháng phụ thuộc tháng: tách phần theo tháng ra.

**Why:** Người dùng bấm chip thấy nhiều dòng hơn con số, và đọc nhầm số cảnh báo/chưa giao/quá hạn là của tháng đang chọn.

**Context:** `care-queue-filters.tsx:240` (`applyCareChip`), `care-queue-view.tsx:45`, `get_student_care_dashboard` (`supabase/migrations/20260917101000_student_care_workflows.sql`, khoảng dòng 174-180). Cần chốt với chủ sản phẩm.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Chữ trên trang công việc: nhãn dòng thời gian và lý do chỉ xem

**What:** Đổi nhãn payload trong dòng thời gian "Tiến bộ:"/"Hướng hỗ trợ:" thành "Điểm mạnh:"/"Kế hoạch:" cho khớp form mới; sửa câu lý do chỉ xem bị lặp "phụ trách" khi người phụ trách không còn trong danh sách được giao.

**Why:** Cùng một giá trị mang hai tên trên cùng một trang; câu lý do đọc thành "… phụ trách phụ trách".

**Context:** `care-detail-sections.tsx:315` (`payloadLabels`), `care-detail-view.tsx:95`.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Thẻ Chăm sóc trên trang chủ trộn "học viên" và "học sinh"

**What:** Chốt chữ cho thẻ Chăm sóc trên trang chủ: tiêu đề "Chăm sóc học viên" đang nằm trên dải bộ tự sinh mới ghi "học sinh". Đổi tiêu đề (và link) sang "học sinh" hoặc giữ chữ cũ cho thẻ này; sửa chú thích alias `CareHealth` (thẻ hồ sơ học sinh không dùng nó).

**Why:** Alias `CareHealth` đưa dải mới vào thẻ trang chủ, nên một thẻ dùng hai từ khác nhau cho cùng đối tượng. Quyết định đổi chữ của bước 11a chỉ áp cho hai màn hình chăm sóc, nên cần chủ sản phẩm chốt.

**Context:** `src/features/student-care/components.tsx:6-7`, `src/features/student-care/dashboard-card.tsx:11`, `src/app/(app)/page.tsx:75`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Khóa thử lại (request_id) phía trình duyệt

**What:** (1) Trả mã lỗi từ `mutateCare` (hoặc thêm test quét nguồn) thay vì nhận STALE_VERSION bằng tiền tố câu tiếng Việt. (2) Mỗi dòng học sinh render hai lần (bảng và thẻ) nên hai bản giữ hai khóa riêng: dùng chung khóa theo học sinh. (3) Khóa không gồm `version` nên một lệnh cố ý giống hệt sau một lần "chưa rõ kết quả" sẽ bị coi là gửi lại. (4) Mở lại hộp thoại chưa điền lại giá trị đã gõ. (5) Thông báo STALE có thể gây hiểu nhầm sau chính lần ghi của mình. (6) Sau một lần lưu liên hệ "chưa rõ kết quả" trên trang công việc, nếu lần tự làm mới 60 giây tiếp theo cũng lỗi (cùng đợt Supabase sập), trang thay bằng ErrorState, xóa nội dung đã gõ và khóa thử lại; gõ lại và lưu sẽ là yêu cầu mới, có thể ghi trùng.

**Why:** Các lỗi biên hiếm của cơ chế chống ghi trùng; đổi câu thông báo trong `actions.ts` hiện sẽ âm thầm làm hỏng quy tắc thử lại.

**Context:** `care-action-form.tsx:31,114,133`, `src/features/student-care/refresh.tsx`, `care-students-table.tsx:162`, `care-dialog-action.tsx`, `src/features/student-care/actions.ts:9`.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Hiệu năng và bố cục hàng đợi

**What:** Dòng được render hai lần (bảng + danh sách thẻ) kèm hộp thoại theo dòng; hai tab phân công gọi lại `get_student_care_dashboard` với search/page của danh sách học sinh rồi bỏ kết quả; thanh lọc dùng ngưỡng 1042px nên ở màn 1280–1345px bị thu thành nút "Bộ lọc"; kiểm lại bố cục banner kết quả ở đầu trang và vị trí thẻ "Hoàn thành công việc" (13b đặt ở cột chính); search debounce có thể đua với một điều hướng tab/trang đang chạy. Bảng học sinh là server component nên mọi trường của hộp thoại theo dòng (cả danh sách người được giao) đi vào payload RSC; nếu khung vượt ngưỡng 1042px khi một hộp thoại theo dòng đang mở, bản dòng chứa hộp thoại bị ẩn theo.

**Why:** Chi phí render và RPC thừa; bố cục lệch design ở vài độ rộng.

**Context:** `care-task-table.tsx`, `care-students-table.tsx`, `src/app/(app)/student-care/page.tsx:26`, `src/app/globals.css:660`, `care-detail-view.tsx:166`, `care-queue-filters.tsx`.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Dọn code chăm sóc học sinh

**What:** Gộp CSS trùng với khối `.crm-directory`; dùng `ui/field`, `ui/card` thay `CareCard`; chung helper URL với CRM và `URLSearchParams.get()` thay `toCareRouteSearchParams`; gộp wrapper record-list; bỏ `Partial` thừa ở `GeneratorInput`, re-export `GeneratorStatusBar` không ai dùng trong `components.tsx`, `careTime` không còn caller trong `models.ts`; `formatCareClock` dùng `toVietnamDate` của `src/lib/datetime.ts`; bỏ test trùng `dev-student-care-preview.test.tsx:69`.

**Why:** Gợi ý review (advisory), không đổi hành vi.

**Context:** `src/features/student-care/**`, `src/app/globals.css`, `src/features/crm/crm-directory-url-state.ts`.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Test còn thiếu cho chăm sóc học sinh

**What:** Test cho hai nhánh chặn của `/student-care/[taskId]` (lỗi tải quyền, thiếu `student_care.view`); test nửa còn lại của quyết định focus (form trên trang không kéo focus về); thông báo trang vượt cuối ở tab học sinh; payload của lệnh `configure` (bật/tạm dừng cả trung tâm) và `claim` (dòng hàng đợi và đầu trang); "Xóa lọc (n)" hủy search đang chờ debounce và giữ tab; ba nhánh thẻ bằng chứng (không đọc được, không có bằng chứng, cảnh báo `evidence_current=false` trên trang công việc); test "không ghi" của `/dev/student-care` mới gửi 4/11 đường ghi qua stub; nhánh `previousFocusRef` của `Dialog` khi không truyền `returnFocusRef`; sửa nhãn "REGRESSION (red at HEAD)" của 3 test vì file chưa tồn tại ở base.

**Why:** Các nhánh này chưa có test nào giữ; nhãn hồi quy hiện không đúng sự thật.

**Context:** `src/app/(app)/student-care/[taskId]/page.tsx:15-16`, `care-action-form.tsx:114`, `care-queue-view.tsx:75`, `care-queue-filters.tsx:143`, `care-detail-sections.tsx:60`, `tests/components/dev-student-care-preview.test.tsx`, `src/components/ui/dialog.tsx:58`, `tests/components/dialog-focus-return.test.tsx`, `tests/components/student-care-redesign.test.tsx:342,538,890`, `tests/components/student-care-routes.test.tsx`.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Coaching

### RPC trang phiếu công khai vẫn trả họ tên đầy đủ của học sinh

**What:** Sửa `get_public_coaching_form` (migration) để chỉ trả tên gọi (hoặc không trả tên) cho vai trò `anon`.

**Why:** Bước 11b chỉ hiện tên gọi trên trang, nhưng RPC (cấp cho `anon`) vẫn trả `students.full_name`; ai giữ token và khóa publishable có thể gọi thẳng RPC. Link gửi nhầm phụ huynh vẫn lộ họ tên đầy đủ của trẻ.

**Context:** `supabase/migrations/20260815100000_coaching_forms_wave_b.sql:276`, `20260816151600_harden_anon_rpc_access.sql:32`, `src/app/coaching/form/[token]/page.tsx` (`getStudentGivenName`). Cần chủ trung tâm duyệt (đổi RPC nằm ngoài phạm vi redesign).

**Effort:** S
**Priority:** P2
**Depends on:** None

### Trình soạn biểu mẫu giữ nội dung cũ khi phiên bản đổi ở tab khác

**What:** Remount trình soạn khi phiên bản đổi (`key={form.versionId}` ở `/coaching/forms/[formId]`) và giữ banner kết quả qua lần remount; về lâu dài cho `save_coaching_form_draft`/publish nhận version id để từ chối ghi đè.

**Why:** Hai tab/hai người cùng sửa: tab cũ bấm "Tạo bản nháp phiên bản mới" hoặc "Lưu nháp" có thể xuất bản/ghi đè bằng nội dung đang hiển thị cũ. Trạng thái client chỉ khởi tạo một lần từ props (có từ trước redesign).

**Context:** `src/app/(app)/coaching/forms/[formId]/page.tsx`, `coaching-form-builder.tsx` (useState khởi tạo một lần), RPC `save_coaching_form_draft` (chọn draft theo form_id). Review ràng buộc + adversarial bước 11b.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Giá trị trình duyệt khôi phục vào phiếu phụ huynh bị xóa sau khi trang tải xong

**What:** Đặt `autoComplete="off"` cho form phụ huynh hoặc đọc giá trị/checked đã khôi phục vào `answers` trong layout effect lúc mount.

**Why:** Back/forward không qua bfcache, reload trên Firefox, hoặc Android tải lại tab bị đóng: trình duyệt khôi phục câu trả lời vào các ô đang khóa, rồi lần render sau hydrate xóa chúng (đã tái hiện).

**Context:** `src/features/coaching/components/public-coaching-form.tsx` (fieldset `disabled={!hydrated}`, `useHydrated`). Red team review ràng buộc lần 2.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Câu trả lời dài của phụ huynh bị cắt lặng lẽ ở 4000 ký tự

**What:** Bỏ `maxLength` trên ô trả lời công khai hoặc kiểm độ dài trong `validatePublicAnswers` và báo bằng lời.

**Why:** Dán đoạn dài hơn 4000 ký tự bị trình duyệt cắt mà không báo; máy chủ và DB không giới hạn độ dài câu trả lời.

**Context:** `coaching-question-renderer.tsx` (maxLength=COACHING_MAX_TEXT_LENGTH), `coaching-question-rules.ts`.

**Effort:** S
**Priority:** P2
**Depends on:** None

### "Hết hạn lúc" chấp nhận thời điểm đã qua và không có giới hạn trên

**What:** Trong `issue()` báo "Thời hạn phải sau thời điểm hiện tại." trước khi gọi action; cân nhắc giới hạn (vd 90 ngày) và ép ở RPC.

**Why:** Thời điểm đã qua bị gửi đi rồi nhận lỗi chung "Liên kết hoặc thời hạn không hợp lệ."; token một lần có thể sống tới năm 9999.

**Context:** `coaching-public-link-panel.tsx` (`issue`, ô datetime-local), RPC `issue_coaching_public_link` (`p_expires_at <= now()`).

**Effort:** S
**Priority:** P2
**Depends on:** None

### Link đã hết hạn nhưng chưa nộp vẫn ghi "Đang hoạt động"

**What:** Khi `status = active` và `expiresAt` đã qua, hiện "Đã hết hạn" (tính sau hydrate hoặc nhận giờ máy chủ) và không mời thu hồi.

**Why:** DB không bao giờ đặt trạng thái hết hạn; nhân viên tưởng link còn dùng được. Test wave-b đang ghim chữ "Đang hoạt động" cho link active có hạn trong quá khứ nên cần cập nhật test đó cùng lúc (cần duyệt).

**Context:** `coaching-public-link-panel.tsx` (`linkStatus`), `tests/components/coaching-forms-wave-b.test.tsx`.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Proxy cho mọi method đi qua `/coaching/form/*`

**What:** Giới hạn ngoại lệ public của `/coaching/form/*` ở GET/HEAD và POST server action của chính trang, như `/dev/*` đã làm.

**Why:** Có từ trước bước 11b: POST tới đường dẫn này gọi được server action mà không qua cổng email cho phép; action vẫn kiểm quyền DB nên chỉ ảnh hưởng tài khoản có quyền Coaching nhưng không thuộc danh sách cho phép.

**Context:** `src/proxy.ts:31`. Phát hiện ở adversarial bước 11b (ngoài phạm vi).

**Effort:** S
**Priority:** P2
**Depends on:** None

### Thông báo kết quả trong builder/link panel sau các trường hợp còn lại

**What:** Giữ xác nhận "Đã lưu bản nháp" qua lần chuyển trang sau lần lưu đầu; báo kết quả + trả focus sau "Thêm ghi chú"/"Đóng phiếu"; đặt lỗi thu hồi/sao chép gần nút; dùng ResultBanner cho dòng trạng thái của link panel (giữ đúng một role=status).

**Why:** Các finding a11y/UX được hoãn ở review bước 11b; hành vi hiện tại không mất dữ liệu.

**Context:** `coaching-form-builder.tsx`, `coaching-event-actions.tsx`, `coaching-public-link-panel.tsx`.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Rời trình soạn trong lúc đang lưu không được hỏi

**What:** Giữ leave guard khi đang lưu với lời thoại riêng cho biểu mẫu (biến thể "saving" hiện nói về phân quyền), hoặc khóa link quay lại khi đang lưu.

**Why:** Lưu thất bại sau khi đã rời trang thì lỗi không hiện ở đâu và thay đổi mất.

**Context:** `coaching-form-builder.tsx` (`useLeaveGuard(dirty && !pending)`), `src/features/settings/components/leave-guard.tsx`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Trang phiếu phụ huynh lúc chưa tải xong

**What:** Đặt dòng "Đang tải phiếu…" phía trên câu hỏi và làm mờ các ô bị khóa; thêm dòng dự phòng bằng CSS cho trình duyệt không chạy được bundle (iOS < 16.4, WebView cũ); sửa câu noscript.

**Why:** Trên điện thoại chậm, phụ huynh chạm ô đầu tiên không thấy gì xảy ra và lý do nằm dưới cuối form.

**Context:** `public-coaching-form.tsx`, `coaching-question-renderer.tsx`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Rút tên gọi học sinh với tên có ghi chú

**What:** `getStudentGivenName` bỏ phần trong ngoặc/sau gạch nối và trả null khi từ cuối không có chữ cái; dùng `nickname` nếu RPC trả.

**Why:** Tên nhập kèm ghi chú ("Nguyễn Văn An (2)", "… 6A1", "… - con chị Lan") sẽ hiện "(2)", "6A1" hoặc tên người khác.

**Context:** `public-coaching-form-shell.tsx:31`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Rút gọn lý do theo grapheme

**What:** Dùng `Intl.Segmenter` (grapheme, chuẩn hóa NFC) khi cắt lý do 80 ký tự.

**Why:** Cắt theo code point vẫn có thể tách cờ/emoji ZWJ hoặc dấu thanh tiếng Việt dạng tổ hợp.

**Context:** `coaching-presentation.ts` (`summarizeCoachingReason`).

**Effort:** S
**Priority:** P3
**Depends on:** None

### Vệ sinh test Coaching

**What:** Chạy các block giờ Việt Nam trong `tests/unit/coaching-presentation.test.ts` qua nhiều múi giờ; reset `vi.useRealTimers()`/`vi.unstubAllEnvs()` trong afterEach của `coaching-public-link-copy.test.tsx`; sửa header test route và docstring "cùng giá trị" (chỉ đúng trong một phút).

**Why:** Trên máy múi giờ +07 một hồi quy về giờ local vẫn qua test; test timeout dưới tải có thể để rò TZ/Date giả sang test sau.

**Context:** `tests/unit/coaching-presentation.test.ts`, `tests/components/coaching-public-link-copy.test.tsx`, `tests/components/public-coaching-form-route.test.tsx`, `coaching-presentation.ts:103`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Gọn mã Coaching (gợi ý của review)

**What:** Dùng `Field`/`Textarea` cho dialog sự kiện và các ô của link panel; map 4 ô thang điểm; dùng chung card với `CareCard`; dùng chung helper ngày giờ với student-care; một helper `settle()` cho các lời gọi action; ghi nhớ thẻ câu hỏi/câu hỏi công khai cho form 100 câu; nút 48px thay `h-12!`.

**Why:** Các gợi ý simplification/performance được hoãn; không ảnh hưởng hành vi.

**Context:** `coaching-event-actions.tsx`, `coaching-public-link-panel.tsx`, `coaching-form-builder.tsx`, `coaching-detail-page.tsx`, `coaching-presentation.ts`, `coaching-question-renderer.tsx`.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Test thứ tự sự kiện của RPC

**What:** Thêm test SQL (tests/database) khẳng định `get_coaching_record_events` trả theo `event_sequence` tăng dần.

**Why:** Dòng thời gian đảo thứ tự và suy ra trạng thái trước dựa vào thứ tự này; đổi thứ tự ở RPC sẽ không làm đỏ test UI nào.

**Context:** `coaching-presentation.ts` (`buildCoachingTimeline`), migration `20260802200000_coaching_event_ordering.sql`.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Chấm công

### Tổng giờ tháng tính cả giờ đề nghị của yêu cầu chờ duyệt hoặc bị từ chối

**What:** Sửa `get_my_monthly_timekeeping_entries` (và tổng giờ của `get_center_monthly_timekeeping_overview`) để `total_minutes` chỉ dùng giờ của yêu cầu điều chỉnh đã duyệt; sau đó KPI "Tổng giờ làm việc" và cột "Thời lượng" trên máy tính khớp với thẻ di động.

**Why:** RPC lấy yêu cầu xếp hạng cao nhất (duyệt > chờ > từ chối) bất kể trạng thái, nên tổng giờ cộng cả giờ chưa được duyệt hay đã bị từ chối. Bước 12 cho thẻ di động tính từ giờ in trên thẻ, nên trên cùng màn hình thẻ và KPI/bảng có thể lệch nhau. Lương dùng giờ đã duyệt, nên bảng công đang báo nhiều hơn số được trả.

**Context:** `supabase/migrations/20260915170000_*` (lateral `adj`, `coalesce(adj.requested_*)`), `src/features/timekeeping/components/my-monthly-timesheet-panel.tsx` (`totalMinutes` KPI, `TimesheetRow`, `minutesBetween`). Cần migration, chủ trung tâm duyệt. Test KPI "25.5" dùng `totalMinutes` của fixture.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Mã lỗi yêu cầu điều chỉnh không khớp SQL

**What:** Đồng bộ bảng thông báo lỗi trong `timekeeping-adjustment-actions.ts` với mã mà `request_time_entry_adjustment` thật sự raise (`TIME_ENTRY_ALREADY_HAS_APPROVED_ADJUSTMENT`, `..._WORK_DATE_INVALID`, `TIME_ENTRY_MUST_BE_CLOSED_FOR_ADJUSTMENT`, `TIME_ENTRY_NOT_AVAILABLE_FOR_ADJUSTMENT`, lỗi trùng chỉ mục yêu cầu chờ duyệt, `..._REASON_REQUIRED`, `..._TIME_RANGE_INVALID`, `..._CANNOT_USE_FUTURE_TIME`, `..._VALUES_INVALID`).

**Why:** Hầu hết lỗi rơi về câu chung "Không thể gửi yêu cầu điều chỉnh. Dữ liệu chưa được cập nhật.", kể cả khi gửi lại một yêu cầu đã được ghi nhận (lỗi trùng), nên nhân sự không biết phải làm gì.

**Context:** `supabase/migrations/20260729090000_*` (dòng 289–399) và chỉ mục `time_entry_adjustment_one_pending_request_idx`; file action là server action nên bước 12 (chỉ trình bày) không sửa.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Làm gọn cập nhật nền của bảng công tháng khác

**What:** Trong `my-monthly-timesheet-panel.tsx`: (1) cập nhật nền thành công thì xóa luôn cảnh báo "Không thể tải bảng công…" của lần chọn tháng trước và không chồng dòng "chưa mới nhất" lên danh sách rỗng; (2) vùng `role="status"` đang chứa chữ sr-only khi tải làm khung lưới dịch 16px mỗi lần đổi tháng: để vùng sr-only trừ khi có thông báo nhìn thấy; (3) nút "Tải lại" cần trạng thái đang tải, báo lại khi thất bại lần nữa và giữ con trỏ khi thành công; (4) cân nhắc chạy cập nhật nền bằng promise thường thay vì `startTransition` async (transition async làm các transition khác, kể cả `router.refresh()`, chờ fetch xong nên một thao tác vẫn tốn hai lần tải); khóa in-flight chỉ xóa khi đúng request; thêm test cho chốt thứ tự request; bỏ `mockResolvedValue` rò rỉ ở test thẻ (dòng ~459) và siết đuôi test in-flight.

**Why:** Review ràng buộc bước 12 (sau 3 vòng sửa) tìm thấy các điểm này; không sửa thêm vì đã chạm giới hạn vòng sửa. Tình huống chỉ xảy ra khi đang xem tháng khác tháng hiện tại.

**Context:** `refreshMonthInBackground`, `loadMonth`, effect snapshot theo `initialEntries`, `staleMonthNotice`; ghi chép `.gstack/ship-records/step12.md` mục "Binding pass". Bài học `async-transition-defers-refresh-snapshot`, `empty-sr-only-live-region-shift`.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Tấm "Ra ca" không mặc định theo hình thức của ca đang mở

**What:** Truyền `initialMode={entry.checkInMode}` cho tấm Ra ca của thẻ đang trong ca; quyết định với chủ trung tâm có cho ra ca "Trực tuyến" một ca vào "Tại trung tâm" hay không.

**Why:** Tấm Ra ca mở theo hình thức nhớ trong trình duyệt, và `check_out_time_entry` chỉ kiểm tra vị trí khi ra ca hình thức offline: một ca tại trung tâm có thể ra ca "Trực tuyến" ở bất kỳ đâu không cần GPS, trong khi thẻ ghi "Ra ca tại Trung tâm cần lấy lại vị trí". Lỗ hổng phía máy chủ có từ trước bước 12.

**Context:** `src/features/timekeeping/components/my-timekeeping-panel.tsx` (`OpenShiftCard`), `supabase/migrations/20260904010000_*` (`check_out_time_entry`, nhánh `normalized_mode = 'offline'`). Phát hiện của adversarial bước 12.

**Effort:** S (UI) / M (server)
**Priority:** P2
**Depends on:** Chủ trung tâm quyết định phần server

### Tên ca trước khi vào ca và số "Chờ xác minh" trong tháng

**What:** Thêm RPC `get_my_shift_today()` (security definer, chỉ ca của chính mình) để thẻ hiện "Ca chiều 17:00–21:30 · Theo lịch tuần" trước khi vào ca và báo trước quy tắc trực tuyến; gộp số ca chờ xác minh (từ `get_attendance_exception_reviews` lọc theo mình, hoặc RPC tháng trả cả ca chưa xác minh) vào phần tóm tắt tháng.

**Why:** Thiết kế 14a có tên ca và "Chờ xác minh n ca" nhưng trợ giảng không có quyền đọc phân công (`timekeeping.view`) và RPC tháng loại ca chưa xác minh; bước 12 bỏ hai phần này để không hiển thị dữ liệu không có thật.

**Context:** `M/20260916100000` (`resolve_staff_shift_for_checkin` revoke), `M/20260915170000:292` (`time_entry_is_verified`). Cần migration.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Nút chấm công trên thanh trên cùng thành nút chính thứ hai ở /timekeeping

**What:** Quyết định ẩn hoặc hạ nút "Chấm công" của thanh trên cùng khi đang ở `/timekeeping` (thẻ đã có "Vào ca" lớn).

**Why:** Trên trang thật, trợ giảng thấy hai nút màu chính mở cùng một tấm (quy tắc một nút chính mỗi trang); trong ca còn có hai chấm nhấp nháy. Trang xem trước `/dev/timekeeping` không có nút trên thanh nên không thấy.

**Context:** `src/components/layout/topbar.tsx`, `topbar-timekeeping-button.tsx`. Ngoài phạm vi bước 12 (hợp đồng thanh trên cùng).

**Effort:** S
**Priority:** P2
**Depends on:** Chủ trung tâm

### Test Coaching chập chờn khi chạy cả bộ lúc máy tải cao

**What:** Sửa các test chờ trạng thái thay vì đọc một lần: `coaching-form-builder.test.tsx` ("Tạo bản nháp phiên bản mới" bị từ chối, "Xuất bản" bị từ chối). Đã xong: `coaching-public-link-copy.test.tsx` (thu hồi dòng thứ hai, v0.26.0.5) và `dev-coaching-preview.test.tsx` (lưu và xuất bản bản nháp, b542c46).

**Why:** Khi tải máy cao các test này đôi khi đỏ (đã gặp 4 lần trong bước 12) dù chạy riêng luôn xanh. Bản sửa đã làm ở bước 12 bị gỡ khỏi nhánh vì nằm ngoài phạm vi và cần đo P(fail|regression) trước/sau.

**Context:** Commit e62b2c0 (đã revert ở 659f845) là điểm bắt đầu; chạy kèm phép thử ép lỗi để chứng minh test vẫn đỏ khi có lỗi thật. Nguyên nhân đã thấy ở bảng link: setState sau `await` trong `startTransition(async)` chạy ngoài transition nên kết quả hiện trước khi `pending` tắt, test bấm vào nút còn khóa; chờ nút `toBeEnabled()` rồi mới bấm. Tái hiện chắc chắn bằng cách mock `cn()` của `@/lib/utils` cho mỗi lần gọi chạy vòng lặp bận 1–6 ms.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Phần thiết kế 14 chưa có dữ liệu thật

**What:** Khi có dữ liệu: danh sách "Buổi học trong ca" (cần liên kết trợ giảng ↔ buổi học, chủ trung tâm đã hoãn mô hình giáo viên theo lớp); khoảng cách tới cơ sở trước khi vào ca (cần tọa độ cho `timekeeping.check` hoặc RPC xem trước; check-in hiện tính rồi bỏ khoảng cách); dòng "Ca đang mở chưa được tính vào lương tạm tính" (đúng, nhưng test cấm từ ngữ lương trên màn hình cá nhân — cần chủ trung tâm chọn cách nói).

**Why:** Bước 12 bỏ các phần này vì không có nguồn đúng sự thật.

**Context:** `.gstack/briefs/step12-map-rules-data.md` mục 4.

**Effort:** L
**Priority:** P3
**Depends on:** Chủ trung tâm

### Quy tắc chấm công không nhất quán ở máy chủ

**What:** Thống nhất giờ chốt của "Gửi chấm công chờ duyệt" (SQL dùng 23:30) với giờ chốt theo vai trò (22:30 trợ giảng, 22:45 vị trí khác); gỡ hoặc cập nhật mã theo dõi vị trí liên tục đã chết từ 2026-09-15 (`useAttendanceHeartbeat`, `AttendanceHeartbeatWatcher`, nhánh chữ "Vị trí được theo dõi liên tục trong ca").

**Why:** Thông báo lỗi nói 22:30/22:45 nhưng SQL ngoại lệ dùng 23:30; mã heartbeat không còn tác dụng nhưng vẫn có đường hiển thị chữ không đúng nếu cờ bật lại.

**Context:** `M/20260915170000:125,149`, `src/features/timekeeping/hooks/use-attendance-heartbeat.ts`, `timekeeping-staff-presentation.ts`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Thẻ đang trong ca để mở qua giờ chốt

**What:** Khi "Ra ca" trả lỗi không còn ca mở (ca đã tự kết thúc lúc 22:30/22:45) thì làm mới trang; làm mới khi quay lại tab (`visibilitychange`/`pageshow`); cân nhắc dừng đồng hồ sau giờ chốt.

**Why:** Điện thoại giữ trang từ chiều tới khuya vẫn hiện "Đang trong ca" và bấm "Ra ca" chỉ báo lỗi, không tự cập nhật.

**Context:** `timekeeping-entry-dialog.tsx` (chỉ `router.refresh()` khi thành công), `my-timekeeping-panel.tsx` (`ElapsedClock`).

**Effort:** S
**Priority:** P3
**Depends on:** None

### Hoàn thiện nhỏ màn chấm công cá nhân

**What:** Lời xác nhận "chờ duyệt" xóa khi lần chấm công sau thành công; tấm điều chỉnh của từng thẻ nằm trong khối `md:hidden` nên xoay ngang máy làm tấm biến mất (đưa Dialog ra `document.body`); câu quy tắc trực tuyến ghi rõ "từ 15 phút trước giờ bắt đầu tới 15 phút sau giờ kết thúc"; dòng Wi-Fi nhắc cả BSSID; ô chọn tháng bị khóa khi đang tải làm mất con trỏ; tiêu đề tấm "tự động kết thúc" và thẻ "tự kết thúc" nên cùng một cách nói; trùng câu mô tả trang cá nhân trong `timekeeping-page.tsx`; nhịp "Vào ca" lặp vô hạn (cân nhắc dừng sau vài lần); kích thước nút lớn dùng `!` thay vì size `xl` của Button; ô nhập 14px có thể làm iOS phóng to; test trang xem trước chờ hẹn giờ thật 500ms.

**Why:** Các điểm review bước 12 đánh giá P3, gom lại một chỗ.

**Context:** Ghi chép `.gstack/ship-records/step12.md` (các mục Skipped).

**Effort:** M
**Priority:** P3
**Depends on:** None

### Gợi ý gọn mã chấm công (review bước 12)

**What:** Radio gốc của trình duyệt thay cho radiogroup tự viết; gộp hai hook đồng hồ và hai keyframes nhịp; dùng chung hàm định dạng giờ HH:MM, thứ ngắn, thời lượng (`src/lib/datetime.ts`); tùy chọn tay cầm tấm đáy trong `ui/dialog.tsx` (đang lặp ở 3 nơi).

**Why:** Giảm trùng lặp; không ảnh hưởng hành vi.

**Context:** Phát hiện của chuyên gia đơn giản hóa và review chung bước 12.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Người vừa quản lý vừa chấm công vẫn thấy bố cục cũ

**What:** Ở bước 16 (thiết kế 18, chấm công quản lý), đưa thẻ chấm công cá nhân lên đầu cho người có cả quyền xem/quản lý, và chuyển bảng công máy tính sang token mới.

**Why:** Bước 12 chỉ đổi bố cục cho người chỉ có quyền chấm công; bảng máy tính còn màu Tailwind thô (amber/emerald).

**Context:** `src/features/timekeeping/timekeeping-page.tsx` (`isStaffOnly`), `my-monthly-timesheet-panel.tsx` (`TimesheetRow`).

**Effort:** M
**Priority:** P3
**Depends on:** Bước 16

## Phiếu học phí

### Mã QR trên phiếu đã thanh toán hoặc thanh toán một phần

**What:** Khi in lại phiếu (lẻ hoặc cả khối), phiếu có yêu cầu đã thanh toán hoặc thanh toán một phần không in mã QR đủ số tiền nữa: ẩn QR và đóng dấu "ĐÃ THANH TOÁN", hoặc in số còn lại. Cần anh quyết.

**Why:** Phụ huynh đã trả nhận lại QR đủ tiền và có thể chuyển lần hai; SePay chỉ tự khớp yêu cầu đang chờ nên khoản thứ hai rơi vào hàng đợi thủ công và phải hoàn tiền.

**Context:** `resolvePayment` trong `src/features/tuition/fee-notice-model.ts` chỉ dựa vào snapshot; `loadFeeNotices` (`fee-notice-data.ts`) chưa đọc `student_payment_requests.status` (RLS cần payments.view, như `canReadTuitionPayments`). Có từ trước bước 13.

**Effort:** M
**Priority:** P2
**Depends on:** Quyết định của anh

### In hàng loạt gửi toàn bộ mã phiếu trên URL

**What:** Mở tab in bằng `periodId` + khối (và danh sách chọn riêng nếu có) rồi đọc phiếu ở máy chủ, thay vì ghép mọi id vào `?itemIds=`.

**Why:** Mỗi id tốn khoảng 39 ký tự; kỳ trên khoảng 360 phiếu vượt giới hạn URL/header (414/431) khi bấm "In đã chọn / cả khối" mà chưa chọn gì.

**Context:** `TuitionBulkPrintControls` (`print-controls.tsx`), route `src/app/(app)/finance/tuition-periods/print/page.tsx`, `parseFeeNoticeItemIds` (chưa giới hạn số id).

**Effort:** M
**Priority:** P2
**Depends on:** None

### Đối chiếu chi tiết buổi với tổng tiền trên phiếu

**What:** Chỉ in "12 buổi × 200.000 ₫ · …" khi Σ buổi × đơn giá đúng bằng số tiền phải nộp; nếu không thì in tổng số buổi. Kiểm tra `max_rows` PostgREST trên production ≥ 1000.

**Why:** `fetchPaged` dừng khi một trang trả ít hơn 1000 dòng; nếu production giới hạn thấp hơn, chi tiết buổi bị cắt mà không báo lỗi. Cùng giả định đó bảo vệ việc đọc phiếu thay thế.

**Context:** `buildFeeNoticeModel` (`fee-notice-model.ts`), `fetchPaged`/`fetchChunked` trong `src/features/classes/detail/class-detail-data.ts`. Một lần đọc dòng lỗi hiện cũng làm mất chi tiết của cả lô in.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Làm mới trang phiếu sau khi phát hành lại

**What:** Gọi `router.refresh()` khi phát hành lại thành công trong `TuitionReissueForm`.

**Why:** Trang phiếu chuyển sang "đã được thay thế" chỉ nhờ Next 16 tự render lại trang hiện tại sau `revalidatePath("/finance/tuition-periods")`; tài liệu Next gọi hành vi này là tạm thời. Nếu đổi, phiếu gốc vẫn hiện như hiện hành và in được với QR đã hủy.

**Context:** `src/features/tuition/reissue-form.tsx`; action `reissueTuitionItemAction` (không sửa trong bước giao diện).

**Effort:** S
**Priority:** P2
**Depends on:** None

### Quyền in phiếu lẻ và in hàng loạt khác nhau

**What:** Quyết định nút "In phiếu" trên trang một phiếu có cần `tuition_periods.export` như in hàng loạt không. Cần anh quyết.

**Why:** Người chỉ có quyền xem kỳ thu in được từng phiếu có QR, trong khi in hàng loạt yêu cầu quyền xuất.

**Context:** `FeeNoticeDetailScreen` (`fee-notice-screens.tsx`), route notice và print.

**Effort:** S
**Priority:** P2
**Depends on:** Quyết định của anh

### Mã chuyển khoản gửi tới vietqr.app

**What:** Tự tạo ảnh QR (thư viện QR trong ứng dụng hoặc route máy chủ) thay vì tải từ `vietqr.app/img?...&des=<mã chuyển khoản>`. Cần anh quyết.

**Why:** Mã chuyển khoản chứa họ tên học sinh, năm sinh và số điện thoại phụ huynh; in hàng loạt gửi cả khối tới dịch vụ bên ngoài. Có từ trước bước 13.

**Context:** `buildLockedVietQrPaymentDetails` trong `src/features/finance/vietqr.ts`.

**Effort:** M
**Priority:** P2
**Depends on:** Quyết định của anh

### "Phải thu" chính xác cho học sinh nợ buổi đầu kỳ

**What:** Với người có quyền xem thanh toán, đọc số buổi đang nằm ở phiếu chờ thanh toán của kỳ khác để tính đúng phần nợ mang sang, bỏ nhãn "tối đa".

**Why:** Lúc khóa, phần nợ được trừ đi số buổi đã có trên phiếu kỳ khác còn chờ thanh toán; bảng chuẩn bị hiện chỉ biết cận trên.

**Context:** `computeLockFigures` (`readiness-students.ts`); công thức ở `lock_tuition_collection_period` (migration 20261012130100, dòng 152–160).

**Effort:** M
**Priority:** P3
**Depends on:** None

### Cách ghi số dư âm và phiếu đã thay thế trên giấy

**What:** Ghi rõ phần nợ đầu kỳ đã tính ở phiếu này hay ở phiếu kỳ khác (thay cho "−3 buổi (nợ)"), và quyết định phiếu đã được thay thế có còn in số tiền + hạn thanh toán không. Cần anh quyết cách ghi.

**Why:** Phụ huynh có thể hiểu nợ đã gộp vào phiếu này rồi bỏ qua phiếu cũ còn phải trả; phiếu đã thay thế in ra vẫn có số tiền nổi bật.

**Context:** `formatFeeNoticeBalance` (`fee-notice-model.ts`), `fee-notice-a5.tsx`.

**Effort:** S
**Priority:** P3
**Depends on:** Quyết định của anh

### Báo trước các phiếu thiếu mã QR khi in hàng loạt

**What:** Thanh công cụ trang in đếm và liệt kê phiếu không có QR (thiếu thông tin chuyển khoản, số tiền lệch); cảnh báo "Vẫn in" nêu phiếu nào chưa tải được QR.

**Why:** Những phiếu đó in ra chỉ có dòng "liên hệ trung tâm", và nhân viên dễ quen bấm "Vẫn in".

**Context:** `FeeNoticePrintScreen` (`fee-notice-screens.tsx`), `TuitionPrintButton` (`print-button.tsx`).

**Effort:** S
**Priority:** P3
**Depends on:** None

### Lời giải thích khi số tiền QR không khớp

**What:** Thêm lý do vào trạng thái "unavailable" (thiếu hợp đồng / số tiền lệch / trạng thái không chờ thanh toán) để nhãn "Loại phiếu" và dòng cho nhân viên nói đúng nguyên nhân; cập nhật chú thích quy tắc QR và câu "Mã QR VietQR luôn in trên phiếu cần thanh toán." ở trang mẫu.

**Why:** Sau khi đối chiếu số tiền, phiếu lệch số tiền bị ghi là "snapshot không đầy đủ"; chú thích đầu file còn liệt kê quy tắc cũ.

**Context:** `fee-notice-model.ts` (docstring và `getFeeNoticeKindLabel`), `fee-notice-a5.tsx`, `template-management.tsx`, đầu `tests/unit/fee-notice-model.test.ts`. RPC hiện không tạo ra số tiền lệch.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Bảng chuẩn bị: hiệu năng và bố cục

**What:** Chỉ dựng bảng hoặc thẻ đang hiện (hai bố cục đang cùng render), cân nhắc chia trang khi trên khoảng 200 học sinh; đổi cỡ nút theo container thay vì viewport (máy tính bảng 768–1080px); thẻ hồ sơ mở tab mới như bảng; hiện trạng thái đang tải trong khung khi "Tải lại xem trước".

**Why:** 300–500 học sinh tạo gấp đôi DOM; ở máy tính bảng các thẻ có ô chọn 44px nhưng nút xung quanh 32px; chạm nhầm vào thẻ làm mất đơn giá đang gõ.

**Context:** `src/features/tuition/tuition-readiness-table.tsx`, `RecordListItem` (`responsive-record-list.tsx`, chưa có `target`).

**Effort:** M
**Priority:** P3
**Depends on:** None

### Xem trước kỳ thu đọc theo trang có thể trùng hoặc thiếu dòng

**What:** Bỏ trùng theo `classSessionId` cho từng học sinh khi gom dòng xem trước; ghi chú lớp đầu tiên có thể khác lớp in trên phiếu khi hai buổi đầu cùng ngày.

**Why:** `getTuitionPeriodPreview` chạy lại cả hàm xem trước cho mỗi trang 500 dòng; một thay đổi giữa hai trang làm số buổi và "Phải thu" lệch dù được ghi là chính xác.

**Context:** `buildReadinessStudents` (`readiness-students.ts`), `data.ts`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Hiện "Chưa có phụ huynh chính" ngay cả khi học sinh còn thiếu đơn giá hoặc nguồn

**What:** Đọc `student_guardians` (người có quyền) để báo thiếu phụ huynh chính sớm, thay vì đợi bổ sung đơn giá và nguồn xong.

**Why:** Hàm xem trước chỉ trả một mã blocker mỗi dòng theo thứ tự ưu tiên, nên lỗi phụ huynh lộ ra muộn.

**Context:** `preview_tuition_collection_period` (CASE thứ tự), ghi chú dưới bảng chuẩn bị.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Mẫu phiếu: xuất bản cùng lúc và phiếu dài hơn một trang A5

**What:** Cảnh báo khi phiên bản mới nhất sau khi xuất bản khác phiên bản dự kiến (có người khác vừa xuất bản); báo trong xem trước khi nội dung làm phiếu sang trang A5 thứ hai; bật lại tùy chọn hiện QR nếu anh muốn (cần đổi server action).

**Why:** RPC đánh số phiên bản không kiểm tra phiên bản dự kiến nên có thể ghi đè thay đổi của người khác; thông báo 1000 ký tự + chân trang 300 ký tự đẩy phiếu sang trang thứ hai.

**Context:** `template-management.tsx`, `TEMPLATE_FIELD_LIMITS` (`receipt-template-models.ts`), `publishTuitionTemplateAction`.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Dọn phần dùng chung sau bước 13

**What:** Gom helper ghi lỗi đọc dữ liệu (`settled`/`logReadFailure` ở các loader tuition), chuyển `fetchPaged`/`fetchChunked` sang module chung; thêm lựa chọn tự đưa con trỏ tới `ResultBanner` và kiểu liên kết trong banner; thêm lựa chọn xuống dòng cho `Badge`/`TableHeaderCell` (thay `whitespace-normal!`); căn phải lý do khi nút bị khóa trong `Button`; sửa chữ `text-action-primary` trên nền soft ở giao diện tối (chip, BulkActionBar); thống nhất cỡ số KPI (28px hiện tại so với 20px trong thiết kế 15a và 7b).

**Why:** Các đoạn giống nhau đang lặp ở nhiều file; vài lớp `!` phụ thuộc tên lớp nội bộ của component gốc.

**Context:** `src/features/tuition/{readiness-data,receipt-template-data,fee-notice-data,period-summary-data}.ts`, `src/components/shared/result-banner.tsx`, `src/components/ui/{badge,button}.tsx`, `src/components/patterns/{quick-filter-chips,bulk-action-bar}.tsx`.

**Effort:** M
**Priority:** P3
**Depends on:** None

## Danh sách theo lô

### Ai mở được trang Buổi học

**What:** Kiểm tra trên production xem trợ giảng có mở được `/sessions` không. Loader nối bảng `classes`, mà theo migration thì chỉ chủ trung tâm có `classes.view`. Nếu dòng của trợ giảng bị rơi mất thì cần một view hoặc RPC đọc buổi học không đòi `classes.view`. Cần anh quyết.

**Why:** Trợ giảng là người điểm danh. Nếu danh sách trống với họ, chip "Chưa điểm danh" và nút "Điểm danh" không tới được người cần dùng.

**Context:** `getSessionDirectory` trong `src/features/sessions/data.ts` (join `classes!class_sessions_class_id_fkey`); bản đồ quyền ở `.gstack/briefs/step14a-map-rules-data.md`. Review bước 14a: RLS `classes_select_authorized` trả embed lớp rỗng cho người không có `classes.view`, loader coi cả danh sách là `invalid_response` nên trang hiện "Không tải được danh sách buổi học"; nhánh `canViewClasses=false` (tên lớp không có link) vì vậy chưa bao giờ chạy trên production, còn bản xem trước `/dev/lists?view=sessions&role=ta` lại hiện danh sách bình thường. Có từ trước bước 14a.

**Effort:** S (kiểm tra) / M (sửa)
**Priority:** P2
**Depends on:** Quyết định của anh

### Đếm điểm danh và kết quả bằng một RPC tổng hợp

**What:** Thay việc tải từng dòng `session_attendance` và `session_results` (chia 150 id, phân trang 1000) bằng một RPC `SECURITY INVOKER` nhận danh sách id buổi và trả về số đếm theo buổi (tất cả, đã điểm danh trong danh sách, được nhận kết quả, số kết quả).

**Why:** Mỗi lần mở `/sessions` với 300 buổi đang tải khoảng 7.500 dòng điểm danh và 6.000 dòng kết quả (gần 1 MB JSON, khoảng 14 yêu cầu) chỉ để ra 300 bộ số; xuất CSV đi cùng đường này với tới 1.000 buổi. Bước 14a không được đổi RPC nên giữ cách đọc từng dòng (đã chạy song song hai bảng).

**Context:** `getSessionDirectory` trong `src/features/sessions/data.ts`; index `(class_session_id, attendance_status)` đã có. Cùng lúc có thể gom việc đếm chip trên client thành một vòng (`countSessionQuickFilters` đang lọc lại 7 lần mỗi lần gõ tìm kiếm).

**Effort:** M
**Priority:** P3
**Depends on:** None

### Đồng hồ của trang Buổi học dừng ở lúc tải

**What:** Cho `today`/`nowTime` của `/sessions` chạy tiếp trên trình duyệt sau khi tải (lấy mốc từ server, cập nhật theo phút hoặc khi quay lại tab), hoặc làm mới dữ liệu khi sang ngày mới.

**Why:** Mọi thao tác lọc chỉ ghi URL qua History API nên không gọi lại server: để tab mở qua giờ kết thúc buổi thì buổi đó không chuyển sang "Chưa bắt đầu"/"Chưa hoàn thành", qua nửa đêm thì chip "Hôm nay"/"Tuần này" vẫn ghi ngày cũ.

**Context:** `src/app/(app)/sessions/page.tsx` (truyền `today`, `nowTime`), `src/features/sessions/session-list-page.tsx`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Mẫu số điểm danh cho buổi đang diễn ra và buổi ngoài hàng đợi khóa

**What:** Hiện `x/y` cho mọi buổi đã bắt đầu, lấy sĩ số theo từng buổi, thay cho "x đã ghi" ở buổi đang diễn ra và buổi đã hoàn thành nhưng không có trong hàng đợi khóa.

**Why:** Hiện chỉ buổi đã khóa và buổi trong hàng đợi (RPC `get_unlocked_completed_sessions`) có sĩ số đúng quy tắc khóa; đoán mẫu số từ số dòng điểm danh sẽ sai khi có học sinh học thêm.

**Context:** `getSessionAttendanceCell` trong `src/features/sessions/session-directory-models.ts`. Cần RPC trả `roster_count` theo danh sách id buổi (cùng công thức khóa) thay vì gọi từng buổi.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Thao tác hàng loạt trên danh sách Buổi học

**What:** Chọn nhiều buổi để đổi phòng hoặc hủy buổi ở nhiều lớp (thiết kế 16b), kèm hộp thoại nêu hậu quả.

**Why:** Hiện chỉ có hủy hàng loạt trong trang một lớp (`cancelClassSessionsAction`, theo lớp). Bước 14a không có checkbox vì chưa có action xuyên lớp.

**Context:** `src/features/sessions/session-list-page.tsx` (D9 trong `.gstack/briefs/step14a-brief.md`). Cần action mới, kiểm quyền `sessions.manage`, ghi audit.

**Effort:** L
**Priority:** P3
**Depends on:** Quyết định của anh

### Liên kết thẳng tới tab của trang buổi học

**What:** Các nút "Khóa", "Điểm danh" (`/sessions`), "Mở buổi" (`/learning-results`) và "Mở kết quả buổi" (`/grading-credits`) mở đúng khu vực khóa, điểm danh hoặc kết quả, thay vì đầu trang buổi học.

**Why:** Người dùng bấm "Khóa" phải tự cuộn tới khu vực khóa; tên nút hứa nhiều hơn chỗ nó dẫn tới.

**Context:** Trang `/sessions/[sessionId]` chưa đọc tham số tab hay neo; cần thêm neo hoặc `?tab=` ở `src/features/sessions/session-detail-page.tsx`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Tổng chính xác ngoài số dòng đã tải

**What:** Đếm đúng tổng ở ba danh sách khi dữ liệu vượt giới hạn tải: số buổi theo chip (`/sessions`, cửa sổ 300 buổi), số kết quả (`/learning-results`, 500 dòng), tổng tín chỉ theo tháng và người chấm (`/grading-credits`, 500 tín chỉ mới nhất, hiện ghi "ít nhất N").

**Why:** Các con số hiện chỉ đếm trên dòng đã tải và trang đã nói rõ điều đó; muốn số đủ cần head count hoặc đọc phân trang theo RLS.

**Context:** `SESSION_DIRECTORY_WINDOW_LIMIT`, `LEARNING_RESULTS_LIMIT`, `GRADING_CREDITS_LIMIT`; `summarizeCreditTotal` trong `src/features/grading-credits/grading-credit-models.ts`.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Bộ lọc Kết quả học tập và Tín chỉ chấm bài lên URL

**What:** Đưa bộ lọc, chip và trang của `/learning-results` và `/grading-credits` lên URL (History API như `/sessions`), để trang chủ và các trang khác liên kết thẳng tới, ví dụ "Chưa có điểm" của một lớp.

**Why:** Hai trang đang giữ bộ lọc trong state của trình duyệt; tải lại hoặc chia sẻ link là mất bộ lọc.

**Context:** `src/features/learning-results/learning-results-page.tsx`, `src/features/grading-credits/grading-credit-list-page.tsx`; mẫu ở `src/features/sessions/session-directory-url-state.ts`.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Cột còn thiếu so với thiết kế 16a

**What:** Thêm giờ, loại và phòng của buổi vào `/learning-results`, khối và cấp lớp vào `/grading-credits`, và trạng thái "miễn" cho điểm nếu anh muốn có.

**Why:** Các RPC hiện không trả các trường này nên bước 14a bỏ chúng (bỏ hẳn lựa chọn "Miễn" ở bộ lọc tình trạng điểm).

**Context:** `src/features/learning-results/data.ts`, `src/features/grading-credits/data.ts` (`get_grading_credits_dashboard`). "Miễn" cần quy tắc nghiệp vụ mới.

**Effort:** M
**Priority:** P4
**Depends on:** Quyết định của anh (trạng thái miễn)

### Bảng chuyển sang thẻ ở màn hình laptop 1280px

**What:** Thu hẹp bảng `/sessions` (min 1108px) và `/learning-results` (min 1060px), hoặc cho cuộn ngang, để laptop 1280px vẫn thấy bảng thay vì thẻ.

**Why:** Vùng làm việc ở 1280px chỉ khoảng 990px nên hai trang hiện thẻ; ngưỡng 1120px của `/sessions` có từ trước bước 14a.

**Context:** `.sessions-*` trong `src/app/globals.css`, `@min-[1072px]` trong `src/features/learning-results/learning-results-page.tsx`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Lọc trạng thái và khóa ngay ở máy chủ cho "Chờ khóa" và "Chưa điểm danh"

**What:** Khi `/sessions` mở ở chip "Chờ khóa" (`status=completed&lock=unlocked`) hoặc "Chưa điểm danh" (`attendance=missing`), lọc `status`/`locked_at is null` ngay trong truy vấn (không chỉ lọc trên trình duyệt), ghi bộ lọc đó vào `loadedRange` để các chip khác biết phải tải lại.

**Why:** Hai chip này giờ đọc tới hôm nay, nhưng vẫn là 300 buổi mới nhất mọi trạng thái; buổi cũ chưa khóa còn thiếu điểm danh (loại không bao giờ tự khóa) có thể nằm ngoài cửa sổ, nên danh sách mà khung hàng đợi và Trang chủ dẫn tới thiếu đúng các buổi cần xử lý. Review adversarial bước 14a (Medium).

**Context:** `src/app/(app)/sessions/page.tsx`, `getSessionDirectory` trong `src/features/sessions/data.ts`, `getSessionWindowNotice` / `isSessionQuickFilterCountComplete` trong `session-directory-models.ts`.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Đo chi phí RPC hàng đợi khóa trên dữ liệu thật

**What:** Chạy `EXPLAIN ANALYZE` cho `get_unlocked_completed_sessions` trên production; nếu chậm, gom `resolve_class_session_rosters` thành một lần cho cả danh sách buổi.

**Why:** RPC gọi hàm sĩ số (SECURITY DEFINER, không inline được) cho từng buổi và lần nữa trong `EXISTS` cho từng dòng điểm danh; `/sessions` và Trang chủ chờ RPC này mỗi lần tải. Chi phí tăng theo số buổi tồn đọng chứ không theo `p_limit`.

**Context:** `supabase/migrations/20261013090000_phase2a_session_reschedule_and_lock_queue.sql`, `src/features/sessions/unlocked-sessions-data.ts`.

**Effort:** S (đo) / M (sửa)
**Priority:** P3
**Depends on:** None

### Số đếm của danh sách buổi học khi đang có người điểm danh

**What:** Đọc dòng điểm danh/kết quả theo keyset (`gt("id", last)`) thay vì offset, và đánh dấu tỷ lệ Kết quả là chưa đầy đủ khi số kết quả vượt số học sinh được nhận kết quả (dòng chỉ có nhận xét, học sinh vắng có kết quả).

**Why:** Phân trang offset trên id ngẫu nhiên có thể đếm trùng hoặc bỏ sót khi có người điểm danh đúng lúc tải; tỷ lệ "26/25" hoặc "3/0" hiện như số chính xác.

**Context:** `getSessionDirectory` (`src/features/sessions/data.ts`), `getSessionResultCell` (`session-directory-models.ts`).

**Effort:** S
**Priority:** P3
**Depends on:** None

### Thông báo "chưa tải đủ" sai khi xóa ô Đến ngày

**What:** Một hàm dùng chung cho "ngày kết thúc thực tế" của chip Chờ khóa / Chưa điểm danh (không có ngày nghĩa là tới hôm nay), dùng ở cả route (điều kiện chuyển hướng) và ở trang (khi kiểm tra cửa sổ đã tải).

**Why:** Đang ở chip đã giới hạn tới hôm nay mà xóa ô "Đến ngày" thì trang báo "chưa được tải đủ" dù tập đó đã đủ; bấm "Tải lại danh sách" thì máy chủ thêm lại `to=hôm nay` và ngày vừa xóa quay lại.

**Context:** `src/features/sessions/session-list-page.tsx` (`getSessionWindowNotice`), `src/app/(app)/sessions/page.tsx` (redirect).

**Effort:** S
**Priority:** P3
**Depends on:** None

### Dọn sau bước 14a

**What:** Sửa các ghi chú và tên test còn nói link thông báo hằng ngày đi qua ánh xạ chip trên trình duyệt (giờ route đã chuyển hướng); giữ tham số lặp khi chuyển hướng URL không có ngày; thêm test chuyển hướng cho chữ có dấu, `page`, `class` và thứ tự kiểm quyền; chặn năm `0000` trong ngày lọc; báo cửa sổ 500 kết quả cả khi lọc lớp/khối cũ hơn phần đã tải; buổi khóa trước khi bắt buộc đủ điểm danh không nên hiện y/y; đổi tên `SessionDirectoryClock` (đang chứa cả hàng đợi khóa); cân nhắc đọc danh sách và hàng đợi cùng một thời điểm.

**Why:** Các điểm nhỏ còn lại từ review bước 14a (INFO/Low); không cái nào chặn việc phát hành.

**Context:** `session-directory-models.ts`, `session-directory-url-state.ts`, `src/app/(app)/sessions/page.tsx`, `tests/components/sessions-route.test.tsx`, `src/features/learning-results/learning-result-models.ts`.

**Effort:** M
**Priority:** P4
**Depends on:** None

### Tổng tiền theo kỳ trên Tạm ứng và theo tháng trên Hoa hồng

**What:** Hiện tổng tiền trên đầu `/advances` (thiết kế 16c: "tổng 14.000.000 ₫", nên là "Khấu trừ kỳ MM/YYYY: X ₫ (đã duyệt + đã trừ)") và tổng doanh thu đủ điều kiện theo tháng trên `/commissions`, bằng số do máy chủ tính.

**Why:** Bước 14b chỉ hiện số đơn/số bản ghi. Test của hai trang cấm cộng tiền trên trình duyệt (bảng lương mới là nơi tính khấu trừ; chưa có khoản hoa hồng nào), và danh sách hoa hồng chỉ tải 500 bản ghi mới nhất nên tổng tháng cũ có thể thiếu.

**Context:** `src/features/advances/advance-list-page.tsx`, `src/features/commissions/commission-list-page.tsx` (test nguồn cấm `.reduce(`); RPC `get_salary_advances_dashboard`, `get_sales_commission_accruals_dashboard`. Cần RPC tổng hợp hoặc trường tổng trong RPC hiện có.

**Effort:** M
**Priority:** P3
**Depends on:** Quyết định của anh (có muốn hiện tổng tiền không)

### Lương tạm tính trong hộp thoại đối soát tạm ứng

**What:** Hiện "Lương tạm tính đến hôm nay" của nhân sự trong hộp thoại Đối soát/Phê duyệt tạm ứng (thiết kế 16c), cho người có quyền `advances.review`.

**Why:** `get_staff_payroll_estimate` cần `payroll.dashboard.view` (chỉ chủ trung tâm có), nên kế toán không đọc được; hệ thống cũng không có số "dự kiến cả tháng". Bước 14b bỏ dòng này và không nhắc quy tắc 50% (hệ thống không có quy tắc đó).

**Context:** `src/features/advances/components/salary-advance-decision-dialog.tsx`; `supabase/migrations/20261010100000_payroll_daily_estimate_breakdown.sql`; route `src/app/api/payroll/staff-estimate/route.ts`. Cần quyết định ai được xem lương tạm tính của người khác, có thêm trần tạm ứng không.

**Effort:** M
**Priority:** P3
**Depends on:** Quyết định của anh

### Cột "Giao dịch nguồn" trên Hoa hồng

**What:** Thêm cột "Giao dịch nguồn" (thiết kế 16a) trên `/commissions`, mở được giao dịch tiền về đã tạo bản ghi.

**Why:** Hàng chỉ có `source_cashflow_record_id` (uuid); không có trang nào mở một bản ghi dòng tiền, và mã tham chiếu chỉ đọc được với `finance.view`/`cashflow.view`. Bước 14b bỏ cột thay vì in uuid vô nghĩa.

**Context:** `src/features/commissions/read-models.ts` (`sourceCashflowRecordId`), RPC `get_sales_commission_accruals_dashboard` (`supabase/migrations/20261012160000_commission_recognized_on_bank_date.sql`).

**Effort:** M
**Priority:** P4
**Depends on:** Trang chi tiết giao dịch hoặc mã tham chiếu đọc được trong phạm vi hoa hồng

### Cột "Đăng nhập gần nhất" trên Nhân sự

**What:** Ghi lại thời điểm đăng nhập để `/staff` hiện cột "Đăng nhập gần nhất" (thiết kế 16a).

**Why:** `profiles.last_login_at` có cột nhưng không có gì ghi vào, nên trước đây mọi dòng đều "Chưa ghi nhận"; `auth.users.last_sign_in_at` chỉ đọc được bằng service role. Bước 14b bỏ cột.

**Context:** `src/features/staff/data.ts`, `docs/backend/RBAC_MODEL.md`. Cần hook đăng nhập ghi `last_login_at` hoặc RPC security definer chỉ trả thời điểm đăng nhập.

**Effort:** S
**Priority:** P4
**Depends on:** None

### Giới hạn và phân trang ở RPC Tạm ứng

**What:** Cho `get_salary_advances_dashboard` nhận giới hạn/phân trang và trả cờ "còn nữa", thay vì trả hết.

**Why:** RPC không có `limit`; PostgREST cắt ở 1.000 dòng mà không báo. Bước 14b chỉ ghi "có thể chưa đủ" khi đúng 1.000 dòng.

**Context:** `supabase/migrations/20260729110000_salary_advances_foundation.sql` (`get_salary_advances_dashboard`), `src/features/advances/data.ts`.

**Effort:** S
**Priority:** P4
**Depends on:** None

### Bộ lọc Tạm ứng, Nhân sự, Hoa hồng lên URL

**What:** Đưa chip và bộ lọc của `/advances`, `/staff`, `/commissions` lên URL (History API như `/sessions`), ví dụ để trang chủ mở thẳng "Cần xử lý".

**Why:** Bước 14b giữ bộ lọc trong state vì test của ba trang chỉ mock `useRouter`; tải lại là mất bộ lọc.

**Context:** `src/features/advances/advance-directory-models.ts`, `src/features/staff/staff-directory-models.ts`, `src/features/commissions/commission-directory-models.ts`; mẫu `src/features/sessions/session-directory-url-state.ts`. Phải sửa mock `next/navigation` trong test có chủ ý.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Dọn sau bước 14b

**What:** Ghi lại lựa chọn lọc đã rơi về "Tất cả" vào state (để lần tải lại sau không tự bật lại bộ lọc cũ) ở `/advances`, `/staff`, `/commissions`; thêm test phía `/payroll` cho anchor `payroll-period-{id}` mà link "Kỳ lương" dùng; bỏ `lastLoginAt` khỏi `StaffDirectoryMember` nếu không làm mục "Đăng nhập gần nhất"; giữ dòng nhân sự vừa thu hồi vai trò trong danh sách (hoặc báo ở đầu trang) khi đang lọc theo đúng vai trò đó, vì hiện dòng biến mất cùng thông báo thành công; chuẩn hóa từ khóa tìm kiếm một lần cho mỗi dòng (useMemo) ở `/advances` và `/staff`; chỉ hiện "Kỳ lương" cho người xem được bảng lương kỳ đó (có `payroll.manage`/`accountant_reconcile`/`owner_approve` hoặc là đơn của chính mình).

**Why:** Các điểm nhỏ còn lại từ review bước 14b (INFO); không cái nào chặn phát hành.

**Context:** `resolveAdvanceFilters`/`resolveStaffDirectoryFilters`/`resolveCommissionFilters`, `src/features/advances/advance-directory-models.ts` (`getPayrollPeriodHref`), `src/features/payroll/payroll-page.tsx`, `src/features/staff/data.ts`, `src/features/staff/staff-directory-page.tsx`.

**Effort:** S
**Priority:** P4
**Depends on:** None

### Đơn tạm ứng của chủ trung tâm khi chỉ có một chủ

**What:** Quyết định ai duyệt đơn tạm ứng của chính chủ trung tâm khi trung tâm chỉ có một người giữ `advances.owner_approve`: cấp quyền này cho một vai trò tin cậy trong ma trận phân quyền ở Cài đặt (đã làm được, không cần code), hay thêm một quy tắc riêng cho đơn của chủ.

**Why:** RPC cấm tự duyệt (`SALARY_ADVANCE_SELF_DECISION_FORBIDDEN`) và mặc định chỉ vai trò chủ trung tâm có `advances.owner_approve`, nên đơn của chủ sau bước đối soát nằm ở "Chờ phê duyệt" cho tới khi có người khác giữ quyền phê duyệt. Bước 14b chỉ ghi đúng tình trạng ("Đơn của bạn · cần người khác phê duyệt").

**Context:** `supabase/migrations/20261012120100_salary_advance_no_self_decision.sql`, `supabase/migrations/20260729110000_salary_advances_foundation.sql` (cấp quyền), `src/features/advances/advance-directory-models.ts`.

**Effort:** S
**Priority:** P3
**Depends on:** Quyết định của anh

### Một người vừa đối soát vừa phê duyệt cùng đơn tạm ứng

**What:** Quyết định có bắt buộc người phê duyệt khác người đối soát không. Nếu có, thêm điều kiện `approved_by <> reviewed_by` trong `approve_salary_advance` và trả id người đối soát cho giao diện để ẩn nút.

**Why:** Chủ trung tâm giữ cả `advances.review` và `advances.owner_approve`, nên có thể đối soát rồi tự phê duyệt cùng một đơn (RPC chỉ cấm duyệt đơn của chính mình). Từ bước 14b, chip "Cần xử lý" gộp cả hai bước cho chủ, nên việc này dễ xảy ra hơn; dòng "Quy tắc" trong hộp thoại lại mô tả hai người khác nhau.

**Context:** `supabase/migrations/20261012120100_salary_advance_no_self_decision.sql` (`approve_salary_advance`), `src/features/advances/advance-directory-models.ts` (`getAdvanceDecisionStage`, `buildAdvanceChips`), `src/features/advances/components/salary-advance-decision-dialog.tsx` (`DECISION_RULES`). Review đối kháng bước 14b, F1.

**Effort:** S
**Priority:** P2
**Depends on:** Quyết định của anh

### Hộp thoại xét duyệt tạm ứng khi danh sách tải lại

**What:** Gắn `key` theo `id:stage` cho `SalaryAdvanceDecisionDialog` và giữ hộp thoại đang mở ở cấp trang; bỏ cờ chuyển focus sang thông báo khi focus vẫn ở nút; thêm test nhánh "Từ chối" ở bước phê duyệt chuyển đúng thông báo của action lên trang; ghi log lỗi RPC trong `commissions/data.ts`; chỉ gửi xuống trình duyệt các trường trang thật sự dùng (staff, commissions, advances); ghi rõ "chỉ trừ cho nhân sự có phiếu lương trong lần tính" ở thông báo duyệt; báo "có thể chưa đủ" ở "Đơn khác cùng kỳ" khi đã chạm 1.000 dòng.

**Why:** Các điểm Low từ review đối kháng và pass ràng buộc bước 14b (đã chạm giới hạn 3 vòng sửa): nếu lần tải lại tới lúc hộp thoại thứ hai đang mở, quyết định cũ có thể gửi sai bước; một lần tải lại sau có thể kéo focus về thông báo cũ.

**Context:** `src/features/advances/advance-list-page.tsx` (`AdvanceRowActions`, effect focus), `src/features/advances/components/salary-advance-decision-dialog.tsx`, `src/features/commissions/data.ts`, các route `staff`/`commissions`/`advances`.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Hoàn buổi cho một học sinh: chưa có màn thao tác

**What:** Quyết định nơi làm thao tác "Hoàn buổi" (`session_ledger.reverse`, có lý do): trên trang buổi học (nơi đã biết `session_attendance_id`) hay trên Sổ cái số buổi. Cho tới khi có màn này, ẩn link "Hoàn buổi cho một học sinh…" ở khung khóa buổi.

**Why:** Link ở khung khóa buổi dẫn tới `/finance/session-ledger`, nhưng trang này chỉ đọc và không hoàn được buổi nào. `reverseSessionChargeAction` có sẵn nhưng chưa nơi nào gọi; sổ cái không đọc `session_attendance_id`/`reverses_entry_id`, và hợp đồng `WORKFLOW_CONTRACTS_A_E.md` (mục Lock) giữ nguyên việc không có thao tác đảo ngược trên giao diện. Bước 14c giữ sổ cái chỉ đọc.

**Context:** `src/features/sessions/components/session-lock-actions.tsx` (link), `src/features/sessions/actions/session-reversal-actions.ts` (không revalidate `/finance/session-ledger`), `supabase/migrations/20260806100000_*` (`reverse_session_charge`, `effective_on = current_date` theo giờ UTC), `.gstack/briefs/step14c-map-rules-data.md` §B.4. Gộp với mục "Link Hoàn buổi cần cả quyền `session_ledger.view`".

**Effort:** M
**Priority:** P2
**Depends on:** Quyết định của anh

### Bộ lọc và phân trang Sổ cái số buổi ở máy chủ

**What:** Đọc sổ cái theo khoảng ngày hiệu lực, học sinh và loại bút toán ngay ở máy chủ, có phân trang (ví dụ 50 dòng/trang có tổng chính xác), rồi thêm bộ lọc theo thiết kế 16a. Cần anh duyệt và ghi vào `docs/redesign/WORKFLOW_CONTRACTS_A_E.md` ("List reads outside A–E") trước khi làm.

**Why:** Trang chỉ tải 100 dòng mới ghi nhận nhất; một buổi khóa đã ghi khoảng 20 dòng, nên lọc trên 100 dòng đó sẽ gây hiểu nhầm. Bước 14c không thêm bộ lọc và giữ nguyên test hợp đồng chỉ đọc.

**Context:** `getCenterSessionLedgerEntriesResult` trong `src/features/finance/data.ts` (`.limit(100)`), `src/features/finance/components/session-ledger-history.tsx`, `tests/components/session-ledger-history.test.tsx` (không nút, không ô nhập: phải sửa test có chủ ý).

**Effort:** M
**Priority:** P3
**Depends on:** Quyết định của anh

### Tên người xác nhận trên Đơn hàng

**What:** Trả tên người xác nhận (`checked_by` → `profiles.display_name`) từ `get_finance_orders_dashboard` để cột Xác nhận ghi "người · giờ" như thiết kế 16a.

**Why:** Database chỉ lưu id người xác nhận; RLS `profiles` không cho kế toán đọc tên người khác. Bước 14c chỉ hiện giờ xác nhận ("lúc 12/10 09:40", hoặc "vừa xác nhận" ngay sau khi bấm).

**Context:** `supabase/migrations/20261014100000_finance_orders_student_acquisition_source.sql`, `src/features/finance/finance-orders-models.ts`. Đổi RPC cần migration và bản ghi trong `WORKFLOW_CONTRACTS_A_E.md`. Liên quan: hai đơn tách từ cùng một giao dịch SePay có cùng tên nút "Xác nhận đơn {mã ngân hàng}" (tên này đang được test ghim).

**Effort:** S
**Priority:** P3
**Depends on:** Quyết định của anh

### Trang chi tiết yêu cầu thanh toán (QR, mã chuyển khoản)

**What:** Thêm `/finance/payment-requests/[id]` với QR và mã chuyển khoản như lúc tạo, rồi thêm thao tác "Mở" trên danh sách (thiết kế 16a).

**Why:** QR chỉ được dựng một lần lúc tạo, từ tài khoản nhận tiền đang hiệu lực khi đó; dựng lại sau có thể ra tài khoản khác với cái phụ huynh đã nhận. Muốn hiển thị đúng phải lưu (hoặc đọc lại) tài khoản của từng yêu cầu. Bước 14c chỉ hiện mã chuyển khoản trong danh sách.

**Context:** `src/features/finance/actions/finance-actions.ts` (`createPaymentRequestAction`), `src/app/(app)/finance/payment-requests/new/page.tsx` (`get_effective_sepay_receiving_account`). "Hoàn tiền…" thuộc khung 18d (bước 16): RPC hoàn tiền đang tắt.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Tên học sinh và phụ huynh bị ẩn với kế toán trên Sổ cái và Yêu cầu thanh toán

**What:** Kiểm tra ma trận quyền trên production: theo migration chỉ chủ trung tâm có `students.view` và `guardians.view`, nên kế toán thấy "Học viên" / "Chưa cập nhật" trên mọi dòng sổ cái và yêu cầu thanh toán, không tìm được theo tên, và không vào được "Tạo yêu cầu". Quyết định cấp hai quyền đó cho kế toán (ở Cài đặt) hay đọc tên qua một RPC riêng.

**Why:** Bước 14c giữ phần dự phòng và chỉ hiện link hồ sơ / "Tạo yêu cầu" cho người có `students.view`; bản xem trước `/dev/lists` vẫn hiện tên (có ghi chú) để kiểm tra bố cục. Review đối kháng bước 14c (Medium): kế toán vẫn có nút "Hủy phiếu" (`payments.manage`) dù chỉ nhìn thấy mã PAY, số tiền và mã chuyển khoản, nên có thể hủy nhầm phiếu của người khác; hủy không hoàn tác được.

**Context:** `src/features/finance/data.ts` (embed `students`/`guardians`, phần dự phòng), RLS ở `supabase/migrations/20260722130437_*`, `.gstack/briefs/step14c-map-rules-data.md` §0.12 và §D. Đơn hàng không bị ảnh hưởng (RPC `security definer`).

**Effort:** S (kiểm tra) / M (sửa)
**Priority:** P2
**Depends on:** Quyết định của anh

### Trạng thái "Hết hạn" của yêu cầu thanh toán

**What:** Quyết định có cần trạng thái `expired` thật (job hoặc RPC đặt hạn) hay bỏ nó khỏi bộ lọc. Hiện không có cột hạn và không nơi nào ghi `status = 'expired'`; quy tắc tuổi duy nhất là "chờ quá 14 ngày" (`PAYMENT_REQUEST_OVERDUE_DAYS`).

**Why:** Badge "Hết hạn" và lựa chọn lọc vẫn còn (được test ghim) nhưng không dòng thật nào có trạng thái này. Bước 14c chỉ hiện chip "Hết hạn" khi có dòng, và ghi "chờ quá 14 ngày" dưới badge của yêu cầu đang chờ lâu, không gọi đó là hết hạn.

**Context:** `supabase/migrations/20260726160000_*` (check status), `src/features/students/student-directory-metrics.ts`, `src/features/finance/payment-request-directory-models.ts`.

**Effort:** S
**Priority:** P4
**Depends on:** Quyết định của anh

### Dọn sau bước 14c

**What:** Phân trang ở máy chủ cho `/finance/payment-requests` khi số yêu cầu tiến tới 1.000 dòng (hiện trang báo "chỉ gồm 1.000 yêu cầu mới nhất"); kiểm tra trước liên kết kỳ thu để ẩn "Hủy phiếu" với phiếu thuộc kỳ thu đã khóa (hiện server từ chối kèm thông báo); thống nhất nhãn bút toán giữa hồ sơ học sinh ("Tặng buổi", "Hoàn buổi học") và Sổ cái ("Thưởng buổi", "Đảo trừ"); mã `PAY-YYMMDD` lấy ngày theo giờ UTC của database; thêm `loading.tsx` dạng bảng cho `/finance/orders` và một skeleton riêng cho danh sách yêu cầu thanh toán (skeleton hiện dùng chung với `/new` và còn breakpoint `lg:`); ghi lọc của `/finance/payment-requests` bằng History API như `/sessions` (mỗi lần gõ tìm kiếm hiện chạy lại lần đọc 1.000 dòng trên server; lọc vốn chạy trên trình duyệt); báo "có thể chưa đủ" khi khoảng ngày tạo cũ hơn dòng cũ nhất đã tải lúc chạm 1.000 dòng; bỏ `outline-none` trong lớp gốc của `FilterInput`/`FilterSelect` nếu vòng focus đã đủ; chuẩn hóa từ khóa tìm kiếm một lần cho mỗi dòng (useMemo theo danh sách) thay vì mỗi lần gõ ở `/finance/payment-requests`; tăng cỡ chữ mã yêu cầu (đang 12px để mã đầy đủ vừa cột 200px ở bề rộng tối thiểu 1118px) nếu bảng được nới cột; neo regex kiểm tra ngưỡng `@container` của Sổ cái (và Tạm ứng, Nhân sự, Chấm công) vào đúng selector như test Đơn hàng, vì regex hiện tại khớp chéo sang khối 1042px của Học sinh nên không bao giờ fail; giữ dấu xác nhận đang lưu khi người dùng đổi bộ lọc giữa chừng (hiện bản đè cục bộ bị bỏ khi dashboard đổi, dù thông báo đọc màn hình đã báo thành công); giới hạn năm hợp lệ trong `parseMonth` của Đơn hàng (đường link `?month=0000-01` làm RPC lỗi và mất thanh lọc; gõ năm từng chữ số trong ô tháng gọi RPC nhiều lần); cân nhắc bắt buộc prop `canViewStudents` thay vì mặc định `true` (mặc định đang được test ghim của bảng yêu cầu thanh toán và Sổ cái dựa vào).

**Why:** Các điểm nhỏ còn lại từ bản đồ và các lane bước 14c; không cái nào chặn phát hành.

**Context:** `src/features/finance/data.ts`, `src/features/finance/components/payment-request-table.tsx`, `src/features/students/ledger-labels.ts`, `src/features/finance/components/session-ledger-history.tsx`, `src/components/patterns/filter-bar.tsx`.

**Effort:** S
**Priority:** P4
**Depends on:** None

### Lọc "Chưa đọc" và tổng số thông báo ở máy chủ

**What:** Cho `/notifications` đọc riêng thông báo chưa đọc (`read_at is null`) và đếm tổng để có phân trang đúng (số trang, không còn trang cuối rỗng khi số thông báo là bội của 50). Cần anh quyết vì đổi lần đọc (ghi vào `WORKFLOW_CONTRACTS_A_E.md`).

**Why:** Bước 14d chỉ lọc "Chưa đọc" trong 50 thông báo của trang đang mở và ghi rõ như vậy; số chưa đọc trên đầu trang là tổng thật của tài khoản nên hai con số có thể khác nhau khi thông báo chưa đọc nằm ở trang sau. "Cũ hơn" hiện khi trang đủ 50 dòng nên có thể dẫn tới một trang trống ("Không còn thông báo cũ hơn.").

**Context:** `getNotificationsResult` trong `src/features/notifications/data.ts` (`.range`, không đếm); bản đồ `.gstack/briefs/step14d-map-rules-data.md` §A.5, §I-1.

**Effort:** S
**Priority:** P3
**Depends on:** Quyết định của anh

### Nhật ký hệ thống: xem quá 100 dòng và lọc "Hệ thống"

**What:** Phân trang `/audit` quá 100 bản ghi mới nhất; thêm lựa chọn "Hệ thống" (người thực hiện rỗng) trong bộ lọc Người thực hiện; tìm gần đúng "Mã đối tượng" (hiện so khớp chính xác); kiểm tra `actorId` là uuid trước khi gửi truy vấn (sửa tay URL thành chuỗi khác làm cả trang báo lỗi); tùy chọn bộ lọc đang lấy từ 1.000 bản ghi mới nhất nên module, hành động hoặc người cũ hơn không có trong danh sách chọn. Tất cả là đổi lần đọc: cần anh duyệt và ghi vào `WORKFLOW_CONTRACTS_A_E.md`.

**Why:** Bước 14d giữ nguyên lần đọc: trang ghi "n bản ghi khớp bộ lọc · hiển thị 100 mới nhất" và nhắc thu hẹp bộ lọc để xem bản ghi cũ hơn; giá trị đang lọc mà không có trong danh sách chọn được thêm vào với nhãn "(đang lọc)".

**Context:** `getAuditLogsResult` trong `src/features/audit/data.ts`; `parseAuditFilters` trong `src/features/audit/audit-log-models.ts`; bản đồ §B.3, §I-3…5.

**Effort:** M
**Priority:** P3
**Depends on:** Quyết định của anh

### Dữ liệu trước / sau của nhật ký chứa nguyên hồ sơ học sinh và phụ huynh

**What:** Cân nhắc che bớt trường nhạy cảm (SĐT, ghi chú nội bộ, địa chỉ) trong `old_data`/`new_data` khi hiển thị, hoặc chỉ hiện các trường đã đổi.

**Why:** Trigger học sinh và phụ huynh ghi nguyên dòng (`to_jsonb(old/new)`). Bước 14d chỉ hiện JSON khi bấm "Xem" và chỉ chủ trung tâm có `audit.view`, nhưng nếu sau này cấp quyền nhật ký cho người khác thì toàn bộ hồ sơ sẽ lộ theo.

**Context:** `AuditDataPanels` trong `src/features/audit/components/audit-log-cells.tsx`; migration `20260722130437` và `20260723155910`.

**Effort:** M
**Priority:** P3
**Depends on:** Quyết định của anh

### Xuất CSV buổi học: giới hạn 300 hay 1.000 buổi, báo khi bị cắt, khoảng ngày mặc định

**What:** Chốt giới hạn của file xuất buổi học: thiết kế ghi "≤300 buổi", code xuất tới 1.000 buổi từ bản sửa `d537024`. Đồng thời: báo cho người dùng khi danh sách bị cắt (hiện cắt im lặng), cân nhắc khoảng ngày mặc định (để trống thì file lấy 1.000 buổi có ngày mới nhất, gồm cả buổi đã lên lịch trong tương lai), và trả trang lỗi dễ đọc thay cho JSON 400/403 khi đường dẫn sai.

**Why:** Bước 14d chỉ đổi chữ cho đúng code (1.000, lấy từ `SESSION_EXPORT_LIMIT`) và chặn ngày ngược trên trình duyệt; mọi thay đổi khác là đổi hành vi route xuất.

**Context:** `src/app/(app)/reports/export/sessions/route.ts`, `SESSION_EXPORT_LIMIT` trong `src/features/reports/catalog.ts`, hộp thoại `src/features/reports/components/session-export-dialog.tsx`; bản đồ §C.2, §I-2.

**Effort:** S
**Priority:** P3
**Depends on:** Quyết định của anh

### Xuất CSV buổi học lỗi 500 với người không có quyền xem lớp

**What:** Kiểm tra trên production xem trợ giảng (hoặc ai có `sessions.view` mà không có `classes.view`) xuất được CSV buổi học không. Theo migration chỉ chủ trung tâm có `classes.view`; loader buổi học coi cả lần đọc là lỗi khi embed lớp rỗng, nên route trả 500 "Không thể đọc dữ liệu buổi học.".

**Why:** Thẻ "Danh sách buổi học" trên `/reports` hiện "Có sẵn" cho trợ giảng (đúng theo quyền `sessions.view`), nhưng nút có thể không chạy được với họ. Cùng nguyên nhân với mục "Ai mở được trang Buổi học" ở trên.

**Context:** `getSessionDirectory` trong `src/features/sessions/data.ts`; route xuất; bản đồ §0.11, §I-6.

**Effort:** S (kiểm tra) / M (sửa)
**Priority:** P2
**Depends on:** Quyết định của anh

### Xuất học viên, lead CRM và nhân sự (các thẻ "Dự kiến" trên Báo cáo)

**What:** Làm ba bản xuất còn ở trạng thái "Dự kiến" trên `/reports`: danh sách học viên (`students.view`), lead tuyển sinh (`crm.view`), danh sách nhân sự (`staff.view`), mỗi cái với bộ cột đã qua review bảo mật (không phụ huynh/ghi chú nội bộ cho học viên, không ghi chú ngoài CRM cho lead, không lương/đơn giá/tài khoản cho nhân sự). Cũng quyết định có muốn hiện thẻ "Dự kiến" cho người không có quyền module đó như một lộ trình hay không (hiện ẩn, đúng với câu ghi trên đầu trang).

**Why:** Bước 14d chỉ đổi giao diện: ba thẻ hiện nút "Xuất CSV" bị khóa kèm "Chưa phát hành". Mỗi bản xuất mới là một route đọc dữ liệu mới, cần anh duyệt bộ cột.

**Context:** `REPORT_CATALOG` trong `src/features/reports/catalog.ts`; mẫu route `src/app/(app)/reports/export/sessions/route.ts` + `src/features/reports/csv.ts`; bản đồ `.gstack/briefs/step14d-map-rules-data.md` §C.3, §I-7.

**Effort:** M (mỗi bản xuất)
**Priority:** P4
**Depends on:** Quyết định của anh

### Dọn sau bước 14d

**What:** Đưa nhãn hành động (`action`) và loại đối tượng của nhật ký sang tiếng Việt (hiện tên mã viết hoa chữ đầu + mã gốc, khoảng 100 mã); bỏ `router.refresh()` thừa sau khi đánh dấu (thao tác đã `revalidatePath`, hành vi có từ trước bước 14d); `normalizeInternalHref` trong `src/features/notifications/data.ts` và ràng buộc `notifications_href_check` nên loại cả ký tự điều khiển (tab, xuống dòng) sau dấu `/` đầu, vì trình duyệt bỏ chúng và có thể thành link `//host` (hiện không ai ngoài hệ thống ghi được `href`, nên chưa khai thác được); khi có thêm báo cáo "Có sẵn" thứ hai, phần cuối thẻ trên `/reports` cần chọn hộp thoại và link theo từng báo cáo (hiện luôn là của Danh sách buổi học); số chưa đọc trên chuông và đầu trang Thông báo chỉ cập nhật khi lần làm mới sau thao tác về tới, một lần đánh dấu ở nền thất bại vẫn để dòng trông như đã đọc trong tab đó tới khi tải lại.

**Why:** Các điểm nhỏ còn lại từ các lane bước 14d; không cái nào chặn phát hành.

**Context:** `src/features/audit/audit-log-models.ts`, `src/features/notifications/notification-list-page.tsx`, `src/features/notifications/data.ts`, `src/features/reports/reports-page.tsx`; review bước 14d (P2, P3, bảo mật, D5) ghi ở `.gstack/ship-records/step14d.md`.

**Effort:** S
**Priority:** P4
**Depends on:** None

## Form & wizard (bước 15)

### Tạo học sinh một lần kèm nguồn, sale, đơn giá và ghi danh ban đầu

**What:** Thiết kế 17a có thêm các mục "Nguồn & sale" (nguồn học viên, đối tác/người giới thiệu, sale phụ trách), "Đơn giá học phí" (đơn giá/buổi, hiệu lực từ, căn cứ) và "Ghi danh ban đầu" ngay trong form tạo học sinh. Bước 15a chưa làm vì hàm tạo hồ sơ chỉ ghi học sinh, phụ huynh và liên kết giữa hai bên; nguồn, đơn giá và ghi danh là các thao tác riêng trên hồ sơ, mỗi thao tác cần quyền riêng. Hiện form ghi rõ các mục này được thiết lập trên hồ sơ sau khi lưu.

**Why:** Muốn lưu một lần thì cần một hàm mới ghi tất cả trong một giao dịch (hoặc chấp nhận ghi nối tiếp, có thể lỗi giữa chừng). Riêng "đối tác/người giới thiệu" và "sale phụ trách" hiện không có cột nào trong dữ liệu học sinh.

**Context:** `create_student_with_primary_guardian` (`supabase/migrations/20260809021500…`), `src/features/students/tuition-profile-actions.ts`, `enroll_student_in_class`; khảo sát `.gstack/briefs/step15-map-rules-data.md` §A.1, §F (F1, F2), §H.1 (O2).

**Effort:** L
**Priority:** P3
**Depends on:** Quyết định của anh

### Thiết lập lịch tuần ngay khi tạo lớp

**What:** Thiết kế 17b đặt bảng "Lịch tuần" (thứ, giờ, phòng/hình thức, hiệu lực từ) và cảnh báo trùng phòng ngay trong form tạo lớp. Bước 15a chưa làm: lớp mới luôn ở trạng thái Nháp, còn lịch tuần chỉ tạo được cho lớp đang hoạt động, bắt đầu từ hôm nay, cần quyền `classes.manage_schedule` và ghi từng dòng một. Hệ thống cũng chưa có danh mục phòng hay kiểm tra trùng phòng/giờ. Form tạo lớp hiện ghi các bước tiếp theo: lưu lớp (Nháp) → kích hoạt → thiết lập lịch tuần → tạo buổi hàng loạt.

**Why:** Cần một hàm mới "tạo lớp kèm lịch" (quyết định cho lịch của lớp Nháp và ngày hiệu lực trong tương lai), và nếu muốn cảnh báo trùng phòng thì cần danh mục phòng.

**Context:** `create_class` và `create_class_schedule_template` (`supabase/migrations/20260724150000…`, `20260724163000…`); khảo sát `.gstack/briefs/step15-map-rules-data.md` §0.1, §D.3, §F (F11–F13), §H.1 (O1).

**Effort:** L
**Priority:** P3
**Depends on:** Quyết định của anh

### Sửa thông báo lỗi của tạo buổi hàng loạt

**What:** `src/features/sessions/actions/session-batch-actions.ts` dịch mã lỗi theo `SESSIONS_MANAGE_PERMISSION_DENIED` và `INVALID_SESSION_TIME`, nhưng hàm `create_batch_class_sessions` trả `SESSION_MANAGE_PERMISSION_DENIED` và `CLASS_SESSION_TIME_INVALID`, nên hai lỗi này rơi về câu chung "Không thể lưu buổi học vào cơ sở dữ liệu…". `CLASS_ID_REQUIRED`, `SESSIONS_ARRAY_REQUIRED` và `SESSION_DATE_REQUIRED` cũng chưa có câu riêng. (Các lỗi của trigger `CLASS_SESSION_SCHEDULE_NOT_EFFECTIVE`, `CLASS_SESSION_WEEKDAY_MISMATCH`, `CLASS_SESSION_REQUIRES_ACTIVE_ACADEMIC_YEAR` đã có câu riêng.)

**Why:** Người tạo buổi không biết vì sao cả đợt bị từ chối. Bước 15a đã bỏ chọn sẵn các buổi ngoài hiệu lực lịch ở màn xem trước, nhưng thông báo phía máy chủ vẫn nên đúng.

**Context:** `supabase/migrations/20261014090000…` (dòng 47–51, 96–98), trigger `class_sessions_validate_business_rules` (`20261013090000…`); khảo sát `.gstack/briefs/step15-map-rules-data.md` §0.11, §H.1 (O7).

**Effort:** S
**Priority:** P3
**Depends on:** Quyết định của anh (sửa server action)

### Chọn loại buổi và xem trước phía máy chủ khi tạo buổi hàng loạt

**What:** Thiết kế 17b có ô "Loại buổi" để chọn. Hiện loại buổi do hệ thống tự gán: theo lịch cố định là buổi chính, lịch lặp tùy chỉnh là buổi bổ sung; màn hình chỉ hiện loại đó. Màn xem trước cũng chỉ kiểm tra trùng trên 300 buổi gần nhất của lớp ngay trên trình duyệt (máy chủ kiểm tra lại khi tạo). Ngày nghỉ chỉ dùng để bỏ chọn trong lần tạo đó, không lưu.

**Why:** Cho chọn loại buổi là đổi dữ liệu gửi lên máy chủ; xem trước phía máy chủ cần hàm mới; lưu ngày nghỉ cần bảng mới.

**Context:** `src/features/sessions/batch-calculation.ts`, `src/features/sessions/batch-preview-models.ts`; khảo sát `.gstack/briefs/step15-map-rules-data.md` §C, §H.1 (O6).

**Effort:** M
**Priority:** P4
**Depends on:** Quyết định của anh

### Nhập ghi danh từ file không chuyển học sinh sang "Đang học"

**What:** Khi xác nhận nhập ghi danh, các dòng được ghi vào `student_enrollments` ở trạng thái đang học, nhưng `students.lifecycle_status` của học sinh vẫn là "Đang quan tâm". Ghi danh thủ công (`enroll_student_in_class`) thì có chuyển sang "Đang học", và điểm danh từ chối học sinh còn ở "Đang quan tâm".

**Why:** Học sinh nhập ghi danh từ file có thể không điểm danh được và bị đếm sai trong danh sách theo trạng thái.

**Context:** `supabase/migrations/20260809023000…` (dòng 695–927), `20260723085911…` (dòng 125–132), `20260817090000…` (dòng 192); khảo sát `.gstack/briefs/step15-map-rules-data.md` §0.9, §H.1 (O8). Cần kiểm tra dữ liệu thật trước khi sửa.

**Effort:** M
**Priority:** P2
**Depends on:** Quyết định của anh

### Trang tạo buổi hàng loạt vẫn tải dữ liệu của lớp không hoạt động

**What:** Từ bước 15a, khu tạo buổi từ chối một `?classId=` không nằm trong danh sách lớp đang hoạt động (hiện "Lớp này không tạo buổi hàng loạt được", ẩn phần lịch/xem trước, khóa nút tạo, không gửi gì). Còn lại: `getBatchSessionCreationContext` (`src/features/sessions/batch-data.ts`) vẫn tải lịch tuần, buổi đã có và số buổi của lớp đó thay vì từ chối ngay ở máy chủ.

**Why:** Phòng thủ nhiều lớp và đỡ một lần đọc dữ liệu thừa; không còn nguy cơ tạo buổi nhầm lớp từ giao diện.

**Context:** `src/app/(app)/sessions/batch/page.tsx`, `src/features/sessions/batch-data.ts` (dòng 21–138); sửa ở loader là thay đổi đọc dữ liệu phía máy chủ.

**Effort:** S
**Priority:** P3
**Depends on:** Quyết định của anh (sửa loader)

### Dọn code form học sinh cũ không còn dùng

**What:** `src/features/students/form` còn 16 file của form dạng wizard cũ (khoảng 2.537 dòng, ví dụ `student-form.tsx` và các section của nó), không file nào import.

**Why:** Code chết dùng token giao diện cũ, làm các bài quét mã nguồn theo thư mục phải liệt kê từng file.

**Context:** Khảo sát `.gstack/briefs/step15-map-ui-tests.md` §0 (16).

**Effort:** S
**Priority:** P4
**Depends on:** None

### Thông báo "không kết nối được" khi lưu có thể đã ghi xong

**What:** Khi server action bị từ chối (mất phản hồi, lệch phiên bản sau deploy), form học sinh và form lớp hiện "Không thể kết nối… Vui lòng thử lại", dù thao tác ghi có thể đã xong. Với học sinh, thử lại sẽ gặp lời nhắc trùng nêu chính hồ sơ vừa tạo; nếu người nhập gõ lý do vượt trùng thì tạo ra một bản trùng thật.

**Why:** Câu chữ nên nói "có thể đã lưu, kiểm tra danh sách trước khi thử lại", hoặc form tra lại trước khi cho lưu lần nữa (review đối kháng A7).

**Context:** `student-profile-form.tsx` (SAVE_CONNECTION_ERROR), `class-form-page.tsx` (CONNECTION_ERROR_MESSAGE). Lớp đã được chặn bởi lỗi trùng mã lớp; tạo buổi hàng loạt được chặn bởi việc máy chủ bỏ qua buổi trùng.

**Effort:** S
**Priority:** P3
**Depends on:** Quyết định của anh (câu chữ)

### Link tạo buổi hàng loạt ở trang lớp mang theo bộ lọc danh sách lớp

**What:** `class-detail-page.tsx:195` nối query của danh sách lớp (`search`, `page`, …) vào `/sessions/batch?classId=…`. Trang tạo buổi đọc query đó như bộ lọc danh sách buổi học, nên link "Về danh sách buổi học", "Hủy" và đổi lớp mang `search`/`page` của danh sách lớp sang danh sách buổi. Bước 15a đã bỏ query này ở link bước 4 của form sửa lớp, trang lớp vẫn còn.

**Why:** Danh sách buổi bị lọc theo từ khóa tìm lớp, người dùng không hiểu vì sao.

**Context:** `src/features/classes/class-detail-page.tsx` (dòng 192–195), `src/features/sessions/session-directory-url-state.ts`; review bước 15a (C2-1).

**Effort:** S
**Priority:** P3
**Depends on:** Không

### Chữ cỡ tiêu đề bảng bị token màu che

**What:** `--color-table-header` che `--text-table-header` trong `globals.css`, nên lớp `text-table-header` ra màu nền (#F7F5F1) chứ không ra cỡ chữ 12/16. Tiêu đề các bảng (data-table-frame và 4 bảng khác, cùng bảng "Chỉnh từng buổi" mới của bước 15a) đang dùng cỡ chữ 14 của bảng; chữ vẫn đọc được chỉ nhờ `text-text-muted` đứng sau.

**Why:** Thiết kế cần tiêu đề bảng 12/600. Sửa là đổi tên một trong hai token và rà cả 6 bảng.

**Context:** `src/app/globals.css` (dòng ~1142, ~1162), `src/components/patterns/data-table-frame.tsx:65`, `batch-session-create-workspace.tsx` (thead); review bước 15a (D6).

**Effort:** S
**Priority:** P3
**Depends on:** Không

### Thanh lưu của form tạo học sinh cao gấp đôi trên điện thoại

**What:** Ba nút Hủy, "Lưu và thêm tiếp", "Lưu học sinh" (44px) không vừa một hàng 343px nên xuống hai hàng; thanh cố định cao khoảng 150px (thêm banner lỗi thì cao hơn), che khoảng một phần tư màn hình, nhiều hơn khi bàn phím mở.

**Why:** DESIGN yêu cầu thanh lưu dưới đáy giữ được vùng nhìn khi gõ. Cần quyết định thiết kế: ẩn nút phụ dưới `sm`, đưa vào menu, hoặc rút gọn chữ.

**Context:** `src/components/patterns/sticky-save-bar.tsx` (dòng ~192), `student-profile-form.tsx` (`secondaryAction`); review bước 15a (D8).

**Effort:** S
**Priority:** P3
**Depends on:** Quyết định của anh (thiết kế)

### Trạng thái đang tải làm trang nhảy khi form hiện ra

**What:** Các file `loading.tsx` của `/students/new`, `/classes/new`, `/sessions/batch` (và trước đó `/reports`, `/payroll/dashboard`) đặt một `LoadingNotice` nhìn thấy được phía trên skeleton; trang thật không có khối đó nên nội dung dịch lên khoảng 60px khi tải xong.

**Why:** DESIGN yêu cầu trạng thái tải giữ đúng hình dạng trang. Đây là quyết định chung cho cả app (ẩn notice bằng `sr-only` hoặc đưa vào khung đầu tiên).

**Context:** `src/components/shared/loading-state.tsx`, các `loading.tsx` kể trên; review bước 15a (D7).

**Effort:** S
**Priority:** P4
**Depends on:** Quyết định của anh

### Dọn nhỏ sau bước 15a

**What:** Các điểm nhỏ review bước 15a đã ghi nhận nhưng không sửa trong đợt này:
- "Kiểm tra hồ sơ trùng" bị khóa trong lúc tra cứu nên focus rơi về đầu trang; nút "Đóng" trên thông báo kết quả tạo buổi hàng loạt cũng làm focus rơi về đầu trang.
- Khi focus dự phòng chuyển vào khối thông báo lỗi của form học sinh, trình đọc màn hình có thể đọc lại thông báo hai lần; nhánh focus vào trường lỗi phía máy chủ có thể kéo focus khỏi chỗ người dùng vừa chuyển tới.
- Lần "Lưu và thêm tiếp" đầu tiên có thể không được đọc lên (vùng thông báo gắn cùng lúc với nội dung).
- Màn xem trước so giờ bắt đầu đã sửa mà không cắt khoảng trắng như máy chủ (máy chủ vẫn quyết định, chỉ số đếm lệch).
- `/dev/forms` vai chủ trung tâm vẫn có link sidebar thật tới `/imports/*` (các bản xem trước khác cũng vậy).
- Link trong ô hành động của `ResultBanner` ở các trang khác vẫn chỉ cao ~20px trên điện thoại (bước 15a chỉ sửa các link trong ba form).
- Kiểm tra `<fieldset className="contents">` của form học sinh trên Safari iOS/macOS (khoảng cách giữa các mục, tràn ngang).
- Bộ chặn rời trang của form lớp chép lại gần nguyên văn của form học sinh; nên tách thành một hook chung trong `leave-guard.tsx`.
- Nhánh `selectedClassId === ""` trong khu tạo buổi không còn đường nào gọi tới ở production; mô tả hộp xác nhận hiện "cho lớp ." nếu lớp biến mất khi hộp đang mở (nút xác nhận đã khóa).
- Form học sinh: tra cứu trùng thất bại làm ẩn lỗi "Cần nhập lý do…" đang hiện; lý do vượt trùng vẫn được gửi khi lần tra cứu lúc lưu không còn thấy trùng (nên gửi chuỗi rỗng); lỗi máy chủ trả về cho `studentId`/`publicCode` được đếm trên thanh lưu dù không có ô nào để sửa; sửa hồ sơ giữ nguyên số điện thoại sẽ ghi đè phụ huynh dùng chung trước khi thông báo "phụ huynh của chính học sinh này" kịp hiện.
- Form lớp: bước 3 "Thiết lập lịch tuần" không bao giờ được đánh dấu xong dù lớp đã có lịch; route tạo/sửa lớp và tạo buổi vẫn viết trực tiếp câu từ chối quyền (hằng số `*-route-copy.ts` chỉ được test khớp).
- Mục lục form: mục ngắn cuối trang không bao giờ được đánh dấu đang xem; khoảng dừng 1 giây sau khi bấm ngắn hơn một lần cuộn mượt dài; vệt mờ mép phải không đo lại khi mục "Xác nhận tiếp tục lưu" xuất hiện. Thanh lưu: nút phụ bị khóa không có lý do cho trình đọc màn hình.
- Ô nhiều dòng của trình sửa website dựa vào thứ tự CSS (`min-h-24` sau `min-h-20`); các test component mới mất 1–2,5 giây mỗi test, có thể chạm mốc 5 giây của CI khi máy bận.

**Why:** Gom lại để làm một lượt, không chặn bước 15a.

**Context:** review bước 15a (B4-1..4, P3-6, P3-7, C2-9, P7-3, AF4–AF6, AF8, AG3, AG4, AG6, AG8, AG11, ghi chú lane S2/B3); `student-profile-form.tsx`, `batch-session-create-workspace.tsx`, `batch-preview-models.ts`, `forms-preview-params.ts`, `src/components/shared/result-banner.tsx`.

**Effort:** M
**Priority:** P4
**Depends on:** Không

### Đánh số tên buổi khi tạo đợt thứ hai trên cùng trang

**What:** "Số bắt đầu" của trang tạo buổi hàng loạt lấy một lần khi mở trang (số buổi hiện có + 1), như trên production. Sau khi tạo một đợt, nếu người dùng dời ngày bắt đầu để tạo tiếp mà không tải lại trang, tên "Buổi n" sẽ lặp lại các số vừa tạo. Bước 15a đã thử cho số này tự đếm lại sau khi tạo, nhưng cách đó làm sai tên ở luồng "tăng số lượng từ cùng ngày" và gây reset nháp, nên đã trả về như cũ (quyết định D3 của anh).

**Why:** Muốn đúng cho cả hai luồng thì nên đánh số chỉ các buổi được chọn và chưa bị chặn, theo thứ tự, lúc gửi đi; đó là thay đổi cách đặt tên, cần quyết định sản phẩm.

**Context:** `src/features/sessions/components/batch-session-create-workspace.tsx`, `src/features/sessions/batch-calculation.ts` (`startNumber + sessionIndex` cho mọi nháp); review bước 15a (R3-4, A1, P5-1, AD4, AE1, AE4, AF1).

**Effort:** M
**Priority:** P3
**Depends on:** Quyết định của anh

### Trang tạo buổi hàng loạt: lớp mặc định và giờ nhập tay

**What:** (1) Vào `/sessions/batch` không kèm `classId` (link từ danh sách buổi), route chọn lại lớp hoạt động đầu tiên ở mỗi lần làm mới; nếu lớp đầu tiên thay đổi trong lúc mở trang, khu tạo buổi tải lại sang lớp khác và mất các lựa chọn. Nên ghi `classId` đã chọn vào URL khi mở trang. (2) Ô giờ trong "Chỉnh từng buổi" là chữ tự do và ô giờ của lịch tùy chỉnh để trống được: "8:00", giờ trống hoặc giờ kết thúc trước giờ bắt đầu (và ghi chú quá 500 ký tự) làm máy chủ từ chối cả đợt mà không nói dòng nào; nên dùng ô giờ / kiểm tra từng dòng và đưa vào lý do khóa nút tạo. (3) Ngay sau khi tạo thành công, các buổi vừa gửi vẫn được chọn cho tới khi trang làm mới xong (hoặc mãi mãi nếu các ngày đó nằm ngoài 300 buổi mới nhất trang tải về), nên bấm xác nhận lần nữa sẽ gửi lại; máy chủ bỏ qua và báo "0 buổi". Nên bỏ chọn các buổi đã gửi khi tạo xong.

**Why:** Tránh mất công nhập và lỗi khó hiểu khi tạo đợt.

**Context:** `src/app/(app)/sessions/batch/page.tsx` (dòng 76–86), `batch-session-create-workspace.tsx` (BatchDraftEditorRow); review bước 15a (P6-2/AE2, AE3, AF2, AF3, AG1).

**Effort:** S
**Priority:** P3
**Depends on:** Không

### Kiểm tra hỏi "chưa lưu" sau khi lưu lớp thành công

**What:** Review đối kháng nêu khả năng form lớp hỏi "Thay đổi chưa lưu sẽ mất" ngay sau khi lưu thành công nếu điều hướng chậm. Theo code, `router.push` chạy trong chính transition của lần lưu nên `isPending` giữ tới khi trang mới hiện, guard không bật lại; chưa kiểm chứng được trên trình duyệt vì bản xem trước không bao giờ lưu thành công.

**Why:** Xác nhận một lần trên môi trường thật (tạo hoặc sửa một lớp nháp) rồi đóng mục này.

**Context:** `src/features/classes/management/class-form-page.tsx` (startTransition, useLeaveGuard); review bước 15a (AD3).

**Effort:** S
**Priority:** P4
**Depends on:** Không

### Kiểm tra trùng khi tạo buổi hàng loạt không chặn được hai người tạo cùng lúc

**What:** `createBatchSessionsAction` đọc các buổi đã có rồi mới ghi (không nguyên tử) và bỏ qua lỗi khi đọc; nhánh lịch tùy chỉnh của `create_batch_class_sessions` ghi không có ràng buộc trùng (chỉ buổi theo lịch cố định có chỉ mục duy nhất `(schedule_template_id, session_date)`). Hai người cùng tạo, hoặc một lần đọc lỗi, có thể tạo trùng buổi bổ sung. `batch-data.ts` cũng bỏ qua lỗi đọc buổi đã có, nên màn xem trước có thể báo "0 trùng". Câu chữ mới ở màn xem trước và hộp xác nhận nói máy chủ kiểm tra lại và bỏ qua buổi trùng, điều này chỉ được cơ sở dữ liệu bảo đảm cho buổi theo lịch cố định.

**Why:** Tránh buổi trùng (ảnh hưởng điểm danh, học phí) và câu chữ hứa quá mức.

**Context:** `src/features/sessions/actions/session-batch-actions.ts` (dòng ~178–196), `supabase/migrations/20261014090000…` (nhánh custom, dòng ~169–197), `src/features/sessions/batch-data.ts` (dòng ~64–118), `batch-preview-grid.tsx` (câu "máy chủ kiểm tra lại"); review đối kháng bước 15a (AG2). Sửa là thay đổi máy chủ/migration.

**Effort:** M
**Priority:** P3
**Depends on:** Quyết định của anh (sửa server action / RPC)

## Tin nhắn phụ huynh (Zalo)

### Gỡ RPC `record_parent_message_result` cũ sau khi bản 0.21 chạy ổn

**What:** Ứng dụng từ 0.21.0.0 gửi qua `begin_parent_message_send` + `record_parent_message_part`. RPC cũ `record_parent_message_result` chỉ còn để bản ứng dụng cũ chạy được trong lúc deploy; gỡ bằng một migration sau.

**Why:** RPC cũ ghi "đã gửi" mà không qua khóa Gửi (điểm vở, trợ giảng giám thị) và không cập nhật `parts_sent` / `provider_message_ids`.

**Context:** `supabase/migrations/20261017090000_zalo_comment_message_v2.sql`; pgTAP `parent-messages-zalo-queue.test.sql` còn gọi RPC cũ, cần đổi sang luồng mới khi gỡ.

**Effort:** S
**Priority:** P2
**Depends on:** 0.21.0.0 chạy ổn trên production

### Màn sửa thang xếp hạng

**What:** RPC `set_grading_rank_bands` (chỉ `settings.manage`) đã có; Cài đặt → Tin Zalo mới chỉ hiện thang. Thêm form sửa (mốc điểm + nhãn, bắt buộc mốc 0) ở Cài đặt → Chấm bài AI (Giai đoạn 3) hoặc ngay trong Tin Zalo.

**Why:** Chủ trung tâm muốn đổi nhãn xếp hạng hiện phải nhờ người chạy SQL.

**Context:** Kế hoạch chấm bài AI mục 4.1 và 4.7.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Phần đã gửi nhưng chưa kịp ghi có thể bị gửi lặp

**What:** Nếu ZaloCRM nhận một phần nhưng ứng dụng không ghi được `record_parent_message_part` (mất mạng, hết thời gian chạy), lần gửi lại sau khi khóa 2 phút hết hạn sẽ gửi lại phần đó.

**Why:** ZaloCRM chưa nhận khóa chống trùng (idempotency key) cho `/api/public/messages/send`.

**Context:** `sendParentMessageAction` trong `src/features/parent-messages/actions.ts`. Cách sửa: gửi kèm khóa `message_id:part_no` khi ZaloCRM hỗ trợ.

**Effort:** M
**Priority:** P3
**Depends on:** ZaloCRM hỗ trợ khóa chống trùng

## Nhập dữ liệu (bước 15b)

### Duyệt lô số dư buổi khi trung tâm chỉ có một chủ

**What:** Quyết định quy tắc "người tạo lô không tự duyệt" cho lô số dư buổi đầu kỳ. Bước 15b giữ nguyên quy tắc trên giao diện: người tạo lô không bấm được "Phê duyệt batch" (test `session-balance-approval-workflow` khóa hành vi này). Ba hướng: (a) theo máy chủ, cho người tạo tự duyệt khi có quyền `imports.session_balances.approve`; (b) thêm lại kiểm tra bốn mắt ở máy chủ và cấp quyền duyệt cho một vai trò thứ hai; (c) giữ như hiện tại.

**Why:** Migration `20260809033000_allow_owner_session_balance_self_approval.sql` đã bỏ kiểm tra bốn mắt ở máy chủ, nên quy tắc chỉ còn ở giao diện. Mọi quyền `imports.*` mặc định chỉ cấp cho vai trò chủ trung tâm, nên khi chỉ có một tài khoản chủ thì lô do chủ tạo không bao giờ duyệt được trên giao diện.

**Context:** `isCreator` trong `src/features/imports/session-balances/session-balance-batch-detail-page.tsx`; quyền mặc định ở `supabase/migrations/20260808100000…` (dòng 80–101), `20260809023000…`, `20260801014500…`; khảo sát `.gstack/briefs/step15-map-ui-tests.md` §0 (7), `.gstack/briefs/step15-map-rules-data.md` §H.1 (O3).

**Effort:** S (giao diện) / M (migration bốn mắt)
**Priority:** P2
**Depends on:** Quyết định của anh

### Sửa dòng hoặc bỏ dòng ngay trong màn nhập dữ liệu

**What:** Thiết kế 17c cho sửa ô lỗi tại chỗ, chọn lại "Nguồn" và bấm "Bỏ dòng" ở bước Kiểm tra dòng. Bước 15b không làm: bảng kiểm tra chỉ đọc, cách sửa là "Sửa file Excel rồi chọn lại file". Lô số dư buổi vẫn giữ thao tác loại dòng "cần xem lại" ở trang lô (máy chủ ghi lý do).

**Why:** Sửa trên trình duyệt làm dữ liệu được ghi khác với file có SHA-256 đã lưu (máy chủ dùng SHA để chặn nhập trùng). Với nhập học sinh, bỏ một dòng rồi xác nhận thì các dòng đã bỏ không bao giờ nhập lại được từ đúng file đó. Lô lớp và lô ghi danh đã tạo thì không có hàm nào sửa hay loại dòng.

**Context:** `commit_student_import_rows` (`p_source_sha256`, `STUDENT_IMPORT_FILE_ALREADY_COMMITTED`), `exclude_session_balance_import_row`; khảo sát `.gstack/briefs/step15-map-ui-tests.md` §0 (14), `.gstack/briefs/step15-map-rules-data.md` §B.6, §F (F23, F24), §H.1 (O4).

**Effort:** M
**Priority:** P3
**Depends on:** Quyết định của anh

### Trang lô cho nhập học sinh và nhập ghi danh, danh sách lô nhập lớp

**What:** Thêm trang chỉ đọc cho một lô nhập học sinh (`student_import_batches`) và một lô nhập ghi danh (`student_enrollment_import_batches`), và một danh sách lô trên `/imports/classes`. Bước 15b không thêm route mới: kết quả nhập học sinh giữ các link "Mở danh sách học viên" và "Xem nhật ký thao tác", kết quả nhập ghi danh là một thẻ số liệu không có link lô; trang lô lớp vẫn quay về màn nhập.

**Why:** Thiết kế 17c ghi "lô (batch) có trang chi tiết" cho cả bốn loại. Hiện mã lô học sinh và ghi danh được trả về nhưng không có chỗ xem lại, nên sau khi rời trang không kiểm tra được lô đã ghi những gì.

**Context:** RLS cho người có `imports.students` / `imports.enrollments` đã đọc được hai bảng lô; khảo sát `.gstack/briefs/step15-map-rules-data.md` §B.2, §B.4, §F (F33), §H.1 (O5).

**Effort:** M
**Priority:** P3
**Depends on:** Quyết định của anh

### Số dư buổi lẻ bị làm tròn và dòng trùng trong file số dư

**What:** Kiểm tra lại cách nhận số dư buổi đầu kỳ: cột `source_balance` là `numeric(12,1)` nên số có hai chữ số thập phân bị làm tròn (6,96 thành 7 và được coi là hợp lệ), và chạy thử không báo khi một mã học sinh xuất hiện nhiều lần trong cùng file.

**Why:** Số buổi ghi sổ có thể khác số trong file mà không ai thấy; hai dòng cùng học sinh sẽ cộng hai lần vào sổ buổi khi ghi sổ.

**Context:** `supabase/migrations/20260808100000_session_balance_import_foundation.sql` (cột `source_balance`, hàm `dry_run_session_balance_import_rows`); khảo sát `.gstack/briefs/step15-map-rules-data.md` §B.5, §H.1 (O8).

**Effort:** M
**Priority:** P2
**Depends on:** Quyết định của anh (sửa hàm máy chủ)

### Lô nhập lớp lỗi làm "cháy" file

**What:** Khi file lớp còn dòng xung đột, máy chủ vẫn tạo lô ở trạng thái "Đã xem trước" (`previewed`); lô này không bao giờ xác nhận được, và vì SHA-256 của file là duy nhất nên không tạo lại lô từ đúng file đó. Dòng không hợp lệ thì thường làm hỏng cả lần tạo lô với lỗi cơ sở dữ liệu thô (23514/23502). Bước 15b chỉ khóa nút "Tạo lô" trên giao diện khi còn dòng xung đột hoặc không hợp lệ; máy chủ chưa đổi.

**Why:** Người nhập phải sửa nội dung file (để có SHA khác) chỉ để thử lại, và không có cách hủy một lô hỏng (trạng thái `rejected` không bao giờ được đặt).

**Context:** `create_class_schedule_import_batch` (`supabase/migrations/20260808110000_class_schedule_import_foundation.sql`), `src/features/imports/classes/actions.ts`; khảo sát `.gstack/briefs/step15-map-rules-data.md` §B.3, §H.1 (O8).

**Effort:** M
**Priority:** P3
**Depends on:** Quyết định của anh (sửa hàm máy chủ)

### Chạy thử nhập ghi danh mang mã ghi danh của dòng trước sang dòng lỗi

**What:** Trong `dry_run_student_enrollment_import`, biến `v_existing_active_enrollment` không được đặt lại ở đầu mỗi dòng, nên một dòng không hợp lệ (thiếu mã, không tìm thấy học sinh hay lớp) trả `resolved_enrollment_id` của dòng hợp lệ trước đó; giá trị này được lưu vào lô khi tạo lô.

**Why:** Dữ liệu lô sai lệch và dễ gây nhầm khi đối chiếu sau này, dù bước xác nhận đã kiểm tra lại từng dòng.

**Context:** `supabase/migrations/20260809023000_student_enrollment_import_foundation.sql` (khoảng dòng 343–347, 419, 475, 643); khảo sát `.gstack/briefs/step15-map-rules-data.md` §B.4, §H.1 (O8).

**Effort:** S
**Priority:** P3
**Depends on:** Quyết định của anh (sửa hàm máy chủ)

### Xác nhận nhập lớp không kiểm tra quyền lớp học

**What:** `commit_class_schedule_import_batch` chỉ kiểm tra `imports.classes`, rồi ghi thẳng vào `classes` và `class_schedule_templates`, bỏ qua các quy tắc của tạo lớp và tạo lịch (quyền `classes.create` / `classes.manage_schedule`, lịch chỉ cho lớp đang hoạt động, ngày hiệu lực theo ngày làm việc). Lớp nhập vào mặc định ở trạng thái đang hoạt động.

**Why:** Người chỉ được cấp quyền nhập file có thể tạo lớp và lịch mà vai trò của họ không được tạo bằng tay.

**Context:** `supabase/migrations/20260808110000_class_schedule_import_foundation.sql` (hàm commit), `src/features/imports/classes/actions.ts`; khảo sát `.gstack/briefs/step15-map-rules-data.md` §B.3, §H.1 (O8).

**Effort:** S
**Priority:** P3
**Depends on:** Quyết định của anh

### Thao tác nhập ghi danh không kiểm tra quyền và dữ liệu đầu vào

**What:** Ba server action nhập ghi danh (chạy thử, tạo lô, xác nhận) chỉ kiểm tra đã đăng nhập: không kiểm tra `imports.enrollments` ở TypeScript, không kiểm tra dữ liệu bằng zod, không `revalidatePath`. Các hàm máy chủ có kiểm tra `imports.enrollments`, nên đây là lớp bảo vệ thứ hai.

**Why:** Các luồng nhập khác đều kiểm tra quyền và dữ liệu ở server action; thiếu ở đây thì lỗi dữ liệu xấu đi thẳng tới cơ sở dữ liệu và hiện nguyên văn.

**Context:** `src/features/imports/enrollments/actions.ts`; so với `src/features/imports/students/actions.ts`; khảo sát `.gstack/briefs/step15-map-ui-tests.md` §0 (5), `.gstack/briefs/step15-map-rules-data.md` §H.1 (O7, O8).

**Effort:** S
**Priority:** P2
**Depends on:** Quyết định của anh (sửa server action)

### Năm học "2026-2027" viết cứng trong nhập lớp và nhập ghi danh

**What:** Màn nhập ghi danh chỉ có một lựa chọn năm học "2026-2027"; màn nhập lớp lấy năm học từ file và nếu trống thì dùng "2026-2027"; file mẫu lớp cũng ghi sẵn "2026-2027". Nên đọc danh sách năm học đang mở như form tạo lớp.

**Why:** Sang năm học sau, nhập ghi danh không chọn được năm mới, và file lớp thiếu cột năm học sẽ âm thầm nhập vào năm cũ.

**Context:** `src/features/imports/enrollments/enrollment-import-page.tsx`, `src/features/imports/classes/class-schedule-import-page.tsx` (hàm dựng dữ liệu gửi đi), `src/features/imports/classes/template-browser.ts`; khảo sát `.gstack/briefs/step15-map-ui-tests.md` §0 (19), `.gstack/briefs/step15-map-rules-data.md` §B.3, §B.4.

**Effort:** M
**Priority:** P2
**Depends on:** Quyết định của anh (đọc thêm dữ liệu năm học)

### Lỗi cơ sở dữ liệu hiện nguyên văn ở nhập lớp và nhập ghi danh

**What:** Server action nhập lớp và nhập ghi danh ghép thẳng `error.message` của cơ sở dữ liệu vào câu báo lỗi ("Lỗi kiểm tra dữ liệu từ cơ sở dữ liệu: …", "Lỗi tạo batch từ cơ sở dữ liệu: …", "Lỗi thực thi import: …", "Lỗi Commit ghi danh: …"). Nên dịch theo mã lỗi như nhập học sinh và giữ một câu chung cho lỗi lạ.

**Why:** Người dùng thấy câu tiếng Anh kỹ thuật (mã 22P02, 23514…) mà không biết sửa gì trong file; câu thô có thể lộ tên bảng hay ràng buộc.

**Context:** `src/features/imports/classes/actions.ts`, `src/features/imports/enrollments/actions.ts`; khảo sát `.gstack/briefs/step15-map-rules-data.md` §B.3, §B.4, §H.1 (O7).

**Effort:** S
**Priority:** P3
**Depends on:** Quyết định của anh (sửa server action)

### Đợt chỉnh chữ và đồng nhất giao diện màn nhập dữ liệu

**What:** Gom các góp ý giao diện của review bước 15b vào một đợt có chủ đích: nút xác nhận ghi danh viết hoa "XÁC NHẬN COMMIT GHI DANH n HỌC VIÊN" (đổi thành chữ thường tiếng Việt, ví dụ "Ghi danh n học sinh"); chữ "Batch", "batch", "read-only", "Maker/Checker", "Chờ đối tác duyệt (Maker)" và "->" ở trang số dư buổi; "học sinh" và "học viên" lẫn lộn; "Tiếp:" và "Tiếp tục:", cỡ nút "Tải file mẫu", căn cột "Dòng" khác nhau giữa bốn wizard; bảng kiểm tra lớp hiện hai huy hiệu cho một dòng (cột "Kết quả" và "Hợp lệ"); nút "Tạo lô" của wizard lớp nằm trong panel thay vì thanh hành động; cỡ tiêu đề h2 lệch giữa hai trang lô; huy hiệu "Không nhập được" màu đỏ nhưng banner cùng ý màu cam; lý do loại dòng soạn sẵn "Chưa có enrollment đang active."; câu lỗi "invalid zip data" của file lớp.

**Why:** Mỗi chỗ nhỏ, nhưng cùng một màn nói hai cách cho một việc. Nhiều câu đang bị test ghim (`enrollment-import-commit-counts`, `session-balance-approval-workflow`), nên đổi giữa lúc ship sẽ phải sửa test ghim; gom lại một lần thì sửa test có chủ đích.

**Context:** Review /ship bước 15b (v0.38.0.0), chuyên gia design: `enrollment-import-page.tsx` (nút commit), `session-balance-batch-detail-page.tsx`, `session-balance-batch-list.tsx`, `session-balance-import-labels.ts`, `class-schedule-import-presentation.tsx` (cột "Kết quả"), `class-schedule-import-page.tsx` (nút "Tạo lô"), `class-schedule-batch-detail-page.tsx` (huy hiệu `previewed`), `classes/workbook.ts` (câu lỗi zip, file bị khóa phạm vi ở 15b).

**Effort:** M
**Priority:** P3
**Depends on:** Không

### Gõ phím trên trang lô vẽ lại toàn bộ dòng

**What:** Trên trang lô số dư buổi và trang lô lớp, mỗi phím gõ vào ô lý do hay cụm xác nhận vẽ lại toàn bộ bảng dòng (tới 5.000 dòng số dư, vì trang lô số dư không giới hạn số dòng hiển thị như bước kiểm tra (500); tới 2.000 lịch học). Tách state ô nhập xuống component panel riêng, giữ lý do loại dòng trong ô của dòng đó, và memo `ImportReviewTable` với các hàm ổn định.

**Why:** Trên điện thoại hoặc lô lớn, gõ bị chậm. Trang cũ trước redesign cũng vẽ lại như vậy, nên đây không phải lỗi mới.

**Context:** Review /ship bước 15b (v0.38.0.0), chuyên gia hiệu năng: `session-balance-batch-detail-page.tsx`, `class-schedule-batch-detail-page.tsx`, `components/import-review-table.tsx`.

**Effort:** S
**Priority:** P3
**Depends on:** Không

### Trang lô trên điện thoại hiện bảng rồi mới chuyển sang thẻ

**What:** Hai trang lô (`/imports/session-balances/[batchId]`, `/imports/classes/[batchId]`) được máy chủ vẽ sẵn bảng dòng; trên điện thoại trình duyệt hiện bảng (cuộn ngang trong khung) trong lúc tải JS rồi mới đổi sang thẻ xếp dọc. Cách sửa: `ImportReviewTable` vẽ khung chờ cho tới khi hiệu ứng layout đo xong độ rộng (giữ bảng khi đo được 0, như jsdom).

**Why:** Trang nhảy layout một lần lúc mở trên điện thoại. Không tràn trang (đã sửa ở QA bước 15b) và không sai dữ liệu; đây là đánh đổi của quy tắc chỉ một cách hiển thị trong DOM.

**Context:** Review /ship bước 15b, chuyên gia hiệu năng (vòng 2); `src/features/imports/components/import-review-table.tsx` (`useReviewLayout`). Quyết định của anh 2026-10-21: để TODOS.

**Effort:** S
**Priority:** P3
**Depends on:** Không

### Tạo lô ghi danh mất kết nối có thể để lại lô không mở được

**What:** Khi câu trả lời của "Tạo lô" ghi danh bị mất nhưng máy chủ đã tạo lô, file đó không tạo được lô thứ hai (SHA-256 là duy nhất, `STUDENT_ENROLLMENT_IMPORT_SHA_ALREADY_EXISTS`) và màn ghi danh không có cách mở lô đã tạo (không có trang lô, không có mã lô). Cần một hàm đọc lô theo SHA-256 (hoặc trang lô ghi danh, xem mục "Trang lô cho nhập học sinh và nhập ghi danh") để màn hình đưa người dùng tới lô đó.

**Why:** Bước 15b chỉ sửa được câu chữ (bấm "Tạo lô" lại để máy chủ báo file đã có lô); lô `ready_to_commit` đó vẫn không xác nhận được từ giao diện.

**Context:** `src/features/imports/enrollments/actions.ts` (khóa phạm vi ở 15b), `supabase/migrations/20260809023000_student_enrollment_import_foundation.sql` (khoảng dòng 560–566). Review /ship bước 15b (red team vòng 2), quyết định D5 của anh.

**Effort:** M
**Priority:** P2
**Depends on:** Quyết định của anh (thêm hàm máy chủ)

### Bấm xác nhận nhập học sinh lại trong lúc lần trước còn chạy báo sai

**What:** Nếu lần xác nhận nhập học sinh trước vẫn đang chạy (ví dụ máy chủ quá thời gian) mà người dùng bấm lại, cả hai cùng qua bước kiểm tra trùng và lần sau vấp chỉ mục duy nhất `student_import_batches_source_sha256_uidx`; server action không dịch lỗi này nên trả "Không thể xử lý import học viên. Dữ liệu chưa được thay đổi.", câu này sai khi lần trước đã ghi. Cần dịch lỗi chỉ mục đó thành "File này đã được nhập" như mã `STUDENT_IMPORT_FILE_ALREADY_COMMITTED`.

**Why:** Câu chữ "Bấm xác nhận lại" của bước 15b dựa vào việc máy chủ báo đúng khi file đã được nhập.

**Context:** `src/features/imports/students/actions.ts` (khoảng dòng 171–202, khóa phạm vi ở 15b), `supabase/migrations/20260801021000…` (dòng 93). Review /ship bước 15b (red team vòng 2).

**Effort:** S
**Priority:** P2
**Depends on:** Quyết định của anh (sửa server action)

### Nhập lớp: số trơn trong cột "Thứ" đọc theo ISO, lệch một ngày so với "Thứ N"

**What:** Hàm đọc thứ của nhập lớp đọc số trơn theo ISO (3 = Thứ Tư) nhưng đọc "Thứ 3" hay "T3" là Thứ Ba, nên file ghi số trong cột "Thứ" có thể lệch một ngày mà không báo lỗi (bảng xem trước vẫn hiện tên thứ). Cần anh chọn một trong ba hướng: (a) ghi rõ quy ước trên tiêu đề cột và file mẫu ("Thứ * (1 = Thứ Hai … 7 = Chủ nhật)"); (b) không nhận số trơn 2–7, coi là dòng lỗi; (c) đọc số trơn như "Thứ N" của tiếng Việt (2 = Thứ Hai … 7 = Thứ Bảy, CN riêng).

**Why:** Người Việt đọc "3" là Thứ 3 (thứ Ba); lịch lớp có thể được tạo lệch một ngày cho cả file. Cùng nhóm, vẫn đọc sai mà không báo: "Thu 2" hay "Thu Ba" gõ không dấu bị đọc thành thứ Năm (khớp chữ "THU" của tiếng Anh), và "Thứ 2, 4, 6" chỉ được đọc là thứ Hai. Ngược lại, ô ghi thêm mã khác trùng mã thứ ("Thứ 2 - CN Cầu Giấy", "Thứ 3 - tầng T2") bị coi là ghi hai ngày, và ô chỉ có mã mà tên tiếng Anh nói ngày khác ("Sat - tầng T2", "T2 (cô Thu)") đều thành dòng lỗi. Thêm nữa, lời nhắn của máy chủ trong bảng kiểm tra in số ISO sau chữ "Thứ" ("Thứ 3" cho thứ Tư, "Thứ: 7" cho Chủ nhật), ngược với cột Thứ ngay cạnh; khi chọn quy ước nên đổi luôn cách hiện lời nhắn này (dịch ở `getRowIssue` hay sửa hàm máy chủ). Nên quyết cùng một lần với quy ước số.

**Context:** `parseWeekdayValue` trong `src/features/imports/classes/workbook.ts` (nhánh số: `typeof value === "number"` và chữ số `/^\+?\d+(\.\d+)?$/`; bảng `VIETNAMESE_DAY_NAMES` / `VIETNAMESE_DAY_CODES` / `ENGLISH_DAY_NAMES`), tiêu đề `Thứ *` ở `src/features/imports/classes/fields.ts`, file mẫu `src/features/imports/classes/template-browser.ts`; test `tests/unit/class-schedule-import-weekday.test.ts`. Review /ship v0.38.0.1 (red team), anh chọn ghi TODO.

**Effort:** S
**Priority:** P2
**Depends on:** Quyết định của anh

### Nhập lớp: giờ, ngày trong file và dòng lịch thiếu mã làm hỏng cả lần kiểm tra hoặc lệch ngày

**What:** (1) Giờ gõ kiểu giờ trong Excel (ô số, định dạng h:mm) có thể bị đọc thành ngày "1899-12-31": `normalizeCellValue` trong `workbook.ts` đổi mọi ô kiểu Date thành chuỗi ngày bằng `parseDateValue` trước khi `parseTimeValue` thấy, nên giờ gửi đi là một ngày và hàm kiểm tra của máy chủ (`::time`) làm hỏng cả lần kiểm tra. Theo review (đọc mã và mô phỏng thư viện, chưa thử với file thật), mọi file ghi giờ kiểu này đều không kiểm tra được; chỉ giờ dạng chữ như file mẫu là chạy. (2) Ngày dạng chữ dd/mm được đọc bằng `new Date(str)` theo kiểu Mỹ: "08/09/2026" thành 9 tháng 8, "8/8" thành năm 2001, lệch ngày hiệu lực mà không báo. (3) Dòng thiếu mã lớp, mã thành phần, giờ hay ngày hiệu lực làm server action từ chối cả yêu cầu ("Dữ liệu đầu vào không hợp lệ.") không có số dòng; ô gộp nhiều dòng trong Excel (hay gặp ở cột Mã lớp) đến tay ứng dụng là ô trống. Hướng sửa: giữ ô Date tới lúc biết trường đích (giờ hay ngày), đọc ngày chữ theo dd/mm/yyyy, và giữ lại các dòng không gửi được thành dòng lỗi như `unreadableWeekdayRows`.

**Why:** (1) chặn mọi file lịch thật; (2) tạo lịch sai ngày bắt đầu mà không ai thấy; (3) người nhập không biết dòng nào sai.

**Context:** `normalizeCellValue`, `parseTimeValue`, `parseDateValue` trong `src/features/imports/classes/workbook.ts`; `prepareScheduleInputs` và `withUnreadableWeekdayRows` trong `src/features/imports/classes/class-schedule-import-page.tsx`; `scheduleImportRowInputSchema` trong `src/features/imports/classes/schemas.ts`; ép kiểu `::time`/`::date` trong `dry_run_class_schedule_import`; read-excel-file trả ô trống cho phần còn lại của ô gộp. Có từ trước (giống trên main). Review /ship v0.38.0.1 (red team), anh chọn ghi TODO; mức ưu tiên nâng lên P1 sau khi red team tìm ra (1) và (2), anh có thể hạ.

**Effort:** M
**Priority:** P1
**Depends on:** Không

### Nhập ghi danh: lô bị máy chủ từ chối vẫn báo "Đã tạo lô.", và lô đã tạo bị bỏ lại khi chọn file khác

**What:** (1) Khi máy chủ trả lô ở trạng thái bị từ chối, bước Tạo lô vẫn hiện "Đã tạo lô." (có từ trước bước 15b). Đọc trạng thái lô trả về và báo đúng. (2) Đã tạo lô rồi bấm Quay lại và "Chọn file khác" thì lô đó không còn đường mở lại trên giao diện (chưa có trang lô ghi danh). Cảnh báo trước khi rời một lô đã tạo, hoặc làm trang lô (xem mục "Trang lô cho nhập học sinh và nhập ghi danh").

**Why:** Người nhập tưởng lô sẵn sàng xác nhận; lô bị bỏ lại thì không xác nhận được nữa, và SHA-256 của file đã bị dùng.

**Context:** `src/features/imports/enrollments/enrollment-import-page.tsx` (dòng 711, nút quay lại và chọn file). Review /ship bước 15b (v0.38.0.0), red team.

**Effort:** M
**Priority:** P2
**Depends on:** Không

### Lô số dư buổi: trang lô đọc tối đa 1000 dòng, và lô có dòng lỗi không đi tiếp được

**What:** (1) Trang lô số dư buổi đọc các dòng bằng một truy vấn không phân trang, nên chỉ nhận tối đa 1000 dòng (giới hạn `max_rows` của PostgREST); lô lớn hơn hiện thiếu dòng mà không báo. (2) Lô có dòng không hợp lệ thì không ghi sổ được, và giao diện không có cách sửa nhanh: người nhập phải loại từng dòng hoặc bỏ lô. Cần quyết định của anh: cho loại hàng loạt các dòng lỗi, hay chặn tạo lô khi còn dòng lỗi.

**Why:** Số liệu lô sai lệch khi file lớn; lô kẹt không ai xử lý.

**Context:** `src/features/imports/session-balances/queries.ts`, `session-balance-batch-detail-page.tsx`. Review /ship bước 15b (v0.38.0.0), red team.

**Effort:** M
**Priority:** P3
**Depends on:** Quyết định của anh (phần 2)

### Review đối kháng bước 15b: các điểm nhỏ còn lại

**What:** (1) Khi không biết kết quả (mất phản hồi), tiêu đề banner vẫn ghi "Chưa ghi sổ", "Chưa phê duyệt", "Chưa đối soát", "Chưa tạo được lô", "Chưa nhập" dù phần mô tả nói có thể đã ghi; đổi tiêu đề thành "Chưa rõ kết quả". (2) Lỗi loại dòng ở trang lô số dư buổi có thể hiện dưới một dòng khác; gắn lỗi theo mã dòng. (3) File kéo thả được băm SHA-256 trước khi kiểm tra giới hạn 5 MB; kiểm tra kích thước trước. (4) Nhận biết "đã nhập/đã ghi danh", và lời từ chối "Dữ liệu đã thay đổi" mở nút "Kiểm tra lại" ở nhập học sinh, dựa vào chữ trong lỗi của server action; nên trả mã lỗi có cấu trúc.

**Why:** Câu chữ đúng sự thật khi mất phản hồi, và bớt phụ thuộc vào câu chữ máy chủ.

**Context:** banner kết quả ở bốn wizard trong `src/features/imports/`, `session-balance-batch-detail-page.tsx`, `enrollments/enrollment-import-page.tsx` (`computeSha256`, `BATCH_ALREADY_COMMITTED_CODE`), `students/student-import-commit-panel.tsx` (`toStudentImportCommitError`, `STUDENT_IMPORT_VALIDATION_FAILED_MESSAGE`). Review /ship bước 15b (v0.38.0.0), red team; review /ship v0.38.0.1 (maintainability).

**Effort:** S
**Priority:** P3
**Depends on:** Không

### Nhập học sinh và nhập lớp: các điểm nhỏ còn lại sau review v0.38.0.1

**What:** (1) Khi xác nhận nhập học sinh bị từ chối "Dữ liệu đã thay đổi hoặc còn dòng lỗi", đưa focus bàn phím tới nút "Kiểm tra lại" ngay lúc lời từ chối hiện (hiện chỉ trả focus sau một lần kiểm tra lại lỗi). (2) Sau lời từ chối đó, bấm Quay lại về "Kiểm tra dòng" vẫn hiện kết quả cũ "Không còn dòng lỗi." mà không ghi là đã cũ; thêm ghi chú kèm nút "Kiểm tra lại" ở bước đó. (3) Giới hạn 100 ký tự của ô "Thứ" đang đếm trước khi chuẩn hóa NFC, nên ô dạng tổ hợp dài gần 100 ký tự bị chặn còn cùng chữ dạng dựng sẵn thì đọc được; đếm sau khi chuẩn hóa (giữ một ngưỡng thô rộng hơn trước đó). (4) Lời nhắn "Không đọc được thứ trong tuần: …" vẫn chuẩn hóa cả ô trước khi cắt 40 ký tự, và chú thích trong mã nói quá; cắt phần đầu trước khi chuẩn hóa hoặc sửa chú thích. (5) Bảng xem trước ở bước Ánh xạ cột hiện "Không rõ thứ (…)" với cả ô, không cắt như lời nhắn ở bước Kiểm tra dòng. (6) Chốt chặn `hasUnreadableWeekday` trong `handleCreateBatch` trả về im lặng; nếu một thay đổi sau làm nó chạy tới, nút "Tạo lô" bấm được mà không có gì xảy ra; đưa điều kiện vào lý do khóa nút. (7) Dòng lịch bị giữ lại vì thứ không đọc được hiện giá trị thô (mã lớp chưa viết hoa, giờ như gõ) cạnh các dòng máy chủ đã chuẩn hóa. (8) Ba ca test còn thiếu: ô 41 emoji (nhánh cắt theo độ dài UTF-16), sheet Schedules không có dòng nào, lần kiểm tra đầu bị mất kết nối. (9) Gợi ý gọn lại phần cắt ô (bỏ phần đầu giới hạn nếu đã cắt trước khi chuẩn hóa).

**Why:** Không điểm nào ghi sai dữ liệu (review đối kháng cuối khuyên ship nguyên trạng); đây là trợ năng bàn phím, câu chữ nhất quán và test cho các nhánh mới.

**Context:** `src/features/imports/students/student-import-commit-panel.tsx` (`recheckButtonRef`), `src/features/imports/students/student-import-page.tsx` (bước Kiểm tra dòng), `src/features/imports/classes/workbook.ts` (`WEEKDAY_CELL_MAX_LENGTH`), `src/features/imports/classes/class-schedule-import-page.tsx` (`unreadableWeekdayMessage`, `formatPreviewCell`, `handleCreateBatch`); tests `tests/components/class-schedule-import-page.test.tsx`, `tests/components/student-import-page.test.tsx`. Review /ship v0.38.0.1 (vòng 3 và review đối kháng); anh chọn ship và ghi chung một mục P3.

**Effort:** S
**Priority:** P3
**Depends on:** Không

### Dọn nhỏ sau bước 15b

**What:** (1) `canImport` và `canReconcile` của trang số dư buổi mặc định `true`; đổi thành bắt buộc hoặc mặc định `false` (cả hai route đều truyền rõ; máy chủ vẫn chặn). (2) Trang lô lớp và wizard lớp tính vị trí bước theo chỉ số (`buildClassImportSteps(4, …)`, `index === 4`, `CLASS_IMPORT_STEP_TITLES[0]`); đặt theo khóa bước như wizard số dư. (3) Test `session-balance-import-page` "keeps the screen's four-eyes rule" chỉ tìm một dòng trong mã nguồn; thay bằng kiểm tra hành vi hoặc bỏ (hành vi đã có test ở `session-balance-approval-workflow`). (4) Test `enrollment-import-mapping` ghim việc tiêu đề không dấu ("Ma hoc vien") không khớp; tách thành ca riêng ghi rõ là hành vi hiện tại (ánh xạ ghi danh chưa chuẩn hóa dấu như học sinh và số dư).

**Why:** Không có lỗi người dùng thấy; giữ code và test dễ đổi về sau.

**Context:** Review /ship bước 15b (v0.38.0.0), chuyên gia bảo mật, maintainability và testing.

**Effort:** S
**Priority:** P4
**Depends on:** Không

## Completed

### Nhập học sinh: không có nút kiểm tra lại sau lời từ chối "Dữ liệu đã thay đổi"

**What:** Khi xác nhận nhập học sinh bị máy chủ từ chối với `STUDENT_IMPORT_VALIDATION_FAILED` ("Dữ liệu đã thay đổi hoặc còn dòng lỗi. Hãy kiểm tra lại trước khi xác nhận import."), bước Xác nhận chỉ hiện lỗi; người nhập phải tự quay lại bước Ánh xạ để chạy kiểm tra lại. Thêm nút "Kiểm tra lại" ngay ở lỗi đó (chạy lại dry-run với file và ánh xạ hiện tại) hoặc tự quay về bước Kết quả kiểm tra.

**Why:** Bản trước bước 15b có đường kiểm tra lại gần hơn; câu lỗi bảo "kiểm tra lại" mà màn hình không có nút làm việc đó.

**Context:** `src/features/imports/students/student-import-page.tsx` (`handleCommit`), `src/features/imports/students/actions.ts` (khoảng dòng 175). Review /ship bước 15b (v0.38.0.0), red team (hồi quy so với main).

**Effort:** S
**Priority:** P2
**Depends on:** Không

**Completed:** v0.38.0.1 (2026-10-24): lời từ chối đó có nút "Kiểm tra lại" ngay trong bước Xác nhận nhập, và nút xác nhận khóa ("Dữ liệu đã thay đổi hoặc còn dòng lỗi: bấm “Kiểm tra lại” trước khi nhập.") tới khi kiểm tra lại xong; nút chạy lại kiểm tra với file và ánh xạ đang giữ rồi mở bước Kiểm tra dòng với kết quả mới và câu "Đã kiểm tra lại." (giữ lý do đã gõ, bỏ dấu xác nhận). Kiểm tra lại lỗi thì báo ngay dưới lời từ chối, không hiện ở bước Ánh xạ cột.

### Nhập lớp: thứ trong tuần không đọc được bị ghi thành thứ Hai

**What:** `weekday: parsedWeekday ?? (Number(rawWeekday) || 1)` trong `class-schedule-import-page.tsx` đổi một giá trị thứ không đọc được thành 1 (thứ Hai) thay vì báo dòng lỗi. Cho dòng đó thành lỗi ở bước kiểm tra ("Không đọc được thứ trong tuần").

**Why:** Lịch lớp có thể bị tạo sai ngày mà không ai thấy. Có từ trước bước 15b (cùng dòng trên main).

**Context:** `src/features/imports/classes/class-schedule-import-page.tsx` (dòng 163), `src/features/imports/classes/workbook.ts`. Review /ship bước 15b (v0.38.0.0), red team.

**Effort:** S
**Priority:** P2
**Depends on:** Không

**Completed:** v0.38.0.1 (2026-10-24): dòng lịch có thứ không đọc được (kể cả ô trống) không còn gửi đi như thứ Hai mà thành dòng "Không hợp lệ" ở bước Kiểm tra dòng ("Không đọc được thứ trong tuần: …"), được đếm vào số dòng chặn "Tạo lô"; nếu cả sheet không đọc được thứ thì báo ngay ở bước Ánh xạ cột. Hàm đọc thứ cũng không còn đoán: số lẻ (1,5), ô ghi hai ngày ("Thứ 2, Thứ 4") là không đọc được, và chữ tiếng Việt dạng tổ hợp (Unicode tổ hợp) không còn bị đọc thành thứ Năm.

### Mở thông báo ngay khi bấm, đánh dấu đã đọc ở nền

**What:** Khi bấm một thông báo chưa đọc, mở trang đích ngay và gửi thao tác đánh dấu đã đọc ở nền, thay vì chờ thao tác (và lần render lại `/notifications` do `revalidatePath`) xong rồi mới `router.push`. Cần anh quyết vì đây là vòng sửa thứ tư sau review (quy định: quá 3 vòng cần anh duyệt). Đề xuất: duyệt, làm trước khi merge PR bước 14d hoặc ngay sau.

**Why:** Review bước 14d (hiệu năng, red team, lượt review chốt và review đối kháng đều chỉ ra cùng một điểm): (1) nếu trong lúc chờ người dùng bấm sang trang khác, khi thao tác xong `router.push` cũ vẫn có thể kéo họ về trang của thông báo; (2) thao tác treo thì bấm thường lên dòng đó không làm gì cho tới khi tải lại; (3) mỗi lần mở chờ thêm một vòng máy chủ. Theo tài liệu Next 16, thao tác vẫn chạy và trang đích được làm mới sau khi điều hướng, nên chuông thông báo vẫn cập nhật.

**Context:** `openRow` trong `src/features/notifications/components/use-notification-list-state.ts` (khoảng dòng 215–250); test `tests/components/notification-list-page.test.tsx` (các ca mở dòng, "only the latest of two opens"); ghi chép review ở `.gstack/ship-records/step14d.md` (P2, R2-5, B1, A1).

**Effort:** S
**Priority:** P2
**Depends on:** Quyết định của anh

**Completed:** v0.27.0.0 (2026-10-19), PR #44: anh duyệt vòng sửa thứ tư; thông báo mở ngay, đánh dấu đã đọc chạy ở nền.

### Bước 5b đợt 2: tab Học sinh, Kết quả, Học phí của trang lớp

**What:** Làm 3 tab còn lại của trang chi tiết lớp theo thiết kế `03-chi-tiet-lop`.

**Why:** Đợt 1 (v0.8.0.0) mới có Tổng quan và Buổi học; danh sách học sinh, kết quả và học phí của lớp vẫn phải xem ở trang khác.

**Context:** Dữ liệu dùng chung nằm ở `src/features/classes/detail/class-detail-data.ts` và `class-detail-models.ts`; preview ở `/dev/class`.

**Effort:** L
**Priority:** P1
**Depends on:** None

**Completed:** v0.9.0.0 (2026-10-14).

### Thêm trạng thái "withdrawn" vào danh sách trạng thái hợp lệ của loader

**What:** Thêm `"withdrawn"` vào `lifecycleStatuses` trong `src/features/students/data.ts` và thêm test loader có một học sinh đã nghỉ.

**Why:** Loader trả `invalid_student_data` cho cả trang khi gặp trạng thái lạ. Chỉ cần một học sinh bị "Nghỉ học (kết thúc ghi danh)" là `/students` lỗi với mọi nhân viên, và hồ sơ của em đó cũng lỗi.

**Context:** RPC `end_student_enrollment` (migration `20261013090100_phase2a_end_enrollment_withdrawn_close_class.sql`, có từ v0.6.16.0) ghi `lifecycle_status = 'withdrawn'`, nhưng danh sách trạng thái trong `data.ts` vẫn chỉ có 9 giá trị cũ. Lỗi đã có trên main nên sửa bằng hotfix riêng từ main (nhánh `fix/withdrawn-lifecycle-status`). Chip "Đã nghỉ" trên `/students` chỉ hoạt động sau khi sửa. Adversarial review lượt /ship 3 phát hiện.

**Effort:** S
**Priority:** P0
**Depends on:** None

**Completed:** v0.6.22.1 (2026-10-13), PR #14.
