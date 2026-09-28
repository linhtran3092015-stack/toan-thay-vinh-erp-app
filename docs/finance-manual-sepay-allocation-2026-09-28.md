# Khớp và phân bổ học phí SePay thủ công

## Luồng sử dụng

Tại **Tài chính → Giao dịch SePay**, người có quyền xem `sepay.view` và quyền `sepay.allocate` hoặc `payments.manage` chọn **Phân bổ học phí** ở giao dịch tiền vào chưa khớp, sai số tiền hoặc sai loại yêu cầu. Áp dụng cho cả giao dịch nhận qua webhook và giao dịch nhập lịch sử.

1. Đọc ngân hàng, số tiền, ngày và nội dung chuyển khoản.
2. Tìm học sinh bằng tên (có hoặc không dấu), mã học sinh hoặc số điện thoại phụ huynh. Kiểm tra năm sinh và phụ huynh trước khi chọn.
3. Có thể chọn tối đa 50 học sinh, kể cả khác phụ huynh; mỗi học sinh xuất hiện một lần. Phụ huynh chính của từng học sinh được xác định lại ở thời điểm ghi nhận.
4. Nếu học sinh chưa có yêu cầu chưa hoàn tất, nhập số tiền, số buổi mua và số buổi tặng đã thống nhất với phụ huynh. Nếu đã có yêu cầu, chọn yêu cầu đang chờ thanh toán và chưa nhận tiền; số tiền và số buổi lấy từ yêu cầu đó. Yêu cầu đã thanh toán một phần hoặc khác loại tài khoản nhận không chọn được.
5. Nhập lý do, phân bổ đủ toàn bộ tiền giao dịch, chọn **Kiểm tra phân bổ** rồi **Xác nhận phân bổ**.
6. Giao dịch chuyển sang **Đã phân bổ học phí**. **Xem phân bổ** hiển thị từng học sinh, tiền, số buổi, yêu cầu liên quan, người ghi nhận, thời điểm và lý do. Người chỉ có `sepay.view` cũng xem được thông tin này.

Nút **Đối soát** khớp nguyên giao dịch vào một yêu cầu có sẵn cũng được mở cho giao dịch webhook, không chỉ giao dịch nhập lịch sử. Thao tác bỏ qua/đã hạch toán lịch sử giữ phạm vi lịch sử như trước.

## Dữ liệu và kiểm soát

- Một lần ghi nhận là một giao dịch cơ sở dữ liệu: phiếu phân bổ, lô học phí, sổ cái số buổi, khoản thu và nhật ký cùng thành công hoặc cùng hoàn tác.
- Đơn hàng dùng khoản thu học phí chuẩn hiện có; không thêm một nguồn doanh thu riêng.
- Giao dịch ngân hàng bị khóa khi phân bổ. Hai người xác nhận đồng thời chỉ có một lần thành công. Giao dịch đã có hiệu lực tài chính, đã xử lý, chuyển ra, trùng nhận diện hoặc chưa rõ tài khoản nhận đều không được phân bổ mới.
- Yêu cầu được chọn phải còn chờ thanh toán, đúng học sinh, đúng loại tài khoản nhận, đúng tiền và số buổi. Yêu cầu được khóa và chuyển sang đã thanh toán cùng lần phân bổ.
- Ngày hiệu lực số buổi là ngày chuyển tiền tại Việt Nam. Ngày thao tác và người thao tác lưu riêng trong nhật ký.
- Đơn giá quy đổi trực tiếp dùng số nguyên VND theo quy ước lô học phí hiện hữu. Tiền thực nhận lưu đầy đủ ở phân bổ và khoản thu; không tái tính tiền thu từ đơn giá đã làm tròn xuống.
- Không yêu cầu thêm quyền đọc toàn bộ bảng học sinh/phụ huynh cho nhân sự phân bổ. RPC tìm kiếm chỉ trả tối đa 30 học sinh và thông tin cần để xác minh.

## Phạm vi hiện tại

- Phải phân bổ hết tiền giao dịch; chưa có số dư chờ phân bổ/ví gia đình.
- Mỗi dòng liên kết tối đa một yêu cầu và phải thanh toán đủ yêu cầu đó. Không hỗ trợ trả thiếu, nhiều giao dịch góp vào một yêu cầu, hoặc một học sinh trả nhiều yêu cầu trong cùng giao dịch ở màn hình này.
- Chặn thu trực tiếp khi học sinh đang có yêu cầu chưa hoàn tất để tránh giữ lại khoản phải thu sau khi đã cộng buổi.
- Chỉ chọn học sinh đang học có phụ huynh chính. Giao dịch chưa xác định tài khoản nhận cần xử lý cấu hình trước.
- Không có thao tác sửa/xóa phân bổ đã ghi nhận trong đợt này. Điều chỉnh tài chính là nghiệp vụ riêng có nhật ký.

## Kiểm chứng

- Regression tái hiện giao dịch webhook bị ẩn nút đối soát: thất bại trước thay đổi và đạt sau thay đổi.
- 130 tệp / 658 kiểm thử ứng dụng đạt, bao gồm kiểm thử giao diện và Server Actions mới.
- PostgreSQL cục bộ chạy các hàm migration thực: phân bổ nhiều học sinh khác phụ huynh, khớp yêu cầu, chặn thiếu/vượt tiền, số buổi sai, học sinh trùng, quyền hạn, giao dịch đã xử lý, hoàn tác lỗi và ngày hiệu lực.
- Hai kết nối PostgreSQL cùng phân bổ một giao dịch: đúng một khoản thu được tạo.
- Không chạy thao tác phân bổ thử trên production.

## Gstack investigation

Nguyên nhân: RPC phân bổ tồn tại nhưng không được gắn giao diện; luồng đối soát chỉ nhận bản ghi có SePay API v2, đồng thời chỉ tìm yêu cầu có số tiền bằng giao dịch. Khắc phục mở giao diện phân bổ, mở đối soát webhook và giữ các kiểm tra quyền/tiền/buổi ở cơ sở dữ liệu.

Learning: quyền đồng bộ lịch sử không tự cấp quyền phân bổ tự do; dùng quyền phân bổ riêng và RPC tra cứu hẹp. Giao dịch không có yêu cầu không được âm thầm cộng số buổi khi học sinh vẫn có khoản phải thu mở.
