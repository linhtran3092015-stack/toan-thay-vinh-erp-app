# ERP Toán Thầy Vinh · Thiết kế theo Stumana

Ngày khảo sát: 09/09/2026. Trạng thái: đã chọn hướng **đỏ ấm, bo mềm, sát Stumana hơn**; bản bố cục và hành vi chi tiết là đề xuất để duyệt. Chưa triển khai vào ứng dụng.

## 1. Ý tưởng chủ đạo

**Mở ERP lên là biết ngay hôm nay cần làm gì.** Giao diện thân thiện với giáo viên, nhưng đủ rõ ràng cho nhân viên xử lý học phí và hồ sơ. Dùng đỏ ấm làm màu hành động, nền trắng ấm, bề mặt pastel, chữ Be Vietnam Pro, bo góc theo cấp độ. Màn hình Hôm nay ưu tiên buổi học và công việc, màn hình Điều hành giữ khả năng xem tài chính và báo cáo theo tháng.

Người dùng đã trực tiếp chọn hướng đỏ ấm thay cho đề xuất navy ban đầu. Đây là yêu cầu thay đổi thiết kế; khi triển khai cần cập nhật DESIGN.md nhất quán. Không đọc các giá trị navy được ghi là “approved” trong DESIGN.md cũ như lý do phủ nhận lựa chọn mới này. Quy tắc phân quyền, đường dẫn, nghiệp vụ và khả năng tiếp cận trong tài liệu cũ vẫn áp dụng, trừ các điểm được thay đổi cụ thể ở đây.

## 2. Nguồn và phạm vi khảo sát

Đọc trực tiếp phiên Chrome đã đăng nhập của người dùng:

- https://stumana.com/dashboard: bố cục, checklist bắt đầu, buổi dạy kế tiếp, lịch hôm nay, tổng quan, trạng thái rỗng và đang tải.
- https://stumana.com/students: tìm kiếm, thêm, nhập, menu xuất file và trạng thái không có học viên.
- Biểu mẫu “Học sinh mới” mở dạng modal từ trang học sinh: họ tên bắt buộc; ngày sinh, điện thoại, email; bật/tắt phần phụ huynh và ghi danh; Hủy, Lưu và thêm tiếp, Lưu Học sinh.
- Menu hồ sơ: hồ sơ cá nhân, trung tâm, đăng xuất. Menu xuất: CSV và Excel.
- https://ttp-erp-orcin.vercel.app/: đối chiếu Dashboard và điều hướng ERP hiện tại.
- Mã nguồn địa phương: DESIGN.md, src/config/navigation.ts, src/app/(app)/page.tsx, src/features/dashboard/{dashboard-page.tsx,read-models.ts}, package.json.

Không gửi biểu mẫu, không tạo học viên, không thay đổi tài khoản hoặc dữ liệu trên hai website. Đã trả tab Stumana về dashboard. Các giá trị trong bản mẫu là dữ liệu giả.

### Những gì thực sự quan sát được

