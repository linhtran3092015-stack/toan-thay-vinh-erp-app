# Kế hoạch tích hợp chấm bài tự động (AI) vào ERP

Ngày 16/10/2026, cập nhật 17/10/2026 · Trạng thái: **đã chốt quyết định (mục 9)**, chờ dữ liệu Giai đoạn 0 · Phạm vi: bài kiểm tra cuối buổi ("Bài kiểm tra sự tiến bộ") học sinh gõ chữ qua form Apps Script; ảnh đề do trợ giảng tải lên ERP · Model AI: **Claude API** (Anthropic), trả bằng tín dụng API của gói Claude Team.

## 0. Tóm tắt

- **Mục tiêu:** bài học sinh nộp cuối buổi tự vào ERP. AI chấm theo **đáp án đã được thầy chốt**, trợ giảng xem lại và duyệt. Duyệt xong, điểm và nhận xét ghi vào kết quả buổi học (`session_results`), từ đó các luồng đã có chạy tiếp: tin Zalo cho phụ huynh, cảnh báo chăm sóc học viên, công chấm khi khóa buổi.
- **Khác bản demo ở 4 điểm cốt lõi:**
  1. AI không tự nghĩ ra đáp án: đáp án được chốt trước khi chấm.
  2. Mỗi học sinh một lượt chấm riêng, chạy nền; em nào lỗi chấm lại riêng em đó.
  3. AI chỉ chấm đúng/sai từng câu (đúng trọn điểm hoặc sai); **điểm, làm tròn, điểm cộng, mức trần và xếp hạng do code tính**.
  4. Mỗi bài đều qua người duyệt trước khi lưu.
- **Tin Zalo mẫu mới cho mọi buổi** (mục 4.10): tiêu đề, kết quả (điểm luyện tập, điểm vở, xếp hạng), bài làm, lời giải cả đề, nhận xét, thông tin liên hệ; tin dài tự tách 2–3 tin gửi liền nhau. Chủ trung tâm sửa được mẫu, có ô xem trước.
- **Model AI: Claude API**, trả bằng **tín dụng API tối đa 500 USD/tháng đi kèm gói Claude Team** của trung tâm, nên không phát sinh thêm tiền:
  - **Chấm bài:** Claude Haiku 5.5 hoặc Claude Sonnet 5.5; Giai đoạn 0 đo trên bài thật rồi mới chọn.
  - **Đọc đề:** Claude Opus 5.5.
  - Bản demo cũ dùng Gemini; project Gemini không cần nạp tiền nữa (mục 5.4).
- **Khối lượng:** tháng 8/2026 có 3.833 lượt chấm trong 28 ngày (trung vị 141, cao nhất 228 bài/ngày).
- **Chi phí ước tính:** khoảng **95–165 USD/tháng** nếu Haiku 5.5 chấm chính (Sonnet 5.5 làm trọng tài cho bài lệch) và Opus 5.5 đọc đề, tức khoảng 1/5 đến 1/3 tín dụng. Nếu phải dùng Sonnet 5.5 chấm chính thì khoảng 270–520 USD/tháng, sát hoặc vượt tín dụng (mục 5.2). Con số thật đo ở Giai đoạn 0.
- **Thời gian:** khoảng 6–7 tuần, 5 giai đoạn (Giai đoạn 1 và 2 làm song song); mỗi giai đoạn phát hành riêng như các đợt trước.
- **Bản trực quan** (sơ đồ luồng, mockup màn hình, lộ trình): https://claude.ai/artifact/SK3eLw51nE4KvbkxscUZsE

## 1. Hiện trạng

| Thành phần | Hiện tại | Vấn đề |
|---|---|---|
| Form nộp bài | Web app Apps Script "Nộp bài tốt nghiệp - Thầy Vinh". Các trường: (1) bài làm (ô chữ), (2) năm sinh, (3) họ tên (chọn từ danh sách), (4) tên (tự điền), (5) lớp hôm nay: A – Nâng cao / B – Cơ bản / CLC1 / CLC2 / Con không rõ / Khác, (6) học thử tiếng Anh, (7) SĐT phụ huynh | Không có mã học sinh, không có mã buổi học; danh sách tên nằm ngoài ERP |
| Chấm | Bản demo AI Studio: dán bảng Sheet + 1 ảnh đề → AI tự giải đề, tự chấm, tự tính điểm | Hay lỗi, chấm sai, không lưu lại; 3 khóa API ghi cứng trong code (chưa xác định thuộc project nào) |
| Tài khoản AI | Gói Claude Team có tín dụng API tối đa 500 USD/tháng; project Gemini "Hethongchambai" của bản demo | Tín dụng Claude chưa xác nhận đã nhận và liên kết Console organization; project Gemini hết tiền nạp trước (0 đ) |
| ERP | `session_results` (điểm bài kiểm tra 0–10, điểm vở, nhận xét, người chấm), `grading_credits` (công chấm, tạo khi khóa buổi), hàng đợi `parent_messages` (Zalo), tự khóa buổi sau 3 ngày | Nhập điểm tay; chưa có lưu trữ file, chưa có tích hợp AI, chưa có tiến trình nền nào gọi ra ngoài |

### 1.1 Dữ liệu và form thật (rà ngày 17/10/2026)

Nguồn: Sheet "[Test mới] Phiếu điểm danh buổi học lớp Chuyên sâu, Coaching (Câu trả lời)", mã nguồn `Code.gs` + `FormHocSinh.html`, file PDF mẫu tab "Lớp 3" và ảnh đề lớp 3 ngày 17/10. Chỉ đếm số liệu, không chép tên hay SĐT.

**Cấu trúc Sheet (21 tab)**
- **Data:** nơi form ghi bài (`appendRow`). Cột: A Họ và tên, B Tên, C Bài thi đầu ra học sinh, D Điểm thi, E Điểm vở (trợ giảng điền tay), F Timestamp (giờ Việt Nam, chuỗi `dd/MM/yyyy HH:mm:ss`), G Xếp hạng, H Nhận xét, I Năm sinh, J Lớp (A/B/CLC1/CLC2/Con không rõ/Other), N Học thử tiếng Anh, O SĐT bố/mẹ, P link ảnh.
- **Lớp 2 … Lớp 12:** mỗi tab là một khối (theo năm sinh) và chỉ giữ buổi gần nhất. Cột: Họ tên HS, Tên HS, Bài thi đầu ra của HS, Điểm thi, Điểm vở, Thời điểm nộp bài, Xếp hạng, nhận xét, Tin nhắn Zalo, Tên nhóm, Năm sinh, Bài chữa chi tiết, SĐT và tên trợ giảng chấm bài.
- **Danhsachhocsinh:** danh sách cho form (năm sinh, họ tên, tên). Ngoài ra có các tab điểm danh, "Mẫu nhận xét", "Cảm nhận PH".

**Số liệu**
- Tab Data có 8.594 dòng từ 01/08 đến 17/10 (khoảng 3.400 bài/tháng), 8.570 dòng có bài làm.
- Chỉ **799 dòng có Điểm thi**, rải trên 18 ngày từ 22/08 đến 15/10. Trợ giảng chủ yếu chấm trên tab khối, và điểm không chép ngược về Data. Có 38 điểm lẻ ,5 (theo cách chấm cũ).
- Độ dài bài làm: trung vị 116 ký tự, 95% bài dưới 650 ký tự.

**Một đề = một ngày + một khối.** Đề lớp 3 ngày 17/10 (cùng giờ 15h, cùng câu 13–17) được nộp với lựa chọn lớp A, B, CLC1 và "Con không rõ". Vì vậy lựa chọn lớp không dùng để tách đề được. Script Giai đoạn 0 đặt mã đề theo ngày + năm sinh, ví dụ `2026-10-08_sinh-2014` là đề lớp 7 ngày 08/10.

**Bài làm ghi rất tự do.** Ví dụ: "13.18 14.8 15.257", "câu 13: x=18", "Câu1,54", hai cột "1.54 4.7 cm / 2.8 5.12 cm", "x=54;x=8;…", "16/ BM= 14:2= cm" (thiếu số). Học sinh đánh số theo đề (13–17) hoặc tự đánh 1–5. Tab khối ghi "Đã làm trên lớp" hoặc "Chưa có dữ liệu bài làm" khi không có bài; script Giai đoạn 0 bỏ qua các dòng này.

**Chạy thử `prepare` (18/10, offline):** tab Data 8.601 dòng → 783 bài có bài làm và điểm, 46 đề. Bỏ: 7.768 dòng chưa có điểm, 14 dòng "Đã làm trên lớp"/"Chưa có dữ liệu", 7 điểm ghi "chưa nộp", 11 dòng không có giờ nộp, 8 bài nộp lại. Tab "Lớp 3" ngày 17/10 → 11 bài, đề `2026-10-17_sinh-2018`, đã có ảnh đề. Dữ liệu nằm trong `.ai-grading-eval/` (không vào git).

**Đối chiếu đề lớp 3 ngày 17/10** (5 câu, mỗi câu 2 điểm; đáp án: 54; 8; 257; 7 cm; 12 cm):
- 10/11 điểm trợ giảng khớp với chấm đúng/sai từng câu: 8 em khớp đúng, 2 em khớp khi cộng thêm 1 (8 → 9, 6 → 7). Vậy "Điểm thi" nhiều khả năng **đã gồm điểm cộng**.
- 1 em ghi câu 16 là "BM= 14:2= cm" (đúng cách làm, thiếu số cuối) vẫn được 10 điểm. Đã chốt 18/10: đúng cách làm, thiếu kết quả cuối vẫn tính đúng (mục 9, dòng 15); prompt chấm `grade-v2` đã ghi quy tắc này.

**Form hiện tại: những điểm Giai đoạn 1 phải sửa**
- Chọn "Khác" ở câu Lớp: form gửi chữ "Other", còn chữ học sinh gõ vào ô "Ghi rõ" (`buoiHoc_other`) bị mất.
- Dropdown họ tên lấy họ tên làm giá trị. Hai em trùng họ tên cùng năm sinh không phân biệt được, và ô "Tên" tự điền theo em đầu tiên.
- `getStudents()` trả cả danh sách năm sinh + họ tên cho bất kỳ ai mở link form (mục 4.9).
- Mảng `files` luôn rỗng, nên form không tải ảnh và cột P không dùng. AI chỉ cần đọc chữ học sinh gõ; ảnh chỉ cần cho đề.
- Năm sinh cố định 2008–2019 trong HTML.
- Giờ nộp lấy ở máy chủ Apps Script theo GMT+7, dùng được làm `submitted_at`.

