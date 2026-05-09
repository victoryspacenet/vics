-- ============================================================
-- 금칙어 관리 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_banned_words (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  word       text NOT NULL UNIQUE,
  category   text DEFAULT 'general',   -- general | hate | spam | adult
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.admin_banned_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banned_words_all" ON public.admin_banned_words FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 샘플 금칙어 데이터 (342건 중 대표 샘플)
-- ============================================================

INSERT INTO public.admin_banned_words (word, category, active) VALUES
-- hate (혐오/욕설)
('바보', 'hate', true), ('멍청이', 'hate', true), ('병신', 'hate', true),
('찐따', 'hate', true), ('쓰레기', 'hate', true), ('개새끼', 'hate', true),
('씨발', 'hate', true), ('존나', 'hate', true), ('지랄', 'hate', true),
('미친', 'hate', true), ('ㅅㅂ', 'hate', true), ('ㅂㅅ', 'hate', true),
('ㅈㄹ', 'hate', true), ('ㄱㅅㄲ', 'hate', true), ('개소리', 'hate', true),
('닥쳐', 'hate', true), ('꺼져', 'hate', true), ('죽어', 'hate', true),
('찐찐', 'hate', true), ('돼지', 'hate', true),
-- spam (스팸/광고)
('카카오톡', 'spam', true), ('텔레그램', 'spam', true), ('라인아이디', 'spam', true),
('팔로우', 'spam', true), ('광고', 'spam', true), ('홍보', 'spam', true),
('무료나눔', 'spam', true), ('당첨', 'spam', true), ('클릭', 'spam', true),
('이벤트참여', 'spam', true), ('추천인', 'spam', true), ('리워드', 'spam', true),
('코인', 'spam', true), ('비트코인', 'spam', true), ('투자', 'spam', true),
('수익', 'spam', true), ('알바', 'spam', true), ('대출', 'spam', true),
('부업', 'spam', true), ('돈버는법', 'spam', true),
-- adult (성인/부적절)
('야동', 'adult', true), ('섹스', 'adult', true), ('성인', 'adult', true),
('야설', 'adult', true), ('포르노', 'adult', true), ('19금', 'adult', true),
-- general (일반 부적절)
('해킹', 'general', true), ('악성코드', 'general', true), ('계정판매', 'general', true),
('어뷰징', 'general', true), ('매크로', 'general', true), ('핵', 'general', true),
('치트', 'general', true), ('계정공유', 'general', true), ('포인트판매', 'general', true),
('환전', 'general', true)
ON CONFLICT (word) DO NOTHING;
