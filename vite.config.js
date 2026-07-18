import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

const DEV_HOST = '127.0.0.1'
const DEV_PORT = 5173

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      /** 실수로 클라이언트에서 import 하면 빌드/런타임에서 즉시 차단 */
      'firebase-admin': path.resolve(rootDir, 'src/lib/stubs/firebase-admin-stub.js'),
    },
  },
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
  plugins: [react()],
  // Netlify Dev(netlify.toml targetPort=5173)가 이 포트로만 붙습니다.
  // Windows: localhost(IPv6 ::1)와 127.0.0.1 혼용 시 탭마다 연결 실패·로딩 멈춤이 날 수 있어 IPv4로 고정합니다.
  server: {
    host: DEV_HOST,
    port: DEV_PORT,
    strictPort: true,
    open: `http://${DEV_HOST}:${DEV_PORT}/`,
    hmr: {
      host: DEV_HOST,
      port: DEV_PORT,
    },
    headers: {
      'Cache-Control': 'no-store',
    },
  },
})
