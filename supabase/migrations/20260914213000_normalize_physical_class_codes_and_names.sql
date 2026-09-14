-- Migration: Normalize physical class codes and names to match official schedule 100%
begin;

-- Disable triggers temporarily during administrative data normalization
alter table public.classes disable trigger classes_protect_identity;
alter table public.class_schedule_templates disable trigger class_schedule_templates_protect_history;

-- ====================================================================
-- 1. Khối 2: Chuẩn hóa 2P1, 2P2, 2P3, 2P4
-- ====================================================================
UPDATE public.classes 
SET code = '2A', name = 'Lớp 2A', level = 'A'
WHERE code = '2P1';

UPDATE public.classes 
SET code = '2B', name = 'Lớp 2B', level = 'B'
WHERE code = '2P2';

UPDATE public.classes 
SET code = '2CLC1', name = 'Lớp 2CLC1', level = 'CLC'
WHERE code = '2P3';

UPDATE public.classes 
SET code = '2TD', name = 'Lớp 2 Đánh thức thần đồng', level = 'A'
WHERE code = '2P4';

-- ====================================================================
-- 2. Khối 3: Đổi chéo 3B và 3CLC1 cho khớp đúng TKB
--    T7 13:00 trên TKB là 3B (mã cũ trong DB là 3CLC1)
--    CN 18:50 trên TKB là 3CLC1 (mã cũ trong DB là 3B)
-- ====================================================================
UPDATE public.classes SET code = '3B_SWAP_TEMP' WHERE code = '3B';

UPDATE public.classes 
SET code = '3B', name = 'Lớp 3B', level = 'B'
WHERE code = '3CLC1';

UPDATE public.classes 
SET code = '3CLC1', name = 'Lớp 3CLC1', level = 'CLC'
WHERE code = '3B_SWAP_TEMP';

-- ====================================================================
-- 3. Khối 6: Đổi chéo 6B và 6CLC1 cho khớp đúng TKB
--    T7 17:40 trên TKB là 6B (mã cũ trong DB là 6CLC1)
--    CN 14:10 trên TKB là 6CLC1 (mã cũ trong DB là 6B)
-- ====================================================================
UPDATE public.classes SET code = '6B_SWAP_TEMP' WHERE code = '6B';

UPDATE public.classes 
SET code = '6B', name = 'Lớp 6B', level = 'B'
WHERE code = '6CLC1';

UPDATE public.classes 
SET code = '6CLC1', name = 'Lớp 6CLC1', level = 'CLC'
WHERE code = '6B_SWAP_TEMP';

-- ====================================================================
-- 4. Khối 7: Chuẩn hóa 7P1 -> 7A, 7P2 -> 7B, 7P4 -> 7CLC1, 7P5 -> 7CLC2
--    Cập nhật liên kết của 7A2 từ 7P3 sang 7P5 (7CLC2)
--    Lưu trữ 7P3 (dư thừa, không có trên TKB)
-- ====================================================================
UPDATE public.classes 
SET code = '7A', name = 'Lớp 7A', level = 'A'
WHERE code = '7P1';

UPDATE public.classes 
SET code = '7B', name = 'Lớp 7B', level = 'B'
WHERE code = '7P2';

UPDATE public.classes 
SET code = '7CLC1', name = 'Lớp 7CLC1', level = 'CLC'
WHERE code = '7P4';

UPDATE public.classes 
SET code = '7CLC2', name = 'Lớp 7CLC2', level = 'CLC'
WHERE code = '7P5';

UPDATE public.class_component_links
SET component_class_id = (SELECT id FROM public.classes WHERE code = '7CLC2')
WHERE parent_class_id = (SELECT id FROM public.classes WHERE code = '7A2')
  AND component_class_id = (SELECT id FROM public.classes WHERE code = '7P3');

UPDATE public.classes 
SET code = '7_UNUSED', name = 'Lớp 7 (Dự phòng - không dùng)', status = 'archived'
WHERE code = '7P3';

UPDATE public.class_schedule_templates
SET is_active = false,
    effective_to = effective_from,
    ended_by = created_by,
    end_reason = 'Dự phòng - không sử dụng'
WHERE class_id = (SELECT id FROM public.classes WHERE code = '7_UNUSED');

-- ====================================================================
-- 5. Khối 8: Chuẩn hóa 8P1 -> 8A, 8P4 -> 8B, 8P2 -> 8CLC1, 8P3 -> 8CLC2
--    Cập nhật liên kết của 8B2 từ 8P5 sang 8P3 (8CLC2)
--    Lưu trữ 8P5 (dư thừa, không có trên TKB)
-- ====================================================================
UPDATE public.classes 
SET code = '8A', name = 'Lớp 8A', level = 'A'
WHERE code = '8P1';

