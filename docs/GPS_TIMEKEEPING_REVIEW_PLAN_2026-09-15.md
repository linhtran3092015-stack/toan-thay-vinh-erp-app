# Rà soát GPS chấm công và kế hoạch ổn định vận hành

Ngày: 15/09/2026. Trạng thái: đề xuất để xem xét; chưa thay đổi mã ứng dụng hoặc database.

## 1. Mục tiêu và bằng chứng

Nhân sự dùng web trên máy tính, vẫn mở trang, sau khoảng 1–2 phút gặp lỗi định vị. Chưa xác nhận trường hợp cụ thể chỉ hiển thị lỗi hay thực sự đóng ca trong database. Mục tiêu là ghi nhận vào/ra trơn tru, đúng giờ công, có kiểm duyệt ngoại lệ.

Đã truy vết cấu hình vị trí, lấy GPS khi vào/ra, heartbeat, watchdog, thông báo giao diện, phân quyền, điều chỉnh công và các bài kiểm thử liên quan trong repository. Chưa đối chiếu phiên bản function đang chạy trên production, log nhân sự, cấu hình thực tế hoặc tái hiện trên máy nhân sự. Vì vậy cần phân biệt lỗi xác định trong mã với nguyên nhân sự cố thực tế chưa xác nhận.

Kiểm chứng: mô phỏng hợp đồng JSON đã xác nhận lỗi đọc trạng thái. Đã thử chạy bốn tệp kiểm thử liên quan (watcher, dialog, attendance-redesign, stale-entries-auto-end); tiến trình chỉ hiện khởi động rồi không trả kết quả trong lượt rà soát và đã được dừng. Không kết luận các bài kiểm thử đạt hay thất bại.

## 2. Các phát hiện

### P1 — Giao diện đọc sai phản hồi heartbeat (xác định trong mã)

SQL trả `session_active`, `verified_inside`, `distance_m`, `signal_degraded`, `message_vi`. Server action ép kiểu trực tiếp thành `AttendanceHeartbeatResult`, không chuyển các khóa thành camelCase. Hook đọc `!result.sessionActive`: thuộc tính không tồn tại nên phản hồi đang hoạt động cũng đi vào nhánh ca đã đóng. Điều này gây thông báo sai và gọi refresh; bản thân nhánh giao diện này không đóng ca trong database.

Bằng chứng: `src/features/timekeeping/time-entry-actions.ts:176`, `hooks/use-attendance-heartbeat.ts:76`, migration `20260907040000_geofence_and_monthly_timekeeping.sql:129`. Đã chạy mô phỏng JavaScript với đúng dạng JSON SQL: phản hồi `session_active: true` bị biểu thức giao diện đánh giá là ca đã đóng.

### P1 — Quy tắc 90 giây biến thiếu xác minh thành tự cắt công (xác định trong mã)

Migration `20260908070000_fix_timekeeping_watchdog_and_admin_adjustments.sql:43` đặt thời điểm mất vị trí = lần vị trí hợp lệ cuối hoặc check-in + 90 giây, áp dụng cho mọi ca tại Trung tâm. Watchdog chạy định kỳ mỗi phút nếu cron được cài; ngoài ra heartbeat và check-out cũng gọi watchdog.

Chỉ mẫu chắc chắn bên trong mới gia hạn `last_location_at`. Mẫu sai số vượt ngưỡng hoặc giao vùng ranh giới không gia hạn. Như vậy web có thể vẫn mở, mạng vẫn hoạt động và vẫn gửi tọa độ, nhưng ca vẫn bị đóng sau 90 giây không có mẫu được chấp nhận. Đây là giả thuyết rất phù hợp với thời gian người dùng báo; cần log thật để xác nhận.

Ví dụ với bán kính 100 m và dung sai 15 m: khoảng cách 40 m, sai số 80 m => biên trên 120 m > 115 m, biên dưới -40 m. Mẫu không chứng minh ra ngoài, nhưng cũng không gia hạn vị trí. Ngưỡng thực tế của Trung tâm chưa được đọc.

