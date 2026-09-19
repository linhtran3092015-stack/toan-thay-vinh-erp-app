# Kế hoạch: Lương tạm tính cập nhật theo phát sinh

Ngày: 18/09/2026 · Nhánh khảo sát: `main` · Commit: `5ce9ea7`
Trạng thái: DRAFT — nghiệp vụ và phương án B đã được chủ trung tâm chọn; bản kế hoạch chi tiết chờ xem xét.
Workflow: gstack → office-hours. Phạm vi lượt này: thiết kế và kế hoạch, chưa triển khai ứng dụng.

## 1. Mục tiêu và các quyết định đã chốt

Nhân sự xem được lương tháng hiện tại tính đến dữ liệu gần nhất mà không cần đợi lập bảng lương. Chủ trung tâm xem tổng phải trả dự kiến và đối chiếu học phí thực thu để điều hành.

| Quyết định | Nội dung đã thống nhất |
|---|---|
| Hai trạng thái lương | **Lương tạm tính** trước khi duyệt kỳ; **Lương đã duyệt** sau khi chủ trung tâm duyệt bảng lương tháng. Không duyệt từng phần. |
| Công thực tế | Tính theo công thức hiện tại của từng vị trí; không phân bổ lương theo ngày lịch hoặc hiển thị cả tháng ngay từ đầu. |
| Ca đang làm | Không tính; chỉ tính ca đã kết thúc/chấm công ra, kể cả ca được hệ thống kết thúc theo quy tắc hiện hành. |
| Thu nhập bổ sung | Bao gồm thưởng, hoa hồng, phụ cấp, khấu trừ khi đủ dữ liệu; phần phụ thuộc kết quả tháng ghi rõ có thể thay đổi. |
| Công chờ xác minh | Quyết định đầu tiên cho phép tính dự kiến từ công chưa xác nhận. Trạng thái nguồn “chờ xác minh công” phải tách khỏi trạng thái “Lương đã duyệt” của cả kỳ. |
| Đối chiếu thu | Học phí thực thu trừ hoàn học phí trong cùng khoảng thời gian; tiền đóng trước nhiều tháng được tính khi nhận. |
| Sau duyệt | Giữ nguyên số chốt. Muốn thay đổi phải mở lại và duyệt lại theo quy trình hiện có. |
| Vị trí giao diện | Chèn trực tiếp vào module **Bảng lương** của nhân sự (`/payroll`) và **Tổng quan lương** của chủ trung tâm (`/payroll/dashboard`). Không tạo module, mục menu hoặc trang nghiệp vụ mới. |
| Cập nhật | **B: tự cập nhật màn hình khi dữ liệu thay đổi**, dùng chung công thức tính với bảng lương chính thức. |

Đây là số phát sinh từ đầu tháng đến hiện tại, không phải dự báo lương cuối tháng. “Đã duyệt” không đồng nghĩa “đã thanh toán”. Hai trạng thái là hai giai đoạn của cùng kỳ, không cộng thành một tổng.

Phương án đã bỏ: A chỉ tính khi mở trang không đáp ứng màn hình tự cập nhật; C sổ biến động từng đồng lương thay đổi kiến trúc quá lớn cho nhu cầu này.

## 2. Những gì đã xác minh trong repository

| Thành phần | Hiện trạng và tác động |
|---|---|
| `src/app/(app)/payroll/page.tsx` | Đọc bảng lương đã tạo; nhân sự không quản lý gặp màn hình trống nếu chưa có kỳ. Phải tải phần tạm tính độc lập với lịch sử bảng lương. |
| `src/features/payroll/data.ts` | Dùng các RPC `get_payroll_dashboard`, `get_payroll_periods_with_details`, `get_payroll_explanations`. |
| `src/features/payroll/dashboard/*` | Có sẵn lọc tháng/vị trí, tổng hợp và biểu đồ, tái sử dụng bố cục. Dữ liệu hiện dựa trên phiên tính lương hiện hành. |
| `20260915170000_timekeeping_endpoint_verification.sql` | Là định nghĩa mới hơn của `generate_payroll_calculation_run`, có `time_entry_is_verified`. Không refactor nhầm chỉ dựa vào migration tháng 8. |
| Bộ tính hiện hành | Tạo calculation run, ghi dòng lương, đổi phiên hiện hành, đồng bộ nguồn đơn hàng, đánh dấu tạm ứng `deducted`. Không được gọi từ luồng đọc realtime. |
| Cấu hình vị trí | Có `teaching_assistant`, `operations_assistant`, `admissions_manager`. Bao phủ tất cả vị trí đã được cấu hình tính lương; tài khoản chưa có cấu hình phải báo thiếu, không tự chọn công thức. |
| Công thức | Có lương theo phút, hệ số online, quỹ thưởng chấm bài, thưởng nguồn tuyển sinh, ngưỡng doanh thu tháng, nhiệm vụ vận hành, mức sàn và tạm ứng. |
| Nguồn đơn hàng | `sync_payroll_order_facts` ghi nguồn SePay khi tính lương, dùng `ON CONFLICT DO NOTHING`. Luồng live cần bộ đọc nguồn hiện hành, không phụ thuộc đã chạy đồng bộ hay chưa. |
| Tài chính | `finance_cashflow_records` có `receipt/disbursement/refund`; hoàn học phí dùng `record_type=refund, category=refund`, không phải `category=tuition_fee`. Dashboard chung hiện cộng tất cả receipt, không thể dùng nguyên số đó. |
| Realtime | Cấu hình local có Realtime; chưa thấy client subscription trong tìm kiếm `src`. Cần triển khai và kiểm tra publication/RLS trên staging. |

