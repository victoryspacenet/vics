/** 문의하기 FAQ 공통 데이터 */

import { RANKING_CELEBRATION_AMOUNTS } from './rankingCelebrationRewards'

/** 메인 페이지 상단 노출용 FAQ ID 순서 (Supabase 설정 전 기본값) */
export const FAQ_MAIN_IDS = ['1', '2', '3']

/**
 * @typedef {Object} FaqAction
 * @property {string} text - 버튼/링크 텍스트
 * @property {string} to - 이동 경로 (딥링크)
 */

/**
 * @typedef {Object} FaqItem
 * @property {string} question
 * @property {string} answer - 요약 또는 본문
 * @property {string[]} [steps] - 번호 매긴 단계별 답변 (가독성)
 * @property {FaqAction[]} [actions] - 즉시 실행 딥링크
 * @property {string} [illustration] - 'points' | 'vote' | 'report' | 'profile' | 'ranking' | 'delete' - 간단 일러스트 타입
 * @property {'matchup'|'account'|'report'|'ranking'} [category] - 문의하기 카테고리별 도움말 구분
 */

export const FAQ_ITEMS = {
  '1': {
    question: '승리 포인트는 언제 들어오나요?',
    answer: '매치업 결과가 확정된 후 포인트가 지급됩니다.',
    steps: [
      '매치업 결과가 확정되면 24시간 이내에 적중 시 포인트가 자동 지급됩니다.',
      '마이페이지/랭킹페이지에서 내 포인트 현황을 확인할 수 있어요.',
      '포인트는 시즌별로 집계되며, 시즌 종료 시 일부 리셋될 수 있습니다.',
    ],
    actions: [
      { text: '랭킹에서 포인트 확인하기', to: '/ranking' },
      { text: '경쟁 참여하기', to: '/' },
    ],
    illustration: 'points',
    category: 'matchup',
  },
  '2': {
    question: '주제와 상관없는 글 신고는 어디서?',
    answer: '문의하기의 「1:1 문의하기」에서 카테고리 「신고」로 접수할 수 있어요.',
    steps: [
      '문의하기 → 「1:1 문의하기」로 이동합니다.',
      '카테고리에서 「신고」를 선택합니다.',
      '신고 대상(매치업 링크·상황 설명 등)을 적고 제출하면 운영팀 검토 후 조치됩니다.',
    ],
    actions: [
      { text: '신고 접수하기 (1:1 문의)', to: '/inquiry/form?category=report' },
      { text: '커뮤니티 가이드 보기', to: '/community-policy' },
    ],
    illustration: 'report',
    category: 'report',
  },
  '3': {
    question: '닉네임 변경하고 싶어요!',
    answer: '마이페이지에서 프로필을 수정할 수 있어요.',
    steps: [
      '마이페이지로 이동합니다.',
      '프로필 수정 버튼을 탭합니다.',
      '닉네임을 변경하고 저장합니다.',
      '변경 후 같은 시즌 동안 재변경이 제한됩니다. 한 시즌에 1회 변경 가능합니다.',
    ],
    actions: [
      { text: '프로필 수정하기', to: '/mypage/edit' },
      { text: '마이페이지로 이동', to: '/mypage' },
    ],
    illustration: 'profile',
    category: 'account',
  },
  '4': {
    question: '투표는 어떻게 하나요?',
    answer: '매치업 카드를 탭하고 선택지를 누르면 됩니다.',
    steps: [
      '홈 또는 매치업 피드에서 원하는 매치업 카드를 탭합니다.',
      '화면에 표시된 두 선택지 중 하나를 탭합니다.',
      '투표가 완료되면 결과를 확인할 수 있어요.',
    ],
    actions: [
      { text: '경쟁 참여하기', to: '/' },
      { text: '매치업 목록 보기', to: '/matchups' },
    ],
    illustration: 'vote',
    category: 'matchup',
  },
  '5': {
    question: '계정 삭제는 어떻게 하나요?',
    answer: '마이페이지 설정에서 계정 삭제를 진행할 수 있어요.',
    steps: [
      '마이페이지로 이동합니다.',
      '프로필 수정 탭을 찾습니다.',
      '회원탈퇴를 선택하고 안내에 따라 진행합니다.',
      '삭제 시 모든 데이터가 영구 삭제되며 복구할 수 없습니다.',
    ],
    actions: [
      { text: '계정 삭제하기', to: '/mypage/delete' },
      { text: '마이페이지로 이동', to: '/mypage' },
    ],
    illustration: 'delete',
    category: 'account',
  },
  '7': {
    question: '시즌제 랭킹이 무엇인가요?',
    answer: '집계 구간을 시즌으로 나누어 순위를 보여 주는 기능이에요.',
    steps: [
      '한 시즌 동안의 포인트·전적 등으로 순위가 집계될 수 있어요.',
      '시즌이 바뀌면 정책에 따라 일부 수치가 초기화되거나 새 시즌 전용 랭킹으로 이어질 수 있어요.',
      '랭킹 화면에서 현재 시즌과 정렬 기준을 확인해 주세요.',
    ],
    actions: [
      { text: '랭킹 보기', to: '/ranking' },
      { text: '마이페이지', to: '/mypage' },
    ],
    illustration: 'ranking',
    category: 'ranking',
  },
  '8': {
    question: '랭킹 축하 보너스 금액 기준은?',
    answer: '랭킹 TOP10에 들면 순위별 축하 보너스 포인트가 지급됩니다.',
    steps: [
      `1위 ${RANKING_CELEBRATION_AMOUNTS.rank1.toLocaleString('ko-KR')}P, 2위 ${RANKING_CELEBRATION_AMOUNTS.rank2.toLocaleString('ko-KR')}P, 3위 ${RANKING_CELEBRATION_AMOUNTS.rank3.toLocaleString('ko-KR')}P, 4~10위 각 ${RANKING_CELEBRATION_AMOUNTS.rank4to10.toLocaleString('ko-KR')}P입니다.`,
      '이번 주·이번 달·전체 등 랭킹 기간·탭·정렬 조합마다 1회씩 수령할 수 있어요.',
      '랭킹 화면에서 축하 카드가 뜨면 보너스를 받을 수 있습니다.',
      '실제 랭킹 집계·투표 활동이 없으면 지급되지 않을 수 있어요.',
    ],
    actions: [
      { text: '랭킹 보기', to: '/ranking' },
      { text: '포인트 리워드', to: '/rewards' },
    ],
    illustration: 'ranking',
    category: 'ranking',
  },
}

/** 관리자 화면에서 고를 수 있는 전체 FAQ id */
export const FAQ_ALL_IDS = Object.keys(FAQ_ITEMS).sort((a, b) => Number(a) - Number(b))

/** 문의하기 — 카테고리 슬러그 (매치업 / 계정 / 신고 / 랭킹) */
export const INQUIRY_CATEGORY_SLUGS = ['matchup', 'account', 'report', 'ranking']
