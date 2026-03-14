import { supabase } from './supabase'

// 추천 매치업 비어 있을 때 표시할 데모 데이터 (로컬 이미지 - 항상 로드됨)
const HOT_FALLBACK = [
  {
    id: 'hot-demo-1',
    title: '민트초코 vs 반민초',
    left_votes: 48,
    right_votes: 52,
    total_votes: 100,
    left_type: 'image',
    right_type: 'image',
    left_label: '민트초코',
    right_label: '반민초',
    left_thumbnail_url: '/images/demo/mintcho.svg',
    right_thumbnail_url: '/images/demo/antimint.svg',
    tags: ['음식', '디저트'],
    profiles: { nickname: '데모', avatar_url: null },
  },
  {
    id: 'hot-demo-2',
    title: '와이드팬츠 vs 스키니진',
    left_votes: 55,
    right_votes: 45,
    total_votes: 80,
    left_type: 'image',
    right_type: 'image',
    left_label: '와이드팬츠',
    right_label: '스키니진',
    left_thumbnail_url: '/images/demo/wide.svg',
    right_thumbnail_url: '/images/demo/skinny.svg',
    tags: ['패션', '팬츠'],
    profiles: { nickname: '데모', avatar_url: null },
  },
  {
    id: 'hot-demo-3',
    title: '부먹 vs 찍먹',
    left_votes: 52,
    right_votes: 48,
    total_votes: 120,
    left_type: 'image',
    right_type: 'image',
    left_label: '부먹',
    right_label: '찍먹',
    left_thumbnail_url: '/images/demo/bumuk.svg',
    right_thumbnail_url: '/images/demo/jjikmuk.svg',
    tags: ['음식', '한식'],
    profiles: { nickname: '데모', avatar_url: null },
  },
]

export async function fetchMainMatchups() {
  // 베스트/추천: 오른쪽이 채워진 완료 매치업
  const { data: complete } = await supabase
    .from('matchups')
    .select('*, profiles:user_id(id, nickname, avatar_url, points)')
    .eq('status', 'active')
    .not('right_type', 'is', null)
    .limit(100)

  const pool = complete || []
  const bestList = [...pool].sort((a, b) => (b.total_votes || 0) - (a.total_votes || 0)).slice(0, 50)
  const hotFromDb = pool
    .filter((m) => (m.total_votes || 0) > 0)
    .map((m) => ({ ...m, _gap: Math.abs((m.left_votes || 0) - (m.right_votes || 0)) / Math.max(1, m.total_votes) }))
    .sort((a, b) => a._gap - b._gap)
    .slice(0, 50)

  // 추천: 비어 있거나 3개 미만이면 데모 데이터로 채움
  const hotList = hotFromDb.length >= 3 ? hotFromDb : HOT_FALLBACK

  // NEW: 오른쪽이 비어 있는 매치업 (도전자 대기)
  const { data: newPool } = await supabase
    .from('matchups')
    .select('*, profiles:user_id(id, nickname, avatar_url, points)')
    .eq('status', 'active')
    .is('right_type', null)
    .order('created_at', { ascending: false })
    .limit(50)
  const newList = newPool || []

  return { best: bestList, hot: hotList, new: newList }
}
