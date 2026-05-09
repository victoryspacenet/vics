import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/pages/VictoryReportPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = """/**
 * 기간별 가상 통계 — UI·미리보기 연동용 (추후 Supabase 집계로 교체)
 * 짧은 구간일수록 수치·투표가 작게 보이도록 스케일만 조정했습니다.
 */
const DEMO_STATS_BY_PERIOD = {
  'this-month': {
    wRate: 86,
    totalWins: 12,
    totalMvp: 3,
    creations: 8,
    creationWins: 6,
    bestMatchup: '[봄 코디] vs [가을 코디]',
    votes: 34,
    votingAcc: 71,
    upsetMatchup: '[커피] vs [차]',
  },
  'last-month': {
    wRate: 89,
    totalWins: 21,
    totalMvp: 5,
    creations: 15,
    creationWins: 12,
    bestMatchup: '[운동화] vs [샌들]',
    votes: 58,
    votingAcc: 75,
    upsetMatchup: '[아이폰] vs [갤럭시]',
  },
  '90d': {
    wRate: 90,
    totalWins: 51,
    totalMvp: 15,
    creations: 33,
    creationWins: 28,
    bestMatchup: '[치킨] vs [피자]',
    votes: 118,
    votingAcc: 77,
    upsetMatchup: '[국내 여행] vs [해외 여행]',
  },
  all: {
    wRate: 91,
    totalWins: 152,
    totalMvp: 45,
    creations: 95,
    creationWins: 82,
    bestMatchup: '[코트] vs [패딩]',
    votes: 210,
    votingAcc: 78,
    upsetMatchup: '[나이키] vs [아디다스]',
  },
}"""

new = """const EMPTY_STATS = {
  wRate: 0,
  totalWins: 0,
  totalMvp: 0,
  creations: 0,
  creationWins: 0,
  bestMatchup: '',
  votes: 0,
  votingAcc: 0,
  upsetMatchup: '',
}

const DEMO_STATS_BY_PERIOD = {
  'this-month': EMPTY_STATS,
  'last-month': EMPTY_STATS,
  '90d': EMPTY_STATS,
  all: EMPTY_STATS,
}"""

if old in content:
    content = content.replace(old, new, 1)
    print('OK: DEMO_STATS_BY_PERIOD replaced with zeros')
else:
    print('NOT FOUND')

with open('src/pages/VictoryReportPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')
