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
  server: {
    open: true,
  },
})
