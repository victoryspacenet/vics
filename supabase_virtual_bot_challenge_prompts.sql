-- =============================================================================
-- VICS — 관전봇 도전 멘트 풀
-- 생성 주제(virtual_bot_matchup_prompts)와 분리.
--
-- 조건
--   1) 자신을 뽐내며 상대를 도발하는 설명
--   2) 대한민국 20대 초중반의 독특한 관점
--   3) 20대 초중반 말투 (현타, 이득, ㄹㅇ, 각, 표로 와봐)
-- {title} 자리 없음. 설명에 매치업 제목을 넣지 않음. 설명 ≤200 / 본문 ≤200
--
-- supabase_virtual_bot_matchups.sql 이후(또는 함께) 실행하세요.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.virtual_bot_challenge_prompts (
  id bigserial PRIMARY KEY,
  category_id text NOT NULL,
  description text NOT NULL,
  body_text text NOT NULL
);

CREATE INDEX IF NOT EXISTS virtual_bot_challenge_prompts_cat_idx
  ON public.virtual_bot_challenge_prompts (category_id);

ALTER TABLE public.virtual_bot_challenge_prompts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON public.virtual_bot_challenge_prompts TO service_role;

TRUNCATE public.virtual_bot_challenge_prompts RESTART IDENTITY;

INSERT INTO public.virtual_bot_challenge_prompts (category_id, description, body_text)
VALUES
  -- ───────── 영원한 난제 ─────────
  ('eternal_quest', '난 반대가 실전임. 듣기 좋은 말은 인스타용이고 평일엔 내 쪽이 이득. 표로 와봐.', '그 논리 3일이면 현타임. 난 시간·멘탈 지키는 쪽이 맞음.'),
  ('eternal_quest', '난 감정으로 지면 다음 주가 숙제된다고 봄. 그쪽은 예쁘긴 한데 20대 스케줄이랑 안 맞음. 반박?', '예쁜 가치관이 평일까지 가면 번아웃임. 컷이 자존감임.'),
  ('eternal_quest', '성실함으로 불안 포장한 각임. 난 밀도 있는 선택이 이득. 아직 집착파 나와봐.', '횟수·인증은 썸을 숙제로 만듦. 온도가 남는 쪽이 이김.'),
  ('eternal_quest', '난 비교하는 순간이 멘탈 세금이라고 봄. 그 논리 들었는데 난 끄는 쪽이 생존임. 표로 증명해봐.', '인스타 하이라이트랑 내 평일 비교하면 현타 확정. 끄는 게 이득임.'),
  ('eternal_quest', '그쪽은 로맨스 영화고 난 실전임. 20대엔 통장이랑 시간이 먼저. 반박할 사람?', '감정 빚 남기는 선택이 제일 비쌈. 난 경계가 매너임.'),
  ('eternal_quest', '난 완벽한 루틴보다 무너져도 다시 켜는 게 갓생이라고 봄. 그쪽은 한 방에 끝내려다 번아웃임. 나와봐.', '연속 집착이 실패임. 내일 알람만 다시 켜도 이득.'),
  ('eternal_quest', '자랑용 독립·자랑용 연애가 보임. 난 선택지 남기는 게 전략임. 아직 체면파 들어와.', '억지 썸·무리한 자취가 자존감이 아님. 남는 쪽이 이김.'),
  ('eternal_quest', '난 톡 온도가 사람 온도라고 봄. 그쪽 논리 인정은 하는데 눈치 게임은 시간 도둑임. 표로 와봐.', '한 줄이 매너 최저선임. 밀당은 20대 체력 낭비임.'),

  -- ───────── 패션 ─────────
  ('fashion', '난 핏이 로고보다 이득임. 브랜드 자랑은 가까운 사람만 앎. 표로 와봐.', '어깨 핏이 맞으면 저렴해도 비싸 보임. 로고만 믿으면 사이즈에서 들킴.'),
  ('fashion', '난 미니멀 옷장이 아침 결정장애 없앤다고 봄. 그쪽은 옷이 숙제된 각임. 반박?', '입는 횟수 많은 옷이 진짜 내 스타일임. 유행 다 사면 코디가 숙제됨.'),
  ('fashion', '그 룩 예쁘긴 한데 난 동선이 코디임. 발 아프면 표정부터 죽음. 나와봐.', '편해야 표정이 남음. 예쁜 신발에 절뚝이면 코디가 다 죽음.'),
  ('fashion', '난 중고·렌탈이 옷장 포화 안 만드는 길이라고 봄. 그쪽은 새거 자랑이 먼저임. 표로 증명해봐.', '한 철 행사용은 내 거라야 한다는 집착이 예산 무너뜨림.'),
  ('fashion', '난 검정이 실패 확률 낮은 유니폼이라고 봄. 컬러 강요는 취향 간섭임. 반박?', '검정은 무난함이 아니라 선택 비용 절감임. 포인트는 가방·신발로.'),
  ('fashion', '난 오운완 룩이 움직임 최적화라고 봄. 그쪽 꾸안꾸 눈치는 극혐. 표로 와봐.', '짐 동선이면 그게 정직한 코디임. 갈아입는 시간이 아깝다.'),
  ('fashion', '지금 사도 됨? 난 무지출 한 달 하고 사는 게 충동 방어임. 마케팅에 진 사람 나와봐.', '지금 아니면 못 산다는 말이 함정임. 할부로 자존감 사면 다음 달 현타.'),
  ('fashion', '난 모자부터가 컨디션 조절이라고 봄. 그쪽은 매일 화보를 강요함. 20대도 쉴 날이 있음. 반박?', '모자는 대충이 아니라 페이스 관리임. 맨얼굴 필수는 아님.'),

  -- ───────── 맛집 ─────────
  ('맛집', '핫플 자랑 봤는데 난 골목·자리·서비스가 탐방 실력임. 줄만 길면 그 집 급 아님. 표로 와봐.', '웨이팅은 기대값임. 자리 안내가 차면 탐방 실패임.'),
  ('맛집', '난 창가·혼밥석 있는 집이 그 동네를 한 번 더 가게 한다고 봄. 그쪽은 인증샷 탐방임. 반박?', '자리 설계가 탐방 인프라임. 둘이 오라는 눈치면 그 골목 안 감.'),
  ('맛집', '서울 핫플만 탐방이라는 각 보임. 난 지방·시장 골목이 기억에 남음. 나와봐.', '지방 집은 서비스가 덜 바쁨. 그 동네 공기까지 메뉴임.'),
  ('맛집', '난 직원 친절이 재방문 이유라고 봄. 그쪽은 맛만 보면 된다는 논리. 표로 증명해봐.', '서비스는 덤이 아님. 기분 상하면 그 골목 전체가 식음.'),
  ('맛집', '포장 빠른 집 자랑인데 난 매장 온도가 탐방임. 창구만 있으면 배달이랑 같음. 반박?', '테이블에 앉아야 그 집 공기가 남음. 자리값이 탐방임.'),
  ('맛집', '난 24시·퇴근 루트 집이 그 지역 생존 맛집이라고 봄. 그쪽 감성집은 동선이 끊김. 표로 와봐.', '닫힌 골목은 탐방이 아님. 새벽에 문 연 집이 인프라임.'),
  ('맛집', '콘센트 전쟁 얘기면 그 카페가 다 같아짐. 난 창가 빛이 그 집임. 나와봐.', '카페 탐방은 그 자리의 빛임. 충전기만 보면 집 구분이 없음.'),
  ('맛집', '난 불판·속도 맞춰주는 집이 회식 탐방 1순위임. 그쪽은 메뉴만 두꺼우면 된다는 각. 반박?', '고깃집은 불이 서비스임. 직원 동선이 그 집 급을 보여줌.'),

  -- ───────── 맛식 ─────────
  ('맛식', '그 맛 인정하는데 난 식감이 한 입을 이긴다고 봄. 자극만 세면 중간에 질림. 표로 와봐.', '간·온도·씹는 맛이 여운임. 한 방 자극은 다음 끼가 생각남.'),
  ('맛식', '난 찍먹이 소스 컨트롤이라고 봄. 그쪽 부먹 논리는 마지막이 흐물해짐. 반박?', '찍먹은 취향이 아니라 식감 관리임. 중간부터 다른 음식 되면 손해.'),
  ('맛식', '단짠만 진리라는 각이면 입이 심심해짐. 난 매운맛 볼륨이 한 끼 리셋임. 나와봐.', '매운맛은 성격이 아니라 맛의 볼륨임. 순한 맛만 고르면 혀가 잠.'),
  ('맛식', '난 국물 농도가 맛의 전부라고 봄. 그쪽 건더기파 논리 가져와. 표로 증명해봐.', '국물은 간이 아니라 여운임. 싱거우면 한 술이 안 넘어감.'),
  ('맛식', '건강식은 심심하다는 말 들었음. 난 간이 맞으면 닭가슴살도 한 끼 맛임. 반박?', '식단은 형벌이 아니라 간·식감 문제임. 건조하면 다음 끼가 폭식임.'),
  ('맛식', '난 단백질 매끼가 한 입 밀도라고 봄. 그쪽 탄수 폭주는 한 시간 뒤 또 배고픔. 표로 와봐.', '단백질은 숙제가 아니라 포만임. 없으면 야식이 기본값이 됨.'),
  ('맛식', '흰쌀·자극만 진리면 혀가 지침. 난 현미·샐러드 식감이 한 술을 더 가게 함. 나와봐.', '건강식은 심심함이 아니라 씹는 맛임. 자극만 세면 중간에 질림.'),
  ('맛식', '난 제로가 단맛 볼륨 조절이라고 봄. 그쪽 당 폭주 한 잔이 다음 끼를 망침. 반박?', '제로는 속임수가 아니라 후식 방어임. 혀만 달래면 폭식이 줄어듦.');

