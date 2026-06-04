-- 메인 시드 매치업 제거 (스포트라이트·배너 구매 목록에 뜨는 샘플 데이터)
-- Supabase SQL Editor에서 실행

DELETE FROM public.matchups
WHERE title IN (
  '여름 vs 겨울',
  '커피 vs 차',
  '고양이 vs 강아지',
  '민트초코 vs 반민초',
  '부먹 vs 찍먹',
  '와이드팬츠 vs 스키니진',
  '산 vs 바다',
  '짜장면 vs 짬뽕',
  '피자 vs 치킨'
);
