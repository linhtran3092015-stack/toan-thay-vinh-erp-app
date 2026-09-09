# BẢN ĐẶC TẢ THIẾT KẾ GIAO DIỆN ERP & ZALO CRM (THEO PHONG CÁCH STUMANA)
## Dành cho CodeX thực thi | Ngày tạo: 2026-09-09 | Phiên bản: v1.0

![Giao diện StuMana thực tế](/Users/linhtran/.gemini/antigravity/brain/f1e6e16e-7e78-4cc3-ae19-eee70556a5d6/.user_uploaded/media_1788888428588.png)

---

## 1. PHÂN TÍCH CHUYÊN SÂU GIAO DIỆN STUMANA.COM

Dựa trên phân tích mã nguồn CSS/JS (`application.css`, Tailwind v4.3.3) và ảnh chụp thực tế màn hình Dashboard (`https://stumana.com/dashboard`), StuMana đại diện cho thế hệ **Modern Friendly EdTech SaaS** — thoát khỏi phong cách ERP quản trị khô cứng truyền thống để hướng tới sự gần gũi, tinh tế và thúc đẩy hành động (action-driven).

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ TOPBAR: [Biểu tượng sách] Hôm nay          [Trang trí Festive / Ruy băng]     [Chuông] [Avatar]│
├─────────────────┬────────────────────────────────────────────────────────────────────────┤
│ SIDEBAR (240px) │ MAIN CONTENT WORKSPACE                                                 │
│ [TRU] Trung tâm │ ┌────────────────────────────────────────────────────────────┐         │
│                 │ │ BẮT ĐẦU (Onboarding Checklist)                   Xong 3/8  │         │
│ VIỆC CHÍNH      │ │ [================== Tiến độ ===================]           │         │
│ ☀️ Hôm nay (Pill)│ │ [x] Tạo trung tâm      [ ] Thêm học viên       [Thực hiện] │         │
│ 🎓 Học sinh     │ └────────────────────────────────────────────────────────────┘         │
│ 📖 Khóa học     │                                                                        │
│ 👤 Điểm danh    │ Chào Linh Trần Văn                                                     │
│ 📅 Lịch học     │ 09 Tháng chín, 2026 · 1 buổi dạy hôm nay                               │
│ 📊 Thư viện     │                                                                        │
│                 │ ┌─────────────────────────────────┐  ┌───────────────────────────────┐ │
│ VẬN HÀNH        │ │ HERO SESSION CARD (Hồng pastel) │  │ HÔM NAY           Xem cả tuần │ │
│ 🏢 Vận hành (▼) │ │ Còn 17 giờ 34 phút              │  │ ● 18:00 Toán 2       [Sắp tới]│ │
│                 │ │ Toán 2 (18:00 - 20:00)          │  ├───────────────────────────────┤ │
│ AI              │ │ [ Xem buổi học ]  Xem nội dung  │  │ TỔNG QUAN         Xem báo cáo │ │
│ ✨ Trợ lý AI [Mới]│ └─────────────────────────────────┘  │ 12 Học sinh       3.5Tr VND   │ │
│ 💬 Cộng đồng    │ ┌─────────────────────────────────┐  └───────────────────────────────┘ │
│                 │ │ CẦN BẠN XỬ LÝ (All-good state)  │                                    │
│ ...Footer nav   │ │ (v) Mọi việc khác đều ổn        │                                    │
│ [11 ngày thử]   │ └─────────────────────────────────┘                                    │
└─────────────────┴────────────────────────────────────────────────────────────────────────┘
```

---

### 1.1 Hệ thống Màu sắc (Color Palette & Semantic Tokens)
StuMana dùng hệ màu **Pastel Tint kết hợp Accent rực rỡ**:
- **Canvas / Background**: Màu kem nhẹ ấm áp `#FBF8F6` hoặc `#FDF2EE` (thay vì nền xám lạnh hay trắng tinh).
- **Primary / Brand Accent**: Đỏ san hô / Terracotta rực rỡ (`#DA251D` / `#E8505B` / `#B95F42`). Mang lại cảm giác năng động, hứng khởi cho việc học tập và giảng dạy.
- **Mana Soft / Surface Wash**: Nền thẻ làm bằng các tông màu wash rất nhẹ (`#FDEEEC`, `#FFF5ED`, `#EDF8F6`, `#F5F2FB`) với độ trong suốt tinh tế.
- **Delight / Warm Accent**: Màu vàng hổ phách / cam ấm (`#FFCD00`, `#F5B98A`, `#E8C36C`) dùng cho các điểm nhấn huy hiệu, ngôi sao, icon tính năng mới.
- **Neutral / Text Contrast**:
  - `Text Strong`: `#17171C` / `#1F2937` (đen than chì, tương phản cao, dễ đọc).
  - `Text Muted`: `#5B5B66` / `#6B7280` (xám trung tính cho mô tả, thời gian).
  - `Line / Border`: `#E6E3DD` / `#F0EEE9` (viền mỏng 1px rất thanh thoát).
