import re, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

files = [
    'src/pages/NoticeDetailPage.jsx',
    'src/pages/NoticePage.jsx',
    'src/lib/inquiryAdminStorage.js',
]

for path in files:
    with open(path, 'rb') as f:
        raw = f.read()
    text = raw.decode('utf-8')
    orig = text

    # 포인트 N개 -> 포인트 N점
    text = re.sub(r'(포인트 \d+)개', r'\g<1>점', text)

    # 포인트을 -> 포인트를
    text = text.replace('포인트을', '포인트를')

    # 포인트이 (조사) -> 포인트가
    text = text.replace('포인트이 ', '포인트가 ')
    text = text.replace('포인트이\n', '포인트가\n')

    if text != orig:
        with open(path, 'wb') as f:
            f.write(text.encode('utf-8'))
        print(f'{path}: 수정됨')
    else:
        print(f'{path}: 변경 없음')

print('완료!')
