# Changelog

All notable changes to Toan Thay Vinh ERP will be documented in this file.

## [0.6.22.0] - 2026-10-13

Sửa lỗi chặn vận hành buổi học, trợ giảng được bắt đầu/kết thúc buổi.

### Fixed
- **Tạo buổi học hàng loạt** (`/sessions/batch`) và hàm tạo buổi theo năm học bị lỗi `42P10` trên production từ bản 0.6.16.0: chỉ mục duy nhất (lịch, ngày) đã đổi sang bỏ qua buổi hủy nhưng mệnh đề `on conflict` của `create_batch_class_sessions` và `materialize_class_sessions` chưa đổi theo. Hai hàm được tạo lại với đúng điều kiện; thêm kiểm thử DB tạo lại được buổi sau khi hủy.
- Thông báo lỗi rõ ràng khi bấm Bắt đầu trước giờ học, khi buổi không ở trạng thái bắt đầu được, và khi tạo buổi trên lớp ghép thay vì lớp thành phần.

### Changed
- Vai trò **Trợ giảng** có thêm quyền `sessions.manage` (bắt đầu, kết thúc, hủy, dời, tạo buổi) vì điểm danh chỉ thực hiện được khi buổi đã bắt đầu.

## [0.6.21.0] - 2026-10-13

Tin nhắn phụ huynh qua nhóm Zalo sổ liên lạc (tích hợp ZaloCRM, thay cho kế hoạch Zalo OA/ZNS).

### Added
- **Hàng đợi tin nhắn phụ huynh** (`/parent-messages`, menu Học vụ): tin được tạo tự động khi điểm danh **vắng không phép** và khi có **nhận xét cuối buổi** (kèm điểm), gửi vào nhóm Zalo sổ liên lạc của học sinh từ **nick trung tâm** qua ZaloCRM. **Trợ giảng kiểm tra, sửa nội dung rồi bấm Gửi**; có bỏ qua kèm lý do, gửi lại khi lỗi, lọc theo trạng thái. Sửa điểm danh hoặc xóa nhận xét thì tin chờ tự bỏ qua; tin chờ quá 3 ngày hết hạn.
- **Liên kết nhóm sổ liên lạc** trên hồ sơ học sinh theo **mã nhóm Zalo (UID)**, không theo tên: tìm nhóm từ ZaloCRM theo tên/thành viên, một nhóm chỉ gắn một học sinh, nút "Kiểm tra liên kết" đọc lại tên nhóm hiện tại và tình trạng nick, gỡ liên kết có lý do.
- Cài đặt → Chung: chọn nick trung tâm từ ZaloCRM, bật/tắt từng loại tin, sửa mẫu tin (biến `{center} {student} {class} {date} {time} {comment} {scores}`).
- Client ZaloCRM (`lib/zalo-crm`), biến môi trường `ZALOCRM_BASE_URL`, `ZALOCRM_API_KEY`. Bản vá ZaloCRM (fork, commit `dc1f3829`): API public lọc nhóm theo tên/nick, tra nhóm theo UID, thành viên nhóm, danh sách nick, gửi tin trả `messageId`.

## [0.6.20.0] - 2026-10-13

Đợt 2 — nhóm 2e (bảo mật & vận hành).

### Added
- **Security headers** cho toàn bộ ứng dụng: Content-Security-Policy (chỉ cho phép chính ứng dụng, Supabase, VietQR, Google Fonts; `frame-ancestors 'none'`), HSTS, nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy (chỉ mở geolocation cho chấm công), COOP.
- **Cảnh báo vận hành trong ứng dụng**: RPC `raise_ops_alert` (chỉ service role) thông báo cho mọi tài khoản có quyền quản lý cài đặt kèm audit; worker pg_cron `ops-health-check` mỗi 15 phút báo tác vụ nền thất bại, tác vụ không chạy quá 3 giờ, webhook SePay lỗi. Route webhook SePay phát cảnh báo ngay khi ghi nhận thất bại.
- **Kênh cảnh báo ngoài** tùy chọn qua biến `ALERT_WEBHOOK_URL` (Slack / Zalo / Discord qua bộ chuyển): nhận cảnh báo vận hành và mọi lỗi máy chủ chưa bắt được (`src/instrumentation.ts` ghi JSON cho log drain và POST tới webhook).
- Workflow **Deploy (after Quality)**: deploy production bằng Vercel CLI chỉ sau khi CI xanh trên `main`; tự bỏ qua khi chưa có secrets. Hướng dẫn bật và tắt auto-deploy Git integration trong `docs/operations/monitoring.md`.
- Tài liệu `docs/operations/backup-restore.md`: sao lưu, PITR, quy trình khôi phục và diễn tập hàng quý.

### Notes
- Chưa cài Sentry (tránh thêm SDK và chi phí); log drain + webhook cảnh báo đủ cho quy mô hiện tại, hướng dẫn thêm Sentry khi cần.
- Cần chủ trung tâm chốt: bật PITR trên Supabase, tạo 3 secrets Vercel trên GitHub và đổi "Ignored Build Step" để deploy đi qua CI.

## [0.6.19.0] - 2026-10-13

Đợt 2 — nhóm 2d (chấm công 1 chạm, trang chủ theo vai trò).

### Added
- **Chấm công 1 chạm trên điện thoại**: nút "Chấm công" trên thanh đầu trang mở thẳng hộp thoại (không còn chuyển sang trang Chấm công); hộp thoại tự lấy vị trí GPS ngay khi mở ở hình thức tại trung tâm, ghi nhớ hình thức lần trước, nhãn "Vào ca / Ra ca" thay cho Check-in / Check-out. Ô Wi-Fi vẫn chỉ hiện khi chủ trung tâm bắt buộc.
- **Trang chủ theo vai trò**: khối "Hôm nay" đầu trang cho mọi tài khoản có quyền dashboard — trạng thái ca làm (vào/ra ca ngay tại chỗ), danh sách buổi học hôm nay, việc đang chờ (buổi chưa khóa, hẹn theo dõi lead đến hạn, thông báo chưa đọc) và thẻ lương ước tính tháng hiện tại (nếu có quyền xem lương). Nhân sự không có quyền tài chính/học vụ không còn thấy trang trống "Chưa có quyền xem".

