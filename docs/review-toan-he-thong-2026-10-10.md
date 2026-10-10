# Rà soát toàn hệ thống ERP Toán Thầy Vinh — 10/10/2026

Phiên bản rà soát: v0.6.5.0 (commit `a9e8c8b`). Phương pháp: 5 lượt review độc lập, chỉ đọc code (kiến trúc, giao diện, nghiệp vụ vận hành, nghiệp vụ tài chính/CRM, bảo mật/dữ liệu), sau đó kiểm tra chéo các phát hiện nặng nhất trực tiếp trên mã nguồn. Chưa chạy ứng dụng thật, chưa kiểm thử trên trình duyệt.

Quy mô: ~100.000 dòng TypeScript, 23 module nghiệp vụ, 70 trang, 124 migration, 103 bảng, 217 hàm SQL, ~650 test tự động.

---

## 1. Đánh giá chung

**Nền tảng kỹ thuật tốt, nghiệp vụ còn nhiều "đường cụt", giao diện đang đứt gãy ở lớp design system.**

Điểm mạnh:
- Toàn bộ 103 bảng đều bật RLS, không bảng nào cho phép ghi trực tiếp; mọi thao tác ghi đi qua RPC có kiểm tra quyền. Đây là mức bảo mật dữ liệu hiếm thấy ở dự án nội bộ.
- Webhook SePay làm đúng chuẩn: ký HMAC, chặn replay, idempotent, chạy trong transaction.
- Tiền lưu dạng số nguyên VND, lịch sử bất biến (append-only), audit log có trigger chống sửa.
- Điều hướng (sidebar/rail/drawer mobile) bám sát tài liệu kiến trúc thông tin và làm cẩn thận về a11y.
- Có bộ test DB (pgTAP + script Postgres tách biệt) cho các đường tiền quan trọng.

Điểm yếu lớn:
- **Dòng tiền có 3 lỗ hổng có thể sinh sai số thật** (tái phát hành phiếu, khóa kỳ muộn, kỳ chồng nhau).
- **Lương có thể trả thừa** (ca tự đóng 23:30 vẫn tính đủ, không trừ giờ nghỉ, chấm công online không cần bằng chứng).
- **Dashboard hiển thị số sai**: doanh thu giả định, phễu CRM luôn 0%, cắt ở 1.000 dòng, mốc tháng theo UTC.
- **Design system hỏng ở lớp token**: hơn chục class không có tác dụng, chữ phụ to hơn chữ chính, nút chính và nút nguy hiểm cùng màu.
- **Nhiều quy trình đi được nửa đường**: CRM dừng ở "đã đặt lịch học thử", không kết thúc được ghi danh, không đổi lịch buổi học, không có bước "đã trả lương".
- **Chưa có kênh tới phụ huynh** (Zalo/SMS/email) và **không có báo cáo tài chính nào**.
- Chương trình redesign (docs/redesign) mới dừng ở tài liệu; Wave 1–6 chưa vào code. `src/components/ui` chỉ có 4 primitive.

---

## 2. Phát hiện theo mức độ

Ký hiệu: **P1** sai tiền/sai dữ liệu hoặc quy trình không hoàn tất được · **P2** thiếu kiểm soát, sai lệch, trải nghiệm kém rõ rệt · **P3** chất lượng/hoàn thiện.

### 2.1 Tiền & học phí (P1)

