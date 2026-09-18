-- =============================================================================
-- VICS — 관전봇 매치업 생성 주제 풀
-- 운영 카테고리 4종: 영원한 난제 / 패션 / 맛집 / 맛식
-- supabase_virtual_bot_matchups.sql 이후 실행하세요.
--
-- 카테고리 기획
--   맛집: 특정 장소·식당·지역 특성·분위기·서비스 비교. 맛집 탐방 경험을 올리게.
--   맛식: 음식 자체(맛·식감·조합) + 건강식·식단. 집이 아니라 메뉴.
--   영원한 난제: 연애 + 라이프스타일 + 일상 난제.
--                정치·종교·젠더 이슈 금지. (테토에겐 등 젠더 라벨도 넣지 않음)
--   패션: 옷·핏·소비 (기존 유지)
--
-- 전제: 오른쪽 도전자가 무엇을 올릴지 모름.
--   제목 ≤60자 / 설명 ≤200자 / 본문 = A측 한 방
-- image_prompt = 한국 20대 초중반 사람 포함 가능. 유명인·글자·로고 없음.
-- =============================================================================

ALTER TABLE public.virtual_bot_matchup_prompts
  ADD COLUMN IF NOT EXISTS image_prompt text;

TRUNCATE public.virtual_bot_matchup_prompts RESTART IDENTITY;

INSERT INTO public.virtual_bot_matchup_prompts
  (category_id, title, description, body_text, tags, image_prompt)