### Changed
- Header dashboard lấy tên trung tâm từ cài đặt thay vì hard-code; nút "Xuất báo cáo" in ngay thay vì giả lập tiến trình 400 ms.

### Fixed
- Ba bộ test pgTAP phụ thuộc giờ hệ thống (giờ tự đóng ca 22:30/22:45) tự bỏ qua ngoài 06:00–21:30 giờ Việt Nam thay vì làm CI đỏ vào buổi tối.

## [0.6.18.0] - 2026-10-13

Đợt 2 — nhóm 2c (giao diện dùng chung, hàng đợi kế toán, dọn mã).

### Added
- **Primitive form dùng chung** `Field / Label / Input / Select / Textarea` (một chiều cao, một vòng focus, báo lỗi và gợi ý có aria); **Pagination** và **tiêu đề bảng sắp xếp được** (`SortableTableHeader` + hook `useSortedRows`) dùng chung. Trang Buổi học dùng pagination chung và sắp xếp theo ngày / lớp / trạng thái.
- Thư viện `lib/format` (₫ thống nhất, "triệu/tỷ") và `lib/datetime` (ngày, giờ, ngày-giờ theo giờ Việt Nam, ngày nghiệp vụ hôm nay) để các module dùng chung; dashboard chuyển sang dùng thư viện này.
- **Hàng đợi kế toán** trên trang Giao dịch SePay: nút "Cần đối soát (n)" lọc giao dịch tiền vào chưa khớp / sai số tiền / sai tài khoản / trùng nhận diện, giữ được bộ lọc tài khoản và phân trang; giao dịch chưa khớp hiện tone cảnh báo.
- Nhãn quyền tiếng Việt (`lib/permissions/labels`): 71 thông báo "không có quyền sepay.view" kiểu mã thô đổi thành "chưa được cấp quyền xem giao dịch SePay".
- Cấu hình Prettier (`npm run format`, `format:check`), chưa ép trong CI để tránh đổi định dạng hàng loạt.

### Changed
- Năm form tài chính chưa có style (tài khoản nhận SePay, mẫu phiếu học phí, phiếu thay thế, in phiếu, bộ lọc kỳ thu) dùng primitive mới; ô nhập không còn "vô hình".
- Bảng rộng cuộn ngang trong khung thay vì bị cắt; ngưỡng hiện bảng của Phiếu thu, SePay, Đơn hàng, Tạm ứng, Nhân sự hạ từ 1182–1882px xuống 1120px (laptop 1440px thấy bảng thay vì thẻ).

### Removed
- 15 file mock cũ của module học sinh (trang chi tiết mock, 13 tab/section không được import, dữ liệu chi tiết giả) — khoảng 3.000 dòng không chạy tới.

## [0.6.17.0] - 2026-10-13

Đợt 2 — nhóm 2b (CRM khép kín).

### Added
- **Kết quả học thử** trên từng lịch thử (đã đến / vắng / hủy, nhận xét giáo viên, ghi chú sale). Đến học thử chuyển lead sang "Đã học thử"; vắng hoặc hủy mà không còn lịch thử nào khác trả lead về "Đang quan tâm". RPC `record_crm_trial_result`.
- **Chuyển trạng thái lead có lý do**: "Chờ xác nhận nhập học", "Dừng lead" (lý do bắt buộc, hủy lịch thử đang chờ) và "Mở lại". RPC `advance_crm_case_status`; lý do dừng hiện trên trang lead.
- **Ghi chú & hẹn theo dõi** trên lead (`crm_case_notes`): ghi chú có ngày hẹn, đánh dấu đã xử lý; worker pg_cron `crm-follow-up-reminders` nhắc sale phụ trách mỗi sáng khi hẹn đến hạn hoặc quá hạn.
- Sale nhận **thông báo khi được giao lead** (tạo mới hoặc chuyển giao).
- **Phiếu thu tuyển mới trước khi chuyển đổi**: chuyển lead sang "Chờ xác nhận nhập học" tạo hồ sơ học sinh tạm (gắn phụ huynh chính) nên kế toán lập phiếu thu ngay và tiền về tự khớp theo mã chuyển khoản; phiếu thu ghi `crm_case_id`. Danh sách chọn học sinh khi tạo phiếu thu gồm cả hồ sơ tạm.

### Changed
- Chuyển đổi học viên chính thức dùng lại hồ sơ tạm thay vì tạo hồ sơ mới; mục 1 checklist "Đã nhận học phí" được hệ thống xác nhận khi học sinh có phiếu thu ở trạng thái đã thu; lead đã dừng không chuyển đổi được.

## [0.6.16.0] - 2026-10-13

Đợt 2 — nhóm 2a (học vụ khép kín).

### Added
- **Đổi lịch / sửa buổi học** còn ở trạng thái đã lên lịch (ngày, giờ, hình thức, phòng, link, ghi chú; bắt buộc lý do). Lịch cũ được lưu trên buổi và hiện "Đã dời … lần"; buổi chính được dời sang ngày khác thứ của lịch mẫu; chặn trùng ngày cùng lịch mẫu và chồng giờ cùng lớp. RPC `update_class_session`. Unique index (lịch mẫu, ngày) bỏ qua buổi đã hủy nên tạo lại được buổi cùng ngày sau khi hủy.
- **Hàng đợi "buổi đã hoàn thành chưa khóa"** đầu trang Buổi học (số ngày chờ, thiếu bao nhiêu điểm danh, ngày tự khóa dự kiến) và bộ lọc "Khóa: chưa khóa / đã khóa". RPC `get_unlocked_completed_sessions`.
- **Tự khóa buổi học** sau N ngày kể từ khi hoàn thành nếu đã điểm danh đủ (cài đặt `Tự khóa buổi học sau (ngày)` tại Cài đặt → Chung, mặc định 3, 0 = tắt). Worker pg_cron `class-session-auto-lock` mỗi giờ; khóa ghi tên người hoàn thành buổi và lý do "Tự động khóa". Nhắc người hoàn thành buổi sau 24 giờ chưa khóa và nhắc quản lý buổi học mỗi sáng khi còn tồn đọng (`class-session-lock-reminders`).
- **Kết thúc ghi danh / học sinh nghỉ** (`end_student_enrollment`, quyền quản lý trạng thái học sinh): đóng lớp hiện tại vào ngày nghỉ (không được ở tương lai) kèm lý do, học sinh sang trạng thái mới **Đã nghỉ**; quay lại học dùng nghiệp vụ "Quay lại học" như sau bảo lưu.

