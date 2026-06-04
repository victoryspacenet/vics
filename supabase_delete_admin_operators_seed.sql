-- 시드(목) 운영자 계정 제거 — Supabase SQL Editor에서 1회 실행
-- is_seed=false 로 남은 시드·@vsmatch.com·시드 이름 행까지 삭제 (시라소니 등 실제 계정은 유지)

delete from public.admin_operator_security_log
where target_operator_id in (
  select id from public.admin_operators
  where is_seed = true
     or id in (
       'admin_01', 'contents_2', 'cs_team_a', 'dev_test', 'admin_02', 'marketing_1',
       'ops_team_1', 'cs_team_b', 'design_1', 'data_1', 'temp_worker', 'legacy_admin'
     )
     or lower(trim(email)) like '%@vsmatch.com'
     or name in (
       '김운영', '이관리', '박상담', '최개발', '강수석', '정홍보', '한운영',
       '조상담', '윤디자인', '송데이터', '임계약', '구관리'
     )
);

delete from public.admin_operators
where is_seed = true
   or id in (
     'admin_01', 'contents_2', 'cs_team_a', 'dev_test', 'admin_02', 'marketing_1',
     'ops_team_1', 'cs_team_b', 'design_1', 'data_1', 'temp_worker', 'legacy_admin'
   )
   or lower(trim(email)) like '%@vsmatch.com'
   or name in (
     '김운영', '이관리', '박상담', '최개발', '강수석', '정홍보', '한운영',
     '조상담', '윤디자인', '송데이터', '임계약', '구관리'
   );
