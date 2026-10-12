> Cập nhật triển khai 17/09/2026: đã thêm mã nguồn, ba migration và kiểm thử chăm sóc học viên. Tài liệu dưới đây giữ lại kế hoạch ban đầu; trạng thái vận hành, giới hạn phiên bản và cách bật nằm ở [STUDENT_CARE_OPERATIONS.md](STUDENT_CARE_OPERATIONS.md). Chưa áp migration/deploy lên môi trường thật. Gstack đã nâng từ 1.87.0.0 lên 1.87.4.0.

# Kế hoạch chăm sóc học viên: cảnh báo sớm và Coaching hằng tháng

Ngày rà soát: 17/09/2026. Trạng thái: bản thiết kế để duyệt nghiệp vụ, chưa triển khai.

## 1. Mục tiêu và phạm vi

Biến việc quan tâm học viên thành quy trình có trách nhiệm, thời hạn và bằng chứng: phát hiện dấu hiệu cần hỗ trợ, có người tiếp nhận, liên hệ kịp thời, theo dõi kết quả; đồng thời mỗi học viên đang học được Coaching ít nhất một lần trong mỗi tháng.

Hai luồng dùng chung hồ sơ chăm sóc và lịch sử liên hệ:

- **Can thiệp sớm:** phát sinh từ điểm danh/điểm kiểm tra; toàn bộ trợ lý quản lý nhận cảnh báo, một người nhận xử lý; chỉ tạo phiếu Coaching chuyên sâu khi cần.
- **Chăm sóc định kỳ:** một nhiệm vụ Coaching mỗi học viên mỗi tháng, có trợ lý phụ trách ổn định, lịch chia đều trong tháng.

Không tự gửi tin phụ huynh trong phiên bản đầu. Trợ lý thực hiện liên hệ qua kênh vận hành hiện có và ghi nhận kết quả. Không chấm “nguy cơ bỏ học” bằng AI, không tự chuyển trạng thái học viên hoặc tự xử lý học phí. Mục tiêu duy trì việc học là kết quả cần đo, không phải cam kết rằng cứ gửi cảnh báo thì tỷ lệ duy trì sẽ tăng.

## 2. Quyết định đã được chủ trung tâm xác nhận

| Nội dung | Quy tắc |
|---|---|
| Nghỉ liên tiếp | Vắng có phép hoặc không phép từ 2 buổi liên tiếp |
| Nghỉ trong tháng | Vắng có phép hoặc không phép từ 3 buổi trong tháng dương lịch Việt Nam |
| Điểm thấp | Hai bài kiểm tra cuối buổi có điểm gần nhất đều dưới 6; bỏ qua buổi vắng/chưa có điểm, không dùng điểm vở |
| Phạm vi | Gộp toàn bộ buổi học của học viên, không tách lớp; ngưỡng chung toàn trung tâm |
| Người nhận | Tất cả trợ lý quản lý; dashboard và chuông thông báo trong hệ thống |
| Xử lý | Trợ lý nhận việc, liên hệ, ghi kết quả; tạo Coaching khi cần |
| Hạn cảnh báo | Nhận trong 24 giờ, liên hệ lần đầu trong 48 giờ kể từ phát hiện |
| Nhắc và báo cấp trên | Nhắc mỗi ngày khi quá hạn; sau 72 giờ kể từ phát hiện mà bước đến hạn vẫn chưa xử lý thì báo chủ trung tâm |
| Coaching tháng | Bắt buộc với tất cả học viên đang học; chia lịch đều trong tháng, trợ lý phụ trách lâu dài |
| Hoàn thành Coaching tháng | Có trao đổi thực chất với phụ huynh và/hoặc học viên, ghi tình hình, khó khăn, hướng hỗ trợ và ngày theo dõi tiếp; gửi form/gọi không bắt máy chưa hoàn thành |
| Lịch Coaching tháng | Chia lịch để phần lớn hoàn thành trước ngày 25; hạn cuối của kỳ là cuối tháng |
| Trễ hẹn theo dõi tiếp | Nhắc mỗi ngày, báo chủ trung tâm sau 24 giờ quá hạn |
| Bảo lưu/nghỉ học | Danh sách theo dõi riêng, không trộn vào tỷ lệ Coaching bắt buộc của học viên đang học |

Các giờ SLA là giờ thực trôi qua, tính cả cuối tuần theo phương án đã hỏi. Giờ hiển thị và ranh giới ngày/tháng: Asia/Ho_Chi_Minh. Thông báo tổng hợp thường nhật đề xuất lúc 08:00; đây là thông số vận hành dự kiến.

## 3. Hiện trạng đã kiểm chứng

Rà soát mã nguồn và migration, chưa truy cập database production để xác minh migration đã áp dụng, số lượng học viên, quy mô dữ liệu và job đang chạy.

