# Changelog

All notable changes to Toan Thay Vinh ERP will be documented in this file.

## [0.30.0.0] - 2026-10-21

Chấm bài AI, Giai đoạn 3a: ERP tự gọi Claude để đọc ảnh đề và chấm bài nộp qua form, theo đáp án trợ giảng đã chốt. Kết quả AI hiện trên từng bài ở buổi học để trợ giảng tham khảo; duyệt điểm vào kết quả buổi và tin Zalo ở Giai đoạn 3b.

### Added
- **Chấm bài tự động:** chốt đáp án (hoặc sửa sau khi chốt) là mọi bài đang tính điểm của buổi được xếp lượt chấm; bài nộp sau khi đã có đáp án cũng vậy. Bài nộp lại thay bài cũ thì lượt chờ của bài cũ bị hủy. Mỗi bài chấm hai lần (mặc định Claude Haiku 5.5, mức suy luận vừa); hai lần khớp từng câu thì "xanh", lệch thì hỏi Claude Sonnet 5.5 làm trọng tài, có cờ hay AI không chắc thì "vàng", không có kết quả dùng được thì "đỏ" để chấm tay. Bài trống được 0 điểm mà không gọi AI. Không gửi họ tên, mã hay SĐT học sinh cho AI.
- **AI đọc đề chạy thật:** lượt "AI đọc đề" (mặc định Claude Opus 5.5) đọc các trang ảnh đề, điền bản nháp đáp án vào ô sửa và liệt kê chỗ ảnh khó đọc. Bản nháp đã sửa sau khi yêu cầu thì không bị ghi đè. Khu Bài kiểm tra và Bài nộp qua form tự cập nhật trong lúc AI đang đọc/chấm.
- **Bài nộp qua form** trên trang buổi học hiện kết quả AI: "AI đang chấm", "AI: 8 điểm · chấm 2 lần khớp" (hoặc "cần trợ giảng xem"), "AI không chấm được · chấm tay", kèm kết quả từng câu và chỗ sai. Điểm AI là tổng điểm câu đúng, chưa cộng điểm tích cực.
- **Cài đặt → Chấm bài AI** (chỉ owner sửa): bật/tắt, model chấm, mức suy luận, chấm hai lần, model trọng tài, model đọc đề, trần chi phí ngày (mặc định 20 USD). Trang hiện chi phí hôm nay/tháng này, số bài đã chấm, hàng đợi, lỗi, và lý do khi hàng đợi tạm dừng kèm nút "Chạy lại ngay".
- **Tiến trình nền:** chạy ngay sau khi có việc (bài nộp mới, chốt đáp án, AI đọc đề, mở trang buổi còn việc chờ) và qua lịch GitHub Actions 5 phút/lần gọi `/api/internal/ai-grading/worker` với `CRON_SECRET`. Lỗi tạm thời (quá tải, giới hạn theo phút) tự thử lại tối đa 3 lần; hết tín dụng, chạm trần chi tiêu, khóa API sai thì dừng cả hàng đợi 1 giờ và báo owner; chạm trần ngày thì dừng tới 0 giờ hôm sau. pg_cron 10 phút/lần cảnh báo khi có lượt chờ quá 20 phút hoặc lỗi trên 20% trong 1 giờ.
- Cần đặt trên Vercel: `ANTHROPIC_API_KEY` (workspace ai-grading) và `CRON_SECRET` (ít nhất 32 ký tự); trên GitHub: secret `CRON_SECRET` và `AI_GRADING_WORKER_URL`. Chấm bài AI mặc định tắt cho tới khi owner bật trong Cài đặt.

## [0.29.0.1] - 2026-10-21

Form nộp bài Apps Script: câu 6 có lại lựa chọn "Khác" như form gốc, tên tiếng Việt lấy từ ERP luôn hiện đúng dấu, và hàm kiểm tra kết nối nói rõ vì sao không gọi được ERP.

### Fixed
- **Câu 6 "Con muốn học thử miễn phí thêm các lớp Tiếng Anh chứ?"** có lại dòng "Khác: ___" như form gốc (bản Giai đoạn 1 vô tình bỏ đi). Cột N của tab `Data` ghi `Khác: <chữ học sinh gõ>` thay vì `Other`; câu 6 vẫn chỉ ghi Sheet, không gửi ERP. Chữ đã gõ được giữ khi mở lại form.
- **Tên học sinh và nhãn buổi học từ ERP** được đọc rõ bảng mã UTF-8. ERP trả JSON không ghi charset, nên nếu Apps Script đoán sai bảng mã thì tên bị vỡ chữ kiểu "Nguyá»…n".
- **`testErpConnection`** in địa chỉ ERP đang dùng và lý do khi gọi ERP thất bại, thay vì chỉ "HTTP 0 (lỗi)". Thiếu quyền gọi ra ngoài thì chỉ rõ cần thêm `script.external_request` vào `appsscript.json`.
- Cần dán lại `Code.gs` và `FormHocSinh.html` vào dự án Apps Script, rồi Deploy bản web app đang dùng với Version mới.

## [0.29.0.0] - 2026-10-20

Form thêm/sửa học sinh, form tạo/sửa lớp và trang tạo buổi học hàng loạt dựng lại theo phong cách Stumana (bước 15a): form dài có mục lục và thanh lưu luôn hiện, tạo buổi hàng loạt có lưới xem trước bấm chọn từng buổi, bỏ qua ngày nghỉ và giới hạn 100 buổi mỗi đợt.

### Added
- **Thêm / sửa học sinh** (`/students/new`, sửa hồ sơ): các mục Hồ sơ, Phụ huynh chính, Lý do thao tác nằm trong mục lục bên trái (hàng cuộn ngang trên điện thoại); mỗi mục ghi trạng thái bằng chữ ("5/9 · đủ", "thiếu 2", "1 lỗi"). Thanh lưu dưới đáy luôn hiện: "Đang nhập · n lỗi cần sửa" kèm tên trường lỗi đầu tiên. Khi tạo mới có thêm "Lưu và thêm tiếp" để nhập liền nhiều học sinh.
- Form học sinh khóa các ô trong lúc đang lưu, đưa con trỏ về trường lỗi đầu tiên (kể cả lỗi máy chủ trả về), về nút vừa bấm hoặc thông báo lỗi khi lưu không được, và hỏi trước khi rời trang nếu còn thay đổi chưa lưu.
- **Tạo / sửa lớp**: một khung "Thông tin lớp" theo lưới 6 cột và mục "Lịch tuần" ghi rõ các bước tiếp theo (Lưu lớp Nháp → Kích hoạt → Thiết lập lịch tuần → Tạo buổi hàng loạt); lớp ghép ghi rõ lịch và buổi thuộc các lớp thành phần; bước "Tạo buổi hàng loạt" chỉ có link với lớp đang hoạt động và người có quyền tạo buổi. Form lớp hỏi trước khi rời trang nếu còn thay đổi chưa lưu.
- **Tạo buổi học hàng loạt** `/sessions/batch`: lưới xem trước 6 cột (3 cột trên điện thoại), mỗi ô là một buổi bấm để chọn/bỏ chọn, phím mũi tên di chuyển giữa các ô; "Chọn tất cả / Bỏ chọn tất cả"; ô "Ngày nghỉ (bỏ qua)" bỏ chọn các ngày nghỉ trong lần tạo này; buổi trùng lịch đã có hiện "đã có (bỏ qua)", buổi ngoài thời gian hiệu lực của lịch hiện "ngoài hiệu lực" và đều không được gửi đi; nút chính "Tạo hàng loạt (n buổi học)" khóa kèm lý do khi chưa chọn buổi nào hoặc quá 100 buổi.
- Trang xem trước `/dev/forms?view=student|student-edit|class|class-edit|batch` với `role` và `state` (trả 404 trên production; mọi nút lưu chỉ trả lời "Bản xem trước không ghi dữ liệu." và không chuyển trang; form học sinh và form lớp chỉ link tới các trang /dev).

### Changed
- Ô nhập nhiều dòng (ghi chú, lý do, mẫu tin…) giữ đúng chiều cao tối thiểu 80px trên máy tính như thiết kế; trước đây co còn khoảng 40px từ màn hình 768px trở lên. Áp dụng cho mọi form dùng ô nhiều dòng chung, kể cả mẫu phiếu học phí, Cài đặt và màn nhập đáp án chấm bài AI; ô nào tự đặt chiều cao riêng thì giữ chiều cao đó.
- Nút, ô nhập và link hành động trên ba trang này cao 44px trên điện thoại cho dễ bấm.
- Trang tạo buổi hàng loạt dùng ngày theo giờ Việt Nam làm ngày bắt đầu mặc định; các nút chọn thứ trong tuần thể hiện trạng thái bằng cả viền, nền và độ đậm chữ.
- Tạo buổi hàng loạt từ chối mở với một lớp chưa kích hoạt, đã đóng hoặc không tồn tại (link cũ hoặc gõ tay) và yêu cầu chọn một lớp đang hoạt động, thay vì lặng lẽ dùng lớp hoạt động đầu tiên.
- Lý do "vẫn tạo hoặc cập nhật hồ sơ" khi trùng học sinh chỉ dùng cho đúng hồ sơ trùng đang hiện; đổi tên, năm sinh hoặc số điện thoại sang một học sinh trùng khác thì phải xác nhận lại.

### Fixed
- Ở "Lịch lặp tùy chỉnh", đổi Hình thức, Phòng học, Link phòng hoặc Mã thành phần sau khi chọn thứ trong tuần giờ được gửi lên đúng (trước đây các buổi vẫn tạo với giá trị cũ).
- Trang tạo buổi hàng loạt tự làm mới (mỗi phút với quản lý) không còn xóa các buổi đã bỏ chọn, đã sửa giờ/tên hay đã xóa khỏi danh sách.
- Form lớp không còn mất chữ đã gõ khi mất kết nối lúc lưu: hiện "Không thể kết nối tới hệ thống lưu lớp. Vui lòng thử lại." và giữ nguyên các ô.
- Ô "Số buổi học cần tạo" và "Số bắt đầu" xóa được để gõ lại trên điện thoại.

## [0.28.0.0] - 2026-10-20

Buổi học có khu **Bài kiểm tra** để trợ giảng tải ảnh đề, nhập đáp án từng câu và chốt đáp án (kế hoạch chấm bài AI, Giai đoạn 2 "Đề & đáp án"). AI sẽ chỉ chấm theo đáp án đã chốt; chưa có bước chấm bằng AI và chưa gọi Claude.

### Added
- **Bài kiểm tra** ở tab "Cuối giờ · Kết quả" của buổi học, ngay trên các thẻ cũ: dòng trạng thái Chưa có đề / Chờ chốt đáp án / Đã chốt đáp án (kèm số trang, số câu, tổng điểm, hoặc phiên bản, người chốt, giờ chốt). Màn hình lớn: ảnh đề bên trái (giữ nguyên khi cuộn), đáp án bên phải; điện thoại: một cột.
- **Ảnh đề nhiều trang**: chụp hoặc chọn nhiều ảnh một lần (JPEG, PNG, WebP, GIF). Trình duyệt thu nhỏ ảnh còn cạnh dài tối đa 2.576 px, lưu JPEG chất lượng 0,9, xoay đúng chiều và bỏ thông tin EXIF (vị trí GPS) trước khi tải lên. Ảnh HEIC từ iPhone: chọn từ Thư viện ảnh trên iPhone thì máy tự đổi sang JPEG; HEIC đến từ nơi khác bị từ chối kèm hướng dẫn đổi sang JPEG. Ảnh trùng một trang đã có thì bỏ qua. Tối đa 20 trang mỗi đề. Đổi thứ tự trang bằng nút lên/xuống, bỏ trang có bước xác nhận. Bấm vào trang để mở ảnh đầy đủ (phóng to trên điện thoại).
- **Nhập đáp án tay**: mỗi câu có số câu, điểm, đáp án cuối, cách viết khác được chấp nhận (mỗi dòng một cách, ví dụ 1/2 và 0,5), đề bài và lời giải chi tiết (mỗi dòng một bước, dùng cho mục "Bài chữa chi tiết" của tin Zalo) cùng ghi chú chấm. Tổng điểm hiện trực tiếp (đủ 10 / còn thiếu / thừa); điểm mỗi câu từ 0,25 đến 10 theo bước 0,25; nút "Chia đều 10 điểm"; "Lưu nháp" khi chưa xong.
- **Chốt đáp án**: chỉ chốt được khi câu nào cũng có điểm và đáp án cuối, tổng điểm đúng bằng 10; nút bị khóa thì ghi rõ lý do. Mỗi câu đúng trọn điểm hoặc sai, không có điểm từng phần. Sửa đáp án đã chốt bắt buộc ghi lý do và tạo phiên bản mới; người khác vừa chốt hoặc sửa thì báo tải lại thay vì ghi đè. Chốt, sửa và dùng lại đề đều ghi Nhật ký hệ thống (kèm bản đáp án cũ khi sửa).
- **Dùng đề có sẵn**: chọn đề đã chốt của buổi khác cùng ngày, cùng khối (xem trước đáp án), chép đáp án và chốt luôn cho buổi này; buổi này chưa có ảnh thì chép cả ảnh đề (dùng chung file, không nhân bản). Sửa đề gốc sau đó không tự cập nhật buổi này.
- **AI đọc đề**: nút xếp một lượt đọc đề (Claude Opus 5.5, mức suy luận cao) vào hàng chờ, có thể hủy khi còn chờ. Khi chưa cấu hình `ANTHROPIC_API_KEY` thì nút khóa với lời nhắn "Chưa cấu hình khóa AI — nhập đáp án tay". Tiến trình nền gọi Claude thuộc Giai đoạn 3; không đặt khóa này trên Vercel trước khi Giai đoạn 3 phát hành.
- Bảng `session_tests` (đề của buổi), `session_test_assets` (ảnh đề), `grading_runs` (mỗi lần gọi AI; giai đoạn này chỉ dùng loại `extract_key`), đều bật RLS và chỉ ghi qua RPC kiểm tra quyền. Buổi đã khóa hoặc đã hủy thì đề chỉ để xem.
- **Supabase Storage lần đầu dùng trong ERP**: bucket riêng tư `session-tests` (chỉ nhận ảnh, tối đa 10 MB/ảnh); tải lên, xem và xoá theo quyền; ảnh chỉ xem qua link ký sống 15 phút; ảnh đã tải không ghi đè được, và chỉ xoá được ảnh không còn trang đề nào dùng.
- Quyền mới **ai_grading.manage_tests** ("Quản lý đề kiểm tra") và **ai_grading.confirm_key** ("Chốt đáp án") cho chủ trung tâm, quản lý vận hành, quản lý trợ lý và trợ giảng (trợ giảng được chốt đáp án theo quyết định 17/10).
- Trang xem trước `/dev/session?test=none|pending|confirmed|ai` cho khu Bài kiểm tra (trả 404 trên production; các nút chỉ trả lời "Bản xem trước không ghi dữ liệu.").