| # | Vấn đề | Bằng chứng | Hệ quả |
|---|---|---|---|
| F1 | **Tái phát hành phiếu học phí không hủy phiếu cũ.** Phiếu gốc vẫn `pending`, QR cũ vẫn hiện trên thông báo. | `20260923010000:387-412`; `finance/tuition-periods/[periodId]/items/[itemId]/notice/page.tsx:34` | Phụ huynh có thể trả QR cũ; 2 phiếu pending → tự khớp thất bại (`AMBIGUOUS`); công nợ đếm đôi. Giảm giá bằng cách "reissue về 0" vẫn để nợ cũ mở. |
| F2 | **Khóa kỳ học phí muộn tính trùng buổi.** Số dư đầu kỳ lấy số dư *hiện tại*, không phải tại `starts_on`; không chặn khóa kỳ đã bắt đầu. | `create_tuition_collection_period` `20260814100000:214`; lock `20260923010000:343-385` | Tháng 8 buổi có thể bị tính 11 buổi (tài liệu dự án tự ghi nhận). |
| F3 | **Hai kỳ chồng nhau không bị chặn.** Nợ âm đã lên phiếu kỳ trước lại bị tính `opening_debit` ở kỳ sau. | `20260923010000:371` | Thu trùng nợ. |
| F4 | **Chuyển khoản thừa/thiếu so với phiếu không có cách xử lý.** Phân bổ gắn phiếu bắt buộc khớp đúng số; phân bổ trực tiếp bị chặn khi còn phiếu mở; không có RPC hủy/hết hạn phiếu (`cancelled`, `expired`, `partially_paid` có trong CHECK nhưng không ai ghi). | `20260928010000:445-446`; `20260726160000:90` | Chuyển 1.250.000 cho phiếu 1.200.000 → cả giao dịch lẫn phiếu kẹt vĩnh viễn. |
| F5 | **Tiền không phải học phí về qua webhook không bao giờ đóng được.** "Bỏ qua / đã hạch toán" chỉ áp dụng cho dòng import lịch sử. | `20260905020000:490,497` | Hàng đợi đối soát bẩn dần. |
| F6 | **Không có đảo ngược phân bổ.** Phân bổ sai là vĩnh viễn. | ledger/cashflow append-only, không có RPC reverse | Sai một lần phải sửa thủ công ở DB. |
| F7 | Ngày hiệu lực webhook theo UTC (`p_transaction_date::date`); tháng ghi nhận = lúc hạch toán, không phải ngày ngân hàng. | `20260923010000:803,833` | Giao dịch 0–7h sáng ngày 1 rơi vào tháng trước; ảnh hưởng dashboard, lương, hoa hồng. |
| F8 | Lô tín dụng (`student_credit_lots.remaining_sessions`) không bao giờ bị trừ; `session_charge` không có đơn giá. | `20260817090000:247` | Không định giá được buổi chưa dùng → không làm được hoàn tiền, doanh thu theo lớp, doanh thu chưa thực hiện. |
| F9 | Chỉ ghi nhận thu, không ghi chi (lương, tạm ứng, chuyển đi). | chỉ có insert `'receipt'` vào `finance_cashflow_records` | "Chi phí" và "dòng tiền ròng" trên dashboard luôn sai. |

### 2.2 Lương & chấm công (P1/P2)

| # | Vấn đề | Bằng chứng |
|---|---|---|
| L1 | **Ca bị hệ thống tự đóng lúc 23:30 vẫn được trả đủ tiền** (`auto_ended` tính như `checked_out`). Không có hàng đợi duyệt, chỉ có badge. | `20260929154500:72-91`; watchdog `20260915170000:5-17` |
| L2 | **Không trừ giờ nghỉ, không giới hạn theo ca xếp, ca ngoài lịch vẫn tính.** `break_minutes` có trên ca nhưng lương bỏ qua. | `20260929154500:72-78` |
| L3 | **Chấm công online không cần bất kỳ bằng chứng nào**, không cần ca xếp, không gắn buổi học online. | `check_in_time_entry` `20260904010000:715-720` |
| L4 | Wi-Fi SSID/BSSID là ô người dùng tự gõ (trình duyệt không đọc được) → không chứng minh gì. GPS cũng do client gửi, heartbeat không validate zod. | `time-entry-schemas.ts:20-62`; `time-entry-actions.ts:152-180` |
| L5 | **Chưa có trạng thái "đã trả lương"**: kỳ đã duyệt vẫn mở lại được bất kỳ lúc nào; không lưu ngày trả, số tham chiếu; không xuất file chuyển khoản lô. | `20260729100000:58` |
| L6 | **Mở lại kỳ lương tắt toàn bộ trigger** (`session_replication_role = replica`), kể cả audit và FK. | `20260829000000:44-55`; `20260829010000:47-60` |
| L7 | **Mọi nhân sự đọc được dữ liệu nguồn lương của người khác**: policy `payroll_source_facts_select` chỉ cần `payroll.view` — quyền này cấp cho cả 9 role. | `20260825110000:917-918`; `20260729100000:19-39` |
| L8 | Audit "xem phiếu lương" không bao giờ ghi được (insert bằng client user vào bảng chỉ cho SELECT), lỗi bị nuốt. | `payslip-data.ts:484-500` |
| L9 | Tạm ứng: không chặn tự duyệt cho chính mình, không trần số tiền, có thể duyệt vào tháng đã chốt lương. | `20260729110000:338-456` |
| L10 | Ngày trả lương bị khóa cứng = tháng + 27 ngày, không né được ngày lễ. | `20260729100000:55-56` |

