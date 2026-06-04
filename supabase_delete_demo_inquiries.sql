-- 예전 UI 더미 문의 접수번호 (실 DB에 들어간 경우만 삭제)
-- Supabase SQL Editor에서 실행

DELETE FROM public.inquiry_replies
WHERE inquiry_id IN (
  SELECT id FROM public.inquiries
  WHERE receipt_id LIKE 'INQ-VIRT%'
     OR receipt_id LIKE 'OB_20260206%'
);

DELETE FROM public.inquiries
WHERE receipt_id LIKE 'INQ-VIRT%'
   OR receipt_id LIKE 'OB_20260206%';