Các kết luận trên là khảo sát mã nguồn, chưa kiểm chứng schema hoặc dữ liệu production. Không truy cập dữ liệu lương thật trong lượt lập kế hoạch.

## 3. Hành vi trên giao diện

### Nhân sự: chèn vào module Bảng lương hiện có (`/payroll`)

Giữ trang Bảng lương hiện có. Chèn phần “Lương tháng 09/2026”, ngày chốt dữ liệu và nhãn trạng thái ở đầu nội dung, phía trên lịch sử bảng lương. Không tạo trang xem lương tạm tính riêng.

- Số chính: **Lương tạm tính**, số tiền sau các khoản khấu trừ đã biết; phụ đề “Tính đến công hoàn tất gần nhất”.
- Bảng thành phần: lương theo công, phụ cấp, thưởng/hoa hồng, điều chỉnh thủ công, khấu trừ, tạm ứng.
- Chi tiết theo nguồn: ngày làm, số phút/công, đơn giá, công thức, số tiền, trạng thái xác minh nguồn. Chỉ cho thấy dữ liệu thuộc quyền nhân sự.
- Dòng “Có công chờ xác minh” và số ca; không gọi phần công đã xác minh là “Lương đã duyệt”.
- Khoản quỹ thưởng/ngưỡng tháng có ghi chú “Tạm tính theo dữ liệu hiện tại; có thể tăng hoặc giảm”.
- “Dữ liệu cập nhật lúc …” lấy từ máy chủ; “Công gần nhất đã tính …” là trường riêng. Không dùng giờ máy người xem làm bằng chứng dữ liệu mới.
- Ca đang mở: hiển thị thông tin chưa tính, không tăng tiền theo từng phút.
- Lịch sử lương đã duyệt ở bên dưới. Khi kỳ được duyệt, thẻ tháng đó chuyển sang số chốt, có thời điểm duyệt và đường dẫn phiếu lương.
- Chưa có kỳ lương chính thức vẫn xem được tạm tính. Chưa có công hợp lệ hiển thị 0 kèm diễn giải; thiếu cấu hình hiển thị “Chưa tính được”, không giả thành 0.

### Chủ trung tâm: chèn vào module Tổng quan lương hiện có (`/payroll/dashboard`)

Giữ module, bộ lọc tháng/vị trí và các bảng/biểu đồ hiện có. Bổ sung dữ liệu tạm tính vào phần tổng quan hiện tại, không dựng dashboard thứ hai hoặc lặp lại các KPI tương đương. Tháng hiện tại có phần “Tính đến hiện tại”:

1. **Tổng thu nhập phát sinh**: tổng các dòng thu nhập trước khấu trừ, để thấy quy mô lương.
2. **Tổng lương tạm tính phải trả**: thu nhập trừ các khoản khấu trừ hiện có, bao gồm tạm ứng được tính vào kỳ.
3. **Học phí thực thu sau hoàn**: có phân rã tổng thu, tổng hoàn.
4. **Tỷ lệ lương phải trả / thực thu sau hoàn**: dùng đúng tử số đã nêu, không gọi chung là biên lợi nhuận.

Bên dưới: tổng khấu trừ, trong đó tạm ứng; bảng theo vị trí và nhân sự; thành phần lương; cảnh báo dữ liệu thiếu; thời điểm cập nhật.

Thực thu sau hoàn ≤ 0: tỷ lệ hiển thị “Không áp dụng”, không chia cho 0 và không tạo tỷ lệ âm gây hiểu lầm. Lương sau khấu trừ âm được giữ nguyên để đối soát, gắn nhãn số dư khấu trừ; không tự chặn về 0 hoặc diễn giải thành đã thu hồi tiền.

Bộ lọc vị trí lọc số lương, không tự phân bổ thực thu trung tâm cho vị trí. Nhãn khi lọc: “Lương vị trí / thực thu toàn trung tâm”. Khi kỳ chưa duyệt, số lương và thu trong một phản hồi dùng cùng mốc dữ liệu. Khi kỳ đã duyệt, lương giữ mốc tính chính thức còn thực thu cập nhật theo sổ mới nhất trong cùng tháng; giao diện hiện riêng hai mốc, không tuyên bố chúng cùng thời điểm.

Không gọi phần chênh lệch giữa thực thu và lương là lợi nhuận hoặc số dư tiền mặt vì còn các chi phí và dòng tiền khác. Không thêm dự báo cuối tháng hay ngưỡng cảnh báo vận hành tùy ý.

### Các trạng thái cần thiết

Loading giữ bố cục; partial nêu khoản thiếu; error không thay số cũ bằng 0; stale giữ số gần nhất nhưng gắn “Chưa cập nhật”; mất kết nối tự thử lại và cho phép “Làm mới”; hết quyền xóa số nhạy cảm đang hiển thị và ngừng tải.

Nút chuyển nhân sự/chủ trung tâm trong bản phác thảo chỉ dùng để xem hai vai trò, không phải tab hoặc mục menu mới trong ứng dụng.