| Thành phần | Bằng chứng trong repository | Cách tận dụng / khoảng trống |
|---|---|---|
| Điểm danh | `supabase/migrations/20260725050000_session_attendance_schema_foundation.sql`, `20260817090000_class_component_roster_foundation.sql` | Đã có buổi học, roster, vắng CP/KP; cần xác định chính xác các buổi học viên phải tham gia |
| Điểm cuối buổi | `src/features/sessions/detail-data.ts:313` | Có `session_results.test_score`, điểm 0–10, cho phép null; dùng làm nguồn thật |
| Cảnh báo mẫu | `src/features/students/detail/mock-student-detail.ts:35` (đã xóa ở v0.6.18.0) | Chỉ demo, không dùng làm bộ phát hiện |
| Hồ sơ học viên thật | `src/app/(app)/students/[studentId]/page.tsx` | Dùng `StudentProfilePage` (từ 2026-10-12; trước đó `DatabaseStudentDetailPage`); lịch sử chăm sóc nằm ở tab Chăm sóc |
| Coaching | `supabase/migrations/20260729123000_coaching_foundation.sql`, `20260802193000_coaching_management_workflows.sql` | Đã có tạo phiếu, owner, review_at, ghi chú, kết quả, đóng phiếu |
| Lịch sử Coaching | Cùng migration nền tảng | Records/events bất biến; không cập nhật trực tiếp owner hoặc review_at trên phiếu cũ |
| Form Coaching | `supabase/migrations/20260815100000_coaching_forms_wave_b.sql` | Đã có version, public link, phản hồi; có thể dùng thu thập thông tin nhưng gửi form không đồng nghĩa chăm sóc hoàn thành |
| Dashboard | `src/features/dashboard/data.ts:334` | Hiện đếm Coaching ưu tiên cao đã có; cần thêm phần chăm sóc cho trợ lý và chủ trung tâm |
| Thông báo | `supabase/migrations/20260731025000_notifications_foundation.sql` | Tái sử dụng recipient, dedupe_key, read_at và RLS; nội dung thông báo bất biến |
| Giới hạn danh sách | `src/features/coaching/data.ts`, `src/features/notifications/data.ts` | Coaching lấy tối đa 200, lựa chọn học viên 500, thông báo 50; thêm phân trang và tổng đếm SQL, không lấy số trên trang làm tổng trung tâm |
| Nhãn thông báo | `src/features/notifications/notification-list-page.tsx` | Chưa có nhãn cho sự kiện chăm sóc, phải bổ sung |
| Lịch chạy nền | `20260728155000_timekeeping_auto_end_cron.sql`, `20260729085000_fix_timekeeping_auto_end_cron_execution.sql` | Đã có mô hình pg_cron và hàm hệ thống không có auth.uid(); phải kiểm tra triển khai thật |
| Phân quyền | Coaching cho `owner` và `assistant_manager` | Dùng mã vai trò chuẩn, nhân sự active, assignment chưa thu hồi; không suy từ tên hiển thị |

Lưu ý nghiệp vụ: role `assistant_manager` đang có nhãn “Quản lý trợ lý”. Trước phát hành cần đối chiếu danh sách nhân sự thực tế xem đúng nhóm anh gọi là “trợ lý quản lý”; không vô tình gửi cho `teaching_assistant`.

## 4. Quy tắc phát hiện chi tiết

### 4.1. Nguồn sự thật và thứ tự buổi

Đề xuất chỉ đánh giá buổi đã kết thúc (`completed`), có điểm danh hợp lệ, không bị hủy. Không bắt buộc đã khóa vì chờ khóa có thể làm chậm hỗ trợ; khi dữ liệu thay đổi phải tính lại. Đánh dấu rõ kết quả chờ cập nhật khi dữ liệu còn thiếu.

- Lập chuỗi điểm danh từ roster hợp lệ theo thời gian, trước khi nối điểm danh/kết quả; không lọc mất các buổi chưa nhập rồi ghép hai buổi cách nhau thành nghỉ “liên tiếp”. Riêng quy tắc điểm thấp lọc các bài có điểm hợp lệ rồi xét hai bài gần nhất theo ngày/giờ buổi học.
- Gộp tất cả lớp của cùng `student_id`. Thứ tự `(session_date, start_time, class_session_id)`; hai buổi khác giờ cùng ngày là hai buổi. Hai buổi trùng giờ bị đánh dấu cần rà soát; thứ tự ID chỉ để ổn định kết quả, không hợp thức hóa lịch trùng.
- Theo danh sách tham gia thực tế có hiệu lực, không lấy toàn bộ lịch sử lớp hiện tại. Chuyển lớp không xóa lịch sử học viên, buổi trước ngày nhập học không tính.
- Buổi chính, học bù và học thêm có tham gia hợp lệ được xét. Không coi việc không đăng ký một buổi học thêm là vắng. Đi học thêm (`additional_study`) là có đi học, không là vắng.
- Một buổi chỉ tính một lần theo học viên, dù có nhiều liên kết enrollment. Học bù không xóa việc đã vắng buổi gốc; buổi học bù tham gia thực tế là sự kiện mới.

### 4.2. Ba bộ quy tắc

| Mã | Điều kiện | Bằng chứng hiển thị |
|---|---|---|
| `absence_streak` | Ít nhất hai buổi liền kề hợp lệ có trạng thái vắng CP/KP | Ngày, lớp, loại vắng, độ dài chuỗi |
| `absence_month` | Ít nhất ba buổi vắng CP/KP trong tháng dương lịch Việt Nam | Tháng, số buổi và danh sách buổi |
| `low_test_streak` | Hai bài kiểm tra cuối buổi có điểm gần nhất đều < 6, bỏ qua buổi vắng/chưa có điểm | Ngày, lớp, điểm của hai bài; điểm 6.0 không đạt điều kiện |

“Trong tháng” đã được xác nhận là tháng dương lịch Việt Nam, không phải 30 ngày trượt. Chuỗi nghỉ liên tiếp và việc xét hai bài có điểm gần nhất vẫn đi qua ranh giới tháng.

Điểm null không là 0. Theo lựa chọn đã xác nhận, 5 điểm → một buổi vắng/chưa có điểm → 5 điểm vẫn kích hoạt cảnh báo vì hai bài có điểm gần nhất đều dưới 6. Nếu chưa đủ hai bài có điểm thì chưa đủ dữ liệu để kết luận. 5 điểm → 7 điểm → 5 điểm không kích hoạt vì hai bài gần nhất là 7 và 5. Thứ tự theo ngày/giờ buổi học, không theo lúc nhập điểm; nhập bù hoặc sửa điểm phải tính lại hai bài gần nhất. Trên giao diện dùng nhãn “Hai bài có điểm gần nhất dưới 6”, không dùng “Hai buổi liên tiếp” gây hiểu nhầm. Không tự thêm giới hạn khoảng cách giữa hai bài khi chưa có quy tắc được duyệt; luôn hiện ngày của hai bài làm bằng chứng.

