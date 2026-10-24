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