Bản phác thảo đi kèm: `payroll-live-estimate-wireframe.html`, dùng số minh họa, có hai màn hình và trạng thái mẫu. Chưa phải giao diện chạy với dữ liệu thật.

## 4. Quy tắc tính và chất lượng dữ liệu

### Khoảng thời gian

- Múi giờ nghiệp vụ: `Asia/Ho_Chi_Minh`; bắt đầu tháng lúc 00:00 giờ Việt Nam.
- Máy chủ chọn `as_of` một lần cho mỗi phản hồi; mọi nguồn phải có thời điểm phát sinh không sau mốc này, không tính dữ liệu tương lai.
- Công phân kỳ theo `work_date` như hệ thống hiện hành, kể cả ca qua đêm; không tự chia ca sang hai tháng trong tính năng này. Phải kết thúc ca trước `as_of`.
- Nguồn chỉ có ngày dùng `event_date <= ngày(as_of)` và phải đã được ghi nhận trước snapshot. Không suy diễn giờ chính xác từ trường ngày.
- Kỳ cũ chưa duyệt được xem lại theo toàn tháng đã kết thúc; dữ liệu vào muộn có thể làm thay đổi tạm tính kỳ cũ. Kỳ đã duyệt luôn dùng snapshot chính thức.
- Đơn giá theo ngày công; chính sách theo tháng chỉ lấy phiên bản đã có hiệu lực đến ngày cắt dữ liệu. Cuối tháng phải cho cùng kết quả với cách chọn phiên bản của engine chính thức. Không áp dụng sớm cấu hình có hiệu lực trong tương lai.

### Trạng thái nguồn khác với trạng thái duyệt lương

| Nguồn | Tạm tính | Tính chính thức |
|---|---|---|
| Ca hoàn tất, xác minh hợp lệ | Có | Có |
| Ca hoàn tất, ngoại lệ chờ xác minh | Có, nhãn chờ xác minh | Theo bộ lọc hiện tại: chưa đủ điều kiện |
| Ngoại lệ bị từ chối | Không, hiện lý do/ca bị loại | Không |
| Ca còn mở | Không | Không |
| Yêu cầu sửa giờ đang chờ duyệt | Dùng giờ gốc; ghi có yêu cầu chờ xử lý | Dùng giờ gốc đến khi yêu cầu được duyệt |
| Yêu cầu sửa giờ đã duyệt | Dùng giờ hiệu lực đã duyệt | Tương tự |
| Excel chưa được duyệt nhập | Không tin dòng lỗi/chưa duyệt; hiển thị còn nguồn chờ xử lý nếu được phép | Theo cơ chế nhập hiện hành |
| Khoản thủ công | Chỉ khoản đã được lưu hợp lệ bởi người có quyền, trong phiên hiện hành | Giữ quy tắc carry-forward hiện tại |

Không tính công bị từ chối qua đường Excel thay thế: xác định trùng nguồn trước khi lọc tính hợp lệ. Nguồn hệ thống đã tồn tại phải ngăn nhập trùng cùng phạm vi, kể cả khi bị loại do xác minh. Ghi issue để chủ trung tâm xử lý.

### Các công thức không tuyến tính

- Quỹ chấm bài dùng phân bổ quỹ tháng theo tỷ trọng bài hiện có, giữ chia phần dư deterministically như engine hiện hành. Không chia quỹ theo số ngày. Người có bài đầu tiên có thể tạm nhận tỷ trọng lớn rồi giảm khi người khác có bài.
- Thưởng theo ngưỡng doanh thu dùng ngưỡng đạt được tại mốc hiện tại; giữ cơ chế áp dụng trên tổng doanh thu đủ điều kiện theo chính sách hiện hành.
- Mức sàn/bù trừ được tính lại từ toàn bộ thành phần liên quan, không cộng riêng từng sự kiện vào một số dư.
- Nhiệm vụ tính theo tổng trung tâm hoặc số nhân sự phải tính trên tập đủ điều kiện hiện có, không tự tạo thêm điều kiện đạt KPI.
- Lấy giá trị chính sách từ dữ liệu versioned; không hard-code đơn giá, phần trăm hay mức quỹ trong frontend.

### Tạm ứng, dòng thủ công và nguồn tài chính

Luồng xem chỉ đọc. Không đổi tạm ứng thành `deducted`, không mở phản hồi, không tạo bảng lương và không ghi đồng bộ nguồn đơn hàng. Tạm ứng đã gắn vào cùng kỳ vẫn tính một lần; loại tạm ứng kỳ khác hoặc đã hủy theo quy tắc hiện hành.

Bộ đọc nguồn đơn hàng chung phải chuẩn hóa nguồn trực tiếp và nguồn đã nhập/đồng bộ theo khóa nghiệp vụ hiện tại; dữ liệu trực tiếp là nguồn hiện hành cho bản ghi tự đồng bộ. Không cộng cả fact tự đồng bộ lẫn giao dịch gốc. Nguồn bị sửa hoặc hủy phải được phản ánh, tránh giữ fact cũ do `ON CONFLICT DO NOTHING`. Thực hiện regression cho tất cả nguồn trước khi đổi engine chính thức sang bộ đọc chung.

