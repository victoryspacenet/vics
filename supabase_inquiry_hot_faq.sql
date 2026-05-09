-- 문의하기 메인 — 가장 많이 묻는 질문 노출 순서 (admin_settings)
insert into public.admin_settings (key, value)
values ('inquiry_hot_faq', '{"ids": ["1", "2", "3"]}'::jsonb)
on conflict (key) do nothing;
