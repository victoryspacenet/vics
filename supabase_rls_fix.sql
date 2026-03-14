-- =============================================
-- VICS - profiles INSERT 정책 추가
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 본인 프로필 INSERT 허용 (소셜 로그인 후 프로필 자동 생성)
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Service role(트리거)도 INSERT 가능하도록 허용 (이미 SECURITY DEFINER이므로 보통 문제없음)
-- 혹시 트리거 정책이 막히는 경우 아래 실행:
-- ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
