# Kỳ thu học phí: kết quả sửa luồng chuẩn bị dữ liệu

Ngày: 23/09/2026. Tiếp nối phương án B trong [báo cáo nghiệp vụ](finance-sepay-operating-review-2026-09-23.md).

## Phạm vi và trạng thái trước phát hành

Đã sửa và kiểm chứng trên mã nguồn/local: chuẩn bị đơn giá và nguồn, giải thích điều kiện khóa, tải đầy đủ preview, khóa tạo yêu cầu hàng loạt, nội dung chuyển khoản dễ đọc và chống khớp mơ hồ. Chưa triển khai migration vào cơ sở dữ liệu thật, chưa thay học phí thật, chưa khóa kỳ 22/08–06/11, chưa gửi thông báo phụ huynh.

Đây là bước gỡ vướng chuẩn bị dữ liệu, **chưa hoàn tất toàn bộ phương án B**. Không coi kết quả test này là nghiệm thu công nợ đầu kỳ, trả thiếu/thừa, ví gia đình hay quyết toán.

## Chẩn đoán

- Yêu cầu thanh toán được tạo khi khóa kỳ thành công; tạo kỳ nháp chỉ chuẩn bị dữ liệu. Học viên không còn tiền phải thu sẽ có phiếu không cần thanh toán.
- Preview phụ thuộc đơn giá có hiệu lực tại ngày học, nguồn và phụ huynh chính. Đơn giá ngoài Excel/Sheets chưa được nhập vào ERP không thể được dùng để tính phí.
- Mã cũ lấy preview một lần, chịu giới hạn số dòng API. Số 1.000 trong ảnh có thể là giới hạn trả về, không chứng minh kỳ chỉ có 1.000 buổi. Bản sửa tải nhiều trang với thứ tự ổn định; lỗi một trang không được hiển thị thành preview hợp lệ.
- Thiếu giá từng dòng được kiểm chứng bằng dữ liệu tổng hợp trong PostgreSQL. Chưa truy vấn được DB thật do kết nối thất bại, nên chưa xác nhận nguyên nhân cụ thể của từng dòng trong ảnh.

## Thay đổi

1. Chi tiết kỳ nháp có danh sách học viên, bộ lọc vấn đề và đường dẫn hồ sơ. Tách số học viên, số dòng buổi và các điều kiện thiếu. Chưa đủ giá thì không hiển thị tổng 0đ như một số tiền hợp lệ. Lỗi tải dữ liệu hoặc kỳ không có buổi sẽ chặn khóa.
2. Nhập cùng đơn giá cho nhóm học viên được chọn, cần số tiền và căn cứ thực tế. Mỗi học viên nhận phiên bản giá từ ngày học đầu tiên còn thiếu giá trong kỳ; các phiên bản đã tồn tại được giữ nguyên. Không điền sẵn 150.000đ vào ô nhập hoặc dòng xuất của học viên thật.
3. Bổ sung nguồn theo nhóm chỉ áp dụng cho học viên còn thiếu nguồn trong kỳ nháp. Người dùng phải chọn nguồn đang hoạt động. Mỗi nhóm lưu trong một transaction; sai một dòng thì không lưu một phần. Giá và nguồn đều kiểm tra quyền tại DB, ghi lịch sử qua các hàm version/audit hiện có.
4. Nội dung chuyển khoản mới: `HO TEN HOC SINH NAM SINH SDT PHU HUYNH PAY-...`. Phần tên bỏ dấu, viết hoa; giữ mã duy nhất để phân biệt nhiều kỳ. Phiếu/QR đã phát hành giữ nguyên.
5. Khi không có mã, nội dung phải khớp đúng tên, năm sinh và số điện thoại (cho phép tiền tố cố định HOC PHI) và chỉ có một yêu cầu chờ phù hợp. Nếu nhiều yêu cầu phù hợp thì không tự thu. Số điện thoại dài hơn nhưng giống tiền tố không được khớp. Mã cũ đã thanh toán không được dùng để tự trả yêu cầu mới.
6. Giữ cơ chế webhook chống trùng và kiểm tra số tiền/tài khoản hiện có. Không biến tiền không có yêu cầu thành học phí tự động; trường hợp này vẫn chờ bước phân bổ của B.

## Kiểm chứng

