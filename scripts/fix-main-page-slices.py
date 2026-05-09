import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/pages/MainPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    ('data.best.slice(0, 4)', 'data.best.slice(0, 2)'),
    ('data.hot.slice(0, 3)', 'data.hot.slice(0, 2)'),
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        print(f'OK: {old} -> {new}')
    else:
        print(f'NOT FOUND: {old}')

with open('src/pages/MainPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')
