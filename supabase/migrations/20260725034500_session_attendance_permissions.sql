begin;

-- =========================================================
-- TASK 5.1 — SESSION, ATTENDANCE AND RESULT PERMISSIONS
--
-- New permissions:
--   sessions.view
--   sessions.manage
--   attendance.view
--   attendance.mark
--   results.view
--   results.manage
--   sessions.lock
--
-- Existing permission reused:
--   session_ledger.view
-- =========================================================

insert into public.permissions (
  code,
  module,
  name,
  description
)
values
  (
    'sessions.view',
    'sessions',
    'Xem buổi học',
    'Xem danh sách và thông tin chi tiết các buổi học thực tế.'
  ),
  (
    'sessions.manage',
    'sessions',
    'Quản lý buổi học',
    'Tạo, cập nhật và xử lý trạng thái buổi học qua workflow được phê duyệt.'
  ),
  (
    'attendance.view',
    'attendance',
    'Xem điểm danh',
    'Xem dữ liệu điểm danh của học viên trong các buổi học.'
  ),
  (
    'attendance.mark',
    'attendance',
    'Thực hiện điểm danh',
    'Nhập và cập nhật điểm danh trước khi buổi học được khóa.'
  ),
  (
    'results.view',
    'results',
    'Xem kết quả buổi học',
    'Xem điểm kiểm tra, điểm vở và nhận xét cuối buổi.'
  ),
  (
    'results.manage',
    'results',
    'Nhập kết quả buổi học',
    'Nhập và cập nhật điểm, trạng thái nộp bài và nhận xét cuối buổi.'
  ),
  (
    'sessions.lock',
    'sessions',
    'Khóa buổi học',
    'Khóa dữ liệu điểm danh và kết quả sau khi buổi học hoàn tất.'
  )
on conflict (code) do update
set
  module = excluded.module,
  name = excluded.name,
  description = excluded.description,
  is_active = true;


-- =========================================================
-- OWNER
-- Owner receives all permissions in this foundation.
-- session_ledger.view already exists but is included here so
-- the intended permission matrix remains explicit.
-- =========================================================

insert into public.role_permissions (
  role_id,
  permission_id,
  granted_by
)
select
  role.id,
  permission.id,
  null
from public.roles as role
cross join public.permissions as permission
where role.code = 'owner'
  and role.is_active
  and permission.is_active
  and permission.code in (
    'sessions.view',
    'sessions.manage',
    'attendance.view',
    'attendance.mark',
    'results.view',
    'results.manage',
    'sessions.lock',
    'session_ledger.view'
  )
on conflict (role_id, permission_id) do nothing;


-- =========================================================
-- OPERATIONAL ROLE MATRIX
--
-- operations_manager:
--   Full session and attendance workflow.
--
-- assistant_manager:
--   Full session and attendance workflow.
--
-- teaching_assistant:
--   View sessions, mark attendance, manage results and lock
--   completed sessions. Does not create/cancel/reschedule
--   sessions and does not see the financial session ledger.
--
-- accountant:
--   View the immutable session ledger only.
-- =========================================================

with permission_grants (
  role_code,
  permission_code
) as (
  values
    (
      'operations_manager',
      'sessions.view'
    ),
    (
      'operations_manager',
      'sessions.manage'
    ),
    (
      'operations_manager',
      'attendance.view'
    ),
    (
      'operations_manager',
      'attendance.mark'
    ),
    (
      'operations_manager',
      'results.view'
    ),
    (
      'operations_manager',
      'results.manage'
    ),
    (
      'operations_manager',
      'sessions.lock'
    ),
    (
      'operations_manager',
      'session_ledger.view'
    ),

    (
      'assistant_manager',
      'sessions.view'
    ),
    (
      'assistant_manager',
      'sessions.manage'
    ),
    (
      'assistant_manager',
      'attendance.view'
    ),
    (
      'assistant_manager',
      'attendance.mark'
    ),
    (
      'assistant_manager',
      'results.view'
    ),
    (
      'assistant_manager',
      'results.manage'
    ),
    (
      'assistant_manager',
      'sessions.lock'
    ),
    (
      'assistant_manager',
      'session_ledger.view'
    ),

    (
      'teaching_assistant',
      'sessions.view'
    ),
    (
      'teaching_assistant',
      'attendance.view'
    ),
    (
      'teaching_assistant',
      'attendance.mark'
    ),
    (
      'teaching_assistant',
      'results.view'
    ),
    (
      'teaching_assistant',
      'results.manage'
    ),
    (
      'teaching_assistant',
      'sessions.lock'
    ),

    (
      'accountant',
      'session_ledger.view'
    )
)
insert into public.role_permissions (
  role_id,
  permission_id,
  granted_by
)
select
  role.id,
  permission.id,
  null
from permission_grants as permission_grant
join public.roles as role
  on role.code = permission_grant.role_code
  and role.is_active
join public.permissions as permission
  on permission.code =
    permission_grant.permission_code
  and permission.is_active
on conflict (role_id, permission_id) do nothing;

commit;