## 2. Phạm vi

**Làm trong đợt này**
- Form Apps Script lấy danh sách học sinh từ ERP (theo năm sinh) và lớp hôm nay của em đó; bài nộp vào ERP gần như ngay lập tức, ghép đúng học sinh và buổi học.
- Trợ giảng tải ảnh đề (nhiều trang) lên buổi học. AI đọc đề, đề xuất lời giải; **trợ giảng** sửa và **chốt đáp án**.
- AI chấm từng bài theo đáp án đã chốt, trả kết quả đúng/sai từng câu và lý do.
- Màn hình duyệt cho trợ giảng; duyệt xong ghi vào `session_results`.
- Nhận xét 4 ý theo mẫu của Thầy Vinh, kèm câu báo cộng điểm.
- Mẫu tin Zalo mới cho mọi buổi (cả buổi nhập điểm tay), tách tin khi dài, chủ trung tâm sửa được mẫu.
- Theo dõi lượt gọi, chi phí, lỗi; cảnh báo khi hàng đợi kẹt hoặc buổi sắp tự khóa mà còn bài chưa duyệt.

**Chưa làm (đợt sau)**
- Form nộp bài nằm trong ERP thay cho Apps Script.
- Chấm bài viết tay qua ảnh.
- Đẩy câu (6), (7) của form thành lead CRM học thử tiếng Anh.
- Tự duyệt không cần người.

## 3. Luồng nghiệp vụ mới

1. **Trước/trong buổi:** trợ giảng mở buổi học → khu **Bài kiểm tra** trong tab "Cuối giờ · Kết quả" → tải ảnh đề (chụp bằng điện thoại được) và thang điểm. Đề dùng lại của buổi khác thì chọn "Dùng đề có sẵn". Trong buổi, trợ giảng tick **"Tích cực tương tác"** cho em được cộng 1 điểm, và điền tên + SĐT trợ giảng giám thị cho tin Zalo.
2. **AI đọc đề:** chạy nền khoảng 30–90 giây. AI chép lại đề thành chữ, đề xuất đáp án cuối và lời giải chi tiết từng câu.
3. **Chốt đáp án:** trợ giảng xem lời giải cạnh ảnh đề, sửa, kiểm tra tổng điểm = 10, rồi bấm **Chốt đáp án**. Chưa chốt thì không chấm.
4. **Học sinh nộp bài:** vẫn qua form như hiện nay, nhưng danh sách tên và lớp hôm nay lấy từ ERP; Apps Script gửi thêm một bản sang ERP. Nộp nhiều lần thì **lần nộp cuối** (trước khi duyệt) được tính.
5. **Ghép bài:** ERP tự ghép bài với học sinh và buổi học. Bài không ghép chắc chắn được thì vào hàng "Bài nộp chưa ghép" để trợ giảng chọn tay.
6. **Chấm nền:** bài đã ghép và đề đã chốt thì vào hàng đợi; thường có kết quả trong khoảng 1 phút.
7. **Duyệt:** trợ giảng thấy danh sách theo màu: xanh (AI chắc chắn), vàng (cần xem), đỏ (lỗi). Sửa kết quả từng câu hoặc nhận xét nếu cần, rồi bấm **Duyệt**; bài xanh duyệt hàng loạt được. Không có tự duyệt.
8. **Ghi kết quả:** duyệt sẽ ghi `test_score` và `comment` vào `session_results`. Ngay lúc đó tin Zalo cho phụ huynh vào hàng chờ; nút Gửi chỉ mở khi đã có điểm vở và thông tin trợ giảng giám thị. Khi khóa buổi (tay hoặc tự động sau 3 ngày), người duyệt được tính công chấm như hiện nay.

## 4. Thiết kế kỹ thuật

### 4.1 Dữ liệu

**Bảng mới**

| Bảng | Vai trò | Cột chính |
|---|---|---|
| `session_tests` | Đề của một buổi | `class_session_id` (unique), `title`, `status` (`draft` → `key_review` → `key_confirmed`), `marking_guide`, `answer_key` (jsonb có cấu trúc), `answer_key_version`, `source_test_id` (khi dùng lại đề), `confirmed_by`, `confirmed_at` |
| `session_test_assets` | Ảnh đề | `test_id`, `storage_path`, `mime_type`, `page_no`, `sha256` |
| `grading_submissions` | Bài nộp **và** kết quả duyệt (1 bài = 1 dòng, tránh bảng 1–1 dư thừa) | **Nộp:** `source`, `external_id` (unique, chống trùng), `submitted_at`, `answer_text`, `claimed_student_id` (mã từ dropdown), `claimed_class_session_id` (lớp hôm nay form đã chọn), `claimed_full_name`, `claimed_birth_year`, `claimed_class_option`, `raw_payload` (tự xoá sau 30 ngày)<br>**Ghép:** `student_id`, `class_session_id`, `match_status` (`matched`/`needs_review`/`ignored`/`duplicate`), `match_method`, `attempt_no`, `counts_for_score` (chỉ lần nộp mới nhất), `superseded_by`<br>**Chấm/duyệt:** `ai_question_verdicts` (jsonb), `ai_raw_score`, `ai_confidence`, `ai_flags`, `review_status` (`pending`/`ai_graded`/`needs_review`/`approved`/`superseded`/`skipped`/`expired`), `final_question_verdicts`, `praise_bonus` (boolean, +1), `raw_score`, `final_score` (số nguyên), `rank_label`, `feedback_text` (≤ 1.200 ký tự), `graded_answer_key_version`, `session_result_id`, `reviewed_by`, `reviewed_at`, `resubmitted_after_approval_at` |
| `grading_runs` | Mỗi lần gọi AI (đọc đề hoặc chấm) | `run_type` (`extract_key`/`grade`), `test_id`, `submission_id`, `answer_key_version`, `model`, `prompt_version`, `effort`, `status` (`queued`/`running`/`succeeded`/`failed`), `attempt_count`, `next_attempt_at`, `locked_until`, `result` (jsonb), `stop_reason`, `input_tokens`, `cache_read_tokens`, `output_tokens`, `cost_usd_est`, `request_id`, `latency_ms`, `error_code`, `error_message` |
| `grading_form_class_options` | Ánh xạ lựa chọn "lớp hôm nay" của form | `option_label`, `class_level` (`A`/`B`/`CLC`), `code_suffix` (ví dụ `CLC1`, có thể trống), `active` |
| `grading_comment_phrases` | Thư viện câu mẫu cho Ý 2/3/4 (khởi tạo từ bản demo AI Studio, phụ lục A) | `slot` (`y2_correct`, `y2_wrong`, `y3_praised`, `y3_quiet`, `y4`), `text`, `active`, `sort_order` |
| `grading_rank_bands` | Thang xếp hạng theo điểm cuối (sau cộng) | `min_score`, `label`, `sort_order`. Mặc định: 0 → "Tiến bộ ít"; 5 → "Tiến bộ vừa"; 8 → "Tiến bộ"; 9 → "Tiến bộ nhiều"; 10 → "Rất tiến bộ" |
| `session_message_contacts` | Thông tin trợ giảng giám thị trên tin Zalo, trợ giảng tự điền theo buổi | `class_session_id` (unique), `supervisor_name`, `grading_contact_phone`, `updated_by`, `updated_at`. Ô điền sẵn theo lần điền trước của chính trợ giảng đó |

**Cài đặt:** `system_settings` chỉ nhận khóa đã khai báo và giá trị đơn (chuỗi hoặc số), nên chỉ để ở đây các giá trị đơn, theo đúng mẫu đang dùng (thêm khóa vào `system_settings_key_check` và phần kiểm tra trong `update_system_settings`):
- `ai_grading.enabled`, `ai_grading.grade_model` (mặc định `claude-haiku-5-5`), `ai_grading.tiebreak_model` (`claude-sonnet-5-5`), `ai_grading.key_model` (`claude-opus-5-5`), `ai_grading.effort`, `ai_grading.double_check`;
- `ai_grading.bonus_points` (mặc định 1), `ai_grading.bonus_reason` (mặc định "tích cực tương tác"), `ai_grading.daily_budget_usd` (mặc định 20);
- `zalo.comment_template` (mẫu tin mới, nới giới hạn độ dài), `zalo.comment_footer` (thông tin cuối).

Thư viện câu mẫu, thang xếp hạng và ánh xạ lớp là danh sách nên nằm ở bảng riêng như trên. **Chỉ chủ trung tâm (quyền `settings.manage`, hiện chỉ cấp cho owner) sửa được** các cài đặt này.

**Storage:** repo chưa dùng Supabase Storage lần nào. Cần một migration tạo bucket riêng tư `session-tests` và policy trên `storage.objects` theo quyền; xem ảnh qua link ký ngắn hạn. Chính sách bảo mật nội dung (CSP) hiện đã cho phép ảnh và kết nối tới tên miền Supabase.

Tất cả bảng bật RLS. Các RPC dành cho tiến trình nền (`claim_grading_runs`, `complete_grading_run`) chỉ cấp cho `service_role`.

### 4.2 Nhận bài từ form (Apps Script → ERP)

- **Webhook:** sửa hàm xử lý nộp bài trong Apps Script. Sau khi ghi vào Sheet, `UrlFetchApp.fetch` gửi JSON sang `POST /api/webhooks/grading-submissions`.
  - Route viết theo mẫu `src/app/api/webhooks/sepay/route.ts`: `runtime = "nodejs"`, client service-role.
  - Thêm đường dẫn vào danh sách public trong `src/proxy.ts`.
