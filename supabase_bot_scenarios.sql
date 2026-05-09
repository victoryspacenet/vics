-- ============================================================
-- 자동 응대 봇 시나리오 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_bot_scenarios (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category    text NOT NULL,
  title       text NOT NULL,
  message     text NOT NULL,
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.admin_bot_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_bot_scenarios_all" ON public.admin_bot_scenarios FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 유저 문의 테이블 (Supabase 연동)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inquiries (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id     text UNIQUE NOT NULL,
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  category       text NOT NULL,
  category_label text,
  title          text NOT NULL,
  content        text NOT NULL,
  status         text DEFAULT 'pending',   -- pending | completed
  image_urls     text[],
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
-- 유저는 본인 문의만 읽기/쓰기
CREATE POLICY "inquiries_user_select" ON public.inquiries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "inquiries_user_insert" ON public.inquiries FOR INSERT WITH CHECK (auth.uid() = user_id);
-- 운영자(anon)는 전체 읽기/수정
CREATE POLICY "inquiries_admin_all" ON public.inquiries FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 문의 답변 테이블 (자동 응대 + 운영자 수동 답변)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inquiry_replies (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  inquiry_id  uuid REFERENCES public.inquiries(id) ON DELETE CASCADE,
  reply_type  text DEFAULT 'manual',   -- 'auto' | 'manual'
  content     text NOT NULL,
  replied_by  text DEFAULT 'bot',      -- 'bot' | operator name
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.inquiry_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inquiry_replies_all" ON public.inquiry_replies FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- bot_enabled 설정 초기값 추가
-- ============================================================

INSERT INTO public.admin_settings (key, value)
VALUES ('bot_enabled', '{"enabled": true}')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 자동 응대 트리거 함수
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_reply_on_inquiry()
RETURNS trigger AS $$
DECLARE
  v_bot_enabled  boolean;
  v_message      text;
BEGIN
  SELECT (value->>'enabled')::boolean INTO v_bot_enabled
  FROM public.admin_settings
  WHERE key = 'bot_enabled';

  IF coalesce(v_bot_enabled, true) = false THEN
    RETURN NEW;
  END IF;

  SELECT message INTO v_message
  FROM public.admin_bot_scenarios
  WHERE category = NEW.category AND active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_message IS NOT NULL AND length(trim(v_message)) > 0 THEN
    INSERT INTO public.inquiry_replies (inquiry_id, reply_type, content, replied_by)
    VALUES (NEW.id, 'auto', trim(v_message), 'bot');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- 기존 트리거 있으면 제거 후 재생성
DROP TRIGGER IF EXISTS trigger_auto_reply ON public.inquiries;
CREATE TRIGGER trigger_auto_reply
  AFTER INSERT ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.auto_reply_on_inquiry();

-- ============================================================
-- 시나리오 샘플 데이터
-- ============================================================

INSERT INTO public.admin_bot_scenarios (category, title, message, active)
SELECT x.category, x.title, x.message, true
FROM (
  VALUES
  (
    'point'::text,
    '포인트 관련 자동 응대'::text,
    ('안녕하세요! VICTORYSPACE 고객센터입니다. 포인트 관련 문의를 접수했습니다.' || chr(10) || chr(10) ||
     '▪ 포인트 미지급: 매치업 결과 확정 후 최대 24시간 이내에 자동 지급됩니다.' || chr(10) ||
     '▪ 충전 후 미반영: 결제 완료 후 앱을 재시작하거나 5~10분 후 다시 확인해 주세요.' || chr(10) ||
     '▪ 환불 문의: 구매 후 7일 이내, 미사용 상태에서 환불 신청이 가능합니다.' || chr(10) || chr(10) ||
     '추가 확인이 필요한 경우 운영팀에서 개별 안내드릴게요.')::text
  ),
  (
    'matchup',
    '매치업 관련 자동 응대',
    ('안녕하세요! VICTORYSPACE 고객센터입니다. 매치업 관련 문의를 접수했습니다.' || chr(10) || chr(10) ||
     '처리 시간은 최대 24시간이며, 완료 후 앱 알림으로 안내해 드립니다.' || chr(10) ||
     '추가 문의는 이 채널을 통해 남겨주세요.')::text
  ),
  (
    'account',
    '계정/인증 관련 자동 응대',
    ('안녕하세요! 계정 관련 문의를 접수했습니다.' || chr(10) || chr(10) ||
     '비밀번호 재설정은 로그인 화면 > "비밀번호를 잊으셨나요?"에서 가능합니다.' || chr(10) ||
     '탈퇴 후 재가입은 탈퇴 시점으로부터 7일 후 가능합니다.')::text
  ),
  (
    'report',
    '신고 접수 자동 응대',
    ('신고 접수 감사합니다! 운영팀이 빠르게 검토할게요.' || chr(10) || chr(10) ||
     '증거 화면 캡처를 추가로 첨부해 주시면 처리 속도를 높일 수 있습니다.' || chr(10) ||
     '제재 처리 완료 후 앱 알림으로 결과를 안내해 드립니다.')::text
  ),
  (
    'bug',
    '버그/제보 자동 응대',
    ('버그 제보 감사합니다! 재현 경로와 기기/OS 정보를 남겨 주시면 수정에 큰 도움이 됩니다.' || chr(10) || chr(10) ||
     '검토 후 앱 알림 또는 이 채널로 진행 상황을 안내해 드릴게요.')::text
  ),
  (
    'appeal',
    '이의 신청 자동 응대',
    ('이의 신청이 접수되었습니다. 운영팀이 검토 후 48시간 이내에 답변드립니다.' || chr(10) || chr(10) ||
     '검토에 필요한 추가 자료가 있으면 이 채널로 보내주세요.')::text
  ),
  (
    'suggestion',
    '건의 접수 자동 응대',
    ('소중한 건의 감사합니다! 서비스 개선을 위해 적극 검토하겠습니다.' || chr(10) || chr(10) ||
     '채택된 건의는 업데이트 공지를 통해 안내해 드립니다.')::text
  ),
  (
    'etc',
    '기타 문의 자동 응대',
    ('안녕하세요! VICTORYSPACE 고객센터입니다. 문의를 접수했습니다.' || chr(10) || chr(10) ||
     '운영진이 빠르게 확인 후 답변드릴게요. 평균 24시간 이내에 답변드립니다.')::text
  )
) AS x(category, title, message)
WHERE NOT EXISTS (SELECT 1 FROM public.admin_bot_scenarios s WHERE s.category = x.category);

-- 이미 시드된 DB: 시나리오 템플릿(이후 신규 문의에 사용). category 오타 등 대비해 문구로도 매칭.
UPDATE public.admin_bot_scenarios
SET message = REPLACE(message, '72시간', '48시간'), updated_at = now()
WHERE message LIKE '%72시간%'
  AND (category = 'appeal' OR message LIKE '%이의 신청이 접수되었습니다%');

-- 과거 접수 건: 완료 화면(/inquiry/complete)은 inquiry_replies.content 를 조회함(접수 시점 스냅샷).
UPDATE public.inquiry_replies
SET content = REPLACE(content, '72시간', '48시간')
WHERE reply_type = 'auto'
  AND content LIKE '%72시간%';