### Changed
- Chuyển trạng thái hàng loạt chỉ cho phép giữa các trạng thái trước ghi danh (quan tâm, đặt lịch học thử, đã học thử, chờ xác nhận, chờ chọn lớp); trạng thái gắn với ghi danh phải đi qua nhập lớp / chuyển lớp / bảo lưu / kết thúc ghi danh. Audit ghi thêm một dòng cho từng học sinh.
- Đóng hoặc lưu trữ lớp tự hủy các buổi còn "đã lên lịch" (lý do ghi rõ đóng lớp, có audit số buổi); còn buổi đang diễn ra thì không đóng được.
- Khóa buổi tách lõi dùng chung `lock_class_session_internal` cho thao tác tay và worker.

## [0.6.15.0] - 2026-10-12

Đợt 1 — ba việc còn lại (đảo phân bổ, KPI dashboard bằng SQL, hoa hồng theo ngày tiền về).

### Added
- **Đảo phân bổ giao dịch SePay** (nút "Đảo phân bổ" trên trang Giao dịch SePay, quyền `payments.manage`) cho giao dịch đã khớp tự động, khớp lịch sử hoặc phân bổ thủ công: trừ lại buổi bằng bút toán đối ứng trên sổ buổi (không xóa lịch sử), phiếu thu quay về trạng thái trước khi thu, gỡ lô buổi / dòng chia / dòng tiền / fact lương hệ thống / accrual hoa hồng, giao dịch trở về "Chưa khớp" để phân bổ lại. Từ chối khi tháng tiền về đã có kỳ lương duyệt; báo rõ kỳ lương nháp cần "Tính lại". Audit lưu toàn bộ snapshot. RPC `reverse_sepay_allocation`.
- **RPC `get_dashboard_executive_overview`** tính toàn bộ KPI dashboard (doanh thu/chi phí theo ngày tiền về, công nợ và tuổi nợ, phễu CRM, tình hình học sinh, lớp đông nhất, quỹ lương, hoạt động trong tháng, việc cần chú ý) trong một lượt SQL; mục không có quyền trả `null` và được ẩn.
- Sổ doanh thu hoa hồng có cột **Ngày tiền về** (`recognized_on`), sắp xếp theo ngày tiền về.
- **Cài ERP như ứng dụng (PWA)**, không qua store: manifest "Toán Thầy Vinh ERP" / "TTV ERP" (standalone, tiếng Việt, màu chủ đạo), bộ icon placeholder chữ "TV" trong `public/icons` (sinh bằng `scripts/generate-pwa-icons.mjs`, thay logo thật rồi chạy lại), apple-touch-icon 180×180, `viewport-fit=cover` với đệm `safe-area-inset-*` cho topbar, sidebar và drawer. Service worker (`@serwist/next`) chỉ cache tài sản tĩnh (`_next/static`, icon); `/api/*`, mọi request tới Supabase, trang và dữ liệu đều đi thẳng mạng để không bao giờ hiện số lương cũ hay dữ liệu phiên trước. Banner gợi ý cài: Android bắt `beforeinstallprompt`, iOS Safari hướng dẫn "Chia sẻ → Thêm vào MH chính"; đóng thì ẩn 14 ngày.

### Changed
- Doanh thu đủ điều kiện hoa hồng ghi nhận theo ngày tiền về ngân hàng (`recognized_at` = thời điểm ngân hàng ghi nhận, `recognized_on` = ngày nghiệp vụ VN) thay vì ngày kế toán phân bổ; accrual cũ được sửa lại một lần.
- Dashboard không còn tải nguyên bảng học sinh, dòng tiền, phiếu thu, CRM, lớp, buổi học về máy chủ ứng dụng để đếm; sửa luôn các truy vấn sai tên cột khiến thẻ Quỹ lương lỗi, bỏ ước lượng quỹ lương 5.500.000 đ/người (dùng dòng lương thật của lần tính hiện hành, chia theo vị trí), bỏ lỗi thiếu ngày 31 khi đếm buổi học, và chỉ hiển thị quỹ lương cho người có quyền quản lý/đối soát/duyệt lương hoặc `payroll.dashboard.view`.
- Phân bổ lại cùng giao dịch cho cùng học sinh sau khi đảo dùng khóa sự kiện sổ buổi có hậu tố (`:r1`, `:r2`…).

## [0.6.14.0] - 2026-10-12

Đợt 1 — nhóm 1d (khóa lương sau khi trả).

### Added
- **Ghi nhận đã trả lương** cho kỳ đã duyệt (ngày trả, tham chiếu chuyển khoản, ghi chú; quyền duyệt lương hoặc đối soát lương). Kỳ đã trả là cuối cùng: không mở lại, không tính lại; bảng lương hiển thị "Đã trả lương" kèm ngày và tham chiếu. RPC `mark_payroll_period_paid`.

### Changed
- Mở lại kỳ lương (về đối soát / về nháp) không còn dùng `session_replication_role = replica` (tắt toàn bộ trigger kể cả audit và khóa ngoại); trigger bảo vệ lịch sử cho phép đúng hai bước lùi khi RPC mở lại đặt cờ phạm vi giao dịch.

### Database
- `20261012150000_payroll_period_paid_and_scoped_reopen.sql`.

## [0.6.13.0] - 2026-10-12

Đợt 1 — nhóm 1c (vòng đời phiếu thu).

### Added
- **Hủy phiếu thu** đang chờ (chưa thu đồng nào) ngay trên danh sách Yêu cầu thanh toán, bắt buộc lý do, có audit; phiếu đã gắn vào kỳ thu học phí phải tái phát hành thay vì hủy.
- **Thanh toán dư / thiếu so với phiếu** khi phân bổ thủ công: chuyển nhiều hơn → phiếu thanh toán đủ, kế toán tự quyết tổng số buổi cộng (không ít hơn số buổi trên phiếu — quyết định chủ trung tâm 11/10/2026); chuyển ít hơn → phiếu chuyển `partially_paid`, cộng dồn số đã thu và vẫn mở để nhận lần chuyển sau. Trước đây hai trường hợp này kẹt vĩnh viễn ở "lệch số tiền".