### P1 — Lỗi quyền/kết nối bị nhập chung với trạng thái GPS (xác định trong mã)

Không xác minh được quyền trả `sessionActive: false`; lỗi RPC/kết nối trả `signalDegraded: true`. Hook còn gán mọi ca không hoạt động thành `outside_center`. Hệ thống cần phân biệt: lỗi định vị, độ chính xác thấp, lỗi mạng, đăng nhập hết hạn, ca đóng và thực sự ra ngoài.

### P1 — Một mẫu ngoài ranh giới đủ tự đóng ca (xác định trong mã)

Heartbeat đóng ca ngay nếu khoảng cách trừ sai số lớn hơn bán kính cộng 15 m. Chưa có xác nhận nhiều mẫu hoặc kiểm duyệt. Một lần tọa độ nhảy sai vẫn có thể gây hậu quả về giờ công. Watchdog cũng cập nhật theo ID từ vòng đọc trước đó, thiếu kiểm tra lại trạng thái/thời điểm vị trí ngay khi cập nhật; cần kiểm thử cạnh tranh với heartbeat và check-out.

### P2 — Thu thập và phục hồi vị trí chưa đủ rõ ràng

Hook chạy `watchPosition` và lấy mẫu mới mỗi 25 giây, timeout 10 giây. Lỗi lấy mẫu bị gộp chung; chưa phân biệt mã lỗi hay xử lý riêng khi mạng trở lại. Không có generation guard để bỏ phản hồi cũ sau đổi ca/unmount; request treo có thể giữ khóa gửi. Trạng thái mơ hồ không có nhánh UI riêng. Input heartbeat thiếu ID ca và timestamp mẫu; server tự chọn ca đang mở.

Dialog giữ tọa độ đã lấy mà không theo dõi tuổi mẫu trước khi gửi. Cần lấy lại mẫu quá cũ, vô hiệu phản hồi khi đóng dialog/đổi hình thức, và tránh dùng lại vị trí cũ sau lần lấy mới thất bại.

### P2 — Có cơ chế duyệt nhưng chưa là đường thoát đầy đủ

Đã có yêu cầu điều chỉnh, hàng đợi phê duyệt, chống tự duyệt và công cụ quản lý thêm/sửa công. Yêu cầu điều chỉnh hiện dành cho lượt đã đóng; chưa giải quyết trọn vẹn việc không check-in được hoặc đang mở ca nhưng không check-out được.

UI hiện gợi ý chuyển Trực tuyến khi GPS lỗi. Đây là thay đổi hình thức làm việc, không phải xác minh thay thế. Wi-Fi hiện là SSID/BSSID người dùng nhập và vẫn yêu cầu GPS; không đủ làm bằng chứng độc lập.

### P2 — Kiểm thử bỏ sót ranh giới SQL → action → UI

Bài test watcher mock toàn bộ hook và dùng camelCase nên không phát hiện JSON thực tế từ SQL. Các test thời gian có phần mô phỏng lại logic hoặc kiểm tra nội dung migration, không chứng minh ca hoạt động ổn trên thiết bị thực.

## 3. So sánh hướng xử lý

| Hướng | Phạm vi | Ưu điểm | Đánh đổi | Quy mô |
|---|---|---|---|---|
| A. Sửa GPS liên tục | Sửa dữ liệu phản hồi, phục hồi, phân loại lỗi và logic tự đóng | Ít thay đổi nghiệp vụ | Vẫn phụ thuộc chất lượng vị trí cả ca; tăng timeout không giải quyết tận gốc | Vừa |
| B. GPS lúc vào/ra + duyệt ngoại lệ | Sửa lỗi nền; ngừng cắt công do thiếu GPS giữa ca; cho gửi ngoại lệ | Phù hợp mục tiêu vận hành; tái sử dụng luồng duyệt | Không chứng minh liên tục có mặt; cần quản lý xử lý ngoại lệ | Vừa–lớn |
| C. Điểm chấm công tại Trung tâm | Máy/kiosk quản lý hoặc QR luân phiên xác minh bởi server | Có thể giảm lệ thuộc GPS máy nhân sự | Cần thiết bị/điểm đặt; QR có thể bị chia sẻ và không chứng minh cả ca có mặt | Lớn |

