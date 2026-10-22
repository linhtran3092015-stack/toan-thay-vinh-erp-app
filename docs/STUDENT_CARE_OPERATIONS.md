# Vận hành chăm sóc học viên

## Phạm vi phiên bản đầu

- Trang `/student-care`, thẻ dashboard và hồ sơ học viên; thông báo trên chuông hiện có.
- Vắng CP/KP 2 buổi liên tiếp hoặc 3 buổi trong tháng dương lịch Việt Nam. Gộp tất cả lớp. Buổi chưa có điểm danh không tự tính vắng; buổi đã hoàn thành mới được đánh giá.
- Hai bài kiểm tra cuối buổi có điểm gần nhất đều dưới 6. Bỏ qua buổi không có điểm; điểm đúng 6 ngắt chuỗi. Điểm trên bản ghi vắng không được tính.
- Một cảnh báo đang mở/học viên, gộp bằng chứng; sửa dữ liệu sẽ tính lại, giữ lịch sử và yêu cầu rà soát khi bằng chứng không còn đúng.
- Nhận trong 24h, liên hệ đầu trong 48h; nhắc hằng ngày từ 08:00 giờ Việt Nam, báo chủ trung tâm sau 72h nếu bước ban đầu còn quá hạn. Lần gọi chưa liên lạc được phải có lịch thử lại; chưa được tính hoàn thành.
- Coaching tháng: active/resumed, một nghĩa vụ/tháng, người phụ trách lâu dài do chủ trung tâm phân công. Lịch trải ngày 1–25, học viên mới được đưa vào kỳ hiện tại, hạn cuối tháng. Không tự chia nhân sự khi chưa có phân công.
- Hoàn thành cần cuộc trao đổi thực chất, tình hình tiến bộ, khó khăn, hướng hỗ trợ, kết quả và lịch theo dõi. Liên hệ có thể phục vụ cảnh báo và một kỳ Coaching, không được dùng cho hai kỳ.
- Lịch hẹn còn tồn tại khi hoàn thành được chuyển thành công việc theo dõi riêng. Khi đã ổn định, công việc theo dõi có thể kết thúc mà không buộc tạo lịch tiếp.
- Theo dõi quá hạn: nhắc mỗi ngày, báo chủ trung tâm sau 24h. Coaching tháng dùng bản tổng hợp hằng ngày, tránh một thông báo/học viên. reserved/completed/waiting_class có danh sách riêng và tạo việc theo dõi thủ công.

## Triển khai

1. Xác nhận đúng môi trường staging bằng quy trình `npm run staging:preflight` hiện có; không suy ra dự án đích từ tên thư mục.
2. Áp ba migration theo thứ tự `20260917100000`, `20260917101000`, `20260917102000`. Các migration tạo bảng, quyền, RPC, trigger và lịch chạy; mặc định tự động **tắt**.
3. Triển khai ứng dụng có các trang chăm sóc. Quyền mới được cấp cho owner và assistant_manager; làm mới phiên/quyền nếu tài khoản đang mở ứng dụng.
4. Kiểm tra `pg_cron` đã bật và có đúng một job tên `student-care-worker`, lịch mỗi phút, câu lệnh `select public.run_student_care_worker();`. Nếu extension không tồn tại, migration chỉ cảnh báo, cần bật extension và đăng ký job trước bước 6. Không sửa cron chấm công.
5. Vào **Chăm sóc học sinh → Phân công lâu dài**, phân công cho trợ lý. Danh sách phân trang và tổng đếm từ DB, không giới hạn ở 500 học viên. Danh sách này và tab **Theo dõi riêng** xếp theo tên (chữ cuối của họ tên), trùng tên thì theo cả họ tên, theo bảng chữ tiếng Việt; thứ tự nằm trong DB (`get_student_care_students`, từ migration `20261022150500`) nên đúng qua mọi trang 50 em. Chủ trung tâm xử lý riêng học viên vào sát cuối tháng theo tình huống thực tế; ngoại lệ không tính vào tỷ lệ hoàn thành.
6. Chủ trung tâm mở **Cấu hình bộ tự sinh** ở đầu trang Chăm sóc học sinh và bấm **Bật chăm sóc tự động**. Job tạo nghĩa vụ tháng và đánh giá theo lô 100 học viên. Khi khởi tạo xong gửi một thông báo tổng hợp cho nhân sự đủ quyền; không gửi dồn từng cảnh báo lịch sử. SLA tính từ lúc tạo công việc, không từ ngày học trong quá khứ.
7. Chờ hàng đợi về 0 và heartbeat dưới 5 phút. Nếu có bản ghi lỗi, màn hình hiển thị số lượng cần thử lại. Kiểm tra trực tiếp bằng chứng với điểm danh/điểm số trước khi dùng để điều hành.
8. UAT staging bằng hai tài khoản trợ lý và tài khoản chủ trung tâm: nhận đồng thời, gọi chưa được, liên hệ thành công, tạo Coaching, hoàn thành tháng, mở thông báo, phân trang, đổi người phụ trách, dữ liệu được sửa. Kiểm tra desktop/mobile và quyền thực tế. Sau đó phát hành cùng phiên bản lên production theo quy trình của dự án.

