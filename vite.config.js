import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { exec } from 'node:child_process'
import os from 'node:os'

/** 개발 서버 기동 후 추가 브라우저 탭으로 URL 열기 (Windows / macOS / Linux) */
function openBrowserUrl(url) {
  const platform = os.platform()
  const cmd =
    platform === 'win32'
      ? `start "" "${url}"`
      : platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`
  exec(cmd, (err) => {
    if (err) console.warn('[vite] open-browser-url:', err.message)
  })
}

// https://vite.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('lucide-react')) return 'lucide'
          if (id.includes('react-router')) return 'react-router'
          if (id.includes('react-dom') || id.includes('/react/')) return 'react-core'
          if (id.includes('html-to-image') || id.includes('qrcode')) return 'export-image'
          if (id.includes('@capacitor')) return 'capacitor'
        },
      },
    },
    chunkSizeWarningLimit: 1200,
  },
  plugins: [
    react(),
    {
      name: 'open-admin-tab',
      apply: 'serve',
      configureServer(server) {
        server.httpServer?.once('listening', () => {
          const addr = server.httpServer?.address()
          const port = typeof addr === 'object' && addr ? addr.port : null
          if (!port) return
          const proto = server.config.server.https ? 'https' : 'http'
          const host =
            server.config.server.host === true ? 'localhost' : server.config.server.host || 'localhost'
          const base = `${proto}://${host}:${port}`
          setTimeout(() => openBrowserUrl(`${base}/admin`), 800)
        })
      },
    },
  ],
  // Netlify Dev(netlify.toml targetPort=5173)가 이 포트로만 붙습니다.
  // 5173이 이미 쓰이면 다른 포트로 올라가면 8888 프록시가 깨지므로 strictPort로 즉시 실패시킵니다.
  // Windows에서 기본 localhost 바인딩이 [::1]만 잡히면 127.0.0.1:5173 접속이 실패해
  // Netlify 프록시(8888)가 빈 화면·로딩 멈춤처럼 보일 수 있어 host: true 로 정리합니다.
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    open: true,
  },
})
