import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/coincap/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined, // Prevent chunk splitting for iframe compatibility
      },
    },
  },
  server: {
    headers: {
      // Enhanced CSP for Blast Mobile iframe environment
      'Content-Security-Policy': "frame-ancestors 'self' https://*.blast.io https://*.testblast.io https://app.blast.io https://dapptest-d45v.develop.testblast.io; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://assets.blast.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: wss:;",
      'X-Frame-Options': 'ALLOWALL',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
    host: true,
    port: 3002,
    strictPort: false,
    hmr: {
      port: 3002,
    },
  },
  define: {
    global: 'globalThis',
  },
})
