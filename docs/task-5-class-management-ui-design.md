# Task 5 — Class Management UI Architecture

## Route

- `/classes`: danh sách lớp
- `/classes/academic-years`: quản lý năm học
- `/classes/new`: tạo lớp
- `/classes/[classId]`: chi tiết lớp và lịch
- `/classes/[classId]/edit`: sửa lớp

## Permission

- Xem dữ liệu: `classes.view`
- Tạo, sửa, đổi trạng thái năm học/lớp: `classes.create`
- Tạo, thay, kết thúc lịch: `classes.manage_schedule`

## Server Actions

### Năm học

- `createAcademicYearAction`
- `activateAcademicYearAction`
- `changeAcademicYearStatusAction`

### Lớp học

- `createClassAction`
- `updateClassAction`
- `changeClassStatusAction`

### Lịch cố định

- `createClassScheduleAction`
- `replaceClassScheduleAction`
- `endClassScheduleAction`

## Nguyên tắc bảo mật

- Browser không ghi trực tiếp vào bảng.
- Server Action chỉ gọi RPC.
- Route và Server Action đều kiểm tra quyền.
- Không sử dụng service-role key.
- Chỉ revalidate sau khi RPC thành công.

## Validation

- Năm học: mã `YYYY-YYYY`, ngày kết thúc không trước ngày bắt đầu.
- Lớp: khối 1–12, trình độ A/B/CLC, số buổi 1–7.
- Lịch: thứ 1–7, giờ kết thúc sau giờ bắt đầu.
- Thay hoặc kết thúc lịch phải có lý do.

## Thứ tự triển khai

1. Action contracts và validation schemas
2. Server Actions
3. Trang quản lý năm học
4. Form tạo và sửa lớp
5. Dialog trạng thái lớp
6. Dialog quản lý lịch
7. Regression và Browser Console
