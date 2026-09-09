# Đối chiếu module Stumana với ERP trung tâm

Ngày 09/09/2026 · Bổ sung cho HANDOFF.md · Hướng giao diện đã chọn: đỏ ấm, bo mềm.

## Kết luận

Có thể đưa nhiều cách tổ chức và một số tính năng tương tự Stumana vào ERP. Không cần thay hệ thống đang có. Ưu tiên sắp xếp giao diện đúng 6 phân hệ/28 mục module; sau đó thêm lịch trực quan và trang lớp có ngữ cảnh đầy đủ. Thư viện, tự đăng ký, kênh nhắn tin và AI là dự án chức năng riêng.

**Chưa đủ bằng chứng để kết luận có thể đồng bộ dữ liệu trực tiếp giữa Stumana và ERP.** Trang tích hợp Stumana được kiểm tra chỉ giới thiệu Zoom, Google Calendar/Meet và Zalo OA. Chưa thấy tài liệu API/webhook dành cho ERP bên ngoài trong phạm vi khảo sát. Không suy ra việc Stumana kết nối được Google/Zalo đồng nghĩa họ cung cấp API cho ứng dụng của trung tâm.

## Cách đọc độ chắc chắn

- **Đã thấy:** đọc trực tiếp giao diện Chrome của tài khoản hiện có, ngày 09/09/2026. Không gửi dữ liệu hay lưu thao tác.
- **Mã nguồn:** route, model hoặc component tồn tại trong checkout hiện tại. Chưa đồng nghĩa đã kiểm thử mọi luồng production.
- **Đề xuất:** đánh giá thiết kế/kỹ thuật, chưa phải chức năng được tích hợp.
- **Chưa xác minh:** thiếu dữ liệu mẫu hoặc chưa kiểm tra chi tiết; không ghi là không tồn tại.

## 1. Các module Stumana đã mở thêm