- **Xác thực:** chữ ký HMAC-SHA256 (`Utilities.computeHmacSha256Signature`) trên `timestamp + body`, lệch giờ tối đa 5 phút. Khóa bí mật lưu ở Script Properties và biến môi trường Vercel.
- **Chống trùng:** `external_id` do Apps Script sinh, gửi lại không tạo dòng mới.
- **Giới hạn:** bài làm tối đa khoảng 20.000 ký tự; quá thì cắt và gắn cờ.
- **Gửi bù (bắt buộc ngay ở Giai đoạn 1):**
  - Apps Script ghi cột "Đã gửi ERP" trên Sheet. Một trigger hẹn giờ 10 phút/lần gửi lại các dòng chưa gửi.
  - ERP có nút "Đồng bộ lại" cho trường hợp gửi bù cũng lỗi.
  - Hạn mức `UrlFetchApp` của Apps Script (khoảng 20.000 lượt/ngày) dư cho khoảng 230 bài/ngày.
- **Danh sách học sinh lấy từ ERP (cùng Giai đoạn 1, đã chốt 17/10):**
  - Apps Script (phía server, `google.script.run`) gọi `GET /api/integrations/grading-roster` (có khóa bí mật), lưu đệm 10 phút bằng `CacheService`; form không gọi thẳng ERP.
  - **Ai có trong danh sách:** học sinh có ghi danh còn hiệu lực. Không thêm học sinh học thử hay mới đăng ký chưa xếp lớp.
  - **Lọc:** chỉ theo năm sinh, như form hiện nay.
  - **Sắp xếp:** theo tên (chữ cuối của họ tên), rồi họ đệm, theo thứ tự chữ cái tiếng Việt (`Intl.Collator('vi')`); ERP sắp sẵn trước khi trả.
  - **Trùng họ tên cùng năm sinh:** hiện kèm SĐT phụ huynh chính, ví dụ "Nguyễn Minh Anh (PH ***4828)". Đề xuất che, chỉ để 4 số cuối, vì ai có link form cũng mở được danh sách; muốn hiện đủ số thì đổi một cài đặt.
  - **Lớp hôm nay:** chọn tên xong, form hiện buổi học hôm nay của em đó từ lịch ERP. Có 1 buổi thì tự chọn; có 2 buổi thì cho chọn; không có buổi nào thì hiện các lựa chọn cũ kèm "Con không rõ".
  - Giá trị dropdown = mã học sinh ERP (`public_code`, dạng `TV-YYYY-NNNNN`), lớp hôm nay = mã buổi học. Khi đó gần như không phải ghép theo tên nữa.
  - **Không thấy tên:** giữ ô "tên tự điền"; bài vào hàng "Bài nộp chưa ghép".
  - Ô học thử tiếng Anh và SĐT phụ huynh giữ nguyên như form cũ.

### 4.3 Ghép bài với học sinh và buổi học

**Học sinh**
1. Có mã học sinh ERP thì ghép thẳng.
2. Không có mã thì ghép theo tên:
   - Chuẩn hoá họ tên (bỏ dấu, `đ` → `d`, chữ thường, gộp khoảng trắng), làm trong TypeScript vì database chưa có `unaccent`. Dùng lại hàm sẵn có như `normalizeStudentSearch`.
   - Tìm theo họ tên + `birth_year` trong học sinh đang học.
   - Ra đúng 1 em → `matched`; 0 hoặc nhiều em → `needs_review`.
3. ERP không có cột "tên riêng". Nhận xét gọi em bằng `nickname`, nếu không có thì lấy chữ cuối của `full_name`.

**Buổi học**
1. **Ứng viên:** các buổi trong ngày nộp có danh sách lớp (`resolve_class_session_rosters`, đã tính cả lớp ghép) chứa em đó.
2. **Khung giờ:** `(session_date + start_time) at time zone 'Asia/Ho_Chi_Minh'`, từ 15 phút trước giờ bắt đầu đến 3 giờ sau giờ kết thúc, phải chứa thời điểm nộp.
3. **Lựa chọn "lớp hôm nay"** chỉ dùng để phân định khi còn nhiều ứng viên:
   - Mã lớp ERP có dạng `{khối}{level}[số]`, ví dụ `7CLC1`, `8B`.
   - Form ghi "CLC1", "A – Nâng cao"... nên ánh xạ sang `class_level` và `code_suffix`, không ánh xạ thẳng sang một lớp.
4. Đúng 1 buổi → `matched`; còn lại → `needs_review`.

**Điểm danh:** `session_results` chỉ ghi được cho em có điểm danh `present` hoặc `additional_study`, ở buổi chưa khóa và đang `in_progress` hoặc `completed`.
- Em chưa điểm danh hoặc bị điểm danh vắng nhưng có bài nộp: vẫn chấm, nhưng gắn cờ "vắng nhưng có bài". Nút Duyệt yêu cầu sửa điểm danh trước.
- Sau khi khóa buổi thì không sửa được điểm danh nữa.

**Nộp nhiều lần (đã chốt 17/10):** tính **lần nộp cuối trước khi trợ giảng duyệt**.
- Có bài mới thì bài cũ chuyển `superseded` (`counts_for_score = false`), lượt chấm AI chưa chạy của bài cũ bị hủy. AI chỉ chấm lần mới nhất.
- Bài nộp sau khi đã duyệt: không tự thay điểm. Bài được ghi nhận, ERP báo trợ giảng "có bài nộp mới" (`resubmitted_after_approval_at`) để quyết định chấm lại hay không.

### 4.4 Đề và đáp án

- **Tải ảnh:** nhiều trang. Trình duyệt thu nhỏ còn cạnh dài tối đa **2.576 px**, JPEG chất lượng 0,9 (bản demo để 1.000 px / 0,75 nên dễ đọc nhầm số).
  - Đây là mức tối đa Opus 5.5 đọc ở độ phân giải cao; ảnh lớn hơn API tự thu nhỏ.
  - Mỗi trang tốn tối đa khoảng 4.800 token.
  - Định dạng nhận: JPEG, PNG, GIF, WebP. Ảnh HEIC từ iPhone phải đổi sang JPEG ở trình duyệt.
- **AI đọc đề:** chạy nền như một lượt `extract_key`, giao diện tự cập nhật khi xong.
  - Dùng **Claude Opus 5.5** (`claude-opus-5-5`) với `effort: "high"`. Mỗi ngày chỉ khoảng 10–15 đề (khoảng 0,2 USD/đề) nên chi phí nhỏ, mà bước này sai thì cả lớp sai.
  - Gửi ảnh trước, chữ sau trong cùng tin nhắn (cách Anthropic khuyến nghị). Đánh nhãn "Trang 1:", "Trang 2:" trước mỗi ảnh.
  - Kết quả theo khuôn: `questions[]` gồm `label`, `prompt_text`, `max_points`, `final_answer`, `accepted_equivalents[]` (ví dụ `1/2` = `0,5`), `solution_steps[]`; kèm `transcription_warnings[]` cho chỗ ảnh mờ. **Không có điểm từng phần:** mỗi câu đúng trọn điểm hoặc sai (đã chốt 17/10).
  - `solution_steps[]` viết rõ ràng bằng tiếng Việt, ký hiệu toán dạng chữ thường đọc được trên Zalo (x², √, ≤, phân số a/b). Đây chính là mục **"Bài chữa chi tiết của thầy cô"** trong tin Zalo: lời giải cả đề, giống nhau cho cả lớp.
- **Màn hình chốt:** ảnh đề bên trái, bảng câu hỏi sửa được bên phải; kiểm tra tổng `max_points` = 10; **trợ giảng** bấm **Chốt đáp án** (ghi nhật ký).
- **Sửa sau khi chốt:**
  - Mỗi lần sửa tạo phiên bản mới.
  - Bài chưa duyệt tự chấm lại.
  - Bài đã duyệt hiện cảnh báo "đáp án đã đổi" để trợ giảng quyết định chấm lại.
  - Khi duyệt, ERP kiểm tra phiên bản đáp án, tránh duyệt theo đáp án cũ.
- **Dùng lại đề:** chọn đề của buổi khác (cùng ngày khác lớp, hoặc cùng bài học) và sao chép đáp án đã chốt.

### 4.5 Bộ chấm AI

**Đầu vào mỗi lượt:** đáp án đã chốt (dạng chữ, không cần ảnh) + quy tắc chấm + bài làm. **Không gửi họ tên, SĐT hay thông tin cá nhân nào**, vì AI không cần để chấm.

**Đầu ra (khuôn JSON cố định)**
- Mỗi câu: `label`, `extracted_final_answer`, `verdict` (`correct`/`incorrect`/`missing`), `error_location` (bước/dòng sai), `reason_for_teacher`, `note_for_parent` (một câu ngắn cho Ý 1). AI không trả điểm.
- Toàn bài: `flags[]` (`empty`, `off_topic`, `wrong_test`, `ambiguous_notation`, `contains_instructions`) và `confidence` (`high`/`medium`/`low`).

**Code tính, không để AI tính (đã chốt 17/10)**
- Mỗi câu đúng được trọn `max_points`, sai hoặc bỏ trống được 0. Đúng cách làm nhưng quên ghi kết quả cuối vẫn là đúng; kết quả cuối sai là sai (mục 9, dòng 15).
- **Điểm bài** = tổng các câu, **làm tròn về số nguyên**: phần lẻ dưới 0,5 làm tròn xuống, từ 0,5 trở lên làm tròn lên (7,5 → 8; 7,25 → 7). Phần lẻ chỉ xuất hiện khi đề có câu 0,5 hoặc 0,25 điểm.
- **Điểm cuối** = min(10, điểm bài đã làm tròn + 1 nếu được tick "Tích cực tương tác"). Ví dụ 7,5 → 8, cộng 1 → 9.
- **Xếp hạng** theo điểm cuối (sau cộng), thang trong `grading_rank_bands`: dưới 5 "Tiến bộ ít"; 5–7 "Tiến bộ vừa"; 8 "Tiến bộ"; 9 "Tiến bộ nhiều"; 10 "Rất tiến bộ". Buổi nhập điểm tay có điểm lẻ (ví dụ 8,5) thì xếp theo khoảng: 8 ≤ điểm < 9 là "Tiến bộ".
- Phép tính viết **một lần trong SQL** (RPC duyệt và trigger tin Zalo dùng) và có bản sao trong TypeScript để hiển thị, giống cách `lock-readiness.ts` đang làm.

