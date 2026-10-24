# Đánh giá tích hợp ERP ↔ ZaloCRM (13/10/2026)

Nguồn khảo sát: `~/Downloads/ZaloCRM` (ZCRM v3.4, fork mã nguồn mở AGPL-3.0 của locphamnguyen/ZaloCRM, có bản vá riêng `my_customizations.patch`), đang chạy tại `https://crm.vanlinhtran.id.vn` (Docker: Fastify + Prisma/Postgres + Redis + MinIO; kết nối Zalo cá nhân qua SDK không chính thức zca-js).

## 1. ZaloCRM có gì dùng được cho ERP

| Khả năng | Cách gọi | Ghi chú |
|---|---|---|
| Gửi tin nhắn từ một nick Zalo cá nhân tới một người/nhóm | `POST /api/public/messages/send` (header `X-Api-Key`), body `{ zaloAccountId, threadId, content, threadType }` | `threadId` là Zalo UID của người nhận; nick phải ở trạng thái `connected` |
| Tra cứu khách hàng theo SĐT | `GET /api/public/contacts?search=<sđt>` | Trả `id, fullName, phone, tags…`; **chưa trả `zaloUid`** (cần vá 1 dòng) |
| Tạo / cập nhật khách hàng, ghi chú, lịch hẹn | `POST/PUT /api/public/contacts`, `/api/public/appointments` | Dùng để đồng bộ phụ huynh từ ERP sang CRM |
| Danh sách hội thoại + đọc tin | `GET /api/public/conversations`, `/conversations/:id/messages` | Không lọc theo khách hàng, chỉ 100 hội thoại mới nhất |
| Mẫu tin, danh sách khách, chiến dịch broadcast theo lịch, quy tắc tự động | API v1 (JWT, không phải API key) | Dùng cho tin marketing hàng loạt; không phù hợp tin giao dịch từng người |
| Webhook ra ngoài (Zapier-style) | Integrations → `zapier-webhook` | Hiện chỉ sự kiện `contacts.sync`; chưa có sự kiện "tin nhắn đến" |

Mô hình dữ liệu khớp với ERP: `Contact.phoneNormalized` (dạng `84xxx`) ↔ `guardians.normalized_phone` (dạng `0xxx`) — chỉ cần chuẩn hóa `0` ↔ `84` khi so khớp.

## 2. Kiến trúc tích hợp đề xuất

```
ERP (Supabase)                     Vercel Cron (mỗi phút)              ZaloCRM
trigger nghiệp vụ ─► parent_messages ─► /api/cron/parent-messages ─► POST /api/public/messages/send
(vắng, điểm, học phí,  (hàng đợi, dedupe)   (service role, lấy ≤20 tin,   (nick trung tâm hoặc nick
 đổi lịch, sắp hết buổi)                     tra Zalo UID theo SĐT)        trợ giảng phụ trách lớp)
                                              ◄── cập nhật sent/failed ──┘
```

- **ERP giữ hàng đợi và nhật ký** (bảng `parent_messages`, trang Tin nhắn phụ huynh, cài đặt bật/tắt từng loại tin, giờ không gửi 21:00–07:00) — đúng phần đã thiết kế ở Đợt 3a, chỉ đổi "bộ gửi" từ ZNS sang ZaloCRM.
- **Ánh xạ phụ huynh ↔ Zalo**: lần gửi đầu tra `GET /api/public/contacts?search=<sđt>` lấy `zaloUid`, lưu vào `guardians.zalo_uid` (+ `zalo_crm_contact_id`); không tìm thấy → tin ở trạng thái `skipped` kèm lý do "phụ huynh chưa kết bạn Zalo với nick trung tâm", lễ tân thấy để xử lý tay.
- **Nick gửi**: cài đặt `zalo.default_account_id` (nick trung tâm) và tùy chọn nick theo lớp/trợ giảng (bảng `class_zalo_accounts`) để tin vắng mặt đi từ trợ giảng quen thuộc.
- **Secrets**: `ZALOCRM_BASE_URL`, `ZALOCRM_API_KEY` đặt trên Vercel (API key lấy trong ZaloCRM → Cài đặt → API & Webhook, `/settings/dev/api`).