Khuyến nghị B. Làm phần sửa lỗi phản hồi của A trước, sau đó chuyển chính sách theo B. Chỉ đầu tư C khi thử nghiệm B vẫn có nhiều ngoại lệ hoặc Trung tâm muốn chấm công tại một điểm cố định. Chưa chốt thay đổi chính sách thay người dùng.

## 4. Luồng đề xuất B

1. Nhân sự bấm vào/ra → lấy vị trí mới → server xác minh quyền, ca, cấu hình, tọa độ và độ chính xác.
2. Hợp lệ → ghi nhận thời gian server, bằng chứng và trạng thái thành công rõ ràng.
3. GPS lỗi/kém chính xác/ngoài vùng → cho thử lại hoặc “Gửi chấm công chờ duyệt”, yêu cầu lý do. Không tự đổi sang Trực tuyến.
4. Ngoại lệ check-in không tạo công đã duyệt. Lưu yêu cầu vào ca tạm để có thể nhận yêu cầu ra cùng ca, tránh tạo nhiều ca trùng.
5. Ngoại lệ check-out ghi nhận ý định kết thúc và thời điểm server nhận; kết thúc phần vận hành của ca, gắn chờ duyệt cho phần giờ công chưa xác minh. Tách trạng thái ca khỏi trạng thái duyệt.
6. Quản lý xem giờ gốc, giờ đề nghị, lỗi và bằng chứng hiện có; duyệt/từ chối có lý do, không tự duyệt. Giữ lịch sử, không ghi đè bằng chứng gốc.
7. Nếu mất mạng hoàn toàn, chỉ báo chưa gửi; khi gửi lại lưu riêng thời gian người dùng khai và thời gian server nhận, bắt buộc duyệt. Không hiển thị thành công trước xác nhận server.
8. Thiếu GPS giữa ca không tự đóng ca. Giữ cơ chế xử lý quên check-out cuối ngày, nhưng phân biệt giờ hệ thống tạm kết thúc với giờ công được duyệt.
9. Báo cáo tháng hiển thị công đã xác minh và công chờ duyệt riêng. Không tự cộng giờ đề nghị chưa duyệt; bảo toàn phần công hợp lệ đã có. Cần truy vết đầy đủ truy vấn tính công/lương trước triển khai.

## 5. Kế hoạch thực hiện

### Đợt 1 — Xác minh và sửa lỗi nền

- Đối chiếu migration/function và cron production bằng kiểm tra chỉ đọc; lấy mẫu ca `location_lost`, `left_geofence` cùng khoảng thời gian lỗi.
- Trên máy tính đang mở web: ghi mã lỗi geolocation, sai số, khoảng cách, giờ lấy mẫu, giờ gửi/nhận, kết quả xác minh, mã lỗi API. Không mặc định do người dùng tắt web.
- Chuẩn hóa và kiểm tra schema JSON tại server action; dữ liệu thiếu/sai trở thành lỗi xác minh rõ ràng, không báo đóng ca.
- Tách lỗi mạng/quyền/vị trí và trạng thái ca. Chỉ xác nhận đóng ca khi server trả kết quả hợp lệ; đọc lại trạng thái khi cần.
- Kiểm thử hợp đồng phản hồi thực tế, bao gồm mọi nhánh SQL và dữ liệu lỗi.

### Đợt 2 — Chính sách và ngoại lệ

