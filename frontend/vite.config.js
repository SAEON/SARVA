import { randomUUID } from 'node:crypto'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const apiTarget = env.DEV_API_TARGET || 'http://127.0.0.1:5060'
  const tileTarget = env.DEV_TILE_TARGET || 'http://127.0.0.1:3010'

  const buildId = randomUUID()
  return {
    define: { __SARVA_BUILD_ID__: JSON.stringify(buildId) },
    plugins: [react(), {
      name: 'sarva-build-version',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({version:buildId}) })
      },
    }],
    resolve: {
      // Mounted/symlinked source must share the preview root's React instance.
      dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
    },
    server: {
      host: '127.0.0.1',
      // Windows bind mounts may not deliver filesystem events into Docker.
      watch: { usePolling: true, interval: 500 },
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true, xfwd: true },
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
