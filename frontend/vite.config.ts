import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Myfxbook 代理（必须放在 /api 之前，开发环境生效；生产由 Vercel Function 处理）
      '/api/proxy/myfxbook': {
        target: 'https://www.myfxbook.com',
        changeOrigin: true,
        rewrite: () => '/community/outlook',
      },
      // 开发期代理后端 REST 与 WebSocket
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
})
