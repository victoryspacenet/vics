-- =============================================
-- 이메일 조회용 인덱스
-- - profiles: RLS·정규화(lower(trim)) 비교에 맞춘 표현식 인덱스
-- - admin_operators: 클라이언트 .eq('email', …) 등 컬럼 일치 조회용
-- =============================================

-- public.profiles.email
-- 예: user_moderation_restrictions RLS에서 lower(trim(p.email)) 과 admin_operators 이메일 목록 비교
CREATE INDEX IF NOT EXISTS profiles_email_lower_trim_idx
  ON public.profiles (lower(trim(email)));

-- public.admin_operators.email
-- 예: adminPermissionStore — supabase.from('admin_operators').eq('email', normalizedEmail)
CREATE INDEX IF NOT EXISTS admin_operators_email_idx
  ON public.admin_operators (email);