### 4.3. Tín hiệu, công việc và chống trùng

Tách tín hiệu tính từ dữ liệu khỏi trạng thái xử lý của con người:

- Tín hiệu: đang đúng điều kiện / không còn đúng / không đủ dữ liệu / bị thu hồi do sửa dữ liệu.
- Công việc: chưa nhận → đang xử lý → theo dõi tiếp → hoàn thành; có trạng thái hủy với lý do.
- Một học viên tối đa một công việc cảnh báo chưa kết thúc; ba điều kiện cùng xảy ra được gộp thành các lý do trong công việc đó. Nhiệm vụ Coaching tháng là nghĩa vụ riêng nhưng có thể dùng chung lần liên hệ.
- Mỗi đợt chuỗi có khóa riêng; nghỉ thêm buổi trong cùng chuỗi chỉ cập nhật bằng chứng. Quy tắc tháng khóa theo học viên + tháng + quy tắc. Mỗi thay đổi quan trọng có version; chạy lại không gửi lặp.
- Đóng việc mà dữ liệu không đổi không được tự tạo lại ngay. Nếu có buổi vắng/điểm thấp mới sau lúc đóng, mở lại việc gắn cùng đợt hoặc tạo đợt mới theo quy tắc, ghi rõ bằng chứng mới và thông báo một lần.
- Tháng mới tạo đợt `absence_month` mới khi đủ điều kiện. Việc chưa hoàn thành của tháng cũ không tự biến mất.
- Tín hiệu hết điều kiện không tự chứng nhận trợ lý đã liên hệ. Giữ lịch sử và cho trợ lý kết thúc với kết quả thực tế.
- Sửa điểm/điểm danh khiến cảnh báo sai: thu hồi tín hiệu và đánh dấu việc cần rà soát; không xóa liên hệ/Coaching/thông báo đã gửi. Nếu chưa có ai xử lý và không còn tín hiệu nào, hệ thống có thể hủy việc với lý do sửa dữ liệu, tách khỏi số “hỗ trợ thành công”.
- Không đủ dữ liệu sau chỉnh sửa không được diễn giải thành “đã cải thiện”.

## 5. Quy trình xử lý cảnh báo

```text
Buổi học kết thúc hoặc dữ liệu được sửa
                  |
          Ghi nhận cần đánh giá lại
                  |
           Bộ đánh giá quy tắc
                  |
       Cảnh báo + bằng chứng theo buổi
                  |
  Dashboard và thông báo cho mọi trợ lý quản lý
                  |
      Một trợ lý bấm Nhận xử lý (<=24h)
                  |
      Liên hệ lần đầu (<=48h từ phát hiện)
                  |
       Ghi kết quả và lịch theo dõi tiếp
             /                    \
   Hỗ trợ trực tiếp        Tạo/gắn phiếu Coaching
             \                    /
             Đánh giá lại và hoàn thành
```

**Nhận việc:** thao tác nguyên tử tại DB, hai trợ lý nhận đồng thời chỉ một người thành công. Người còn lại nhìn thấy tên người đã nhận. Chủ trung tâm có thể điều phối/chuyển người với lý do; người nhận cũ không tiếp tục sửa công việc bằng màn hình đã mở từ trước.

**Nhật ký liên hệ:** ngày giờ, người liên hệ, đối tượng (phụ huynh/học viên), kênh, liên hệ thành công/không liên lạc được, nguyên nhân, nội dung trao đổi, phương án thống nhất và lần hẹn tiếp. Không bắt buộc lưu ghi âm hoặc toàn văn trò chuyện.

**Thời hạn:** nhận việc và liên hệ là hai mốc độc lập. Nhận việc không đặt lại hạn liên hệ. Gọi không bắt máy có thể ghi nhận đã thử liên hệ lần đầu để đo thao tác, nhưng chưa là đã hỗ trợ xong; phải có lịch thử lại, đề xuất không quá 24 giờ.

**Nhắc việc:** khi chưa nhận, nhắc nhóm trợ lý; sau khi nhận, nhắc người phụ trách. Nhắc một lần/ngày/công việc/loại hạn; dashboard luôn hiển thị quá hạn. Sau 72 giờ kể từ phát hiện, nếu còn quá hạn nhận hoặc liên hệ thì thông báo chủ trung tâm. Hạn theo dõi tiếp bị lỡ được nhắc hằng ngày và báo chủ trung tâm sau 24 giờ quá hạn, theo lựa chọn đã xác nhận. Mốc này tính từ ngày giờ hẹn theo dõi, độc lập với SLA nhận/liên hệ ban đầu.

**Hoàn thành:** bắt buộc kết quả có cấu trúc, ghi chú và ngày đánh giá lại nếu cần. Các kết quả gồm đã hỗ trợ, tiếp tục Coaching, không liên lạc được cần theo dõi, dữ liệu sai, ngừng học/bảo lưu. Chuyển sang Coaching không tự bỏ trách nhiệm: công việc ở trạng thái theo dõi, liên kết phiếu và hạn tiếp theo đến khi có kết luận phù hợp.

Đánh dấu đã đọc thông báo không phải nhận việc, liên hệ hay hoàn thành công việc.

## 6. Coaching duy trì mỗi tháng