## [0.27.0.0] - 2026-10-19

Thông báo, Nhật ký hệ thống và Báo cáo dựng lại theo phong cách Stumana (bước 14d): thông báo đọc nhanh theo loại sự kiện và mở thẳng trang liên quan, nhật ký lọc và xem dữ liệu trước/sau gọn trong một bảng, báo cáo hiện rõ cái nào xuất được và cần quyền gì.

### Added
- **Thông báo** `/notifications`: lọc nhanh Tất cả · Chưa đọc (số trên chip tính trong các thông báo của trang đang xem, có ghi rõ); dòng đầu trang ghi tổng số chưa đọc thật của tài khoản; danh sách dải trong một khung với ô biểu tượng theo loại sự kiện (tạm ứng, chăm sóc, buổi học, CRM, cảnh báo vận hành), tên, nhãn sự kiện, nội dung, giờ Việt Nam và chấm chưa đọc kèm chữ cho trình đọc màn hình.
- Bấm một thông báo chưa đọc mở ngay trang liên quan, việc đánh dấu đã đọc chạy ở nền (thao tác chậm không còn kéo người dùng quay lại trang thông báo); mở bằng tab mới cũng đánh dấu đã đọc. Thông báo không có link có nút "Đánh dấu đã đọc", kết quả hiện ngay trên dòng đó. "Đánh dấu tất cả đã đọc" là nút chính duy nhất của trang, báo kết quả ngay dưới tiêu đề. "Mới hơn / Cũ hơn" nằm trong khung danh sách và giữ chỗ con trỏ bàn phím khi chuyển trang.
- **Nhật ký hệ thống** `/audit`: dòng đầu trang "n bản ghi khớp bộ lọc · hiển thị 100 mới nhất" kèm nhắc thu hẹp bộ lọc để xem bản ghi cũ hơn; thanh lọc Từ ngày, Đến ngày, Module, Hành động, Người thực hiện, Loại đối tượng, Mã đối tượng (giữ nguyên địa chỉ lọc cũ); bảng Thời điểm (giây, giờ Việt Nam) · Người thực hiện ("Hệ thống" cho dòng ghi tự động, "khóa tự động") · Module (tên tiếng Việt) · Hành động · Đối tượng · Lý do · nút "Xem / Ẩn" mở dữ liệu trước / sau; màn hình hẹp hiện dạng thẻ.
- **Báo cáo & Xuất dữ liệu** `/reports`: lưới thẻ theo quyền với nhãn Có sẵn / Dự kiến, "Phạm vi", "Cần quyền"; "Xuất CSV" mở hộp thoại chọn khoảng ngày (chặn ngày bắt đầu sau ngày kết thúc, ghi rõ tối đa 1.000 buổi); thẻ dự kiến có nút khóa kèm "Chưa phát hành".
- Trang xem trước `/dev/lists?view=notifications|audit|reports` với `role=owner|ta|accountant` và `state=normal|capped|empty` (trả 404 trên production; các nút đánh dấu đã đọc chỉ trả lời "Bản xem trước không ghi dữ liệu.", hộp thoại xuất chỉ báo "Bản xem trước không xuất dữ liệu.").

### Changed
- Thẻ "Danh sách buổi học" và hộp thoại xuất ghi đúng giới hạn 1.000 buổi (trước đây ghi 300).
- Lọc Nhật ký: giá trị đang lọc không còn trong danh sách chọn vẫn hiện với nhãn "(đang lọc)"; "Xóa lọc" đặt lại cả các ô chọn; báo khi Từ ngày sau Đến ngày; thông báo lỗi không còn nhắc tên bảng dữ liệu.
- Ma trận phân quyền trong Cài đặt dùng tên tiếng Việt cho các nhóm Phân quyền, Vận hành hệ thống, Cài đặt, Chăm sóc học viên, Tin nhắn phụ huynh; Nhật ký hệ thống ghi nhóm "Chấm bài AI" thay vì mã gốc.
- Ô biểu tượng trên Tổng quan bo góc 6px đúng thiết kế.

### Fixed
- Thông báo lead CRM được giao, hẹn theo dõi lead, buổi chưa khóa, buổi chờ khóa và cảnh báo vận hành hiện đúng nhãn thay vì "Sự kiện chưa hỗ trợ".

## [0.26.0.5] - 2026-10-19

Bộ test tự động không còn lúc đạt lúc trượt ở phần thu hồi link phiếu Coaching khi máy bận; giao diện và cách ứng dụng chạy không đổi.

### Fixed
- Bộ test "Link phiếu công khai" (thu hồi link, bấm Hủy sau khi thu hồi lỗi) chờ nút "Thu hồi"/"Hủy" bật lại rồi mới bấm. Trước đây, khi chạy cả bộ test song song trên máy bận, khoảng 2/7 lần test bấm vào nút còn đang khóa (kết quả thu hồi đã hiện nhưng thao tác chưa xong) nên báo lỗi giả (thu hồi dòng thứ hai: "Unable to find a label … Lý do thu hồi …"; bấm Hủy: ô lý do vẫn còn).

## [0.26.0.4] - 2026-10-19

### Fixed
- **Ô nhập mã và mẫu tin dùng phông chữ đơn cách (monospace) như thiết kế** thay vì phông chữ thường: hai ô mẫu tin nhắn Zalo trong Cài đặt, ô "Mã học viên" trên form hồ sơ học viên, ô liên kết Coaching vừa tạo, ô gõ "GHI SO DU" khi ghi số dư buổi đã nhập.
- **Tiêu đề hiện đúng khoảng cách chữ đã thiết kế**: các nhãn viết hoa giãn rộng hơn, dễ đọc hơn ("Hoạt động học vụ & vận hành" trên Tổng quan, nhãn trên Tổng quan bảng lương, "Phiếu Lương" và tiêu đề các mục trên phiếu lương, "PHIẾU HỌC PHÍ" trên phiếu học phí và bản in); tiêu đề lớn ở Nhật ký, Thông báo, Báo cáo, Chấm công và các trang nhập dữ liệu khít chữ hơn một chút.
- Nút "Hủy buổi học" mờ dần khi rê chuột thay vì đổi đột ngột. Máy bật "giảm chuyển động" vẫn không có hiệu ứng nào.

## [0.26.0.3] - 2026-10-19

### Fixed
- **Tab đang mở trên trang hiện màu xanh rêu** như thiết kế (Lớp học, Hồ sơ học sinh, Giao dịch SePay, Chăm sóc học sinh, Buổi học). Trước đây chữ của tab đang mở cùng màu xám với các tab khác, chỉ phân biệt bằng gạch chân và chữ đậm. Ở giao diện tối, tab đang mở và số việc tồn dùng sắc xanh rêu sáng để đọc rõ trên nền tối.

## [0.26.0.2] - 2026-10-19

### Fixed
- **Nút xanh dạng link hiện chữ trắng** như thiết kế. Trước đây chữ tối trên nền xanh đậm, gần như không đọc được: "Về trang chính" (trang 404), "Tạo biểu mẫu" (Coaching), "Xem danh sách" sau khi tạo yêu cầu thanh toán, "Xem danh sách buổi học" sau khi tạo buổi hàng loạt, "Mở danh sách học viên" sau khi nhập học sinh, "Mở phiếu lương" trong bảng lương.
- **Link khắp hệ thống hiện đúng màu và gạch chân đã thiết kế** thay vì luôn lấy màu chữ xung quanh: link hành động ("Xem", "Mở", "Mở kỳ thu", "Tạo buổi hàng loạt cho lớp này"…) màu xanh rêu; tên học sinh, lớp, lead trong bảng đậm hơn; rê chuột lên các link này hiện gạch chân; vài link trong thông báo lỗi, cảnh báo luôn gạch chân như thiết kế.
- **Thanh bên và dải mô-đun**: mục đang mở chữ xanh rêu trên nền xanh nhạt; các mục khác chữ xám vừa, rê chuột thì đậm lên.

## [0.26.0.1] - 2026-10-19

### Fixed
- **Bộ lọc trạng thái trên Tin nhắn phụ huynh** `/parent-messages` đọc được rõ: nút đang chọn trước đây chữ tối trên nền xanh đậm (gần như không đọc được), các nút còn lại không hiện chữ xám như thiết kế. Nay dùng kiểu nút lọc nền nhạt giống trang Giao dịch SePay: nút đang chọn nền xanh nhạt, viền và chữ xanh; nút khác chữ xám, rê chuột thì chữ đậm lên. Trên điện thoại nút cao 44px cho dễ bấm.

## [0.26.0.0] - 2026-10-19

Bài bỏ qua nhầm giờ lấy lại được ngay trên trang "Bài nộp chưa ghép" (kế hoạch chấm bài AI, Giai đoạn 1b): trước đây bài đánh dấu "Bỏ qua (bài rác)" biến khỏi mọi màn hình và chỉ sửa được bằng SQL.

### Added
- Bộ lọc **Chờ ghép · Đã bỏ qua** trên `/grading-submissions` (`?status=ignored`). Mục Đã bỏ qua liệt kê bài đã đánh dấu bài rác, bỏ qua gần nhất trước, mỗi bài ghi rõ ai bỏ qua, lúc nào (giờ Việt Nam) và lý do, kèm tên, năm sinh, lớp chọn trên form và bài làm như ở mục Chờ ghép. Bài bỏ qua từ trước khi có lịch sử thao tác ghi "Không có trong lịch sử thao tác".
- Nút **Khôi phục** trên từng bài đã bỏ qua: xác nhận ngay tại dòng, có ô ghi chú tuỳ chọn. Bài quay lại mục Chờ ghép đúng như trước khi bị bỏ qua (giữ học sinh đã nhận ra và cảnh báo cũ), rồi ghép tay hoặc ghép lại tự động như mọi bài khác. Khôi phục được ghi vào lịch sử thao tác kèm người làm và ghi chú.
- Trang xem trước `/dev/grading-submissions?status=ignored` với dữ liệu mẫu (không ghi gì).

### Changed
- Database chỉ cho khôi phục bài đang ở trạng thái bỏ qua; quyền vẫn là **ai_grading.view** (chủ trung tâm, quản lý vận hành, quản lý trợ lý, trợ giảng), không thêm quyền mới.
- Ô lý do khi bỏ qua bài nói rõ bài chuyển sang mục Đã bỏ qua và khôi phục được.

## [0.25.0.0] - 2026-10-19

Trang "Bài nộp chưa ghép" giờ xử lý được bài, không chỉ để xem (kế hoạch chấm bài AI, Giai đoạn 1b): trợ giảng ghép tay bài vào học sinh và buổi học, bỏ qua bài rác, hoặc bấm ghép lại tự động sau khi thêm học sinh mới hay xếp buổi còn thiếu.

### Added
- **Ghép tay** trên `/grading-submissions`: chọn học sinh (mặc định các em cùng năm sinh trên form, lọc theo tên không dấu, biệt danh hoặc mã; tìm thêm được các em khác năm sinh có lớp hoặc buổi học ngày nộp), rồi chọn một buổi của em trong ngày nộp (giờ Việt Nam). Mỗi buổi ghi rõ học sinh nộp trong giờ hay ngoài giờ buổi đó, em có chọn buổi này trên form không, em có trong danh sách lớp không và điểm danh ra sao. Em không có buổi nào ngày đó thì trang nhắc điểm danh em vào buổi học bù hoặc học thêm trước. Có ô ghi chú tuỳ chọn.
- **Bỏ qua (bài rác)**: bắt buộc ghi lý do; bài bỏ qua rời khỏi danh sách và không bao giờ được tính điểm.
- **Ghép lại tự động**: chạy lại đúng bộ ghép của form trên dữ liệu hiện tại cho 200 bài chưa ghép gần nhất, rồi báo số bài đã ghép thêm và số bài vẫn cần chọn tay. Bài vẫn chưa chắc chắn thì giữ lại để người xem, không đoán.
- Ghép tay hay ghép lại đều tính lại lần nộp: lần nộp cuối (theo giờ nộp) của em trong buổi đó được tính.
- Mọi thao tác ghép, bỏ qua, ghép lại đều ghi vào lịch sử thao tác (audit log) kèm người làm, lý do hoặc ghi chú, và cảnh báo cũ của bài.

