import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/lib/mainFeed.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the 3rd fallback item (부먹 vs 찍먹)
old_item3 = """,
  {
    id: 'hot-demo-3',
    title: '부먹 vs 찍먹',
    left_votes: 52,
    right_votes: 48,
    total_votes: 120,
    left_type: 'image',
    right_type: 'image',
    left_label: '부먹',
    right_label: '찍먹',
    left_thumbnail_url: '/images/demo/bumuk.svg',
    right_thumbnail_url: '/images/demo/jjikmuk.svg',
    tags: ['음식', '한식'],
    profiles: { nickname: '데모', avatar_url: null },
  },
]"""

new_item3 = """
]"""

if old_item3 in content:
    content = content.replace(old_item3, new_item3)
    print('Removed hot-demo-3 (부먹 vs 찍먹)')
else:
    print('ERROR: hot-demo-3 pattern not found')

# Update fallback condition: >= 3 → >= 2
old_cond = 'const hotList = hotFromDb.length >= 3 ? hotFromDb : HOT_FALLBACK'
new_cond = 'const hotList = hotFromDb.length >= 2 ? hotFromDb : HOT_FALLBACK'
if old_cond in content:
    content = content.replace(old_cond, new_cond)
    print('Updated fallback condition: >= 3 → >= 2')
else:
    print('ERROR: fallback condition not found')

with open('src/lib/mainFeed.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')
