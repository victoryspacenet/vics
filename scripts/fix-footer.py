import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/components/layout/Footer.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = """          <p className="text-[#999999]/80 leading-relaxed break-words">
            (주)빅토리스페이스 | 대표: 임성빈 | 사업자등록번호: 000-00-00000 | 서울특별시 강남구 테헤란로 123
          </p>
"""

new = ""

if old in content:
    content = content.replace(old, new)
    print('Removed company info line')
else:
    print('Pattern not found')

with open('src/components/layout/Footer.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')
