import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/pages/RankingPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove applyMockStats function definition (with comment)
old_fn = """// ── 임의 수치 생성 (목업) ────────────────────────────────────────────
function applyMockStats(row, index) {
  const seed = (row?.id?.slice(-8) || '').split('').reduce((a, c) => a + c.charCodeAt(0), index)
  const rank = index + 1
  const voteTotal = Math.max(5, 15 + rank * 3 + (seed % 20))
  const voteHits = Math.max(0, Math.min(voteTotal, Math.floor(voteTotal * (0.45 + (seed % 50) / 100))))
  return {
    ...row,
    points: Math.max(0, 4200 - rank * 180 + (seed % 400)),
    total_votes_received: Math.max(0, 2800 - rank * 120 + (seed % 300)),
    vote_total: voteTotal,
    vote_hits: voteHits,
    oracle_points: voteHits * 5,
    hit_rate: voteTotal > 0 ? Math.round((voteHits / voteTotal) * 1000) / 10 : 0,
    _change: (() => {
      const options = ['NEW', 0, 1, 2, 3, 4, 5, -1, -2, -3, -4, -5]
      return options[(seed + rank) % options.length]
    })(),
  }
}

"""
new_fn = ""

# 2. Replace applyMockStats call with plain row mapping
old_call = "      const rows = (data || []).map((r, i) => applyMockStats(r, from + i))"
new_call = "      const rows = data || []"

for old, new in [(old_fn, new_fn), (old_call, new_call)]:
    if old in content:
        content = content.replace(old, new, 1)
        print(f'OK: {repr(old[:60])}')
    else:
        print(f'NOT FOUND: {repr(old[:60])}')

with open('src/pages/RankingPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')