- **Status Badges**:
  - `Success`: `#10B981` (xanh ngọc ấm) trên nền `#E7F8F1`.
  - `Warning / Sắp tới`: `#F59E0B` trên nền `#FEF6E7`.
  - `Destructive`: `#E11D48` trên nền `#FFE4E6`.

---

### 1.2 Phông chữ & Typography
StuMana nhúng và phối hợp 3 họ font tạo nên cá tính riêng:
1. **Be Vietnam Pro**: Dùng làm font nền tảng cho văn bản tiếng Việt, bảng dữ liệu, nhãn form, số liệu (hỗ trợ `tabular-nums` hoàn hảo, dấu tiếng Việt đẹp chuẩn).
2. **Google Sans / Quicksand**: Dùng cho Headline chính ("Hôm nay", "Chào Linh Trần Văn", "Bắt đầu") với nét tròn trịa, hiện đại, tạo cảm giác thân thiện, tích cực.
3. **Mali / Bellota**: Dùng điểm xuyết cho các ghi chú, tooltip, huy hiệu mang tính khích lệ, gần gũi với giáo dục.

**Quy tắc phân cấp cỡ chữ:**
- Page Headline: `24px - 28px` (Font-bold, leading tight).
- Card Section Title: `18px - 20px` (Font-semibold).
- Body standard: `14px / 20px` (Regular 400 hoặc Medium 500).
- Secondary / Caption: `12px - 13px` (Muted).
- Micro Badges: `11px - 12px` (Font-semibold, uppercase hoặc capitalize).

---

### 1.3 Bố cục (Layout & Spatial Rhythm)
- **Cấu trúc lưới 2 cột bất đối xứng (2:1)**:
  - Cột chính (65%): Dành cho luồng hành động chính — Thẻ đếm ngược buổi học tiếp theo (Hero card) và khu vực "Cần bạn xử lý" (Action items).
  - Cột phụ (35%): Dành cho tóm tắt lịch trình tuần ("Hôm nay", "Xem cả tuần") và thẻ số liệu nhanh ("Tổng quan").
- **Độ bo góc (Border Radius Hierarchy)**:
  - Cards & Hero Blocks: `rounded-2xl` (16px) đến `rounded-3xl` (24px) tạo cảm giác cực kỳ mềm mại, không góc cạnh.
  - Buttons & Inputs: `rounded-xl` (12px) hoặc `rounded-full` (cho pill buttons).
  - Badges / Tags: `rounded-full` (dạng viên thuốc pill).
- **Khoảng cách (Spacing)**: Nhịp 4px/8px chuẩn mực:
  - Page padding: `24px` desktop, `16px` mobile.
  - Card gap: `20px - 24px`.
  - Inner card padding: `20px - 24px`.

---

### 1.4 Thanh Sidebar & Menu Xổ
- **Thương hiệu & Chọn cơ sở**: Header Sidebar chứa Avatar tròn + Tên trung tâm + Icon mũi tên xổ (Dropdown switcher). Có điểm nhấn huy hiệu ngày hội (Festive element).
- **Phân nhóm Menu rõ ràng**:
  - `VIỆC CHÍNH`: Hôm nay, Học sinh, Khóa học, Điểm danh, Lịch học, Thư viện.
  - `VẬN HÀNH`: Menu có khả năng xổ xuống (Dropdown / Accordion con).
  - `AI`: Trợ lý AI (kèm Badge đỏ **Mới**), Cộng đồng.
  - `CHÂN TRANG (Pinned Bottom)`: Hỗ trợ, Ưu đãi [Mới], Công cụ [Mới], Cài đặt trung tâm, Thông tin gói thuê bao.
- **Trạng thái Active**:
  - Menu active ("Hôm nay"): Background màu đỏ cam / terracotta phủ trọn (`bg-primary`), chữ trắng, icon trắng, bo góc mềm `rounded-xl`.
  - Menu hover: Background màu tinted wash nhẹ (`hover:bg-sidebar-accent`), transition 150ms.

---