CREATE OR REPLACE FUNCTION public.bot_pick_challenge_copy(p_category text, p_title text)
RETURNS TABLE(description text, body_text text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
  v_desc text;
  v_body text;
BEGIN
  -- p_title은 시그니처 호환용. 설명에 매치업 제목을 넣지 않는다.
  -- 카테고리 풀이 없으면 빈 결과(다른 카테고리 멘트 금지).
  v_key := public.bot_admin_category_prompt_key(p_category);
  IF v_key IS NULL AND trim(COALESCE(p_category, '')) IN ('eternal_quest', 'fashion', '맛집', '맛식') THEN
    v_key := trim(p_category);
  END IF;
  IF v_key IS NULL THEN
    RETURN;
  END IF;

  SELECT
    left(btrim(regexp_replace(regexp_replace(p.description, '「\s*\{title\}\s*」\s*', '', 'g'), '\{title\}', '', 'g')), 200),
    left(p.body_text, 200)
  INTO v_desc, v_body
  FROM public.virtual_bot_challenge_prompts p
  WHERE p.category_id = v_key
  ORDER BY random()
  LIMIT 1;

  IF v_desc IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT v_desc, v_body;
END;
$$;

REVOKE ALL ON FUNCTION public.bot_pick_challenge_copy(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bot_pick_challenge_copy(text, text) TO service_role;
