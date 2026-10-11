-- =========================================================
-- Teaching assistants may start and complete class sessions
-- =========================================================
-- Owner decision 2026-10-13: attendance depends on a started session and
-- TAs run the evening sessions, so they receive sessions.manage
-- (start / complete / cancel / reschedule / create sessions).

insert into public.role_permissions (role_id, permission_id, granted_by)
select role.id, permission.id, null
from public.roles as role
join public.permissions as permission
  on permission.code = 'sessions.manage'
where role.code = 'teaching_assistant'
on conflict (role_id, permission_id) do nothing;