### Changed
- Quyền **ai_grading.view** đổi tên thành "Xem và ghép bài nộp chấm bài": vẫn cấp cho chủ trung tâm, quản lý vận hành, quản lý trợ lý và trợ giảng, giờ dùng cho cả ghép tay, bỏ qua và ghép lại. Không thêm quyền mới.
- Database chỉ cho ghép vào buổi chưa hủy trong ngày nộp có em trong danh sách lớp (kể cả lớp ghép) hoặc có điểm danh của em, và chỉ với bài còn đang chờ xem. Danh sách chọn học sinh không mở thêm học sinh nào ngoài các em có ghi danh hoặc buổi học ngày nộp (trợ giảng không có quyền xem hồ sơ học sinh).
- Trang xem trước `/dev/grading-submissions` thao tác được với dữ liệu mẫu (không ghi gì).

## [0.24.0.0] - 2026-10-18

Bài kiểm tra cuối buổi học sinh nộp qua form Apps Script giờ vào thẳng ERP (kế hoạch chấm bài AI, Giai đoạn 1 "Nhận bài vào ERP"): ERP tự ghép bài với học sinh và buổi học, bài chưa ghép chắc chắn được nằm riêng để trợ giảng xem. Chưa chấm bằng AI.

### Added
- **Nhận bài từ form** `POST /api/webhooks/grading-submissions`: Apps Script ghi Sheet xong thì gửi một bản sang ERP, có chữ ký HMAC-SHA256 (lệch giờ tối đa 5 phút, body tối đa 256 KB). Gửi lại cùng mã bài không tạo bài trùng. Bài làm dài quá 20.000 ký tự được cắt và đánh dấu. Ghi lỗi thì báo quản lý (mỗi ngày một lần) và Apps Script tự gửi lại; dữ liệu database từ chối thì trả 422 để Apps Script thôi gửi lại.
- **Danh sách tên cho form** `GET /api/integrations/grading-roster`: học sinh có ghi danh còn hiệu lực, lọc theo năm sinh, sắp theo tên rồi họ đệm theo thứ tự tiếng Việt, kèm buổi học hôm nay của từng em theo lịch ERP (tính cả lớp ghép và học thêm). Trùng họ tên cùng năm sinh thì hiện 4 số cuối SĐT phụ huynh chính, ví dụ "Nguyễn Minh Anh (PH ***4828)"; số đầy đủ không rời database.
- **Ghép bài tự động**: học sinh theo mã ERP chọn trên form, không có mã thì theo họ tên (không dấu) và năm sinh; buổi học theo buổi chọn trên form, không có thì theo giờ nộp (từ 15 phút trước giờ học đến 3 giờ sau giờ tan), rồi theo điểm danh, rồi theo lựa chọn lớp A/B/CLC. Trùng tên, không tìm thấy, nộp ngoài giờ hay có nhiều buổi phù hợp thì không đoán mà để người xem. Nộp nhiều lần thì lần nộp cuối (theo giờ nộp) được tính.
- **Bài nộp chưa ghép** `/grading-submissions` (mục Kết quả học tập): bài nộp chưa ghép chắc chắn, kèm tên, năm sinh, lớp chọn trên form (cả chữ ghi ở "Khác"), lý do và bài làm. Trang này chỉ để xem; chọn học sinh và buổi bằng tay sẽ có ở bước sau.
- **Bài nộp qua form** ở tab "Cuối giờ · Kết quả" của buổi học: bài của từng em kèm giờ nộp và lần nộp, các lần nộp trước gập lại, cảnh báo "Chưa điểm danh", "Vắng nhưng có bài", "Nộp ngoài giờ buổi học", và danh sách em có mặt nhưng chưa nộp.
- Quyền mới **ai_grading.view** ("Xem bài nộp chấm bài") cho chủ trung tâm, quản lý vận hành, quản lý trợ lý và trợ giảng.
- **Form Apps Script mới** trong `integrations/apps-script/grading-form/` (Code.gs, FormHocSinh.html, README cài đặt) để chủ trung tâm dán vào: vẫn ghi tab Data như cũ; danh sách tên và năm sinh lấy từ ERP (lỗi thì dùng tab DanhSachHocSinh); câu "Hôm nay con học buổi" hiện buổi học hôm nay của em; chọn "Khác" thì giữ lại chữ học sinh gõ; bài làm ghi vào Sheet đúng như học sinh gõ (Sheets không còn đổi "15/4" thành ngày hay chạy chữ bắt đầu bằng "=" thành công thức); tab Data hết cột thì tự thêm cột, thêm không được thì vẫn ghi bài như form cũ; thêm cột "Mã HS ERP", "Buổi học ERP", "Mã bài ERP", "Giờ nộp ERP", "Đã gửi ERP"; trigger 10 phút/lần gửi lại bài chưa gửi được, bài mới nhất trước. Câu học thử tiếng Anh và SĐT phụ huynh chỉ ghi vào Sheet, không gửi ERP.
- Biến môi trường `GRADING_FORM_SECRET` (ít nhất 32 ký tự, trùng với `ERP_FORM_SECRET` trong Script Properties).
- Dữ liệu thô của bài nộp (`raw_payload`, không chứa bài làm) tự xoá sau 30 ngày.
- Trang xem trước `/dev/grading-submissions` và thẻ bài nộp trên `/dev/session` (trả 404 trên production).

## [0.23.0.0] - 2026-10-18

Danh sách Tài chính dựng lại theo phong cách Stumana (bước 14c): Đơn hàng cho kế toán thấy ngay đơn nào chưa xác nhận và quyết toán SB từng đợt, Sổ cái số buổi đọc dễ hơn, Yêu cầu thanh toán lọc nhanh theo trạng thái và ghi giờ đúng giờ Việt Nam.

### Added
- **Đơn hàng** `/finance/orders`: lọc nhanh Tất cả · Chưa xác nhận · Đã xác nhận · Chưa cấu hình; dải tổng Số đơn · Học phí · Chi phí vận hành (ghi "chưa gồm n đơn chưa cấu hình", "—" khi chưa đơn nào có chính sách chi phí) · Chưa xác nhận · Chưa cấu hình; dòng đầu trang "Tháng 10/2026 · n đơn · x chưa xác nhận · y chưa cấu hình", thêm "theo bộ lọc" khi đang lọc loại, nguồn hoặc đợt.
- Bảng **quyết toán chi phí vận hành SB** ba đợt nằm ngay trên danh sách đơn: Tuyển mới, Tái phí, Học phí, Chi phí vận hành, Xác nhận; đợt đang diễn ra ghi "đang diễn ra (đến hôm nay)", đợt chưa tới ghi "chưa tới" thay vì số 0; ghi rõ Xác nhận chỉ là dấu kế toán đã kiểm tra, chưa phải chốt quyết toán.
- Bảng đơn hàng 8 cột vừa màn hình laptop 1366px: Giao dịch (giờ Việt Nam, mã ngân hàng, nội dung chuyển khoản), Học sinh (mã, lớp, phụ huynh và SĐT), Loại, Nguồn kèm Sale, Học phí, Chi phí vận hành, Đợt, Xác nhận. Đơn đã xác nhận ghi "Đã xác nhận · lúc 16/10 08:20"; lưu không được thì báo ngay tại dòng đó; trình đọc màn hình đọc "Đã xác nhận đơn …" sau khi lưu.
- **Sổ cái số buổi** `/finance/session-ledger`: loại bút toán thành huy hiệu, ngày hiệu lực kèm giờ ghi nhận, tham chiếu mở yêu cầu thanh toán (mã PAY-) hoặc buổi học khi người xem có quyền; trang vẫn chỉ đọc.
- **Yêu cầu thanh toán** `/finance/payment-requests`: lọc nhanh Chờ thanh toán · Thanh toán một phần · Đã thanh toán · Đã hủy (Hết hạn khi có); bộ lọc tìm kiếm, trạng thái, loại nạp, khoảng ngày tạo (ngăn bộ lọc trên màn hình hẹp); bảng Mã (loại · giờ tạo) · Học sinh · Phụ huynh · Số buổi (+ tặng) · Phải thu (đơn giá/buổi) · Đã thu (còn lại, trả thừa, giờ thanh toán) · Trạng thái (kèm "chờ quá 14 ngày") · Thao tác; phân trang chuẩn; hủy phiếu thành công hiện "Đã hủy phiếu thu …" ngay trên trang.
- Trang xem trước `/dev/lists?view=finance-orders|session-ledger|payment-requests` với `role=owner|accountant|ta` và `state=normal|capped|empty` (trả 404 trên production; nút xác nhận và hủy phiếu chỉ trả lời "Bản xem trước không ghi dữ liệu.").

### Changed
- Dải tiền của Yêu cầu thanh toán: "Phải thu" không còn cộng phiếu đã hủy hoặc hết hạn; "Đã thu"; "Còn chờ nhận" vẫn tính trong danh sách đang tải; trang báo khi danh sách chỉ gồm 1.000 yêu cầu mới nhất.
- "Tạo yêu cầu" trên Yêu cầu thanh toán và "Tạo yêu cầu thanh toán" trên Tổng quan Tài chính chỉ hiện cho người mở được trang tạo (cần thêm quyền xem học sinh); tên học sinh trên các trang này chỉ là link khi người xem mở được hồ sơ.
- Giờ tạo, giờ thanh toán và giờ ghi nhận sổ cái hiện theo giờ Việt Nam (trước đây có thể lệch 7 giờ); lọc theo ngày tạo tính theo ngày Việt Nam; tìm kiếm không dấu nhận cả "Đ".
- "Chờ quá 14 ngày" dùng đúng mốc của cảnh báo phiếu quá hạn trên trang chủ.
- Bốn thẻ tổng lớn trên Đơn hàng thay bằng dải tổng gọn; nút và link trên Tổng quan Tài chính hiện đúng màu.

## [0.22.0.0] - 2026-10-17

Danh sách nhân sự dựng lại theo phong cách Stumana (bước 14b): Tạm ứng lương cho người xét duyệt thấy ngay đơn nào đang chờ mình, Nhân sự và Hoa hồng lọc được theo đúng nhu cầu hằng ngày.

### Added
- **Tạm ứng lương** `/advances`: lọc nhanh Tất cả · Cần xử lý (đơn mình được đối soát hoặc phê duyệt, không tính đơn của chính mình) · Đang chờ (với người chỉ gửi đơn) · Đã duyệt, chưa trừ · Đã trừ · Từ chối; tìm nhân sự, lọc trạng thái và kỳ trừ; dòng đầu trang "Kỳ trừ 10/2026 · n đơn · x chờ đối soát · y chờ phê duyệt".
- Bảng tạm ứng mới: Nhân sự ("NS-007 · gửi 12/10 09:40", "đối soát 10/10 bởi …", "duyệt …", "trừ kỳ 09/2026", "từ chối …"), Số tiền (₫), Trừ vào kỳ, Lý do, Trạng thái kèm chú thích ("đã gửi, chờ kế toán đối soát", "chưa trừ vào lương", "tính lương 05/10", lý do từ chối) và một nút mỗi dòng: "Đối soát", "Phê duyệt", "Kỳ lương" (mở đúng kỳ trên trang Bảng lương) hoặc "Xem" (xem lại toàn bộ diễn biến và ghi chú). Đơn của chính mình ghi "Đơn của bạn · cần người khác đối soát/phê duyệt".
- Hộp thoại đối soát/phê duyệt hiện "Đơn khác cùng kỳ" của cùng nhân sự và quy tắc thật: không tự xét đơn của mình, từ chối cần lý do, khoản đã duyệt chỉ được trừ khi tính bảng lương kỳ đó lúc kỳ còn nháp.
- Gửi đơn, đối soát hay phê duyệt thành công hiện thông báo ngay trên trang; gửi đơn mới thì bỏ bộ lọc để thấy đơn vừa gửi; xử lý hết "Cần xử lý" thì trang ghi "Đã xử lý hết đơn cần xử lý."
- **Nhân sự** `/staff`: lọc nhanh Tất cả · Đang làm việc · Tạm khóa · Đã nghỉ; tìm theo tên, mã, email hoặc số điện thoại (gõ không dấu cũng được); lọc theo vai trò; bảng Nhân sự · Vai trò · Trạng thái · Vào làm · SĐT · Mở hồ sơ, quản lý vai trò ngay trong dòng; nút "Tài khoản và lời mời" cho người mở được Cài đặt.
- **Hoa hồng** `/commissions`: lọc theo tháng ghi nhận, Sale (với người quản lý hoa hồng) và nguồn MMA/Sandbox; giờ tiền về theo giờ Việt Nam; tải tới 500 bản ghi mới nhất và báo khi tháng đang chọn có thể chưa đủ.
- Trang xem trước `/dev/lists?view=advances|staff|commissions` thêm `role=accountant` (trả 404 trên production, mọi nút gửi chỉ trả lời "Bản xem trước không ghi dữ liệu.").

### Changed
- Số tiền tạm ứng và doanh thu hoa hồng ghi bằng ₫; thời điểm gửi, xét, duyệt và tiền về hiện theo giờ Việt Nam (trước đây có thể lệch 7 giờ).
- Nút đối soát/phê duyệt không còn hiện trên đơn của chính người xem (máy chủ vốn đã từ chối).
- Huy hiệu trạng thái nhân sự dùng chung kiểu huy hiệu mới, cả trên trang hồ sơ nhân sự.
- Ngày mặc định của "Kỳ khấu trừ" khi gửi đơn tạm ứng theo tháng Việt Nam thay vì giờ của máy.

