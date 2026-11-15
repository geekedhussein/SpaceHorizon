import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  publicDir: 'static',
  server: {
    // The FastAPI server runs on :8000 in development (see CLAUDE.md section 8).
    // 127.0.0.1, not localhost: Node may resolve localhost to ::1, where
    // uvicorn does not listen by default.
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/ws': { target: 'ws://127.0.0.1:8000', ws: true },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