| Thành phần | Quan sát | Áp dụng ERP |
|---|---|---|
| Màu sắc | Tiêu đề Học sinh có computed color rgb(218,37,29), tương đương #DA251D. Sidebar/header hiện có chủ đề lễ hội đỏ nhạt. | Đề xuất primary #B83C30 để dịu hơn trong phiên làm việc dài. Đây là màu đề xuất, không phải màu CSS trích xuất. |
| Phông | Computed style của tiêu đề Học sinh: ui-sans-serif, system-ui, sans-serif…, 30px, 700. | Giữ Be Vietnam Pro của ERP cho dấu tiếng Việt và tính nhất quán. Không khẳng định Stumana đang dùng Google Sans/Quicksand. |
| Menu | Sidebar phân nhóm, icon nét mảnh; mục đang chọn có nền đỏ nhạt và chữ đỏ trong phiên khảo sát. | Menu chọn dùng nền đỏ nhạt, chữ đỏ đậm, không dùng đỏ đặc cho mọi mục. |
| Bố cục | Thanh bên trái, thanh đầu trang, vùng chính lớn và cột phụ hẹp. Checklist thiết lập chiếm đầu màn hình. | Việc trong ngày ở vùng chính; lịch và tóm tắt ở cột phụ. Checklist thiết lập chỉ xuất hiện khi trung tâm chưa hoàn tất thiết lập. |
| Nút | Nút chính nền đỏ chữ trắng; hành động phụ dạng chữ; có cả nút bo vừa và dạng pill. | Một hành động chính trong từng vùng làm việc. Dùng pill cho buổi dạy nổi bật, không dùng cho mọi nút trong bảng. |
| Menu xổ | Hồ sơ và Xuất file đã mở, có nội dung như mô tả ở trên. | Dùng menu ngắn với nhãn rõ, bàn phím và Escape. |
| Form | Modal trắng, nền sau tối, nhóm trường hai cột trên desktop; thông tin phụ huynh mở theo switch. | Áp dụng phân nhóm, nhãn và tiết lộ trường phụ dần; giữ validation và route tạo học viên hiện hữu. |
| Trạng thái | Có nội dung đang tải, chưa có dữ liệu, và không có việc cần xử lý. | Phân biệt loading/empty/error/hidden; lỗi nguồn dữ liệu không được biến thành “Mọi việc ổn”. |

### Giới hạn quan sát

Danh sách học sinh Stumana rỗng trong phiên này, nên chưa kiểm chứng bảng có dữ liệu, phân trang và menu từng dòng của họ. Chưa kiểm tra các giao dịch lưu, backend, phân quyền, mobile hoặc tất cả trang Stumana. Chưa xác minh hover, thời lượng animation và toàn bộ token bằng CSS. Vận hành được đọc là một liên kết; chưa có bằng chứng đó là accordion. Chủ đề lễ hội quan sát được không đủ để kết luận đó là giao diện mặc định quanh năm.

Tài liệu sẵn có `docs/redesign/STUMANA_ANALYSIS_AND_ERP_DESIGN_SPEC.md` có nhiều khẳng định font, menu và màu chưa được kiểm chứng; giữ nguyên tệp đó để bảo toàn công việc có sẵn. **Dùng bản bàn giao này làm nguồn kiểm chứng và hướng triển khai mới**, không kết hợp cơ học các khẳng định xung đột.

## 3. Hệ thống thiết kế đề xuất

| Vai trò | Giá trị |
|---|---|
| Nút chính / liên kết / active text | #B83C30 |
| Hover chính | #9F3027 |
| Đỏ gốc tham chiếu Stumana | #DA251D; tùy chọn nhận diện mạnh hơn, chưa chọn làm nền mọi nút |
| Nền ứng dụng | #FAF9F6 |
| Bề mặt | #FFFFFF |
| Bề mặt chọn / thẻ buổi kế tiếp | #FFF0EC |
| Chữ chính | #202B40 |
| Chữ phụ | #647083 |
| Viền | #E5E7EB |
| Thành công | chữ #16794C / nền #EAF8F1 |
| Cảnh báo | chữ #945009 / nền #FFF3DD |
| Lỗi / nguy hiểm | chữ #BD3049 / nền #FFF0F3 |

Màu nhận diện đỏ và màu lỗi cần khác nhau bằng nhãn, biểu tượng, ngữ cảnh và cách trình bày; không chỉ dựa vào sắc độ. Không dùng màu primary cho thao tác xóa hoặc khóa.

- Font duy nhất: Be Vietnam Pro, 400/500/600/700; giữ next/font/google theo cơ chế đã có, ưu tiên tải cục bộ khi build. Số tiền/số buổi dùng tabular-nums.
- Tiêu đề trang 24–28px/700; section 17–18px/600; nội dung và bảng 14px; nhãn 13px; chú thích 12px. Không thu nhỏ dữ liệu để nhét cột.
- Nhịp khoảng cách 4px: 8, 12, 16, 20, 24, 32. Page padding 24–32px desktop; 16px mobile.
- Bo góc: badge 5–6px, control 8–10px, bảng 10–12px, panel 16–18px, thẻ buổi kế tiếp 24px. Không áp 24px lên mọi thành phần.
- Nút 40px desktop, tối thiểu 44px mobile; hàng bảng 48–56px. Border 1px; bóng đổ dành cho menu và modal.
- Icon production: lucide-react, nét nhất quán 1.8, 18–20px. Icon bản mẫu hiện là ký hiệu bố cục giản lược, phải thay icon đúng nghiệp vụ khi code.
- Chuyển trạng thái 150–200ms; ưu tiên màu, opacity; giảm chuyển động theo prefers-reduced-motion.
- Dark mode: bảo toàn khả năng hiện có, xây palette riêng có đủ tương phản; bản mẫu cho xem sáng/tối nhưng chưa phải token dark đã nghiệm thu.

