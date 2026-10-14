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

### Cảnh báo "N người sẽ mất quyền" trên ma trận phân quyền

**What:** Khi bỏ tick một quyền của vai trò trên `/settings/permissions`, hiện cảnh báo warning "N người sẽ mất quyền X khi lưu" trong hộp thoại lý do (thiết kế 9b).

**Why:** Thu hồi quyền ảnh hưởng ngay từ lần tải trang kế tiếp của mọi người giữ vai trò đó; Owner hiện không thấy số người bị ảnh hưởng trước khi lưu.

**Context:** Bước 9 của redesign bỏ khối này vì trang chưa đọc danh bạ nhân sự. Cần đọc `user_role_assignments` (hoặc `getStaffDirectory({ includeRoles: true })`, cần `staff.view`) và tính người mất quyền theo hợp các vai trò (một người còn vai trò khác có quyền đó thì không mất).

**Effort:** M
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
