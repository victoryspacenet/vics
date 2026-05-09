import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/lib/faqData.js', 'r', encoding='utf-8') as f:
    content = f.read()

old = """  '6': {
    question: 'ㅎㅎㅎ',
    answer: '매치업 만들기·투표·결과 확인 등 궁금한 점을 아래에서 안내해 드릴게요.',
    steps: [
      '홈 또는 매치업 피드에서 카드를 탭해 상세로 들어갑니다.',
      '투표·댓글 등은 매치업 상세 화면의 안내에 따라 이용할 수 있어요.',
      '오류나 이상이 있으면 1:1 문의로 접수해 주세요.',
    ],
    actions: [
      { text: '경쟁 참여하기', to: '/' },
      { text: '1:1 문의하기', to: '/inquiry/form?category=matchup' },
    ],
    illustration: 'vote',
    category: 'matchup',
  },
  '7':"""

new = """  '7':"""

if old in content:
    content = content.replace(old, new)
    print("FAQ '6' (ㅎㅎㅎ) removed")
else:
    print('Pattern not found, trying alternate...')
    idx = content.find("'ㅎㅎㅎ'")
    if idx >= 0:
        print(repr(content[idx-30:idx+200]))

with open('src/lib/faqData.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')
