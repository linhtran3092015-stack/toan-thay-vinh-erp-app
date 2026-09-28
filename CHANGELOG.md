# Changelog

All notable changes to Toan Thay Vinh ERP will be documented in this file.

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