Học phí đối chiếu: chỉ ledger thu đã ghi nhận `receipt + tuition_fee`; hoàn học phí từ quy trình hoàn học viên `refund + refund` có `student_id`. Không cộng yêu cầu thanh toán, giao dịch chưa đối soát hoặc số buổi còn dư.

Mốc nhận tiền ngân hàng đề xuất lấy `sepay_transactions.transaction_at` khi ledger có liên kết; thu thủ công và hoàn dùng thời điểm ghi sổ `created_at` khi không có trường ngày thực nhận/chi đáng tin cậy. Giới hạn này phải ghi trong diễn giải, không suy luận từ ghi chú. Giao dịch ghi sổ muộn được đưa về kỳ của thời điểm nhận tiền nếu có; dữ liệu chưa ghi sổ chưa thể xuất hiện realtime. Không đổi ngày tính hoa hồng hiện hành chỉ để làm bằng số thu đối chiếu; khác biệt về cơ sở ngày phải truy vết được.

Issue thiếu vị trí/đơn giá/nguồn/khối lớp: trả tổng tính được kèm `completeness=partial`, số người/khoản chưa tính và lý do. Nếu thiếu dữ liệu nền tảng của toàn phản hồi, trả `unavailable`. Không ngầm bỏ người thiếu cấu hình khỏi tổng rồi đánh dấu hoàn chỉnh.

## 5. Kiến trúc phương án B

### Tách tính toán thuần khỏi thao tác chốt lương

Tách engine hiện hành thành ba lớp SQL, dùng migration mới:

1. **Nguồn chuẩn hóa**: công hiệu lực, trạng thái xác minh, bài chấm, đơn tuyển sinh/tái phí, nhiệm vụ, chính sách, tạm ứng, dòng thủ công. Có khóa nguồn và mốc dữ liệu.
2. **Bộ tính dùng chung chỉ đọc**: nhận tháng, thời điểm, chế độ `estimate/final`; trả dòng tính, tổng và issue. Không ghi dữ liệu. Khác biệt hai chế độ chỉ là phạm vi thời gian/điều kiện nguồn đã chỉ rõ; công thức không nhân đôi.
3. **Bộ ghi chính thức**: `generate_payroll_calculation_run` tiếp tục kiểm quyền, khóa kỳ, tạo revision và ghi snapshot từ bộ tính chung; các side effect hiện hành vẫn ở đây. API xem tạm tính không gọi bộ ghi.

Không tính riêng từng nhân sự bằng cách lọc mất toàn bộ nhóm đầu vào: quỹ chấm bài và nhiệm vụ theo tổng trung tâm cần đọc đủ tập liên quan trong SQL, rồi mới lọc kết quả theo người được xem. Không trả thông tin nguồn của người khác cho nhân sự.

Tên đề xuất: hàm nội bộ `compute_payroll_projection`, public RPC `get_my_payroll_estimate(p_month)` và `get_owner_payroll_estimate(p_month, p_position_code)`. Hàm nội bộ thu hồi quyền thực thi khỏi `public/anon/authenticated`; wrapper dùng `auth.uid()` và permission hiện tại, `search_path=''`.

RPC cá nhân không nhận staff ID từ client. RPC owner yêu cầu `payroll.dashboard.view`; số thu còn yêu cầu quyền tài chính tương ứng, nếu thiếu trả trạng thái không được xem số thu. Giữ các luồng quản lý/kế toán hiện có, không tự mở dashboard toàn trung tâm cho họ.

### Thông báo thay đổi và tải lại

Bản đầu dùng **bảng đánh dấu phiên dữ liệu + Supabase Postgres Changes**, không cần worker tính lương nền hoặc chạy job mỗi giây:

- Bảng thông báo riêng `payroll_live_revisions`: khóa tháng + loại scope (`staff`/`owner`) + người nhận nếu là staff; `revision`, `changed_at`. Không có tiền lương, tên hay nội dung giao dịch.
- Trigger khi nguồn thay đổi tăng revision thông báo trong transaction nguồn. Sau commit, Realtime báo INSERT/UPDATE; frontend tải lại RPC chỉ đọc. Không publish trực tiếp bảng lương, giao dịch hay chấm công.
- Bản đầu ưu tiên đúng: một thay đổi ảnh hưởng lương làm mới tất cả nhân sự đủ phạm vi tháng liên quan và scope owner. Sau đo tải mới tối ưu fan-out theo phụ thuộc; không bỏ sót ảnh hưởng xuyên nhân sự như quỹ chấm bài.
- RLS: staff chỉ đọc marker của chính mình với `payroll.view`; owner marker chỉ cho `payroll.dashboard.view`. Không cấp INSERT/UPDATE/DELETE trực tiếp cho client. Không dùng DELETE marker làm tín hiệu.
- Khi chưa có marker, dữ liệu vẫn tải bằng RPC; subscribe INSERT/UPDATE bắt marker khi phát sinh. Subscribe thành công phải đọc lại để lấp khoảng trống giữa lần tải đầu và lúc kết nối.
- Gộp nhiều sự kiện trong 300–500 ms; tối đa một request đang chạy mỗi scope, có cờ cần tải lại nếu sự kiện đến giữa chừng. Bỏ phản hồi cũ khi đổi tháng/tài khoản; chỉ hiển thị revision không lùi.
- Khi mở trang, quay lại tab, kết nối lại, chuyển tháng hoặc bấm Làm mới: đọc snapshot mới. Khi tab hiện: fallback kiểm tra mỗi 30 giây để bắt sự kiện rơi/mất kết nối; tab ẩn dừng polling. Qua nửa đêm/đầu tháng tải lại dù không có sự kiện DB.
- Mục tiêu nghiệm thu: ở tải staging đại diện, P95 từ commit nguồn đến hiển thị mới ≤ 5 giây khi kết nối bình thường; fallback ≤ 35 giây. Đây là mục tiêu cần đo, không phải hiệu năng đã chứng minh.

