begin;
select plan(17);

select ok(to_regprocedure('public.delete_staff_account(uuid, text)') is not null, 'delete_staff_account exists');
select is((select pg_catalog.array_to_string(proconfig, ',') from pg_proc where proname = 'delete_staff_account'), 'search_path=""', 'delete_staff_account has hardened search path');
select ok(not has_function_privilege('anon', 'public.delete_staff_account(uuid, text)', 'execute'), 'anon cannot execute delete_staff_account');

-- Fixture: one owner, one staff member with history, one stray profile without any references.
insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('d1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'delete-owner@example.test', '{}', '{}', now(), now()),
  ('d1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'delete-second-owner@example.test', '{}', '{}', now(), now()),
  ('d1000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'delete-staff@example.test', '{}', '{}', now(), now()),
  ('d1000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'delete-stray@example.test', '{}', '{}', now(), now());

insert into public.user_role_assignments(user_id, role_id, assignment_reason)
select 'd1000000-0000-0000-0000-000000000001', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments(user_id, role_id, assignment_reason)
select 'd1000000-0000-0000-0000-000000000002', id, 'fixture' from public.roles where code = 'owner';
insert into public.user_role_assignments(user_id, role_id, assignment_reason)
select 'd1000000-0000-0000-0000-000000000003', id, 'fixture' from public.roles where code = 'teaching_assistant';

-- The staff member has operational history (an audit row they authored).
insert into public.audit_logs(actor_user_id, module, action, entity_type, entity_id, reason, metadata)
values ('d1000000-0000-0000-0000-000000000003', 'sessions', 'fixture_action', 'class_session', 'fixture', 'fixture', '{}'::jsonb);

insert into public.account_invitations(email, invited_by, invitation_reason)
values ('delete-staff@example.test', 'd1000000-0000-0000-0000-000000000001', 'fixture pending invitation');

-- Non-owner cannot delete.
select set_config('request.jwt.claim.sub', 'd1000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$select public.delete_staff_account('d1000000-0000-0000-0000-000000000004', 'not allowed')$$,
  '42501', 'ACTIVE_OWNER_REQUIRED', 'only an active owner may delete accounts');

select set_config('request.jwt.claim.sub', 'd1000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$select public.delete_staff_account('d1000000-0000-0000-0000-000000000003', '   ')$$,
  '22023', 'DELETION_REASON_REQUIRED', 'a reason is required');
select throws_ok(
  $$select public.delete_staff_account('d1000000-0000-0000-0000-000000000001', 'self')$$,
  '23514', 'CANNOT_DELETE_OWN_ACCOUNT', 'owner cannot delete their own account');
select throws_ok(
  $$select public.delete_staff_account('d1000000-0000-0000-0000-000000000002', 'other owner')$$,
  '23514', 'CANNOT_DELETE_OWNER_ACCOUNT', 'accounts holding the owner role cannot be deleted');
select throws_ok(
  $$select public.delete_staff_account('d1000000-0000-0000-0000-000000000099', 'missing')$$,
  'P0002', 'TARGET_PROFILE_NOT_FOUND', 'unknown accounts are reported');

-- Staff with history: soft delete, roles and invitation revoked, profile kept.
select is(
  (select (public.delete_staff_account('d1000000-0000-0000-0000-000000000003', 'Nghỉ việc, bàn giao xong') ->> 'hardDeleted')::boolean),
  false, 'account with history is soft deleted');
select is(
  (select employment_status from public.profiles where id = 'd1000000-0000-0000-0000-000000000003'),
  'inactive', 'soft-deleted account becomes inactive');
select ok(
  (select account_deleted_at is not null and left_at is not null from public.profiles where id = 'd1000000-0000-0000-0000-000000000003'),
  'soft-deleted account records deletion and leave date');
select is(
  (select count(*) from public.user_role_assignments where user_id = 'd1000000-0000-0000-0000-000000000003' and revoked_at is null),
  0::bigint, 'all active roles are revoked');
select is(
  (select status from public.account_invitations where email = 'delete-staff@example.test'),
  'revoked', 'pending invitation for the email is revoked');
select ok(
  exists(select 1 from public.audit_logs where action = 'staff_account_deleted' and entity_id = 'd1000000-0000-0000-0000-000000000003'),
  'deletion is audited');
select throws_ok(
  $$select public.delete_staff_account('d1000000-0000-0000-0000-000000000003', 'again')$$,
  '23514', 'ACCOUNT_ALREADY_DELETED', 'an account cannot be deleted twice');

-- Stray profile without references: hard deleted together with its auth user.
select is(
  (select (public.delete_staff_account('d1000000-0000-0000-0000-000000000004', 'Tài khoản lạ đăng nhập nhầm') ->> 'hardDeleted')::boolean),
  true, 'account without references is hard deleted');
select ok(
  not exists(select 1 from public.profiles where id = 'd1000000-0000-0000-0000-000000000004')
  and not exists(select 1 from auth.users where id = 'd1000000-0000-0000-0000-000000000004'),
  'hard delete removes profile and auth user');

select * from finish();
rollback;
