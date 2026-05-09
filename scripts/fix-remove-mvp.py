import sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# ── 1. VictoryReportPage.jsx ──────────────────────────────────────────
with open('src/pages/VictoryReportPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    # EMPTY_STATS에서 totalMvp 제거
    ('  totalMvp: 0,\n', ''),
    # metrics 객체에서 totalMvp 제거 (hideCraftAndPay 분기)
    ('        totalMvp: 0,\n', ''),
    # metrics 객체에서 totalMvp: demoStats.totalMvp 제거
    ('      totalMvp: demoStats.totalMvp,\n', ''),
    # VCardStoryCanvas props에서 totalMvp 제거 (3곳)
    ('                    totalMvp={demoStats.totalMvp}\n', ''),
    ('            totalMvp={demoStats.totalMvp}\n', ''),
    # 요약 텍스트에서 MVP 제거
    (' / MVP: {demoStats.totalMvp}', ''),
]

for old, new in replacements:
    count = content.count(old)
    if count > 0:
        content = content.replace(old, new)
        print(f'OK ({count}x): {repr(old[:60])}')
    else:
        print(f'NOT FOUND: {repr(old[:60])}')

with open('src/pages/VictoryReportPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('VictoryReportPage done\n')

# ── 2. VCardStoryCanvas.jsx ───────────────────────────────────────────
with open('src/components/vcard/VCardStoryCanvas.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

replacements_vcard = [
    # prop 선언에서 totalMvp 제거
    ('    totalMvp,\n', ''),
    # "승리 · MVP" 라벨을 "승리"로 변경
    ("승리 · MVP", "승리"),
    # TOTAL MVP 텍스트 제거 (두 곳)
    (' / TOTAL MVP:{' + "' '}\n            <span className={cn('font-black', t.accent)}>{totalMvp}</span>", ''),
    (' / TOTAL MVP:{' + "' '}\n            <span className={cn('font-black', t.accent)}>{totalMvp}</span>", ''),
]

for old, new in replacements_vcard:
    count = content.count(old)
    if count > 0:
        content = content.replace(old, new)
        print(f'OK ({count}x): {repr(old[:60])}')
    else:
        print(f'NOT FOUND: {repr(old[:60])}')

with open('src/components/vcard/VCardStoryCanvas.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('VCardStoryCanvas done\n')

# ── 3. StoryNeonLayers.jsx ────────────────────────────────────────────
with open('src/components/vcard/StoryNeonLayers.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# MvpCrownPill 함수 자체와 사용처 모두 제거는 복잡하므로 사용처만 제거
if '<MvpCrownPill />' in content:
    content = content.replace('<MvpCrownPill />\n', '')
    print('OK: MvpCrownPill usage removed from StoryNeonLayers')
else:
    print('NOT FOUND: MvpCrownPill usage')

with open('src/components/vcard/StoryNeonLayers.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('StoryNeonLayers done')