VALUES
  -- ───────── 영원한 난제: 연애 ─────────
  ('eternal_quest', '연애 연락 템포, 뭐가 진리임?', '난 하루 한두 번 밀도 있는 톡이 매일 확인 전쟁보다 나음. 답장 안 오면 불안한 거 인정하는데, 집착은 아님. 반박?', '연락은 횟수보다 온도임. 하루 종일 확인톡은 썸도 연애도 빨리 식힘.', ARRAY['연애','연락','템포'], 'A Korean woman in her early 20s on a couch sending one calm text, phone beside a mug, natural evening light'),
  ('eternal_quest', '소개팅앱으로 만나는 거, 별로임?', '난 소개팅앱이 시간 효율이라고 봄. 자연스러운 만남만 기다리면 학기·출근에 사람 안 늘어남. 로맨스 순수파 들어와.', '자연만남은 운이고 앱은 선택임. 사진은 과장해도 만남에서 걸러짐.', ARRAY['소개팅','앱','연애'], 'A Korean man in his early 20s at a first-date cafe, nervous smile, two iced drinks on the table'),
  ('eternal_quest', '밀당하는 거, 아직도 필요함?', '난 직진이 시간 아끼고 오해도 줄임. 밀당은 20대 스케줄이랑 안 맞음. 밀당 고수면 이득인 이유 대봐.', '밀당은 상대 멘탈 테스트지 호감 표현이 아님. 바쁜 사람은 바로 말함.', ARRAY['밀당','직진','연애'], 'A Korean woman in her early 20s putting her phone in her bag and walking, decisive expression, city sidewalk'),
  ('eternal_quest', '손절 타이밍, 내 기준이 맞음?', '난 답장 온도가 일주일 식으면 미련보다 컷이 이득이라고 봄. 질질 끄는 게 더 상처임. 아직 기다리는 사람 나와봐.', '손절은 차가움이 아니라 자기 시간 보호임. 썸을 인턴처럼 질질 끌지 마.', ARRAY['손절','썸','연애'], 'A Korean man in his early 20s archiving a chat and looking out the window, quiet apartment, calm face'),
  ('eternal_quest', '고백은 누가 먼저 하는 게 맞음?', '난 먼저 말하는 쪽이 리스크 지는 거라 더 끌림. 눈치만 보다가 타이밍 놓치는 거 스불재. 느린 사람 논리 들어봄.', '먼저 고백은 용기이지 손해 아님. 썸 석 달은 서로 에너지만 깎음.', ARRAY['고백','썸','용기'], 'A Korean woman in her early 20s taking a breath before speaking across a cafe table, candid, warm light'),
  ('eternal_quest', '연애 안 하는 거, 지금 제일 이득임?', '난 무연애가 통장이랑 멘탈 지키는 선택이라고 봄. 외로운 거랑 손해가 꼭 같진 않음. 연애해야 사람 같다는 쪽 나와봐.', '연애는 필수 퀘스트 아님. 바쁜 시즌에 억지 썸이 더 현타임.', ARRAY['무연애','자존감','라이프'], 'A Korean man in his early 20s enjoying a solo movie night with snacks, relaxed smile, small living room'),
  ('eternal_quest', '장거리 연애, 지금 세대에 가능함?', '난 주말에 밀도 있게 보는 게 매일 근처에서 권태보다 나을 수도 있다고 봄. 거리 핑계로 안 만나는 건 별개. 반박?', '장거리는 만남의 질이 이김. 톡만 쌓이면 그건 연애가 아니라 공지방임.', ARRAY['장거리','연애','만남'], 'A Korean woman in her early 20s at a train station platform with a small suitcase, hopeful expression'),
  ('eternal_quest', '데이트 더치, 이 타이밍이 맞음?', '난 초반부터 더치가 서로 덜 계산하게 함. 한 사람이 계속 내면 호감이 빚으로 변함. 다른 타이밍 있으면 말해봐.', '첫 만남부터 더치해도 매너 안 죽음. 나중에 감정으로 정산하는 게 더 별로.', ARRAY['데이트','더치','연애'], 'Two Korean people in their early 20s splitting a cafe bill with cards, easy smiles, no tension'),

  -- ───────── 영원한 난제: 라이프스타일 ─────────
  ('eternal_quest', '인스타 보면 나만 뒤처진 기분, 이게 정상임?', '난 스토리 보다가 현타 오면 바로 끄는 쪽이 멘탈 지킴. 비교하면서 하루 버리는 거 ㄹㅇ 손해. 아직 들여다보는 사람 나와봐.', '인스타는 하이라이트만 올림. 내 평일이랑 비교하는 순간 멘탈 나감. 끄는 게 이득임.', ARRAY['인스타','현타','라이프'], 'A Korean woman in her early 20s in bed at night putting her phone face down, tired natural expression'),
  ('eternal_quest', '갓생 실패했는데, 루틴 포기하는 게 맞음?', '난 3일 만에 무너져도 다시 켜는 쪽이 이김. 완벽한 갓생 집착이 번아웃임. 한 방에 끝내려는 사람 반박해봐.', '갓생은 연속보다 재시작 횟수임. 오늘 망해도 내일 알람만 다시 켜면 됨.', ARRAY['갓생','번아웃','루틴'], 'A Korean man in his early 20s waking up messy-haired to an alarm, planner on the nightstand, morning light'),
  ('eternal_quest', '본가 사는 거, 20대에 꿀임 아님 현타임?', '난 월세 아끼는 본가가 지금 제일 이득이라고 봄. 자취 자랑이 통장보다 우선이면 나중에 선택지가 없음. 독립 자랑파 나와봐.', '본가는 꿀잠이지 못 나온 게 아님. 월세 나가면 친구 만나는 횟수부터 줄어듦.', ARRAY['본가','월세','라이프'], 'A Korean woman in her early 20s eating breakfast at a family home table in pajamas, cozy and unbothered'),
  ('eternal_quest', '숏폼 하루 두 시간, 이 정도면 과함?', '난 릴스 끄고 잠드는 쪽이 다음 날 이김. 자기 전에 한 시간 더 보는 거 ㄹㅇ 수면 도둑임. 아직 무한스크롤파 들어와.', '숏폼은 쉬는 게 아니라 시간 임대임. 꺼두는 게 갓생보다 먼저임.', ARRAY['숏폼','수면','라이프'], 'A Korean man in his early 20s putting his phone on the nightstand and turning toward a book, sleepy but resolute'),
  ('eternal_quest', '20대에 적금부터 넣는 거, 이득임?', '난 적금 먼저 넣고 남는 돈으로 노는 게 맞음. 집 나갈 때 현금 없으면 선택지가 사라짐. 지금 다 쓰는 논리 들어봄.', '적금 안 넣으면 나중에 월세 앞에서 손 비게 됨. 노는 돈은 넣고 남은 걸로.', ARRAY['적금','자취','돈'], 'A Korean woman in her early 20s at a desk checking a bank app, modest coffee, relieved expression'),
  ('eternal_quest', '카톡 읽씹, 이 정도면 매너 아님?', '난 읽씹하면 관계 온도 내려가는 거 맞다고 봄. 바쁜 척해도 한 줄은 됨. 반박할 사람?', '읽씹은 거절보다 더 별로임. 한 줄이라도 남기는 게 매너 최저선임.', ARRAY['카톡','읽씹','관계'], 'A Korean man in his early 20s at a cafe staring at a phone with a conflicted face, iced coffee on the table'),

  -- ───────── 패션 ─────────
  ('fashion', '미니멀 옷장, 이게 이득임?', '난 색깔 줄인 옷장이 아침 결정장애를 없앤다고 봄. 유행 다 사면 코디가 숙제됨. 맥시멀파 나와봐.', '미니멀은 재미없다는 게 아님. 입는 횟수가 많은 옷이 진짜 내 스타일임.', ARRAY['미니멀','옷장','코디'], 'A Korean woman in her early 20s choosing a beige outfit from a small minimal closet, morning apartment, candid'),
  ('fashion', '중고로 옷 사는 거, 별로임?', '난 중고가 가격이랑 환경 둘 다 이득이라고 봄. 새상표만 고집하면 20대 예산이 무너짐. 새거만파 논리 가져와.', '중고는 촌내가 아니라 센스임. 한 철 입고 버리는 게 더 티 남.', ARRAY['중고','패션','가성비'], 'A Korean man in his early 20s trying on a secondhand jacket in a small room, looking at a mirror, natural face'),
  ('fashion', '오운완 룩, 밖에 입고 다녀도 됨?', '난 운동 동선이면 오운완 룩이 제일 정직하다고 봄. 꾸안꾸 강요하는 눈치 극혐. 꾸밈파 들어와.', '오운완은 인증용이 아니라 움직임 최적화임. 짐에서 옷 갈아입는 시간이 아깝다.', ARRAY['오운완','운동','룩'], 'A Korean woman in her early 20s walking on a Seoul sidewalk in oversized hoodie and sneakers, gym bag, candid street photo'),
  ('fashion', '명품 하나, 지금 사도 됨?', '난 무지출 한 달 하고 사는 게 충동 방어라고 봄. 지금 아니면 못 산다는 논리 ㄹㅇ 마케팅임. 지금 사자파 나와봐.', '명품은 목표가 될 순 있음. 할부로 자존감 사는 건 다음 달 현타임.', ARRAY['명품','소비','충동'], 'A Korean man in his early 20s holding an unbranded structured bag, thinking, store window behind him, no logos'),
  ('fashion', '검정만 입는 거, 센스임 귀차임?', '난 검정이 실패 확률 낮은 유니폼이라고 봄. 컬러 강요는 취향 간섭임. 컬러파 반박해봐.', '검정은 무난함이 아니라 선택 비용 절감임. 포인트는 가방이랑 신발로 주면 됨.', ARRAY['검정','미니멀','코디'], 'A Korean woman in her early 20s in an all-black casual outfit on a city street, confident natural pose'),
  ('fashion', '운동화가 진리임, 구두가 진리임?', '난 운동화가 출퇴근·약속 전부 커버해서 이득이라고 봄. 구두 하루면 저녁에 발부터 항복임. 구두파 나와봐.', '편해야 표정이 남음. 예쁜 신발에 절뚝이면 코디가 다 죽음.', ARRAY['운동화','구두','편함'], 'A Korean man in his early 20s commuting in clean sneakers, relaxed walk, Seoul sidewalk'),
  ('fashion', '계절 옷 미리 사기, 이득임?', '난 시즌 끝나기 전에 사는 게 가격 이득이라고 봄. 필요할 때 사면 이미 품절임. 즉흥구매파 논리 들어봄.', '미리 사는 건 과소비가 아니라 일정 관리임. 갑자기 추워지면 패딩값이 두 배임.', ARRAY['시즌','쇼핑','계획'], 'A Korean woman in her early 20s holding a light jacket and a padded coat, closet behind her, deciding'),
  ('fashion', '모자·마스크, 요즘 패션임 방어임?', '난 얼굴이 안 나온 날은 모자부터가 코디라고 봄. 꾸민 척 안 해도 되는 방어막임. 맨얼굴 필수파 들어와.', '모자는 대충이 아니라 컨디션 조절임. 20대도 매일 화보일 필요 없음.', ARRAY['모자','컨디션','패션'], 'A Korean man in his early 20s leaving home in a cap and jacket, tired but styled, apartment hallway'),
  ('fashion', '브랜드보다 핏, 이게 맞음?', '난 로고보다 어깨 핏이 사람이 보인다고 봄. 브랜드 자랑은 가까운 사람만 앎. 로고파 나와봐.', '핏이 맞으면 저렴해도 비싸 보임. 브랜드만 믿으면 사이즈에서 들킴.', ARRAY['핏','브랜드','코디'], 'A Korean woman in her early 20s wearing a well-fitted jacket, window light on her shoulder line, no logos'),
  ('fashion', '옷 렌탈, 지금 세대에 이득임?', '난 한 철 행사용은 렌탈이 옷장 포화 안 만드는 길이라고 봄. 내 거라야 애착 생긴다는 쪽 반박해봐.', '렌탈은 유행 따라가다 옷장 터지는 거 방지임. 자주 입는 기본템만 사면 됨.', ARRAY['렌탈','패션','가성비'], 'A Korean woman in her early 20s unzipping a garment bag with a formal outfit, small closet of basics behind her'),

  -- ───────── 맛집: 장소·지역·분위기·서비스·탐방 ─────────
  ('맛집', '성수 카페 거리, 분위기 탐방 진리임?', '난 성수 창가 자리에 앉는 게 그 주 탐방 하이라이트라고 봄. 핫해서 싫은 건 별개. 다른 동네 분위기파 나와봐.', '성수는 음료보다 골목 온도임. 탐방은 그 거리 걷는 시간이 남음.', ARRAY['성수','카페','탐방'], 'A Korean woman in her early 20s walking a brick-cafe street in Seongsu, looking at shopfronts, candid'),
  ('맛집', '망원·연남 골목, 핫플보다 탐방 이득임?', '난 망원 골목 간판 따라가는 게 웨이팅 전쟁보다 탐방 가성비라고 봄. 핫플 인증샷파 논리 가져와.', '골목은 줄이 자산이 아님. 빈자리 보고 들어가는 게 탐방 실력임.', ARRAY['망원','연남','골목'], 'A Korean man in his early 20s turning into a quiet Mangwon alley toward a small restaurant sign'),
  ('맛집', '지방 맛집 탐방, 서울 핫플보다 낫음?', '난 기차 타고 간 지방 집이 서울 오픈런보다 기억이 남는다고 봄. 서울만 탐방이라는 사람 반박해봐.', '지방 집은 서비스가 덜 바쁨. 그 동네 공기까지 메뉴임.', ARRAY['지방','탐방','지역'], 'A Korean woman in her early 20s getting off a regional train with a small bag, small-town station, excited'),
  ('맛집', '시장 골목 탐방이 대로변보다 맞음?', '난 시장 안쪽 손님이 현지인인 집이 탐방 정답이라고 봄. 대로변 포토존파 들어와.', '시장은 분위기랑 회전이 보임. 대로변은 간판이 먼저 보임.', ARRAY['시장','골목','탐방'], 'A Korean man in his early 20s walking through a Korean traditional market aisle, looking at stall fronts'),
  ('맛집', '웨이팅 긴 집, 서비스까지 보면 가치 있음?', '난 한 시간 기다렸는데 직원 응대가 별로면 그 집은 탐방 실패라고 봄. 맛만 보면 된다는 쪽 나와봐.', '웨이팅은 기대값임. 자리 안내가 차면 그 집 급이 보임.', ARRAY['웨이팅','서비스','맛집'], 'A Korean woman in her early 20s being seated by staff after waiting, Korean restaurant interior, relieved smile'),
  ('맛집', '창가 2층 자리가 그 집 분위기임?', '난 창가 아니면 그 집 탐방이 반만 됐다고 봄. 안쪽 자리도 상관없다는 사람 논리 들어봄.', '창가는 인스타용이 아니라 그 집 공기임. 자리 못 맡으면 다른 날 감.', ARRAY['창가','분위기','자리'], 'A Korean man in his early 20s sitting at a second-floor window cafe seat, city view, relaxed'),
  ('맛집', '직원 친절이 재방문 이유 맞음?', '난 음식 비슷하면 응대 좋은 집으로 다시 감. 불친절해도 맛이면 된다는 쪽 반박해봐.', '서비스는 덤이 아님. 탐방에서 기분 상하면 그 골목 전체가 식음.', ARRAY['서비스','친절','재방문'], 'A Korean woman in her early 20s smiling as a server sets down water, warm casual restaurant'),
  ('맛집', '혼밥 자리 있는 집이 탐방 실력임?', '난 1인석·바 좌석 있는 집이 혼자 탐방 가능 지역이라고 봄. 둘이 오라는 눈치 집 극혐. 다른 기준 있어?', '혼밥석은 용기 문제가 아니라 가게 설계임. 그 동네를 일주일에 한 번 더 가게 됨.', ARRAY['혼밥','1인석','탐방'], 'A Korean man in his early 20s sitting at a single counter seat in a small restaurant, calm, chopsticks ready'),
  ('맛집', '24시 식당이 올빼미 탐방 인프라임?', '난 새벽에 문 연 집이 그 지역 생존 맛집이라고 봄. 일찍 닫는 감성집만 탐방이라는 사람 나와봐.', '24시는 낭만이 아니라 퇴근 루트임. 닫힌 골목은 탐방 동선이 끊김.', ARRAY['심야','24시','탐방'], 'A Korean woman in her early 20s sitting at a neon diner counter late at night, tired but comfortable'),
  ('맛집', '매장 앉는 집이 포장창구보다 탐방임?', '난 테이블에 앉아야 그 집 온도가 남는다고 봄. 포장만 빠른 집도 인정하는데, 탐방은 자리값임. 포장파 논리 가져와.', '매장은 공간 서비스까지 먹는 거임. 창구만 있으면 그 집은 배달이랑 비슷해짐.', ARRAY['매장','분위기','탐방'], 'A Korean man in his early 20s sitting down inside a restaurant, takeout window visible near the door'),
  ('맛집', '고깃집 불판 서비스가 그 집 급임?', '난 불판 갈아주고 속도 맞춰주는 집이 회식 탐방 1순위라고 봄. 고기만 두꺼우면 된다는 쪽 들어와.', '고깃집은 불이 서비스임. 직원 동선이 그 집 지역 급을 보여줌.', ARRAY['고깃집','서비스','회식'], 'Young Korean people in their early 20s at a barbecue table as staff changes the grill, lively'),
  ('맛집', '카페는 창가 뷰가 콘센트보다 그 집임?', '난 창가 뷰가 그 카페를 고른 이유라고 봄. 콘센트 전쟁이 탐방의 전부는 아님. 카공 생존파 나와봐.', '카페 탐방은 그 자리의 빛임. 충전기만 보면 어느 집이든 같아짐.', ARRAY['카페','창가','분위기'], 'A Korean woman in her early 20s at a sunlit cafe window, laptop closed, looking outside, iced drink'),

  -- ───────── 맛식: 음식 맛·식감·조합 ─────────
  ('맛식', '찍먹이 진리임, 이게 맞음?', '난 찍먹이 소스 컨트롤이라고 봄. 부먹으면 마지막이 흐물해짐. 부먹파 논리 가져와.', '찍먹은 취향 아니고 식감 관리임. 부먹 하면 중간부터 다른 음식 됨.', ARRAY['찍먹','식감','맛'], 'A Korean man in his early 20s dipping crispy fried food into sauce, close candid'),
  ('맛식', '매운맛이 스트레스 해소 맛임?', '난 매운 게 한 끼를 리셋한다고 봄. 순한 맛만 고르라는 잔소리 극혐. 순한맛파 들어와.', '매운맛은 성격이 아니라 맛의 볼륨임. 단짠만 찾다 보면 입이 심심해짐.', ARRAY['매운맛','떡볶이','맛'], 'A Korean woman in her early 20s eating spicy tteokbokki, flushed happy face, steam rising'),
  ('맛식', '단짠 조합, 아직도 최고 맛임?', '난 단짠이 한 입에 끝나는 설계라고 봄. 건강식만 고집하면 다음 끼가 폭식임. 클린식파 논리 들어봄.', '단짠은 죄책감용 단어가 아님. 한 끼 만족이 야식 한 끼를 줄임.', ARRAY['단짠','맛','조합'], 'A Korean man in his early 20s enjoying fried chicken and a sweet drink, satisfied expression'),
  ('맛식', '국물이 진해야 그 집이 아니라 그 맛이임?', '난 국밥·라면은 국물 농도가 맛의 전부라고 봄. 건더기파 나와봐.', '국물은 간이 아니라 여운임. 싱거우면 한 술이 안 넘어감.', ARRAY['국물','국밥','맛'], 'A Korean woman in her early 20s lifting a spoon of steaming rich Korean soup, close food moment'),
  ('맛식', '겉바속촉이 치킨 진리 맛임?', '난 바삭 한 번이면 그 다음 입은 육즙이라고 봄. 양념 범벅파 논리 가져와.', '치킨은 소리랑 촉감이 맛임. 눅으면 양념이 덮어도 티 남.', ARRAY['치킨','겉바속촉','식감'], 'A Korean man in his early 20s breaking crispy fried chicken, juicy inside visible, casual table'),
  ('맛식', '치즈 늘어나는 게 맛임?', '난 늘어나는 순간이 그 메뉴의 하이라이트라고 봄. 치즈 없는 깔끔파 반박해봐.', '치즈는 간판 토핑이 아니라 식감임. 안 늘어나면 그 메뉴가 아님.', ARRAY['치즈','식감','맛'], 'A Korean woman in her early 20s pulling stretchy cheese from a hot dish, delighted face'),
  ('맛식', '면발 탱탱한 게 맛임?', '난 면이 무르면 소스가 뭔지 상관없다고 봄. 소스 맛만 보자는 쪽 들어와.', '면발은 씹는 맛의 뼈대임. 퍼지면 국물만 남은 거임.', ARRAY['면발','면','식감'], 'A Korean man in his early 20s lifting bouncy noodles with chopsticks, steam, close-up'),
  ('맛식', '뜨거울 때가 맛임, 식어야 맛임?', '난 김 오를 때가 그 음식 피크라고 봄. 식혀 먹는 미식파 논리 들어봄.', '온도가 간임. 식으면 기름이 먼저 느껴짐.', ARRAY['온도','맛','식감'], 'A Korean woman in her early 20s blowing on a hot spoonful, eager expression, home table'),
  ('맛식', '양념이 진리임, 본연의 맛이 진리임?', '난 양념이 한 입을 기억에 남긴다고 봄. 재료 맛만 보자는 쪽 나와봐.', '양념은 과장이 아니라 여운임. 담백만 찾다 보면 다음 끼가 생각남.', ARRAY['양념','본연','맛'], 'A Korean man in his early 20s tasting a well-seasoned Korean side dish, nodding, casual meal'),
  ('맛식', '빙수가 여름 디저트 진리 맛임?', '난 얼음 식감이 아이스크림보다 오래간다고 봄. 아이스크림파 반박해봐.', '빙수는 온도랑 고명이 맛임. 녹기 전에 승부가 남.', ARRAY['빙수','디저트','여름'], 'A Korean woman in her early 20s eating Korean shaved ice with toppings, summer cafe, bright smile'),
  ('맛식', '김밥은 속이 맛임, 밥이 맛임?', '난 속 재료 한 줄이 김밥 전체를 결정한다고 봄. 밥 간만 잘하면 된다는 쪽 들어와.', '김밥은 한 입의 구성임. 속이 싱거우면 김이 아무리 고소해도 빈맛임.', ARRAY['김밥','속','맛'], 'A Korean man in his early 20s biting into kimbap, filling visible, convenience-store or home table'),
  ('맛식', '민트초코, 맛있음 아님?', '난 민트 향이 단맛을 리셋해서 더 먹는다고 봄. 치약 맛이라는 사람 나와봐.', '민초는 취향 테러가 아니라 조합임. 초코만 있으면 중간에 질림.', ARRAY['민초','디저트','맛'], 'A Korean woman in her early 20s eating mint chocolate ice cream, playful expression, cafe dessert'),

  -- ───────── 맛식: 건강식·식단 ─────────
  ('맛식', '단백질 매끼, 이게 맛있는 한 끼임?', '난 매끼 단백질 넣는 게 다음 끼 폭식을 막는 맛이라고 봄. 탄수 위주가 더 배부르다는 쪽 나와봐.', '단백질은 식단 숙제가 아니라 한 입의 밀도임. 없으면 한 시간 뒤에 또 배고픔.', ARRAY['단백질','식단','맛'], 'A Korean man in his early 20s eating grilled chicken and eggs at a small table, satisfied not posed'),
  ('맛식', '저속노화 식단, 맛도 있음?', '난 기름·당 줄인 한 끼가 입이 덜 피곤해서 더 오래 먹는다고 봄. 자극 맛만 진리라는 사람 반박해봐.', '저속노화는 심심함이 아니라 여운임. 매 끼 자극이면 혀가 먼저 지침.', ARRAY['저속노화','식단','맛'], 'A Korean woman in her early 20s eating a colorful vegetable bowl, natural smile, home kitchen light'),
  ('맛식', '샐러드 점심, 한식보다 맛임?', '난 바삭 채소랑 소스가 점심 속도를 이긴다고 봄. 국밥 한 그릇이 진리라는 쪽 들어와.', '샐러드는 다이어트용이 아니라 식감 조합임. 소스만 맞으면 한식이랑 다른 만족임.', ARRAY['샐러드','점심','건강식'], 'A Korean woman in her early 20s eating a loaded salad at a cafe, crunchy vegetables, candid'),
  ('맛식', '닭가슴살, 간만 맞으면 맛임?', '난 염지·에어프라이면 닭가슴살이 치킨 대체 식감이라고 봄. 퍽퍽해서 못 먹겠다는 사람 논리 가져와.', '닭가슴살은 재료가 아니라 간의 문제임. 건조하면 식단이 형벌이 됨.', ARRAY['닭가슴살','식단','식감'], 'A Korean man in his early 20s slicing seasoned grilled chicken breast, juicy inside, meal prep containers'),
  ('맛식', '제로슈거가 단맛 대체 됨?', '난 제로가 후식 참는 것보다 혀를 달래준다고 봄. 인공단맛 극혐파 나와봐.', '제로는 속임수가 아니라 단맛 볼륨 조절임. 당 폭주 한 잔이 다음 끼를 망침.', ARRAY['제로','단맛','식단'], 'A Korean woman in her early 20s drinking a zero-sugar soda with a meal, relaxed cafe table'),
  ('맛식', '현미밥이 흰쌀보다 맛임?', '난 현미 식감이 한 술을 더 오래 가게 한다고 봄. 흰쌀 부드러운 맛이 진리라는 쪽 반박해봐.', '현미는 건강 핑계가 아니라 씹는 맛임. 흰쌀만 있으면 반찬이 과해짐.', ARRAY['현미','밥','건강식'], 'A Korean man in his early 20s eating a bowl of brown rice with Korean side dishes, home table'),
  ('맛식', '요거트볼이 아침 진리 맛임?', '난 새콤이랑 견과 식감이 아침에 제일 빨리 입이 깬다고 봄. 김밥·빵 아침파 들어와.', '요거트볼은 간식이 아니라 첫 끼 조합임. 달기만 하면 그건 디저트임.', ARRAY['요거트','아침','건강식'], 'A Korean woman in her early 20s eating a yogurt bowl with fruit and granola, morning window light'),
  ('맛식', '간헐적 단식 한 끼, 더 맛있어짐?', '난 공복 뒤에 먹는 한 끼가 간도 식감도 더 선명하다고 봄. 세 끼 꼬박이 맛의 기본이라는 사람 나와봐.', '단식은 금식이 아니라 한 끼 밀도임. 배고플 때 먹으면 간이 과해지지 않음.', ARRAY['단식','한끼','식단'], 'A Korean man in his early 20s sitting down to a late hearty first meal of the day, focused and hungry'),

  -- ───────── 영원한 난제 추가 ─────────
  ('eternal_quest', '선톡하는 거, 을임 매너임?', '난 선톡이 호감이지 들이댐이 아니라고 봄. 기다리기만 하면 둘 다 식음. 선톡 극혐파 논리 가져와.', '선톡은 용기지 을의 자세가 아님. 하루 더 고민하는 동안 상대는 다른 톡 봄.', ARRAY['선톡','호감','연애'], 'A Korean woman in her early 20s sending the first message on her phone at a cafe, slightly nervous smile'),
  ('eternal_quest', '기념일 올인, 부담임 로맨스임?', '난 평소 배려가 케이크 한 판보다 큼. 기념일에만 올인하는 연애 극혐. 이벤트파면 논리 증명해봐.', '기념일은 인증샷용이면 식음. 평소 밥 한 끼가 더 남음.', ARRAY['기념일','연애','부담'], 'A Korean man in his early 20s bringing a simple home-cooked meal instead of a huge cake, small apartment table'),
  ('eternal_quest', '주말 약속 두 개, 과함임?', '난 주말 하나 비워두는 게 멘탈 충전이라고 봄. 빽빽한 스케줄이 인싸라는 사람 나와봐.', '주말은 실적이 아님. 공백이 있어야 다음 주도 사람이 됨.', ARRAY['주말','약속','라이프'], 'A Korean woman in her early 20s cancelling one weekend plan and staying home in loungewear, relieved'),
  ('eternal_quest', '배달 기본값, 요리하는 게 이득임?', '난 배달 한 번 참으면 주말 예산이 생긴다고 봄. 바쁜데 왜 하냐고 하는 사람 반박해봐.', '배달은 편의지 기본값이 아님. 한 끼 해먹으면 통장이 숨 쉼.', ARRAY['배달','요리','돈'], 'A Korean man in his early 20s cooking a simple pan meal in a small kitchen, phone with a delivery app face down'),
  ('eternal_quest', '친구 소수 정예, 이게 행복임?', '난 소수 정예가 유지 비용 적어서 이득이라고 봄. 넓은 관계는 단톡에 체력 다 씀. 인싸파 논리 들어봄.', '친구 수는 프로필이 아님. 바쁠 때 한 명 나오는 게 진짜임.', ARRAY['친구','소수정예','관계'], 'Two Korean friends in their early 20s talking at a quiet cafe table, unhurried, candid'),
  ('eternal_quest', '알람 다섯 개, 이게 생존임?', '난 알람 여러 개가 스누즈 습관을 더 만든다고 봄. 한 방에 일어나는 쪽이 아침을 이김. 알람 도미노파 들어와.', '알람 다섯 개는 보험이 아니라 수면 도둑임. 첫 알람에 일어나는 게 갓생임.', ARRAY['알람','수면','루틴'], 'A Korean woman in her early 20s turning off a single morning alarm and sitting up, messy hair, daylight'),

  -- ───────── 패션 추가 ─────────
  ('fashion', '흰티가 옷장 진리임?', '난 흰티가 실패 확률 낮은 기본값이라고 봄. 패턴 티가 개성이라는 쪽 나와봐.', '흰티는 무난함이 아니라 코디 플랫폼임. 포인트는 겉옷이랑 신발이 하면 됨.', ARRAY['흰티','기본템','코디'], 'A Korean man in his early 20s wearing a plain white tee and a jacket, Seoul street, candid no logos'),
  ('fashion', '가방은 하나면 됨?', '난 매일 드는 가방 하나가 코디를 이긴다고 봄. 유행 백 돌리는 거 예산 붕괴임. 백 컬렉션파 반박해봐.', '가방은 개수가 아니라 동선임. 매일 안 들면 그건 짐임.', ARRAY['가방','미니멀','패션'], 'A Korean woman in her early 20s carrying one well-worn structured bag on the subway, natural'),
  ('fashion', '안경이 패션임, 보정임?', '난 안경이 얼굴 라인보다 코디 완성도가 높다고 봄. 렌즈만 진리라는 사람 들어와.', '안경은 숨김이 아니라 얼굴 프레임임. 잘 고르면 화장보다 빨리 정돈됨.', ARRAY['안경','패션','얼굴'], 'A Korean man in his early 20s adjusting simple glasses in a hallway mirror, casual outfit'),
  ('fashion', '여름 샌들, 밖에 신고 다녀도 됨?', '난 더우면 샌들이 표정을 살린다고 봄. 운동화 고집하다 발 붓는 거 손해. 발등 가림파 나와봐.', '편해야 걸음이 예쁨. 예쁜 신발에 절뚝이면 코디가 죽음.', ARRAY['샌들','여름','편함'], 'A Korean woman in her early 20s walking a sunny Seoul sidewalk in simple sandals, relaxed pace'),
  ('fashion', '레이어드, 과함임 센스임?', '난 얇게 겹치는 게 체온이랑 실루엣 둘 다 잡는 길이라고 봄. 한 장만 입는 게 깔끔이라는 쪽 논리 가져와.', '레이어드는 과장이 아니라 온도 조절임. 실내면 겉옷만 벗으면 됨.', ARRAY['레이어드','코디','계절'], 'A Korean man in his early 20s wearing a tee, shirt, and light jacket, indoor-outdoor cafe doorway'),
  ('fashion', '빈티지 마켓, 중고보다 탐방임?', '난 마켓에서 고르는 시간이 코디 실력이라고 봄. 새상표 온라인이 빠르다는 사람 반박해봐.', '빈티지는 촌내가 아니라 한 벌의 이야기임. 빨리 사는 옷은 빨리 질림.', ARRAY['빈티지','마켓','패션'], 'A Korean woman in her early 20s browsing a vintage clothing rail outdoors, holding up a jacket'),
  ('fashion', '액세서리 최소, 이게 세련임?', '난 포인트 하나만 주는 게 실패가 적다고 봄. 겹칠수록 개성이라는 쪽 들어와.', '액세서리는 개수가 센스가 아님. 얼굴이 가려지면 코디가 짐이 됨.', ARRAY['액세서리','미니멀','센스'], 'A Korean woman in her early 20s wearing one simple necklace with a plain outfit, natural light portrait'),
  ('fashion', '청바지 인생핏, 지금 찾아도 됨?', '난 다리 핏 맞는 청바지 하나가 옷장을 반으로 줄인다고 봄. 유행 와이드만 산다는 사람 나와봐.', '청바지는 유행보다 길이·허리가 인격임. 안 맞으면 상의가 다 죽음.', ARRAY['청바지','핏','기본템'], 'A Korean man in his early 20s checking jeans fit in a shop mirror, natural stance, no logos'),
  ('fashion', '비 오는 날 코디, 기능이 패션임?', '난 젖지 않는 게 제일 세련됐다고 봄. 예쁜 신발 버리고 가는 거 현타임. 감성 레인부츠 반대파 논리 들어봄.', '비 오는 날은 방수가 코디임. 젖은 청바지가 제일 티 남.', ARRAY['비','코디','기능'], 'A Korean woman in her early 20s in a simple raincoat and sneakers on a wet Seoul street, candid'),
  ('fashion', '편집샵 vs 기본몰, 어디가 이득임?', '난 기본몰에서 반복 구매가 실패값이 낮다고 봄. 편집샵 한 방이 스타일이라는 쪽 나와봐.', '편집샵은 영감이고 기본몰은 실전임. 매일 입을 옷이 진짜 옷장임.', ARRAY['편집샵','가성비','쇼핑'], 'A Korean man in his early 20s comparing a simple tee in hand with a boutique rack behind him, deciding'),

  -- ───────── 맛집 추가 ─────────
  ('맛집', '홍대 골목 탐방, 메인거리보다 맞음?', '난 홍대 안쪽 골목이 간판 전쟁보다 탐방이라고 봄. 메인거리 인증파 논리 가져와.', '홍대는 네온이 아니라 골목 회전임. 큰길만 걸으면 그 동네를 안 본 거임.', ARRAY['홍대','골목','탐방'], 'A Korean woman in her early 20s turning into a Hongdae side alley toward a small eatery, night lights'),
  ('맛집', '을지로 노포, 힙한 신상보다 탐방임?', '난 자리 좁고 오래된 집이 그 지역 온도라고 봄. 인테리어 신상만 탐방이라는 사람 들어와.', '노포는 촌내가 아니라 회전과 손맛의 기록임. 예쁜 집만 가면 동네가 안 보임.', ARRAY['을지로','노포','탐방'], 'A Korean man in his early 20s sitting at a cramped old restaurant counter in Euljiro, steam, candid'),
  ('맛집', '한강 근처 집, 뷰가 탐방 이유 됨?', '난 먹고 나서 강 걷는 동선이 그 집 값이라고 봄. 음식만 보면 된다는 쪽 반박해봐.', '한강 근처는 식사 플러스 동선임. 뷰만 보고 맛이 없으면 그건 풍경임.', ARRAY['한강','뷰','탐방'], 'Two Korean people in their early 20s walking along the Hangang after a meal, evening, casual clothes'),
  ('맛집', '예약제 집, 웨이팅보다 탐방 이득임?', '난 시간 맞춰 들어가는 게 줄 서는 체력보다 이득이라고 봄. 줄이 맛의 증거라는 사람 나와봐.', '예약은 편법이 아니라 일정 관리임. 한 시간 줄이 그 집 급을 증명하진 않음.', ARRAY['예약','웨이팅','맛집'], 'A Korean woman in her early 20s checking a reservation on her phone at a restaurant door, on time'),
  ('맛집', '주차 되는 집, 탐방 실력에 넣어도 됨?', '난 차 오는 친구 있으면 주차가 그 집 인프라라고 봄. 맛만 보면 된다는 쪽 논리 들어봄.', '주차는 사치가 아니라 동선임. 빙빙 돌다 화나면 그 집 음식이 먼저 식음.', ARRAY['주차','맛집','동선'], 'A Korean man in his early 20s parking near a small restaurant, looking relieved, residential street'),
  ('맛집', '대학가 분식골목, 핫플보다 탐방임?', '난 학생 회전 빠른 골목이 가격이랑 속도가 정직하다고 봄. 오픈런 핫플만 탐방이라는 사람 들어와.', '대학가는 유행이 아니라 허기 인프라임. 줄이 짧아도 그 맛이 현지임.', ARRAY['대학가','분식','골목'], 'Young Korean people in their early 20s eating at a small tteokbokki stall near a campus, casual'),
  ('맛집', '해장 탐방, 점심 핫플보다 그 지역임?', '난 아침 국밥집이 그 동네 생존 맛집이라고 봄. 브런치만 탐방이라는 쪽 나와봐.', '해장은 낭만이 아니라 회복 루트임. 문이 일찍 열리는 집이 지역을 먹임.', ARRAY['해장','국밥','탐방'], 'A Korean woman in her early 20s eating hangover soup in the morning at a no-frills restaurant, tired but comforted'),
  ('맛집', '평일 점심 탐방이 주말 오픈런보다 맞음?', '난 평일 점심이 서비스랑 자리가 정직하다고 봄. 주말 줄이 진리라는 사람 반박해봐.', '주말 오픈런은 인기이지 탐방 실력이 아님. 평일 빈자리가 그 집 본판임.', ARRAY['평일','점심','탐방'], 'A Korean man in his early 20s being seated immediately at a weekday lunch restaurant, relaxed');