### 1.5 Nút bấm (Button System) & Vi tương tác
1. **Primary Button ("Tiếp tục thiết lập", "Xem buổi học", "Cài đặt")**:
   - Nền solid `#DA251D` / `#E8505B`, chữ trắng, bo góc mềm `rounded-xl` hoặc `rounded-full`.
   - Shadow nhẹ cùng tông màu (`shadow-lg shadow-red-500/20`), hover scale nhẹ hoặc đậm màu hơn 5%.
2. **Ghost / Text Button ("Xem nội dung bài", "Ẩn danh sách này", "Xem cả tuần")**:
   - Không nền, màu chữ accent đỏ cam hoặc xám trung tính, hover gạch chân hoặc đổi màu nhẹ.
3. **Pill Action ("Thực hiện", "Sắp tới")**:
   - Nút nhỏ gọn bên phải mỗi dòng checklist hoặc dòng lịch trình, thu hút sự chú ý vừa đủ.

---

### 1.6 Các thành phần đặc sắc của StuMana
1. **Onboarding / Setup Progress Widget**:
   - Thanh đo tiến độ ("Xong 3/8") với thanh progress bar màu đỏ cam.
   - Các bước hoàn thành có dấu tích tròn màu đỏ cam gạch ngang chữ; các bước chưa làm có icon rỗng và nút "Thực hiện".
2. **Hero Session Card ("Toán 2 - 18:00 - 20:00")**:
   - Tính toán thời gian thực: "Còn 17 giờ 34 phút".
   - Câu nhắc nhở tâm lý: "Bạn còn thời gian chuẩn bị".
   - Nút hành động trực diện: "Xem buổi học" và "Xem nội dung bài".
3. **Empty State / "All Good" State ("Cần bạn xử lý")**:
   - Thay vì bảng trống vô hồn, hiển thị thông điệp tích cực: *"Mọi việc khác đều ổn, không có gì cần bạn ngay bây giờ."* Tạo cảm giác yên tâm cho người vận hành.
4. **Toast / Floater Notification (Góc dưới phải)**:
   - Thẻ nổi tinh tế bo tròn lớn nhắc việc hoặc hướng dẫn cài đặt PWA App.

---

## 2. BẢN THIẾT KẾ ÁP DỤNG CHO TOÁN THẦY VINH ERP & ZALOCRM

Chuyển thể tinh hoa của StuMana vào hệ thống thực tế của Toán Thầy Vinh:

### 2.1 Ma trận màu sắc đề xuất (VinhMath ERP Palette - Tương thích StuMana)

```css
:root {
  /* Canvas & Base Surface */
  --canvas-bg: #FDF9F7;               /* Nền trang kem ấm áp như StuMana */
  --surface-card: #FFFFFF;            /* Nền thẻ trắng tinh khiết */
  --surface-soft: #FFF1EE;            /* Nền thẻ nổi bật / Hero block */
  --surface-hover: #F8ECE8;           /* Hover nền mềm */

  /* Primary Accent: VinhMath Red-Coral (Kế thừa tông đỏ StuMana) */
  --color-primary: #DA251D;           /* Đỏ cờ / Đỏ thương hiệu năng động */
  --color-primary-hover: #C01B14;
  --color-primary-soft: #FDEEEC;      /* Đỏ nhạt cho active menu / tag */
  --color-primary-text: #FFFFFF;

  /* Secondary Accent: VinhMath Warm Gold (Tông Delight) */
  --color-accent: #E89A3C;            /* Vàng cam ấm áp cho KPI, sao, quà */
  --color-accent-soft: #FEF6EC;

  /* Typography */
  --font-display: 'Google Sans', 'Quicksand', 'Be Vietnam Pro', sans-serif;
  --font-body: 'Be Vietnam Pro', sans-serif;
  --text-main: #1A1D20;
  --text-muted: #626871;
  --text-subtle: #949BA5;

  /* Borders & Radius */
  --border-subtle: #F0EAE6;
  --radius-card: 18px;                /* Bo góc 18px chuẩn StuMana */
  --radius-btn: 12px;
  --radius-pill: 9999px;
}
```

---

### 2.2 Kiến trúc Dashboard "Hôm nay" mới cho Toán Thầy Vinh ERP

