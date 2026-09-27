-- 연애 주제 풀 + 카테고리 키 연결. 라이프 스타일 키도 함께 유지한다.
-- 기존 풀은 지우지 않는다. 여러 번 실행해도 안전합니다.

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
  ('romance', '사귀자, 언제 말하는 게 맞음?', '난 호감이 식기 전에 말하는 게 서로 덜 헤맨다고 봄. 분위기만 보자는 쪽 나와봐.', '확답은 부담이 아니라 방향임. 썸만 길면 둘 다 다른 가능성을 붙잡음.', ARRAY['사귀자','고백','썸'], 'A Korean woman in her early 20s pausing before speaking across a quiet cafe table, hopeful'),
  ('romance', '연애 공개, 인스타에 올려도 됨?', '난 둘만 아는 연애가 더 오래간다고 봄. 공개해야 진심이라는 사람 반박해봐.', '비공개는 숨기는 게 아니라 관계 보호임. 피드용 커플은 빨리 지침.', ARRAY['공개연애','인스타','연애'], 'A Korean man in his early 20s putting his phone away while sitting with a partner, candid cafe'),
  ('romance', '이성 친구, 연애 중에도 됨?', '난 연애 전 친구를 끊는 게 더 이상하다고 봄. 단둘이 만남은 선 그어야 한다는 쪽 들어와.', '친구와 애인은 자리가 다름. 숨기면 그때부터 문제임.', ARRAY['이성친구','경계','연애'], 'A Korean woman in her early 20s waving to a friend on the street while holding a partner hand loosely'),
  ('romance', '질투하는 거, 사랑임 구속임?', '난 질투를 말로 꺼내는 게 삼키는 것보다 낫다고 봄. 쿨해야 성숙이라는 사람 논리 가져와.', '질투는 사랑이 아니라 불안의 신호임. 확인이 반복되면 구속이 됨.', ARRAY['질투','신뢰','연애'], 'A Korean man in his early 20s looking at a phone with a worried face, partner beside him out of focus'),
  ('romance', '싸움 나면 누가 먼저 연락함?', '난 먼저 톡하는 쪽이 관계를 살린다고 봄. 식힐 시간이 필요하다는 쪽 나와봐.', '침묵은 정리 시간이 아니라 벌이 되기 쉬움. 한 줄이 밤을 넘김.', ARRAY['싸움','연락','연애'], 'A Korean woman in her early 20s typing a short message at night, serious but calm'),
  ('romance', '애정 표현, 매일 해야 함?', '난 매일 한 마디가 관계를 유지한다고 봄. 있을 때만 해도 충분하다는 사람 반박해봐.', '표현은 이벤트가 아니라 온도임. 특별한 날에만 하면 평일이 비움.', ARRAY['애정','표현','연애'], 'A Korean man in his early 20s sending a simple goodnight text, small smile, bedroom lamp'),
  ('romance', '커플 여행, 초반에 가도 됨?', '난 같이 이동해 봐야 호흡이 보인다고 봄. 사귄 지 오래돼야 간다는 쪽 들어와.', '여행은 시험이 아니라 시간 밀도임. 초반이라도 일정이 짧으면 됨.', ARRAY['커플여행','데이트','연애'], 'Two Korean people in their early 20s with small bags at a train platform, easy not dramatic'),
  ('romance', '위치 공유, 신뢰임 감시임?', '난 늦을 때 안심하라고 켜 두는 거라고 봄. 위치는 감시라는 사람 논리 들어봄.', '공유는 합의면 배려임. 끄면 의심부터 하면 그때 감시가 됨.', ARRAY['위치공유','신뢰','연애'], 'A Korean woman in her early 20s showing a map pin to a partner, both looking at one phone, calm'),
  ('romance', '권태기, 버티는 게 맞음?', '난 설레임이 줄어도 루틴이 남으면 연애라고 봄. 심심하면 끝내야 한다는 쪽 나와봐.', '권태는 실패 선언이 아님. 대화 없이 버티기만 하면 그때 끝임.', ARRAY['권태','연애','고민'], 'A Korean man in his early 20s sitting with a partner on a couch, quiet but together, evening'),
  ('romance', '이별 통보, 만나서 하는 게 맞음?', '난 얼굴 보고 말하는 게 최소한의 매너라고 봄. 톡이 덜 잔인하다는 사람 반박해봐.', '이별은 결론이지 처벌이 아님. 잠수보다 한 번의 대화가 남음.', ARRAY['이별','매너','연애'], 'A Korean woman in her early 20s sitting across a quiet table, serious gentle expression, daytime'),
  ('romance', '재회, 한 번은 기회임?', '난 이유가 달라졌으면 한 번은 다시 볼 수 있다고 봄. 끝난 건 끝난 거라는 쪽 들어와.', '재회는 미련 소비가 아님. 같은 싸움만 반복되면 그때 닫아야 함.', ARRAY['재회','이별','연애'], 'A Korean man in his early 20s meeting someone at a park bench, cautious hopeful face'),
  ('romance', '썸 기간, 한 달이면 김?', '난 한 달이면 마음을 말할 타이밍이라고 봄. 더 봐야 안 다친다는 사람 나와봐.', '긴 썸은 안전이 아니라 소모임. 확답이 없어도 방향은 있어야 함.', ARRAY['썸','기간','연애'], 'A Korean woman in her early 20s checking the calendar on her phone after a date, thoughtful'),
  ('romance', '확답 요구, 부담임 매너임?', '난 어디쯤인지 묻는 게 서로 예의를 아낀다고 봄. 재촉이라는 쪽 논리 가져와.', '확답은 들이댐이 아니라 정리임. 애매한 호감이 제일 오래 아픔.', ARRAY['확답','썸','연애'], 'A Korean man in his early 20s talking honestly over two drinks, nervous but direct'),
  ('romance', '데이트 코스, 번갈아 정하는 게 맞음?', '난 한 사람이 항상 짜면 취향이 연애가 된다고 봄. 잘하는 쪽이 맡으면 된다는 사람 반박해봐.', '코스는 취향 존중임. 번갈아 정해야 둘 다 기대가 생김.', ARRAY['데이트','코스','연애'], 'Two Korean people in their early 20s looking at a phone map together on a sidewalk, deciding'),
  ('romance', '애칭, 있어야 연애임?', '난 이름 부르는 온도면 충분하다고 봄. 애칭 없으면 맘이 식은 거라는 쪽 들어와.', '애칭은 증거가 아니라 놀이임. 없어도 편하면 그게 애정임.', ARRAY['애칭','호칭','연애'], 'A Korean woman in her early 20s laughing at a nickname on a chat screen, partner beside her'),
  ('romance', '스킨십 속도, 맞추는 게 먼저임?', '난 느린 쪽에 맞추는 게 다정이라고 봄. 표현이 사랑이라는 사람 나와봐.', '속도는 애정 점수가 아님. 불편한 속도를 참으면 연애가 시험이 됨.', ARRAY['스킨십','속도','연애'], 'A Korean man in his early 20s walking beside someone, hands close but not forced, evening street'),
  ('romance', '미래 얘기, 사귄 지 얼마 만에 함?', '난 방향이 다르면 빨리 아는 게 덜 다친다고 봄. 아직 이르다는 쪽 논리 들어봄.', '미래 얘기는 압박이 아니라 지도임. 피하기만 하면 가정만 커짐.', ARRAY['미래','연애','대화'], 'A Korean woman in her early 20s talking quietly with a partner at a late cafe, serious warm light'),
  ('romance', '미안할 때 먼저 사과가 이김?', '난 누가 맞는지보다 먼저 푸는 쪽이 관계를 남긴다고 봄. 맞는 말이 먼저라는 사람 반박해봐.', '사과는 패배가 아님. 옳음을 지키다 밤을 넘기면 주제는 사라짐.', ARRAY['사과','싸움','연애'], 'A Korean man in his early 20s saying sorry across a small table, sincere, no drama'),
  ('romance', '혼자만의 시간, 연애 중에 필요함?', '난 각자 저녁 하나가 연애를 덜 지치게 한다고 봄. 항상 같이 있어야 사랑이라는 쪽 나와봐.', '혼자 시간은 거리가 아니라 충전임. 붙잡히면 애정이 일정표가 됨.', ARRAY['개인시간','경계','연애'], 'A Korean woman in her early 20s reading alone at home, a text from a partner left unread for a moment'),
  ('romance', '부모님 인사, 이 타이밍이 맞음?', '난 서로 확신이 생긴 뒤에 인사가 예의라고 봄. 일찍 보여줘야 진심이라는 사람 들어와.', '인사는 이벤트가 아니라 관계의 다음 문임. 준비 없이 가면 둘 다 긴장만 남음.', ARRAY['인사','부모님','연애'], 'A Korean man in his early 20s straightening his jacket before meeting someone, nervous small smile')
ON CONFLICT (category_id, title) DO NOTHING;