### 2.3 Học vụ (P1/P2)

| # | Vấn đề | Bằng chứng |
|---|---|---|
| A1 | **Khóa buổi vẫn bắt buộc có điểm kiểm tra** cho mọi học sinh có mặt — trái tài liệu nghiệp vụ. Không khóa được → không trừ buổi, không tính thưởng chấm bài. | `20260817090000:296-297` vs `docs/redesign/WORKFLOW_CONTRACTS_A_E.md` |
| A2 | **Khóa là bước duy nhất trừ buổi và hoàn toàn thủ công**; không có danh sách "đã học xong nhưng chưa khóa", không tự khóa sau N ngày. | `lock_class_session` |
| A3 | **Tạo buổi hàng loạt có đường dự phòng dùng service-role**: RPC lỗi vì bất kỳ lý do gì (kể cả lớp chưa active, template sai lớp) → chèn thẳng vào bảng, bỏ qua mọi kiểm tra của DB. | `session-batch-actions.ts:195-262` |
| A4 | **Không đổi lịch/sửa buổi học**; muốn dời phải hủy rồi tạo makeup. Unique index tính cả buổi đã hủy nên không tạo lại được buổi cùng ngày. | `20260725050000:257-263` |
| A5 | Vắng có phép bị trừ buổi như vắng không phép; không có tín dụng học bù theo học sinh. | `20260817090000:244-246` |
| A6 | **Không kết thúc được ghi danh** khi học sinh nghỉ; không có trạng thái "đã nghỉ"; lớp còn ghi danh active thì không đóng được. | không có RPC end-enrollment; `20260724150000:1131-1145` |
| A7 | Đổi trạng thái học sinh hàng loạt cho phép mọi chuyển đổi, không đồng bộ ghi danh, audit không có `entity_id`. | `20260818114500` |
| A8 | Đóng lớp để lại các buổi `scheduled` tương lai lơ lửng mãi. | `change_class_status` |
| A9 | **Không có giáo viên/trợ giảng gắn với lớp hay buổi**, không có sức chứa lớp, không có lịch dạng calendar. | không có `teacher_id` ở bất kỳ migration nào |
| A10 | Import không có rollback/void cho batch đã commit; bỏ nguyên tắc 4 mắt khi duyệt số dư buổi. | `20260809033000` |

### 2.4 CRM, chăm sóc, báo cáo, dashboard