### Điểm giữ quen thuộc và điểm thay đổi

Giữ bảng, bộ lọc, một CTA chính và các trạng thái rõ. Thay đổi thứ nhất: sidebar sáng và đỏ mềm thay cho mảng navy lớn, giúp nhẹ thị giác nhưng giảm độ tương phản thương hiệu. Thay đổi thứ hai: Hôm nay ưu tiên tác vụ thay vì biểu đồ dày; giảm thao tác cho giáo viên nhưng chủ trung tâm cần nút chuyển rõ sang Điều hành. Họa tiết lễ hội và trợ lý mascot chưa đưa vào phạm vi đầu tiên vì gây nhiễu trên bảng dài và cần tính năng thật phía sau.

## 4. Kiến trúc điều hướng

Bản mẫu trình bày các đường tắt để duyệt màn hình, **không đại diện toàn bộ cây điều hướng production**. Production giữ sáu domain và toàn bộ route trong `src/config/navigation.ts`: Tổng quan, Học vụ, Tuyển sinh, Tài chính, Nhân sự, Quản trị.

- Desktop: sidebar 240px nền trắng ấm; hàng 44px; mục active nền đỏ nhạt, chữ đỏ đậm và chỉ báo trái. Header 64px, tiêu đề ngữ cảnh, thông báo, hồ sơ, thao tác chấm công đang có.
- Giữ dải module ngữ cảnh của kiến trúc Direction C đã triển khai. Đây là navigation link, không giả làm tab nội dung.
- Tablet: rail 72px, tooltip có thể đọc bằng bàn phím. Mobile: drawer, chọn module theo domain, bề mặt một cột; bảng có vùng cuộn ngang nội bộ.
- Menu xổ dùng cho tiện ích hồ sơ, xuất dữ liệu, bộ lọc phức tạp và chọn module mobile. Không chuyển toàn bộ sidebar thành accordion chỉ vì tài liệu trước nói Stumana có accordion.
- Không thêm menu AI, Thư viện, Cộng đồng, Zalo chat hoặc đổi cơ sở nếu ERP chưa có chức năng và quyền tương ứng.
- Không thêm ô tìm kiếm toàn hệ thống chỉ để trang trí. Tìm kiếm đặt theo từng danh sách.
- Domain không có module được phép xem phải ẩn. Giữ nguyên href, permission code, longest-match routing và đường dẫn con.

## 5. Ba màn hình thiết kế chính

### A. Hôm nay (đề xuất view mới trong trang /)

Header lời chào ngắn, ngày Việt Nam và tóm tắt khối lượng việc. Grid desktop: phần chính co giãn + cột lịch khoảng 310–340px. Thứ tự: buổi dạy kế tiếp → việc cần xử lý → tiến độ vận hành. Cột phụ: lịch hôm nay → tổng quan tháng.

Buổi kế tiếp phải thuộc tập buổi người dùng được xem; ưu tiên đang diễn ra, sau đó buổi sắp tới gần nhất. Tính ngày bằng Asia/Ho_Chi_Minh; không đưa buổi hủy vào. CTA “Mở buổi học” đến `/sessions/[sessionId]`; không tự điểm danh. Nếu không có buổi: thông điệp ngắn và liên kết tới `/sessions` khi có quyền. Không tạo thời gian đếm ngược giả; nếu bổ sung countdown cần mốc thời gian chuẩn và xử lý qua nửa đêm.