Thay thế trang Dashboard tĩnh hiện tại bằng Dashboard tương tác 3 tầng phong cách StuMana:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ TOPBAR: ☀️ Hôm nay   [Lớp học đang diễn ra: 1 lớp]   [QR Thu phí]   [🔔 Thông báo] [Avatar]│
├─────────────────┬────────────────────────────────────────────────────────────────────────┤
│ SIDEBAR (240px) │ WORKSPACE CHÍNH (Cấu trúc 2 cột tỷ lệ 65% : 35%)                       │
│ 📐 Toán Thầy Vinh│                                                                        │
│ Cơ sở chính (▼) │ ┌────────────────────────────────────────────────────────────┐         │
│                 │ │ CHECKLIST VẬN HÀNH HÔM NAY                       Xong 4/6  │         │
│ VIỆC CHÍNH      │ │ [================== Tiến độ 67% ===============]           │         │
│ ☀️ Hôm nay (Active)│ [x] Mở ca học sáng         [ ] Điểm danh lớp Toán 9A1 [Thực hiện] │
│ 🎓 Học viên     │ │ [ ] Khóa sổ ca chiều       [ ] Duyệt 2 khoản SePay   [Kiểm tra]  │         │
│ 🏫 Lớp học      │ └────────────────────────────────────────────────────────────┘         │
│ 📅 Buổi & Lịch  │                                                                        │
│ 👤 Điểm danh    │ Chào Thầy Vinh / Quản trị viên                                         │
│                 │ Hôm nay có 4 buổi học · 58 học sinh cần theo dõi                       │
│ ZALO CRM        │                                                                        │
│ 💬 Hội thoại Zalo│ ┌─────────────────────────────────┐  ┌───────────────────────────────┐ │
│ 🎯 Khách tiềm năng│ │ HERO SESSION CARD (Buổi kế tiếp)│  │ LỊCH HỌC HÔM NAY  Xem tuần   │ │
│ 📝 Đặt học thử   │ │ Còn 45 phút nữa bắt đầu         │  │ ● 15:30 Toán 9A1    [Đang học]│ │
│                 │ │ TOÁN 9 - NÂNG CAO (Phòng 201)   │  │ ● 18:00 Toán 12 VIP  [Sắp tới]│ │
│ TÀI CHÍNH       │ │ Sĩ số: 18/20 HS · Trợ giảng: Lan│  │ ● 19:45 Toán 10 CB   [Sắp tới]│ │
│ 💳 Học phí      │ │ [ Bắt đầu điểm danh ] [Xem đề]  │  ├───────────────────────────────┤ │
│ ⚡ Giao dịch SePay│ └─────────────────────────────────┘  │ CÔNG NỢ & SỐ BUỔI             │ │
│                 │ ┌─────────────────────────────────┐  │ ⚠️ 3 học sinh hết số buổi     │ │
│ NHÂN SỰ         │ │ CẦN XỬ LÝ (Task Alert Box)      │  │ ⚡ 2 giao dịch SePay chờ khớp │ │
│ 👥 Giáo viên/TA │ │ • 2 đơn xin nghỉ phép buổi tối  │  │ [ Xem chi tiết sổ cái ]       │ │
│ ⚙️ Cài đặt       │ │ • 1 học sinh cần gọi bù bài     │  └───────────────────────────────┘ │
│                 │ └─────────────────────────────────┘                                    │
└─────────────────┴────────────────────────────────────────────────────────────────────────┘
```

---

### 2.3 Thiết kế Phân hệ ZaloCRM theo phong cách StuMana

Áp dụng phong cách thẻ bo tròn mềm mại và bảng màu pastel cho phân hệ **ZaloCRM**:
1. **Khung chat ZaloCRM 3 cột chuẩn hiện đại**:
   - Cột 1 (Danh sách hội thoại): Avatar khách hàng có badge Zalo, tên phụ huynh/học sinh, tin nhắn gần nhất, nhãn trạng thái Lead (Mới, Đang tư vấn, Đã hẹn test, Đã đăng ký học thử).
   - Cột 2 (Khung chat trung tâm): Khung chat tròn trịa, bubble chat màu đỏ cam cho tin nhắn đi (`bg-primary text-white rounded-2xl rounded-tr-sm`) và bubble xám kem cho tin nhắn đến (`bg-surface-soft text-text-main rounded-2xl rounded-tl-sm`).
   - Cột 3 (Drawer thông tin học viên & Phễu tuyển sinh): Thẻ hồ sơ học viên kiểu StuMana với:
     + Họ tên phụ huynh, SĐT, Facebook/Zalo ID.
     + Tiến trình Checklist chuyển đổi 10 tiêu chí (Checklist items 10 bước như StuMana Onboarding).
     + Nút Primary Action: **"Đặt lịch học thử ngay"** và **"Chuyển thành học viên chính thức"**.

---

## 3. KẾ HOẠCH BÀN GIAO CHO CODEX (CODEX HANDOFF TASKS)

Tài liệu này được định dạng để CodeX có thể tiếp nhận và triển khai thành các Pull Request cụ thể:

### Task C1: Khởi tạo Design Tokens & StuMana Theme Presets
- **Phạm vi**: `src/app/globals.css`, `src/components/ui/`
- **Mục tiêu**:
  - Bổ sung biến CSS Theme `--canvas-bg`, `--surface-soft`, `--color-primary` (tông đỏ cam StuMana `#DA251D`), `--color-accent` (`#E89A3C`), `--radius-card: 18px`.
  - Cập nhật font chữ Google Sans / Quicksand kết hợp Be Vietnam Pro trong Next.js `layout.tsx`.
  - Nâng cấp các primitives: `Button` (thêm variant `hero`, `pill`), `Badge` (thêm variant `pill-soft`), `Card` (tùy chọn borderless shadow-soft).