| # | Vấn đề | Bằng chứng |
|---|---|---|
| C1 | **CRM dừng ở "đã đặt lịch học thử"**: không có RPC cho `trial_completed`, `dropped`, kết quả học thử. Lead rớt không đóng được. | `20260806103000` |
| C2 | **Chia lead tự động trỏ vào role `consultant` không tồn tại** → lead dồn hết về `admissions_leader`; chuyên viên tuyển sinh cũng thiếu quyền `crm.*`. | `20260806103000:83`; `20260726151000:25` |
| C3 | Thanh toán không gắn với chuyển đổi: checklist "đã nhận tiền" tự tick; phiếu tuyển mới không tạo được trước khi convert → tiền về luôn `unmatched`. | `convert_crm_case_to_official_student` |
| C4 | **Dashboard có doanh thu giả** `studentCount × 1.800.000`. | `dashboard/data.ts:651` |
| C5 | **Phễu CRM dùng tên trạng thái không tồn tại** (`lead`, `new`, `consulting`, `official`...) → tỷ lệ chuyển đổi luôn 0%. | `dashboard/data.ts:695-716` vs CHECK ở `20260726151000:79` |
| C6 | Dashboard đọc nguyên bảng rồi cộng bằng JS, không limit; Supabase cắt ở 1.000 dòng → KPI sai âm thầm khi dữ liệu lớn. Mốc tháng theo UTC. Tuổi nợ tính theo `created_at` thay vì `due_on`. | `dashboard/data.ts` (25 `.from()`, 0 `.limit`) |
| C7 | **Chỉ có 1 báo cáo** (xuất buổi học CSV) và nó lọc ngày *sau* khi đã cắt 300 dòng mới nhất. | `reports/catalog.ts`; `reports/export/sessions/route.ts:70-87` |
| C8 | Chăm sóc học viên: leo thang task tháng không bao giờ chạy (vòng lặp `kind<>'monthly'` rồi kiểm tra `kind='monthly'`); người đủ điều kiện hard-code theo role thay vì ma trận quyền; module đang `enabled=false`. | `20260917102000:145,154`; `20260917100000` |
| C9 | Thông báo chỉ in-app, chỉ cho 2 sự kiện (tạm ứng, chăm sóc). Không có: tiền đã về, giao dịch cần đối soát, phiếu quá hạn, lead được giao, học sinh sắp hết buổi. **Không gì tới phụ huynh.** | `20260731025000:10` |

### 2.5 Giao diện & trải nghiệm

