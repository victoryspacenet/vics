import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/pages/PointRewardsPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the card className - since we only show when isDiamondTier, always use active style
old = """              className={cn(
                  CARD,
                  'flex flex-col p-5 sm:p-6 transition-all',
                  isDiamondTier
                    ? 'ring-1 ring-cyan-300/50 shadow-[0_8px_36px_-12px_rgba(34,211,238,0.25)]'
                    : 'opacity-95 ring-1 ring-slate-200/80',
                )}"""

new = """              className={cn(
                  CARD,
                  'flex flex-col p-5 sm:p-6 transition-all',
                  'ring-1 ring-cyan-300/50 shadow-[0_8px_36px_-12px_rgba(34,211,238,0.25)]',
                )}"""

if old in content:
    content = content.replace(old, new)
    print('Card className simplified')
else:
    print('ERROR: Card className pattern not found')
    idx = content.find('ring-cyan-300/50')
    if idx >= 0:
        print(repr(content[idx-100:idx+100]))

with open('src/pages/PointRewardsPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')
