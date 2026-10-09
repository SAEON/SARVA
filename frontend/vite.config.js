import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const apiTarget = env.DEV_API_TARGET || 'http://127.0.0.1:5060'
  const tileTarget = env.DEV_TILE_TARGET || 'http://127.0.0.1:3010'

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/public': { target: apiTarget, changeOrigin: true },
        '/tiles': {
          target: tileTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/tiles(?=\/|$)/, ''),
        },
      },
    },
  }
})