### Removed
- Cột "Đăng nhập gần nhất" trên Nhân sự (hệ thống chưa ghi thời điểm đăng nhập, nên cột luôn trống).

## [0.21.0.0] - 2026-10-17

Tin Zalo nhận xét cuối buổi theo mẫu mới cho mọi buổi (kế hoạch chấm bài AI, giai đoạn 2b): tiêu đề có ngày học, họ tên, dòng Kết quả, nhận xét và thông tin liên hệ; mục không có dữ liệu tự ẩn; tin dài tự tách 2–3 tin gửi liền nhau; vở còn chờ chấm hoặc chưa điền trợ giảng giám thị thì chưa gửi được.

### Added
- **Mẫu tin mới** thay mẫu một dòng cũ cho mọi buổi, kể cả buổi nhập điểm tay: "THẦY VINH VÀ THẦY CÔ CỘNG SỰ KÍNH GỬI PHỤ HUYNH… NGÀY 17/10/2026", Tên học sinh, Kết quả (Điểm luyện tập cuối buổi · Điểm vở · Xếp hạng), Bài làm, Bài chữa chi tiết, Nhận xét và thông tin cuối (chủ nhiệm CLB, trợ giảng giám thị, SĐT thắc mắc bài chấm, SĐT các thầy cô hỗ trợ). Bài làm và bài chữa để trống tới khi có chấm bài AI.
- **Mục trống tự ẩn cùng nhãn**: buổi không có bài kiểm tra thì dòng Kết quả chỉ còn điểm vở; chưa có bài làm, bài chữa thì không hiện hai mục đó; điểm lẻ ghi kiểu Việt Nam ("8,5").
- **Xếp hạng theo khoảng điểm**: dưới 5 "Tiến bộ ít", 5–dưới 8 "Tiến bộ vừa", 8–dưới 9 "Tiến bộ", 9–dưới 10 "Tiến bộ nhiều", 10 "Rất tiến bộ" (8,5 là "Tiến bộ"). Chỉ chủ trung tâm đổi được thang này.
- **Cài đặt → Tin Zalo** `/settings/zalo` (chỉ chủ trung tâm sửa, người có quyền xem cài đặt xem được): sửa mẫu tin và thông tin cuối, danh sách ô dữ liệu và quy tắc ẩn, thang xếp hạng, và ô **xem trước** dựng tin thật từ một học sinh mẫu (bật/tắt điểm luyện tập, điểm vở hoặc chưa nộp vở, trợ giảng giám thị, bài làm và bài chữa) kèm số tin sẽ tách và số ký tự từng tin. Lưu mẫu thì các tin nhận xét đang chờ (chưa sửa tay) cập nhật theo mẫu mới.
- **Trợ giảng giám thị trên tin Zalo** ở tab "Cuối giờ · Kết quả" của buổi học: trợ giảng điền tên và SĐT thắc mắc bài chấm, ô tự điền sẵn theo lần điền gần nhất của chính trợ giảng đó; lưu xong tin nhận xét đang chờ của buổi cập nhật ngay.
- **Trạng thái vở "Chờ chấm vở"** làm mặc định khi nhập kết quả, tách khỏi "Chưa nộp" (học sinh không nộp vở). Học sinh chưa nộp vở thì tin ghi "Điểm vở: Chưa nộp vở" và gửi được. Danh sách Kết quả học tập lọc được theo "Chờ chấm". Khi cập nhật, kết quả "Chưa nộp" của các buổi chưa khóa chuyển sang "Chờ chấm vở"; buổi đã khóa giữ nguyên.
- **Tin dài tự tách**: hàng chờ hiện từng tin "Tin 1/2 · 1.914/2.000 ký tự"; tin thứ hai trở đi mở đầu bằng "(tiếp theo 2/3)"; cắt ở chỗ chuyển mục, mục dài hơn một tin thì cắt theo dòng. Ô sửa tin hiện số ký tự (tối đa 6.000) và chỗ sẽ tách.

### Changed
- **Khóa nút Gửi** tin nhận xét khi vở còn "Chờ chấm vở" hoặc buổi chưa có trợ giảng giám thị; hàng chờ ghi lý do ("Chưa gửi được: Chưa chấm vở; Chưa điền trợ giảng giám thị"). Tin cần hơn 3 tin Zalo cũng không gửi được và được báo rút gọn.
- **Gửi nhiều phần**: các phần gửi lần lượt qua ZaloCRM cách nhau 1,5 giây; phần nào lỗi thì "Gửi tiếp từ tin k" đi tiếp từ phần đó, không gửi lại phần đã đi. Trong lúc đang gửi, tin không bị sửa hay gửi trùng bởi người khác; tin đã gửi một phần thì giữ nguyên nội dung.
- Mẫu tin nhận xét chuyển từ Cài đặt → Chung sang Cài đặt → Tin Zalo; Cài đặt → Chung vẫn giữ nick gửi, bật/tắt từng loại tin và mẫu tin vắng không phép.
- Tin nhận xét cập nhật cả khi chỉ đổi tình trạng vở; tin đang chờ chuyển sang mẫu mới khi cập nhật hệ thống.

## [0.20.0.0] - 2026-10-16

Danh sách học vụ dựng lại theo phong cách Stumana (bước 14a): trang Buổi học cho thấy ngay buổi nào chưa điểm danh, buổi nào sẵn sàng khóa; Kết quả học tập và Tín chỉ chấm bài lọc được theo đúng nhu cầu hằng ngày.

### Added
- **Buổi học** `/sessions`: lọc nhanh Tất cả · Hôm nay · Tuần này · Chưa điểm danh · Chờ khóa · Đã khóa · Đã hủy, mỗi chip kèm số buổi khi dữ liệu đã tải đủ cho chip đó. Chọn "Tuần này" hiện dòng "Tuần 12–18/10/2026 · n buổi · x chưa điểm danh · y chờ khóa".
- Bảng buổi học mới: Ngày · giờ ("T2 12/10 · 18:00–20:00"), Lớp kèm khối · cấp, Loại (Chính / Bù / Bổ sung), Hình thức · phòng ("Online · có link"), Điểm danh và Kết quả dạng x/y, Trạng thái ("Đang diễn ra", "Sẵn sàng khóa", "Thiếu N điểm danh", "Không có học sinh", "Chưa bắt đầu", "Chưa hoàn thành", lý do hủy) và một nút mỗi dòng: "Khóa", "Điểm danh" hoặc "Mở". Dòng còn thiếu điểm danh được tô nhạt; màn hình hẹp hiện dạng thẻ.
- Bộ lọc của Buổi học nằm trên địa chỉ trang, nên tải lại hay bấm Quay lại vẫn giữ nguyên; trang cũng báo khi khoảng ngày đang chọn chưa được tải đủ và có nút "Tải lại danh sách".
- **Kết quả học tập** `/learning-results`: lọc nhanh Chưa có điểm · Dưới 5 · Vở chưa nộp · Cần chú ý; lọc theo lớp, khối, khoảng ngày, vở và tình trạng điểm; bảng Học sinh · Lớp · Buổi · Điểm KT · Vở · Điểm vở · Nhận xét · Chấm lúc · Khóa. Khi đã tải đủ 500 kết quả mới nhất, trang báo nếu khoảng ngày đang chọn vượt ra ngoài phần đã tải.
- **Tín chỉ chấm bài** `/grading-credits`: lọc theo tháng, người chấm (khi xem toàn bộ) và lớp; dòng tổng tín chỉ ghi đúng con số, hoặc "ít nhất N" khi danh sách chưa chứa hết tháng; nút "Mở kết quả buổi" cho người xem được buổi học.
- Trang xem trước `/dev/lists?view=sessions|results|credits` với `role=owner|ta` và `state=normal|capped|empty` (trả 404 trên production, chỉ dùng dữ liệu mẫu).

### Changed
- Khung "buổi đã hoàn thành chưa khóa" trên trang Buổi học tính điểm danh theo đúng quy tắc khóa (học sinh học thêm không làm số vượt sĩ số), chỉ hiện nút "Điểm danh" cho người có quyền điểm danh, ghi "N+" khi còn nhiều hơn, và báo rõ khi không tải được hoặc chỉ tải được một phần hàng đợi khóa.
- Thông báo hằng ngày về buổi chờ khóa và các liên kết trên Trang chủ mở thẳng chip "Chờ khóa" hoặc "Chưa điểm danh", chỉ đọc các buổi tới hôm nay. Mục Trang chủ đổi thành "N buổi sẵn sàng khóa" cho khớp với danh sách.
- Danh sách buổi học không còn nhận đường dẫn phòng học trực tuyến, chỉ biết buổi đó "có link".

### Fixed
- Số điểm danh và số kết quả của từng buổi không còn bị thiếu khi một tuần có hơn 1.000 lượt điểm danh; file xuất danh sách buổi học cũng đếm đủ.
- Tín chỉ chấm bài tính tháng và giờ "Ghi nhận lúc" theo giờ Việt Nam: tín chỉ ghi lúc 00:30 ngày 1/10 thuộc tháng 10, không còn tùy múi giờ máy chủ.
- Tìm kiếm trong Kết quả học tập tìm được tên có chữ "Đ" khi gõ "d".

## [0.19.0.0] - 2026-10-16

Phiếu học phí dựng lại theo phong cách Stumana (bước 13): bảng chuẩn bị kỳ thu nháp tính "Phải thu" đúng như lúc khóa kỳ, trang mẫu phiếu có xem trước A5 ngay khi gõ, và phiếu học phí in đúng khổ A5, mỗi phiếu một trang.

### Added
- **Bảng chuẩn bị của kỳ thu nháp** `/finance/tuition-periods/[id]`: dòng "Khi khóa: phiếu dùng mẫu vN · tài khoản tái phí …" và bốn số "Dự kiến phải thu", "Không cần thanh toán (đủ số dư)", "Đủ dữ liệu x / y", "Còn blocker".
- Mỗi học sinh có Lớp, Buổi kỳ này, Số dư đầu kỳ (số âm màu đỏ), Đơn giá ("200.000 / 250.000 ₫" khi có nhiều mức), và **Phải thu** tính giống lúc khóa kỳ: số dư dương bù cho các buổi sớm nhất, học sinh nợ buổi đầu kỳ ghi "tối đa", thiếu đơn giá ghi "—". Lý do còn vướng ghi bằng chữ ("Thiếu đơn giá từ 02/11", "Thiếu nguồn", "Chưa có phụ huynh chính", "Không cần thanh toán · đủ số dư"), học sinh còn vướng xếp lên đầu; màn hình hẹp hiện dạng thẻ.
- Lọc nhanh Còn blocker / Thiếu đơn giá / Thiếu nguồn / Thiếu phụ huynh chính / Đủ dữ liệu / Không cần thanh toán / Tất cả, ô "Tìm học sinh" và nút "Tải lại xem trước".
- **Bổ sung đơn giá và nguồn từ một lựa chọn**: tick học sinh một lần rồi lưu từng phần; mỗi nút chỉ gửi những em còn thiếu đúng phần đó, em thiếu cả hai vẫn được giữ chọn cho lần lưu sau.
- **Trang mẫu phiếu** `/finance/tuition-periods/templates`: phiên bản đang dùng, người và lúc xuất bản, các kỳ đã khóa dùng phiên bản này và số kỳ nháp sẽ dùng bản mới nhất khi khóa. Nút "Xuất bản phiên bản vN" chỉ bật khi có thay đổi và có lý do, lý do bị khóa ghi ngay dưới nút. Kèm lịch sử phiên bản và bản xem trước phiếu A5 bằng dữ liệu mẫu, cập nhật theo nội dung đang gõ.
- **Phiếu học phí khổ A5**: tên trung tâm, kỳ thu, mã yêu cầu, tiêu đề, thông báo, hạn thanh toán, học viên, lớp, số buổi theo từng đơn giá (kèm buổi nợ đầu kỳ), số dư đầu kỳ, số tiền phải nộp và khung QR VietQR với ngân hàng · số tài khoản · tên tài khoản và nội dung chuyển khoản in nguyên văn. Phiếu không cần thanh toán ghi "KHÔNG CẦN THANH TOÁN" cùng số buổi còn lại sau kỳ.
- **In hàng loạt**: mỗi phiếu đúng một trang A5, sắp theo khối rồi tên. Nút "In n phiếu" chờ mã QR tải xong; nếu có mã QR chưa tải được thì báo trước và cần bấm "Vẫn in" thêm một lần.
- Trang xem trước `/dev/fee-notices?view=templates|print|notice` và phần bảng chuẩn bị trong `/dev/tuition?view=draft` (trả 404 trên production; mọi thao tác đều không ghi dữ liệu).

### Changed
- Trang một phiếu: tiêu đề "Phiếu học phí · tên học sinh", nhãn bản gốc / bản thay thế, "Loại phiếu", nút "In phiếu". Khung "Điều chỉnh / phát hành lại" ghi rõ hệ quả, sau khi phát hành vẫn giữ kết quả cùng liên kết tới bản thay thế hiện hành.
- Khung "In phiếu học phí" của kỳ đã khóa ghi "n phiếu · x có số tiền phải nộp · y không cần thanh toán" và số phiếu của từng khối.
- In bất kỳ trang nào trong ERP (kể cả phiếu lương) không còn in kèm thanh bên, thanh trên cùng và dải mô-đun.