“Cần xử lý” dùng AttentionItem hiện có khi phù hợp; thông tin mới như sắp hết buổi cần truy vấn và định nghĩa riêng. Ngưỡng sắp hết buổi là quy tắc nghiệp vụ phải lấy từ cấu hình hoặc thống nhất trước khi thêm, không hardcode vì số trong mockup. Mỗi dòng có nguyên nhân, số lượng và route đúng; không gộp lỗi tải thành “0”.

Giữ Dashboard điều hành đang có qua view “Điều hành” và bộ chọn tháng, không xóa biểu đồ tài chính vì đổi bố cục. Quyền quyết định nội dung, không suy đoán từ chức danh. Đề xuất lưu view vào URL; cần xác nhận tham số và default trong bước triển khai.

### B. Học viên (/students)

Tiêu đề, số lượng kết quả, CTA Thêm học viên. Filter: tìm theo trường đang hỗ trợ, trạng thái/lớp theo data thật; giữ các bộ lọc khác hiện có trong vùng mở rộng. Bảng: tên + mã, lớp, trạng thái, số buổi và thao tác. Nếu số buổi thuộc từng ghi danh thì hiển thị theo lớp hoặc nói rõ tổng; không tạo một số tổng gây hiểu sai.

“Xem hồ sơ” mở route hiện hữu; form tạo tiếp tục dùng `/students/new`. Có thể dùng modal có route trong phase sau, nhưng đợt đầu ưu tiên trang form hiện có và styling để không làm mất deep link/back navigation. Có nhãn bắt buộc và lỗi cạnh trường, lỗi tổng ở đầu, trạng thái đang lưu, chống gửi lặp, giữ dữ liệu khi lỗi.

Bản mẫu hỗ trợ tìm kiếm, lọc trạng thái, reset và thêm học viên giả trong bộ nhớ. Đây không phải schema form đầy đủ của ERP.

### C. Học phí & công nợ (/finance)

Tổng phải thu / đã thu / còn phải thu có định nghĩa, cùng kỳ và cùng phạm vi. Danh sách không trộn số dư buổi với công nợ tiền. Trạng thái bằng chữ và màu; số tiền căn phải, đầy đủ đơn vị khi xem chi tiết.

CTA yêu cầu thanh toán dùng `/finance/payment-requests/new` theo quyền. Thông tin SePay dùng chức năng hiện có; không tự đối soát, đánh dấu đã thanh toán hoặc gửi nhắc học phí khi chỉ mở giao diện. Bộ lọc trạng thái trong mock chỉ là minh họa; khi code phải giữ ý nghĩa trạng thái thật.

## 6. Ánh xạ chức năng và phần cần bổ sung

| Hành vi | Phân loại | Điểm triển khai |
|---|---|---|
| Màu, phông, radius, bảng, modal, menu | Đổi giao diện | globals.css và shared UI đang có; dùng token semantic |
| Sidebar sáng đỏ + module strip | Đổi giao diện | components/layout/sidebar.tsx, topbar.tsx, module-navigation.tsx |
| Bảng và tạo hồ sơ học viên | Có route hiện tại | /students, /students/new, /students/[studentId] |
| Dashboard KPI, attention, biểu đồ | Có read model hiện tại | features/dashboard/data.ts, read-models.ts, dashboard-page.tsx |
| Buổi kế tiếp / lịch trong ngày trên dashboard | Bổ sung read model/dashboard view | Khảo sát dữ liệu sessions và quyền trước khi viết query; chưa xác nhận API sẵn dùng |
| Tiến độ cập nhật hồ sơ / “sắp hết buổi” | Cần định nghĩa và dữ liệu | Chỉ đưa vào khi quy tắc rõ; không lấy số mẫu làm dữ liệu thật |
| Điểm danh, khóa buổi | Luồng có sẵn | /sessions/[sessionId]; giữ guard và hành vi nghiệp vụ |
| Tạo yêu cầu thanh toán | Luồng có sẵn | /finance/payment-requests/new |
| CRM | Có route và nghiệp vụ hiện tại | /crm, /crm/new, /crm/[caseId] |
| Hội thoại Zalo 3 cột | Tích hợp mới, chưa thuộc scope | Không suy ra ERP có tích hợp từ việc người dùng mở một website ZaloCRM khác |
| Nhân sự / lương / tạm ứng | Đổi giao diện sau pilot | Giữ toàn bộ route và quyền trong navigation.ts |
| AI trợ lý, thư viện, cộng đồng | Ngoài phạm vi hiện tại | Không tạo nút rỗng |

