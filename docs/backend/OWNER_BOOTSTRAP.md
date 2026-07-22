# Owner Bootstrap

## Mục đích

Bootstrap owner là thao tác dữ liệu một lần sau khi migration identity/RBAC đã được review và áp dụng. Đây không phải migration schema và không có RPC công khai cho browser.

Không dùng logic “user đầu tiên trở thành owner”. Không commit email, UUID hoặc kết quả truy vấn thật vào Git, ticket, tài liệu hoặc log ứng dụng.

## Điều kiện trước khi chạy

- Migration `identity_rbac_foundation` đã được áp dụng thành công.
- Google Auth user mục tiêu đã tồn tại.
- `public.profiles` đã có profile cùng UUID.
- Role `owner` tồn tại và active.
- Người thực hiện dùng quyền database administrator qua kênh đã được phê duyệt.
- Không có owner assignment active ngoài dự kiến.

## Xác định Auth user

Tìm bằng exact email trong phiên quản trị database. Giữ kết quả ngoài source code:

```sql
select id, email
from auth.users
where pg_catalog.lower(email) = pg_catalog.lower('<OWNER_EMAIL>')
limit 2;
```

Kết quả phải có đúng một user. Sau đó xác nhận profile:

```sql
select id, email, employment_status
from public.profiles
where id = '<AUTH_USER_UUID>'::uuid;
```

Không tiếp tục nếu profile không tồn tại hoặc không active.

## Xác định role owner

```sql
select id, code, name, is_active
from public.roles
where code = 'owner';
```

Kết quả phải có đúng một role active.

## Tạo assignment

`assigned_by` để null vì thao tác được thực hiện bởi database administrator, không phải một Auth user đang có quyền. Audit trigger sẽ ghi nguồn `database`.

```sql
insert into public.user_role_assignments (
  user_id,
  role_id,
  assigned_by,
  assignment_reason
)
select
  '<AUTH_USER_UUID>'::uuid,
  role.id,
  null,
  'Initial owner bootstrap approved by administrator'
from public.roles as role
where role.code = 'owner'
  and role.is_active
  and exists (
    select 1
    from public.profiles as profile
    where profile.id = '<AUTH_USER_UUID>'::uuid
      and profile.employment_status = 'active'
  )
returning id, user_id, role_id, assigned_at;
```

Partial unique index sẽ từ chối nếu user đã có owner assignment active. Không dùng `ON CONFLICT DO NOTHING`; người thực hiện cần nhìn thấy và kiểm tra tình trạng đó.

## Xác nhận

Lưu assignment ID trong biên bản vận hành an toàn, không commit vào Git. Xác nhận role và permission bằng truy vấn quản trị:

```sql
select
  assignment.id,
  assignment.assigned_at,
  role.code as role_code,
  permission.code as permission_code
from public.user_role_assignments as assignment
join public.roles as role on role.id = assignment.role_id
join public.role_permissions as role_permission
  on role_permission.role_id = role.id
join public.permissions as permission
  on permission.id = role_permission.permission_id
where assignment.user_id = '<AUTH_USER_UUID>'::uuid
  and assignment.revoked_at is null
order by permission.code;
```

Xác nhận audit row `user_role_assigned` tồn tại, nhưng không sao chép toàn bộ audit payload ra log công khai.

## Rollback

Rollback bằng thu hồi assignment, không xóa row:

```sql
update public.user_role_assignments
set
  revoked_at = now(),
  revoked_by = null,
  revocation_reason = 'Rollback initial owner bootstrap'
where id = '<ASSIGNMENT_UUID>'::uuid
  and revoked_at is null
returning id, revoked_at;
```

Xác nhận assignment không còn active và audit row `user_role_revoked` đã được tạo. Không sửa assignment đã thu hồi; nếu cần cấp lại, tạo assignment mới với lý do mới.