### Fixed
- In hàng loạt không còn in mã QR của yêu cầu đã bị hủy khi phiếu gốc đã được phát hành lại; phiếu cũ được thay bằng bản thay thế hiện hành, phiếu chưa đọc được bản hiện hành được báo riêng.
- Phiếu chỉ in mã QR khi số tiền trong mã QR đúng bằng số tiền in trên phiếu; phiếu thiếu thông tin chuyển khoản hướng dẫn phụ huynh liên hệ trung tâm thay vì in câu dành cho nhân viên.
- Form phát hành lại giữ số tiền và lý do đã nhập khi bị từ chối, nhận số tiền lẻ (ví dụ 2.437.500 ₫), và thông báo xuất bản mẫu / phát hành lại hiện đúng màu thành công hay lỗi.

## [0.18.0.0] - 2026-10-16

Chấm công cá nhân dựng lại cho điện thoại theo phong cách Stumana (bước 12): một nút "Vào ca"/"Ra ca" lớn, điều kiện chấm công ghi bằng chữ đúng như máy chủ kiểm tra, bảng công dạng thẻ và tấm "Yêu cầu điều chỉnh công" mở từ đáy màn hình.

### Added
- **Thẻ chấm công** `/timekeeping` cho người chỉ có quyền chấm công: dòng giờ Việt Nam đang chạy ("Thứ Hai, 12/10/2026 · 16:58"), "Chấm công của tôi", nút chọn **Tại trung tâm / Trực tuyến** (dùng được bằng phím mũi tên) và một nút "Vào ca" lớn 56px. Bấm "Vào ca" mở tấm xác nhận quen thuộc với đúng hình thức vừa chọn và tự lấy vị trí khi chấm tại trung tâm.
- **Điều kiện chấm công bằng chữ**, chỉ nêu điều thật sự được kiểm tra: bán kính quanh cơ sở và sai số GPS tối đa (kiểm tra khi bấm Vào ca), Wi-Fi khi chủ trung tâm yêu cầu, "Vị trí chỉ được xác minh lúc vào ca và lúc ra ca", giờ chốt không vào ca được sau 22:30 (trợ giảng) hoặc 22:45 (vị trí khác), và với trực tuyến: chỉ nhận khi có ca được xếp, trong 15 phút quanh giờ ca, không cần vị trí.
- Sau khi lấy vị trí, tấm xác nhận ghi sai số so với mức cho phép ("sai số khoảng 85 m (cho phép tối đa 50 m)") và nhắc ra chỗ thoáng khi sai số lớn hơn mức cho phép; lý do máy chủ từ chối (ví dụ ngoài khu vực Trung tâm) vẫn hiện ngay trong tấm, kèm "Lấy vị trí hiện tại" và "Gửi chấm công chờ duyệt".
- **Thẻ đang trong ca**: "Đang trong ca · Tại trung tâm", thời gian đã làm việc chạy từng giây, giờ vào ca và ca được xếp (hoặc nhãn không có ca được phân công), dữ liệu vị trí lúc vào ca, nhắc Ra ca tại Trung tâm cần lấy lại vị trí và giờ hệ thống tự kết thúc ca, cùng nút "Ra ca" lớn.
- **Bảng công trên điện thoại** dạng thẻ: ngày · ca (hoặc "Ngoài lịch"), thời lượng khớp với giờ in trên thẻ, "giờ vào → giờ ra · hình thức · GPS + Wi-Fi", lý do tự kết thúc, nhãn "Ca ngoài lịch", "Yêu cầu điều chỉnh · chờ duyệt" kèm giờ đề nghị, "Điều chỉnh · đã duyệt / bị từ chối". Ca tự kết thúc có nút "Yêu cầu điều chỉnh" mở tấm điều chỉnh đúng ca đó.
- Trang xem trước `/dev/timekeeping?state=idle|blocked|open|open-online|ended|unconfigured|wifi` (trả 404 trên production; mọi thao tác chấm công và vị trí thiết bị đều là bản giả, không ghi dữ liệu).

### Changed
- Người chỉ có quyền chấm công thấy nút chấm công đầu tiên trên điện thoại; mục "Chấm công cần xác minh", bảng công tháng và lịch sử điều chỉnh nằm bên dưới. Người có quyền quản lý vẫn thấy trang như trước.
- **Tấm "Yêu cầu điều chỉnh công"** mở từ đáy màn hình: dòng tóm tắt ca ("CN 11/10 · ghi nhận 19:12 → 22:30"), ghi chú rõ mỗi lượt chỉ có một yêu cầu chờ duyệt và kết quả hiện trong bảng công, nút Hủy / Gửi yêu cầu bằng nhau, chừa chỗ cho thanh Home của iPhone.
- Lời xác nhận "chấm công chờ duyệt" hiện ở đầu thẻ và vẫn còn sau khi thẻ đổi sang trạng thái mới. Khi vào ca hoặc ca kết thúc, thay đổi được đọc cho trình đọc màn hình và con trỏ bàn phím không bị mất.
- Chọn hình thức trên thẻ không còn đổi hình thức mặc định của nút chấm công trên thanh trên cùng và Trang chủ; hệ thống chỉ ghi nhớ hình thức sau khi chấm công thành công.
- Khi đang xem một tháng khác, bảng công của tháng đó tự cập nhật sau khi gửi yêu cầu điều chỉnh hay chấm công; nếu cập nhật không được, các thẻ được giữ lại kèm dòng "số liệu bên dưới có thể chưa mới nhất" và nút "Tải lại".
- Hiệu ứng nhịp của nút "Vào ca" nhẹ hơn cho điện thoại và tắt hẳn khi máy bật giảm chuyển động.

### Fixed
- Đồng hồ "thời gian đã làm việc" không còn gây lỗi lệch dữ liệu giữa máy chủ và trình duyệt khi trang vừa tải.
- Gửi yêu cầu điều chỉnh khi mất mạng không còn đưa sang trang lỗi và xóa lý do đang viết; tấm vẫn mở và nhắc tải lại trang để xem yêu cầu đã được ghi nhận chưa.
- Chữ trên thẻ đang trong ca và nút chọn hình thức đọc rõ ở giao diện tối; ô chọn tháng/năm có viền khi dùng bàn phím; các nút nhỏ trên điện thoại đủ 44px.

## [0.17.0.0] - 2026-10-15

Coaching dựng lại theo phong cách Stumana (bước 11b): trang phiếu Coaching, trình soạn biểu mẫu có khung xem trước 390px và trang phiếu phụ huynh mở từ điện thoại.

### Added
- **Trang phiếu Coaching** `/coaching/[id]`: tiêu đề "Đợt · Học sinh", huy hiệu ưu tiên và trạng thái, dòng ngữ cảnh (mã học sinh · ngày mở · người phụ trách · ngày xem lại · lý do). Mỗi trạng thái có một nút chính: "Bắt đầu xử lý" khi phiếu mở, "Đóng phiếu" (ghi kết quả) khi đang xử lý, kèm "Thêm ghi chú". Phiếu đã đóng không còn nút thao tác.
- Trang chia hai cột trên màn hình rộng: bên trái là **Link phiếu công khai** và **Phản hồi**, bên phải là **Sự kiện** (mới nhất ở trên, ghi rõ "Đổi trạng thái Mở → Đang xử lý", trích nguyên văn ghi chú và kết quả, giờ Việt Nam) và **Lý do theo dõi** đầy đủ.
- **Link phiếu công khai**: nút "Phát link mới", mỗi link ghi biểu mẫu · phiên bản, giờ phát, hết hạn, thu hồi và trạng thái bằng chữ. Link vừa tạo hiện một lần trong ô chọn được, kèm "Sao chép liên kết" và báo đã sao chép hay chưa. Trước khi tạo, form nói rõ link đang hoạt động của học sinh cho cùng phiên bản (kể cả ở phiếu Coaching khác) sẽ bị thu hồi. Thu hồi cần ghi lý do và nêu hệ quả trước khi xác nhận. Biểu mẫu đang soạn phiên bản mới (nên tạm chưa phát link được) được nêu tên.
- **Trình soạn biểu mẫu** `/coaching/forms/[id]` và `/coaching/forms/new`: cột trái là phần soạn, cột phải là khung "Phụ huynh sẽ thấy (390px)" hiển thị đúng các câu hỏi phụ huynh sẽ nhận. Mỗi thẻ câu hỏi có loại câu, "Bắt buộc", đưa lên/xuống, xóa, danh sách lựa chọn từng dòng với "Thêm lựa chọn", thang điểm Từ/Đến/Nhãn thấp/Nhãn cao. Hàng "Thêm câu hỏi:" có đủ 6 loại câu.
- **Xuất bản vN** hỏi xác nhận và nêu hệ quả: câu hỏi bị khóa, link mới dùng phiên bản này, link đã gửi vẫn nộp được. Nếu còn thay đổi chưa lưu, bản nháp được lưu trước rồi mới xuất bản. Không có quyền xuất bản thì nút hiện lý do.
- Trước khi lưu hay xuất bản, trình soạn chỉ ra ngay tại câu hỏi những gì máy chủ sẽ từ chối (lựa chọn trống hoặc trùng, thang điểm ngoài 0–10, thiếu nội dung) và đưa con trỏ tới chỗ cần sửa. Rời trang khi còn thay đổi chưa lưu sẽ được hỏi lại.
- **Trang phiếu cho phụ huynh** `/coaching/form/[token]` thiết kế cho điện thoại: dòng "Toán Thầy Vinh · tên gọi của con", câu hỏi đánh số, dấu * cho câu bắt buộc, nút thang điểm 44px kèm nhãn hai đầu, lựa chọn 44px, nút "Gửi phiếu" 48px và ghi chú "Phiếu chỉ gửi được một lần."
- Phụ huynh được nhắc ngay tại câu còn thiếu trước khi gửi, con trỏ chuyển tới câu đó. Câu không bắt buộc để trống không bị gửi đi. Nhấn Enter chuyển sang câu tiếp theo thay vì gửi phiếu sớm.
- Trang xem trước `/dev/coaching?view=record|builder|public&state=…&role=manager|editor|viewer` (trả 404 trên production, mọi thao tác Coaching đều không ghi dữ liệu).

### Changed
- Danh sách Coaching, trang phiếu và hộp thoại tạo phiếu dùng cùng một cách gọi mức ưu tiên: Cao · Vừa · Thấp ("Ưu tiên vừa" thay cho "Ưu tiên trung bình").
- Thẻ Phản hồi chỉ hiện với người có quyền xem phản hồi. Khi không tải được lịch sử link, phản hồi hay danh sách biểu mẫu, trang ghi rõ là không tải được thay vì báo "chưa có", và tạm khóa "Phát link mới".
- Trang phiếu phụ huynh chỉ hiện tên gọi của học sinh (không hiện họ tên đầy đủ) và không cho máy tìm kiếm lập chỉ mục.
- Trang phiếu phụ huynh khóa các câu hỏi và nút gửi cho tới khi trang tải xong, kèm dòng "Đang tải phiếu…", để không mất câu trả lời đã chọn trong lúc trang đang tải.

### Fixed
- Trình soạn trước đây không thêm được câu "Câu trả lời ngắn", ô lựa chọn xóa mất dấu xuống dòng khi gõ, và "Xuất bản" bỏ qua thay đổi chưa lưu.
- Mất kết nối hoặc hệ thống vừa cập nhật trong lúc lưu, xuất bản, gửi phiếu, thêm ghi chú hay phát/thu hồi link không còn đưa sang trang lỗi và xóa nội dung đang nhập; màn hình giữ nguyên và báo để thử lại.
- Khi link hết hạn, bị thu hồi hoặc đã nộp trong lúc phụ huynh đang điền, trang chuyển sang màn hình trạng thái tương ứng thay vì báo lỗi lặp lại. Lỗi đọc link tạm thời hiện "Chưa tải được phiếu." kèm nút "Tải lại trang", không còn báo "Liên kết không hợp lệ."
- Số mà trình duyệt không đọc được (ví dụ "1,5") được báo "dùng dấu chấm" thay vì bị bỏ qua lặng lẽ.
- Ô "Hết hạn lúc" mặc định và khi gửi đều theo giờ Việt Nam, không còn lệch 7 giờ.
- Bấm Enter hai lần trong ô lý do thu hồi, hoặc nhấn Enter để chọn chữ khi gõ tiếng Việt, không còn gửi thu hồi hai lần hay gửi khi lý do chưa viết xong.

## [0.16.0.0] - 2026-10-15

Chăm sóc học sinh dựng lại theo phong cách Stumana (bước 11a): hàng đợi công việc chăm sóc và trang chi tiết công việc. Mỗi dòng của hàng đợi chỉ có một nút, trang công việc chỉ có một nút chính, và bấm thử lại sau lỗi mạng không tạo bản ghi trùng.