- Regression trước sửa: lỗi phân trang/preview, thông báo thiếu giá, giá mặc định và khớp nhầm tiền tố điện thoại được tái hiện.
- `npm test`: 126 file, 642 test đạt. Sau đó test bổ sung export và bộ lọc: 2 file, 5 test đạt (gồm 2 test export mới).
- `npm run typecheck`, `npm run lint`: đạt.
- `npm run build`: đạt. Build có log `DYNAMIC_SERVER_USAGE` từ các trang sử dụng cookies; các route liên quan vẫn được nhận diện là dynamic và build exit 0.
- `node scripts/test-tuition-readiness-db.mjs`: đạt trên PostgreSQL 14 tạm, không mở TCP, không kết nối DB thật. Dùng các migration tài chính thực cùng fixture auth/học vụ; đây không thay thế chạy toàn bộ chuỗi migration và pgTAP trên staging.
- SQL kiểm tra: thiếu giá chặn khóa; giá hiệu lực từ buổi đầu; nhóm lỗi rollback; nguồn thiếu được bổ sung nguyên khối; phụ huynh thiếu có chẩn đoán; kỳ rỗng không khóa; khóa hai lần không trùng yêu cầu; QR dùng cùng nội dung; nhiều kỳ không tự khớp; webhook retry không trùng khoản thu/buổi; mã đã trả không chuyển sang kỳ mới; quyền bị kiểm tra trong DB.

## Các việc còn lại trước nghiệm thu phương án B

Các rủi ro đã nêu trong báo cáo nghiệp vụ vẫn cần xử lý, đặc biệt khi khóa muộn kỳ bắt đầu 22/08:

- Số dư đầu kỳ hiện vẫn dựa trên tổng số dư hiện tại. Cần snapshot/cutoff và tham chiếu công nợ đã lập để không tính lại buổi của kỳ đang thu hoặc lập nợ hai lần. Không xác nhận tổng thu thật chỉ vì đã hết blocker thiếu giá.
- Chống kỳ chồng và sử dụng lại cùng số dư; phát hành lại phải thay thế yêu cầu cũ an toàn, xử lý cạnh tranh với webhook và khoản đã thu.
- Phân bổ nhiều giao dịch/nhiều phiếu, thu từng phần, tiền thừa/không có yêu cầu vào số dư gia đình và kiểm tra bảo toàn tiền.
- Trạng thái phiếu theo thanh toán hiện hành; đơn hàng/chi phí vận hành theo nghĩa vụ thu, tránh tính phí cố định nhiều lần khi trả nhiều đợt.
- Hộp việc ngoại lệ và phiên quyết toán có số liệu chốt cùng lịch sử điều chỉnh.

Khi có đơn giá thật: nhập hoặc chuẩn bị bảng theo mã học viên, ngày hiệu lực, đơn giá/buổi và căn cứ. Trước phát hành thật cần đối chiếu tổng buổi và số dư đầu kỳ, chạy migration/test trên staging và kiểm tra cấu hình tài khoản nhận SePay. Không tự gán mức phí hoặc nguồn từ file mẫu.

## Ghi nhận kỹ thuật theo gstack investigate

`DONE_WITH_CONCERNS`: sửa luồng chuẩn bị đã qua regression và SQL integration; chưa xác minh staging/production, còn hạng mục tài chính B nêu trên.

- Preview có thể bị cắt bởi giới hạn API ngay cả khi RPC SQL đã tính đủ. Phải phân trang và phân biệt dữ liệu rỗng với lỗi tải.
- Kỳ bắt đầu trong quá khứ cần phiên bản giá hiệu lực tại ngày học, không phải ngày nhập dữ liệu hôm nay.
- Đổi định dạng chuyển khoản phải đổi đồng thời phần tạo yêu cầu, snapshot QR và bộ khớp webhook; mã đã trả không được rơi xuống nhánh nhận diện cá nhân.
- PostgreSQL cục bộ chạy được các hàm migration trong fixture tách biệt khi Docker không hoạt động; cần quyền chạy shared memory ngoài sandbox, không cần chạm DB thật.
- Runtime gstack ở đường dẫn mặc định `~/.claude/skills/gstack` chưa có; đã dùng workflow investigate từ skill trong repository, bỏ telemetry khi preamble không khả dụng.

## Kiểm tra trước phát hành 0.6.3.0

- Bản phát hành tách khỏi các chỉnh sửa bảng lương và script import chưa rà soát.
- Production có đủ các migration nền, chỉ thiếu migration `20260923010000`; định nghĩa 5 hàm được thay thế trùng với bản nền đã đọc trong repository.
- Rà soát độc lập phát hiện tên ngắn nằm trong tên dài có thể khớp sai; đã giới hạn nhánh không mã vào đúng toàn bộ thông tin, hoặc tiền tố cố định HOC PHI, và thêm regression.
- 127 file / 644 test ứng dụng đạt; build và lint đạt. SQL integration đạt và được chạy lại sau chỉnh điều kiện khớp tên.
- Snapshot định nghĩa hàm trước triển khai được lưu ngoài repository để phục vụ khôi phục; không chứa dữ liệu học sinh.