Postgres Changes có RLS cho row và chi phí kiểm quyền theo subscriber; chọn marker nhỏ để hạn chế dữ liệu và fan-out. Tài liệu tham chiếu: [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) và [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization). Nếu tải thử không đạt, tối ưu truy vấn/nhóm sự kiện trước; cache kết quả hoặc Broadcast là bước mở rộng có đo lường, không triển khai sẵn nhiều cơ chế.

### Những thay đổi phải kích hoạt làm mới

| Nhóm nguồn | Phạm vi cần làm mới |
|---|---|
| `time_entries`, yêu cầu sửa giờ, `attendance_exception_reviews` | Tháng công cũ và mới, người bị ảnh hưởng; bản đầu fan-out tháng để bao phủ công thức tổng hợp. |
| `grading_credits`, `payroll_source_facts`, batch nhập được duyệt/từ chối | Tháng sự kiện cũ/mới; mọi người hưởng quỹ nếu liên quan. |
| `finance_cashflow_records`, giao dịch SePay đã liên kết, `sales_commission_accruals` | Tháng tiền nhận cũ/mới cho thu; tháng event_date của hoa hồng cho lương. |
| Cấu hình vị trí/đơn giá/chính sách/nhiệm vụ, phân công khối, ánh xạ nguồn | Các kỳ mở nằm trong khoảng hiệu lực cũ/mới và tháng hiện tại. |
| CRM nguồn/người phụ trách, enrollment/khối lớp, hồ sơ học viên, coaching | Các kỳ có nguồn phụ thuộc đã tham chiếu; nếu không xác định hẹp thì làm mới mọi kỳ mở + tháng hiện tại. |
| Tạm ứng và dòng thủ công | Kỳ khấu trừ cũ/mới hoặc kỳ dòng lương. |
| Kỳ lương, revision chính thức, phản hồi | Kỳ tương ứng; đổi nhãn và số chốt khi duyệt/mở lại. |
| Quyền và phiên đăng nhập | RPC kiểm lại quyền mỗi lần; hủy subscription, xóa số hiển thị khi bị từ chối. |

Trigger cần dùng giá trị OLD và NEW để bao phủ xóa/đổi ngày/đổi người; khóa marker theo thứ tự ổn định, gộp theo statement/transaction để tránh deadlock và bão sự kiện khi import. Sự kiện tương lai chưa làm tăng lương hiện tại; khi thời gian đến mốc hiệu lực, tải lại theo lịch ngày và truy vấn tính lại.

### Revision nghiệp vụ và giao thức khóa

Tách hai loại revision: `payroll_source_revisions(month, revision)` là version đầu vào kinh tế chuẩn hóa, chỉ nội bộ; `payroll_live_revisions` chỉ thông báo làm mới UI. Duyệt kỳ không dùng revision UI làm điều kiện freshness.

- Thay đổi công, trạng thái xác minh, chính sách, tạm ứng đúng kỳ, khoản thủ công và nguồn thu nhập thật làm tăng source revision. Bảng snapshot, calculation run, workflow/feedback chỉ đổi marker UI.
- Chuyển tạm ứng `approved → deducted` vào chính kỳ đó không đổi đầu vào kinh tế; bộ chuẩn hóa coi hai trạng thái này là cùng một khoản khấu trừ. Đồng bộ fact từ nguồn trực tiếp cũng không tự tạo thêm đầu vào kinh tế. Các thay đổi số tiền, kỳ, người hoặc hủy khoản vẫn làm tăng source revision.
- Bản đầu dùng một advisory transaction mutex cho các thao tác ghi ảnh hưởng đầu vào lương và thao tác tạo/tính/duyệt kỳ. Mọi RPC chính thức lấy mutex **trước** khóa period/row. `BEFORE STATEMENT` trigger trên đầy đủ bảng phụ thuộc lấy cùng mutex trước row locks để bao phủ cả ghi trực tiếp, import và cron; phân loại input/UI và cập nhật revision thực hiện sau đó. Khóa có thứ tự: mutex → period/row → source revision/marker. Các đường ghi mở khóa khác thứ tự phải được chỉnh trước rollout.
- Bộ tính chính thức đồng bộ nguồn cần thiết, đọc `source_revision`, tính và ghi dưới mutex; lưu revision và fingerprint nguồn chuẩn hóa cuối cùng. Không tăng revision kinh tế chỉ vì chính engine ghi đầu ra. Đọc preview thuần dùng MVCC, không giữ mutex ghi.
- Khóa toàn bộ thao tác ghi liên quan là đánh đổi ở bản đầu để tránh deadlock và race; đo độ trễ checkout/import bắt buộc. Nếu vượt ngân sách tải, chưa rollout; thu hẹp khóa theo scope trong bước tối ưu đã có regression concurrency.
- Chỉ có source revision chưa bắt được dữ liệu bắt đầu có hiệu lực khi thời gian trôi qua. Lưu `input_fingerprint` từ nguồn đủ điều kiện, phiên bản chính sách, manual lines, kỳ và chế độ final theo thứ tự ổn định. Trước duyệt, đánh giá lại fingerprint theo cutoff server mới dưới mutex; khác thì yêu cầu tính lại. Không hash riêng giờ đọc vì sẽ làm mọi lần duyệt bị stale.