### Database
- `20261012140000_payment_request_lifecycle_partial_and_overpay.sql` (RPC `cancel_payment_request`, `allocate_sepay_tuition_manually` chấp nhận thanh toán một phần/dư).

## [0.6.12.0] - 2026-10-12

Đợt 1 — nhóm 1b (học phí đúng số).

### Fixed
- **Tái phát hành phiếu học phí thay thế phiếu gốc**: phiếu thu gốc đang chờ bị hủy và trỏ sang phiếu thay thế; QR cũ không hiện nữa, mã chuyển khoản cũ không khớp tự động; không tái phát hành phiếu đã thu tiền. Trước đây hai phiếu cùng chờ nên công nợ đếm đôi và phụ huynh có thể trả theo phiếu cũ.
- **Số dư đầu kỳ không còn tính trùng buổi của chính kỳ đó**: các lần trừ buổi có ngày trong kỳ bị loại khỏi số dư đầu kỳ (tiền nạp trong kỳ vẫn tính), nên khóa kỳ sau khi kỳ đã bắt đầu không còn lập phiếu lại cho buổi đã trừ.
- **Nợ cũ không lên hai phiếu**: phần nợ đầu kỳ đã nằm trên phiếu chờ thanh toán của kỳ trước (chưa bị thay thế) không bị tính lại ở kỳ sau.
- **Kỳ thu không được chồng ngày với kỳ đã khóa** (kiểm tra khi tạo và khi khóa, mã lỗi `TUITION_PERIOD_OVERLAPS`).

### Database
- `20261012130000_tuition_reissue_supersedes_request.sql` (thêm `student_payment_requests.cancelled_at/_by/_reason`, `superseded_by_request_id`), `20261012130100_tuition_period_cutoff_balance_and_overlap.sql`.

## [0.6.11.0] - 2026-10-12

Đợt 1 — nhóm 1a (chấm công & kiểm soát).

### Changed
- Ca quên check-out tự đóng lúc **22:30 với trợ giảng, 22:45 với các vai trò còn lại** (trước đây 23:30 cho tất cả); không ai mở được ca mới sau mốc này. Ca tự đóng vẫn tính lương tới mốc đó (quyết định chủ trung tâm 11/10/2026).
- **Check-in online chỉ được khi có ca trong phân công lịch** và trong khoảng 15 phút trước/sau ca; không có ca xếp thì không check-in online được. Check-in tại trung tâm vẫn xác minh GPS như cũ.
- Hộp thoại chấm công ẩn ô Wi-Fi SSID/BSSID (điện thoại không đọc được, nhập tay không chứng minh gì); chỉ hiện khi chủ trung tâm bật yêu cầu Wi-Fi trong cấu hình xác minh.
- Tạm ứng lương: không được tự đối soát hoặc tự duyệt yêu cầu của chính mình.
- Giao dịch SePay chưa khớp từ **mọi nguồn** (kể cả webhook) đều có thể đánh dấu "đã hạch toán trước đây" hoặc "bỏ qua" kèm lý do, kể cả khi lệch số tiền/lệch tài khoản; trước đây chỉ áp dụng cho dòng nhập từ API lịch sử nên tiền không phải học phí kẹt mãi ở hàng đợi.

### Database
- `20261012120000_timekeeping_role_cutoff_and_online_shift_window.sql`, `20261012120100_salary_advance_no_self_decision.sql`, `20261012120200_sepay_exception_resolution_all_sources.sql`.

## [0.6.10.0] - 2026-10-11

### Added
- Thu hồi phân công khối phụ trách của trợ lý vận hành ngay trên hồ sơ nhân sự (nút "Thu hồi" cạnh khối đang mở): chọn ngày kết thúc và lý do; khối được giải phóng từ ngày kế tiếp để phân cho người khác, lịch sử giữ nguyên, có audit. Không cho chọn ngày trong tháng lương đã chốt, không tự thu hồi khối của chính mình. RPC `end_staff_grade_assignment`.

### Database
- `20261012110000_end_staff_grade_assignment.sql`.

## [0.6.9.0] - 2026-10-11

### Added
- Gợi ý khớp giao dịch SePay chưa phân bổ (Tài chính → Giao dịch SePay, người có quyền phân bổ): hệ thống đọc nội dung chuyển khoản, đối chiếu tên học sinh, năm sinh, mã học sinh và số điện thoại phụ huynh chính, gắn mức tin cậy (cao / cần kiểm tra), gợi ý số buổi từ đơn giá hiện hành. Kế toán sửa số buổi nếu cần và xác nhận từng dòng hoặc xác nhận hàng loạt các dòng tin cậy cao; mỗi xác nhận đi qua `allocate_sepay_tuition_manually` như phân bổ thủ công. RPC `suggest_sepay_allocation_matches` chỉ đọc.

### Database
- `20261012100000_sepay_allocation_suggestions.sql`.

## [0.6.8.0] - 2026-10-11

### Fixed
- Doanh thu và thưởng theo doanh thu (ngưỡng tuyển sinh, gia hạn coaching, kỷ lục gia hạn) tính theo **ngày tiền về ngân hàng** thay vì ngày kế toán phân bổ. Giao dịch chuyển tháng 9 nhưng phân bổ đầu tháng 10 trước đây bị tính vào tháng 10, làm doanh thu tháng 9 hiển thị 10 triệu thay vì 62 triệu đã phân bổ (quyết định chủ trung tâm 11/10/2026).
- Phiếu thu có thêm `effective_on` (ngày nghiệp vụ, múi giờ VN; tự điền từ giao dịch SePay); dashboard doanh thu theo tháng/năm và cơ cấu doanh thu dùng cột này. Các fact lương đã ghi theo ngày phân bổ được sửa lại một lần trong migration.

### Database
- `20261012090000_cashflow_effective_on_bank_date.sql`. Kỳ lương tháng 9 (đang nháp) cần bấm "Tính lại" để cập nhật.

## [0.6.7.0] - 2026-10-11

