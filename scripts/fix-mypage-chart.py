import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/pages/MyPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove demoCreated function definition and comment
old_demo_fn = """    // 생성한 매치업 임의 값 (물결 패턴, 실제 데이터가 없을 때 시각적 참고용)
    const demoCreated = (n) => Array.from({ length: n }, (_, i) =>
      Math.max(0, Math.round(Math.sin(i * 0.7) * 2 + Math.cos(i * 0.5) * 1.5 + 3))
    )
"""
new_demo_fn = ""

# 2. Weekly: replace demo fallback with just realCreated
old_weekly = "        created.push(realCreated > 0 ? realCreated : demoCreated(7)[6 - i])"
new_weekly = "        created.push(realCreated)"

# 3. Monthly: remove demo variable and replace demo fallback with just realCreated
old_monthly_demo = "      const demo = demoCreated(4)\n"
new_monthly_demo = ""

old_monthly_push = "        created.push(realCreated > 0 ? realCreated : demo[i])"
new_monthly_push = "        created.push(realCreated)"

replacements = [
    (old_demo_fn, new_demo_fn),
    (old_weekly, new_weekly),
    (old_monthly_demo, new_monthly_demo),
    (old_monthly_push, new_monthly_push),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        print(f'OK: {repr(old[:60])}')
    else:
        print(f'NOT FOUND: {repr(old[:60])}')

with open('src/pages/MyPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')