### Task C2: Tái cấu trúc Shell & Sidebar theo chuẩn StuMana
- **Phạm vi**: `src/components/layout/sidebar.tsx`, `src/components/layout/topbar.tsx`, `src/config/navigation.ts`
- **Mục tiêu**:
  - Cập nhật Sidebar: Nhóm phân mục `VIỆC CHÍNH`, `ZALO CRM`, `TÀI CHÍNH`, `NHÂN SỰ`, `HỆ THỐNG`.
  - Menu Active State: Nút dạng viên thuốc bo tròn đỏ cam (`bg-primary text-white shadow-sm`), icon đồng màu.
  - Thêm tính năng Submenu xổ (Collapsible/Accordion) mượt mà cho các nhóm tính năng mở rộng.
  - Thêm badge **Mới** (đỏ cam pill) cho các module đang kích hoạt (ZaloCRM, SePay).
  - Chân Sidebar: Widget thông tin cơ sở và hotline hỗ trợ kỹ thuật.

### Task C3: Xây dựng màn hình Dashboard "Hôm nay" kiểu StuMana
- **Phạm vi**: `src/features/dashboard/`, `src/app/page.tsx`
- **Mục tiêu**:
  - `OperationalChecklistCard.tsx`: Thẻ tiến độ việc cần làm với Progress bar và nút "Thực hiện".
  - `HeroNextSessionCard.tsx`: Thẻ buổi dạy kế tiếp nền hồng pastel, đồng hồ đếm ngược, nút "Điểm danh nhanh" và "Xem danh sách lớp".
  - `TodayScheduleSummary.tsx`: Cột phụ tóm tắt lịch học các lớp trong ngày với tag trạng thái [Đang học], [Sắp tới], [Đã xong].
  - `ActionRequiredCard.tsx`: Hiển thị cảnh báo học phí âm buổi hoặc đơn xin nghỉ phép; nếu không có gì cần xử lý thì hiển thị thông điệp tích cực "Mọi việc đều ổn".

### Task C4: Tái cấu trúc giao diện ZaloCRM theo thẩm mỹ StuMana
- **Phạm vi**: `src/features/crm/components/`
- **Mục tiêu**:
  - Thiết kế lại danh sách Lead CRM với Filter Bar tối giản (Search + Dropdown trạng thái).
  - Tích hợp thẻ Conversion Checklist 10 bước phong cách StuMana vào `crm-convert-dialog.tsx`.
  - Tối ưu hóa bảng dữ liệu `crm-table.tsx` với avatar tròn, tag trạng thái pill mềm và nút hành động nhanh.

---

## 4. HƯỚNG DẪN PROMPT MẪU CHO CODEX

Khi chuyển giao cho CodeX, anh có thể gửi prompt sau:

> *"Chào CodeX, hãy đọc tài liệu đặc tả `docs/redesign/STUMANA_ANALYSIS_AND_ERP_DESIGN_SPEC.md` và `DESIGN.md`. Nhiệm vụ của bạn là thực hiện Task C3: Xây dựng màn hình Dashboard 'Hôm nay' mới cho ERP Toán Thầy Vinh theo chuẩn thiết kế StuMana (Bố cục 2 cột, Hero Session Card đếm ngược, Checklist vận hành hằng ngày, Palette màu đỏ cam `#DA251D` trên nền kem ấm `#FDF9F7`, bo góc mềm `rounded-2xl`). Hãy tuân thủ nghiêm ngặt quy tắc App Router Next.js 16 và Supabase Server Action trong `docs/CODEX_MASTER_PROMPT.md`."*