### Added
- **Đầu trang `/student-care`** ghi "Tháng MM/YYYY · n cảnh báo đang mở · n chưa giao · n quá hạn · Coaching tháng a/b hoàn thành". Người có quyền cấu hình có nút "Cấu hình bộ tự sinh", mở hộp thoại bật/tạm dừng bộ tự sinh.
- **Dải trạng thái bộ tự sinh**: đang bật hay tạm dừng, lần chạy thành công gần nhất kèm "n phút trước", "hàng đợi n (m đang thử lại)", lần đối soát và lỗi gần nhất. Khi bộ sinh chậm, lỗi hoặc tạm dừng, dải đổi màu và ghi bằng chữ rằng "không có cảnh báo" chưa có nghĩa là học sinh ổn.
- **Ba tab**: Công việc · Phân công lâu dài · Theo dõi riêng.
- **Chip lọc nhanh** trên tab Công việc: Tất cả · Cảnh báo sớm · Coaching tháng · Theo dõi tiếp · Chưa giao · Quá hạn · Của tôi. Chip chỉ hiện số khi bảng tổng hợp có số đó; chip số 0 vẫn bấm được vì số đếm theo tháng có thể trễ.
- **Bảng công việc**: Học sinh (mã · tình trạng học) · Dấu hiệu kèm bằng chứng (ngày vắng, điểm "5,5 · 4,0") · Phát hiện · Hạn liên hệ (ghi "Quá hạn n giờ/ngày" bằng chữ) · Người xử lý · Trạng thái. Mỗi dòng đúng một nút: "Nhận việc" khi việc chưa ai nhận và bạn có quyền xử lý, còn lại là "Mở". Trên điện thoại bảng thành danh sách thẻ với cùng một nút.
- Chân bảng ghi "a–b trong N task" kèm phân trang. Mở một trang vượt quá trang cuối sẽ báo "Trang này không còn công việc" kèm link về trang 1, thay vì báo hàng đợi trống.
- **Trang chi tiết công việc** `/student-care/[id]`: tiêu đề là tên học sinh và dấu hiệu, có huy hiệu trạng thái và dòng ngữ cảnh (loại việc · ngày phát hiện · người xử lý kèm "nhận …" hoặc "được giao …" · hạn liên hệ · phiên bản). Có nút "Giao cho người khác", link "Hồ sơ học sinh", và nút chính "Nhận việc" khi bạn nhận được việc này.
- Thẻ **Bằng chứng** dạng bảng Ngày / Buổi (link tới buổi học) / Điểm danh / Điểm, với huy hiệu "hiện hành" hoặc "bằng chứng đã thay đổi".
- Form **Ghi nhận liên hệ** chọn Kênh, Người nhận, Kết quả liên hệ bằng nút bấm (dùng được bằng bàn phím, lựa chọn có dấu tích), cùng các ô Điểm mạnh, Khó khăn, Kế hoạch, Kết quả, Ghi chú và Hẹn liên hệ tiếp.
- Thẻ **Hoàn thành công việc**: chọn lần trao đổi và ghi kết luận. "Ghi nhận hoàn thành" chỉ bật khi đã có ít nhất một lần "đã trao đổi thực chất", và ghi rõ lý do khi chưa bật. Cạnh đó là "Tạo / gắn phiếu Coaching…", "Đổi lịch hẹn…" và "Ngoại lệ · hủy task…" (bắt buộc ghi lý do; ngoại lệ không tính là Coaching hoàn thành).
- **Dòng thời gian** chăm sóc của học sinh (tối đa 200 sự kiện gần nhất, mới nhất ở trên, kèm link tới công việc liên quan) và danh sách phiếu Coaching liên quan.
- Trang xem trước `/dev/student-care?view=list|detail&state=normal|stale|paused|empty|error&role=handler|manager|owner` (trả 404 trên production, mọi nút đều không ghi dữ liệu).

### Changed
- Mọi thao tác ghi (nhận, giao, liên hệ, hoàn thành, ngoại lệ, tạo theo dõi riêng, cấu hình) chỉ hiện với người có quyền xử lý chăm sóc học sinh, khớp với kiểm tra phía máy chủ. Việc chưa ai nhận không cho ghi liên hệ, hoàn thành hay ngoại lệ; trang ghi rõ cần nhận hoặc giao việc trước.
- Ô tìm kiếm cập nhật sau 300 ms hoặc khi nhấn Enter, không mất chữ khi gõ nhanh và không kéo bạn về tab cũ. Ô tháng chỉ áp dụng khi đã nhập đủ tháng và năm.
- Hộp thoại không đóng được khi đang lưu. Lỗi hoặc kết quả chưa chắc chắn vẫn hiện dưới nút mở hộp thoại, kể cả sau khi đóng rồi mở lại. Trên trang công việc, kết quả nhận việc, hoàn thành và ngoại lệ hiện ngay dưới đầu trang.
- Lưu xong không còn tải lại trang lần thứ hai: phản hồi của máy chủ đã mang theo giao diện mới.
- Hai màn hình này dùng chữ "học sinh" thay cho "học viên".
- Thẻ Chăm sóc trên trang chủ dùng dải trạng thái bộ tự sinh mới (tiêu đề thẻ vẫn ghi "học viên").

### Fixed
- Bấm thử lại với đúng nội dung đã nhập sau lỗi mạng hoặc kết quả chưa rõ sẽ gửi lại yêu cầu cũ, kể cả khi trang vừa tự làm mới, nên không tạo trùng lần liên hệ, phiếu Coaching hay việc theo dõi riêng. Chỉ khi máy chủ báo công việc đã bị người khác cập nhật thì lần gửi sau mới là yêu cầu mới.
- Đóng bất kỳ hộp thoại nào trong ứng dụng giờ trả focus về nút đã mở nó ngay khi hộp thoại biến mất, không còn khoảnh khắc focus rơi về trang; người dùng bàn phím và trình đọc màn hình không bị mất vị trí.

## [0.15.0.1] - 2026-10-15

### Fixed
- **Đơn hàng** (Tài chính → Đơn hàng) giờ nhận nguồn của học sinh để áp đúng cơ chế đối tác. Trước đây cột "Sale · Nguồn" chỉ đọc nguồn từ hoa hồng của ca CRM đã chuyển đổi, nên học sinh nhập hàng loạt ngày 12/10 (có nguồn trên hồ sơ nhưng không có ca CRM) đều hiện "Chưa xác định" và chi phí vận hành "Chưa cấu hình". Nguồn được lấy lần lượt từ: nguồn hiện tại trên hồ sơ học sinh → hoa hồng CRM của khoản thu → ca CRM của học sinh. Sale vẫn chỉ lấy từ CRM. Với dữ liệu tháng 10/2026: 19 đơn tái phí SB được tính 20% học phí, 6 đơn MMA tính 0 VND, 1 đơn chưa có nguồn vẫn ghi "Chưa xác định".
- Nguồn đã biết nhưng không thuộc MMA/SB (ví dụ "Đến trực tiếp trung tâm") được ghi đúng tên thay vì "Chưa xác định"; vẫn "Chưa cấu hình" chi phí vận hành.
- Cột lớp của đơn không còn trống khi học sinh chuyển khoản trước ngày vào lớp: hiện lớp có hiệu lực vào ngày chuyển khoản, nếu chưa có thì lớp đầu tiên bắt đầu sau ngày đó.

### Lưu ý triển khai
- Cần chạy migration `20261014100000_finance_orders_student_acquisition_source.sql` (`supabase db push --linked`); hàm giữ nguyên chữ ký và hợp đồng JSON nên bản web cũ và mới đều chạy được với hàm mới.

## [0.15.0.0] - 2026-10-14

CRM tuyển sinh dựng lại theo phong cách Stumana (bước 10): danh sách lead có chip đếm theo trạng thái, trang lead có vòng đời bên phải và chỉ một nút chính tùy trạng thái.

### Added
- **Đầu trang `/crm`** ghi "Tháng MM/YYYY · N lead mới · M chờ xác nhận nhập học". Nút chính duy nhất "Thêm lead" chỉ hiện với người có quyền sửa CRM.
- **Chip trạng thái có số đếm** (Tất cả và 6 trạng thái). Số đếm theo các bộ lọc khác nhưng bỏ qua bộ lọc trạng thái, nên bấm chip nào cũng biết trước sẽ ra bao nhiêu lead. Đếm lỗi thì ẩn chip, không hiện số sai.
- **Huy hiệu trạng thái kèm chi tiết** trong danh sách: "Đang quan tâm · N ngày", "Đã đặt học thử · ngày học thử gần nhất", "Đã nhập học · ngày", "Đã dừng · lý do" (lý do dài bị cắt, rê chuột xem đủ).
- **Vòng đời lead** ở cột phải trang lead: Đang quan tâm → Đã đặt học thử → Đã học thử → Chờ xác nhận nhập học → Đã nhập học, có ngày cho từng bước; lead đã dừng có thêm bước "Đã dừng" kèm ngày và lý do. Lead tạo trước khi hệ thống ghi ngày đổi trạng thái thì không hiện ngày đoán.
- Khối "Dự kiến nhập học" (học phí, ưu đãi, ngày bắt đầu) và "Lịch sử phân công" ghi rõ ai chuyển cho ai, cách phân công và lý do.
- Trang xem trước `/dev/crm?view=list|detail&state=normal|empty|errors|converted|dropped&role=sale|leader|owner` (trả 404 trên production, mọi nút đều không ghi dữ liệu).

### Changed
- Trang lead chỉ có một nút chính: "Xác nhận chuyển đổi" khi lead đang chờ xác nhận và người xem đủ cả quyền xác nhận học sinh chính thức lẫn quyền kế toán; nếu không thì "Chuyển chờ xác nhận nhập học"; khi không chuyển đổi được, trang ghi rõ lý do bằng lời.
- Checklist nhập học trên trang lead ghi đúng thực tế: 10 mục được xác nhận cùng lúc trong hộp thoại "Xác nhận chuyển đổi", và chỉ lead đã nhập học mới hiện 10/10 kèm người hoàn tất.
- Lead đã dừng ghi ngày dừng và lý do ngay đầu trang; người không có quyền sửa được báo cần quyền gì để mở lại.
- Danh sách lead hiện dạng bảng trên màn hình máy tính 1440px. Đường dẫn vào lead và nút quay lại giữ nguyên bộ lọc đang dùng.
- Tên sale bị ẩn vì quyền xem nhân sự giờ ghi "Sale khác (không xem được tên)" thay vì nhầm thành "Chưa phân công".
- Ô tìm kiếm ghi rõ tìm được theo tên học sinh, phụ huynh, SĐT và mã lead.

### Fixed
- Hộp thoại xác nhận chuyển đổi không còn cho chọn "Hybrid", vì hệ thống chỉ nhận Online hoặc Offline và sẽ báo lỗi khi lưu.
- Tìm kiếm có dấu phẩy hoặc ngoặc, hay đường dẫn có trạng thái, khối, sale không hợp lệ không còn làm trang báo lỗi hoặc hiện bộ lọc ảo.
- Trình đọc màn hình đọc lại số lead "Hiển thị n / total lead" (hoặc thông báo rỗng, lỗi) mỗi khi đổi bộ lọc.

### Lưu ý triển khai
- Không có migration, không đổi quyền, route hay RPC.
- Thiết kế có tick từng mục checklist kèm người và giờ, nút Nhận lead, Sửa thông tin, Xuất CSV, Nhắc kế toán, tỉ lệ chuyển đổi, giới hạn sale chỉ thấy lead của mình, giờ và phòng học thử; ERP chưa có dữ liệu hoặc luồng cho những phần này nên chưa làm.

## [0.14.0.0] - 2026-10-14

Cài đặt hệ thống dựng lại theo phong cách Stumana (bước 9): mục lục bên trái, thanh lưu luôn nằm ở đáy trang, và ma trận phân quyền xem được mọi vai trò cùng lúc.

### Added
- **Mục lục cài đặt bên trái** gồm Tổng quan, Chung, Thương hiệu & giao diện, Trang web công khai, Người dùng, Phân quyền, Nhật ký. Mục nào người xem không có quyền thì ẩn hẳn. Trên điện thoại mục lục thành một hàng cuộn ngang và tự cuộn tới mục đang mở.
- **Thanh lưu ở đáy trang** cho Chung, Thương hiệu và Trang web: ghi rõ "Chưa có thay đổi" hoặc "n thay đổi chưa lưu" kèm tên các ô đã sửa, nút Hủy (trả về giá trị đã lưu) và nút Lưu. Lưu lỗi thì báo ngay trên thanh và giữ nguyên những gì đã nhập. Người chỉ có quyền xem không thấy thanh này.
- **Hỏi trước khi rời trang** khi còn thay đổi chưa lưu: bấm mục lục hoặc link trong Cài đặt sẽ hiện "Thay đổi chưa lưu sẽ mất"; đóng tab hoặc tải lại cũng được trình duyệt hỏi, kể cả khi đang lưu.
- **Ma trận phân quyền** (màn hình rộng): mỗi hàng là một quyền, mỗi cột là một vai trò, nhóm theo chức năng. Tick nhiều ô ở nhiều vai trò rồi lưu một lần; ô đã sửa có nền vàng và dấu chấm. Khi lưu phải nhập lý do, hệ thống lưu lần lượt từng vai trò và báo rõ vai trò nào lưu lỗi (phần sửa của vai trò đó được giữ để thử lại). Cột Owner luôn khóa. Đang lưu mà bấm chuyển trang thì hiện "Đang lưu phân quyền" để chọn ở lại hoặc vẫn rời trang.
- **Xem trước giao diện ERP** ở trang Thương hiệu: đổi màu nhấn hoặc bo góc là thấy ngay trên khung xem trước, chưa áp vào cả ứng dụng cho tới khi lưu.
- Trang xem trước `/dev/settings?view=general|branding|website|permissions&role=owner|manager|viewer&state=normal|dirty|error` (trả 404 trên production, không ghi dữ liệu).

### Changed
- Trang Thương hiệu chia thành các khối Nhận diện, Giao diện ERP, Màu website và Giao diện của riêng anh. "Màu nhấn" chọn bằng thẻ màu (6 màu đang có), "Bo góc" chọn Chuẩn hoặc Mềm. Ô chọn màu website và màu cá nhân hiện rõ lựa chọn đang dùng.
- Trang Chung chia khối Thông tin trung tâm, Coaching, Buổi học, Tin nhắn phụ huynh (Zalo). Người chỉ có quyền xem thấy nhãn tiếng Việt thay cho mã cài đặt, kèm lý do vì sao không sửa được.
- Nút "Ngừng công khai" website xác nhận bằng nút viền đỏ thay vì nút đỏ đặc.
- Tải danh sách nick ZaloCRM bị lỗi kết nối thì báo lỗi ngay dưới ô chọn, không làm mất những gì đang nhập trong trang.

