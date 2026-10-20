# Form nộp bài cuối buổi (Apps Script) cho ERP, Giai đoạn 1

Bản sửa của form "Nộp bài tốt nghiệp - Thầy Vinh". Chủ trung tâm tự dán vào dự án Apps Script đang chạy. Kế hoạch: AI_GRADING_INTEGRATION_PLAN_2026-10-16, mục 4.2 và 4.3.

## Thay đổi so với bản cũ

| | Bản cũ | Bản này |
|---|---|---|
| Danh sách tên | Tab `DanhSachHocSinh`, gửi cả danh sách cho mọi người mở form | Lấy từ ERP theo năm sinh: học sinh có ghi danh còn hiệu lực, sắp theo tên. Lưu đệm 10 phút. ERP lỗi thì dùng lại tab `DanhSachHocSinh` |
| Ô năm sinh | Cố định 2008–2019 | Lấy các năm có học sinh đang học từ ERP (lỗi thì vẫn 2008–2019) |
| Trùng họ tên | Không phân biệt được | Hiện kèm 4 số cuối SĐT phụ huynh chính, ví dụ "Nguyễn Minh Anh (PH ***4828)" |
| Câu 5 "Hôm nay con học buổi" | 5 lựa chọn cố định + "Khác" | Buổi học hôm nay của em theo lịch ERP (1 buổi thì chọn sẵn). Không có buổi nào hoặc không có tên thì vẫn là các lựa chọn cũ |
| Chọn "Khác" | Cột J (câu 5) và cột N (câu 6) ghi `Other`, mất chữ học sinh gõ | Cột J và cột N ghi `Khác: <chữ học sinh gõ>` |
| Gửi ERP | Không | Ghi Sheet xong thì gửi một bản sang ERP. Gửi lỗi thì học sinh vẫn nộp thành công, trigger 10 phút/lần gửi lại |

Tab `Data`, cột A–P giữ nguyên ý nghĩa. Lần nộp đầu tiên tự thêm 5 cột vào sau cột cuối cùng: `Mã HS ERP`, `Buổi học ERP`, `Mã bài ERP`, `Giờ nộp ERP`, `Đã gửi ERP`. Nếu có công thức hay tab khác đọc cả vùng `Data!A:Z`, kiểm tra lại sau lần nộp đầu tiên.

Câu 6 (học thử tiếng Anh) và câu 7 (SĐT phụ huynh) chỉ ghi vào Sheet, **không** gửi sang ERP.

## Cài đặt

1. **Tạo khóa bí mật** dài ít nhất 32 ký tự, ví dụ chạy `openssl rand -hex 32` trên máy. Không gửi khóa qua chat.
2. **Vercel:** Project `ttp-erp` → Settings → Environment Variables → thêm `GRADING_FORM_SECRET` = khóa trên (Production), rồi Redeploy.
3. **Apps Script:** mở dự án của form → Project Settings → Script Properties, thêm:
   - `ERP_BASE_URL` = địa chỉ ERP, ví dụ `https://ttp-erp-orcin.vercel.app` (không có `/` ở cuối)
   - `ERP_FORM_SECRET` = cùng khóa ở bước 1
4. **Dán code:** thay toàn bộ `Code.gs` và `FormHocSinh.html` bằng hai file trong thư mục này.
   Nếu dự án có hiện file `appsscript.json` và trong đó có mục `oauthScopes`, mục này phải có đủ 4 quyền (giữ các quyền đang có, chỉ thêm quyền còn thiếu): `https://www.googleapis.com/auth/spreadsheets`, `https://www.googleapis.com/auth/drive`, `https://www.googleapis.com/auth/script.external_request` (gọi ERP) và `https://www.googleapis.com/auth/script.scriptapp` (tạo trigger gửi bù). Không có mục `oauthScopes` thì Apps Script tự hỏi quyền, không cần làm gì.
5. **Kiểm tra:** chọn hàm `testErpConnection` → Run → xem Execution log:
   - `Danh sách năm sinh: HTTP 200 → [...]`: ERP trả danh sách.
   - `Webhook: HTTP 400 → chữ ký đúng`: khóa khớp (400 vì bài thử cố tình thiếu dữ liệu, không tạo bài nào).
   - `HTTP 401`: sai khóa hoặc đồng hồ lệch quá 5 phút. `HTTP 503`: Vercel chưa có `GRADING_FORM_SECRET`.
   - `HTTP 0 → <lý do>`: Apps Script không gọi được ERP. Lý do có "permission" thì `appsscript.json` đang khai `oauthScopes` mà thiếu `https://www.googleapis.com/auth/script.external_request`: thêm vào rồi chạy lại, bấm Cho phép. Lý do kiểu "DNS", "Address unavailable", "Invalid argument" thì xem lại `ERP_BASE_URL` (dòng `Địa chỉ ERP:` in ngay trên).
6. **Bật gửi bù:** chọn hàm `installResendTrigger` → Run một lần (cho phép quyền khi được hỏi). Kiểm tra ở mục Triggers: `resendPendingSubmissions`, 10 phút/lần.
7. **Deploy:** Deploy → Manage deployments → sửa bản web app đang dùng → Version: New version → Deploy, để link form cũ vẫn dùng được.
8. **Thử thật:** nộp một bài thử từ điện thoại, xem cột `Đã gửi ERP` của dòng mới có `OK ...`, và bài hiện trong ERP: buổi học → "Cuối giờ · Kết quả" → "Bài nộp qua form", hoặc trang "Bài nộp chưa ghép".

## Cột "Đã gửi ERP"

| Giá trị | Nghĩa | Trigger có gửi lại không |
|---|---|---|
| `OK 18/10 19:35` | ERP đã nhận (thêm `(đã có)` nếu là bài gửi lại) | Không |
| `Lỗi 503 18/10 19:35`, `Lỗi mạng ...`, `Lỗi ERP chưa cấu hình ...` | Chưa gửi được | Có, 10 phút/lần |
| `Bị từ chối 400 ...` | ERP không nhận vì dữ liệu sai, ví dụ năm sinh trống | Không: báo kỹ thuật xem |

Trigger chỉ xét khoảng 3.000 dòng cuối và gửi tối đa 40 bài mỗi lần. Dòng cũ (trước khi dán bản này) không có `Mã bài ERP` nên không bao giờ bị gửi.