### Nhất quán và API

Một RPC trả số lương + issue + revision từ cùng snapshot DB; owner thêm số thu trong cùng snapshot đọc. Với approved, số lương lấy từ snapshot bất biến đã chốt, số thu lấy từ sổ hiện tại của tháng đang xem; phân biệt thời điểm ghi nhận lương với thời điểm đọc phản hồi. Dùng query SQL nhất quán (statement snapshot hoặc transaction read-only repeatable-read đã kiểm chứng), không ghép nhiều lần đọc không có bảo đảm. `as_of` chỉ là mốc nghiệp vụ, tự nó không thay thế snapshot isolation.

Response gồm `month`, `asOf`, `calculatedAt`, `revision`, `status`, `completeness`, `latestCompletedWorkAt`, `earningsVnd`, `deductionsVnd`, `advanceDeductionsVnd`, `payableVnd`, `lines`, `issues`, `pendingVerificationCount`; owner thêm tổng nhóm và thu/hoàn. `status` là `estimated/approved`; trạng thái cập nhật `loading/stale/error` nằm riêng. `approved` kèm ID phiên chính thức, `approvedAt`, `payrollCalculatedAt`, `payrollSourceCutoff`; owner có `financeAsOf`. Phần thu/hoàn vào muộn sau duyệt được phản ánh trong số thu của kỳ theo quy tắc ngày nhận, không sửa lương đã chốt; tỷ lệ sẽ đổi và ghi rõ “Lương đã duyệt / thực thu cập nhật”.

Tiền tính trong SQL bằng numeric/bigint, làm tròn theo engine hiện tại; parse an toàn ở biên API, không mất độ chính xác khi chuyển sang JavaScript number. Hạn chế dữ liệu và nội dung công thức trả cho nhân sự; không trả doanh thu/định danh của người khác hoặc tổng quỹ nhạy cảm ngoài quyền được cấp.

Trong Next.js: thêm route handler GET riêng như `/api/payroll/estimate` và `/api/payroll/owner-estimate`, sử dụng server Supabase session của người gọi, `Cache-Control: private, no-store`. Không dùng service-role trên browser, không đưa lương vào cache chia sẻ. Đã đọc guide Route Handlers trong `node_modules/next/dist/docs/`; đọc tiếp guide liên quan khi triển khai.

## 6. Đối soát và duyệt kỳ

1. Bảng lương chính thức giữ workflow draft → review → approved và kiểm quyền/chống tự duyệt hiện hành.
2. Tạm tính tiếp tục cập nhật trong lúc bảng chính thức ở review; không tự sửa snapshot người quản lý đang đối soát.
3. Khi tạo/tính lại bản chính thức, lưu `source_revision` và mốc tính. Khi nguồn thay đổi, báo rõ bản đối soát đã cũ.
4. Trước duyệt, lấy mutex theo giao thức mục 5 rồi khóa kỳ; kiểm tra source revision, input fingerprint theo thời điểm hiện tại, issue blocking và nguồn chờ xác minh liên quan. Nếu còn lệch, yêu cầu xử lý nguồn hoặc quay về draft tính lại. Không tự duyệt số khác với số vừa được xem.
5. Các source writer phải tham gia cùng cơ chế khóa revision trong transaction; kiểm thử hai session cùng ghi/duyệt. Sau commit nguồn mới, nếu kỳ đã approved thì chỉ đánh dấu có thay đổi sau duyệt, không đổi snapshot.
6. Khi tất cả nguồn đủ điều kiện và cùng mốc cuối tháng, engine tạm tính phải bằng chính thức đến từng dòng/tổng. Với nguồn chưa xác minh, giải thích rõ khác biệt; không cam kết hai số bằng nhau khi tập nguồn khác nhau.
7. Approved: lấy số từ snapshot chốt cho cả cá nhân và tổng quan; không cộng số tạm tính vào đó. Mở lại: chuyển về tạm tính theo trạng thái chính thức, bản duyệt cũ chỉ là lịch sử. Giữ dấu vết audit.

Cần bổ sung kiểm tra stale/issue ở bước duyệt trong migration mới; không chỉ khóa nút frontend. Không đóng băng mọi bảng nguồn của hệ thống chỉ vì đang xem lương.

## 7. Kế hoạch triển khai theo giai đoạn