### Added
- Xóa tài khoản nhân sự tại Cài đặt → Người dùng (chỉ Owner đang hoạt động, bắt buộc nhập lý do): thu hồi toàn bộ vai trò và lời mời đang chờ, chuyển trạng thái "Đã nghỉ", ẩn khỏi danh sách nhân sự/phân ca/bảng lương, chặn đăng nhập. Lịch sử chấm công, lương, điểm danh được giữ nguyên để đối soát; tài khoản chưa phát sinh dữ liệu nào thì xóa hẳn cả đăng nhập. Không xóa được chính mình hay tài khoản đang giữ vai trò Owner. RPC `delete_staff_account`, có audit.

### Changed
- CI sinh types từ CLI local cùng phiên bản với kho mã; `database.generated.ts` được sinh lại theo cách đó để bước kiểm tra lệch types không báo sai vì khác generator.

### Database
- `20261011120000_delete_staff_account.sql` (thêm `profiles.account_deleted_at/_by/_reason`, RPC `delete_staff_account`).

## [0.6.6.0] - 2026-10-11

Đợt vá khẩn sau rà soát toàn hệ thống (xem `docs/review-toan-he-thong-2026-10-10.md`).

### Security
- Dữ liệu nguồn lương (`payroll_source_facts`, `payroll_calculation_runs`) chỉ còn đọc được bởi chính nhân sự đó hoặc người có quyền quản lý lương; trước đây mọi vai trò có `payroll.view` đều đọc được của nhau.
- Nhận lời mời tài khoản yêu cầu email trong phiên đăng nhập đã được xác minh (`email_verified`), chặn việc đăng ký trùng địa chỉ để chiếm vai trò.
- Bỏ đường dự phòng dùng service-role khi tạo buổi học hàng loạt; RPC từ chối thì báo lỗi rõ ràng thay vì chèn thẳng vào bảng, bỏ qua kiểm tra của DB. Thêm luật ESLint cấm import service-role ngoài webhook SePay và đồng bộ lịch sử SePay.
- Webhook SePay không còn ghi nguyên nội dung giao dịch (tên người chuyển, số tài khoản) vào log; PDF phiếu lương trả `Cache-Control: no-store`.

### Fixed
- Khóa buổi học không còn bắt buộc có điểm kiểm tra cho mọi học sinh có mặt (đúng hợp đồng nghiệp vụ); điểm danh đầy đủ vẫn là điều kiện khóa.
- Chia lead CRM tự động: role `consultant` không tồn tại được đổi thành `admissions_specialist`; cấp quyền CRM cho chuyên viên và quản lý tuyển sinh. Trước đây mọi lead tự động dồn về trưởng nhóm.
- Dashboard: bỏ "doanh thu ước tính" theo lớp (số giả định `học sinh × 1.800.000`), phễu tuyển sinh dùng đúng trạng thái CRM thật nên tỷ lệ chuyển đổi không còn luôn 0%, nhãn danh mục thu khớp với dữ liệu.
- Chăm sóc học viên: leo thang công việc Coaching tháng quá hạn nay chạy được (trước là mã chết).
- Xuất báo cáo buổi học lọc theo ngày ngay trong truy vấn, không còn cắt 300 buổi mới nhất rồi mới lọc.
- Ước tính lương hiện "Dữ liệu tính lúc" theo giờ server thay vì giờ máy người xem; mã vị trí hiện tên tiếng Việt.
- Hộp thoại "thay đổi chưa lưu" bỏ chữ "mock"; thêm trang lỗi trong khung ứng dụng (giữ sidebar) và trang 404 tiếng Việt; không hiện thông điệp lỗi thô.

### Changed
- Design token: `text-secondary` trở lại đúng vai trò cỡ chữ 13px (trước bị `--color-secondary` ghi đè thành màu); định nghĩa thêm `bg-field-bg`, `bg-surface-canvas`, `border-neutral-border`; thay toàn bộ class không tồn tại (`text-section`, `text-kpi`, `text-warning-text`, `text-text-primary`...) bằng token đúng. Thêm test chặn dùng lại.
- Nút nguy hiểm chuyển sang kiểu viền (không còn trùng màu đỏ với nút chính); chữ trên nút chính ở dark mode đổi sang trắng để đạt tương phản.
- Sinh lại `database.generated.ts` từ schema thật; CI kiểm tra types không lệch migration, chạy thêm bộ test DB chăm sóc học viên, lịch tuần và lương theo ngày.

### Database
- `20261011090000_restrict_payroll_source_facts_rls.sql`, `20261011090100_lock_session_without_test_score.sql`, `20261011090200_fix_crm_round_robin_role.sql`, `20261011090300_fix_student_care_monthly_escalation.sql`, `20261011090400_invitation_requires_verified_email.sql`.

## [0.6.5.0] - 2026-10-10

### Added
- Bảng lương theo ngày trong mục Bảng lương của nhân sự: liệt kê đủ các ngày trong tháng, mỗi ngày gồm ca làm việc (giờ vào/ra, online/offline, chờ xác minh), giờ công đã tính, lương công, phụ cấp/thưởng phát sinh đúng ngày và thành tiền; ca đang mở hiển thị "đang làm, chưa tính tiền".
- Tách riêng mục "Khoản tính theo tháng" (thưởng quỹ chấm bài, thưởng ngưỡng doanh thu, bù trừ lương khoán, tạm ứng, điều chỉnh thủ công) để tổng theo ngày cộng khoản theo tháng luôn khớp lương tạm tính.
- Chủ trung tâm ấn vào tên nhân sự trong Tổng quan quỹ lương để mở hộp thoại lương theo ngày của tháng đang xem, cập nhật thời gian thực; RPC `get_staff_payroll_estimate` (quyền `payroll.dashboard.view`) và API `/api/payroll/staff-estimate`.

### Changed
- `get_my_payroll_estimate` trả thêm toàn bộ ca trong tháng (`shifts`) và ngày phát sinh (`workDate`, `sourceKind`) cho từng dòng lương, kể cả với kỳ đã duyệt; công thức tính lương không thay đổi.

## [0.6.4.1] - 2026-09-29

### Fixed
- Đồng bộ tổng quan lương tạm tính với Bảng lương bằng cách tính cả thưởng và khấu trừ thủ công của kỳ hiện tại.
- Không cộng trùng điều chỉnh thủ công khi tính lại lương; tự làm mới tổng quan khi khoản điều chỉnh được thêm, sửa hoặc xóa.

