import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/pages/MyPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = '              rankLabel={overallRankGradeLabel(stats?.rank)}'
new = '              rankLabel={points > 0 ? overallRankGradeLabel(stats?.rank) : null}'

if old in content:
    content = content.replace(old, new, 1)
    print('OK: rankLabel now hidden when points = 0')
else:
    print('NOT FOUND')

with open('src/pages/MyPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')
