-- ===========================================================================
-- One Zalo "sổ liên lạc" group belongs to at most one student (24/10/2026).
--
-- link_student_zalo_group checks for another student holding the group and
-- then updates, so two saves at the same moment (bulk linking from two tabs)
-- could give one group to two students and send A's messages to B's parents.
-- The unique index makes the database refuse the second link. Production had
-- no linked students when this shipped, so no duplicate can block it.
-- ===========================================================================

drop index if exists public.students_zalo_group_thread_idx;

create unique index students_zalo_group_thread_key
  on public.students (zalo_group_thread_id)
  where zalo_group_thread_id is not null;

-- ---------------------------------------------------------------------------
-- The center nick for staff who link groups or send messages. system_settings
-- RLS needs settings.view, which they may not have; this returns one
-- non-secret key to students.update or attendance.mark holders only.
-- ---------------------------------------------------------------------------

create or replace function public.get_zalo_center_account_id()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.has_permission('students.update') or public.has_permission('attendance.mark') or public.has_permission('settings.view')) then
    raise exception using errcode = '42501', message = 'ZALO_CENTER_ACCOUNT_PERMISSION_DENIED';
  end if;
  return coalesce(pg_catalog.btrim((select value #>> '{}' from public.system_settings where key = 'zalo.center_account_id')), '');
end;
$$;

revoke all on function public.get_zalo_center_account_id() from public, anon;
grant execute on function public.get_zalo_center_account_id() to authenticated;