### Lưu ý triển khai
- Không có migration, không đổi quyền hay RPC.
- Thiết kế có Tên viết tắt (mã học sinh), Tên hiển thị trên QR SePay, chọn Sáng/Tối cho cả trung tâm, bo góc 3 mức, nút Thêm vai trò và cảnh báo "N người sẽ mất quyền"; ERP chưa có dữ liệu hoặc luồng cho những phần này nên chưa làm.

## [0.13.0.0] - 2026-10-14

Bảng lương dựng lại theo phong cách Stumana (bước 8): Dashboard lương mở đầu bằng quỹ lương của tháng, sổ lương theo ngày cho biết từng ca đã được tính tiền hay chưa và vì sao, phiếu lương gọn theo thẻ thiết kế.

### Added
- **Đầu trang `/payroll/dashboard`** ghi "Quỹ lương tháng MM/YYYY" kèm trạng thái kỳ (kỳ đang chờ duyệt hoặc đã duyệt được ưu tiên). Người có quyền duyệt lương thấy một nút chính duy nhất "Xem kỳ … chờ duyệt".
- **Dải số liệu mỏng** dưới đầu trang thay cho các thẻ lớn: tổng thu nhập, khấu trừ, lương phải trả (tạm tính hoặc đã duyệt), số ca chờ xác minh, và thực thu sau hoàn cùng tỷ lệ lương trên thực thu khi có quyền xem tài chính.
- **Bảng "Theo nhân sự"**: dòng thiếu dữ liệu vẫn hiện số tiền, kèm nhãn "Chưa đủ dữ liệu · lý do"; chỉ ghi "Chưa tính được" khi thật sự không có tiền. Tháng đã duyệt ghi "Phải trả".
- Dòng nhắc "N nhân sự có chấm công nhưng chưa có vị trí lương" kèm liên kết tới trang nhân sự (ẩn khi đang lọc theo vị trí).
- **Sổ lương theo ngày** ghi trạng thái tiền của từng ca: "Chờ xác minh (tính tạm)", "Chưa tính · chưa xác minh" hoặc "Chưa tính · thiếu đơn giá". Banner đầu sổ đếm đúng số ca đang tính tạm. Tháng đã duyệt không bao giờ bị suy ra là ca "không có trong lương".
- Trang xem trước `/dev/payroll?view=dashboard|ledger|payslip&role=owner|accountant|staff&state=normal|empty|errors` (trả 404 trên production, không gọi API hay ghi dữ liệu).

### Changed
- Các biểu đồ và bảng phân tích cũ chuyển xuống mục "Phân tích" phía dưới Dashboard lương.
- Phiếu lương trình bày lại theo thẻ thiết kế; các khối chưa có dữ liệu (mã phiếu, thuế TNCN, Zalo, người duyệt) được bỏ thay vì để trống.
- Giờ trên phiếu lương và thẻ tạm tính của nhân sự luôn theo giờ Việt Nam, không phụ thuộc múi giờ máy chủ.

### Fixed
- Khối tạm tính lương của chủ trung tâm không còn báo lỗi tải ở tháng đã duyệt (dữ liệu tháng đã duyệt không có giờ tính).
- Khối tạm tính không còn báo lỗi tải khi có cảnh báo không gắn với nhân sự cụ thể (ví dụ thiếu người tuyển sinh).

### Lưu ý triển khai
- Không có migration.

## [0.12.0.0] - 2026-10-14

Đối soát SePay dựng lại theo phong cách Stumana (bước 7, đợt 2): giao dịch cần xử lý nằm trong một hàng đợi, bấm vào là thấy chi tiết và thao tác ngay bên cạnh.

### Added
- **Tab "Cần xử lý" và "Tất cả giao dịch"** trên `/finance/sepay`. "Cần xử lý" có số việc tồn và chip lọc theo trạng thái (Chưa khớp, Sai số tiền, Sai tài khoản nhận, Trùng nhận diện). Chip chỉ hiện khi cả hàng đợi nằm gọn một trang, nên số đếm luôn đúng.
- **Hàng đợi và chi tiết** trên màn hình rộng: danh sách giao dịch bên trái (số tiền, giờ, nội dung chuyển khoản, trạng thái); bên phải là chi tiết giao dịch đang chọn, gợi ý khớp của chính giao dịch đó, và nút "Phân bổ học phí" / "Đối soát" dùng chung hộp thoại cũ. Giao dịch đang chọn và chip đang lọc được giữ trên địa chỉ trang. Xử lý xong một giao dịch thì trang báo rõ và chuyển sang giao dịch kế tiếp.
- **Trên điện thoại**, mỗi thẻ giao dịch có sẵn nút thao tác và gợi ý khớp ("Có gợi ý: …") để xác nhận ngay.
- Hàng đợi trống thì báo "Tất cả giao dịch đã khớp"; khi chỉ một tài khoản nhận hết việc, hoặc trang hiện tại trống mà hàng đợi vẫn còn, thì báo trung tính và có liên kết quay lại.
- Giao dịch trùng nhận diện chưa đối soát được ở đây thì ghi lý do và việc cần làm, thay cho "Không cần thao tác". Người chỉ có quyền xem thấy lý do thay vì nút bị ẩn.
- Đầu trang ghi tài khoản nhận đang hiệu lực hôm nay và giờ giao dịch mới nhất (khi có dữ liệu).
- Trang xem trước `/dev/sepay?tab=review|all&role=owner|accountant&state=normal|empty|errors` (trả 404 trên production, mọi thao tác ghi là giả).

### Changed
- Giờ giao dịch trong bảng SePay luôn theo giờ Việt Nam, không phụ thuộc múi giờ của máy.
- Chip lọc tài khoản nhận đang chọn dùng nền nhạt (không còn chữ tối trên nền xanh) và cao 44px trên điện thoại.
- Xác nhận hàng loạt gợi ý tin cậy cao và panel đồng bộ lịch sử chỉ nằm ở tab "Tất cả giao dịch".
- Mở `/finance/sepay` không kèm tham số vẫn ra danh sách đầy đủ như trước; liên kết `?queue=review` mở hàng đợi.

### Lưu ý triển khai
- Không có migration.
- Thiết kế có các tab "Lệch số tiền", "Khớp tự động hôm nay", "Bỏ qua / hoàn tiền", trạng thái webhook, "Nhập sao kê thủ công" và bảng phân bổ ngay trong trang; ERP chưa có dữ liệu hoặc luồng cho những phần này nên chưa làm (trạng thái lệch được gộp thành chip trong "Cần xử lý").

## [0.11.0.0] - 2026-10-14

Kỳ thu học phí dựng lại theo phong cách Stumana (bước 7, đợt 1): danh sách kỳ thu có số tiền từng kỳ, trang chi tiết kỳ có thanh tiến trình 4 bước và bảng phiếu lọc theo trạng thái thanh toán.

### Added
- **Danh sách kỳ thu** (`/finance/tuition-periods`) dạng bảng (thẻ trên điện thoại): hạn thu, số học sinh, phải thu, đã thu, còn lại và trạng thái của từng kỳ. Ngoài "Nháp" và "Đã khóa", mỗi kỳ có thêm mô tả: "thu N%", "Quá hạn · N HS", "Hoàn tất" (chỉ khi đã thu được tiền), "Không còn yêu cầu hiệu lực", hoặc "Chưa rõ N yêu cầu" khi có phiếu chưa đọc được yêu cầu thanh toán. Số còn nợ sau hạn ghi chữ "quá hạn", không chỉ tô màu.
- **Tạo kỳ thu trong hộp thoại**; khi máy chủ báo lỗi, các ô vừa nhập vẫn được giữ. Nút "Mẫu thông báo" chỉ hiện với người được sửa mẫu phiếu.
- **Trang chi tiết kỳ** có thanh 4 bước: Nháp, Khóa kỳ (tạo yêu cầu thanh toán), Phiếu học phí, Thu & đối soát. Kỳ đã khóa có dải số liệu (phải thu, đã thu, còn lại, quá hạn), chip lọc theo đúng nhãn thanh toán (Đã thanh toán, Thanh toán một phần, Chờ thanh toán, Đã hủy/hết hạn), bộ lọc theo lớp và bảng phiếu có liên kết tới từng phiếu. Nút chính "Đối soát giao dịch SePay" chỉ hiện khi còn tiền phải thu và người xem có quyền SePay.
- **Khóa kỳ** nằm trong khung kiểm tra điều kiện: nêu rõ điều kiện nào chưa đạt và vì sao nút bị khóa. Sau khi khóa thành công, thông báo hiện ngay cạnh chỗ bấm và không lặp lại khi tải lại trang.
- Người không có quyền xem thanh toán vẫn thấy số phải thu theo phiếu; cột đã thu và còn lại hiện "—" kèm lý do.
- Trang xem trước `/dev/tuition?view=list|draft|locked&role=owner|accountant&state=normal|empty|errors|ready` (trả 404 trên production, không ghi dữ liệu).

### Changed
- Dashboard trang chủ tính tiến độ kỳ thu theo cùng quy tắc với trang kỳ thu: bỏ cả yêu cầu đã hủy lẫn đã hết hạn.
- In phiếu học phí chỉ lấy phiếu hiện hành; học sinh có phiếu phát hành lại không còn in kèm phiếu cũ và QR cũ.
- Hai nút "Lưu …" hàng loạt trong bảng chuẩn bị kỳ nháp là nút phụ; nút chính duy nhất của trang nháp là khóa kỳ.
- Lỗi tải kỳ thu hiện thành lỗi, không còn thành "Không tìm thấy kỳ thu" hay "Chưa có học sinh".

### Lưu ý triển khai
- Không có migration.
- Danh sách kỳ thu đọc phiếu và yêu cầu thanh toán của mọi kỳ đã khóa mỗi lần mở trang; sẽ gộp bằng truy vấn tổng hợp khi số kỳ tăng.
- Học sinh học nhiều lớp chỉ hiện tên lớp đầu tiên (theo dữ liệu chốt khi khóa kỳ); lọc theo lớp có thể bỏ sót em đó ở lớp thứ hai.

## [0.10.0.0] - 2026-10-14

Trang chủ dựng lại theo phong cách Stumana (bước 6): mở app là thấy ngay hôm nay có gì, việc gì còn tồn và ai cần làm gì, theo đúng quyền của từng người.

### Added
- **Hai bố cục theo quyền**: ai có quyền tài chính, thanh toán, SePay, kỳ thu, bảng lương, trạng thái học sinh hoặc xếp lịch thấy bố cục "Tổng quan" của trung tâm; những người còn lại (thường là trợ giảng) thấy "Hôm nay của bạn".
- **Tổng quan trung tâm**: dải 4 số (buổi học hôm nay, buổi quá giờ chưa xong điểm danh, công nợ quá 30 ngày, giao dịch SePay chưa khớp), buổi học tiếp theo, lịch hôm nay, tiến độ kỳ thu học phí (phải thu, đã thu, quá hạn, hạn thu) và số liệu tuần này (học sinh đang học, hồ sơ mới, bảo lưu, chuyên cần, lead mới).
- **"Cần bạn xử lý" / "Việc của bạn"**: mỗi việc một dòng, một đường dẫn tới đúng trang xử lý, và chỉ hiện khi người xem làm được việc đó (kế toán chỉ thấy việc tài chính). Gồm buổi chưa bắt đầu, buổi đang dở chưa hoàn thành, buổi thiếu điểm danh, buổi đã điểm danh đủ chờ khóa, buổi thiếu kết quả, SePay chưa khớp, công nợ quá hạn, kỳ lương và tạm ứng chờ duyệt, điều chỉnh công, phiếu coaching ưu tiên cao, xung đột nhập bảng lương, lịch hẹn CRM và việc chăm sóc quá hạn. Chỉ báo "Không có việc tồn" khi mọi nguồn đều tải được.
- **Hôm nay của bạn** (trợ giảng): một nút chính duy nhất, "Điểm danh buổi này" khi buổi đang diễn ra hoặc "Bắt đầu buổi học" khi đã đến giờ và bạn có quyền bắt đầu; lịch hôm nay của trung tâm; tháng này của bạn (số ca, giờ công, ca có GPS, điều chỉnh chờ duyệt).
- **Dải chấm công** ở cả hai bố cục: chưa vào ca, đang trong ca, hoặc đã ra ca hôm nay, kèm nút chấm công. Thẻ lương tạm tính vẫn hiện cho ai có quyền xem lương.
- Khối nào không có quyền thì ẩn; khối nào tải lỗi thì giữ khung, ghi rõ "Chưa tải được" và có nút "Thử lại", không hiện số 0 giả. Lỗi phần phân tích không làm hỏng các khối phía trên.
- Trang xem trước `/dev/dashboard?role=owner|accountant|ta&state=normal|empty|errors` (trả 404 trên production).

### Changed
- Biểu đồ và số liệu cũ của trang chủ chuyển xuống mục "Phân tích" ở cuối trang; đổi tháng xem có chữ báo đang tải.
- Tháng xem trên đường dẫn (`?month=`) không hợp lệ thì dùng tháng hiện tại thay vì báo lỗi.
- Nút dạng đường dẫn màu chính hoặc màu đỏ (ví dụ "Tạo lớp mới", "Thêm học sinh") giờ luôn hiện chữ trắng hoặc đỏ đúng màu, trước đây bị chữ tối trên nền xanh.