### 6.1. Danh sách đủ và phân công ổn định

- Một học viên đủ điều kiện có đúng một nhiệm vụ cho mỗi tháng; ràng buộc duy nhất `(student_id, period_month, kind=monthly)`.
- Đầu tháng sinh danh sách; hằng ngày đối soát để bổ sung học viên mới/đi học lại, phát hiện thiếu người phụ trách và bù nếu job trước đó lỗi. Không phụ thuộc ai đó mở dashboard.
- Ánh xạ “đang học” từ lifecycle và enrollment thực tế. Đề xuất gồm active và resumed có hiệu lực; `waiting_class` cần quyết định riêng. Học viên thuộc nhóm bắt buộc nhưng thiếu lớp/dữ liệu vẫn xuất hiện ở hàng chờ rà soát, không bị loại im lặng khỏi mẫu số.
- Giữ trợ lý chăm sóc lâu dài theo học viên, không gắn cứng với lớp vì học viên có thể chuyển lớp. Chủ trung tâm phân công ban đầu và chuyển giao; hệ thống gợi ý cân bằng số lượng.
- Không có người đủ điều kiện: để rõ “chưa phân công”, báo chủ trung tâm và giữ nhiệm vụ; không giả mạo tài khoản để tạo Coaching.
- Học viên bảo lưu/ngừng học có tab theo dõi riêng. Khi trạng thái thay đổi giữa tháng, ghi lý do miễn/đổi nghĩa vụ và lịch sử; không xóa để làm đẹp tỷ lệ.

### 6.2. Lịch và điều kiện hoàn thành

Đã chốt chia lịch để phần lớn hoàn thành trước ngày 25, hạn cuối của kỳ là cuối tháng. Đề xuất chia lịch theo tuần và giữ ngày chăm sóc tương đối ổn định giữa các tháng, nhưng người phụ trách được đổi lịch có lý do. Ngày 25 là mục tiêu điều phối, không phải hạn cứng để đánh dấu toàn bộ việc còn lại là quá hạn kỳ. Học viên mới phát sinh cuối tháng vẫn có nhiệm vụ; nếu không đủ thời gian, đề xuất ghi ngoại lệ có phê duyệt và một lịch gần nhất, không âm thầm chuyển kỳ.

Một lần Coaching tháng dự kiến cần ghi:

1. Chuyên cần và kết quả học tập trong kỳ, hiển thị dữ liệu thật cạnh nội dung trao đổi.
2. Tình hình học, động lực, khó khăn hoặc thay đổi đáng chú ý.
3. Ý kiến phụ huynh và/hoặc học viên, đúng đối tượng đã liên hệ.
4. Hành động hỗ trợ đã thống nhất, người thực hiện và mốc kiểm tra lại.
5. Kết quả trao đổi, thời điểm và người chịu trách nhiệm.

**Đã xác nhận:** chỉ hoàn thành khi đã trao đổi thực chất với phụ huynh và/hoặc học viên, ghi đủ kết quả. Gửi form hoặc cuộc gọi không bắt máy chưa hoàn thành. Form hiện có là nguồn thông tin hỗ trợ, không tự thay thế cuộc trao đổi.

Nếu tháng đó đã có một lần xử lý cảnh báo đáp ứng đủ nội dung, trợ lý có thể chủ động liên kết lần liên hệ đó để hoàn thành nghĩa vụ tháng. Chỉ áp dụng cho kỳ chứa ngày trao đổi và cùng học viên. Một lần liên hệ không được dùng để hoàn thành nhiều tháng, và một phiếu Coaching đang mở không tự tính là đã hoàn thành Coaching tháng.

Tháng trước quá hạn vẫn hiện riêng khi tháng mới bắt đầu. Liên hệ muộn xử lý nghĩa vụ cũ phải ghi completed_late, không sửa ngày và không được tính vào tỷ lệ hoàn thành đúng hạn. Một lần trao đổi chỉ hoàn thành một nghĩa vụ tháng: trợ lý chọn ghi nhận muộn cho kỳ cũ hoặc ghi nhận kỳ hiện tại; không đánh dấu hoàn thành cả hai. Hệ thống vẫn lưu liên hệ này trong lịch sử học viên để tránh liên hệ dồn dập chỉ nhằm làm đẹp số liệu. Khi cần kết thúc nghĩa vụ cũ bằng ngoại lệ, chủ trung tâm duyệt lý do và báo cáo riêng, không ghi là Coaching đã thực hiện.

### 6.3. Chất lượng trao đổi và tải công việc

Mẫu trao đổi tháng phải có một điểm tiến bộ hoặc điều học viên làm tốt, một khó khăn cần hiểu, một hành động cụ thể và lần theo dõi tiếp. Với học viên đang học tốt vẫn ghi nhận tiến bộ và mục tiêu tiếp theo; không cố tìm vấn đề để đủ biểu mẫu. Trợ lý xem các lần liên hệ gần nhất trước khi gọi để tránh hỏi lại phụ huynh điều trung tâm đã biết. Nhận xét phải gắn với dữ liệu hoặc nội dung trao đổi, không tự suy diễn nguyên nhân từ điểm thấp.

Khi lập lịch phải đo năng lực thực tế: tổng phút cần/tháng = số học viên bắt buộc × thời gian trung bình mỗi lần Coaching, cộng thời gian thử liên hệ lại và xử lý cảnh báo. Dashboard hiển thị số việc và hạn của từng trợ lý, cảnh báo quá tải để chủ trung tâm điều phối. Chưa có số lượng học viên, số trợ lý và thời lượng trao đổi thực nên chưa thể kết luận nhân sự hiện tại đủ đáp ứng; P0 cần đo các số này trước khi cam kết lịch toàn trung tâm.