| # | Vấn đề | Bằng chứng |
|---|---|---|
| U1 | **Token kiểu chữ hỏng**: `text-secondary` trỏ vào `--color-secondary` (màu xanh oklch) thay vì cỡ 13px → chữ phụ to hơn chữ chính ở hầu hết trang (308 chỗ dùng); cảnh báo lương hiện màu đỏ thương hiệu thay vì vàng. | `globals.css:58`; `staff-live-estimate-card.tsx:170` |
| U2 | **Hơn 10 class không được định nghĩa** nên không có tác dụng: `text-warning-text`, `text-success-text`, `text-section`, `text-kpi`, `bg-field-bg` (29), `bg-surface-canvas`, `border-neutral-border`... KPI tài chính hiện cỡ chữ thường. | `finance/page.tsx:69`; `badge.tsx:22` |
| U3 | **Nút chính (#B83C30) và nút nguy hiểm (#C33752) gần như cùng màu đỏ.** Dark mode: chữ trên nút chính tương phản ~2.9:1, không đạt AA. | `globals.css:1072,135,855,1095` |
| U4 | **Không có primitive cho form**: 47 bộ class input chép tay, 4 chiều cao khác nhau, 260 `<input>` thô. **5 form tài chính không có style, ô nhập gần như vô hình** (tài khoản nhận SePay, mẫu phiếu, phiếu thay thế, hồ sơ học phí, in ấn). | `sepay-receiving-account-management.tsx`; `tuition/*.tsx` |
| U5 | **Chấm công trên điện thoại mất ~5 chạm**: nút topbar chỉ dẫn sang trang, GPS không tự lấy khi mở hộp thoại, hiện cả ô BSSID. | `topbar-timekeeping-button.tsx:22`; `timekeeping-entry-dialog.tsx:142,349-378` |
| U6 | Ước tính lương hiện **giờ máy người xem** thay vì `asOf` từ server như spec yêu cầu; mã vị trí thô (`teaching_assistant`) hiện cho nhân sự. | `use-payroll-live-estimate.ts:56`; `staff-live-estimate-card.tsx:163` |
| U7 | Dashboard không theo vai trò: giáo viên/nhân viên chỉ thấy "Chưa có quyền xem..."; nút "Xuất báo cáo" chỉ là `window.print()` sau 400ms giả; tên trung tâm hard-code; emoji. | `dashboard-header.tsx:33-53` |
| U8 | Hộp thoại "thay đổi chưa lưu" còn chữ **"các thay đổi mock trong màn hình này sẽ bị bỏ"** hiện cho người dùng thật. | `unsaved-changes-dialog.tsx:23` |
| U9 | 90 chuỗi hiện mã quyền thô ("Cần quyền finance.view"); thuật ngữ lẫn lộn: "học viên"/"học sinh", Check-in/Gross/Responses/Batch ID/All-or-Nothing; 3 kiểu ký hiệu tiền (₫, VND, đ); 19 hàm format tiền, 50+ hàm format ngày rải rác. | toàn bộ `src/features` |
| U10 | Bảng tài chính chỉ chuyển sang dạng bảng khi container ≥1282–1882px → laptop 1440px luôn thấy dạng thẻ. Bảng chấm công `min-w-[1000px]` trong khung `overflow-hidden` → bị cắt trên tablet. | `globals.css:430`; `data-table-frame.tsx:24` |
| U11 | Không sắp xếp cột ở bất kỳ bảng nào; 8 bản phân trang riêng; staff/CRM/tạm ứng/hoa hồng không phân trang. Trang chi tiết học sinh là một cột dài, không tab; thiết kế tab (điểm danh/kết quả/tài chính) chỉ tồn tại trong code mock không dùng. | |
| U12 | `app/error.tsx` nằm trên `(app)/layout` → lỗi bất kỳ làm mất cả sidebar và hiện `error.message` thô; không có `not-found.tsx` (404 tiếng Anh mặc định). | |
| U13 | Lỗi a11y: 3 dialog tự chế không trap focus/Escape; mọi nút "Có mặt" cùng tên; `text-ink-subtle` (2.6:1) dùng cho 145 đoạn chữ thật. | `bulk-status-transition-dialog.tsx:155`; `session-attendance-management.tsx:501` |

### 2.6 Bảo mật & vận hành

| # | Vấn đề | Mức |
|---|---|---|
| S1 | RLS `payroll_source_facts` quá rộng (xem L7). | High |
| S2 | Service-role fallback (xem A3). | High |
| S3 | **Nhận lời mời tài khoản tin email trong JWT mà không kiểm tra `email_verified`**; `config.toml` local bật đăng ký email không xác nhận. Nếu production cũng vậy, ai đó đăng ký qua API Supabase bằng email được mời sẽ chiếm role của lời mời. UI chỉ có Google nên tấn công đi thẳng API. | High (tùy cấu hình prod) |
| S4 | Không có security header nào (CSP, frame-ancestors, HSTS, nosniff, Referrer-Policy). Token form coaching nằm trên URL. | Med |
| S5 | Log webhook ghi nguyên body (tên người chuyển, số TK, nội dung). | Med |
| S6 | Không có giám sát/cảnh báo (Sentry, log drain); pg_cron lỗi không ai biết; không rate limit. | Med |
| S7 | **Vercel deploy khi push `main` bất kể CI đạt hay không**; migration áp bằng tay → app và schema có thể lệch. | Med |
| S8 | `has_permission()` xuất hiện ~160 lần trong policy không bọc `(select ...)` → chạy lại từng dòng trên bảng lớn. | Med |
| S9 | Không có tài liệu backup/PITR/diễn tập khôi phục. | Med |
| S10 | Tổng thể RLS: 103/103 bảng bật; 0 grant ghi cho `authenticated`; 217 hàm security definer đều có kiểm tra hoặc đã revoke đúng. **Điểm mạnh thật sự.** | — |

### 2.7 Kỹ thuật & chất lượng mã

- `database.generated.ts` cũ từ 28/9; 6 RPC mới không có trong types → ~20 chỗ ép kiểu `as unknown as`/`as any`; CI không kiểm tra drift.
- ~5.000 dòng code mock cũ của module học sinh không được import từ đâu (mock-data, student-detail-page mock, 14 tab component, 9 section form).
- 16 trang gọi Supabase trực tiếp trong `page.tsx`; 2 trang in học phí bị "minify" thành 1 dòng; `crm/new/page.tsx` là client page không có guard quyền server.
- Không có Prettier; nhiều file có dòng >2.000 ký tự (`session-list-page.tsx` 88 dòng/19,6KB). 21 file >600 dòng; file lớn nhất 1.364 dòng.
- 19 `formatDate`, 12 `formatCurrency`, 24 bản map lỗi RPC, 21 `TableHeader` cục bộ; 2 bộ token (`text-ink` 864 lần vs `text-text-muted` 630 lần) song song; 559 class màu Tailwind cứng (420 ở 3 trang import).
- Test: `audit`, `grading-credits`, `learning-results`, `reports` không có test; 4 file action import (~1.500 dòng) và action ghi danh không có test; 2 script DB + 2 file SQL test không được CI chạy; e2e 1 smoke test không trong CI.
- Trang chi tiết học sinh ~10 round-trip tuần tự; shell gọi `getUser()` 2 lần mỗi request; không dùng `"use cache"`.
- `package.json` còn `0.6.4`, README là boilerplate.

---

## 3. Lộ trình đề xuất

Nguyên tắc: **sửa chỗ sai tiền trước, rồi chỗ làm người dùng mất niềm tin, rồi mở rộng tính năng.** Mỗi đợt nhỏ, đưa lên độc lập, có test DB đi kèm.

### Đợt 0 — Vá khẩn (1–2 tuần, toàn việc nhỏ)

| Việc | Effort | Sửa |
|---|---|---|
| Siết RLS `payroll_source_facts`/`payroll_calculation_runs` về `staff_id = auth.uid()` hoặc quyền quản lý | S | L7/S1 |
| Xóa service-role fallback trong tạo buổi hàng loạt; trả mã lỗi RPC; thêm ESLint cấm import service-role ngoài webhook | S | A3/S2 |
| `accept_my_account_invitation` kiểm tra provider Google / `email_verified`; tắt email signup trên prod | S | S3 |
| Bỏ yêu cầu điểm kiểm tra khi khóa buổi (theo tài liệu nghiệp vụ) | S | A1 |
| Sửa role `'consultant'` → `admissions_specialist`; cấp `crm.*` cho chuyên viên | S | C2 |
| Sửa dashboard: xóa doanh thu giả, dùng đúng tên trạng thái CRM, map nhãn danh mục | S | C4/C5 |
| Sửa vòng lặp leo thang task tháng (student care) | S | C8 |
| Sửa xuất báo cáo buổi học lọc trong SQL | S | C7 |
| Sửa token: đổi tên `--color-secondary`, định nghĩa các class thiếu; thêm test chặn class không tồn tại | S | U1/U2 |
| Tách màu nút chính/nguy hiểm; sửa `--text-on-primary` dark mode | S | U3 |
| Xóa chữ "mock" trong dialog; thêm `(app)/error.tsx`, `not-found.tsx` tiếng Việt | S | U8/U12 |
| Ngừng log body webhook; `no-store` cho PDF phiếu lương | S | S5 |
| Hiện `asOf` server trên ước tính lương; map mã vị trí | S | U6 |
| Đưa 2 script DB + 2 file SQL test vào CI; regenerate types và thêm bước kiểm tra drift | S | — |

### Đợt 1 — Đúng tiền (3–5 tuần)

| Việc | Effort |
|---|---|
| **Reissue nguyên tử**: hủy/supersede phiếu gốc, ẩn QR phiếu cũ, tiền về mã cũ → hàng đợi review | M |
| **Vòng đời phiếu thu**: `cancel_payment_request` (lý do + audit), `partially_paid`, nhiều giao dịch ↔ một phiếu, tiền thừa giữ dạng prepaid | L |
| **Bộ xử lý ngoại lệ webhook**: bỏ qua / đã hạch toán / hoàn tiền đi / phi học phí cho mọi nguồn giao dịch | S |
| **Toán kỳ học phí**: số dư cắt tại `starts_on`, cấm kỳ chồng nhau, nợ cũ mang theo bằng tham chiếu | M |
| **RPC đảo phân bổ** (reverse allocation) | S |
| `business_date` theo Asia/Ho_Chi_Minh cho mọi dòng thu; audit cho auto-match và CRM | S–M |
| **Lương theo ca xếp**: `least(check_out, end+grace) − greatest(check_in, start−grace) − break`; `auto_ended` phải được duyệt mới tính; ca ngoài lịch cần lý do | M |
| Chấm công online phải khớp ca/buổi online hoặc vào hàng đợi duyệt; bỏ ô SSID/BSSID | M |
| **Bước "đã trả lương"**: approved → paid (ngày, tham chiếu, file chuyển khoản lô); khóa mở lại sau paid; thay `session_replication_role` bằng GUC có phạm vi | M |
| Tạm ứng: chặn tự duyệt, trần theo ước tính lương | S |
| Dashboard chuyển sang RPC gộp trong SQL (đếm/sum theo tháng VN, không giới hạn 1.000 dòng) | M |

### Đợt 2 — Quy trình khép kín (4–6 tuần)

| Việc | Effort |
|---|---|
| Hàng đợi "buổi đã học chưa khóa" + nhắc + tùy chọn tự khóa sau N ngày | S–M |
| Đổi lịch/sửa buổi học (`update_class_session`), unique index bỏ qua buổi đã hủy | M |
| Kết thúc ghi danh / học sinh nghỉ (`end_student_enrollment`), trạng thái "đã nghỉ", đồ thị chuyển trạng thái hợp lệ cho bulk | M |
| CRM: kết quả học thử, `trial_completed`/`dropped` kèm lý do, ghi chú & nhắc theo dõi, gắn phiếu tuyển mới với case | M |
| Primitive form (Field/Label/Input/Select/Textarea) + Table có sort + Pagination dùng chung; sửa 5 form tài chính không style | M |
| Chấm công 1 chạm trên điện thoại: topbar mở thẳng hộp thoại, GPS tự lấy, "Vào ca/Ra ca" | M |
| Trang chủ theo vai trò: buổi hôm nay, trạng thái chấm công, lương ước tính, việc chờ | M |
| Hàng đợi kế toán: filter "Cần đối soát" có đếm, tone cảnh báo cho chưa khớp; hạ ngưỡng container-query | M |
| Thư viện `lib/format` + `lib/datetime` dùng chung; thống nhất ₫, "triệu/tỷ"; pass thuật ngữ + glossary; thay 90 thông báo mã quyền | S–M |
| Security headers; Sentry/log drain; cảnh báo webhook 5xx và cron lỗi; gate deploy theo CI; PITR + diễn tập restore | M |
| Xóa 5k dòng code mock; Prettier + `max-lines`; tách 5 component >1.000 dòng | M |

### Đợt 3 — Mở rộng giá trị (8–12 tuần, cần quyết định sản phẩm)

| Việc | Effort | Vì sao |
|---|---|---|
| **Giáo viên/trợ giảng gắn lớp & buổi**, thay dạy, "buổi của tôi hôm nay", phát hiện trùng lịch; nối ca trợ giảng với buổi để phụ cấp dựa trên bằng chứng | L | Nền cho lịch, chi phí theo lớp, phụ cấp đúng |
| **Kênh phụ huynh** (Zalo OA/ZNS trước, SMS/email sau): vắng mặt, điểm sau khi khóa, thông báo học phí, đổi lịch; hàng đợi gửi + log | L | Kỳ vọng cốt lõi của trung tâm; giảm nhắn tay; tăng tỷ lệ gia hạn |
| **Bộ báo cáo tài chính**: thu theo kỳ (đã/chưa/quá hạn), tuổi nợ, tiền chưa phân bổ, doanh thu theo lớp/khối, chuyển đổi CRM theo nguồn, retention theo tháng | M–L | Hiện không có báo cáo nào |
| **Ghi nhận doanh thu**: trừ lô tín dụng FIFO, đơn giá trên `session_charge` → doanh thu đã/chưa thực hiện, định giá hoàn tiền, bật lại hoàn tiền an toàn | L | Kế toán đúng; mở đường cho hoàn tiền |
| Lịch tuần/tháng cho buổi học và ca làm; sức chứa lớp + waitlist; tín dụng học bù theo học sinh | M | Lễ tân thấy chỗ trống; công bằng với phụ huynh |
| Chăm sóc học viên: bật module, thêm tín hiệu tài chính (sắp hết buổi, phiếu quá hạn), eligibility theo ma trận quyền | M | Module đã làm nhưng đang tắt |
| Ghi chi (lương, tạm ứng) vào cashflow → dòng tiền ròng thật | M | Dashboard chi phí hiện luôn 0 |

---

## 4. Quyết định của chủ trung tâm (chốt 10/10/2026)

| # | Câu hỏi | Quyết định | Tác động lên lộ trình |
|---|---|---|---|
| 1 | Vắng có phép có trừ buổi không? | **Có trừ buổi**, giữ như hiện tại. | Bỏ hạng mục "tín dụng học bù theo học sinh" khỏi Đợt 2; A5 không còn là lỗi. |
| 2 | Ca tự đóng tính lương thế nào? | **Đổi giờ tự đóng theo vai trò**: trợ giảng **22:30**, các vai trò còn lại **22:45** (hiện 23:30 cho tất cả). Ca tự đóng vẫn được tính lương tới mốc đó. | Đợt 1: sửa watchdog `20260915170000` thành mốc theo role; vẫn giữ badge "tự đóng" trên bảng công để quản lý biết. Không làm hàng đợi duyệt ca tự đóng. |
| 3 | Chấm công online cần bằng chứng gì? | **Phải trùng ca trong phân công lịch** do chủ trung tâm hoặc trợ lý quản lý xếp (`staff_shift_assignments`). Không có ca xếp thì không check-in online được. **Grace 15 phút** trước/sau ca. | Đợt 1: `check_in_time_entry` với mode `online` bắt buộc `staff_shift_assignment_id` khớp ngày/giờ ±15 phút; bỏ `allow_unscheduled_timekeeping` cho online. |
| 4 | Tiền phụ huynh chuyển dư xử lý thế nào? | **Người có quyền (kế toán/chủ trung tâm) tự xác định thủ công số buổi cộng thêm.** Không quy đổi tự động. | Đợt 1: giao dịch > phiếu không còn kẹt ở `amount_mismatch`; màn hình đối soát cho phép khớp với phiếu và nhập "buổi cộng thêm" (mặc định gợi ý `floor(dư/đơn giá)`, người dùng sửa được, có lý do + audit). Phiếu chuyển `paid`, ledger ghi đủ buổi mua + buổi cộng thêm. |
| 5 | Ưu tiên Đợt 3? | Theo thứ tự: **(a) kênh Zalo cho phụ huynh, (b) bộ báo cáo tài chính, (c) ghi nhận doanh thu theo lô, (d) lịch tuần/tháng + sức chứa lớp.** | Mô hình giáo viên gắn lớp/buổi lùi sau (d); tuy nhiên (d) lịch tuần cần ít nhất trường giáo viên trên lớp để hiển thị, sẽ làm tối thiểu trong (d). |
| 6 | Chương trình redesign A–H | Chưa chốt. Đề xuất: lấy Wave 1 (token + primitive) làm Đợt 0/2, bỏ ràng buộc "không phân trang server". | — |

---

## 5. Giới hạn của bản rà soát này

- Chỉ đọc code, chưa chạy app, chưa thử trên trình duyệt/điện thoại thật, chưa xem dữ liệu production. Các nhận định về giao diện là suy ra từ mã và một lần compile Tailwind trong bộ nhớ.
- Chưa phỏng vấn người dùng (kế toán, trợ giảng, lễ tân) nên thứ tự ưu tiên trong lộ trình là đề xuất kỹ thuật, cần đối chiếu với điểm đau thực tế.
- Mức độ của S3 phụ thuộc cấu hình Auth trên Supabase production, cần kiểm tra trực tiếp trong dashboard Supabase.
