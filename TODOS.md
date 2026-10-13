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

## Completed

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