## 7. Giao diện và chỉ số

Thêm mục **Chăm sóc học viên**, sử dụng thiết kế và thành phần có sẵn:

- **Cần hỗ trợ:** chưa nhận, của tôi, quá hạn, đang theo dõi, đã hoàn thành; lọc học viên/lớp/lý do/người phụ trách.
- **Coaching tháng:** tổng bắt buộc, đã hoàn thành, chưa làm, quá hạn, ngoại lệ, chưa phân công; xem tháng cũ.
- **Theo dõi riêng:** bảo lưu/ngừng học, nguyên nhân, người phụ trách và lịch liên hệ tiếp.
- **Chi tiết công việc:** bằng chứng, người nhận, đồng hồ hạn, lần liên hệ gần nhất, kết quả, nút nhận/chuyển người/ghi liên hệ/tạo hoặc gắn Coaching.

Dashboard trợ lý hiển thị việc cần nhận và công việc của mình; dashboard chủ trung tâm hiển thị bao phủ Coaching, quá hạn và tải công việc theo trợ lý. Hồ sơ học viên thật có lịch sử chăm sóc tổng hợp. Chuông thông báo dẫn về công việc, không chỉ đưa về danh sách chung.

Chỉ số vận hành:

| Chỉ số | Cách tính |
|---|---|
| Bao phủ Coaching | Nhiệm vụ tháng hoàn thành đủ tiêu chí / học viên bắt buộc của kỳ; hiển thị riêng ngoại lệ |
| Đúng hạn | Hoàn thành trước due_at / nhiệm vụ đến hạn; không lấy trạng thái hiện tại để viết lại lịch sử |
| Nhận đúng hạn | Cảnh báo nhận trong 24h / cảnh báo hợp lệ đã tới hạn nhận |
| Liên hệ đúng hạn | Cảnh báo có lần thử liên hệ trong 48h / cảnh báo hợp lệ đã tới hạn liên hệ; thêm tỷ lệ liên hệ thành công |
| Không bỏ sót | Số học viên thiếu nhiệm vụ tháng, số việc chưa phân công, số quá hạn |
| Sau hỗ trợ | Chuyên cần/điểm ở các buổi tiếp theo, tái phát cảnh báo, trạng thái học viên; có nhãn thiếu dữ liệu |
| Duy trì học | Đối chiếu cohort theo tháng và lý do bảo lưu/ngừng học; chưa quy kết quan hệ nhân quả cho tính năng |

Tổng đếm tính tại DB trên toàn bộ tập dữ liệu có quyền, danh sách phân trang. Giao diện phải phân biệt không có công việc với lỗi tải dữ liệu hoặc dữ liệu quá cũ. Không để màu xanh “không có cảnh báo” khi bộ đánh giá chưa chạy.

## 8. Kiến trúc đề xuất

Tận dụng Supabase/Postgres, pg_cron, notifications và Coaching có sẵn; không cần dịch vụ nền mới ở phiên bản đầu. DB là nơi thực thi quy tắc và bảo đảm chống trùng. Next.js Server Actions gọi RPC có phân quyền, UI chỉ trình bày và nhận thao tác.

### 8.1. Dữ liệu bổ sung

Thiết kế logic dự kiến, tên và migration chi tiết chốt khi triển khai:

| Bảng | Vai trò và khóa |
|---|---|
| `student_care_policy_versions` | Phiên bản ngưỡng và SLA chung, effective_from, người thay đổi; lưu version trong từng cảnh báo |
| `student_care_assignments` | Một người phụ trách hiện hành mỗi học viên; lịch sử đổi người trong events |
| `student_care_tasks` | Công việc `alert` hoặc `monthly`, student, period, status, owner, detected_at, claim_due_at, contact_due_at, next_followup_at, completed_at, outcome; version chống ghi đè |
| `student_care_signals` | Rule, episode_key, policy_version, trạng thái tín hiệu, snapshot bằng chứng, first/latest detection, liên kết alert task |
| `student_care_events` | Append-only: tạo, nhận, chuyển người, liên hệ, đổi hạn, đóng/mở lại, thu hồi; actor nullable chỉ cho nguồn hệ thống có metadata |
| `student_care_coaching_links` | Nối công việc với Coaching hiện có, cùng student; một phiếu có thể phục vụ cảnh báo và nhiệm vụ tháng |
| `student_care_evaluation_queue` | Một hàng/student, version thay đổi, attempts, retry_at; tránh mất cập nhật khi worker đang chạy |

Các liên hệ là loại event có trường cấu trúc và payload được validate, không thêm một hệ thống ghi chú cạnh tranh với Coaching. Thông tin đóng phiếu Coaching vẫn được ghi bằng RPC hiện có; care task chỉ tham chiếu và quản lý nghĩa vụ/hạn. Không biến `review_at` bất biến của Coaching cũ thành lịch nhắc việc duy nhất.

Ràng buộc bắt buộc: một nhiệm vụ tháng/student/kỳ; một alert task chưa kết thúc/student; unique signal episode; cùng học viên khi nối phiếu; timestamp/trạng thái hợp lệ; FK on delete restrict; ghi dữ liệu qua transaction/RPC. Snapshot chỉ chứa trường cần giải thích điều kiện, không sao chép toàn bộ hồ sơ gia đình.

### 8.2. RPC và xử lý nền

Các thao tác dự kiến: lấy danh sách phân trang và tổng đếm, lấy chi tiết, nhận việc, chuyển người, ghi liên hệ, đặt lịch theo dõi, hoàn thành/hủy có lý do, tạo/gắn Coaching, hoàn thành nghĩa vụ tháng từ một liên hệ đủ điều kiện. Mỗi mutation nhận request_id hoặc version để retry không tạo sự kiện/phiếu trùng.