## [0.6.4.0] - 2026-09-28

### Added
- Phân bổ thủ công giao dịch SePay cho một hoặc nhiều học sinh, nhập tiền, buổi mua và buổi tặng; xem lại tổng phân bổ trước khi xác nhận.
- Chọn yêu cầu thanh toán đã có để hoàn tất công nợ hoặc thu trực tiếp khi học sinh chưa có yêu cầu mở.
- Xem chi tiết phân bổ, người thực hiện, thời điểm và lý do; ghi nhận khoản thu, đơn hàng và số buổi cùng một lần, chặn phân bổ trùng khi thao tác đồng thời.

### Fixed
- Cho phép đối soát giao dịch nhận trực tiếp qua webhook và giao dịch sai số tiền/loại yêu cầu; không còn giới hạn ở lịch sử SePay API.

## [0.6.3.0] - 2026-09-23

### Fixed
- Kỳ thu hiển thị đầy đủ học viên và buổi học vượt giới hạn 1.000 dòng; phân biệt thiếu dữ liệu với tổng học phí bằng 0.
- Xem từng học viên thiếu giá, nguồn hoặc phụ huynh chính; bổ sung đơn giá và nguồn theo nhóm trong kỳ nháp, lưu nguyên khối và giữ lịch sử.
- Xuất danh sách cần bổ sung ra Excel với đơn giá và nguồn chưa xác nhận để trống.
- Nội dung chuyển khoản mới gồm họ tên, năm sinh, số điện thoại phụ huynh và mã phiếu; bảo toàn QR cũ, chặn khớp mơ hồ và mã đã trả chuyển sang phiếu mới.
- Khóa kỳ rỗng bị chặn; giao diện giải thích thời điểm tạo yêu cầu thanh toán hàng loạt.

## [0.6.2.1] - 2026-09-19

### Fixed
- **Khôi phục hiển thị Lương tạm tính trên môi trường Production**: Đẩy migration `20260918160000_payroll_live_estimate_engine.sql` lên cơ sở dữ liệu Supabase production (`ptkbpkdosjrfpfkpmlwn`), cung cấp đầy đủ các hàm RPC `get_my_payroll_estimate` và `get_owner_payroll_estimate`.
- **Cơ chế tải dữ liệu phía client**: Thêm lệnh kích hoạt tải dữ liệu ngay khi component mount trong hook `usePayrollLiveEstimate`, ngăn chặn tình trạng kẹt skeleton vô hạn.
- **Trạng thái dự phòng và nút thử lại**: Bổ sung trạng thái fallback hiển thị thông báo thân thiện và nút "Thử lại" trên cả thẻ nhân sự (`StaffLiveEstimateCard`) và dashboard chủ trung tâm (`OwnerLiveEstimateOverview`) khi có sự cố kết nối hoặc dữ liệu chưa sẵn sàng.

## [0.6.2.0] - 2026-09-18

### Added
- **Lương tạm tính cập nhật theo phát sinh** tích hợp trực tiếp vào phân hệ Bảng lương (`/payroll` và `/payroll/dashboard`).
- Thẻ lương tạm tính cho nhân sự (`StaffLiveEstimateCard`) hiển thị số tiền tạm tính tính đến hiện tại, phân tích chi tiết theo công, phụ cấp, thưởng/hoa hồng và trừ tạm ứng.
- Cảnh báo minh bạch cho các ca làm việc đang chờ xác minh công và ca đang mở (chưa checkout).
- Tổng quan điều hành cho chủ trung tâm (`OwnerLiveEstimateOverview`) với 4 chỉ số KPI chính: tổng thu nhập, lương tạm tính phải trả, nhân sự phát sinh công và tỷ lệ chi phí lương / học phí thực thu net.
- Kiến trúc CSDL 3 lớp: nguồn dữ liệu chuẩn hóa, hàm chiếu thuần túy `compute_payroll_projection`, adapter ghi bảng lương chính thức `generate_payroll_calculation_run` kết hợp khóa phân tán `pg_advisory_xact_lock` theo tháng.
- Bảng chỉ thị đồng bộ siêu nhẹ `payroll_live_revisions` theo dõi thay đổi từ chấm công, xác minh công và tạm ứng; tích hợp Supabase Realtime với debounce 400ms và fallback polling 30s.
- 2 RPC bảo mật: `get_my_payroll_estimate` và `get_owner_payroll_estimate` cùng 2 Route Handlers `GET /api/payroll/estimate` và `GET /api/payroll/owner-estimate`.

## [0.6.1.0] - 2026-09-17

### Added
- **Phân hệ Chăm sóc học viên** (`/student-care`): trang danh sách, trang chi tiết công việc, thẻ tóm tắt trên dashboard và phần cảnh báo trong hồ sơ học viên.
- Cảnh báo sớm tự động theo ba quy tắc: vắng 2 buổi liên tiếp, vắng 3 buổi trong tháng dương lịch, điểm kiểm tra cuối buổi dưới 6 trong hai bài gần nhất.
- Coaching hằng tháng: mỗi học viên đang học có một nhiệm vụ mỗi tháng, trợ lý phụ trách ổn định, hạn hoàn thành trước ngày 25.
- Luồng nhận việc chống hai trợ lý nhận đồng thời (optimistic concurrency); ghi lịch sử liên hệ, chuyển người phụ trách và liên kết Coaching.
- Nhắc hạn hằng ngày (08:00 giờ Việt Nam), báo chủ trung tâm sau 72 giờ nếu cảnh báo chưa được nhận xử lý.
- Thông báo tổng hợp khi kích hoạt lần đầu; không gửi dồn từng cảnh báo lịch sử.
- Ba migration nền tảng: `student_care_tasks`, `student_care_events`, `student_care_settings`, `student_care_evaluation_queue`, RPC đọc/ghi, trigger tự động và cron job.
- Tài liệu vận hành `STUDENT_CARE_OPERATIONS.md` với hướng dẫn triển khai, giám sát và xử lý lỗi.

## [0.6.0.0] - 2026-09-16

### Added
- Phân công trợ giảng theo từng tuần: chọn tuần, xem lại lịch sử, mỗi tuần lưu phân công riêng.
- Thêm, đổi hoặc hủy ca theo ngày; khóa lịch đã có chấm công và ngăn ghi đè đồng thời.
- RPC `get_weekly_shift_schedule`, `save_weekly_shift_assignment` với optimistic concurrency.