| Giai đoạn | Công việc | Điều kiện hoàn thành |
|---|---|---|
| 1. Khóa hợp đồng dữ liệu | Liệt kê định nghĩa SQL mới nhất; fixture đủ ba vị trí, công chờ xác minh, nguồn nhập/hệ thống, chính sách tháng; mapping đầy đủ phụ thuộc và thời điểm thu/hoàn. | Bộ ví dụ kỳ vọng được review; rõ mọi issue và chênh lệch so với tính chính thức. |
| 2. Tách bộ tính dùng chung | Nguồn chuẩn hóa, bộ tính chỉ đọc, adapter ghi chính thức; giữ side effect trong luồng chính thức. | Regression engine hiện hành pass; đọc dự kiến không ghi bảng nghiệp vụ. |
| 3. API và quyền | RPC self/owner, schema kết quả, route handler, snapshot consistency, marker/RLS/publication. | Test direct RPC, gọi trái quyền, kênh realtime và phiên hết quyền pass. |
| 4. Cập nhật realtime | Trigger đầy đủ, debounce, reconnect, fallback, đổi tháng/ngày, thông báo stale. | Đo đạt mục tiêu cập nhật; import không làm nghẽn chấm công; không mất cập nhật. |
| 5. Tích hợp Bảng lương hiện có | Thẻ tháng hiện tại, breakdown, công gần nhất, nguồn chờ xác minh, lịch sử và mọi trạng thái dữ liệu. | Xem được trước khi tạo kỳ; responsive và keyboard dùng được. |
| 6. Tích hợp Tổng quan lương hiện có | KPI đúng định nghĩa, bảng nhóm/nhân sự, thực thu sau hoàn, bộ lọc có diễn giải. | Tổng bằng chi tiết; lọc không làm sai mẫu số; không gán số thiếu thành 0. |
| 7. Khóa duyệt và phát hành | Check source_revision khi duyệt; test race; đối chiếu staging; bật theo cờ tính năng. | Chủ trung tâm nghiệm thu mẫu; giữ đường quay về UI cũ và workflow chính thức. |

Đây là thay đổi quy mô lớn vì phải tách engine có nhiều side effect, không phải chỉ thêm thẻ KPI. Không chốt số ngày công khi chưa chạy fixture và đo truy vấn. Mỗi giai đoạn phải có bằng chứng trước khi chuyển bước phụ thuộc.

### Phạm vi file dự kiến

- Migrations mới: projection engine, RPC/quyền, revision triggers/publication, stale approval guard; không sửa lại migration đã áp dụng.
- Thư mục nội bộ `src/features/payroll/estimate/` (không phải module giao diện mới): `data.ts`, `read-models.ts`, hook cập nhật, summary/breakdown/data-quality components.
- `src/app/api/payroll/estimate/route.ts`, `src/app/api/payroll/owner-estimate/route.ts`.
- Chỉ sửa hai trang nghiệp vụ hiện có `/payroll`, `/payroll/dashboard` và feature page tương ứng; tái sử dụng formatter/table/design tokens. Không thêm page route, sidebar item hoặc module nghiệp vụ. Các API endpoint ở trên chỉ phục vụ dữ liệu cho hai trang này.
- Regenerate `src/types/database.generated.ts` từ DB local đã áp dụng migrations, không lấy linked production để sinh schema thử nghiệm.
- Tests mới ở `supabase/tests`, `tests/unit`, `tests/components`, E2E theo cấu hình repository.

## 8. Ma trận kiểm thử và nghiệm thu

| Nhóm | Ca bắt buộc |
|---|---|
| Tích hợp giao diện | Nhân sự thấy phần mới trong Bảng lương; owner thấy trong Tổng quan lương. Không có module/menu/page mới; chức năng hiện có vẫn truy cập được, không lặp KPI hoặc lịch sử. |
| Ca và thời gian | Ca mở chưa tính; checkout và auto-end; pending/approved/rejected exception; sửa giờ pending/approved; online/offline; đổi tháng GMT+7, ca qua đêm, dữ liệu tương lai. |
| Công thức | Ba vị trí; đơn giá đổi giữa tháng; chính sách chưa hiệu lực; quỹ chia phần dư; người khác thêm bài làm số giảm; ngưỡng hoa hồng; sàn/bù trừ; nhiệm vụ theo tổng trung tâm. |
| Nguồn | Chưa tạo kỳ; chưa sync SePay; nhập trùng công/bài/đơn; công bị từ chối không được Excel thay thế; sửa/hủy nguồn; đổi người/khối/nguồn; manual carry chỉ một lần. |
| Tạm ứng | Approved đúng kỳ; deducted cùng kỳ; kỳ khác; hủy; lặp lại đọc không đổi status/ghi audit; tổng lương âm sau khấu trừ. |
| Thu/hoàn | Thu học phí vs thu khác; đóng trước; hoàn khoản thu tháng trước; thu/hoàn sau duyệt làm đổi số thu và tỷ lệ nhưng không sửa lương, hiện hai mốc; thu/hoàn sát 00:00; giao dịch đối soát muộn; thực thu bằng 0/âm; không nhân đôi ledger và SePay. |
| Quyền | Nhân sự chỉ thấy mình; đoán ID/RPC bị chặn; owner có/thiếu quyền tài chính; người khác không xem owner marker; revoke giữa phiên; kiểm raw JSON và subscription không lộ lương. |
| Realtime | Subscribe race; mất mạng rồi reconnect; event trùng/đến muộn; nhiều tab; đổi filter lúc request đang chạy; import hàng loạt; update/delete làm mới tháng OLD và NEW; qua ngày không có event. |
| Duyệt | Nguồn đổi trong review; tính lại → duyệt không có sửa bên ngoài phải thành công; race nguồn với approve; thời gian sang mốc chính sách mới dù revision chưa đổi; pending exception ngăn chốt thiếu; approved bất biến; mở lại → tính lại → duyệt; self-approval vẫn bị chặn. |
| Chất lượng dữ liệu | Thiếu đơn giá/position/mapping; partial tổng có chú thích; lỗi nguồn trả error không 0; người nghỉ nhưng có công tháng vẫn xuất hiện theo chính sách hiện hành. |
| Độ đúng | Tổng nhóm = tổng nhân sự = tổng dòng ở cùng snapshot; cuối tháng nguồn hợp lệ: projection = chính thức từng VND; không chênh do quyền lọc mất mẫu số quỹ. |