## 2b. Gửi vào nhóm sổ liên lạc theo UID nhóm (quyết định chủ trung tâm 13/10/2026)

Mỗi học sinh có một nhóm Zalo "sổ liên lạc" (SLL). Tên nhóm không dùng làm khóa vì anh em ruột thường trùng tên nhóm (cùng SĐT phụ huynh) và nhóm có thể bị đổi tên. Khóa ổn định là **UID nhóm Zalo** = `Conversation.externalThreadId` (threadType `group`) trong ZaloCRM, kèm nick đang ở trong nhóm (`zaloAccountId`).

- **ERP lưu trên học sinh**: `zalo_group_thread_id`, `zalo_account_id`, `zalo_group_name_snapshot`, `zalo_group_linked_at/by`. Gửi tin: `POST /api/public/messages/send` với `threadType: "group"`, `threadId = zalo_group_thread_id`.
- **Liên kết nhóm ↔ học sinh** (một lần, trên hồ sơ học sinh và công cụ liên kết hàng loạt): ERP gọi ZaloCRM lấy danh sách nhóm (UID, tên hiện tại, số thành viên, tên thành viên từ GroupScan) → gợi ý theo tên học sinh / SĐT phụ huynh có trong thành viên → lễ tân xác nhận → lưu UID. Anh em ruột phân biệt bằng thành viên và tên nhóm hiện tại; sau khi lưu UID thì đổi tên nhóm không ảnh hưởng.
- **Hiển thị tên nhóm** trên hồ sơ luôn lấy theo UID từ ZaloCRM (tên mới nhất), có nút "Kiểm tra lại liên kết" báo nếu nick đã rời nhóm hoặc nhóm không còn.
- Phụ huynh không có nhóm SLL: dự phòng gửi tin cá nhân theo Zalo UID phụ huynh (mục 2), hoặc `skipped`.

## 3. Cần vá gì bên ZaloCRM (nhỏ, ~0,5–1 ngày)

0. `GET /api/public/conversations` thêm lọc `threadType=group`, `search=` theo `groupName`, phân trang, trả `groupName`, `groupMembersCount`, `zaloAccountId`; thêm `GET /api/public/conversations/by-thread/:externalThreadId` (kiểm tra liên kết) và `GET /api/public/groups/:externalThreadId/members` (từ GroupMember, để gợi ý ghép theo SĐT/tên phụ huynh).

1. `GET /api/public/contacts` trả thêm `zaloUid`, `zaloGlobalId`, `phoneNormalized`, và nhận tham số `phone=` khớp chính xác theo `phoneNormalized` (hiện chỉ `contains`).
2. `POST /api/public/messages/send` nhận thêm `contactId` hoặc `phone` thay cho `threadId` (server tự tra UID); trả `messageId` để ERP lưu đối chiếu.
3. (Tùy chọn) sự kiện webhook `message.received` để ERP ghi "phụ huynh đã trả lời" vào hồ sơ học sinh.

Repo là fork của anh/chị nên vá trực tiếp rồi deploy lại bằng `scripts/zalocrm-deploy.sh`. Nhớ giữ `my_customizations.patch` khi cập nhật upstream.

## 4. Rủi ro và cách giảm

| Rủi ro | Giảm thiểu |
|---|---|
| Zalo cá nhân + SDK không chính thức có thể bị khóa nick khi gửi nhiều/giống nhau | Chỉ gửi tin giao dịch cá nhân hóa (≤ vài trăm tin/ngày), giãn 3–5 giây/tin, không gửi 21:00–07:00, không broadcast quảng cáo từ nick này |
| Nick mất kết nối (hết phiên, đổi máy) | Health check mỗi 15 phút gọi `GET /api/public/contacts?limit=1` + kiểm tra `status` nick; lỗi → cảnh báo vận hành (`raise_ops_alert`) và tin xếp hàng chờ, không mất |
| Phụ huynh chưa kết bạn | Tin `skipped` + nhắc lễ tân gửi lời mời; hiển thị tỉ lệ phủ Zalo theo lớp |
| ZaloCRM ngừng hoạt động | Hàng đợi ở ERP, retry 3 lần cách 10 phút, tin quá 24 giờ chuyển `expired` kèm cảnh báo |
| Giấy phép AGPL | Dùng nội bộ hoàn toàn hợp lệ; chỉ khi cung cấp ZaloCRM đã sửa cho bên thứ ba qua mạng mới phải công bố mã |