### Removed
- Khung "Hôm nay" và "Trung tâm cần chú ý" cũ của trang chủ (nội dung đã gộp vào danh sách việc). Số thông báo chưa đọc vẫn ở chuông trên thanh trên cùng.

### Lưu ý triển khai
- Không có migration.
- Trang chủ gọi kiểm tra sĩ số cho từng buổi hôm nay (tối đa 40, chạy 8 buổi một lúc) và đọc hàng đợi buổi chờ khóa mỗi lần tải; sẽ tối ưu bằng RPC tổng hợp sau.
- Trong dữ liệu khởi tạo chỉ chủ trung tâm có quyền xem lớp (`classes.view`); người không có quyền này sẽ thấy các khối buổi học báo "Chưa tải được". Cần kiểm tra quyền trợ giảng trên production.

## [0.9.0.0] - 2026-10-14

Trang chi tiết lớp có đủ 3 tab còn lại theo phong cách Stumana (bước 5b, đợt 2): xem học sinh của lớp, bảng điểm theo buổi và học phí theo kỳ thu ngay trên trang lớp.

### Added
- **Tab Học sinh**: danh sách ghi danh của lớp với chip Đang học, Bảo lưu, Đã rời lớp (có đếm số). Mỗi dòng có mã, tên, ngày vào lớp (và ngày rời lớp), hình thức học, số dư buổi, công nợ và trạng thái ghi danh. Học sinh bảo lưu rồi học lại ở lớp khác hiện "Đã học lại lớp khác" thay vì nằm mãi trong danh sách bảo lưu.
- **Chuyển lớp và Bảo lưu ngay trên dòng học sinh** (menu "…"), dùng chung hộp thoại với hồ sơ học sinh. Em mới vào lớp hôm nay hoặc vào lớp từ ngày sau thì nút bị khóa kèm lý do. Nếu ghi danh của em đó vừa thay đổi ở nơi khác, thao tác bị từ chối và yêu cầu tải lại trang thay vì tác động nhầm lớp.
- **Tab Kết quả**: bảng điểm kiểm tra theo học sinh và buổi, buổi mới nhất hiện trước (8 buổi mỗi trang), cột trung bình của từng em và dòng trung bình của từng buổi. Ô đỏ có dấu "!" là em có mặt ở buổi đã kết thúc mà chưa có kết quả; buổi đã khóa không nhập thêm được thì hiện "Khóa"; "V" là vắng, "Vở" là chỉ chấm vở. Chấm việc tồn trên tab đếm số ô còn phải nhập.
- **Tab Học phí** (chỉ xem): chọn kỳ thu; mỗi học sinh một dòng với số buổi và số tiền của riêng lớp này. Kỳ đã khóa có thêm tổng phiếu, đã thu, còn nợ và trạng thái thanh toán (cùng nhãn với trang Tài chính), ghi chú khi phiếu gồm lớp khác hoặc đã phát hành lại. Kỳ chưa khóa hiện số liệu dự kiến, số dư buổi đầu kỳ và vướng mắc khi khóa kỳ. Nút dẫn sang trang kỳ thu để khóa kỳ và tạo yêu cầu thanh toán.
- Tab nào không có quyền xem thì ẩn; trợ giảng không thấy tab Học phí. Tab Học phí cần quyền xem lớp, buổi học, học sinh và kỳ thu.

### Changed
- Menu "…" trên điện thoại có nút 44px và không còn tràn khỏi màn hình khi nằm ở mép phải.
- Hộp thoại chuyển lớp và bảo lưu trên hồ sơ học sinh cũng kiểm tra ghi danh hiện tại trước khi gửi.

### Lưu ý triển khai
- Không có migration.
- Tab Học phí của kỳ chưa khóa chạy lại phần xem trước kỳ thu (tính trên toàn trung tâm) mỗi lần mở trang lớp; sẽ tối ưu sau.
- Việc chặn chuyển lớp hoặc bảo lưu từ dữ liệu cũ mới làm ở server action; RPC vẫn chỉ nhận mã học sinh.

## [0.8.0.0] - 2026-10-13

Trang chi tiết lớp dựng lại theo phong cách Stumana (bước 5b, đợt 1): tab Tổng quan cho biết lớp đang cần xử lý gì, tab Buổi học có hủy buổi hàng loạt và ghi danh học sinh ngay trên trang lớp.

### Added
- **Trang chi tiết lớp** (`/classes/[id]`): đầu trang có trạng thái, thông tin lớp, nút Sửa lớp, Ghi danh học sinh và menu "…" để kích hoạt, đóng hoặc lưu trữ lớp. Menu nói rõ vì sao chưa đóng được (còn lịch cố định, còn học sinh đang học, còn buổi đang diễn ra) và hộp xác nhận đóng lớp nêu số buổi đã lên lịch sẽ bị hủy. Mở thẳng tab bằng `?tab=`.
- **Tab Tổng quan**: buổi tiếp theo của lớp, tiến độ số buổi, khung "Lớp này cần bạn xử lý" (buổi chờ khóa kèm tình trạng điểm danh, buổi đã qua mà chưa bắt đầu, học sinh còn công nợ, học sinh vắng liên tiếp theo đúng quy tắc chăm sóc), biểu đồ chuyên cần 12 buổi gần nhất, ô sức khỏe lớp, lịch hằng tuần và lịch cố định. Phần nào thiếu quyền hoặc tải lỗi thì ghi rõ lý do, không hiện số 0 giả.
- **Tab Buổi học**: lọc theo trạng thái (Sắp tới, Chờ khóa, Đã khóa, Đã hủy) có đếm số, mở đúng trang chứa buổi kế tiếp, cột điểm danh và kết quả. Nút trên mỗi dòng đổi theo tình trạng (Điểm danh, Khóa buổi, Mở buổi). Ô trống luôn kèm lời giải thích, kể cả trên điện thoại. Máy tính bảng và điện thoại dùng danh sách thẻ với ô chọn 44px.
- **Hủy buổi hàng loạt** (chỉ chủ trung tâm): chọn tối đa 40 buổi chưa bắt đầu, nhập lý do, xem kết quả từng buổi. Buổi hủy không được mà vẫn còn hủy được thì giữ trong lựa chọn để thử lại. "Chọn tất cả" chỉ lấy buổi sắp tới; buổi đã qua ngày mà chưa bắt đầu phải tích riêng và hộp xác nhận cảnh báo kiểm tra buổi đó chưa dạy. Máy chủ kiểm tra lại từng buổi ngay trước khi hủy và không hủy buổi vừa được bắt đầu.
- **Ghi danh từ trang lớp**: tìm học sinh theo tên hoặc mã trong toàn bộ học sinh chưa ghi danh, gõ không dấu vẫn ra kết quả; ngày bắt đầu mặc định theo giờ Việt Nam.
- **Lớp ghép**: trang lớp cha liệt kê các lớp thành phần (kể cả liên kết bắt đầu sau), không hiện nút tạo lịch hay tạo buổi hàng loạt. Buổi của lớp thành phần chỉ hiện trong thời gian liên kết còn hiệu lực. Sĩ số, chuyên cần và số kết quả chỉ tính học sinh của chính lớp đang xem.
- Menu "…" dùng chung cho trang lớp và hồ sơ học sinh, dùng được hoàn toàn bằng bàn phím.
- Trang xem trước `/dev/class` với dữ liệu mẫu (trả 404 trên production).

### Changed
- Lỗi "lớp ghép không có lịch hoặc buổi riêng" có cùng một câu trên mọi màn hình (tạo lịch, tạo buổi, tạo buổi hàng loạt). Lỗi hủy buổi đã khóa hoặc không còn hủy được có câu báo riêng.
- Biểu tượng trên trang lớp theo đúng nét 1.8 của hệ thiết kế.

### Lưu ý triển khai
- Không có migration.
- Quy tắc "chỉ chủ trung tâm hủy hàng loạt" và việc không hủy buổi đang diễn ra mới được kiểm ở server action; RPC `cancel_class_session` vẫn nhận buổi `in_progress`. Cần chặn thêm ở database bằng migration riêng.

## [0.7.0.0] - 2026-10-13

Giao diện mới theo phong cách Stumana: menu gọn theo nhóm, danh sách học sinh có số liệu chuyên cần, số dư buổi và công nợ, hồ sơ học sinh và trang buổi học được dựng lại.

### Added
- **Danh sách học sinh** (`/students`) có thêm 3 cột: chuyên cần 30 ngày (buổi chính khóa, không tính Học thêm), số dư buổi và công nợ. Công nợ có 2 mức: yêu cầu chờ thanh toán quá 14 ngày hiện đỏ kèm chữ "Quá hạn" (cùng quy tắc với bảng điều khiển), còn lại hiện vàng. Mỗi cột tải riêng; thiếu quyền hoặc lỗi tải thì hiện "—" kèm lý do, không bao giờ hiện 0.
- `/students` và `/classes`: chip lọc nhanh theo trạng thái có đếm số, tóm tắt "đang học · bảo lưu · đã nghỉ", chọn nhiều dòng để chuyển trạng thái hàng loạt, bộ lọc dạng bảng trượt trên điện thoại, phân trang trong khung bảng.
- **Hồ sơ học sinh** (`/students/[id]`): đầu trang với một thao tác chính (Ghi danh vào lớp / Quay lại học) và menu chuyển lớp, bảo lưu, kết thúc kèm lý do; 4 ô số liệu (chuyên cần, số dư buổi, công nợ, buổi tới); cột thông tin phụ huynh, ghi chú nội bộ, nhóm Zalo; 5 tab Lớp, Điểm danh, Thanh toán & số dư buổi, Chăm sóc, Lịch sử, chỉ hiện tab người xem có quyền. Mở thẳng tab bằng `?tab=`.
- **Trang buổi học**: bấm một trạng thái trên dòng chưa điểm danh là lưu ngay; nút "Có mặt cho tất cả chưa chọn" kèm báo cáo chính xác em nào chưa ghi được; thanh tiến độ trên điện thoại; khung khóa buổi liệt kê điều kiện đã đạt hoặc chưa, giống đúng điều kiện của máy chủ.
- Trang xem trước giao diện với dữ liệu mẫu cho người phát triển: `/dev/ui`, `/dev/shell`, `/dev/lists`, `/dev/student`, `/dev/session` (trả 404 trên production).

### Changed
- Menu trái nhóm lại thành "Việc chính" (Hôm nay, Học sinh, Lớp học, Buổi học, Kết quả học tập), "Vận hành" (tài chính, nhân sự, chăm sóc & tuyển sinh, báo cáo) và cuối menu (nhập dữ liệu, cài đặt; mục Thông báo nay cũng nằm trong Cài đặt). Đường dẫn và quyền giữ nguyên. Có chế độ thu gọn 72px và ngăn kéo trên điện thoại.
- Thanh trên cùng có breadcrumb theo trang thật, chuông thông báo đếm số (tối đa 99+), menu tài khoản chứa đổi giao diện và đăng xuất.
- Màu nhấn mặc định đổi sang xanh rêu; "Đất nung" vẫn chọn được trong cài đặt giao diện. Biểu tượng ứng dụng (PWA) đổi theo màu mới.
- Nút, nhãn trạng thái, tab, bảng và banner kết quả dùng bộ thành phần mới; bảng vừa màn hình laptop 1366px.
- Trợ giảng không còn thấy mức học phí và nguồn tuyển sinh trên hồ sơ (ô thông tin và tab Lịch sử); máy chủ cũng không tải các dữ liệu này khi thiếu quyền của tab Thanh toán.

### Lưu ý triển khai
- Màu xanh rêu là mặc định mới và không có migration dữ liệu. Nếu rollback về bản cũ sau khi ai đó đã lưu lựa chọn "moss", bản cũ không nhận ra giá trị này.
- Việc ẩn mức học phí với trợ giảng mới làm ở giao diện và khâu tải dữ liệu. Chính sách RLS của `student_tuition_rate_versions` và `student_acquisition_source_assignments` vẫn cho đọc trực tiếp qua API; sẽ thu hẹp bằng migration riêng.

## [0.6.22.1] - 2026-10-13

### Fixed
- Danh sách học sinh (`/students`) và hồ sơ của học sinh đã nghỉ không còn báo lỗi dữ liệu. Trước đây, chỉ cần một học sinh được kết thúc ghi danh bằng "Nghỉ học" (trạng thái `withdrawn`, có từ 0.6.16.0) là toàn bộ danh sách học sinh báo lỗi với mọi nhân viên.

## [0.6.22.0] - 2026-10-13

Sửa lỗi chặn vận hành buổi học, trợ giảng được bắt đầu/kết thúc buổi.

### Fixed
- **Tạo buổi học hàng loạt** (`/sessions/batch`) và hàm tạo buổi theo năm học bị lỗi `42P10` trên production từ bản 0.6.16.0: chỉ mục duy nhất (lịch, ngày) đã đổi sang bỏ qua buổi hủy nhưng mệnh đề `on conflict` của `create_batch_class_sessions` và `materialize_class_sessions` chưa đổi theo. Hai hàm được tạo lại với đúng điều kiện; thêm kiểm thử DB tạo lại được buổi sau khi hủy.
- Tiêu đề trang buổi học hiển thị lùi một ngày (ví dụ "Chủ Nhật 11/10" cho buổi Thứ 2 12/10) vì định dạng ngày trên máy chủ theo UTC; đã cố định múi giờ Việt Nam.
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