**Cấu hình model (Claude API, thư viện `@anthropic-ai/sdk`)**
- **Lớp gọi model tách riêng** (ví dụ `src/features/ai-grading/llm/`): phần còn lại của hệ thống chỉ biết "đọc đề" và "chấm bài", nên đổi hoặc thêm nhà cung cấp sau này không phải sửa luồng.
- **Model chấm:** `claude-haiku-5-5` hoặc `claude-sonnet-5-5`, chọn ở Giai đoạn 0. Dùng đúng tên model, không thêm hậu tố ngày.
- Cố định một model cho mỗi phiên bản đáp án. Lưu tên model, phiên bản prompt, mức `effort` và `request_id` trên từng lượt để truy vết.
- **Khuôn JSON:** `client.messages.parse()` với `output_config.format` (schema zod); kết quả ở `parsed_output`, là `null` nếu không đọc được.
  - API bảo đảm đúng cấu trúc nhưng **không** kiểm tra nội dung, nên code vẫn kiểm tra danh sách câu trả về khớp đúng nhãn câu của đáp án (không thiếu, không thừa).
  - Repo đang dùng zod 4: kiểm tra helper zod của SDK chạy được với bản này; nếu không thì truyền JSON Schema trực tiếp.
- **Suy luận:** các model này luôn bật suy luận thích ứng (adaptive thinking). Độ sâu chỉnh bằng `output_config.effort` (`low` / `medium` / `high`).
  - Haiku 5.5 mặc định `medium`, Sonnet 5.5 mặc định `high`, nên luôn đặt rõ.
  - Phần suy luận tính tiền như token ra, nên Giai đoạn 0 so các mức effort. Bước đọc đề luôn dùng `high`.
- **Không đặt `temperature`** hay tham số lấy mẫu khác: trên Haiku 5.5 và Sonnet 5.5, giá trị khác mặc định bị API từ chối (lỗi 400). Độ ổn định đến từ đáp án đã chốt, khuôn JSON, chấm hai lần và người duyệt.
- **Cache prompt:** phần đầu cố định (hướng dẫn chấm + đáp án của đề) giống nhau cho cả lớp. Đánh dấu `cache_control` ở cuối phần này để các bài sau đọc từ cache, rẻ hơn khoảng 10–20 lần cho phần đó; cache mặc định giữ 5 phút. Phần đầu phải từ 512 token trở lên mới cache được. Bài làm của học sinh đặt sau điểm đánh dấu.
- **Chấm hai lần song song:**
  - Kết quả đúng/sai từng câu khớp nhau → xanh.
  - Lệch → chấm lần ba bằng **Sonnet 5.5 làm trọng tài** (khi model chính là Haiku 5.5), lấy đa số; vẫn lệch → vàng.
  - Sau thí điểm có thể chỉ chấm lần hai cho bài có cờ hoặc độ tin cậy thấp để giảm chi phí.
