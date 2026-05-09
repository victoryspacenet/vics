import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/pages/VictoryReportPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = "{PERIODS.find((p) => p.id === period)?.label} · 가상 데이터"
new = "{PERIODS.find((p) => p.id === period)?.label}"

if old in content:
    content = content.replace(old, new, 1)
    print('OK: 가상 데이터 label removed')
else:
    print('NOT FOUND')

with open('src/pages/VictoryReportPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')