## 5. Khối lượng

| Phần | Việc | Thời gian |
|---|---|---|
| ERP | Bảng hàng đợi + 6 trigger sự kiện + cron route + client ZaloCRM + trang Tin nhắn phụ huynh + cài đặt | 4–5 ngày |
| ZaloCRM | Vá 2 endpoint public + deploy | 0,5 ngày |
| Thử nghiệm | 1 lớp, 1 tuần, chỉ bật tin vắng mặt và nhắc học phí | 1 tuần theo dõi |

So với kế hoạch 3a (Zalo OA/ZNS): bỏ được đăng ký OA, duyệt mẫu ZNS và phí theo tin; đổi lại phụ thuộc vào nick cá nhân và SDK không chính thức.

## 6. Đã triển khai (v0.6.21.0, 13/10/2026) và cách bật

Quyết định: gửi từ nick trung tâm; hai loại tin đầu là vắng không phép và nhận xét cuối buổi; trợ giảng bấm Gửi trong hàng đợi.

1. **ZaloCRM**: fork đã có commit `dc1f3829` (API public: lọc nhóm, tra nhóm theo UID, thành viên nhóm, danh sách nick, gửi tin trả messageId). Đã deploy trên CRM (kiểm tra 24/10/2026: `/api/public/groups/:id/members` trả 401 thay vì 404). Lấy API key tại ZaloCRM → Cài đặt → API & Webhook (`/settings/dev/api`); chỉ bấm "Tạo key mới" khi ô trống vì key mới thay key cũ.
2. **Vercel** → Environment Variables: `ZALOCRM_BASE_URL=https://crm.vanlinhtran.id.vn`, `ZALOCRM_API_KEY=<key>` → redeploy.
3. **ERP** → Cài đặt → Chung → mục "Tin nhắn phụ huynh (Zalo)": bấm "Tải danh sách nick", chọn nick trung tâm, lưu. Kiểm tra mẫu tin.
4. **Liên kết nhóm Zalo** (`/parent-messages/groups`, từ v0.41: nút trên trang Tin nhắn phụ huynh, cần quyền xem + sửa học sinh): bảng "Kết nối ZaloCRM" 5 bước cho biết bước nào còn thiếu; bảng gợi ý ghép nhóm cho mọi học sinh đang học chưa liên kết, dựa trên tên nhóm hiện tại (mã học sinh, họ tên đầy đủ, SĐT/tên phụ huynh). Dòng "Chắc chắn" được chọn sẵn, dòng "Cần chọn" (anh em, trùng tên) chọn trong danh sách hoặc bấm Tìm nhóm để xem thành viên, rồi bấm "Liên kết N học sinh". Từng học sinh vẫn sửa được trên hồ sơ → thẻ "Nhóm Zalo sổ liên lạc". Chưa liên kết thì không tạo tin.
5. **Trợ giảng**: menu Vận hành → Chăm sóc & Tuyển sinh → "Tin nhắn phụ huynh" (trước v0.7.0.0 nằm trong Học vụ) → xem tin chờ, sửa nếu cần, bấm "Gửi vào nhóm Zalo".

## 7. Quyết định cần chủ trung tâm (các bước sau)

1. Gửi từ một nick trung tâm hay từ nick trợ giảng phụ trách lớp?
2. Bật những loại tin nào ở giai đoạn đầu (đề xuất: vắng không phép, nhắc học phí trước hạn, xác nhận đã nhận tiền)?
3. Tin tự gửi hay chờ lễ tân bấm "Gửi" trong hàng đợi (an toàn hơn trong 2 tuần đầu)?
4. Cho phép tôi vá 2 endpoint trong fork ZaloCRM và deploy lại CRM không?
