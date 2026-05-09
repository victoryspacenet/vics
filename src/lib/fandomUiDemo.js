/**
 * 내 팬덤 와이어용 고정 표시값 (실데이터 연동 시 교체)
 */
export const FANDOM_UI_WIRE = {
  claps: 1245,
  tierId: 'gold',
}

/** 최근 응원 한마디 와이어 (14건 · 페이지당 5개 시 3페이지) */
export const FANDOM_UI_WIRE_CHEERS = [
  { id: 'fc-m1', body: '이번 V-Card 승률 실화냐? 진짜 대박임 ㄷㄷ', profiles: { nickname: '승률요정' } },
  { id: 'fc-m2', body: '다음 매치업도 무조건 투표 갑니다!', profiles: { nickname: '투표천사' } },
  { id: 'fc-m3', body: '오늘 하이라이트 컷 미쳤어요… 계속 돌려봄', profiles: { nickname: '하이라이트러버' } },
  { id: 'fc-m4', body: '랭킹 올라가는 거 응원해요 화이팅!!', profiles: { nickname: '랭킹응원단' } },
  { id: 'fc-m5', body: '댓글에 골드 오라 있는 거 멋짐 ㅠㅠ', profiles: { nickname: '네온덕후' } },
  { id: 'fc-m6', body: 'V-Card 공유 링크 친구한테도 보냈어요', profiles: { nickname: '공유요정' } },
  { id: 'fc-m7', body: '시즌 내내 팬 할게요', profiles: { nickname: '시즌팬' } },
  { id: 'fc-m8', body: '어제 경기 리액션 너무 웃김 ㅋㅋㅋ', profiles: { nickname: '리액킹' } },
  { id: 'fc-m9', body: '프로필 사진 바뀐 거 잘 어울려요', profiles: { nickname: '비주얼팬' } },
  { id: 'fc-m10', body: '다이아 가시면 저도 같이 축하할래요', profiles: { nickname: '다이아기원' } },
  { id: 'fc-m11', body: '매치업 댓글에서 항상 응원해요', profiles: { nickname: '댓살이' } },
  { id: 'fc-m12', body: 'FP 상점 열리면 첫 구매 각이에요', profiles: { nickname: 'FP저축러' } },
  { id: 'fc-m13', body: '클랩 1000 넘은 거 축하드려요 🎉', profiles: { nickname: '마일스톤팬' } },
  { id: 'fc-m14', body: '다음 시즌도 같이 가요', profiles: { nickname: '시즌2기대' } },
]

/**
 * Gate 마일스톤 판정에 와이어 Clap을 합산할지.
 * `VITE_FANDOM_UI_DEMO=true` 이면 `max(실제 누적, FANDOM_UI_WIRE.claps)` 로 미수령 구간을 찾습니다.
 */
export function fandomUiDemoGateEnabled() {
  const v = import.meta.env.VITE_FANDOM_UI_DEMO
  return v === 'true' || v === '1'
}