- Bổ sung chế độ xác minh rõ ràng phía server và UI; không chỉ tắt hook vì watchdog vẫn sẽ cắt công. Snapshot chính sách cho ca mới để đổi cấu hình giữa ca không gây bất ngờ.
- Ngừng auto-end vì thiếu GPS hoặc một mẫu ra ngoài trong chế độ B; thống nhất cron và tất cả RPC gọi watchdog.
- Tái sử dụng các thành phần duyệt, quyền và audit; mở rộng dữ liệu cho ngoại lệ vào/ra, khóa chống gửi trùng và xử lý cạnh tranh.
- Bảo đảm người dùng luôn có đường kết thúc ca hoặc gửi yêu cầu kết thúc; không chặn vì ca bị tự đóng ở một request khác.
- Kiểm tra lại báo cáo ngày/tháng, điều chỉnh công và tính lương. Có phương án đối soát các ca đã bị cắt; không tự phục hồi hàng loạt giờ công chưa có bằng chứng.

### Đợt 3 — Thử nghiệm và triển khai

- Chạy trên môi trường thử nghiệm với đúng thứ tự migration hiện tại, rồi thử nhóm nhỏ đủ các vai trò có quyền chấm công trong 3–5 ngày làm việc.
- Theo dõi tỷ lệ lỗi lấy vị trí, check-in/out thành công, số ca tự đóng, số ngoại lệ và thời gian quản lý xử lý.
- Mục tiêu đề xuất: không có ca bị tự cắt chỉ do thiếu GPS; mọi lỗi GPS có đường gửi chờ duyệt; không mất thao tác/trùng ca; không tính công chưa duyệt; không có thông báo đóng ca sai.
- Mở rộng khi các tiêu chí trên đạt. Nếu cần quay lui, giữ toàn bộ yêu cầu và audit, chỉ đổi chính sách cho ca mới; không bật lại cắt 90 giây hàng loạt trên ca đang làm.

## 6. Ma trận nghiệm thu bắt buộc

- Máy tính web luôn mở 15–30 phút và trọn một ca; Chrome/Edge, bổ sung Safari nếu thực tế sử dụng.
- Mọi vai trò có quyền chấm công; có/không có ca phân công; tại Trung tâm/Trực tuyến.
- Mẫu tốt, sai số cao, vùng ranh giới, tọa độ nhảy ngoài, timeout và từ chối quyền.
- Lỗi mạng/phiên đăng nhập không được báo thành rời Trung tâm.
- Mất kết nối 30/90/180 giây rồi trở lại; request treo; đổi trang và tải lại.
- Hai tab, phản hồi ca cũ sau khi mở ca mới, bấm lặp, check-out cạnh tranh với cron.
- GPS thiếu ở check-in, check-out; duyệt/từ chối; chống tự duyệt và gửi trùng; quên check-out, qua 23:30, qua ngày.
- JSON snake_case thực từ SQL qua action đến hook; không mock bỏ qua đoạn chuyển đổi.

## 7. Giới hạn và nguồn tham khảo

Geolocation web không đồng nghĩa thiết bị có đầu thu GPS. Chất lượng vị trí của từng máy cần đo thực tế. W3C mô tả API và các nguồn vị trí: https://www.w3.org/TR/geolocation/.

Khả năng trình duyệt trì hoãn khi trang ở nền là rủi ro bổ sung cho thiết kế GPS liên tục, không phải nguyên nhân đã xác nhận của ca máy tính luôn mở: https://developer.chrome.com/docs/web-platform/page-lifecycle-api.

Đây là báo cáo điều tra và phương án đề xuất, chưa phải chứng nhận production đã tái hiện/đã sửa. Đã tham khảo investigate và bước xem xét phạm vi của plan-ceo-review/plan-eng-review; chưa hoàn tất các vòng review tương tác của hai skill kế hoạch, chưa có review độc lập đa agent.
