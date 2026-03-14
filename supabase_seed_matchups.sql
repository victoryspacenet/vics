-- =============================================
-- VICS - 메인 페이지 시드 매치업 (베스트/추천/NEW)
-- Supabase SQL Editor에서 실행하세요
-- * profiles에 최소 1명의 사용자가 있어야 합니다 (회원가입 후 실행)
-- =============================================

DO $$
DECLARE
  seed_user_id uuid;
BEGIN
  SELECT id INTO seed_user_id FROM public.profiles ORDER BY created_at ASC LIMIT 1;
  IF seed_user_id IS NULL THEN
    RAISE EXCEPTION '프로필이 없습니다. 먼저 회원가입을 해주세요.';
  END IF;

  -- 기존 시드 삭제
  DELETE FROM public.matchups WHERE user_id = seed_user_id AND title IN (
    '여름 vs 겨울', '커피 vs 차', '고양이 vs 강아지',
    '민트초코 vs 반민초', '부먹 vs 찍먹', '와이드팬츠 vs 스키니진',
    '산 vs 바다', '짜장면 vs 짬뽕', '피자 vs 치킨'
  );

  -- 베스트 3개 (투표수 많음)
  INSERT INTO public.matchups (user_id, title, description, left_type, left_url, left_thumbnail_url, left_label, right_type, right_url, right_thumbnail_url, right_label, left_votes, right_votes, total_votes, status, category, created_at)
  VALUES
    (seed_user_id, '여름 vs 겨울', '어느 계절이 더 좋나요?', 'image', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400', '여름', 'image', 'https://images.unsplash.com/photo-1516912481808-3406841bd33b?w=400', 'https://images.unsplash.com/photo-1516912481808-3406841bd33b?w=400', '겨울', 6542, 5803, 12345, 'active', '밸런스', now() - interval '7 days'),
    (seed_user_id, '커피 vs 차', '아침에 뭐 한 잔 하세요?', 'image', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400', 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400', '커피', 'image', 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400', 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400', '차', 5120, 4756, 9876, 'active', '맛집', now() - interval '5 days'),
    (seed_user_id, '고양이 vs 강아지', '당신의 반려동물은?', 'image', 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400', 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400', '고양이', 'image', 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400', 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400', '강아지', 2891, 2541, 5432, 'active', '밸런스', now() - interval '3 days');

  -- 추천 3개 (박빙 - 비슷한 투표수)
  INSERT INTO public.matchups (user_id, title, description, left_type, left_text, left_label, right_type, right_text, right_label, left_votes, right_votes, total_votes, status, category, created_at)
  VALUES
    (seed_user_id, '민트초코 vs 반민초', '치약맛이냐 아니냐 그것이 문제로다', 'text', '🍃 민트초코는 상쾌하고 시원해요!', '민초', 'text', '❌ 치약 맛이에요', '반민초', 498, 502, 1000, 'active', '밸런스', now() - interval '2 days'),
    (seed_user_id, '부먹 vs 찍먹', '탕수육 소스 스타일', 'text', '🍚 밥이랑 비벼서 먹는 게 진리', '부먹', 'text', '🥢 찍어 먹어야 바삭해요', '찍먹', 512, 488, 1000, 'active', '맛집', now() - interval '1 day'),
    (seed_user_id, '와이드팬츠 vs 스키니진', '님의 취향 저격! #오오티디 대결', 'text', '넓고 편한 와이드', '와이드', 'text', '슬림하게 스키니', '스키니', 505, 495, 1000, 'active', '패션', now() - interval '12 hours');

  -- NEW 3개 (최신)
  INSERT INTO public.matchups (user_id, title, description, left_type, left_url, left_thumbnail_url, left_label, right_type, right_url, right_thumbnail_url, right_label, left_votes, right_votes, total_votes, status, category, created_at)
  VALUES
    (seed_user_id, '산 vs 바다', '선호하는 휴가지 스타일', 'image', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400', '산', 'image', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400', '바다', 23, 18, 41, 'active', '밸런스', now() - interval '30 minutes'),
    (seed_user_id, '짜장면 vs 짬뽕', '중화요리 메뉴 선택', 'image', 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400', 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400', '짜장면', 'image', 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=400', 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=400', '짬뽕', 12, 9, 21, 'active', '맛집', now() - interval '10 minutes'),
    (seed_user_id, '피자 vs 치킨', '회식 메뉴로 뭘 고르세요?', 'image', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400', 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400', '피자', 'image', 'https://images.unsplash.com/photo-1567620832903-0fc676de3066?w=400', 'https://images.unsplash.com/photo-1567620832903-0fc676de3066?w=400', '치킨', 5, 3, 8, 'active', '맛집', now());

END $$;
