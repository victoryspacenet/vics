-- 라이프 스타일 주제 풀 + 카테고리 키 연결.
-- 기존 풀은 지우지 않는다. 같은 제목이면 건너뛴다.
-- Supabase SQL Editor에서 이 파일 전체를 실행하세요. 여러 번 실행해도 안전합니다.

CREATE OR REPLACE FUNCTION public.bot_admin_category_prompt_key(p_admin_id text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text;
  v_slug text;
  v_blob text;
BEGIN
  IF p_admin_id IS NULL OR length(trim(p_admin_id)) = 0 THEN
    RETURN NULL;
  END IF;

  IF trim(p_admin_id) IN ('eternal_quest', 'fashion', '맛집', '맛식', 'lifestyle', 'romance') THEN
    RETURN trim(p_admin_id);
  END IF;

  SELECT x.label, x.slug INTO v_label, v_slug
  FROM (
    SELECT e->>'id' AS id, e->>'label' AS label, e->>'slug' AS slug
    FROM public.category_admin_config c,
         jsonb_array_elements(COALESCE(c.data->'activeCategories', '[]'::jsonb)) e
    WHERE c.id = 'default'
  ) x
  WHERE x.id = trim(p_admin_id)
  LIMIT 1;

  v_blob := lower(trim(both FROM concat_ws(' ', p_admin_id, v_label, v_slug)));

  IF v_blob LIKE '%romance%' OR v_blob ~ '연애' THEN
    RETURN 'romance';
  END IF;
  IF v_blob LIKE '%lifestyle%' OR v_blob ~ '라이프' THEN
    RETURN 'lifestyle';
  END IF;
  IF v_blob ~ '영원한' OR v_blob LIKE '%eternal%' THEN
    RETURN 'eternal_quest';
  END IF;
  IF v_blob ~ '패션' OR v_blob LIKE '%fashion%' THEN
    RETURN 'fashion';
  END IF;
  IF v_blob ~ '맛식' THEN
    RETURN '맛식';
  END IF;
  IF v_blob ~ '맛집' THEN
    RETURN '맛집';
  END IF;

  RETURN NULL;
END;
$$;

INSERT INTO public.virtual_bot_matchup_prompts
  (category_id, title, description, body_text, tags, image_prompt)
VALUES
  ('lifestyle', '아침형 인간이 이득임?', '난 아침이 하루 선택지를 연다고 봄. 밤이 집중 시간이라는 사람 나와봐.', '아침형은 성격이 아니라 일정 선점임. 밤샘은 다음 날 선택지를 지움.', ARRAY['아침형','루틴','취향'], 'A Korean woman in her early 20s opening curtains to morning light, mug in hand, small apartment'),
  ('lifestyle', '주말은 집이 진리임?', '난 주말 하루는 집 충전이어야 다음 주가 산다고 봄. 밖돌이파 논리 가져와.', '집 주말은 무기력이 아니라 회복임. 스케줄로 채운 주말은 월요일이 더 김.', ARRAY['주말','집','선택'], 'A Korean man in his early 20s on a couch with a blanket on Saturday morning, relaxed, plants by the window'),
  ('lifestyle', '혼자 영화가 같이 보기보다 맞음?', '난 혼자 보는 게 몰입이라고 봄. 같이 봐야 영화라는 쪽 반박해봐.', '혼영은 외로움이 아니라 취향 보호임. 맞추다 보면 둘 다 반만 봄.', ARRAY['영화','혼자','취향'], 'A Korean woman in her early 20s in a dim cinema seat alone, small popcorn, focused calm face'),
  ('lifestyle', '정주행 배속, 이게 맞음?', '난 1.5배가 시간을 지키는 선택이라고 봄. 원속이 예의라는 사람 들어와.', '배속은 불경이 아니라 시간 배분임. 한 시즌에 주말을 통째로 주는 게 손해임.', ARRAY['정주행','배속','트렌드'], 'A Korean man in his early 20s watching a show on a laptop at a desk, remote in hand, evening'),
  ('lifestyle', '종이책이 전자책보다 남음?', '난 종이 넘기는 감각이 읽기를 끝까지 가게 한다고 봄. 전자책이 짐 없는 진리라는 쪽 나와봐.', '종이책은 낭만이 아니라 집중임. 알림 없는 페이지가 한 권을 끝내게 함.', ARRAY['책','독서','취향'], 'A Korean woman in her early 20s reading a paperback at a small table, phone face down'),
  ('lifestyle', '취미는 하나 깊게가 이득임?', '난 하나 파는 게 여러 개 긁다 마는 것보다 남긴다고 봄. 다재다능파 논리 들어봄.', '취미는 개수가 프로필이 아님. 깊이 있는 하나가 주말을 채움.', ARRAY['취미','선택','취향'], 'A Korean man in his early 20s practicing one hobby at a desk, guitar or sketchbook, focused'),
  ('lifestyle', '홈트가 헬스장보다 맞음?', '난 집 운동이 이동 시간을 아낀다고 봄. 헬스장 분위기파 들어와.', '홈트는 게으름이 아니라 지속임. 가방 싸는 날만 운동이면 루틴이 끊김.', ARRAY['홈트','운동','선택'], 'A Korean woman in her early 20s doing a simple floor workout in a small living room, mat, natural light'),
  ('lifestyle', '러닝은 혼자 뛰는 게 맞음?', '난 혼자 뛰어야 페이스가 내 것이라고 봄. 크루여야 지속된다는 쪽 반박해봐.', '혼자 러닝은 외로움이 아니라 속도 조절임. 맞추다 보면 몸이 먼저 지침.', ARRAY['러닝','혼자','트렌드'], 'A Korean man in his early 20s jogging alone on a riverside path at dawn, ordinary clothes, no logos'),
  ('lifestyle', '팝업스토어 줄, 설렘임 낭비임?', '난 한정 경험을 사러 가는 거라고 봄. 줄 서는 순간 진 거라는 사람 나와봐.', '팝업은 물건보다 그 주 이야기임. 사진만 남고 안 쓰면 그게 낭비임.', ARRAY['팝업','트렌드','줄'], 'A Korean woman in her early 20s waiting in a short line outside a small pop-up shop, curious not posed'),
  ('lifestyle', '굿즈 모으는 거, 과함임?', '난 좋아하는 거 하나 사는 게 기분 예산이라고 봄. 실용만 사라는 쪽 논리 가져와.', '굿즈는 허세가 아니라 취향의 실물임. 서랍에만 있으면 그때부터 짐임.', ARRAY['굿즈','취향','소비'], 'A Korean man in his early 20s placing one small character item on a tidy shelf, pleased, ordinary room'),
  ('lifestyle', '필름 카메라가 폰보다 기록임?', '난 장수 제한이 찍는 장면을 고르게 한다고 봄. 폰이 다 담는다는 사람 반박해봐.', '필름은 감성이 아니라 선택 촬영임. 만 장 갤러리는 나중에 안 봄.', ARRAY['필름','사진','트렌드'], 'A Korean woman in her early 20s holding a simple film camera on a street, about to shoot, candid'),
  ('lifestyle', '개인컵 들고 다니는 거, 이득임?', '난 텀블러가 충동 음료를 줄인다고 봄. 매번 새 컵이 편하다는 쪽 들어와.', '개인컵은 인증이 아니라 습관임. 집 커피 한 잔이 줄 서는 시간을 아낌.', ARRAY['텀블러','습관','선택'], 'A Korean man in his early 20s filling a plain tumbler at home before leaving, morning kitchen'),
  ('lifestyle', '식물 키우는 집이 맞음?', '난 화분 하나가 방 온도를 바꾼다고 봄. 관리 귀찮다는 사람 나와봐.', '식물은 인테리어 소품이 아니라 루틴임. 물 주는 날이 집을 보게 함.', ARRAY['식물','방','취향'], 'A Korean woman in her early 20s watering one small plant by a window, casual home clothes'),
  ('lifestyle', '방 조명은 간접등이 진리임?', '난 천장 형광이 방을 사무실로 만든다고 봄. 밝아야 산다는 쪽 논리 들어봄.', '간접등은 꾸밈이 아니라 저녁 컨디션임. 눈이 편해야 집에 있고 싶음.', ARRAY['조명','방','취향'], 'A Korean man in his early 20s sitting in a room lit by a warm floor lamp, phone aside, evening'),
  ('lifestyle', '알림 끄기가 생산임?', '난 배너 끄면 집중이 돌아온다고 봄. 실시간 답장이 매너라는 사람 반박해봐.', '알림은 정보가 아니라 호출임. 모아서 보는 게 하루를 지킴.', ARRAY['알림','폰','선택'], 'A Korean woman in her early 20s turning on do-not-disturb and setting the phone face down, desk'),
  ('lifestyle', '폰은 침실 밖에 두는 게 맞음?', '난 충전을 거실에 두면 잠이 먼저 온다고 봄. 침대 옆이 편리하다는 쪽 들어와.', '침실 폰은 알람 핑계임. 한 번 누우면 스크롤이 수면을 가져감.', ARRAY['수면','폰','습관'], 'A Korean man in his early 20s leaving his phone on a living-room shelf and walking toward the bedroom'),
  ('lifestyle', '가계부 쓰는 거, 스트레스임 이득임?', '난 쓴 돈을 봐야 다음 선택이 줄어든다고 봄. 기분 나쁘다는 사람 나와봐.', '가계부는 잔소리가 아니라 선택 기록임. 안 적으면 같은 결제를 반복함.', ARRAY['가계부','돈','선택'], 'A Korean woman in her early 20s checking a simple spending note beside a card, calm kitchen table'),
  ('lifestyle', '여행은 즉흥이 맞음?', '난 큰 틀만 잡고 비우는 날이 여행이라고 봄. 분 단위 계획파 논리 가져와.', '즉흥은 무계획이 아니라 여백임. 동선에 쫓기면 현지보다 시간을 봄.', ARRAY['여행','즉흥','선택'], 'A Korean man in his early 20s with a small backpack at a quiet station, deciding which way to walk'),
  ('lifestyle', '혼행이 같이 가기보다 이득임?', '난 혼자 가면 먹고 걷는 속도가 내 것이라고 봄. 동행이 추억이라는 쪽 반박해봐.', '혼행은 외로움 자랑이 아니라 일정 자유임. 맞추다 보면 여행이 회의가 됨.', ARRAY['혼행','여행','취향'], 'A Korean woman in her early 20s sitting alone at a small-town bus stop with a day bag, content'),
  ('lifestyle', '국내 여행이 지금 이득임?', '난 이동이 짧은 국내가 휴가를 실제로 쉬게 한다고 봄. 해외여야 여행이라는 사람 들어와.', '국내는 타협이 아니라 밀도임. 공항에서 하루를 쓰면 휴가가 이동이 됨.', ARRAY['국내여행','휴가','선택'], 'A Korean man in his early 20s looking out a train window at Korean countryside, small bag on the seat')
ON CONFLICT (category_id, title) DO NOTHING;