Chạy test DB trên local/staging phù hợp, test unit/component liên quan, typecheck, lint, build và E2E hai vai trò. Test tải đại diện đề xuất 100 nhân sự, 20 phiên xem đồng thời, 10.000 nguồn trong tháng; sau khi biết quy mô thực dùng mức lớn hơn nếu cần. Đo P95 RPC mục tiêu ≤ 2 giây và commit→UI ≤ 5 giây, cùng độ trễ checkout/import so với baseline.

Nghiệm thu nghiệp vụ: chọn một tháng đã chốt làm bộ đối chiếu và một tháng đang chạy; ít nhất một nhân sự mỗi vị trí có cấu hình. So sánh bằng bảng giải thích nguồn, không chỉ so một con số tổng.

## 9. Triển khai, rủi ro và giới hạn

- Triển khai staging bằng migration bổ sung; chạy shadow comparison cùng nguồn/cutoff, chưa đổi số chính thức. Feature flag UI mặc định tắt đến khi đạt regression và kiểm quyền.
- Bật thử cho owner và nhóm nhân sự nghiệm thu, sau đó toàn bộ vị trí đã cấu hình. Không cần import lại lương lịch sử đã duyệt.
- Rollback UI bằng cờ; không xóa các revision/bảng lương đã chốt. Chỉ tắt trigger realtime khi đồng thời tắt chức năng live; cơ chế revision bảo vệ duyệt vẫn phải hoạt động. Nếu refactor engine có lỗi, dùng migration sửa tiến tới/khôi phục adapter được chuẩn bị và test trước.
- Chưa xác minh production có publication/quyền/grants đúng như local. Đây là bước preflight trước rollout.
- “Realtime” bắt đầu khi dữ liệu được ghi thành công vào hệ thống; không thể phản ánh công chưa chấm hoặc thu chưa đối soát.
- Các vị trí chưa có công thức không thể tự sinh lương. Danh sách cấu hình thiếu phải hiện cho owner, không phát minh chính sách cho vai trò đăng nhập.
- Thu thủ công/hoàn phí hiện chưa thấy trường thời điểm thực nhận riêng trong schema khảo sát; hiển thị rõ cơ sở thời điểm ghi sổ, không hồi tố tùy ý.
- Tập nguồn chờ xác minh được đưa vào tạm tính nhưng phải giải quyết trước khi duyệt; không thay tên chúng thành lương đã duyệt.

## 10. Việc chuẩn bị để nghiệm thu

Chủ trung tâm chọn một nhân sự đại diện mỗi vị trí, một tháng đã chốt và một tháng hiện tại để kiểm tra công thức và các ghi chú. Không cần gửi số liệu nhạy cảm vào tài liệu này; dùng dữ liệu trong môi trường được phép khi triển khai.

Điều anh nhấn mạnh là “Lương tạm tính - Lương đã duyệt” và việc “đối chiếu với doanh thu thực tế”. Vì vậy trạng thái duyệt, phạm vi thời gian và nguồn số tiền phải rõ hơn việc chỉ làm số nhảy tự động.

## 11. Ghi nhận để lần triển khai sau không lặp lại khảo sát

- Định nghĩa engine mới nhất nằm ở migration endpoint verification 15/09, không phải bản assignment/source 28/08.
- Engine ghi `salary_advances.status=deducted` khi tạo calculation run; tuyệt đối không dùng nó như endpoint xem trước.
- Refund ledger dùng category `refund`; lọc mọi dòng theo category `tuition_fee` sẽ bỏ mất tiền hoàn.
- Quỹ chấm bài và nhiệm vụ theo tổng trung tâm tạo phụ thuộc xuyên nhân sự; lọc đầu vào theo auth.uid làm sai phép tính.

## GSTACK REVIEW REPORT

Loại: office-hours design/spec review, không phải plan-eng-review.
Đã qua 2 vòng phản biện độc lập. Vòng 1: 8/10, phát hiện 2 vấn đề về source revision và mốc so sánh thu sau duyệt. Đã sửa cả 2, bổ sung fingerprint theo thời gian và giao thức khóa. Vòng 2: PASS, 9/10, không còn vấn đề chặn ở mức thiết kế. Chưa thay thế plan-eng-review hoặc kiểm thử thực thi; độ bao phủ writer, thứ tự khóa và độ trễ checkout/import là điều kiện rollout bắt buộc.
Chưa sửa source ứng dụng, chưa chạy test triển khai và chưa deploy.

Cập nhật sau review: theo yêu cầu chủ trung tâm, xác định rõ tích hợp vào hai module hiện có; không tạo module/menu/trang nghiệp vụ mới. Điều chỉnh phạm vi UI và tiêu chí nghiệm thu, không đổi kiến trúc tính lương.
