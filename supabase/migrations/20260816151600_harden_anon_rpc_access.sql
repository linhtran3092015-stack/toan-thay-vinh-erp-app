begin;

-- These staff/internal RPCs must never be callable through the anonymous API
-- role. The current grants include PUBLIC, so revoke both PUBLIC and anon and
-- immediately preserve authenticated access on every exact signature.
revoke execute on function public.calculate_haversine_distance_m(numeric, numeric, numeric, numeric) from public, anon;
revoke execute on function public.commit_class_schedule_import_batch(uuid, text) from public, anon;
revoke execute on function public.commit_student_enrollment_import_batch(uuid, text) from public, anon;
revoke execute on function public.create_class_schedule_import_batch(text, text, text, text, jsonb, jsonb) from public, anon;
revoke execute on function public.create_student_enrollment_import_batch(text, text, text, text, jsonb) from public, anon;
revoke execute on function public.dry_run_class_schedule_import(text, jsonb, jsonb) from public, anon;
revoke execute on function public.dry_run_class_session_generation(uuid, date, date) from public, anon;
revoke execute on function public.dry_run_student_enrollment_import(text, jsonb) from public, anon;
revoke execute on function public.get_my_timekeeping_status() from public, anon;
revoke execute on function public.materialize_class_sessions(uuid, date, date, boolean, text) from public, anon;
revoke execute on function public.reset_unlocked_class_session_before_start(uuid, text) from public, anon;

grant execute on function public.calculate_haversine_distance_m(numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.commit_class_schedule_import_batch(uuid, text) to authenticated;
grant execute on function public.commit_student_enrollment_import_batch(uuid, text) to authenticated;
grant execute on function public.create_class_schedule_import_batch(text, text, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.create_student_enrollment_import_batch(text, text, text, text, jsonb) to authenticated;
grant execute on function public.dry_run_class_schedule_import(text, jsonb, jsonb) to authenticated;
grant execute on function public.dry_run_class_session_generation(uuid, date, date) to authenticated;
grant execute on function public.dry_run_student_enrollment_import(text, jsonb) to authenticated;
grant execute on function public.get_my_timekeeping_status() to authenticated;
grant execute on function public.materialize_class_sessions(uuid, date, date, boolean, text) to authenticated;
grant execute on function public.reset_unlocked_class_session_before_start(uuid, text) to authenticated;

-- Public Coaching is intentionally token-scoped and available without an ERP
-- session. Keep both public endpoints executable by anon and authenticated.
grant execute on function public.get_public_coaching_form(text) to anon, authenticated;
grant execute on function public.submit_public_coaching_form(text, jsonb) to anon, authenticated;

commit;
