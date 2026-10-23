-- "Sao chép tin Zalo" trên bảng kết quả buổi: trả đúng tin nhận xét mà hàng chờ Zalo sẽ dựng
-- (mẫu, thông tin cuối, điểm "(đã cộng 1)", bài làm, bài chữa), để trợ giảng chép gửi tay khi học
-- sinh chưa liên kết nhóm Zalo. Null khi kết quả chưa có nhận xét. Chỉ đọc.

create or replace function public.get_session_comment_message(p_result_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if not (public.has_permission('results.view') or public.has_permission('results.manage')) then
    raise exception using errcode = '42501', message = 'RESULTS_VIEW_PERMISSION_DENIED';
  end if;
  if not exists (select 1 from public.session_results as result where result.id = p_result_id) then
    raise exception using errcode = 'P0002', message = 'SESSION_RESULT_NOT_FOUND';
  end if;
  return public.render_session_comment_message(p_result_id);
end;
$$;

revoke all on function public.get_session_comment_message(uuid) from public, anon;
grant execute on function public.get_session_comment_message(uuid) to authenticated;