### Fixed
- Chấm công ca qua đêm sử dụng lịch của ngày bắt đầu ca (kể cả ca Chủ nhật sang thứ Hai).

## [0.5.2.0] - 2026-09-10

### Added
- Tính năng Tạo buổi học hàng loạt giống ClassIn (/sessions/batch):
  - Hỗ trợ tạo buổi theo lịch cố định của lớp (`class_schedule_templates`) hoặc tùy chỉnh ngày trong tuần.
  - Hỗ trợ linh hoạt theo số lượng N buổi (ClassIn style) hoặc theo khoảng thời gian.
  - Quy tắc đặt tên và đánh số thứ tự buổi học tự động (`Buổi {n}`) dựa trên số buổi hiện có của lớp.
  - Bảng xem trước thông minh (Smart Preview): Cho phép tick/bỏ tick từng buổi để loại trừ ngày nghỉ lễ, Tết; phát hiện và cảnh báo trùng lịch; cho phép sửa nhanh giờ học trực tiếp trên bảng.
  - Server action `createBatchSessionsAction` với kiểm tra quyền `sessions.manage`, kiểm tra năm học active, batch insert an toàn và ghi audit log đầy đủ.
  - Điểm truy cập thuận tiện: Nút "Tạo hàng loạt" trên trang Buổi học (/sessions) và trang Chi tiết lớp học (/classes/[classId]).

## [0.5.1.0] - 2026-09-10

### Added
- Không gian làm việc buổi học (Session Workspace): Tích hợp tab chuyển đổi "Đầu giờ · Điểm danh" và "Cuối giờ · Kết quả", giữ nguyên bản nháp và hỗ trợ điều hướng phím (Home/End/Mũi tên).
- Tìm kiếm danh sách học viên nhanh (Roster Search): Hỗ trợ gõ không dấu (kể cả chữ Đ), lọc học viên chưa điểm danh hoặc chưa có kết quả kèm bộ đếm số lượng hiển thị.
- Điểm danh nhanh 1 chạm: Ghi có mặt tức thì theo hình thức học đã đăng ký của học sinh mà không cần mở hộp thoại chỉnh sửa.
- Tự động chuyển học viên khi nhập điểm: Nút "Lưu và học viên tiếp theo" lưu kết quả hiện tại và chuyển tiếp ngay sang học viên tiếp theo có đi học (bỏ qua học sinh vắng), giữ lại bản nháp nếu lỗi mạng.
- Luồng tạo và bắt đầu buổi học nhanh: Tùy chọn "Bắt đầu ngay" khi tạo buổi để vào thẳng màn hình điểm danh; cơ chế thử lại nếu chưa đến giờ mà không tạo trùng buổi học.

### Fixed
- Cập nhật test shell xác thực đồng bộ với BrandingProvider mới.

## [0.5.0.0] - 2026-09-09

### Added
- Cài đặt Thương hiệu & Giao diện (/settings/branding): Logo, Favicon, mô tả, màu website, bảng màu ERP mặc định và bo góc mềm; hỗ trợ cá nhân hóa giao diện lưu trên trình duyệt.
- Cài đặt Trang web công khai (/settings/website): Soạn tối đa 12 trang, 20 khối/trang (hero, nội dung, hình ảnh, liên hệ), sắp xếp khối, menu, xem trước inline.
- Phân tách bản nháp (draft) và bản xuất bản (published) với kiểm tra phiên bản chống ghi đè đồng thời (optimistic concurrency).
- Trang web công khai tại /site và /site/[slug] chỉ hiển thị bản đã đăng, an toàn không truy vấn dữ liệu vận hành nội bộ.
- Migration cơ sở dữ liệu `20260909140000_branding_public_website.sql` với bảng `website_configuration` và các RPC hàm bảo mật.

