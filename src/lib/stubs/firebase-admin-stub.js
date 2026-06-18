/** 브라우저 번들에 firebase-admin 이 섞이지 않도록 Vite alias 가로채기용 */
throw new Error(
  'firebase-admin is server-only. Use Netlify Functions (netlify/lib/fcmCore.cjs), not the client bundle.',
)