| Trang nguồn | Nội dung đã thấy | Giới hạn |
|---|---|---|
| [Vận hành](https://stumana.com/operations) | Khu vực Hộp thư, Học phí, Giảng viên, Báo cáo; cảnh báo cần xử lý | Là trang tập hợp liên kết, không phải sidebar accordion |
| [Khóa học](https://stumana.com/courses) | Tìm tên; lọc đang diễn ra/đã lên lịch/nháp; khóa của tôi; danh mục; sắp xếp; thẻ tiến độ | Chỉ một khóa nháp trong phiên |
| [Chi tiết khóa](https://stumana.com/courses/435) | Tab Tổng quan, Buổi học, Điểm danh, Chấm điểm, Chương trình, Học viên; checklist mở lớp; lịch tuần; gói phí; giảng viên; link tự đăng ký | Không thực hiện mở lớp hoặc ghi danh |
| [Chấm điểm](https://stumana.com/courses/435/grading) | Chọn buổi, điều hướng trước/sau, danh sách học sinh và tiến độ nhận xét | Chưa có học viên, chưa kiểm chứng cách nhập điểm |
| [Chương trình](https://stumana.com/courses/435/lesson_plans) | Giáo án theo buổi; tiến độ soạn; nhập giáo án; tài liệu; bài tập; chọn từ thư viện | Không soạn, tải lên hoặc gắn tài liệu |
| [Điểm danh](https://stumana.com/attendances) | Chọn ngày; mô tả điểm danh theo khung giờ/cả phòng | Trang rỗng, trong khi lịch có buổi của khóa nháp; chưa xác minh quy tắc khác nhau |
| [Lịch học](https://stumana.com/calendar) | Tuần/tháng, lọc khóa, khóa của tôi, ẩn buổi hủy, tổng giờ; liên kết tự xếp lịch; Google Calendar cá nhân; đăng ký lịch ICS | Không kết nối OAuth, không sử dụng/phát tán URL đăng ký lịch riêng tư. Tự xếp lịch mới thấy link, chưa thử thuật toán |
| [Học phí](https://stumana.com/payments) | Chưa đóng, đóng một phần, quá hạn, phụ phí, đã đóng; công nợ theo tháng; thu theo đợt; cảnh báo thiếu ngân hàng | Giao diện nói hóa đơn tạo từ ghi danh. Danh sách rỗng, chưa thử thu tiền |
| [Giảng viên](https://stumana.com/instructors) | Lớp, buổi sắp tới, mức lương, trạng thái, lọc chuyên môn, xuất | Chưa kiểm tra cách tính lương chi tiết |
| [Thư viện](https://stumana.com/library_items) | Bài tập, bài kiểm tra, tài liệu đơn, tài liệu, flashcard; tag; số lần dùng; gắn vào lớp/buổi; đăng khu luyện tập | Không sửa/xóa/xuất bản |
| [Yêu cầu đăng ký](https://stumana.com/enrollment_requests) | Đăng ký qua link chia sẻ; chờ duyệt, đã ghi danh, danh sách chờ, từ chối; các nhánh inbox/bình luận/góp ý/cảm nhận | Chưa có yêu cầu; các nhánh hộp thư mới thấy liên kết |
| [Báo cáo](https://stumana.com/reports) | Tài chính, doanh thu, công nợ, ghi danh, phễu, điểm danh, tiến độ HS, hiệu suất GV, lương, tùy chỉnh, lịch gửi | Xác nhận danh mục, chưa nghiệm thu công thức hoặc gửi định kỳ |
| [Cài đặt](https://stumana.com/settings) | Thương hiệu, trang công khai, lịch/cơ sở, khoản thu, giới thiệu, quyền, kênh tin, dữ liệu/mẫu, nhật ký | Đã đọc danh mục, không sửa cấu hình |
| [Tích hợp](https://stumana.com/settings/integrations) | Zoom: phòng và bản ghi; Google Calendar/Meet; Zalo OA/ZNS | Cả ba hiển thị chưa kết nối; chưa xác minh đồng bộ thực tế |
| [Trợ lý AI](https://stumana.com/chats) | Chat, đính kèm, công cụ, giọng nói | Không gửi prompt; chưa xác minh AI có quyền hành động hay độ chính xác |

Chưa khảo sát sâu Cộng đồng, Công cụ, Ưu đãi, storefront, chương trình giới thiệu hoặc toàn bộ màn hình cài đặt. Không đưa các mục này vào danh sách tính năng đã kiểm chứng đầy đủ.

## 2. Bảng khả năng áp dụng

| Chức năng tham chiếu | ERP hiện có và bằng chứng | Khả năng áp dụng | Đề xuất |
|---|---|---|---|
| Khóa học tập trung nhiều tab | classes/class-detail-page.tsx có thông tin, trạng thái, lịch; sessions và learning-results là module riêng | Cao, nhưng cần tổng hợp query đúng quyền | Bổ sung vùng ngữ cảnh lớp với liên kết buổi học, học viên, kết quả; không đổi Lớp học thành Khóa học ở toàn ERP |
| Lịch tuần/tháng | SessionDirectoryItem có ngày, giờ, lớp, phòng, trạng thái; directory lọc ngày/lớp/loại | Cao cho chế độ xem; chưa có calendar UI được tìm thấy trong phạm vi code | Thêm chế độ Lịch trong Buổi học; cùng dữ liệu, cùng quyền, không tạo nguồn lịch thứ hai |
| Sinh buổi từ lịch định kỳ | class-schedule-actions.ts, session-generator-actions.ts và RPC materialize_class_sessions | Đã có nền tảng | Cải thiện preview sinh lịch và cảnh báo; không gọi “AI tự xếp lịch” hoặc viết lại generator |
| Điểm danh theo cả phòng | session-attendance-actions.ts, session-lock-actions.ts, session-reversal-actions.ts | Trung bình: thao tác nhiều buổi cần nhiều guard | Đợt đầu thêm liên kết đi thẳng từng buổi; batch điểm danh chỉ sau đặc tả khóa/đảo/trùng thao tác |
| Chấm điểm/nhận xét | session-result-actions.ts, session-result-management.tsx; learning-results | Đã có một phần tương ứng | Trình bày kết quả gắn lớp/buổi; không tuyên bố có LMS/giao bài online |
| Giáo án, học liệu tái sử dụng | Chưa tìm thấy module tương ứng trong navigation và các feature được tìm kiếm | Chức năng mới | MVP giáo án + tài liệu gắn lớp/buổi; sau đó bài tập, bài nộp, chấm và phiên bản học liệu |
| Học phí/công nợ | finance, payment-requests, orders, session-ledger, tuition-periods, receiving-accounts và SePay | Đã có hệ thống nghiệp vụ riêng | Học cách trình bày trạng thái; bảo toàn định nghĩa tiền/buổi, kỳ thu, đơn hàng và đối soát |
| Nhắc học phí qua Zalo/email | Có thông tin Zalo phụ huynh và thông báo; chưa thấy connector gửi Zalo trong tìm kiếm | Cần tích hợp mới | Outbox, mẫu tin, opt-in/phạm vi người nhận, chống gửi lặp, callback trạng thái và lịch sử gửi; người dùng duyệt trước khi bật gửi |
| Yêu cầu đăng ký công khai | CRM có trial booking, assignment, checklist 10 mục; coaching có form công khai nhưng khác mục đích | Trung bình | Form tuyển sinh tạo yêu cầu/lead chờ kiểm tra, không bỏ qua 10 bước hoặc tự kích hoạt học viên |
| Báo cáo | Dashboard nhiều read model; reports/catalog.ts: sessions available, students/CRM/staff planned | Một phần sẵn, một phần chưa | Hoàn thiện report export theo catalog; nhãn planned rõ; không làm nút xuất chung giả |
| Lương GV | staff, timekeeping, payroll/dashboard, payroll, advances, grading-credits, commissions | ERP có nhiều quy trình liên quan hơn phần đã thấy | Giữ riêng các module; không thay toàn bộ bằng một trang “Giảng viên” |
| Google Calendar / ICS | Google sign-in tồn tại, không chứng minh Calendar OAuth; có meetingUrl trong lịch lớp | Tích hợp mới | ICS một chiều hoặc đồng bộ một chiều trước; giới hạn dữ liệu, token thu hồi được; Google OAuth và refresh token riêng |
| Zoom / Meet | meetingUrl trong class-schedule-form-schema.ts | URL có sẵn, tự tạo phòng chưa chứng minh | Đợt đầu hiển thị link thật; phase tích hợp mới xử lý tạo/cập nhật phòng, lỗi, tài khoản sở hữu |
| AI | Chưa thấy module AI tương ứng | Chức năng mới, nhiều phụ thuộc | Bắt đầu hỏi đáp chỉ đọc trên dữ liệu được phép; không cho AI tự thu tiền, đổi quyền, khóa buổi hay duyệt lương |
| Trang công khai / referral | Có CRM lead source và commissions, không đồng nghĩa storefront/referral phụ huynh | Cần đặc tả mới | Tách khỏi redesign ERP; xác định chủ thể nhận thưởng, điều kiện và chống trùng |

Độ khả thi là suy luận kỹ thuật từ UI và mã nguồn đã đọc, chưa phải cam kết thời gian hoặc xác nhận API bên ngoài.

## 3. Đồng bộ trực tiếp Stumana ↔ ERP: cần gì?

Phân biệt hai hướng:

1. **Xây chức năng tương tự trong ERP:** khả thi với các mức trên, ERP tiếp tục là nguồn dữ liệu chính.
2. **Lấy/đẩy dữ liệu giữa hai sản phẩm:** chưa xác minh. Cần tài liệu API hoặc cơ chế xuất/nhập chính thức của Stumana. Menu CSV/Excel chỉ chứng minh có lựa chọn xuất, chưa chứng minh đủ schema để round-trip.

Nếu muốn đồng bộ, trước tiên phải có: tài liệu endpoint/webhook, phương thức xác thực, giới hạn truy cập; phạm vi tài khoản/gói; định danh học viên/lớp/ghi danh; quy tắc nguồn dữ liệu chính; thay đổi/hủy/đảo; trùng webhook; lịch sử đối soát và dữ liệu lỗi. Không dùng đồng bộ hai chiều học phí khi chưa xác định nguồn sổ tiền và khóa nghiệp vụ. Không dùng scraping giao diện làm kiến trúc tích hợp production.

Lộ trình thử hợp lý: danh mục lớp/học viên bằng dữ liệu giả → kiểm tra mapping → đồng bộ một chiều có log → đối soát và retry → mới cân nhắc dữ liệu học phí. Không dùng URL lịch ICS bí mật của tài khoản trong tài liệu chia sẻ.

## 4. Giao diện phải bám đúng module trung tâm

Bản mẫu ban đầu chỉ có các đường tắt và các màn hình minh họa nên chưa đủ dùng làm cây điều hướng production. Đã sửa bản mẫu sang **6 domain, 28 mục** lấy từ src/config/navigation.ts; danh sách máy đọc lưu ở NAVIGATION_INVENTORY.json.

| Phân hệ | Module hiện có |
|---|---|
| Tổng quan (1) | Tổng quan |
| Học vụ (5) | Học viên; Lớp học; Buổi học; Kết quả học tập; Coaching |
| Tuyển sinh (1) | CRM |
| Tài chính (7) | Học phí & Công nợ; Yêu cầu thanh toán; Giao dịch SePay; Đơn hàng; Sổ cái số buổi; Kỳ thu học phí; Tài khoản nhận SePay |
| Nhân sự (7) | Nhân sự; Chấm công; Tổng quan lương; Bảng lương; Tạm ứng lương; Tín chỉ chấm bài; Hoa hồng |
| Quản trị (7) | Import học viên; Import số dư buổi; Import lớp & lịch học; Import ghi danh; Báo cáo & Xuất dữ liệu; Cài đặt hệ thống; Nhật ký hệ thống |

28 mục là cấu hình navigation, không phải tổng số route màn hình. Còn các trang chi tiết/tạo/sửa và tiện ích:

- Năm học trong /classes/academic-years; chi tiết/sửa lớp trong /classes/[classId].
- Điểm danh, kết quả, khóa/đảo nằm trong /sessions/[sessionId], không tạo module điểm danh cạnh Học vụ ở đợt đổi theme.
- Coaching có forms, responses và form công khai riêng.
- Kỳ thu có templates, chi tiết, notice và print.
- Settings có general, users, permissions, audit-logs; giữ longest-match và ánh xạ /audit.
- Thông báo và Chấm công ngay vẫn là tiện ích header, không bỏ vì sao chép header Stumana.

### Quy tắc thiết kế cho từng loại trang

**Danh sách:** PageHeader → hành động hiện có → bộ lọc đúng feature → kết quả/phân trang → bảng/trạng thái rỗng. Không vẽ chỉ 2 filter nếu feature còn ngày, loại buổi và lớp.

**Chi tiết lớp:** tiêu đề + trạng thái + hành động được phép; thông tin lớp và lịch hiện tại. Gợi ý tổng hợp học viên/buổi/kết quả là phần bổ sung query, không được coi đã có chỉ vì vẽ tab.

**Chi tiết buổi:** lớp/ngày/giờ, loại buổi, trạng thái, khóa, điểm danh, kết quả; các hành động khóa/đảo giữ guard và giải thích hậu quả.

**Học phí:** không đồng nhất Đơn hàng, Yêu cầu thanh toán và Kỳ thu thành “Hóa đơn”; không áp quy tắc Stumana “chỉ tạo từ ghi danh” lên ERP.

**CRM:** dùng 6 trạng thái thật trong CrmCaseStatus và checklist 10 bước; bỏ sơ đồ 4 trạng thái minh họa cũ làm nguồn triển khai.

**Lương:** phân biệt kỳ lương, phiếu lương, chấm công, điều chỉnh, tạm ứng và tín chỉ chấm bài.

**Báo cáo:** trạng thái available/planned rõ; phiên kiểm tra mã nguồn chỉ xác nhận xuất danh sách buổi là available trong catalog.

**Shell:** nền trắng ấm, active đỏ nhạt, giữ sidebar domain và dải module. Dải module cuộn ngang khi dài, không nén nhãn; mobile dùng selector/drawer. Bản mẫu dùng dải cuộn để đối chiếu đầy đủ nhãn, chưa mô phỏng đầy đủ selector production.

## 5. Thứ tự thực hiện đề xuất

- **Đợt A, độ phức tạp thấp–vừa:** theme đỏ ấm, shell 6/28, giữ toàn bộ module, chỉnh bảng/filter/form theo feature. Không đổi nghiệp vụ.
- **Đợt B, vừa:** lịch tuần/tháng trong Buổi học, tổng quan lớp có liên kết đúng ngữ cảnh, Hôm nay bên cạnh Điều hành. Tái sử dụng query và permission, kiểm tra ngày giờ và buổi hủy/khóa.
- **Đợt C, vừa–cao:** form tuyển sinh công khai đi vào CRM và giáo án/tài liệu MVP. Cần model và quyền mới, xét trùng hồ sơ và quyền tải tài liệu.
- **Đợt D, cao:** Google/Zoom/Zalo và nhắc thu theo lịch; chỉ bắt đầu sau đặc tả tài khoản, token, gửi lặp, log, chi phí và quyền gửi.
- **Đợt E, riêng:** AI, tự xếp lịch tối ưu, LMS đầy đủ hoặc đồng bộ hai chiều Stumana. Chưa đủ bằng chứng để chốt scope và thời gian.

## 6. Bàn giao bổ sung cho Codex

Đọc MODULE_FIT_REVIEW.md trước HANDOFF.md khi hai tài liệu khác nhau về cây module. Lấy src/config/navigation.ts làm nguồn đường dẫn/quyền; NAVIGATION_INVENTORY.json là snapshot để đối chiếu, không tạo registry quyền mới. Preview chỉ minh họa theme và điều hướng; các module chưa có màn hình chi tiết hiển thị phạm vi đã kiểm tra, không giả có đủ chức năng.

Khi bắt đầu code, đọc guide Next.js tại node_modules/next/dist/docs/ như AGENTS.md yêu cầu. Đợt đầu chỉ làm A. Không tự kết nối tài khoản, gửi tin, sửa database hay đồng bộ dữ liệu giữa Stumana và ERP.

## 7. Giới hạn và ghi nhớ

Đã đọc trực tiếp ERP /sessions: shell có 6 domain, dải 5 module Học vụ; filter tìm kiếm/lớp/trạng thái/loại/từ ngày/đến ngày; trang hiện không có buổi. Những module ERP còn lại được đối chiếu cấu hình và các mã nguồn liên quan, không tuyên bố đã E2E toàn hệ thống. Danh mục Stumana không đồng nghĩa mọi tính năng backend đã thử.

Ghi nhớ lâu dài: không xem Google login là Calendar integration; trường Zalo phụ huynh là dữ liệu liên hệ, không phải connector; reports catalog có trạng thái planned. Bản mẫu chỉ được coi khớp module khi đủ 6 domain/28 liên kết và các trang con/tiện ích không bị mất trong kế hoạch.

**STATUS: DONE_WITH_CONCERNS** — hoàn tất đối chiếu và sửa cấu trúc bản mẫu; chưa xác minh API đồng bộ trực tiếp, chưa triển khai tích hợp hoặc đổi giao diện production.

### Kiểm tra bản mẫu sau sửa

Đã xác nhận trong Chrome: 6 nút domain; 5 module Học vụ và 7 module Tài chính; Học viên có 6 nhóm filter và 9 trạng thái từ student-filters.ts; lọc CLC trả về bản ghi mẫu phù hợp, reset hoạt động. Đã xem ảnh màn hình Tài chính, xác nhận 3 chỉ số và 6 cột theo trang tài chính thật. Snapshot cấu hình xác nhận tổng 28 mục. Các trang đối chiếu module còn lại không phải mockup nghiệp vụ hoàn chỉnh.