### Changed
- Cập nhật giao diện ERP mặc định sang tông đỏ ấm Terracotta (#B83C30), nền canvas sáng ấm (#FAF9F6) và bo góc mềm theo nhận diện Stumana.

## [0.4.4.0] - 2026-09-08

### Fixed
- Restore timekeeping actions, monthly filters and staff timesheet detail loading after server action requests crashed the page.
- Open manual attendance forms without showing an error before submission.
- Keep connection errors inside timesheet panels and attendance forms; clear stale monthly results after changing filters.
- Display weekdays consistently across browser time zones.

## [0.4.0.2] - 2026-09-07

### Fixed
- Auto-end stale open time entries across all staff roles (including assistant manager) at the 23:30 VN daily cutoff.
- Update personal timekeeping read model to include any open entries across dates so active attendance is never hidden.
- Automatically clean up historical unclosed time entries.

## [0.4.0.1] - 2026-09-07

### Fixed
- Acknowledge SePay test webhook pings (`id: 0`) immediately with HTTP 200 without attempting database transaction processing.
- Make SePay webhook payload schema resilient by accepting string coercion for `id`, `accountNumber`, and `transferAmount`, defaulting missing transfer amount to 0, mapping credit/debit aliases, and falling back to description when content is absent.
- Support both Vietnam standard timestamp (`YYYY-MM-DD HH:mm:ss`) and ISO 8601 strings with timezone offsets in webhook date parser.
- Return explicit validation failure details in HTTP 400 responses to aid diagnostics from the SePay webhook dashboard.

## [0.4.0.0] - 2026-09-07

### Added
- Configure separate SePay API account identities for new enrollment and renewal in Finance → Receiving accounts, with owner-only changes and an audit trail.
- Preview and import up to 31 days of SePay history from Finance → SePay transactions, with bounded pages, saved progress, retry support, and recent sync logs.
- Reconcile historical receipts explicitly: match a compatible payment request, mark previously accounted, or ignore with a reason. Importing alone never creates tuition credit or cashflow.

### Fixed
- Keep API UUIDs separate from numeric webhook IDs and link duplicate deliveries without recording tuition twice, including delayed webhooks and reference drift.
- Reject history pages outside the selected account/date window or with incomplete totals; preserve retry sessions after connection loss and show configuration-loading failures.
- Attribute historical tuition receipts and downstream payroll/commission source facts to the actual bank transfer date while retaining the operator action time in audit records.

## [0.3.0.7] - 2026-09-04

### Added
- **Owner-Managed Attendance Verification**:
  - Center owners can now configure attendance geofence (coordinates, radius 20–2,000m, max GPS accuracy 20–200m) directly on the Timekeeping page.
  - Configurable Wi-Fi check-in and check-out verification with up to 20 SSID/BSSID pairs.
  - Granular permission `timekeeping.manage_verification` defaulted to owner role with full audit logging.
  - Persist Wi-Fi check-out metadata and align "My Timekeeping" block with Vietnam timezone today filter.

## [0.3.0.6] - 2026-08-31

### Improved
- Keep the authenticated navigation visible and interactive while modules load; show a separate shell placeholder during initial authentication.
- Add navigation feedback and consistent, visible loading messages with responsive skeletons, dark-mode support, and reduced-motion support.
- Load independent timekeeping, notification, and center-name requests concurrently after access checks.

### Fixed
- Restore missing skeleton surface colors and prevent loading placeholders from overflowing narrow mobile screens.
- Keep mobile navigation feedback mounted until navigation commits, and prevent menus from reopening on browser Back.
- Make the Coaching dialog focus-restoration test wait for effect cleanup, avoiding the existing CI timing failure without changing application behavior.

## [0.3.0.3] - 2026-08-28

### Added
- **Staff Payslip Web View & PDF**: Added standalone payslip view at `/payroll/[periodId]/statements/[statementId]/payslip` and printable PDF export with Navy blue brand identity, full breakdown tables, masked bank accounts, and Vietnamese currency words.

## [0.3.0.2] - 2026-08-28

### Fixed
- **Dynamic Payroll Grade Assignment Resolution**: Updated `generate_payroll_calculation_run` and `sync_payroll_order_facts` to resolve staff dynamically from `staff_grade_assignments` as of the order's `event_date` for renewal orders, eliminating false `missing_grade_assignment` blocking issues on recalculations.
- **Operations Lead Source Mapping & Policy**: Added system mapping for `referral_teacher` to `teacher_vinh_zalo_direct_referral` and updated `operations_new_enrollment` policy parameters to include all fixed source bonus codes (`teacher_vinh_zalo_direct_referral`, `self_sourced`), eliminating `missing_source_mapping` blocking issues.
- **Contextual Payroll Issue Presentation**: Enriched `details` payload in `payroll_calculation_issues` and upgraded `PayrollPage` to render key context details (grade, event date, source code, order value, order ID) directly under each issue.

## [0.3.0.1] - 2026-08-28

### Fixed
- **Payroll Statement Current Revision Selection**: Restricted `get_payroll_periods_with_details()` to only return statements matching `period.current_calculation_run_id`, preventing manual line adjustment submissions from referencing stale calculation run statement IDs.
- **Payroll Manual Line Error Messaging**: Added Vietnamese user-facing error mappings for `PAYROLL_MANUAL_LINE_REQUIRES_CURRENT_OPEN_DRAFT` and `PAYROLL_MANUAL_LINE_SELF_CHANGE_FORBIDDEN`.

## [0.3.0.0] - 2026-08-28

### Added
- **Owner Payroll Dashboard**: Added a permission-gated executive dashboard at `/payroll/dashboard` with monthly and payroll-position filters, five payroll KPIs, position allocation and trend charts, payroll composition, top employees, notable month-over-month changes, deterministic insights, and a sortable position summary.
- **Payroll Analytics Read Model**: Added a single database RPC that aggregates only the current payroll calculation run, reuses payable payroll line items, resolves effective payroll positions by month, and avoids employee-level N+1 queries or calculation-revision double counting.
- **Dashboard Quality Coverage**: Added pgTAP, unit, route, and component tests for owner-only access, current-versus-previous-month calculations, new and departed employees, empty/error states, dynamic positions, and null-safe percentages.

## [0.2.0.0] - 2026-08-26

### Added
- **Complete Payroll Calculation Engine**: Integrated multi-role compensation calculation (Teaching Assistant, Operations Assistant, Admissions Manager) including base salary calculation from minute-level timekeeping, teaching allowance (40k/session), grading bonus pool distribution, admissions revenue tiers (4%-8%), operations grade renewals (2%), piecework floor offsets (85%), and salary advance single deduction.
- **Excel Import & Verification Pipeline**: Added payroll import batch workflow for timekeeping, grading, renewal orders, and new enrollment orders with duplicate detection, validation status tracking, and conflict resolution.
- **Feedback & Correction Request Workflow**: Staff can submit correction requests with item-level details and evidence URLs; resolvers can accept/reject requests; feedback window closure strictly gates review submission until recalculation is performed.
- **Staff Compensation & Profile Management**: Added immutable position versions, daily rate versions, grade assignments, payroll tasks, and bank account change request workflows.
- **PgTAP & Vitest Test Coverage**: Added comprehensive test suites verifying all 10 P0 & P1 business contracts and achieving high unit test coverage across payroll and staff schemas and read models.

### Fixed
- **Audit Trigger Contract**: Fixed `audit_payroll_period_change` to use unqualified `coalesce()` instead of non-existent `pg_catalog.coalesce()` and properly audit `payroll_calculation_revised` and `payroll_feedback_closed` events.
- **Calculation Run Uniqueness & Recalculation**: Scoped salary advance deduction uniqueness to statement level to allow immutable multi-revision recalculations without constraint conflicts.

## [0.1.1.0] - 2026-08-13

### Added
- **Universal Staff Self-Attendance**: Granted `timekeeping.check` permission across all active staff roles (Owner, Admin, Accountant, Management Assistant, Teaching Assistant, Sales) via database migration `20260813020000_grant_timekeeping_check_to_all_staff_roles.sql`.
- **Topbar Attendance Action**: Added a prominent "Chấm công" button to the right side of the topbar, positioned immediately to the left of the light/dark theme toggle, with white text and clock icon styling across light and dark themes.

### Fixed
- **Timekeeping Route Permission Model**: Fixed authorization on `/timekeeping` to allow staff accounts with `timekeeping.check` to access and operate their own attendance panel while strictly isolating administrative staff attendance lists and shift schedule tables to users with `timekeeping.view`.