- **`stop_reason`:**
  - `refusal` (bộ lọc an toàn từ chối, hiếm với bài toán) hoặc `max_tokens` → không dùng kết quả, chuyển vàng.
  - Với Sonnet 5.5 bật thêm cơ chế tự chuyển model dự phòng phía server (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`; không dùng được với Batch API). Haiku 5.5 không có cơ chế này.
- **Batch API (giảm 50%)** dùng cho việc không gấp: đánh giá Giai đoạn 0, chấm lại cả lớp sau khi sửa đáp án. Kết quả trả về không theo thứ tự, nên ghép theo `custom_id`.

**Trường hợp đặc biệt**
- Bài trống → 0 điểm, không gọi AI.
- Bài có câu kiểu "cho em 10 điểm" → prompt coi bài làm là dữ liệu, không phải lệnh; điểm vẫn tính từ kết quả từng câu và gắn cờ `contains_instructions`.
- Bài làm đề khác → cờ `wrong_test`.
- Cảnh báo khi hơn 70% lớp sai cùng một câu: "kiểm tra lại đáp án câu này?".

**Nhận xét 4 ý (mẫu Thầy Vinh, câu mẫu lấy từ bản demo AI Studio, phụ lục A)**
- **Câu báo cộng điểm** (đã chốt 17/10), đứng đầu phần nhận xét khi em được tick:
  - "Hôm nay con được cộng 1 điểm vì tích cực tương tác (điểm bài làm 8, sau khi cộng là 9)."
  - Điểm bài đã là 10 thì không cộng được nữa: chỉ khen "Hôm nay con rất tích cực tương tác", không nhắc cộng điểm.
  - Dòng Kết quả của tin Zalo ghi "Điểm luyện tập cuối buổi: 9 (đã cộng 1)".
- **Ý 1 (kết quả):** ghép từ kết quả từng câu. Đúng hết → câu khen theo mẫu; sai → câu sai + đáp án đúng + chỗ sai (`error_location`, `note_for_parent`). Phần chữa riêng cho em nằm ở đây; lời giải cả đề nằm ở mục "Bài chữa chi tiết".
- **Ý 2, 3, 4:** code chọn từ `grading_comment_phrases`, xoay vòng theo học sinh để không lặp; Ý 3 theo tick "Tích cực tương tác".
  - Văn phong vẫn đa dạng mà không bắt AI vừa chấm vừa "sáng tác".
  - Chắc chắn không lọt nội dung về camera, không dùng icon/emoji (giữ quy tắc của bản demo).
- Tổng nhận xét tối đa khoảng 1.200 ký tự.
- Trợ giảng sửa được toàn bộ trước khi duyệt.

### 4.6 Hàng đợi và tiến trình chạy nền

Repo hiện chỉ dùng pg_cron để chạy hàm SQL, chưa có tiến trình nào gọi ra ngoài (không có pg_net, Edge Function hay Vercel Cron). Vì vậy chọn cách đơn giản nhất, khớp với code hiện có:

1. **Chạy ngay khi có việc:**
   - Webhook nhận bài, hoặc hành động "Chốt đáp án" / "AI đọc đề", ghi `grading_runs` rồi dùng `after()` (Next.js 16, `next/server`) chạy một mẻ ngắn.
   - Mỗi mẻ nhận tối đa N lượt qua `claim_grading_runs` (`FOR UPDATE SKIP LOCKED` + `locked_until`), gọi Claude song song tối đa 4, ghi qua `complete_grading_run`.
   - Đặt `export const maxDuration` trên route và trang. Đọc `node_modules/next/dist/docs/` trước khi viết, theo AGENTS.md.
2. **Lưới an toàn (Vercel gói Hobby, đã xác nhận 17/10; cron của Hobby chỉ chạy 1 lần/ngày):**
   - GitHub Actions hẹn giờ 5 phút/lần gọi `/api/internal/ai-grading/worker` (khóa `CRON_SECRET`). Lịch của GitHub có thể trễ 5–15 phút lúc đông, nên chỉ là lưới an toàn.
   - Tự "đánh thức" worker mỗi khi trang Chấm bài AI hoặc khu Bài kiểm tra mở.
   - Nút "Chấm các bài đang chờ".
   - Gói Hobby giới hạn thời gian chạy mỗi hàm, nên mỗi mẻ worker chỉ nhận vài lượt. Đọc `node_modules/next/dist/docs/` và giới hạn Hobby hiện hành trước khi đặt `maxDuration`.
3. **pg_cron (chỉ SQL)**, mỗi 5 phút:
   - nhả lượt bị kẹt quá `locked_until`;
   - gọi `raise_ops_alert` khi bài chờ quá 15 phút, tỉ lệ lỗi trên 20% trong 1 giờ, hoặc chạm trần chi phí ngày;
   - báo **buổi sắp tự khóa (≤ 24 giờ) mà còn bài chưa duyệt**.
4. **Thử lại:** phân loại lỗi bằng các lớp lỗi của SDK (`Anthropic.RateLimitError`, `Anthropic.APIError`...), không so chuỗi.
   - **429 do vượt hạn mức theo phút** (có header `retry-after`): chờ đúng thời gian đó rồi thử lại, không tính là lỗi bài.
   - **Hết tiền hoặc chạm trần → dừng cả hàng đợi, không thử lại, báo ngay cho quản lý; trợ giảng chấm tay.** Gồm ba trường hợp:
     - hết tín dụng: thông báo "Your credit balance is too low…";
     - chạm trần chi tiêu của workspace: lỗi 400 "…specified workspace API usage limits";
     - chạm trần tháng của tier: 429 `enforced_spend_limit_reached`, không có `retry-after`.
   - Đặt `maxRetries` của SDK ở mức thấp để worker tự quyết.
   - 5xx, 529 (quá tải) hoặc hết giờ: thử lại tối đa 3 lần, chờ tăng dần.
   - JSON sai khuôn: thử lại 1 lần rồi chuyển vàng.

### 4.7 Màn hình

| Màn hình | Nội dung |
|---|---|
| Buổi học → tab "Cuối giờ · Kết quả" → khu **Bài kiểm tra** (component mới, không nhét vào `session-result-management.tsx` vốn đã hơn 1.000 dòng) | Trạng thái đề (chưa có / chờ chốt / đã chốt); tải ảnh; AI đọc đề; chốt đáp án; tick "Tích cực tương tác" từng em; ô **trợ giảng giám thị + SĐT thắc mắc bài chấm** (điền sẵn theo lần trước); bài nộp của buổi kèm trạng thái chấm; học sinh có mặt mà chưa nộp |
| **Chấm bài AI** (trang hàng đợi) | Lọc theo ngày/lớp/trạng thái; duyệt hàng loạt bài xanh; ô số: bài hôm nay, tỉ lệ xanh/vàng/đỏ, chi phí hôm nay và tháng này |
| Ngăn chi tiết một bài | Bài làm (giữ nguyên xuống dòng); bảng từng câu (AI chấm đúng/sai, lý do, đáp án); sửa đúng/sai từng câu (tự tính lại điểm và xếp hạng); tick "Tích cực tương tác"; sửa nhận xét; cảnh báo "đã có điểm nhập tay X", "tin Zalo đã gửi"; nút **Duyệt** / **Chấm lại** / **Bỏ qua** |
| **Bài nộp chưa ghép** | Chọn học sinh/buổi cho bài chưa ghép được; đánh dấu bài rác |
| Cài đặt → **Chấm bài AI** (chỉ owner) | Model, mức suy luận, thang xếp hạng, điểm cộng và lý do, thư viện câu nhận xét, ánh xạ lựa chọn lớp, trần chi phí/ngày, bật/tắt |
| Cài đặt → **Tin Zalo** (chỉ owner) | Sửa mẫu tin nhận xét (tiêu đề, nhãn và thứ tự các mục), thông tin cuối; **ô xem trước** dựng tin thật từ một học sinh mẫu, hiện số tin sẽ tách và số ký tự từng tin |

Giao diện theo bộ thiết kế Stumana đang làm; ưu tiên dùng tốt trên điện thoại.

### 4.8 Ghi kết quả vào ERP

Không gọi thẳng các RPC sẵn có, vì:
- `record_session_result` báo lỗi nếu đã có dòng kết quả;
- `update_session_result` bắt buộc lý do và ghi đè luôn điểm vở;
- cả hai dựa vào `auth.uid()`, nên tiến trình nền không gọi được.

Thay vào đó viết **một RPC mới** `approve_grading_submission(p_submission_id, p_question_points, p_praise_bonus, p_feedback_text, p_expected_key_version, p_reason)`, chạy với quyền của người duyệt:
1. Kiểm tra quyền `results.manage` và `ai_grading.review`; khóa dòng bài nộp (`for update`); kiểm tra phiên bản đáp án còn đúng.
2. Tính lại điểm trong SQL.
3. Kiểm tra buổi chưa khóa, đang `in_progress`/`completed`, và em có điểm danh `present`/`additional_study`.
4. Chưa có kết quả → tạo mới. Đã có → chỉ cập nhật `test_score` + `comment`, **giữ nguyên điểm vở**, lý do "Duyệt chấm AI" (qua `app.workflow_reason` để vào nhật ký).
5. `graded_by` / `graded_at` = người duyệt / lúc duyệt. Đánh dấu bài `approved`, lưu `session_result_id`, tất cả trong một giao dịch.

**Tác động dây chuyền (đã kiểm tra trong code):**
- **Tin Zalo:** trigger trên `session_results` đưa tin nhận xét vào hàng chờ **ngay khi lưu**, không đợi khóa buổi. Duyệt lại khi tin còn ở hàng chờ sẽ cập nhật nội dung tin. Tin đã gửi thì không gửi lại, nên màn hình duyệt phải báo. Mẫu tin mới ở mục 4.10.
- **Công chấm:**
  - Khi khóa buổi, mỗi kết quả có người chấm sinh 1 công cho `graded_by`, tức **người duyệt nhận công**.
  - Lương chia **quỹ cố định 1.000.000 đ/tháng** (`grading_pool`) cho trợ giảng theo số công. Vì vậy AI không làm đổi tổng tiền chấm, chỉ đổi cách chia.
  - Quản lý duyệt thì không được chia quỹ, vì chỉ trợ giảng mới được tính.
  - Thêm đánh dấu `ai_assisted` để báo cáo. **Giữ nguyên quy tắc này** (đã chốt 17/10).
- **Chăm sóc học viên:** cảnh báo "2 bài liên tiếp dưới 6" đọc `test_score`, nên điểm duyệt từ AI cũng được tính.
- **Tự khóa buổi:** buổi tự khóa sau 3 ngày (`sessions.auto_lock_after_days`). Bài chưa duyệt lúc đó chuyển `expired` và không ghi được nữa. Có cảnh báo trước 24 giờ (4.6). **Vẫn tự khóa như hiện nay** (đã chốt 17/10).

### 4.9 Bảo mật và dữ liệu cá nhân

- **Thu hồi 3 khóa Gemini trong bản demo.** Chưa xác định chúng thuộc project nào (tài khoản đang đăng nhập không xem được danh sách khóa), nên chủ project hoặc người làm bản demo cần tìm và thu hồi.
- **Khóa Claude:**
  - Tạo trong Console organization nhận tín dụng, đặt trong **workspace riêng "ai-grading"** có trần chi tiêu tháng (ví dụ 400 USD), để ERP và các việc khác trong cùng organization không ăn tín dụng của nhau.
  - Khóa chỉ nằm ở biến môi trường server `ANTHROPIC_API_KEY`, thêm vào `src/lib/env.ts` theo mẫu có sẵn.
  - Thêm thư viện `@anthropic-ai/sdk`. Chỉ gọi từ server; chính sách bảo mật nội dung (CSP) của trình duyệt không cần đổi.
- **Dữ liệu:** Anthropic mặc định không dùng dữ liệu từ sản phẩm thương mại (gồm API, cả ảnh tải lên) để huấn luyện model.
- Không gửi tên/SĐT học sinh cho AI. Script đánh giá ở Giai đoạn 0 cũng phải bỏ tên/SĐT khỏi dữ liệu xuất từ Sheet trước khi gửi.
- Webhook: HMAC + dấu thời gian + chống trùng + giới hạn kích thước.
- **Quyền mới** (đặt tên theo mẫu `module.action`):

  | Quyền | Dùng cho | Cấp cho |
  |---|---|---|
  | `ai_grading.view` | Xem bài nộp và kết quả AI | owner, operations_manager, assistant_manager, teaching_assistant |
  | `ai_grading.manage_tests` | Tải đề, chạy AI đọc đề | owner, operations_manager, assistant_manager, teaching_assistant |
  | `ai_grading.confirm_key` | Chốt đáp án | owner, operations_manager, assistant_manager, teaching_assistant (trợ giảng được chốt, đã chốt 17/10) |
  | `ai_grading.review` | Duyệt bài | owner, operations_manager, assistant_manager, teaching_assistant |

  Cài đặt dùng quyền `settings.manage` sẵn có. Mỗi quyền mới phải thêm vào migration seed, `PermissionCode` (`src/types/domain.ts`), `DATABASE_PERMISSION_CODES`, nhãn tiếng Việt, rồi chạy `npm run supabase:types`.
- Ghi nhật ký `audit_logs`: chốt/sửa đáp án, sửa điểm, duyệt.
- `raw_payload` (có SĐT phụ huynh từ câu 7) tự xoá sau 30 ngày.
- Danh sách tên trên form công khai với ai có link (như form hiện nay). API danh sách chỉ trả đúng những gì form cần: mã học sinh, họ tên, năm sinh, buổi hôm nay, và SĐT phụ huynh đã che cho em trùng tên.

### 4.10 Tin Zalo nhận xét cuối buổi (mẫu mới, cho mọi buổi)

Đã chốt 17/10/2026. Mẫu này thay mẫu `zalo.comment_template` hiện tại (`{center} - nhận xét buổi {date} lớp {class} của {student}: {comment}{scores}`) cho **mọi buổi**, kể cả buổi nhập điểm tay không qua AI.

**Mẫu mặc định** (chủ trung tâm sửa được trong Cài đặt → Tin Zalo):

```text
THẦY VINH VÀ THẦY CÔ CỘNG SỰ KÍNH GỬI PHỤ HUYNH NHẬN XÉT TÌNH HÌNH CỦA CON BUỔI HỌC NGÀY {date}

- Tên học sinh: {student_full_name}
- Kết quả: Điểm luyện tập cuối buổi: {test_score} - Điểm vở: {notebook_score} - Xếp hạng: {rank}

- Bài làm của học sinh:
{answer_text}

- Bài chữa chi tiết của thầy cô:
{solution}

- Nhận xét cho học sinh:
{comment}

{footer}
```

**Thông tin cuối mặc định** (`zalo.comment_footer`):

```text
Chủ nhiệm CLB: Thầy Lã Quang Vinh
Trợ giảng Giám thị: {supervisor_name}
SĐT thắc mắc bài chấm: {grading_contact_phone}
SĐT các thầy cô hỗ trợ:
   Thầy Linh: 077 88878 64
   Thầy Phương: 093 698 4828
   Cô Huyền: 036 356 0088
   Thầy Cô Trực Văn Phòng (18h-22h30 hàng ngày): 086 989 0233

- SĐT phản ánh nếu PH,HS không được hỗ trợ: Thầy Vinh 09666 49198
```

**Ô dữ liệu**

| Ô | Lấy từ |
|---|---|
| `{date}` | Ngày buổi học, dạng 17/10/2026 |
| `{student_full_name}` | Họ tên đầy đủ của học sinh |
| `{test_score}` | Điểm cuối (sau cộng); có cộng thì thêm "(đã cộng 1)" |
| `{notebook_score}` | Điểm vở |
| `{rank}` | Xếp hạng theo `grading_rank_bands` |
| `{answer_text}` | Bài làm nguyên văn, giữ xuống dòng (chỉ bài chấm AI) |
| `{solution}` | Lời giải cả đề từ đáp án đã chốt (`solution_steps` của từng câu, có nhãn câu) |
| `{comment}` | Nhận xét: câu báo cộng điểm + 4 ý; buổi nhập tay là nhận xét trợ giảng gõ |
| `{supervisor_name}`, `{grading_contact_phone}` | Trợ giảng tự điền theo buổi (`session_message_contacts`) |
| `{footer}` | `zalo.comment_footer` |

**Quy tắc**
- **Mục trống tự ẩn:** mục nào không có dữ liệu thì ẩn cả nhãn. Ví dụ buổi nhập tay không có bài làm và bài chữa; buổi không có bài kiểm tra thì dòng Kết quả bỏ phần điểm luyện tập và xếp hạng.
- **Khóa nút Gửi** cho tới khi đã có **điểm vở**. Đề xuất khóa thêm khi chưa điền tên và SĐT trợ giảng giám thị, để tin không có dòng trống. Hàng chờ ghi rõ lý do khóa ("Chưa có điểm vở", "Chưa điền trợ giảng giám thị"). Nhập điểm vở sau thì tin tự cập nhật (khi chưa gửi và chưa bị sửa tay).
- **Tách tin:** hàng chờ hiện cho mỗi tin tối đa 2.000 ký tự. Tin dài hơn thì tách thành **2–3 tin gửi liền nhau**, cắt ở chỗ chuyển mục, giữ đúng thứ tự mẫu. Mục dài quá 2.000 ký tự (thường là bài làm hoặc lời giải) thì cắt tiếp theo dòng. Tin thứ hai trở đi mở đầu bằng "(tiếp theo 2/3)". Cần hơn 3 tin thì không cho gửi, báo trợ giảng rút gọn.
- **Lưu và gửi:** mỗi tin nhận xét vẫn là **một** dòng `parent_messages`, để trợ giảng sửa một khối chữ như hiện nay. Nới giới hạn `content` (ví dụ 6.000 ký tự). Lúc bấm Gửi mới tách phần và gửi lần lượt qua ZaloCRM, cách nhau 1–2 giây. Lưu `parts_sent` và `provider_message_ids[]`; phần nào lỗi thì lần gửi lại đi tiếp từ phần đó, không gửi lặp phần đã đi.
- **Trợ giảng sửa từng tin trước khi gửi** như hiện nay; ô sửa hiện số ký tự và chỗ sẽ tách.
- **Chỉ owner sửa mẫu** (`settings.manage`); có ô xem trước dựng tin thật từ một học sinh mẫu.
- Không icon/emoji, không nội dung về camera.

## 5. Tín dụng, chi phí và hạn mức (Claude API)

### 5.1 Tín dụng API kèm gói Claude Team

| Mục | Chi tiết |
|---|---|
| Nguồn | Tín dụng API đi kèm gói Claude Team, áp dụng cả gói Team giá ưu đãi cho tổ chức phi lợi nhuận. 20 USD/ghế Standard, 100 USD/ghế Premium, gộp chung, **tối đa 500 USD/tháng** |
| Dùng được cho | Claude API trong ứng dụng của mình (ERP), Managed Agents, Agent SDK, Playground |
| Không dùng được cho | Claude Code, phần dùng thêm trong app Claude, Claude qua AWS / Google Cloud / Microsoft |
| Cách nhận | Owner gói Team: claude.ai → Organization settings → Billing → **API credits** → liên kết một Console organization. Cần quyền Owner/Admin/Billing bên Console |
| Liên kết | Mỗi gói chỉ liên kết **một** Console organization và **không tự đổi được** (phải nhờ support), nên chọn đúng organization dùng cho ERP |
| Xem số dư | platform.claude.com → Settings → Billing → **Promotional credits** (số tiền + ngày hết hạn) |
| Thời hạn | Hết hạn cuối mỗi chu kỳ thanh toán của gói, **không cộng dồn** |
| Khi hết | API dừng cho tới đợt tín dụng sau, trừ khi organization có tín dụng mua thêm. Không bao giờ trừ tiền vào gói Claude |
| Dùng chung | Mọi khóa và workspace trong organization trừ vào cùng một số dư, nên ERP cần workspace riêng có trần (mục 4.9) |
| Trạng thái | **Chưa xác nhận** đã nhận và liên kết (đang kiểm tra) |

### 5.2 Chi phí ước tính

Giá niêm yết (USD / 1 triệu token, vào / ra): **Haiku 5.5** 0,10 / 0,50 (prompt ≤ 100.000 token); **Sonnet 5.5** 2 / 10; **Opus 5.5** 4 / 20. Phần suy luận tính như token ra; Batch API giảm 50%.

**Giả định:**
- 3.833 bài/tháng (số liệu tháng 8).
- Mỗi lượt chấm khoảng 4.000 token vào; bộ đếm token của Claude cho số lớn hơn khoảng 30% so với ước tính trước.
- Token ra: khoảng 3.000 ở effort `low`/`medium`, khoảng 8.000 ở `high`.
- Chưa trừ phần tiết kiệm nhờ cache prompt.

| Cấu hình chấm | USD/bài | USD/tháng | So với 500 USD |
|---|---|---|---|
| **A. Haiku 5.5 chấm 2 lần** (+ lần ba bằng Haiku cho ~10% bài lệch) | 0,004–0,009 | 15–35 | 3–7% |
| **B. Haiku 5.5 chấm 2 lần + Sonnet 5.5 làm trọng tài cho ~15% bài lệch** (đề xuất nếu Haiku đạt chuẩn) | 0,010–0,022 | 36–84 | 7–17% |
| **C. Sonnet 5.5 chấm 1 lần + chấm lại ~30% bài có cờ** | 0,049–0,114 | 189–438 | 38–88% |
| D. Sonnet 5.5 chấm 2 lần | 0,080–0,185 | 306–708 | 61–142% |
| **Đọc đề bằng Opus 5.5** (~400 đề/tháng, ~2 trang/đề) | ~0,20/đề | ~80 | 16% |

**Tổng mỗi tháng (gồm đọc đề):** A ≈ 95–115 USD · **B ≈ 116–164 USD** · C ≈ 270–520 USD · D ≈ 390–790 USD.

- **Đề xuất:** dùng **B** nếu Haiku 5.5 đạt chuẩn ở Giai đoạn 0. Còn khoảng 340–380 USD/tháng cho các việc khác hoặc cho tháng đông bài.
- Nếu phải dùng **C**, giữ effort `medium` và chỉ chấm lại bài có cờ, để nằm trong tín dụng.
- **D vượt tín dụng**, không dùng.
- **Giai đoạn 0:** khoảng 300 bài × (Haiku ở 3 mức effort + Sonnet ở 2 mức) × 2 lần, cộng ~15 đề đọc bằng Opus. Chạy qua Batch API hết khoảng **40–80 USD**, nằm gọn trong tín dụng tháng đầu.
- **Đã chốt 17/10:** trần workspace "ai-grading" 400 USD/tháng; trần ngày trong ERP 20 USD (ngày thường khoảng 4–6 USD). Hết tín dụng giữa tháng thì **không mua thêm**, trợ giảng chấm tay đến đợt tín dụng sau.

### 5.3 Hạn mức

- Organization liên kết với gói có hơn 200 USD tín dụng/tháng được xếp **tối thiểu tier Build**:

  | Model (tier Build) | Lượt/phút | Token vào/phút | Token ra/phút |
  |---|---|---|---|
  | Haiku 5.5 / Sonnet 5.5 / Opus 5.5 (mỗi model một hạn mức riêng) | 5.000 | 5 triệu | 1 triệu |

- **Nhu cầu cao điểm** khoảng 15 lượt/phút, khoảng 60.000 token vào/phút và 120.000 token ra/phút, tức dưới 12% hạn mức. Dù ở tier Start (1.000 lượt/phút, 400.000 token ra/phút) vẫn đủ.
- Không có giới hạn số lượt/ngày như Gemini. Hạn mức theo phút tự hồi dần (token bucket); token đọc từ cache không tính vào hạn mức token vào.
- **Trần chi tiêu tháng của tier:** Build 1.000 USD, Start 500 USD, reset 0:00 UTC ngày 1. Tín dụng lại làm mới theo chu kỳ thanh toán của gói; hai mốc này không trùng nhau.

### 5.4 Gemini (bản demo cũ)

Kiểm tra ngày 16/10/2026:
- Project "Hethongchambai" (`hethongchambai-493915`), Tier 1: số dư nạp trước **0 đ**, trần chi tiêu tháng **20.000 đ**, tài khoản đang đăng nhập không xem được danh sách khóa.
- Hạn mức thì dư: Gemini 3.6 Flash 1.000 lượt/phút, 10.000 lượt/ngày.

Khi chuyển sang Claude:
- **Không cần nạp tiền Gemini nữa**, nhưng **vẫn phải thu hồi 3 khóa** ghi cứng trong bản demo.
- Kiến trúc tách lớp gọi model (mục 4.5), nên sau này muốn thêm Gemini làm phương án dự phòng chỉ cần viết thêm một lớp gọi.

## 6. Lộ trình

| Giai đoạn | Thời gian | Nội dung | Điều kiện xong |
|---|---|---|---|
| **0 — Chuẩn bị & đo độ chính xác** | 1 tuần | Nhận và liên kết tín dụng API; tạo workspace "ai-grading" có trần chi tiêu và khóa API; thu hồi 3 khóa Gemini cũ. Gom dữ liệu thật: 2–4 tuần bài nộp + điểm trợ giảng đã chấm + ảnh đề (≥ 10 đề, ≥ 300 bài); ghi rõ điểm đã gồm điểm cộng chưa, hoặc có cột cho biết em nào được cộng. Opus 5.5 đọc các đề đó, người sửa thành đáp án chuẩn. Script `scripts/ai-grading-eval.mjs` (bỏ tên/SĐT trước khi gửi) chạy qua Batch API: Haiku 5.5 ở effort `low`/`medium`/`high` và Sonnet 5.5 ở `medium`/`high`, mỗi cấu hình 2 lần; đo khớp điểm, token và chi phí thật. Rà tay mọi bài lệch, vì có khi trợ giảng chấm sai. Điểm so sánh là số nguyên theo quy tắc mục 4.5. | So trên điểm sau khi lấy đa số: ≥ 90% bài khớp tuyệt đối; ≥ 98% lệch ≤ 1 điểm; không bài nào lệch ≥ 2 điểm mà không bị gắn vàng. Ghi riêng tỉ lệ 2 lần chấm khớp nhau. Opus 5.5 đọc đúng đáp án cuối ở ≥ 95% số câu trước khi người sửa. Chốt cấu hình (A/B/C ở mục 5.2), effort, prompt v1. **Không đạt thì dừng lại sửa prompt.** |
| **1 — Nhận bài vào ERP** (song song với 2) | 1–1,5 tuần | `grading_submissions`, `grading_form_class_options`, webhook + HMAC, sửa Apps Script (gửi + gửi bù + danh sách học sinh theo năm sinh và lớp hôm nay từ ERP), ghép bài, trang "Bài nộp chưa ghép", khu Bài kiểm tra (chỉ xem bài nộp) | Bài nộp hiện trong ERP dưới 1 phút; ≥ 95% bài không phải ghép lại tay trong 7 ngày |
| **2 — Đề & đáp án** (song song với 1) | 1 tuần | Bucket Storage + policy, `session_tests`, `session_test_assets`, `grading_runs` (loại `extract_key`), tải ảnh, AI đọc đề chạy nền, màn hình chốt, dùng lại đề | Trợ giảng chốt xong đáp án một buổi trong ≤ 5 phút |
| **2b — Mẫu tin Zalo mới** (song song với 1 và 2, không cần AI) | 3–4 ngày | `zalo.comment_template` mới + `zalo.comment_footer`, `session_message_contacts`, `grading_rank_bands`, mục trống tự ẩn, tách 2–3 tin, khóa Gửi khi chưa có điểm vở, ô xem trước trong Cài đặt (chỉ owner) | Tin của mọi buổi ra đúng mẫu mới; tin dài tách đúng chỗ chuyển mục; không gửi được khi chưa có điểm vở |
| **3 — Chấm & duyệt** | 1,5–2 tuần | `claim/complete_grading_run`, worker `after()` + lưới an toàn, bộ chấm, tính điểm SQL + bản sao TS (làm tròn số nguyên, cộng 1, xếp hạng), `grading_comment_phrases` + câu báo cộng điểm, mục bài làm và bài chữa trong tin Zalo, trang Chấm bài AI, `approve_grading_submission`, cảnh báo | Chấm cả lớp 25 em trong ≤ 5 phút; duyệt ghi đúng điểm/nhận xét, giữ nguyên điểm vở; tin Zalo vào hàng chờ; khóa buổi tính công đúng người duyệt |
| **4 — Thí điểm & mở rộng** | 2 tuần | 1 lớp chạy song song với chấm tay 1–2 tuần, so sánh hằng ngày, chỉnh prompt/ngưỡng; ô chi phí; mở cho tất cả lớp | Tỉ lệ trợ giảng phải sửa điểm < 5%; không sự cố gửi sai điểm cho phụ huynh |

Mỗi giai đoạn: migration + pgTAP + vitest, tăng VERSION, cập nhật CHANGELOG, PR riêng.

## 7. Kiểm thử

- **pgTAP:**
  - RLS và quyền các bảng mới; RPC tiến trình nền chỉ `service_role` gọi được.
  - `claim_grading_runs` không phát một lượt cho hai tiến trình.
  - Duyệt bị chặn khi: buổi đã khóa, chưa điểm danh hoặc vắng, sai phiên bản đáp án, thiếu quyền.
  - Duyệt khi đã có kết quả nhập tay: điểm vở giữ nguyên.
  - Duyệt → khóa buổi → đúng 1 công cho người duyệt.
  - Duyệt → tin Zalo vào hàng chờ; duyệt lại → nội dung tin cập nhật.
  - Buổi tự khóa → bài chưa duyệt chuyển `expired`.
  - Gửi tin nhận xét bị chặn khi chưa có điểm vở; nhập điểm vở → tin còn chờ cập nhật.
  - Nộp lại trước khi duyệt → bài cũ `superseded`; nộp lại sau khi duyệt → điểm không đổi, có cờ "có bài nộp mới".
  - Chỉ `settings.manage` (owner) sửa được mẫu tin, thang xếp hạng, câu mẫu.
- **vitest:** chuẩn hoá tên và ghép bài (dấu, `đ`, khoảng trắng, trùng tên, lớp ghép); sắp danh sách theo tên tiếng Việt và che SĐT khi trùng tên; khung giờ theo giờ Việt Nam; tính điểm/làm tròn (x,5 lên, x,25 xuống)/cộng 1/trần 10/xếp hạng (khớp với bản SQL); dựng tin Zalo (mục trống tự ẩn, tách 2–3 tin ở chỗ chuyển mục, cắt theo dòng khi một mục quá dài, từ chối khi cần hơn 3 tin); dựng nhận xét 4 ý và giới hạn độ dài; kiểm tra JSON của AI (thiếu câu, điểm vượt max, sai kiểu, `parsed_output` rỗng, `stop_reason` là `refusal`/`max_tokens`); phân loại lỗi API (hết tín dụng / chạm trần / vượt hạn mức theo phút / quá tải) ra đúng hành động; xác thực HMAC.
- **Bộ đề hồi quy:** giữ 50–100 bài đã chấm chuẩn từ Giai đoạn 0. Mỗi lần đổi prompt hoặc model phải chạy lại và không được tụt độ chính xác.
- **Thử thật trên staging:** nộp qua form thật → thấy trong ERP → chấm → duyệt → kiểm tra `session_results`, tin Zalo, công chấm sau khi khóa.

## 8. Rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Đáp án chốt sai → cả lớp sai | Bắt buộc người chốt; ảnh đề đặt cạnh lời giải; cảnh báo khi > 70% lớp sai cùng một câu |
| Hết tín dụng giữa tháng (tín dụng không cộng dồn; việc khác trong cùng organization cũng trừ vào) → ngừng chấm | Workspace riêng có trần; ô theo dõi chi tiêu; trần ngày trong ERP; báo ngay khi gặp lỗi hết tín dụng; trợ giảng chấm tay; có thể mua thêm tín dụng |
| Gói Team đổi (bớt ghế Premium, hủy gói) → tín dụng giảm hoặc mất | Theo dõi số dư hằng tháng trên Console; nếu cần thì mua tín dụng hoặc chuyển model rẻ hơn (Haiku) |
| Học sinh gõ toán khó đọc (`x2` là x² hay 2x?) | Cờ `ambiguous_notation` → vàng; thêm hướng dẫn cách gõ trên form (`x^2`, `1/2`, `sqrt(…)`) |
| Ghép nhầm học sinh (trùng tên) | Dropdown dùng mã học sinh ERP; trùng tên thì không tự ghép |
| Buổi tự khóa khi chưa duyệt xong | Cảnh báo trước 24 giờ; bài chuyển `expired` (đã chốt: vẫn tự khóa) |
| Chi phí vượt tín dụng (suy luận dài, phải dùng Sonnet 5.5 chấm chính) | Đo ở Giai đoạn 0; chọn effort thấp nhất đạt chuẩn; Haiku chấm chính + Sonnet làm trọng tài; cache prompt; chỉ chấm lần hai khi cần |
| Bộ lọc an toàn từ chối nhầm (`refusal`) | Chuyển vàng cho người chấm; Sonnet 5.5 có model dự phòng phía server; theo dõi tỉ lệ |
| Model bị gỡ hoặc đổi hành vi | Ghi tên model đầy đủ; chạy bộ đề hồi quy trước khi đổi |
| Trợ giảng duyệt hàng loạt mà không xem | Chỉ cho duyệt hàng loạt bài xanh; thống kê tỉ lệ sửa theo người duyệt |
| Danh sách tên và SĐT phụ huynh lộ qua form công khai | API danh sách chỉ trả trường cần thiết; SĐT chỉ hiện cho em trùng tên và che còn 4 số cuối; khóa bí mật chỉ nằm ở Apps Script phía server |
| Tin Zalo dài bị Zalo/ZaloCRM từ chối hoặc gửi thiếu phần | Tách ≤ 2.000 ký tự/tin; lưu từng phần đã gửi; thử với nhóm Zalo nội bộ trước khi bật cho phụ huynh |

## 9. Quyết định đã chốt (17/10/2026)

| # | Vấn đề | Quyết định |
|---|---|---|
| 1 | Nộp nhiều lần | Tính **lần nộp cuối trước khi duyệt**; chỉ chấm AI lần mới nhất; nộp sau khi duyệt thì báo trợ giảng, không tự thay điểm |
| 2 | Điểm lẻ | Mỗi câu đúng trọn điểm hoặc sai. Tổng làm tròn về **số nguyên**: dưới 0,5 xuống, từ 0,5 lên. Làm tròn trước, cộng điểm sau, tối đa 10 |
| 3 | Công chấm | **Giữ nguyên**: người duyệt nhận công, chia quỹ 1.000.000 đ/tháng |
| 4 | Ai chốt đáp án | **Trợ giảng** được chốt |
| 5 | Điểm cộng | Trợ giảng tick trên ERP; **luôn +1**, lý do "tích cực tương tác"; nhận xét có câu báo cộng điểm cho phụ huynh |
| 6 | Tự khóa buổi | Vẫn tự khóa sau 3 ngày, cảnh báo trước 24 giờ |
| 7 | Tự duyệt | **Không** |
| 8 | Ngân sách | Trần workspace 400 USD/tháng; trần ngày 20 USD; hết tín dụng thì không mua thêm, trợ giảng chấm tay |
| 9 | Xếp hạng | Dưới 5 "Tiến bộ ít"; 5–7 "Tiến bộ vừa"; 8 "Tiến bộ"; 9 "Tiến bộ nhiều"; 10 "Rất tiến bộ" (theo điểm sau cộng) |
| 10 | Danh sách tên trên form | Học sinh đang học, lọc theo năm sinh, sắp theo tên; trùng tên hiện kèm SĐT phụ huynh (đề xuất che còn 4 số cuối); form tự hiện lớp hôm nay từ lịch ERP |
| 11 | Tin Zalo | Mẫu mới cho mọi buổi (mục 4.10); tin dài tách 2–3 tin; mục "Bài chữa chi tiết" là lời giải cả đề; khóa Gửi tới khi có điểm vở; tên và SĐT trợ giảng giám thị do trợ giảng tự điền |
| 12 | Câu mẫu nhận xét | Lấy từ bản demo AI Studio (phụ lục A) |
| 13 | Ai sửa cài đặt | **Chỉ owner** sửa cài đặt chấm, nhận xét, mẫu tin Zalo; có ô xem trước; trợ giảng vẫn sửa từng tin trước khi gửi |
| 14 | Vercel | Gói **Hobby** → lưới an toàn bằng GitHub Actions (mục 4.6) |
| 15 | Đúng cách làm, thiếu kết quả cuối (chốt 18/10) | **Tính đúng**, như trợ giảng đang chấm (ví dụ "BM = 14:2 = cm" khi đáp án 7 cm). Kết quả cuối sai thì vẫn tính sai |

## 10. Việc cần làm ngay

1. **Nhận tín dụng API Claude:** Owner gói Team vào claude.ai → Organization settings → Billing → **API credits** → liên kết một Console organization. Chọn đúng organization sẽ dùng cho ERP, vì không tự đổi được. Kiểm tra số dư ở platform.claude.com → Settings → Billing → Promotional credits.
2. **Trong Console:** tạo workspace "ai-grading", đặt trần chi tiêu, tạo khóa API rồi tự đặt `ANTHROPIC_API_KEY` vào biến môi trường Vercel (không dán khóa vào chat). **Thu hồi 3 khóa Gemini** ghi cứng trong bản demo: chủ project hoặc người làm demo cần tìm khóa, vì tài khoản đang đăng nhập không xem được danh sách khóa. Không cần nạp tiền Gemini.
3. ~~Mã nguồn Apps Script và link Sheet nhận bài~~ (đã nhận 17/10, xem mục 1.1).
4. **Dữ liệu Giai đoạn 0:** bài làm và điểm đã có sẵn trong tab Data (799 bài có điểm, đủ mức ≥ 300). Còn thiếu:
   - **Ảnh đề của 10 đề** dưới đây (331 bài có điểm sau khi bỏ bài nộp lại). Khối tính theo năm sinh cho năm học 2026–2027.

     | # | Ngày | Khối (năm sinh) | Bài có điểm |
     |---|---|---|---|
     | 1 | 08/10 | Lớp 7 (2014) | 39 |
     | 2 | 22/09 | Lớp 8 (2013) | 36 |
     | 3 | 29/09 | Lớp 6 (2015) | 36 |
     | 4 | 13/10 | Lớp 8 (2013) | 35 |
     | 5 | 28/09 | Lớp 7 (2014) | 33 |
     | 6 | 28/09 | Lớp 5 (2016) | 29 |
     | 7 | 29/09 | Lớp 8 (2013) | 32 |
     | 8 | 27/09 | Lớp 9 (2012) | 31 |
     | 9 | 12/10 | Lớp 7 (2014) | 31 |
     | 10 | 27/09 | Lớp 6 (2015) | 29 |

     Dự phòng: 05/10 Lớp 6 (29 bài), 30/09 Lớp 4 (26 bài), 30/09 Lớp 9 (26 bài). Đề lớp 3 ngày 17/10 (ảnh đã gửi) có 11 bài có điểm ở tab "Lớp 3"; cần lưu lại tab này trước buổi lớp 3 tiếp theo vì tab khối bị ghi đè.
   - **Trả lời 3 câu:** (a) "Điểm thi" đã gồm điểm cộng +1 chưa; (b) các lớp A/B/CLC cùng khối cùng buổi luôn làm chung một đề (lớp 3 ngày 17/10 là như vậy); (c) điểm cũ trên các tab khối có được lưu ở đâu không, vì tab Data chỉ có 9% bài có điểm.
5. ~~Gói Vercel~~: Hobby (đã trả lời 17/10).
6. ~~Chốt các quyết định ở mục 9~~ (đã chốt 17/10).

### 10.1 Chạy thử Lớp 3 (21/10/2026)

Đề 17/10 Lớp 3 (5 câu, mỗi câu 2 điểm), 11 bài, mỗi cấu hình chấm 2 lần qua Batch API. Tổng chi phí thật **$0.23** (đọc đề $0.04 + chấm 110 lượt $0.19).

- **Opus 5.5 đọc đề:** đúng 5/5 đáp án cuối (54; 8; 257; 7 cm; 12 cm), tự ghi 6 cảnh báo về chữ viết tay khó đọc. Đáp án được Claude chốt tạm vì khớp đáp án đã đối chiếu với điểm trợ giảng ngày 18/10; trợ giảng vẫn cần xác nhận.
- **Chấm:** từ haiku-medium trở lên, AI cho đúng điểm cả 11/11 bài. Hai bài lệch đều do điểm trợ giảng cao hơn AI đúng 1 điểm, tức +1 "tích cực tương tác", mà Sheet không ghi ai được cộng. Báo cáo giờ tách "Khớp" (coi +1 chưa rõ là khớp) và "Khớp chặt" (81,8%). haiku-low chấm một lần sai bài đánh số câu 1–5 thay cho 13–17, nhưng bài đó đã bị đánh dấu vàng để người xem.
- **Bài xanh (không cần người xem):** Haiku 63,6%, Sonnet 90,9%. Ước tính chi phí 3.833 bài/tháng ở giá thường: haiku-medium ×2 khoảng $2.9, sonnet-medium ×2 khoảng $55.
- **Chưa kết luận được:** chỉ 1 đề, đáp án là số, 11 bài. Cần ảnh 10 đề ở mục 4 để chạy khoảng 330 bài (ước tính dưới $5) trước khi chọn cấu hình cho Giai đoạn 3.

## Phụ lục A. Câu mẫu nhận xét (khởi tạo `grading_comment_phrases`)

Câu đầu tiên của mỗi ô lấy nguyên ý từ bản demo AI Studio (prompt trong `server.ts`). Các câu sau là biến thể đề xuất để xoay vòng, chủ trung tâm sửa hoặc xóa trong Cài đặt.

| Ô | Khi nào | Câu mẫu |
|---|---|---|
| Ý 1 – đúng hết | Mọi câu đúng | Con làm bài đạt kết quả rất tốt, rất đáng được khen ngợi. |
| Ý 1 – có câu sai | Có câu sai | (Code ghép: câu sai, đáp án đúng, chỗ sai ở bước/dòng nào, từ kết quả chấm) |
| `y2_correct` | Đúng hết | 1. Ba mẹ tiếp tục động viên, đồng hành để con thêm tự tin, mạnh dạn hơn trong học tập.<br>2. Mong ba mẹ tiếp tục khích lệ để con giữ vững phong độ và tự tin hơn mỗi buổi học.<br>3. Ba mẹ hãy khen ngợi và đồng hành cùng con để con thêm hứng thú, mạnh dạn hơn với môn Toán. |
| `y2_wrong` | Có câu sai | 1. Nhờ phụ huynh hỗ trợ, nhắc nhở con xem lại video/slide bài giảng và làm lại bài thi đầu ra cho đến khi đúng với đáp án thầy đã chữa.<br>2. Phụ huynh giúp thầy nhắc con xem lại video và slide buổi học, rồi làm lại bài thi đầu ra đến khi khớp với đáp án thầy đã chữa.<br>3. Ba mẹ nhắc con dành thời gian xem lại bài giảng và tự làm lại bài thi đầu ra cho đến khi đúng như phần thầy chữa. |
| `y3_praised` | Được tick "Tích cực tương tác" | 1. Hôm nay con học tập rất sôi nổi, hăng hái phát biểu và tích cực nhắn tin tương tác với thầy.<br>2. Buổi học hôm nay con rất chủ động, hăng hái trả lời và nhắn tin trao đổi bài cùng thầy.<br>3. Thầy rất vui vì hôm nay con tham gia bài học sôi nổi, mạnh dạn phát biểu ý kiến. |
| `y3_quiet` | Không được tick | 1. Hôm nay con còn hơi trầm, ít tham gia nhắn tin trả lời bài; thầy mong buổi sau con mạnh dạn và tương tác nhiều hơn.<br>2. Buổi này con chưa tham gia trả lời nhiều; thầy khích lệ con mạnh dạn nhắn tin phát biểu ở buổi sau.<br>3. Con còn hơi rụt rè trong giờ học hôm nay; thầy mong con tự tin tương tác với thầy nhiều hơn vào buổi tới. |
| `y4` | Mọi bài | 1. Cố gắng phát huy kết quả này, thầy tin con sẽ ngày càng tiến bộ.<br>2. Thầy luôn theo sát và tin rằng con sẽ tiến bộ hơn nữa trong những buổi tới.<br>3. Chúc con giữ vững tinh thần học tập, thầy tin con sẽ ngày càng vững vàng hơn. |

Câu báo cộng điểm (mục 4.5) đứng trước Ý 1, nên Ý 3 không nhắc lại chuyện cộng điểm. Giữ hai quy tắc của bản demo: không icon/emoji, không nhận xét gì về camera.

## Phụ lục B. Chạy script Giai đoạn 0 (`scripts/ai-grading-eval.mjs`)

Dữ liệu nằm trong `.ai-grading-eval/` (đã bỏ khỏi git). Lệnh tốn tiền chỉ in ước tính, thêm `--confirm` mới gọi API. Khóa API lấy từ biến môi trường `ANTHROPIC_API_KEY` (workspace "ai-grading"), không ghi vào file.

| Bước | Lệnh | Ghi chú |
|---|---|---|
| 1 | `npm run eval:ai-grading -- template` | Tạo thư mục, file mẫu, README |
| 2 | `npm run eval:ai-grading -- prepare --input <sheet.xlsx\|.csv>` | Offline. Chỉ giữ bài làm, điểm, điểm cộng, mã đề; thay tên/SĐT trong bài làm bằng `[TÊN]`/`[SĐT]`; nộp nhiều lần thì giữ lần cuối. Cột lạ: `--col answer="..." --col score="..."`. Điểm trợ giảng chưa gồm +1: `--score-includes-bonus no` |
| 3 | Đặt ảnh đề vào `tests/<mã đề>/` | Mã đề tự đặt theo ngày + năm sinh (ví dụ `2026-10-08_sinh-2014` là đề lớp 7 ngày 08/10) nếu Sheet không có cột "Mã đề"; không có năm sinh thì theo ngày + lớp hôm nay. Hai năm sinh làm chung một đề thì khai trong `tests/aliases.json` |
| 4 | `... extract-keys` rồi `... extract-keys --confirm` | Opus 5.5 (effort high) viết `keys/<mã đề>.draft.json`, khoảng 0,2–0,3 USD/đề |
| 5 | Người kiểm tra bản nháp, lưu thành `keys/<mã đề>.json` với `"confirmed": true` | Tổng `max_points` = 10; mỗi câu đúng trọn điểm hoặc sai |
| 6 | `... submit` rồi `... submit --confirm` | Batch API: 5 cấu hình (Haiku low/medium/high, Sonnet medium/high) × 2 lần. Thử nhỏ trước: `--limit 20 --configs haiku-medium` |
| 7 | `... collect --wait` | Thường xong trong 1 giờ, tối đa 24 giờ |
| 8 | `... report` | `report.md` (khớp, lệch ≤ 1, xanh, xanh lệch ≥ 2, chi phí thật, chi phí tháng ước tính, độ chính xác bản nháp đáp án) + `mismatches.csv` (mọi bài lệch, kèm bài làm, để rà tay) |

`report` tự so cả cấu hình B: mỗi cấu hình Haiku chấm 2 lần + một cấu hình Sonnet làm trọng tài khi 2 lần lệch nhau.