## 7. Kế hoạch triển khai cho Codex

1. **Khóa tài liệu thiết kế:** đọc AGENTS.md, DESIGN.md và bản này. Cập nhật palette, shape, sidebar của DESIGN.md theo hướng đỏ ấm đã chọn; ghi rõ những phần vẫn là đề xuất. Bảo toàn tệp đang có thay đổi chưa commit của người dùng.
2. **Nền tảng và shell:** đổi semantic tokens, shared controls, sidebar/header/module navigation. Không đổi rule phân quyền hoặc URL. Kiểm tra tương phản và sáng/tối.
3. **Pilot Học viên:** header/filter/table/form/detail dùng token mới. Chạy kiểm tra lọc, back, trang con, trạng thái rỗng/lỗi và quyền.
4. **Dashboard Hôm nay:** giữ Điều hành hiện tại; bổ sung read model có quyền cho lịch và buổi kế tiếp. Xác minh nguồn dữ liệu và quy tắc trước khi triển khai các cảnh báo mới. Giữ chọn tháng cho Điều hành.
5. **Học phí:** cập nhật bảng, trạng thái, chi tiết và tạo yêu cầu; kiểm tra không thay đổi logic tiền, đối soát hoặc trạng thái thanh toán.
6. **Mở rộng:** lớp học, buổi học, kết quả, coaching, CRM, nhân sự, nhập dữ liệu, cài đặt. Dùng mẫu đã kiểm tra ở pilot, không tạo một bộ UI khác cho từng module.

Mỗi đợt là một thay đổi có thể review và quay lại. Không nâng cấp framework, tự deploy, sửa database hoặc tích hợp Zalo trong đợt đổi theme.

### Quy tắc kỹ thuật bắt buộc

Next.js đang cài 16.2.12; trước khi viết code đọc guide tương ứng ở `node_modules/next/dist/docs/` theo AGENTS.md. Route dashboard đúng là `src/app/(app)/page.tsx`, không phải `src/app/page.tsx`.

Giữ `DashboardSectionState` hidden/error/ready; phần bổ sung có loading ở cấp render phù hợp. Server kiểm tra quyền dữ liệu và action; việc ẩn nút không thay authorization. Tận dụng các shared component hiện có trước khi thêm abstraction mới. Không gắn dữ liệu mô phỏng vào production hoặc gọi các action tài chính để minh họa UI.

### Tiêu chí nghiệm thu

- Kiểm tra ở 1440, 1024, 768, 390px: chữ không bị cắt; trang không tràn ngang; bảng có vùng cuộn riêng; hành động chính dễ thấy.
- Điều hướng đủ sáu domain và toàn bộ module được phép; route con đúng active; mobile selector hoạt động; không xuất hiện module không được phép.
- Menu dùng được với bàn phím, Escape đóng, focus quay về trigger; modal giữ focus, đóng hợp lý, không mất dữ liệu vô tình.
- Tiếng Việt đủ dấu, số tabular, số tiền không bị viết tắt ở nơi cần kiểm tra chính xác. Tương phản văn bản thường ≥4.5:1; focus nhìn rõ.
- Loading, không có bản ghi, không khớp bộ lọc, lỗi dữ liệu, không có quyền đều khác nhau.
- Hôm nay: thử không có buổi, buổi đang học, buổi hủy, nhiều buổi cùng giờ, qua ngày, thiếu quyền và lỗi tải.
- Không nhầm 0 với lỗi/không có quyền; không hiển thị “ổn định” khi nguồn cảnh báo lỗi.
- Lọc/reset/back giữ hành vi hiện có. Lưu form không gửi lặp và không mất nội dung khi server báo lỗi.
- Kiểm tra đúng phạm vi: npm run typecheck, npm run lint, test unit/component liên quan; e2e các luồng chạm tới trên môi trường test với dữ liệu thử được phép. Không tạo giao dịch thật để test theme.

