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
  ('맛식', '간헐적 단식 한 끼, 더 맛있어짐?', '난 공복 뒤에 먹는 한 끼가 간도 식감도 더 선명하다고 봄. 세 끼 꼬박이 맛의 기본이라는 사람 나와봐.', '단식은 금식이 아니라 한 끼 밀도임. 배고플 때 먹으면 간이 과해지지 않음.', ARRAY['단식','한끼','식단'], 'A Korean man in his early 20s sitting down to a late hearty first meal of the day, focused and hungry');
