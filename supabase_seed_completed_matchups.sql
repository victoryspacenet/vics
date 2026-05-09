-- =============================================
-- VICS - 투표완료 매치업 시드 (무승부 포함)
-- Supabase SQL Editor에서 실행하세요
-- * profiles에 최소 1명의 사용자가 있어야 합니다 (회원가입 후 실행)
-- * supabase_create_enhance.sql (expires_at 컬럼) 적용 후 실행
-- =============================================

DO $$
DECLARE
  seed_user_id uuid;
  past_time timestamptz := now() - interval '3 days';
BEGIN
  SELECT id INTO seed_user_id FROM public.profiles ORDER BY created_at ASC LIMIT 1;
  IF seed_user_id IS NULL THEN
    RAISE EXCEPTION '프로필이 없습니다. 먼저 회원가입을 해주세요.';
  END IF;

  -- 기존 시드 삭제 (같은 제목)
  DELETE FROM public.matchups WHERE user_id = seed_user_id AND title IN (
    '아침형 vs 저녁형', '햄버거 vs 샌드위치', '영화 vs 드라마',
    '맥북 vs 윈도우', '여행 vs 집콕', '아이스 vs 핫'
  );

  -- 1. A측 승리 (left > right)
  INSERT INTO public.matchups (user_id, title, description, left_type, left_text, left_label, right_type, right_text, right_label, left_votes, right_votes, total_votes, status, category, expires_at, created_at)
  VALUES
    (seed_user_id, '아침형 vs 저녁형', '당신의 생체리듬은?', 'text', '🌅 새벽에 일어나 상쾌해요', '아침형', 'text', '🌙 밤이 되면 활력이 솟아요', '저녁형', 720, 480, 1200, 'active', '밸런스', past_time, past_time - interval '2 days'),
    (seed_user_id, '햄버거 vs 샌드위치', '점심 메뉴 선택', 'text', '🍔 든든하고 맛있어요', '햄버거', 'text', '🥪 가볍고 건강해요', '샌드위치', 890, 310, 1200, 'active', '맛집', past_time, past_time - interval '1 day');

  -- 2. B측 승리 (right > left)
  INSERT INTO public.matchups (user_id, title, description, left_type, left_text, left_label, right_type, right_text, right_label, left_votes, right_votes, total_votes, status, category, expires_at, created_at)
  VALUES
    (seed_user_id, '영화 vs 드라마', '주말에 뭘 보세요?', 'text', '🎬 2시간에 완결', '영화', 'text', '📺 몰입감 최고', '드라마', 420, 780, 1200, 'active', '밸런스', past_time, past_time - interval '4 days'),
    (seed_user_id, '맥북 vs 윈도우', '노트북 선택', 'text', '🍎 애플 생태계', '맥북', 'text', '🪟 호환성과 가성비', '윈도우', 380, 820, 1200, 'active', '밸런스', past_time, past_time - interval '5 days');

  -- 3. 무승부 (50:50)
  INSERT INTO public.matchups (user_id, title, description, left_type, left_text, left_label, right_type, right_text, right_label, left_votes, right_votes, total_votes, status, category, expires_at, created_at)
  VALUES
    (seed_user_id, '여행 vs 집콕', '휴가 스타일', 'text', '✈️ 새로운 곳으로', '여행', 'text', '🏠 편안한 내 공간', '집콕', 500, 500, 1000, 'active', '밸런스', past_time, past_time - interval '6 days'),
    (seed_user_id, '아이스 vs 핫', '커피 온도 선택', 'text', '🧊 시원하게 아이스', '아이스', 'text', '☕ 따뜻하게 핫', '핫', 250, 250, 500, 'active', '맛집', past_time, past_time - interval '7 days');

END $$;