UPDATE public.classes 
SET code = '8B', name = 'Lớp 8B', level = 'B'
WHERE code = '8P4';

UPDATE public.classes 
SET code = '8CLC1', name = 'Lớp 8CLC1', level = 'CLC'
WHERE code = '8P2';

UPDATE public.classes 
SET code = '8CLC2', name = 'Lớp 8CLC2', level = 'CLC'
WHERE code = '8P3';

UPDATE public.class_component_links
SET component_class_id = (SELECT id FROM public.classes WHERE code = '8CLC2')
WHERE parent_class_id = (SELECT id FROM public.classes WHERE code = '8B2')
  AND component_class_id = (SELECT id FROM public.classes WHERE code = '8P5');

UPDATE public.classes 
SET code = '8_UNUSED', name = 'Lớp 8 (Dự phòng - không dùng)', status = 'archived'
WHERE code = '8P5';

UPDATE public.class_schedule_templates
SET is_active = false,
    effective_to = effective_from,
    ended_by = created_by,
    end_reason = 'Dự phòng - không sử dụng'
WHERE class_id = (SELECT id FROM public.classes WHERE code = '8_UNUSED');

-- ====================================================================
-- 6. Khối 9: Chuẩn hóa 9P1 -> 9A, 9P2 -> 9B, 9P4 -> 9CLC1, 9P3 -> 9CLC2
--    Cập nhật liên kết của 9B2 từ 9P5 sang 9P3 (9CLC2)
--    Lưu trữ 9P5 (dư thừa, không có trên TKB)
-- ====================================================================
UPDATE public.classes 
SET code = '9A', name = 'Lớp 9A', level = 'A'
WHERE code = '9P1';

UPDATE public.classes 
SET code = '9B', name = 'Lớp 9B', level = 'B'
WHERE code = '9P2';

UPDATE public.classes 
SET code = '9CLC1', name = 'Lớp 9CLC1', level = 'CLC'
WHERE code = '9P4';

UPDATE public.classes 
SET code = '9CLC2', name = 'Lớp 9CLC2', level = 'CLC'
WHERE code = '9P3';

UPDATE public.class_component_links
SET component_class_id = (SELECT id FROM public.classes WHERE code = '9CLC2')
WHERE parent_class_id = (SELECT id FROM public.classes WHERE code = '9B2')
  AND component_class_id = (SELECT id FROM public.classes WHERE code = '9P5');

UPDATE public.classes 
SET code = '9_UNUSED', name = 'Lớp 9 (Dự phòng - không dùng)', status = 'archived'
WHERE code = '9P5';

UPDATE public.class_schedule_templates
SET is_active = false,
    effective_to = effective_from,
    ended_by = created_by,
    end_reason = 'Dự phòng - không sử dụng'
WHERE class_id = (SELECT id FROM public.classes WHERE code = '9_UNUSED');

-- ====================================================================
-- 7. Khối 10: Chuẩn hóa 10P2 -> 10B, 10P1 -> 10CLC1
-- ====================================================================
UPDATE public.classes 
SET code = '10B', name = 'Lớp 10B', level = 'B'
WHERE code = '10P2';

UPDATE public.classes 
SET code = '10CLC1', name = 'Lớp 10CLC1', level = 'CLC'
WHERE code = '10P1';

-- ====================================================================
-- 8. Khối 11: Chuẩn hóa 11P1 -> 11B, 11P2 -> 11CLC1 (Sửa T4 -> T2)
-- ====================================================================
UPDATE public.class_schedule_templates
SET weekday = 1
WHERE class_id = (SELECT id FROM public.classes WHERE code = '11P2');

UPDATE public.classes 
SET code = '11B', name = 'Lớp 11B', level = 'B'
WHERE code = '11P1';

UPDATE public.classes 
SET code = '11CLC1', name = 'Lớp 11CLC1', level = 'CLC'
WHERE code = '11P2';

-- ====================================================================
-- 9. Khối 12: Chuẩn hóa 12P2 -> 12B, 12P1 -> 12CLC1
-- ====================================================================
UPDATE public.classes 
SET code = '12B', name = 'Lớp 12B', level = 'B'
WHERE code = '12P2';

UPDATE public.classes 
SET code = '12CLC1', name = 'Lớp 12CLC1', level = 'CLC'
WHERE code = '12P1';

-- Re-enable triggers
alter table public.class_schedule_templates enable trigger class_schedule_templates_protect_history;
alter table public.classes enable trigger classes_protect_identity;

commit;
