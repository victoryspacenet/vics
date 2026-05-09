import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('src/store/authStore.js', 'r', encoding='utf-8') as f:
    content = f.read()

# After the fandom tier override block (line 170-175), add neon theme reset for dev
old = """          if (import.meta.env.DEV) {
            const forceDiamondNick = import.meta.env.VITE_DEV_FANDOM_TIER_AS_DIAMOND_FOR_NICKNAME?.trim()
            if (forceDiamondNick && String(profile.nickname || '').trim() === forceDiamondNick) {
              profile = { ...profile, fandom_tier: 'diamond' }
            }
          }

          try {"""

new = """          if (import.meta.env.DEV) {
            const forceDiamondNick = import.meta.env.VITE_DEV_FANDOM_TIER_AS_DIAMOND_FOR_NICKNAME?.trim()
            if (forceDiamondNick && String(profile.nickname || '').trim() === forceDiamondNick) {
              profile = { ...profile, fandom_tier: 'diamond' }
            }
            // DEV: 네온/공개권한 강제 초기화 닉네임 목록 (env로 제어)
            const resetPurchasesNick = import.meta.env.VITE_DEV_RESET_PURCHASES_FOR_NICKNAME?.trim()
            if (resetPurchasesNick && String(profile.nickname || '').trim() === resetPurchasesNick) {
              profile = {
                ...profile,
                neon_profile_theme_unlocked_at: null,
                neon_profile_theme_expires_at: null,
                neon_profile_theme_id: null,
                profile_public_unlocked_at: null,
                profile_public_expires_at: null,
              }
            }
          }

          try {"""

if old in content:
    content = content.replace(old, new, 1)
    print('OK: dev reset block added')
else:
    print('NOT FOUND')

with open('src/store/authStore.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done!')
