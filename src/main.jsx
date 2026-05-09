import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { startCategoryConfigRemoteSync } from './lib/categoryAdminStorage'

startCategoryConfigRemoteSync()

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML =
    '<p style="font-family:system-ui;padding:1rem">#root 요소가 없습니다. index.html을 확인해 주세요.</p>'
} else {
  try {
    createRoot(rootEl).render(
      <HelmetProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </HelmetProvider>
    )
  } catch (err) {
    console.error('[main] mount failed:', err)
    const safeMsg = String(err?.message || err)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    rootEl.innerHTML = `<div style="font-family:system-ui;padding:1.25rem;max-width:28rem;margin:2rem auto;border:1px solid #e5e7eb;border-radius:12px;background:#fafafa">
      <p style="font-weight:700;margin:0 0 0.5rem">앱을 불러오지 못했어요</p>
      <p style="margin:0;font-size:14px;color:#64748b;word-break:break-all">${safeMsg}</p>
      <p style="margin:1rem 0 0;font-size:13px;color:#94a3b8">개발자 콘솔(F12)의 오류 메시지를 확인해 주세요.</p>
    </div>`
  }
}