## 8. Prompt bàn giao

> Đọc AGENTS.md, DESIGN.md và docs/redesign/stumana-2026-09-09/HANDOFF.md. Người dùng đã chọn hướng đỏ ấm, bo mềm, sát Stumana. Dùng preview.html làm mẫu hình thức và tương tác, không sao chép dữ liệu giả vào ERP. Bắt đầu bằng đợt 1–3: cập nhật tài liệu thiết kế, semantic tokens, shell và pilot Học viên; giữ các đường dẫn, phân quyền, validation và nghiệp vụ hiện có. Trước khi viết Next.js đọc tài liệu đúng phiên bản trong node_modules/next/dist/docs/. Không triển khai Zalo/AI, không đổi schema, không deploy. Sau kiểm tra, báo thay đổi, kết quả test và phần còn lại trước khi mở rộng dashboard và tài chính.

## 9. Ghi nhớ cho lần tiếp theo

Bản nháp Stumana cũ khẳng định nhiều font và accordion nhưng phiên trực tiếp chưa chứng minh; phải phân biệt token đo được và đề xuất. ERP hiện có sáu domain, module strip và dashboard theo quyền; thay theme không được xóa kiến trúc hoặc dữ liệu đó. Người dùng chọn đỏ ấm, bo mềm ngày 09/09/2026.

## 10. Tệp bàn giao và kiểm tra bản mẫu

- Bản mẫu lưu lâu dài: `/Users/linhtran/.gstack/projects/linhtran3092015-stack-toan-thay-vinh-erp-app/designs/stumana-2026-09-09/preview.html`.
- Bản đang mở trên máy: http://127.0.0.1:8766/erp-stumana-preview.html (cần máy chủ xem mẫu đang chạy). Nếu máy chủ dừng, mở trực tiếp tệp HTML lưu lâu dài bằng trình duyệt.
- Tệp HTML độc lập, dùng Google Fonts cho Be Vietnam Pro; khi không có mạng sẽ dùng sans-serif dự phòng.
- Đã xem hình thức desktop và 390px; kiểm tra mở menu mobile, chuyển màn hình, lọc Bảo lưu, tìm kiếm không có kết quả, reset, thêm bản ghi trong bộ nhớ và tab Chưa thanh toán. Đã tải lại để xóa dữ liệu kiểm thử.
- Chưa thực hiện kiểm tra toàn diện khả năng tiếp cận, mọi độ rộng, mọi control hoặc nghiệp vụ backend. Bản mẫu không phải ứng dụng đã triển khai; các nút chi tiết ngoài luồng minh họa chỉ giải thích đích đến.
- Hướng đỏ ấm đã được chọn; bố cục chi tiết, ngưỡng nghiệp vụ và phạm vi view Hôm nay vẫn cần review trước khi code phần mở rộng. Không tạo task Codex mới trong phiên này.

**GSTACK STATUS: DONE_WITH_CONCERNS.** Đã hoàn thành khảo sát có nguồn, đề xuất, bản mẫu và bàn giao. Giới hạn: một số trang nguồn chưa có dữ liệu; bản mẫu chỉ mô phỏng; sản phẩm thật chưa đổi giao diện.

## Bổ sung sau vòng kiểm tra module

Ưu tiên đọc [MODULE_FIT_REVIEW.md](MODULE_FIT_REVIEW.md) cho phạm vi và thiết kế module mới nhất. Bản mẫu đã đổi từ đường tắt minh họa sang sáu domain/28 mục, bổ sung dải module, các trang đối chiếu phạm vi và tiện ích header. Hôm nay là đề xuất phụ trong Tổng quan. Học viên có đủ sáu nhóm filter hiện tại; form vẫn chỉ minh họa. Trang tài chính đã thay chỉ số và cột bảng theo `src/app/(app)/finance/page.tsx`; không dùng bảng hóa đơn Stumana làm cấu trúc gốc ERP.