Đề xuất luồng nền:

1. Trigger nhẹ ở attendance/results/session/roster/enrollment đánh dấu student cần tính lại, kể cả sửa ngày/giờ, hủy buổi, reset buổi hoặc thay danh sách tham gia. Đánh dấu cả học viên trước và sau thay đổi.
2. Một job mỗi phút xử lý hàng đợi theo batch, đánh giá lại dữ liệu, ghi tín hiệu/công việc/thông báo trong transaction theo student. Lỗi một student không chặn toàn bộ batch; có retry giới hạn và hàng lỗi cần xử lý.
3. Một job mỗi giờ đối soát nhiệm vụ tháng, thay đổi trạng thái/người phụ trách và hạn; gửi bản nhắc ngày theo khóa ngày Việt Nam, không tạo lại ở mọi lần quét. Quá hạn cấp trên kiểm tra mỗi giờ.
4. Một lượt đối soát dữ liệu mỗi đêm, chạy chia batch với cursor, xử lý cả các kỳ bị chỉnh sửa trong quá khứ. Khôi phục lần chạy bị bỏ lỡ bằng watermark, không quét toàn lịch sử mỗi phút.

Hai job đầu có thể dùng cùng dispatcher nếu tải thực tế nhỏ; chốt theo EXPLAIN và số lượng thực, không tạo thêm hạ tầng chỉ để chia nhỏ tên chức năng.

Xử lý đồng thời: lock theo student/claim task, thứ tự lock ổn định, unique constraints; queue version không bị xóa nếu dữ liệu mới vào trong lúc đánh giá. Theo tài liệu PostgreSQL, row lock hỗ trợ tuần tự hóa cập nhật cùng hàng; phải kiểm thử deadlock và retry phù hợp. Nguồn: [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html).

### 8.3. Thông báo và quyền

- Bản phát hiện mới gửi tới toàn bộ nhân sự active có role assignment `assistant_manager` chưa thu hồi và quyền nhận/xem chăm sóc. `owner` xem toàn bộ và nhận escalation theo chính sách.
- Hạn/nhắc sau nhận gửi người phụ trách, chủ trung tâm nhận escalation. Thay đổi lý do quan trọng gửi thông báo bổ sung có dedupe, không gửi theo mỗi lần worker chạy.
- Tận dụng unique recipient + dedupe_key hiện có. Mã mới dự kiến `student_care.detected`, `student_care.overdue`, `student_care.escalated`, `student_care.assigned`, `student_care.monthly_due`.
- Nội dung notification bất biến: dữ liệu sửa thì liên kết mở trạng thái hiện hành, hiển thị đã thu hồi nếu cần; không xóa lịch sử hoặc chỉnh read_at của người khác.
- Coaching tháng dùng thông báo tổng hợp việc đến hạn cho từng trợ lý, tránh một loạt thông báo đầu tháng cho mọi nhân sự.
- Thêm quyền hẹp `student_care.view`, `student_care.handle`, `student_care.assign`, `student_care.configure`. Owner có đủ; trợ lý xem/nhận/xử lý, đổi phân công toàn bộ và cấu hình chỉ owner theo mặc định.
- Kiểm tra quyền tại Server Action và RPC/RLS; sau nhận chỉ owner hiện hành hoặc người có quyền điều phối được sửa. Thu hồi vai trò phải chặn truy cập hồ sơ/nhắc mới và đưa việc vào hàng chuyển giao.
- Job dùng hàm hệ thống được revoke khỏi public/anon/authenticated, không gọi RPC cần auth.uid() rồi tạo tài khoản giả. Khi nối tới Coaching, thao tác tạo phiếu là hành động người dùng đã đăng nhập như hiện tại.

### 8.4. Độ tin cậy và hiệu năng

