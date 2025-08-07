import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' && process.env.GITHUB_ACTIONS ? '/coincap/' : '/',
  server: {
    headers: {
      // Content Security Policy for Blast Mobile iframe support
      'Content-Security-Policy': 'frame-ancestors https://dapptest-d45v.develop.testblast.io https://app.blast.io; script-src \'self\' \'unsafe-inline\' https://assets.blast.io;',
    },
    host: true, // Allow external connections for mobile testing
    port: 3002, // Match the current running port
    strictPort: false, // Allow port fallback
    hmr: {
      port: 3002, // Ensure HMR uses the same port
    },
  },
  define: {
    global: 'globalThis',
  },
})