Giai đoạn đối chiếu dữ liệu trước bật có thể dùng truy vấn chỉ đọc `student_care_calculate(student_id)` trong SQL console quản trị staging. Không có chế độ rollout theo nhóm hoặc dry-run trong giao diện phiên bản này. Tất cả ngưỡng là chính sách v1 chung toàn trung tâm; bật/tắt không thay đổi ngưỡng.

## Quan sát và xử lý lỗi

- Dashboard phân biệt tạm dừng, heartbeat trễ, hàng đợi và lỗi; không coi việc không tải được dữ liệu là danh sách rỗng.
- Job đánh giá mỗi phút, đối soát nghĩa vụ/nhân sự mỗi giờ, quét bù nguồn mỗi ngày theo giờ Việt Nam. Lỗi từng học viên được giữ trong queue và thử lại sau 5 phút.
- Kiểm tra SQL quản trị: `select * from public.student_care_settings;`, `select student_id,attempts,retry_at,last_error from public.student_care_evaluation_queue where attempts>0;` và lịch sử job trong `cron.job_run_details`.
- Nhân sự nghỉ hoặc mất quyền sẽ được gỡ khỏi công việc chưa hoàn thành, ghi lịch sử và báo chủ trung tâm để chuyển giao. Không tự chuyển sang một người bất kỳ.
- Gọi lại cùng request không tạo trùng liên hệ/Coaching. Thao tác trên phiên bản cũ bị từ chối và cần tải lại.
- Lịch sử sự kiện không được sửa/xóa từ ứng dụng. Giao diện hiển thị 200 sự kiện mới nhất; liên hệ đủ điều kiện hoàn thành được truy vấn riêng.

## Tạm dừng / khôi phục

Chủ trung tâm mở **Cấu hình bộ tự sinh** và bấm **Tạm dừng tự động**. Job không sinh hoặc gửi thêm, nhưng vẫn xử lý tay công việc có sẵn. Nếu cần dừng cả lịch chạy, chỉ unschedule job `student-care-worker`. Giữ bảng, lịch sử, phân công và thông báo; không DROP dữ liệu. Sửa tiến bằng migration mới. Bật lại không gửi lại thông báo khởi tạo, tiếp tục hàng đợi và đối soát.

## Kiểm thử cục bộ

- `node scripts/test-student-care-db.mjs`: PostgreSQL thật, cụm tạm qua UNIX socket, tự xóa sau chạy; cần `PG_BINDIR` nếu PostgreSQL không ở đường dẫn Homebrew14/Linux16 đã hỗ trợ. Không kết nối production. Sử dụng fixture học viên/lớp/RBAC và migration Coaching/thông báo thật; không thay thế chạy toàn bộ migration trên staging.
- `npm run typecheck`, `npm run lint`, `npm run build`.
- `node node_modules/vitest/vitest.mjs run tests/unit/student-care.test.ts tests/unit/student-care-presentation.test.ts tests/components/student-care.test.tsx tests/components/student-care-redesign.test.tsx tests/components/student-care-routes.test.tsx tests/components/dev-student-care-preview.test.tsx tests/unit/navigation.test.ts tests/components/authenticated-app-shell-loading.test.tsx`.

Hồi quy DB gồm điều kiện nghỉ/điểm, sửa điểm, tháng lịch, cập nhật cảnh báo, phân quyền RPC/bảng, nhận đồng thời, idempotency, liên kết Coaching thật, hoàn thành có bằng chứng, một liên hệ/một tháng, giữ lịch hẹn, nhắc/escalation chống trùng, nhân sự ngừng hoạt động, 506 học viên, thứ tự theo tên của danh sách học viên và ô chọn học sinh Coaching vượt mốc 500 em.

## Kết quả kiểm chứng ngày 17/09/2026

- PostgreSQL cục bộ: PASS toàn bộ assertion nghiệp vụ/phân quyền/hồi quy; hai kết nối tranh nhận việc chỉ một kết nối thành công. JSON của ba RPC đọc đã được kiểm tra bằng chính Zod schema của ứng dụng.
- Vitest: **22/22** kiểm thử, 5 file (chăm sóc unit/component, navigation, app-shell và Coaching forms hồi quy). Mock app-shell cũ được cập nhật sang API đọc tài khoản đã cache hiện tại; không đổi luồng xác thực ứng dụng.
- Typecheck và ESLint toàn bộ `src`: PASS. Sau thay đổi cuối, lint lại riêng phần chăm sóc/thông báo: PASS.
- Build production: PASS; có đủ hai route chăm sóc. Build kiểm chứng không dùng biến môi trường/khóa Supabase thật, nên có log `configuration_missing` từ những trang đọc quyền trong bước prerender.
- Kiểm chứng JS/build dùng bản sao tạm của mã nguồn và dependency cài bằng **chính package-lock.json**; không sửa dependency của dự án. Bộ thư viện hiện có trên máy bị chờ đọc file và làm Vitest timeout trước khi chạy test, nên không tính các lượt timeout đó là đạt.
- Chưa chạy UAT trình duyệt với tài khoản/dữ liệu staging, chưa áp migration hoặc deploy lên production, chưa bật lịch gửi cảnh báo thật. Bộ DB cục bộ dùng fixture cho hệ thống nền, không thay thế kiểm chứng migration trên toàn bộ schema staging.
- Nâng cấp gstack theo skill được yêu cầu: **1.87.0.0 → 1.87.4.0**. Không tuyên bố đã có review độc lập hoặc hoàn tất workflow gstack khác.
