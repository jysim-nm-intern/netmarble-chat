import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'window',
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    clearMocks: true,
    globals: true,
    exclude: ['e2e/**', '**/node_modules/**'],
  },
  server: {
    host: '0.0.0.0',
    port: process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.VITE_WS_TARGET || 'ws://localhost:8080',
        ws: true,
      }
    }
  }
})
