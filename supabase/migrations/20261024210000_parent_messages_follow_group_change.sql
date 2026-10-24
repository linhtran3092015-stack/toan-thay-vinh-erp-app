-- ===========================================================================
-- Pending parent messages follow the student's current Zalo group (24/10/2026).
--
-- parent_messages keeps the thread it was queued for. When staff fix a wrong
-- link ("Đổi nhóm", "Tìm nhóm" on the bulk page) or unlink, queued or failed
-- messages would still go to the old group, i.e. to another family. Skip them;
-- new events queue to the new group.
-- ===========================================================================

create or replace function public.skip_parent_messages_on_group_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.parent_messages
  set status = 'skipped', skipped_at = pg_catalog.now(), skipped_by = auth.uid(),
      skip_reason = 'Nhóm Zalo sổ liên lạc của học sinh đã đổi; tin không gửi vào nhóm cũ'
  where student_id = new.id
    and status in ('queued', 'failed')
    and thread_id is distinct from new.zalo_group_thread_id;
  return null;
end;
$$;

revoke all on function public.skip_parent_messages_on_group_change() from public, anon, authenticated;

create trigger students_zalo_group_change_skips_messages
  after update of zalo_group_thread_id on public.students
  for each row
  when (old.zalo_group_thread_id is distinct from new.zalo_group_thread_id)
  execute function public.skip_parent_messages_on_group_change();