Supabase Cron cho phép gọi SQL/database function và có lịch sử `cron.job_run_details`. Đề xuất dùng nền tảng này vì repository đã có; cần kiểm tra extension và quyền scheduler trên môi trường đích. Nguồn: [Supabase Cron](https://supabase.com/docs/guides/cron).

Lưu last_successful_run, backlog, oldest_pending, lỗi gần nhất và độ trễ đánh giá. Dashboard tính freshness độc lập: job chết không thể trông chờ chính job gửi báo lỗi. Có cảnh báo dữ liệu chậm nếu không thành công trong 5 phút và hướng dẫn xử lý. Nếu hạ tầng có giám sát sẵn thì kết nối vào đó; không giả định đã có kênh cảnh báo ngoài app.

Mục tiêu nghiệm thu dự kiến: cảnh báo xuất hiện trong DB <=2 phút sau dữ liệu hợp lệ, UI đang mở cập nhật trong <=60 giây tiếp theo; phân trang 50 hàng, truy vấn dashboard p95 <1 giây ở tải đo trên staging. Đây là mục tiêu cần đo, chưa phải số đo hiện có. Đọc dữ liệu có giới hạn và index theo student/date, trạng thái/owner/due_at, monthly period. UI làm mới khi trở lại tab và polling nhẹ khi đang mở; không phụ thuộc điều hướng trang mới cập nhật chuông.

## 9. Trình tự triển khai và gói công việc

| Gói | Nội dung | Điều kiện hoàn thành | Ước lượng người triển khai, chưa gồm chờ duyệt |
|---|---|---|---|
| P0 | Chốt các diễn giải còn mở, đo số học viên/buổi, audit role, migration và cron trên staging | Có dữ liệu mẫu và hợp đồng quy tắc | 0,5–1 ngày |
| P1 | Schema care, constraints, RLS, RPC nhận/chuyển việc, events, policy versions | Kiểm thử quyền và nhận đồng thời pass | 2–3 ngày |
| P2 | Ba quy tắc, queue, tính lại, chống trùng, scheduler, freshness | Fixtures và replay/sửa dữ liệu pass | 2–3 ngày |
| P3 | Danh sách chăm sóc, chi tiết, liên hệ, hạn/nhắc/escalation, dashboard/chuông, tích hợp hồ sơ | Trợ lý xử lý cảnh báo trọn luồng trên staging | 2–3 ngày |
| P4 | Nghĩa vụ tháng, phân công lâu dài, lịch đều, hoàn thành có bằng chứng, nối Coaching/form | Đối soát 100% danh sách bắt buộc, không mất người ngoài trang đầu | 2–3 ngày |
| P5 | Kiểm thử tích hợp, UAT, chạy đối chiếu, hướng dẫn vận hành và phát hành | Không còn sai cảnh báo/quyền/bao phủ ở tập nghiệm thu | 2–3 ngày |

Tổng sơ bộ 10,5–16 ngày công; có thể thay đổi sau P0. AI có thể hỗ trợ viết và kiểm thử nhanh hơn nhưng chưa đủ bằng chứng để hứa thời gian rút gọn; thời gian quan sát vận hành và UAT không thể coi bằng thời gian sinh code.

Thứ tự: P0 → P1 → P2 → P3 → P4 → P5. P3/P4 dùng cùng nền tảng để không phải viết lại; Coaching tháng thuộc phạm vi bắt buộc của đợt tính năng này, không đưa vào mục “sau này”. Có thể bật cảnh báo trước cho nhóm thí điểm trong khi hoàn thiện P4.

Các vùng code dự kiến:

- Migrations mới trong `supabase/migrations/`; giữ bất biến migration cũ.
- Module mới `src/features/student-care/`, routes `src/app/(app)/student-care/`.
- `src/features/dashboard/data.ts`, `read-models.ts`, `dashboard-page.tsx` và component chăm sóc.
- `src/features/notifications/data.ts`, `notification-list-page.tsx`, thành phần chuông hiện hành: phân trang, nhãn và refresh.
- `src/features/students/detail/student-profile-page.tsx` (thay `database-student-detail-page.tsx` từ 2026-10-12) và route student thật: bảng tóm tắt/lịch sử.
- `src/features/coaching/`: liên kết care, danh sách phân trang, dùng RPC Coaching cũ tạo phiếu; không phá public form.
- `src/lib/permissions/types.ts`, navigation config hiện hành, `src/types/database.generated.ts`: quyền, menu, types.
- Kiểm thử DB trong `supabase/tests/`, unit/component trong `tests/`, E2E theo cấu hình Playwright hiện tại.

Trước sửa Next.js đọc tài liệu đúng phiên bản trong `node_modules/next/dist/docs/`, đặc biệt Server Actions, authorization và invalidation; đã đọc hướng dẫn mutating data khi lập bản này.

## 10. Nghiệm thu và kiểm thử

### Quy tắc

1. CP + KP ở hai buổi liền kề, kể cả khác lớp, tạo một cảnh báo nghỉ liên tiếp.
2. CP + present + KP không tạo nghỉ liên tiếp; ba lần vắng trong cùng tháng tạo cảnh báo tháng.
3. Hai ngày cuối/đầu hai tháng có thể tạo chuỗi liên tiếp nhưng không cộng gộp cho ngưỡng ba buổi/tháng.
4. Điểm 5.5 + 5.9 cảnh báo; 5.5 + 6.0 không; điểm vở thấp không kích hoạt.
5. Null/thiếu điểm/thiếu điểm danh không chuyển thành 0/vắng. 5 → null/vắng → 5 tạo cảnh báo điểm thấp; chỉ một bài có điểm thì chưa cảnh báo; 5 → 7 → 5 không cảnh báo. Nhập bù điểm 7 cho buổi ở giữa phải tính lại và thu hồi tín hiệu sai, giữ lịch sử xử lý.
6. Cùng ngày khác giờ, học thêm, học bù, chuyển lớp, roster theo component, trước nhập học và buổi hủy đều có fixture riêng.
7. Nghỉ/điểm xấu kéo dài không tạo nhiều công việc mở cùng học viên; nhiều lý do hiển thị đủ bằng chứng.

### Trạng thái và dữ liệu sửa

8. Sửa 5 thành 7, sửa vắng thành có mặt, reset/hủy/sửa lịch/roster tính lại đúng; tín hiệu thu hồi không xóa lịch sử.
9. Hai trợ lý nhận cùng lúc: một thành công, một nhận thông báo đã được nhận; không ghi đè owner.
10. Retry mutation, worker, cron hoặc mở lại trang không tạo phiếu, event hay notification trùng.
11. Dữ liệu mới đến trong lúc worker chạy không bị mất; lỗi một student không ngăn student tiếp theo.
12. Nhận sau 24h, liên hệ sau 48h, escalation sau 72h dùng đồng hồ giả lập; hẹn theo dõi tiếp quá hạn 24h báo owner, không gửi lặp khi job retry; thông báo đã đọc không tắt nhắc nghiệp vụ.
13. Đổi owner hoặc thu hồi role chuyển trách nhiệm rõ, người cũ không sửa bằng request cũ.

### Coaching tháng

14. Chạy sinh kỳ nhiều lần chỉ một nhiệm vụ/student/tháng; bổ sung học viên mới/đi học lại không bỏ sót.
15. Dataset hơn 500 học viên và hơn 200 phiếu vẫn đối soát đầy đủ, không dựa vào các limit UI cũ.
16. Một học viên nhiều lớp chỉ có một nghĩa vụ tháng; phân công ổn định qua chuyển lớp.
17. Không liên lạc được/gửi form chưa được tính hoàn thành theo tiêu chí đã xác nhận.
18. Liên hệ xử lý cảnh báo chỉ hoàn thành tháng khi đủ checklist, cùng học viên và kỳ; không đánh dấu nhiều tháng bằng một thao tác.
19. Kỳ cũ quá hạn vẫn còn ở kỳ mới; hoàn thành muộn không được đổi thành đúng hạn; ngoại lệ hiển thị riêng. Sau ngày 25 chưa tự đánh dấu quá hạn kỳ nếu vẫn trong tháng, nhưng lịch hẹn cụ thể đã trễ vẫn bị nhắc; cuối tháng tính theo múi giờ Việt Nam.

### Quyền, giao diện, vận hành

20. Assistant/owner/teacher/teaching_assistant/anon, role revoked, inactive profile đều có ca DB/RLS; không lộ ghi chú hoặc đường dẫn hồ sơ qua public coaching form.
21. Dashboard, chuông, care task và hồ sơ học viên phản ánh cùng trạng thái; lỗi tải không thành zero.
22. Cron ngừng/chạy lỗi/backlog lớn hiện stale state; restart chạy bù an toàn; mốc tháng tính đúng múi giờ Việt Nam.
23. Regression: điểm danh, điểm số, khóa buổi, ledger, Coaching cũ, public form và salary notifications không thay đổi ngoài phạm vi.

Phân tầng: DB tests cho rules/RPC/RLS/concurrency/idempotency; unit cho trình bày/lọc/validation; component cho trạng thái trống/lỗi/quá hạn; E2E cho trợ lý nhận → liên hệ → nối Coaching → hoàn thành tháng và chủ trung tâm kiểm tra quá hạn. Chạy lint, typecheck, test phù hợp, build và test DB staging/local trước phát hành. Chưa chạy các bài test này trong phiên lập kế hoạch vì chưa có implementation.

## 11. Đưa vào sử dụng và khôi phục

1. Staging: áp migration mới, kiểm tra role, scheduler, dữ liệu nhiều lớp và chất lượng lịch sử.
2. Chạy đối chiếu không gửi thông báo trong một tuần vận hành, so với trợ lý kiểm tra tay; đánh dấu rõ đây là giai đoạn đối chiếu, chưa có cảnh báo vận hành thật.
3. Backfill theo lô: lấy tháng hiện tại và đủ buổi trước đó cho chuỗi; giữ nguyên ngày học, dùng ngày kích hoạt làm mốc SLA cho việc lần đầu được đưa vào vận hành. Không gửi dồn thông báo mọi vi phạm lịch sử; báo tổng hợp danh sách khởi tạo.
4. Bật cho nhóm thí điểm bằng cấu hình rollout; dashboard ghi rõ độ bao phủ. Sau nghiệm thu mở toàn trung tâm; kiểm tra danh sách toàn trung tâm trước khi thông báo đã hoàn tất.
5. Phân công trợ lý, hướng dẫn quy trình nhận/liên hệ/theo dõi; chủ trung tâm kiểm tra việc quá hạn hằng ngày và độ bao phủ mỗi tuần.

Rollback: tắt generation/notification flags và unschedule chỉ job care, giữ bảng và lịch sử, vẫn cho đọc/ghi xử lý tay nếu cần; không rollback phá dữ liệu bằng DROP. Sửa tiến bằng migration tiếp theo. Thông báo đã gửi giữ nguyên, hiển thị trạng thái nguồn nếu bị thu hồi. Không ảnh hưởng cron chấm công hiện có.

## 12. Các quyết định còn mở trước khi code phần phụ thuộc

Các câu hỏi đã gửi đều đã được trả lời: tháng dương lịch; hai bài có điểm gần nhất; mục tiêu trước ngày 25, hạn kỳ cuối tháng; báo owner sau 24h trễ hẹn theo dõi tiếp. Các quyết định này đã cập nhật vào quy tắc, giao diện và tiêu chí nghiệm thu ở trên.

Các chi tiết vận hành còn cần rà soát ở P0/UAT:

1. Quy tắc ngoại lệ cho học viên mới cuối tháng và phạm vi nhóm waiting_class sau khi xem dữ liệu thực.
2. Đề xuất dùng buổi completed chưa khóa để cảnh báo sớm, kèm tính lại khi chỉnh sửa; cần kiểm tra mức tin cậy dữ liệu nhập hiện tại trong UAT.

Đây là các đề xuất cần duyệt, không phải yêu cầu đã được chủ trung tâm xác nhận. Không chặn việc đọc mã, chuẩn bị dữ liệu thử và hoàn thiện thiết kế độc lập.

## 13. Trạng thái rà soát gstack

DONE_WITH_CONCERNS: đã nghiên cứu mã nguồn, quy trình và tài liệu chính thức; đã lập bản đặc tả/kế hoạch theo phạm vi người dùng yêu cầu. Gstack runtime tại đường dẫn cấu hình bị thiếu nên onboarding/telemetry/log tự động không chạy. Không tuyên bố đã hoàn tất quy trình plan-eng-review hoặc được review độc lập. Không tạo issue, không chạy agent triển khai, không sửa ứng dụng, không deploy.

Ghi nhận bền vững cho lần triển khai: Coaching records/events là append-only và bắt buộc actor/owner; scheduler không có auth.uid(); giới hạn 200/500/50 của UI hiện tại không đủ để làm đối soát chăm sóc toàn trung tâm. Cần dùng lớp nhiệm vụ và tổng đếm DB, giữ tương thích Coaching cũ.
